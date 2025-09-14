const fs = require('fs');
const path = require('path');

// Vercel'de dosya yolları
const customersPath = path.join(process.cwd(), 'customers.json');
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

// Helper function to calculate customer data
function calculateCustomerData(customer) {
    const purchaseDate = new Date(customer.purchaseDate.split('.').reverse().join('-'));
    let endDate = null;
    let remainingDays = null;
    let revenue = 0;

    // Revenue calculation
    switch (customer.package) {
        case 'GS Premium':
        case 'FB Premium':
        case 'BJK Premium':
            revenue = customer.type === 'sınırsız' ? 3588 : 
                     customer.type === 'sezonluk' ? 1794 : 299;
            break;
        case 'Premium':
            revenue = customer.type === 'sınırsız' ? 2388 : 
                     customer.type === 'sezonluk' ? 1194 : 199;
            break;
    }

    // End date and remaining days calculation
    if (customer.type === 'sezonluk') {
        endDate = '2026-06-30';
        const today = new Date();
        const end = new Date(endDate);
        remainingDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    } else if (customer.type === '1 aylık') {
        const end = new Date(purchaseDate);
        end.setMonth(end.getMonth() + 1);
        endDate = end.toISOString().split('T')[0];
        const today = new Date();
        remainingDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    }

    // Status calculation
    let status = 'active';
    if (remainingDays !== null) {
        if (remainingDays <= 0) status = 'expired';
        else if (remainingDays <= 7) status = 'expiring';
    }

    return {
        ...customer,
        revenue,
        endDate,
        remainingDays,
        status
    };
}

module.exports = (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { action } = req.query;

    try {
        if (action === 'get-customers') {
            // GET customers
            const customers = readJSONFile(customersPath);
            const processedCustomers = customers.map(calculateCustomerData);
            return res.status(200).json(processedCustomers);

        } else if (action === 'add-customer' && req.method === 'POST') {
            // ADD customer
            const customerData = req.body;
            const customers = readJSONFile(customersPath);
            
            const processedCustomer = calculateCustomerData(customerData);
            customers.push(processedCustomer);
            
            const success = writeJSONFile(customersPath, customers);
            
            if (success) {
                return res.status(200).json({ success: true, customer: processedCustomer });
            } else {
                return res.status(500).json({ success: false, error: 'Failed to save customer' });
            }

        } else if (action === 'delete-customer' && req.method === 'DELETE') {
            // DELETE customer
            const { name } = req.body;
            const customers = readJSONFile(customersPath);
            
            const filteredCustomers = customers.filter(c => c.name !== name);
            const success = writeJSONFile(customersPath, filteredCustomers);
            
            if (success) {
                return res.status(200).json({ success: true });
            } else {
                return res.status(500).json({ success: false, error: 'Failed to delete customer' });
            }

        } else {
            return res.status(400).json({ error: 'Invalid action or method' });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};