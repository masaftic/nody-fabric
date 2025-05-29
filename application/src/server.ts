import express, { NextFunction, Request, Response } from 'express';
import { createServer } from 'http';
import { logger } from './logger';
import { IdentityManager } from './fabric-utils/identityManager';
import { fabricAdminConnection } from './fabric-utils/fabric';
import { authRouter } from "./routes/auth.route";
import { votesRouter } from "./routes/votes.route";
import { electionRouter } from "./routes/elections.route";
import { ledgerRouter } from "./routes/ledger.route";
import connectDb, { isDbConnected } from './config/connectToDbAtlas';
import { initFabricEventService } from './service/fabric-event.service';
import { initSocketIOService } from './service/socket-io.service';
import { uploadsRouter } from './routes/uploads.route';
import { usersRouter } from './routes/users.route';
import { auditRouter } from './routes/audits.route';

export const createServerApp = async () => {
    const app = express();
    const httpServer = createServer(app);

    // allow cors
    app.use((req: Request, res: Response, next: NextFunction) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });

    // Initialize Socket.IO for remote signing
    const io = initSocketIOService(httpServer);
    logger.info('Socket.IO service initialized for remote signing');

    // Connect to MongoDB (only used for user data and vote records)
    const dbConnected = await connectDb();
    if (!dbConnected) {
        logger.warn('Starting server without MongoDB connection. User authentication and vote tracking will not work properly.');
    } else {
        logger.info('MongoDB connected successfully (used for user data and vote tracking only)');
    }

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use((req: Request, res: Response, next: NextFunction) => {
        logger.info(`Request: ${req.method} ${req.url}`);
        next();
    });

    // Initialize Fabric event service for admin user
    if (dbConnected) {
        try {
            // Enroll admin
            const identityManager = new IdentityManager();
            await identityManager.enrollAdmin();

            // Use admin connection to Fabric for event service
            const [gateway, client] = await fabricAdminConnection();
            const network = gateway.getNetwork('mychannel');

            // Initialize and start the event service
            const eventService = initFabricEventService(network);
            await eventService.syncInitialData();
            await eventService.startListening();

            logger.info('Fabric event service initialized and started');

            // Don't close the connection - we need it for the event listeners
            // We'll handle proper shutdown in the process termination handlers

            // Set up process termination handlers
            process.on('SIGINT', async () => {
                logger.info('Received SIGINT. Closing Fabric connection and shutting down.');
                gateway.close();
                client.close();
                process.exit(0);
            });

            process.on('SIGTERM', async () => {
                logger.info('Received SIGTERM. Closing Fabric connection and shutting down.');
                gateway.close();
                client.close();
                process.exit(0);
            });

        } catch (error) {
            logger.error(`Failed to initialize Fabric event service: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    app.use("/api/v1/auth", authRouter);
    app.use("/api/v1/users", usersRouter); 
    app.use("/api/v1/votes", votesRouter);
    app.use("/api/v1/elections", electionRouter);
    app.use("/api/v1/ledger", ledgerRouter);
    app.use("/api/v1/uploads", uploadsRouter);
    app.use("/api/v1/audits", auditRouter);

    // Add a health check endpoint
    app.get('/health', (req: Request, res: Response) => {
        res.status(200).json({
            status: 'UP',
            timestamp: new Date().toISOString(),
            mongodb: isDbConnected() ? 'Connected (user data & vote tracking)' : 'Disconnected'
        });
    });

    app.use((req: Request, res: Response) => {
        res.status(404).json({
            status: 'Not Found',
            timestamp: new Date().toISOString(),
        });
    });

    app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
        logger.error(err);
        res.status(500).json({
            status: 'Internal Server Error',
            timestamp: new Date().toISOString(),
        });
    });

    return httpServer;
}