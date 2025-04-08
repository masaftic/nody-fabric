import { createServerApp } from './server';

async function main() {
    const app = await createServerApp();

    app.listen(3000, () => {
        console.log('Server is running on port 3000');
    });
}

main().catch(console.error);
