const http = require('http');

const serviceKey = 'e9T9pUGmWkfF7HJW8BZH%2BFiHHi9AQo1pFvc55gAO'; // Encoded key
const brandNm = '스타벅스';

const endpoints = [
    'http://apis.data.go.kr/1130000/FftcBrandInfoService/getBrandList',
    'http://apis.data.go.kr/1130000/FftcFranchiseInfoService/getFranchiseList',
    'http://apis.data.go.kr/1130000/FftcBrandInfoService/getBrandInfo'
];

function testEndpoint(baseUrl) {
    const url = new URL(baseUrl);
    url.searchParams.append('serviceKey', decodeURIComponent(serviceKey)); // Append decoded, let URL encode it
    url.searchParams.append('pageNo', '1');
    url.searchParams.append('numOfRows', '10');
    url.searchParams.append('resultType', 'json');
    // Some endpoints use different param names for brand name
    if (baseUrl.includes('Brand')) {
        url.searchParams.append('brandNm', brandNm);
    } else {
        url.searchParams.append('frnchsNm', brandNm); // Hypothetical param
    }

    // IMPORTANT: data.go.kr often requires the key to be unencoded in the URL string construction if using a library that encodes, 
    // BUT the key provided is already encoded. 
    // If we use searchParams, it encodes special chars. 
    // The key has %2B which is +. 
    // If we pass '...%2B...', searchParams encodes % to %25 -> ...%252B... (Wrong)
    // If we pass '...+...', searchParams encodes + to %2B -> ...%2B... (Correct)
    // So we should decodeURIComponent(serviceKey) before passing to searchParams.

    console.log(`Testing: ${url.toString()}`);

    http.get(url.toString(), (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            console.log(`[${baseUrl}] Status: ${res.statusCode}`);
            if (res.statusCode === 200) {
                console.log(`[${baseUrl}] Body: ${data.substring(0, 200)}...`);
            }
        });
    }).on('error', (e) => {
        console.error(`[${baseUrl}] Error: ${e.message}`);
    });
}

endpoints.forEach(testEndpoint);
