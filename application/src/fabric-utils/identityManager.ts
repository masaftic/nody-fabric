import FabricCAServices, { IEnrollResponse } from 'fabric-ca-client';
import { IEnrollmentRequest, IRegisterRequest } from 'fabric-ca-client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { User, Utils } from 'fabric-common';
import { caURL, tlsCertPath } from './config';

class IdentityManagerError extends Error {
    constructor(message: string, public readonly cause?: Error) {
        super(message);
        this.name = 'IdentityManagerError';
    }
}

export class IdentityManager {
    private ca: FabricCAServices;
    private walletPath: string;
    private caUrl: string = caURL; 
    private tlsCert: string = tlsCertPath;

    constructor() {
        try {
            const options: any = {
                verify: false,
                trustedRoots: this.tlsCert ? [this.tlsCert] : undefined
            };

            this.ca = new FabricCAServices(this.caUrl, options);
            this.walletPath = path.join(__dirname, '..', 'wallet');
        } catch (error) {
            throw new IdentityManagerError('Failed to initialize IdentityManager', error as Error);
        }
    }

    async enrollAdmin(): Promise<User> {
        const adminCertPath = path.join(this.walletPath, 'admin', 'cert.pem');
        const adminKeyPath = path.join(this.walletPath, 'admin', 'key.pem');

        try {
            // Verify wallet directory exists
            await fs.mkdir(this.walletPath, { recursive: true });

            const [certExists, keyExists] = await Promise.all([
                fs.access(adminCertPath).then(() => true).catch(() => false),
                fs.access(adminKeyPath).then(() => true).catch(() => false)
            ]);

            if (certExists !== keyExists) {
                throw new IdentityManagerError('Admin credentials are in an inconsistent state');
            }

            if (certExists && keyExists) {
                return await this.loadExistingAdmin();
            }

            return await this.enrollNewAdmin();
        } catch (error) {
            if (error instanceof IdentityManagerError) {
                throw error;
            }
            throw new IdentityManagerError('Failed to enroll admin', error as Error);
        }
    }

    async loadExistingAdmin(): Promise<User> {
        try {
            const certPath = path.join(this.walletPath, 'admin', 'cert.pem');
            const keyPath = path.join(this.walletPath, 'admin', 'key.pem');

            console.log('Loading existing admin credentials');
            const [certificate, privateKeyPEM] = await Promise.all([
                fs.readFile(certPath, 'utf8'),
                fs.readFile(keyPath, 'utf8')
            ]);

            const adminIdentity = new User('admin');
            const cryptoSuite = Utils.newCryptoSuite();
            const cryptoStore = Utils.newCryptoKeyStore();

            if (!cryptoStore) {
                throw new IdentityManagerError('Failed to create crypto store');
            }

            cryptoSuite.setCryptoKeyStore(cryptoStore);

            try {
                const key = await cryptoSuite.importKey(privateKeyPEM, { ephemeral: true });
                await adminIdentity.setEnrollment(key, certificate, 'Org1MSP');
                return adminIdentity;
            } catch (error) {
                throw new IdentityManagerError('Failed to import admin key', error as Error);
            }
        } catch (error) {
            if (error instanceof IdentityManagerError) {
                throw error;
            }
            throw new IdentityManagerError('Failed to load existing admin', error as Error);
        }
    }

    private async enrollNewAdmin(): Promise<User> {
        try {
            console.log('Enrolling admin for the first time');
            const enrollment = await this.ca.enroll({
                enrollmentID: 'admin',
                enrollmentSecret: 'adminpw'
            });

            await this.saveCertificates('admin', enrollment);

            const adminIdentity = new User('admin');
            await adminIdentity.setEnrollment(
                enrollment.key,
                enrollment.certificate,
                'Org1MSP'
            );

            return adminIdentity;
        } catch (error) {
            throw new IdentityManagerError('Failed to enroll new admin', error as Error);
        }
    }

    async registerUser(
        adminIdentity: User,
        userId: string,
        userAffiliation: string,
        userRole: string
    ): Promise<string> {
        try {
            if (!adminIdentity) {
                throw new IdentityManagerError('Admin identity is required');
            }

            const registerRequest: IRegisterRequest = {
                enrollmentID: userId,
                enrollmentSecret: '',
                role: 'client',
                affiliation: userAffiliation,
                maxEnrollments: -1,
                attrs: [
                    { name: 'role', value: userRole, ecert: true },
                    { name: 'hf.Registrar.Roles', value: 'client', ecert: true }
                ]
            };

            const secret = await this.ca.register(registerRequest, adminIdentity);
            console.log(`Successfully registered user ${userId}`);
            return secret;
        } catch (error) {
            throw new IdentityManagerError(
                `Failed to register user ${userId}`,
                error as Error
            );
        }
    }

    async enrollUser(userId: string, userSecret: string): Promise<IEnrollResponse> {
        const enrollmentRequest: IEnrollmentRequest = {
            enrollmentID: userId,
            enrollmentSecret: userSecret,
            subject: `CN=${userId},OU=client`,
        };

        const enrollment = await this.ca.enroll(enrollmentRequest);
        await this.saveCertificates(userId, enrollment);

        console.log(`Successfully enrolled user ${userId}`);
        return enrollment;
    }

    async getUserIdentity(userId: string): Promise<User> {
        const [certificate, privateKeyPEM] = await this.loadUserCredentials(userId);

        const userIdentity = new User(userId);
        const cryptoSuite = Utils.newCryptoSuite();
        const cryptoStore = Utils.newCryptoKeyStore();
        cryptoSuite.setCryptoKeyStore(cryptoStore);
        const key = await cryptoSuite.importKey(privateKeyPEM, { ephemeral: true });
        await userIdentity.setEnrollment(key, certificate, 'Org1MSP');
        return userIdentity;
    }

    async loadUserCredentials(userId: string): Promise<[string, string]> {
        const certPath = path.join(`${this.walletPath}`, 'users', userId, 'cert.pem');
        const keyPath = path.join(`${this.walletPath}`, 'users', userId, 'key.pem');

        return await Promise.all([
            fs.readFile(certPath, 'utf8'),
            fs.readFile(keyPath, 'utf8')
        ]);
    }

    async loadAdminCredentials(): Promise<[string, string]> {
        const certPath = path.join(this.walletPath, 'admin', 'cert.pem');
        const keyPath = path.join(this.walletPath, 'admin', 'key.pem');

        return await Promise.all([
            fs.readFile(certPath, 'utf8'),
            fs.readFile(keyPath, 'utf8')
        ]);
    }

    private async saveCertificates(
        userId: string,
        enrollment: IEnrollResponse
    ): Promise<void> {
        try {
            if (!enrollment?.certificate || !enrollment?.key) {
                throw new IdentityManagerError('Invalid enrollment response');
            }

            const certsDir = path.join(
                this.walletPath,
                userId === 'admin' ? 'admin' : `users/${userId}`
            );

            await fs.mkdir(certsDir, { recursive: true });

            await Promise.all([
                fs.writeFile(
                    path.join(certsDir, 'cert.pem'),
                    enrollment.certificate
                ),
                fs.writeFile(
                    path.join(certsDir, 'key.pem'),
                    enrollment.key.toBytes()
                )
            ]);
        } catch (error) {
            throw new IdentityManagerError(
                `Failed to save certificates for ${userId}`,
                error as Error
            );
        }
    }
}