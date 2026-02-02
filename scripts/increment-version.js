
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(__dirname, '../package.json');

try {
    const packageJsonData = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonData);

    const currentVersion = packageJson.version;
    const versionParts = currentVersion.split('.');

    // Increment patch version
    versionParts[2] = parseInt(versionParts[2]) + 1;

    const newVersion = versionParts.join('.');
    packageJson.version = newVersion;

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

    console.log(`Version incremented from ${currentVersion} to ${newVersion}`);
} catch (error) {
    console.error('Error incrementing version:', error);
    process.exit(1);
}
