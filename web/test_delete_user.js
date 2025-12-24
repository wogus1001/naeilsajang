const http = require('http');

const deleteUser = (id) => {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: `/api/users?id=${id}`,
        method: 'DELETE',
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            console.log(`Delete Status: ${res.statusCode}`);
            console.log(`Delete Body: ${data}`);
        });
    });

    req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
    });

    req.end();
};

// Delete 'testuser' created by the browser test
deleteUser('testuser');
