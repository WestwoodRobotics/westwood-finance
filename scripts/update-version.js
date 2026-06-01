import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const infoPath = path.join(__dirname, '..', 'src', 'lib', 'app-info.json');

try {
    // 1. Read current info
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));

    // 2. Increment version
    const bumpType = process.argv[2] || 'patch';
    const versionParts = info.version.split('.');
    if (bumpType === 'major') {
        versionParts[0] = (parseInt(versionParts[0]) + 1).toString();
        versionParts[1] = '0';
        versionParts[2] = '0';
    } else if (bumpType === 'minor') {
        versionParts[1] = (parseInt(versionParts[1]) + 1).toString();
        versionParts[2] = '0';
    } else {
        versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
    }
    const newVersion = versionParts.join('.');

    // 3. Get CST Timestamp
    const now = new Date();
    const cstTime = now.toLocaleString("en-US", {
        timeZone: "America/Chicago",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true
    });
    
    const displayTime = `${cstTime} CST`;

    // 4. Update and Save
    const updatedInfo = {
        version: newVersion,
        deployedAt: displayTime
    };

    fs.writeFileSync(infoPath, JSON.stringify(updatedInfo, null, 2));

} catch (error) {
    console.error('❌ Error updating version:', error);
    process.exit(1);
}
