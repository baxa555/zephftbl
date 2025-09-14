// Vercel KV Database operations
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
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
            // GET all customers
            const customers = await kv.get('football:customers') || [];
            return res.status(200).json(customers);

        } else if (action === 'add-customer' && req.method === 'POST') {
            // ADD customer
            const customerData = req.body;
            
            // Get existing customers
            const customers = await kv.get('football:customers') || [];
            
            // Add calculated fields
            customerData.id = Date.now() + Math.random();
            customerData.created_at = new Date().toISOString();
            
            // Calculate revenue
            let revenue = 0;
            switch (customerData.package) {
                case 'GS Premium':
                case 'FB Premium':
                case 'BJK Premium':
                    revenue = customerData.type === 'sınırsız' ? 3588 : 
                             customerData.type === 'sezonluk' ? 1794 : 299;
                    break;
                case 'Premium':
                    revenue = customerData.type === 'sınırsız' ? 2388 : 
                             customerData.type === 'sezonluk' ? 1194 : 199;
                    break;
            }
            
            // Calculate dates
            let endDate = null;
            let remainingDays = null;
            const today = new Date();
            const purchaseDate = new Date(customerData.purchaseDate.split('.').reverse().join('-'));
            
            if (customerData.type === 'sezonluk') {
                endDate = '2026-06-30';
                const end = new Date(endDate);
                remainingDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
            } else if (customerData.type === '1 aylık') {
                const end = new Date(purchaseDate);
                end.setMonth(end.getMonth() + 1);
                endDate = end.toISOString().split('T')[0];
                remainingDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
            }
            
            // Set status
            let status = 'active';
            if (remainingDays !== null) {
                if (remainingDays <= 0) status = 'expired';
                else if (remainingDays <= 7) status = 'expiring';
            }
            
            customerData.revenue = revenue;
            customerData.endDate = endDate;
            customerData.remainingDays = remainingDays;
            customerData.status = status;
            
            // Add to array and save
            customers.push(customerData);
            await kv.set('football:customers', customers);
            
            return res.status(200).json({ success: true, customer: customerData });

        } else if (action === 'delete-customer' && req.method === 'DELETE') {
            // DELETE customer
            const { name } = req.body;
            
            const customers = await kv.get('football:customers') || [];
            const filteredCustomers = customers.filter(c => c.name !== name);
            
            await kv.set('football:customers', filteredCustomers);
            
            return res.status(200).json({ success: true });

        } else if (action === 'get-logs') {
            // GET admin logs
            const logs = await kv.get('football:adminlogs') || [];
            return res.status(200).json(logs);

        } else if (action === 'add-log' && req.method === 'POST') {
            // ADD admin log
            const logData = req.body;
            
            const logs = await kv.get('football:adminlogs') || [];
            logData.id = Date.now() + Math.random();
            logData.created_at = new Date().toISOString();
            logs.push(logData);
            
            await kv.set('football:adminlogs', logs);
            
            return res.status(200).json({ success: true });

        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('KV Database Error:', error);
        return res.status(500).json({ error: 'Database error: ' + error.message });
    }
}