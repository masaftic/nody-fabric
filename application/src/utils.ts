
// export async function timeOperation<T>(name: string, fn: () => Promise<T>): Promise<T> {
//     console.log(`\nStarting: ${name}`);
//     const start = Date.now();
//     const result = await fn();
//     const elapsed = (Date.now() - start) / 1000;
//     console.log(`Completed: ${name} in ${elapsed.toFixed(3)}s`);
//     return result;
// }

import chalk from 'chalk';

export async function timeOperation<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinnerIndex = 0;
    const interval = setInterval(() => {
        process.stdout.write(`\r${spinner[spinnerIndex]} ${name}...`);
        spinnerIndex = (spinnerIndex + 1) % spinner.length;
    }, 80);

    console.log(chalk.blue(`\n🚀 Starting: ${name}`));
    const start = Date.now();
    
    try {
        const result = await fn();
        const elapsed = (Date.now() - start) / 1000;
        clearInterval(interval);
        process.stdout.write('\r');
        
        // Color code based on execution time
        const timeColor = elapsed < 1 ? 'green' : elapsed < 3 ? 'yellow' : 'red';
        console.log(chalk[timeColor](`\n✅ Completed: ${name} in ${elapsed.toFixed(3)}s\n`));
        
        return result;
    } catch (error: any) {
        clearInterval(interval);
        process.stdout.write('\r');
        console.log(chalk.red(`❌ Failed: ${name} - ${error.message}`));
        throw error;
    }
}