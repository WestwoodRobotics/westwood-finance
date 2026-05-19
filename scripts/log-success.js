import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const infoPath = path.join(__dirname, '..', 'src', 'lib', 'app-info.json');

try {
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));

    process.stdout.write(`\ Deploying Westwood Finance v${info.version}...\n`);
    process.stdout.write(`Build Time: ${info.deployedAt}\n\n`);
    process.stdout.write(`✅ Status: SUCCESS\n`);
    process.stdout.write(`Deployment: https://finance.westwoodrobots.org\n\n`);

} catch (error) {
    process.exit(0); // Silent fail for logger
}
