import { createServerApp } from './server';
require("dotenv").config()
require("express-async-errors");
async function main() {
    const app = await createServerApp();

    app.listen(3000, () => {
        console.log('Server is running on port 3000');
    });
}

main().catch(console.error);
