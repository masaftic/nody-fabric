import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config()
const MONGODB_URI = process.env.MONGODB_URI
const connectDb = async ():Promise<void> => {
    try {
        if (MONGODB_URI)
            await mongoose.connect(MONGODB_URI)
        else{
            console.log("MONGODB_URI undifined")
        }
    }
    catch (e) {
        console.error(e)
    }
}
mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});
export default connectDb;