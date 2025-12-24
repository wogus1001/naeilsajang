const fs = require('fs');
const path = require('path');

const srcDir = path.join('web', 'src');
const hslVariables = [
    'background', 'foreground', 'card', 'card-foreground',
    'popover', 'popover-foreground', 'primary', 'primary-foreground',
    'secondary', 'secondary-foreground', 'muted', 'muted-foreground',
    'accent', 'accent-foreground', 'destructive', 'destructive-foreground',
    'border', 'input', 'ring'
];

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.module.css')) {
            results.push(file);
        }
    });
    return results;
}

const cssModules = walk(srcDir);
console.log(`Found ${cssModules.length} CSS module files.`);

cssModules.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    hslVariables.forEach(v => {
        const regex = new RegExp(`(?<!hsl\\()var\\(--${v}\\)`, 'g');
        content = content.replace(regex, `hsl(var(--${v}))`);
    });

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated: ${filePath}`);
    }
});

console.log('Finished updating HSL variable usages.');
