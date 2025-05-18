import { createServerApp } from './server';
import path from 'path';
import dotenv from 'dotenv';
import { IdentityManager } from './fabric-utils/identityManager';
import { caURL, tlsCertPath } from './fabric-utils/config';

// Load environment variables with explicit path
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });


async function main() {
    const app = await createServerApp();

    app.listen(3000, () => {
        console.log('Server is running on port 3000');
    });
}

main().catch(console.error);


// type User = Prettify<UserBlockChain & UserMetaData>;
interface User extends UserMetaData, UserBlockChain {}

interface UserBlockChain {
    id: string;
    name: string;
}

interface UserMetaData {
    id: string;
    profile: string;
    reviews: string[];
}


type Prettify<T> = {
    [K in keyof T]: T[K];
} & {};
