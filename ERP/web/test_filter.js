const fs = require('fs');
const path = require('path');

const dataPath = path.join(process.cwd(), 'src/data/schedules.json');
const rawData = fs.readFileSync(dataPath, 'utf8');
const events = JSON.parse(rawData);

const topList = events.filter(e => ['work', 'price_change'].includes(e.type));
const bottomList = events.filter(e => !['work', 'price_change'].includes(e.type));

console.log('--- Top List (Work/Price) ---');
topList.forEach(e => console.log(`[${e.type}] ${e.title} (${e.id})`));

console.log('\n--- Bottom List (Schedule) ---');
bottomList.forEach(e => console.log(`[${e.type}] ${e.title} (${e.id})`));
