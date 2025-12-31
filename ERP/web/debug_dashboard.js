const fs = require('fs');
const path = require('path');

const readJsonFile = (filename) => {
    const filePath = path.join(process.cwd(), 'src/data', filename);
    if (!fs.existsSync(filePath)) return [];
    try {
        const fileData = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(fileData);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error);
        return [];
    }
};

const debugDashboard = () => {
    const userId = 'admin'; // Testing default admin
    const schedules = readJsonFile('schedules.json'); // Adjusted path for script run location?
    // Script will be run from web root

    const now = new Date();
    const kstOffset = 9 * 60; // KST is UTC+9
    const kstDate = new Date(now.getTime() + (kstOffset * 60 * 1000));
    const todayStr = kstDate.toISOString().split('T')[0];

    console.log('--- DEBUG INFO ---');
    console.log(`Current Time (System): ${now.toISOString()}`);
    console.log(`KST Date Calculated: ${todayStr}`);
    console.log(`User ID: ${userId}`);

    const userSchedules = schedules.filter(s => s.userId === userId);
    console.log(`Total Schedules for User: ${userSchedules.length}`);

    const upcomingSchedules = userSchedules.filter(s => s.date >= todayStr);
    console.log(`Upcoming Schedules (>= ${todayStr}): ${upcomingSchedules.length}`);

    upcomingSchedules.forEach(s => {
        console.log(` - [${s.date}] ${s.title}`);
    });
};

debugDashboard();
