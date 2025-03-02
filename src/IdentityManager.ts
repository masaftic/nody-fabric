import FabricCAServices from 'fabric-ca-client';
import { IEnrollmentRequest, IRegisterRequest } from 'fabric-ca-client';
import * as fs from 'fs/promises';
import fsSync from 'fs';
import * as path from 'path';
import { User, Utils } from 'fabric-common';

export class IdentityManager {
    private ca: FabricCAServices;
    private walletPath: string;

    constructor(caUrl: string, tlsCert?: string) {
        const options: any = {
            verify: false
        };

        options.trustedRoots = [tlsCert];

        this.ca = new FabricCAServices(caUrl, options);
        this.walletPath = path.join(__dirname, '..', 'wallet');
    }

    async enrollAdmin(): Promise<User> {
        const adminCertPath = path.join(this.walletPath, 'admin', 'cert.pem');
        const adminKeyPath = path.join(this.walletPath, 'admin', 'key.pem');

        try {
            // Check if admin credentials already exist
            const certExists = await fs.access(adminCertPath)
                .then(() => true)
                .catch(() => false);
            const keyExists = await fs.access(adminKeyPath)
                .then(() => true)
                .catch(() => false);

            if (certExists && keyExists) {
                console.log('Loading existing admin credentials');
                const certificate = await fs.readFile(adminCertPath, 'utf8');
                const privateKeyPEM = await fs.readFile(adminKeyPath, 'utf8');
                
                const adminIdentity = new User('admin');
                
                
                const cryptoSuite = Utils.newCryptoSuite();
                const cryptoStore = Utils.newCryptoKeyStore();
                cryptoSuite.setCryptoKeyStore(cryptoStore);
                
                const key = await cryptoSuite.importKey(privateKeyPEM, { ephemeral: true });
                
                await adminIdentity.setEnrollment(
                    key,
                    certificate,
                    'Org1MSP'
                );
                
                return adminIdentity;
            }

            // If credentials don't exist, enroll admin
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
            console.error('Failed to get admin identity:', error);
            throw error;
        }
    }

    async registerUser(
        adminIdentity: User,
        userId: string,
        userAffiliation: string,
        userRole: string
    ): Promise<string> {
        const registerRequest: IRegisterRequest = {
            enrollmentID: userId,
            enrollmentSecret: '',
            role: 'client',
            affiliation: userAffiliation,
            maxEnrollments: -1,
            attrs: [{
                name: 'role',
                value: userRole,
                ecert: true
            }]
        };

        const secret = await this.ca.register(registerRequest, adminIdentity);
        console.log(`Successfully registered user ${userId}`);
        return secret;
    }

    async enrollUser(userId: string, userSecret: string): Promise<User> {
        const enrollmentRequest: IEnrollmentRequest = {
            enrollmentID: userId,
            enrollmentSecret: userSecret
        };

        const enrollment = await this.ca.enroll(enrollmentRequest);
        await this.saveCertificates(userId, enrollment);


        const userIdentity = new User(userId);
        await userIdentity.setEnrollment(
            enrollment.key,
            enrollment.certificate,
            'Org1MSP'
        );

        console.log(`Successfully enrolled user ${userId}`);
        return userIdentity;
    }

    private async saveCertificates(
        userId: string,
        enrollment: FabricCAServices.IEnrollResponse
    ): Promise<void> {
        const certsDir = path.join(this.walletPath, userId);
        await fs.mkdir(certsDir, { recursive: true });

        await fs.writeFile(
            path.join(certsDir, `cert.pem`),
            enrollment.certificate
        );
        await fs.writeFile(
            path.join(certsDir, `key.pem`),
            enrollment.key.toBytes()
        );
    }
}