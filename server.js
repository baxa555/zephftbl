// Simple Node.js server to handle JSON file operations
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const port = 3000;

// CORS headers
function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Handle file serving
function serveFile(filePath, res) {
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    
    switch (ext) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.json': contentType = 'application/json'; break;
        case '.png': contentType = 'image/png'; break;
        case '.jpg': contentType = 'image/jpeg'; break;
    }
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
        } else {
            setCorsHeaders(res);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        }
    });
}

// Calculate customer fields like PHP does
function calculateCustomerFields(customerData) {
    const packages = {
        'GS Premium': 299,
        'FB Premium': 299,
        'BJK Premium': 299,
        'Premium': 199
    };

    const multipliers = {
        'sınırsız': 12,
        'sezonluk': 6,
        '1 aylık': 1
    };

    customerData.revenue = (packages[customerData.package] || 199) * (multipliers[customerData.type] || 1);
    
    // Calculate end date
    if (customerData.type === 'sınırsız') {
        customerData.endDate = null;
        customerData.remainingDays = null;
        customerData.status = 'active';
    } else {
        const [day, month, year] = customerData.purchaseDate.split('.');
        const fullYear = year.length === 2 ? '20' + year : year;
        const purchaseDate = new Date(fullYear, month - 1, day);
        
        let endDate;
        if (customerData.type === 'sezonluk') {
            endDate = new Date(purchaseDate.getFullYear(), 5, 30); // June 30
            if (purchaseDate.getMonth() >= 6) { // July or later
                endDate.setFullYear(purchaseDate.getFullYear() + 1);
            }
        } else { // 1 aylık
            endDate = new Date(purchaseDate);
            endDate.setMonth(endDate.getMonth() + 1);
        }
        
        customerData.endDate = endDate.toISOString().split('T')[0];
        
        const today = new Date();
        const diffTime = endDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        customerData.remainingDays = diffDays;
        
        if (diffDays <= 0) {
            customerData.status = 'expired';
        } else if (diffDays <= 7) {
            customerData.status = 'expiring';
        } else {
            customerData.status = 'active';
        }
    }
    
    return customerData;
}

// Handle API requests
function handleAPI(req, res, parsedUrl) {
    const action = parsedUrl.query.action;
    setCorsHeaders(res);
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    try {
        if (req.method === 'GET') {
            if (action === 'customers') {
                fs.readFile('customers.json', 'utf8', (err, data) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to read customers file' }));
                        return;
                    }
                    
                    try {
                        const customers = JSON.parse(data);
                        console.log('📄 Served customers:', customers.length);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(customers));
                    } catch (parseErr) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid JSON in customers file' }));
                    }
                });
                return;
            }
            
            if (action === 'admin-logs') {
                fs.readFile('admin-logs.json', 'utf8', (err, data) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to read admin logs file' }));
                        return;
                    }
                    
                    try {
                        const logs = JSON.parse(data);
                        console.log('📄 Served admin logs:', logs.length);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(logs));
                    } catch (parseErr) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid JSON in admin logs file' }));
                    }
                });
                return;
            }
        }
        
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    
                    if (action === 'add-customer') {
                        const customerData = calculateCustomerFields(data);
                        
                        fs.readFile('customers.json', 'utf8', (err, fileData) => {
                            let customers = [];
                            if (!err && fileData) {
                                try {
                                    customers = JSON.parse(fileData);
                                } catch (parseErr) {
                                    console.error('Error parsing existing customers:', parseErr);
                                }
                            }
                            
                            customers.push(customerData);
                            
                            fs.writeFile('customers.json', JSON.stringify(customers, null, 2), (writeErr) => {
                                if (writeErr) {
                                    res.writeHead(500, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ error: 'Failed to save customer' }));
                                } else {
                                    console.log('✅ Customer saved:', customerData.name);
                                    res.writeHead(200, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ success: true, customer: customerData }));
                                }
                            });
                        });
                        return;
                    }
                    
                    if (action === 'add-log') {
                        const logData = {
                            id: Date.now() + Math.random(),
                            type: data.type,
                            action: data.action,
                            admin: data.admin,
                            timestamp: new Date().toLocaleDateString('tr-TR') + ' ' + new Date().toLocaleTimeString('tr-TR'),
                            date: new Date().toISOString()
                        };
                        
                        fs.readFile('admin-logs.json', 'utf8', (err, fileData) => {
                            let logs = [];
                            if (!err && fileData) {
                                try {
                                    logs = JSON.parse(fileData);
                                } catch (parseErr) {
                                    console.error('Error parsing existing logs:', parseErr);
                                }
                            }
                            
                            logs.push(logData);
                            
                            fs.writeFile('admin-logs.json', JSON.stringify(logs, null, 2), (writeErr) => {
                                if (writeErr) {
                                    res.writeHead(500, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ error: 'Failed to save log' }));
                                } else {
                                    console.log('✅ Admin log saved:', logData.action);
                                    res.writeHead(200, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ success: true, log: logData }));
                                }
                            });
                        });
                        return;
                    }
                    
                } catch (parseErr) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON data' }));
                }
            });
            return;
        }
        
        if (req.method === 'DELETE') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    
                    if (action === 'delete-customer') {
                        fs.readFile('customers.json', 'utf8', (err, fileData) => {
                            if (err) {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Failed to read customers file' }));
                                return;
                            }
                            
                            try {
                                let customers = JSON.parse(fileData);
                                customers = customers.filter(c => c.name !== data.name);
                                
                                fs.writeFile('customers.json', JSON.stringify(customers, null, 2), (writeErr) => {
                                    if (writeErr) {
                                        res.writeHead(500, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ error: 'Failed to delete customer' }));
                                    } else {
                                        console.log('✅ Customer deleted:', data.name);
                                        res.writeHead(200, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ success: true }));
                                    }
                                });
                            } catch (parseErr) {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Invalid JSON in customers file' }));
                            }
                        });
                        return;
                    }
                    
                } catch (parseErr) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON data' }));
                }
            });
            return;
        }
        
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request' }));
        
    } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server error: ' + err.message }));
    }
}

// Create server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    
    // Handle API requests
    if (parsedUrl.pathname.startsWith('/api.php')) {
        handleAPI(req, res, parsedUrl);
        return;
    }
    
    // Serve static files
    let filePath = parsedUrl.pathname === '/' ? '/index-pro.html' : parsedUrl.pathname;
    filePath = path.join(__dirname, filePath);
    
    serveFile(filePath, res);
});

server.listen(port, () => {
    console.log('🚀 Server running at http://localhost:' + port);
    console.log('📁 Serving files from:', __dirname);
    console.log('🔧 API endpoints:');
    console.log('   GET  /api.php?action=customers');
    console.log('   GET  /api.php?action=admin-logs');
    console.log('   POST /api.php?action=add-customer');
    console.log('   POST /api.php?action=add-log');
    console.log('   DELETE /api.php?action=delete-customer');
    console.log('');
    console.log('✨ Open http://localhost:3000 in your browser!');
});