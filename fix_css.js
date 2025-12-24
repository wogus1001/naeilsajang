const fs = require('fs');
const filePath = 'c:/Users/awmve/OneDrive/바탕 화면/my_project/web/src/app/(main)/contracts/builder/page.tsx';

console.log('Reading file...');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
    { from: /\.contract - preview/g, to: '.contract-preview' },
    { from: /\.builder - header/g, to: '.builder-header' },
    { from: /\.builder - pagination/g, to: '.builder-pagination' },
    { from: /\.builder - container/g, to: '.builder-container' },
    { from: /\.builder - workspace/g, to: '.builder-workspace' },
    { from: /100 %/g, to: '100%' },
    // Properties
    { from: /line - height/g, to: 'line-height' },
    { from: /font - size/g, to: 'font-size' },
    { from: /font - weight/g, to: 'font-weight' },
    { from: /text - align/g, to: 'text-align' },
    { from: /border - bottom/g, to: 'border-bottom' },
    { from: /padding - bottom/g, to: 'padding-bottom' },
    { from: /margin - bottom/g, to: 'margin-bottom' },
    { from: /border - collapse/g, to: 'border-collapse' },
    { from: /table - layout/g, to: 'table-layout' },
    { from: /background - color/g, to: 'background-color' },
    { from: /word - break/g, to: 'word-break' },
    { from: /word -break/g, to: 'word-break' }, // catch variant
    { from: /overflow - wrap/g, to: 'overflow-wrap' },
    { from: /letter - spacing/g, to: 'letter-spacing' },
    { from: /word - spacing/g, to: 'word-spacing' },
    { from: /box - sizing/g, to: 'box-sizing' },
    { from: /box - shadow/g, to: 'box-shadow' },
    { from: /max - width/g, to: 'max-width' },
    { from: /margin - left/g, to: 'margin-left' },
    { from: /padding - left/g, to: 'padding-left' },
    { from: /border - left/g, to: 'border-left' },
    { from: /margin - top/g, to: 'margin-top' },
    { from: /padding - top/g, to: 'padding-top' },
    { from: /min - width/g, to: 'min-width' },
    { from: /min - height/g, to: 'min-height' },
    { from: /padding - right/g, to: 'padding-right' },
    { from: /keep - all/g, to: 'keep-all' }
];

let matchCount = 0;
replacements.forEach(rep => {
    if (content.match(rep.from)) {
        matchCount++;
        content = content.replace(rep.from, rep.to);
    }
});

if (matchCount > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`File updated successfully with ${matchCount} types of replacements.`);
} else {
    console.log('No patterns matched. File might already be fixed or patterns are incorrect.');
}
