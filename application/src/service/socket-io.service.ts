import { Server } from 'socket.io';
import http from 'http';
import { logger } from '../logger';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { signers } from '@hyperledger/fabric-gateway';
import { usersWalletPath } from '../fabric-utils/config';

// Define types for response handlers
type SigningResponseHandler = (data: any) => void;

declare global {
    // eslint-disable-next-line no-var
    var socketService: Server;
    // eslint-disable-next-line no-var
    var signingRequests: {
        [userId: string]: number;
    };
    // eslint-disable-next-line no-var
    var signingResponseHandlers: {
        [responseEvent: string]: SigningResponseHandler;
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
    global.signingResponseHandlers = {};

    logger.info('Socket.IO service initialized');

    // Keep track of connected clients for each user
    const connectedClients: { [userId: string]: string[] } = {};

    io.on('connection', (socket) => {
        let userId: string | null = null;
        
        logger.info(`New socket connection: ${socket.id}`);

        // Client registration
        socket.on('register', (data: { userId: string }) => {
            userId = data.userId;
            
            // Initialize user's connected clients if needed
            if (!connectedClients[userId]) {
                connectedClients[userId] = [];
            }
            
            // Add this socket to user's connected clients
            connectedClients[userId].push(socket.id);
            
            logger.info(`Client registered for user ${userId}: ${socket.id}`);
            
            // Join a room specific to this user
            socket.join(userId);
            
            // Inform client about successful registration
            socket.emit('registration-success', {
                message: `Successfully registered for remote signing for user ${userId}`,
                socketId: socket.id
            });
        });

        // Handle all signing response events with dynamic event names
        socket.onAny((eventName, data) => {
            // Check if this is a signing response event
            if (eventName.startsWith('signing-response:')) {
                logger.info(`Received event ${eventName} from client ${socket.id}`);
                
                // If we have a registered handler for this response event, call it
                if (global.signingResponseHandlers && global.signingResponseHandlers[eventName]) {
                    global.signingResponseHandlers[eventName](data);
                    // Remove the handler after it's been called
                    delete global.signingResponseHandlers[eventName];
                } else {
                    logger.warn(`Received response for ${eventName} but no handler was registered`);
                }
            }
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            if (userId && connectedClients[userId]) {
                // Remove this socket from user's connected clients
                connectedClients[userId] = connectedClients[userId].filter(id => id !== socket.id);
                
                logger.info(`Client disconnected for user ${userId}: ${socket.id}`);
                
                // If this was the last client for this user, clean up
                if (connectedClients[userId].length === 0) {
                    delete connectedClients[userId];
                    logger.info(`All clients for user ${userId} disconnected`);
                }
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
 * Register a handler for a specific signing response event
 * @param responseEvent - The response event name to listen for
 * @param handler - The handler function to call when the event is received
 */
export function registerSigningResponseHandler(responseEvent: string, handler: SigningResponseHandler): void {
    if (!global.signingResponseHandlers) {
        global.signingResponseHandlers = {};
    }
    global.signingResponseHandlers[responseEvent] = handler;
    logger.info(`Registered handler for event: ${responseEvent}`);
}
