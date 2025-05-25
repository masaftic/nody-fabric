import { Server } from 'socket.io';
import http from 'http';
import { logger } from '../logger';

// Define types for response handlers
type SigningResponseHandler = (data: any) => void;

// A more simplified global declaration
declare global {
    // eslint-disable-next-line no-var
    var socketService: Server;
    // eslint-disable-next-line no-var
    var signingRequests: {
        [userId: string]: number;
    };
    // eslint-disable-next-line no-var
    var signingHandlers: {
        [requestId: string]: SigningResponseHandler;
    };
}

/**
 * Initializes the Socket.IO service for remote signing
 * @param httpServer - The HTTP server to attach Socket.IO
 * @returns The Socket.IO server instance
 */
export function initSocketIOService(httpServer: http.Server): Server {
    const io = new Server(httpServer, {
        cors: {
            origin: "*", // In production, restrict to specific origins
            methods: ["GET", "POST"]
        }
    });

    // Store socket service globally for access by the signer function
    global.socketService = io;
    global.signingRequests = {};
    global.signingHandlers = {};

    logger.info('Socket.IO service initialized');

    io.on('connection', (socket) => {
        let userId: string | null = null;
        
        logger.info(`New socket connection: ${socket.id}`);

        // Client registration
        socket.on('register', (data: { userId: string }) => {
            userId = data.userId;
            
            // Join a room specific to this user
            socket.join(userId);
            
            logger.info(`Client registered for user ${userId}: ${socket.id}`);
            
            // Inform client about successful registration
            socket.emit('registration-success', {
                message: `Successfully registered for remote signing for user ${userId}`,
                socketId: socket.id
            });
        });

        // Handle signing responses
        socket.on('signing-response', (data) => {
            const { requestId } = data;
            
            logger.info(`Received signing response for request ${requestId}`);
            
            // Find and execute the associated handler
            if (global.signingHandlers && global.signingHandlers[requestId]) {
                global.signingHandlers[requestId](data);
                // Clean up handler after use
                delete global.signingHandlers[requestId];
            } else {
                logger.warn(`Received response for request ${requestId} but no handler was registered`);
            }
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            if (userId) {
                logger.info(`Client disconnected for user ${userId}: ${socket.id}`);
            } else {
                logger.info(`Unregistered socket disconnected: ${socket.id}`);
            }
        });
    });

    return io;
}

/**
 * Checks if a user has any connected remote signing clients
 * @param userId - The user ID to check
 * @returns True if the user has at least one connected client
 */
export function hasConnectedSigningClients(userId: string): boolean {
    const io = global.socketService;
    if (!io) return false;
    
    // Check if the user's room has any connected sockets
    const room = io.sockets.adapter.rooms.get(userId);
    return !!room && room.size > 0;
}

/**
 * Register a handler for a signing response
 * @param requestId - The request ID to listen for responses
 * @param handler - The handler function to call when the response is received
 */
export function registerSigningHandler(requestId: string, handler: SigningResponseHandler): void {
    if (!global.signingHandlers) {
        global.signingHandlers = {};
    }
    global.signingHandlers[requestId] = handler;
    logger.info(`Registered handler for request: ${requestId}`);
}
