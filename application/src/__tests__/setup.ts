import mongoose from 'mongoose';
import { logger } from '../logger';
import dotenv from 'dotenv';
import { connectDb } from '../config/connectToDbAtlas';

// Load environment variables
dotenv.config();

// Suppress unnecessary logs during tests
logger.level = 'error'; // Only show errors

// Setup before all tests
beforeAll(async () => {
  try {
    // Connect to MongoDB for tests
    await connectDb();
    console.log('Connected to MongoDB for testing');
  } catch (error) {
    console.error('Error setting up test environment:', error);
    process.exit(1);
  }
});

// Clean up after all tests
afterAll(async () => {
  try {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('Closed MongoDB connection');
  } catch (error) {
    console.error('Error tearing down test environment:', error);
  }
});
