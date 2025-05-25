import { Server } from 'socket.io';

// Define types for response handlers
type SigningResponseHandler = (data: any) => void;

declare global {
    namespace NodeJS {
        interface Global {
            socketService: Server;
            signingRequests: {
                [userId: string]: number;
            };
            signingHandlers: {
                [requestId: string]: SigningResponseHandler;
            };
        }
    }
}

export {};
