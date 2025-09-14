// Firebase Database Handler - replaces localStorage operations
class FirebaseHandler {
    
    // Load customers from Firebase
    static async loadCustomers() {
        try {
            console.log('🔥 Loading customers from Firebase...');
            const customers = await FirebaseDB.getCustomers();
            
            if (customers && customers.length > 0) {
                console.log('✅ Loaded', customers.length, 'customers from Firebase');
                
                // Process customers and add calculated fields
                const processedCustomers = customers.map(customer => {
                    return FirebaseHandler.calculateCustomerData(customer);
                });
                
                return processedCustomers;
            }
            
            // If no data, migrate from localStorage or use defaults
            return await FirebaseHandler.migrateFromLocalStorage();
            
        } catch (error) {
            console.error('❌ Firebase load error:', error);
            return FirebaseHandler.getDefaultCustomers();
        }
    }
    
    // Save customer to Firebase
    static async saveCustomer(customerData) {
        try {
            console.log('🔥 Saving customer to Firebase:', customerData.name);
            
            // Add calculated fields
            const processedCustomer = FirebaseHandler.calculateCustomerData(customerData);
            
            const result = await FirebaseDB.addCustomer(processedCustomer);
            
            if (result.success) {
                console.log('✅ Customer saved to Firebase successfully');
                return true;
            } else {
                console.error('❌ Firebase save failed:', result.error);
                return false;
            }
        } catch (error) {
            console.error('❌ Firebase save error:', error);
            return false;
        }
    }
    
    // Delete customer from Firebase
    static async deleteCustomer(customerName) {
        try {
            console.log('🔥 Deleting customer from Firebase:', customerName);
            
            // First get all customers to find the right ID
            const customers = await FirebaseDB.getCustomers();
            const customerToDelete = customers.find(c => c.name === customerName);
            
            if (!customerToDelete) {
                console.error('❌ Customer not found:', customerName);
                return false;
            }
            
            const result = await FirebaseDB.deleteCustomer(customerToDelete.id);
            
            if (result.success) {
                console.log('✅ Customer deleted from Firebase successfully');
                return true;
            } else {
                console.error('❌ Firebase delete failed:', result.error);
                return false;
            }
        } catch (error) {
            console.error('❌ Firebase delete error:', error);
            return false;
        }
    }
    
    // Save admin log to Firebase
    static async saveAdminLog(logData) {
        try {
            console.log('🔥 Saving admin log to Firebase:', logData.action);
            
            const result = await FirebaseDB.addAdminLog(logData);
            
            if (result.success) {
                console.log('✅ Admin log saved to Firebase successfully');
                return true;
            } else {
                console.error('❌ Firebase log save failed:', result.error);
                return false;
            }
        } catch (error) {
            console.error('❌ Firebase log save error:', error);
            return false;
        }
    }
    
    // Migrate data from localStorage to Firebase
    static async migrateFromLocalStorage() {
        const localData = localStorage.getItem('footballCustomers');
        if (localData) {
            try {
                const customers = JSON.parse(localData);
                console.log('🔄 Migrating', customers.length, 'customers to Firebase...');
                
                for (const customer of customers) {
                    await FirebaseDB.addCustomer(customer);
                }
                
                console.log('✅ Migration completed');
                return await FirebaseHandler.loadCustomers();
                
            } catch (error) {
                console.error('❌ Migration error:', error);
            }
        }
        
        // No local data, use defaults
        const defaults = FirebaseHandler.getDefaultCustomers();
        for (const customer of defaults) {
            await FirebaseDB.addCustomer(customer);
        }
        
        return defaults;
    }
    
    // Calculate customer data fields
    static calculateCustomerData(customer) {
        const today = new Date();
        
        // Safely parse purchase date
        let purchaseDate;
        try {
            if (customer.purchaseDate && customer.purchaseDate.includes('.')) {
                const parts = customer.purchaseDate.split('.');
                purchaseDate = new Date(`20${parts[2]}-${parts[1]}-${parts[0]}`);
            } else {
                purchaseDate = new Date(customer.purchaseDate || new Date());
            }
            
            // Check if date is valid
            if (isNaN(purchaseDate.getTime())) {
                purchaseDate = new Date();
            }
        } catch (error) {
            console.error('Date parse error:', error);
            purchaseDate = new Date();
        }
        
        // Calculate revenue
        let revenue = customer.revenue || 0;
        if (revenue === 0) {
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
        }
        
        // Calculate end date and remaining days
        let endDate = customer.endDate || null;
        let remainingDays = customer.remainingDays || null;
        
        try {
            if (customer.type === 'sezonluk') {
                endDate = '2026-06-30';
                const end = new Date(endDate);
                remainingDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
            } else if (customer.type === '1 aylık') {
                const end = new Date(purchaseDate);
                end.setMonth(end.getMonth() + 1);
                endDate = end.toISOString().split('T')[0];
                remainingDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
            }
        } catch (error) {
            console.error('Date calculation error:', error);
            endDate = null;
            remainingDays = null;
        }
        
        // Calculate status
        let status = customer.status || 'active';
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
    
    // Get default customers
    static getDefaultCustomers() {
        return [
            {
                name: "berataep",
                platform: "telegram", 
                purchaseDate: "02.09.25",
                type: "sınırsız",
                package: "GS Premium",
                revenue: 3588,
                endDate: null,
                remainingDays: null,
                status: "active"
            }
        ];
    }
}

// Make it globally available
window.FirebaseHandler = FirebaseHandler;