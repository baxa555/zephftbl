const fs = require('fs');
const path = require('path');

const logsPath = path.join(process.cwd(), 'admin-logs.json');

// Helper function to read JSON file
function readJSONFile(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading file:', error);
        return [];
    }
}

// Helper function to write JSON file
function writeJSONFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing file:', error);
        return false;
    }
}

module.exports = (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action } = req.query;

    try {
        if (action === 'get-logs') {
            // GET admin logs
            const logs = readJSONFile(logsPath);
            return res.status(200).json(logs);

        } else if (action === 'add-log' && req.method === 'POST') {
            // ADD admin log
            const logData = req.body;
            const logs = readJSONFile(logsPath);
            
            logs.push(logData);
            
            const success = writeJSONFile(logsPath, logs);
            
            if (success) {
                return res.status(200).json({ success: true });
            } else {
                return res.status(500).json({ success: false, error: 'Failed to save log' });
            }

        } else {
            return res.status(400).json({ error: 'Invalid action or method' });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};