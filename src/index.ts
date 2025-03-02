import FabricCAServices from 'fabric-ca-client';
import { IEnrollmentRequest, IRegisterRequest } from 'fabric-ca-client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ICryptoSuite, ICryptoKey, User } from 'fabric-common';

async function enrollAdmin(ca: FabricCAServices): Promise<FabricCAServices.IEnrollResponse> {
    const enrollment = await ca.enroll({
        enrollmentID: 'admin',
        enrollmentSecret: 'adminpw'
    });
    
    return enrollment;
}

async function registerUser(
    ca: FabricCAServices,
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

    const secret = await ca.register(registerRequest, adminIdentity);
    console.log(`Successfully registered user ${userId}`);
    return secret;
}

async function enrollUser(
    ca: FabricCAServices,
    userId: string,
    userSecret: string
): Promise<FabricCAServices.IEnrollResponse> {
    const enrollmentRequest: IEnrollmentRequest = {
        enrollmentID: userId,
        enrollmentSecret: userSecret
    };

    const enrollment = await ca.enroll(enrollmentRequest);
    console.log(`Successfully enrolled user ${userId}`);
    return enrollment;
}

async function saveCertificates(
    userId: string,
    enrollment: FabricCAServices.IEnrollResponse
): Promise<void> {
    const certsDir = path.join(__dirname, "..", "wallet", userId);
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

async function main() {
    try {
        const tlsCertPath = path.join(__dirname, '..', 'ca-server', 'tls-cert.pem');
        const tlsCert = await fs.readFile(tlsCertPath);
        const caURL = 'https://localhost:7054';
        const ca = new FabricCAServices(caURL, {
            trustedRoots: [tlsCert.toString()],
            verify: false
        });

        // Enroll admin
        const adminEnrollment = await enrollAdmin(ca);
        saveCertificates('admin', adminEnrollment);

        const adminIdentity = new User('admin');
        await adminIdentity.setEnrollment(
            adminEnrollment.key,
            adminEnrollment.certificate,
            'Org1MSP'
        );

        // Register and enroll a new user
        const userId = 'user2';
        const userAffiliation = 'org1.department1';
        const userRole = 'voter';


        // Register user
        const secret = await registerUser(
            ca,
            adminIdentity,
            userId,
            userAffiliation,
            userRole
        );

        // Enroll user
        const enrollment = await enrollUser(ca, userId, secret);

        // Save certificates
        await saveCertificates(userId, enrollment);

    } catch (error) {
        console.error('Failed to register and enroll user:', error);
        throw error;
    }
}

main().catch(console.error);