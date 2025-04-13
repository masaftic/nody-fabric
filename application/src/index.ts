import { createServerApp } from './server';
require("dotenv").config()
require("express-async-errors");
import mongoose from "mongoose";
import connectDb from "./config/connectToDbAtlas";
async function main() {
    const app = await createServerApp();

    await connectDb();
    mongoose.connection.once('open',()=>{
        console.log("Connect to Db")
        app.listen(3000, () => {
            console.log('Server is running on port 3000');
        });
    })

    app.listen(3000, () => {
        console.log('Server is running on port 3000');
    });
}

main().catch(console.error);
