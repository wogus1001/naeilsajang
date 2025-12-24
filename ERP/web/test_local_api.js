const http = require('http');

const url = 'http://localhost:3000/api/franchise?query=오피스넥스';

console.log('Testing Local API:', url);

http.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        try {
            const json = JSON.parse(data);
            console.log('Body:', JSON.stringify(json, null, 2));
            if (json.length > 0 && json[0].brandNm.includes('오피스넥스')) {
                console.log('SUCCESS: Found cached data!');
            } else {
                console.log('FAILURE: Data not found or incorrect.');
            }
        } catch (e) {
            console.log('Body (raw):', data);
        }
    });
}).on('error', (e) => {
    console.error('Error:', e);
});
