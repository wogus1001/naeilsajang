const https = require('https');

const serviceKey = 'e9T9pUGmWkfF7HJW8BZH%2BFiHHi9AQo1pFvc55gAO';
const query = encodeURIComponent('이디야');
// Testing if searchKeyword works
const url = `https://franchise.ftc.go.kr/api/search.do?type=list&yr=2024&serviceKey=${serviceKey}&pageNo=1&numOfRows=10&searchKeyword=${query}`;

console.log('Testing FTC API Search:', url);

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        try {
            console.log('Body:', data.substring(0, 500));
        } catch (e) {
            console.log('Body (raw):', data);
        }
    });
}).on('error', (e) => {
    console.error('Error:', e);
});
