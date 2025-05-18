import mongoose from "mongoose";
import dotenv from "dotenv";
import { logger } from "../logger";

dotenv.config();
const MONGODB_URI = process.env.MONGODB_URI;

const connectDb = async (): Promise<boolean> => {
    try {
        if (!MONGODB_URI) {
            logger.error("MONGODB_URI is undefined. Please set it in your .env file.");
            return false;
        }

        await mongoose.connect(MONGODB_URI, {
            // Connection options
        });
        
        logger.info("Connected to MongoDB Atlas successfully");
        return true;
    } catch (error) {
        logger.error(`MongoDB connection error: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
};

mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected');
});

mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
    logger.error(`MongoDB connection error: ${err.message}`);
});

mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
});

export const isDbConnected = (): boolean => {
    return mongoose.connection.readyState === 1;
};

export default connectDb;