const fs = require('fs');
const path = require('path');
const https = require('https');
const { uCanSignClient } = require('./src/lib/ucansign/client'); // This acts as a wrapper

const userFile = path.join(__dirname, 'src/data/users.json');
const users = JSON.parse(fs.readFileSync(userFile, 'utf8'));
const admin = users.find(u => u.id === 'admin');
const token = admin.ucansign.accessToken;

console.log('Using Token:', token.substring(0, 10) + '...');

const headers = {
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'UCanSign-Connect/1.0',
    'Content-Type': 'application/json'
};

function get(url) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, { method: 'GET', headers }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log(`\n--- ${url} ---`);
                console.log('Status:', res.statusCode);
                try {
                    if (res.statusCode !== 200) {
                        console.log("Body:", data);
                    } else {
                        const json = JSON.parse(data);
                        console.log("Msg:", json.msg);
                        if (json.result) {
                            if (json.result.record) console.log("Record Total:", json.result.record.totalCount);
                            if (Array.isArray(json.result.list)) console.log("List Len:", json.result.list.length);

                            // Print first item keys to understand structure if list exists
                            let list = json.result.list || (json.result.record && json.result.record.list);
                            if (list && list.length > 0) {
                                console.log("First Item Keys:", Object.keys(list[0]));
                                console.log("First Item Sample:", JSON.stringify(list[0], null, 2));
                            } else {
                                console.log("List is empty");
                                // Full dump if empty but result exists
                                console.log("Full Result:", JSON.stringify(json.result, null, 2).substring(0, 500));
                            }
                        } else {
                            console.log("No Result");
                            console.log("Body:", data);
                        }
                    }
                } catch (e) {
                    console.log('Parse Error', e);
                    console.log('Body:', data);
                }
                resolve();
            });
        });
        req.on('error', reject);
        req.end();
    });
}

(async () => {
    // Try variations
    await get('https://app.ucansign.com/openapi/templates');
    await get('https://app.ucansign.com/openapi/templates?page=1&limit=10');
    await get('https://app.ucansign.com/openapi/templates?currentPage=1&limit=10');
    await get('https://app.ucansign.com/openapi/user/form'); // Check this legacy one too
})();

(async () => {
    console.log("Triggering refresh via client...");
    // Calling any endpoint; if 401, client should refresh.
    // Ensure we catch the error if it fails even after refresh.
    try {
        await uCanSignClient('admin', '/user');
        console.log("Client call done.");
    } catch (e) {
        console.log("Client call error (expected if 401 handled internally):", e.message);
    }
})();
