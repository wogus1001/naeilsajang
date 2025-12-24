const https = require('https');

const serviceKey = 'e9T9pUGmWkfF7HJW8BZH%2BFiHHi9AQo1pFvc55gAO';
// The guide URL suggested: https://franchise.ftc.go.kr/api/search.do?type=list
// It likely needs other params. The browser subagent mentioned: type, yr, serviceKey, pageNo, numOfRows, viewType
// Let's try to fetch a list for 2024 or 2023.

const url = `https://franchise.ftc.go.kr/api/search.do?type=list&yr=2024&serviceKey=${serviceKey}&pageNo=1&numOfRows=10&viewType=json`;

console.log('Testing FTC API:', url);

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Headers:', res.headers);
        try {
            console.log('Body:', data.substring(0, 500)); // Print first 500 chars
        } catch (e) {
            console.log('Body (raw):', data);
        }
    });
}).on('error', (e) => {
    console.error('Error:', e);
});
