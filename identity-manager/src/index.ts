import FabricCAServices from 'fabric-ca-client';
import { IEnrollmentRequest, IRegisterRequest } from 'fabric-ca-client';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { ICryptoSuite, ICryptoKey, User } from 'fabric-common';
import { IdentityManager } from './IdentityManager';



async function main() {
    try {
        const tlsCertPath = path.join(__dirname, '..', 'ca-server', 'tls-cert.pem');
        const tlsCert = await fs.readFile(tlsCertPath);
        const caURL = 'https://localhost:7054';

        const identityManager = new IdentityManager(caURL, tlsCertPath);

        // Enroll admin
        const adminIdentity = await identityManager.enrollAdmin();

        // Register and enroll a new user
        const userId = crypto.randomBytes(10).toString('hex');
        const userAffiliation = 'org1.department1';
        const userRole = 'voter';

        // Register user
        const secret = await identityManager.registerUser(
            adminIdentity,
            userId,
            userAffiliation,
            userRole
        );

        // Enroll user
        const userIdentity = await identityManager.enrollUser(userId, secret);

        console.log('Successfully registered and enrolled user:', userIdentity);
    }
    catch (error) {
        console.error('Failed to register and enroll user:', error);
        throw error;
    }
}

main().catch(console.error);