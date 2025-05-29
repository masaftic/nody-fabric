import FabricCAServices, { IdentityService, IEnrollResponse, IIdentityRequest, IRevokeRequest } from 'fabric-ca-client';
import { IEnrollmentRequest, IRegisterRequest } from 'fabric-ca-client';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { User, Utils } from 'fabric-common';
import { adminWalletPath, caURL, tlsCertPath, usersWalletPath, walletPath } from './config';

class IdentityManagerError extends Error {
    constructor(message: string, public readonly cause?: Error) {
        super(message);
        this.name = 'IdentityManagerError';
    }
}

export class IdentityManager {
    private ca: FabricCAServices;
    private identityService: IdentityService;
    private caUrl: string = caURL; 
    private tlsCert: string = fsSync.readFileSync(tlsCertPath).toString();

    constructor() {
        try {
            const options: any = {
                verify: false,
                trustedRoots: this.tlsCert ? [this.tlsCert] : undefined
            };

            this.ca = new FabricCAServices(this.caUrl, options);
            this.identityService = this.ca.newIdentityService();
        } catch (error) {
            throw new IdentityManagerError('Failed to initialize IdentityManager', error as Error);
        }
    }

    async getUser(userId: string): Promise<any> {
        const admin = await this.enrollAdmin();
        const result = await this.identityService.getOne(userId, admin);
        console.log(JSON.stringify(result));
    }


    async enrollAdmin(): Promise<User> {
        const adminCertPath = path.join(adminWalletPath, 'cert.pem');
        const adminKeyPath = path.join(adminWalletPath, 'key.pem');

        try {
            // Verify wallet directory exists
            await fs.mkdir(walletPath, { recursive: true });

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
            const certPath = path.join(adminWalletPath, 'cert.pem');
            const keyPath = path.join(adminWalletPath, 'key.pem');

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
            throw new IdentityManagerError('Failed to enroll new admin' + JSON.stringify(error), error as Error);
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
                enrollmentSecret: userId, // TODO: what is a good secret here?
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

    async enrollUser(userId: string, secret?: string): Promise<IEnrollResponse> {
        const enrollmentRequest: IEnrollmentRequest = {
            enrollmentID: userId,
            enrollmentSecret: secret || userId,  // Use provided secret or default to userId
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
        const certPath = path.join(usersWalletPath, userId, 'cert.pem');
        const keyPath = path.join(usersWalletPath, userId, 'key.pem');

        return await Promise.all([
            fs.readFile(certPath, 'utf8'),
            fs.readFile(keyPath, 'utf8')
        ]);
    }

    async loadAdminCredentials(): Promise<[string, string]> {
        const certPath = path.join(adminWalletPath, 'cert.pem');
        const keyPath = path.join(adminWalletPath, 'key.pem');

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
                walletPath,
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

    /**
     * Revoke a user's certificate
     * @param adminIdentity The admin user to perform the revocation
     * @param userId The user ID to revoke
     * @param reason The reason for revocation
     * @returns true if the revocation was successful
     */
    async revokeUserCertificate(
        adminIdentity: User,
        userId: string,
        reason: string
    ): Promise<boolean> {
        try {
            if (!adminIdentity) {
                throw new IdentityManagerError('Admin identity is required for certificate revocation');
            }

            // Prepare the revocation request
            const request: IRevokeRequest = {
                enrollmentID: userId,
                reason: reason || 'User certificate revoked',
                // We can optionally add more parameters:
                // caname: 'ca.org1.example.com', // If using specific CA name
                // aki: 'Authority Key Identifier', // If known
                // serial: 'Serial Number', // If known
                // revoke_registrar: false, // Do we want to revoke the registrar identity too?
            };

            // Perform the revocation
            await this.ca.revoke(request, adminIdentity);
            console.log(`Successfully revoked certificate for user ${userId}`);

            // Delete the user's certificate files
            try {
                const userCertsDir = path.join(usersWalletPath, userId);
                await fs.rm(userCertsDir, { recursive: true, force: true });
                console.log(`Removed certificate files for user ${userId}`);
            } catch (fileError) {
                // Just log the error but don't fail the operation
                console.warn(`Could not remove certificate files for ${userId}: ${fileError}`);
            }

            return true;
        } catch (error) {
            console.error(`Error revoking certificate for user ${userId}:`, error);
            throw new IdentityManagerError(
                `Failed to revoke certificate for user ${userId}`,
                error as Error
            );
        }
    }

    /**
     * Get the revocation list (CRL) from the CA
     * @param adminIdentity The admin user to fetch the revocation list
     * @returns The certificate revocation list
     */
    async getCertificateRevocationList(adminIdentity: User): Promise<string> {
        try {
            if (!adminIdentity) {
                throw new IdentityManagerError('Admin identity is required to get CRL');
            }

            const crl = await this.ca.generateCRL({}, adminIdentity);
            return crl;
        } catch (error) {
            throw new IdentityManagerError(
                'Failed to get certificate revocation list',
                error as Error
            );
        }
    }
}