
import { uCanSignClient } from './src/lib/ucansign/client';
import dotenv from 'dotenv';
dotenv.config();

const USER_ID = 'admin';
const TARGET_ID = '1999320306834067457';

async function check() {
    console.log('--- Checking as Document ---');
    try {
        const docRes = await uCanSignClient(USER_ID, `/documents/${TARGET_ID}`);
        console.log('Document Result:', JSON.stringify(docRes, null, 2));
    } catch (e: any) {
        console.log('Document Error:', e.message);
    }

    console.log('\n--- Checking as Template ---');
    try {
        const templRes = await uCanSignClient(USER_ID, `/templates/${TARGET_ID}`);
        console.log('Template Result:', JSON.stringify(templRes, null, 2));
    } catch (e: any) {
        console.log('Template Error:', e.message);
    }
}

check();
