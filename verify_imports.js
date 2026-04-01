const fs = require('fs');
const path = require('path');

console.log('--- STARTING IMPORT VERIFICATION ---');

let errorCount = 0;

function checkDir(dir) {
    if (!fs.existsSync(dir)) return;
    
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            checkDir(fullPath);
        } else if (file.endsWith('.js')) {
            try {
                // We use require to see if it parses and imports correctly
                require(fullPath);
            } catch (e) {
                // Ignore errors that are just about missing environment variables or DB connections during load,
                // but we definitely want to catch MODULE_NOT_FOUND.
                if (e.code === 'MODULE_NOT_FOUND' && e.message.includes('Cannot find module')) {
                    console.error(`❌ BROKEN IMPORT in ${fullPath}`);
                    console.error(`   ${e.message}`);
                    errorCount++;
                } else if (e instanceof SyntaxError) {
                    console.error(`❌ SYNTAX ERROR in ${fullPath}`);
                    console.error(`   ${e.message}`);
                    errorCount++;
                }
            }
        }
    });
}

checkDir(path.join(__dirname, 'app/routes'));
checkDir(path.join(__dirname, 'app/controllers'));

console.log('--- VERIFICATION COMPLETE ---');
console.log(`Found ${errorCount} errors.`);
if (errorCount > 0) process.exit(1);
