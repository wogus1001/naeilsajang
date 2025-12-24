const fs = require('fs');
const path = require('path');

const filePath = path.join('web', 'src', 'app', '(main)', 'properties', 'page.module.css');
const absolutePath = path.resolve(filePath);

try {
    let content = fs.readFileSync(absolutePath, 'utf8');

    // Replace var(--border) with hsl(var(--border))
    // We use a regex to ensure we don't double-wrap if it's already wrapped (though unlikely here)
    // Matches var(--border) where it's NOT preceded by "hsl("
    const newContent = content.replace(/(?<!hsl\()var\(--border\)/g, 'hsl(var(--border))');

    if (content !== newContent) {
        fs.writeFileSync(absolutePath, newContent, 'utf8');
        console.log(`Successfully updated ${filePath}`);
        console.log('Replaced var(--border) with hsl(var(--border))');
    } else {
        console.log('No changes needed or pattern not found.');
    }

} catch (error) {
    console.error('Error processing file:', error);
    process.exit(1);
}
