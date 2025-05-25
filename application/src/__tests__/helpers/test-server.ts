import express, { Express } from 'express';
import { authRouter } from '../../routes/auth.route';
import { votesRouter } from '../../routes/votes.route';
import { electionRouter } from '../../routes/elections.route';
import { ledgerRouter } from '../../routes/ledger.route';

/**
 * Creates a test Express application with all routes configured
 */
export function createTestServer(): Express {
    const app = express();

    // Middleware
    app.use(express.json());

    // Routes
    app.use("/api/v1/users", authRouter);
    app.use("/api/v1/votes", votesRouter);
    app.use("/api/v1/elections", electionRouter);
    app.use("/api/v1/ledger", ledgerRouter);

    return app;
}
