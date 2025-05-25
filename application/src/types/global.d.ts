import { Server } from 'socket.io';

declare global {
    namespace NodeJS {
        interface Global {
            socketService: Server;
            signingRequests: {
                [userId: string]: number;
            };
        }
    }
}

export {};
