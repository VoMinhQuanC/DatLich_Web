const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const textExtensions = new Set(['.js', '.ejs', '.css']);
const ignoredDirs = new Set(['.git', 'node_modules']);
const issues = [];

function walk(dir, files = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ignoredDirs.has(entry.name)) {
            continue;
        }

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath, files);
            continue;
        }

        if (textExtensions.has(path.extname(entry.name))) {
            files.push(fullPath);
        }
    }

    return files;
}

function getCaseAwarePath(targetPath) {
    const absolutePath = path.resolve(targetPath);
    const relativePath = path.relative(rootDir, absolutePath);

    if (!relativePath || relativePath.startsWith('..')) {
        return fs.existsSync(absolutePath) ? absolutePath : null;
    }

    let currentPath = rootDir;
    for (const segment of relativePath.split(path.sep)) {
        if (!fs.existsSync(currentPath) || !fs.statSync(currentPath).isDirectory()) {
            return null;
        }

        const entries = fs.readdirSync(currentPath);
        const match = entries.find((entry) => entry.toLowerCase() === segment.toLowerCase());
        if (!match) {
            return null;
        }

        currentPath = path.join(currentPath, match);
    }

    return currentPath;
}

function pathExistsWithExactCase(targetPath) {
    if (!fs.existsSync(targetPath)) {
        return false;
    }

    const actualPath = getCaseAwarePath(targetPath);
    return actualPath === path.resolve(targetPath);
}

function addIssue(filePath, kind, reference, actualPath) {
    issues.push({
        file: path.relative(rootDir, filePath),
        kind,
        reference,
        actual: actualPath ? path.relative(rootDir, actualPath) : null
    });
}

function checkModuleReferences(filePath, fileContent) {
    const sourceDir = path.dirname(filePath);
    const patterns = [
        /require\((['"])(\.[^'"]+)\1\)/g,
        /from\s+(['"])(\.[^'"]+)\1/g
    ];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(fileContent))) {
            const reference = match[2];
            const basePath = path.resolve(sourceDir, reference);
            const candidates = [
                basePath,
                `${basePath}.js`,
                `${basePath}.json`,
                path.join(basePath, 'index.js')
            ];

            const actualPath = candidates.map(getCaseAwarePath).find(Boolean);
            const exactPath = candidates.find(pathExistsWithExactCase);

            if (actualPath && !exactPath) {
                addIssue(filePath, 'module', reference, actualPath);
            }
        }
    }
}

function checkViewReferences(filePath, fileContent) {
    const renderPattern = /render\((['"])([^'"]+)\1/g;
    let match;

    while ((match = renderPattern.exec(fileContent))) {
        const reference = match[2];
        if (reference.startsWith('/')) {
            continue;
        }

        const targetPath = path.join(rootDir, 'app', 'views', `${reference}.ejs`);
        const actualPath = getCaseAwarePath(targetPath);
        if (actualPath && !pathExistsWithExactCase(targetPath)) {
            addIssue(filePath, 'view', reference, actualPath);
        }
    }
}

function checkStaticDirectories(filePath, fileContent) {
    const sourceDir = path.dirname(filePath);
    const staticPattern = /express\.static\(path\.join\(__dirname,\s*(['"])([^'"]+)\1\)\)/g;
    let match;

    while ((match = staticPattern.exec(fileContent))) {
        const reference = match[2];
        const targetPath = path.resolve(sourceDir, reference);
        const actualPath = getCaseAwarePath(targetPath);

        if (!actualPath) {
            addIssue(filePath, 'static-missing', reference, null);
            continue;
        }

        if (!pathExistsWithExactCase(targetPath)) {
            addIssue(filePath, 'static-case', reference, actualPath);
        }
    }
}

function checkAssetReferences(filePath, fileContent) {
    const assetPattern = /(?:src|href)=['"](\/[^'"?#]+\.[A-Za-z0-9]+)['"]|url\((['"]?)(\/[^)"'#?]+\.[A-Za-z0-9]+)\1\)/g;
    let match;

    while ((match = assetPattern.exec(fileContent))) {
        const reference = match[1] || match[3];
        if (!reference || reference.startsWith('/cdn-cgi/')) {
            continue;
        }

        const targetPath = path.join(rootDir, 'public', reference.replace(/^\//, ''));
        const actualPath = getCaseAwarePath(targetPath);

        if (actualPath && !pathExistsWithExactCase(targetPath)) {
            addIssue(filePath, 'asset', reference, actualPath);
        }
    }
}

function main() {
    console.log('--- STARTING CASE-SENSITIVE PATH VERIFICATION ---');

    const files = walk(rootDir);
    for (const filePath of files) {
        const fileContent = fs.readFileSync(filePath, 'utf8');

        if (filePath.endsWith('.js')) {
            checkModuleReferences(filePath, fileContent);
            checkViewReferences(filePath, fileContent);
            checkStaticDirectories(filePath, fileContent);
        }

        checkAssetReferences(filePath, fileContent);
    }

    if (issues.length > 0) {
        for (const issue of issues) {
            console.error(
                `[${issue.kind}] ${issue.file} -> ${issue.reference}` +
                (issue.actual ? ` (actual: ${issue.actual})` : '')
            );
        }

        console.error(`Found ${issues.length} case-sensitive path issue(s).`);
        process.exit(1);
    }

    console.log('No case-sensitive path issues found.');
}

main();
