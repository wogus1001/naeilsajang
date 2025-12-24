const https = require('https');
const fs = require('fs');
const path = require('path');

const SERVICE_KEY = 'e9T9pUGmWkfF7HJW8BZH%2BFiHHi9AQo1pFvc55gAO';
const API_ENDPOINT = 'https://franchise.ftc.go.kr/api/search.do';
const OUTPUT_FILE = path.join(__dirname, '../src/data/franchises.json');

// Fetch 10 items for testing
const apiUrl = `${API_ENDPOINT}?type=list&yr=2024&serviceKey=${SERVICE_KEY}&pageNo=1&numOfRows=10&viewType=json`;

console.log('Fetching franchise data from:', apiUrl);

https.get(apiUrl, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        if (res.statusCode !== 200) {
            console.error(`Failed to fetch data. Status Code: ${res.statusCode}`);
            return;
        }

        // Simple Regex XML Parser (same logic as in the API route)
        const items = [];
        const itemRegex = /<item>(.*?)<\/item>/g;
        const brandRegex = /<brandNm>(.*?)<\/brandNm>/;
        const categoryRegex = /<indutyLclasNm>(.*?)<\/indutyLclasNm>/;
        const sectorRegex = /<indutyMlsfcNm>(.*?)<\/indutyMlsfcNm>/;

        let match;
        while ((match = itemRegex.exec(data)) !== null) {
            const content = match[1];
            const brandMatch = brandRegex.exec(content);
            const categoryMatch = categoryRegex.exec(content);
            const sectorMatch = sectorRegex.exec(content);

            if (brandMatch) {
                items.push({
                    brandNm: brandMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/, '$1').trim(),
                    indutyLclasNm: categoryMatch ? categoryMatch[1].trim() : '',
                    indutyMlsfcNm: sectorMatch ? sectorMatch[1].trim() : ''
                });
            }
        }

        console.log(`Parsed ${items.length} items.`);

        // Ensure directory exists
        const dir = path.dirname(OUTPUT_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(items, null, 2), 'utf8');
        console.log(`Successfully saved data to ${OUTPUT_FILE}`);
    });
}).on('error', (e) => {
    console.error('Error fetching data:', e);
});
