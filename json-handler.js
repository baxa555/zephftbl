// JSON File Handler - Direct JSON file operations without PHP
class JSONHandler {
    static async loadCustomers() {
        try {
            console.log('📄 Loading customers.json directly...');
            const response = await fetch('customers.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('✅ Loaded customers from JSON:', data.length);
            return data;
        } catch (error) {
            console.error('❌ Error loading customers.json:', error);
            return [];
        }
    }

    static async loadAdminLogs() {
        try {
            console.log('📄 Loading admin-logs.json directly...');
            const response = await fetch('admin-logs.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('✅ Loaded admin logs from JSON:', data.length);
            return data;
        } catch (error) {
            console.error('❌ Error loading admin-logs.json:', error);
            return [];
        }
    }

    // Note: Cannot write to JSON files directly from browser for security reasons
    // These will save to localStorage and display warning
    static async saveCustomer(customerData) {
        console.log('⚠️ Cannot save directly to customers.json from browser');
        console.log('💾 Saving to localStorage instead');
        
        try {
            const existing = localStorage.getItem('footballCustomers');
            const customers = existing ? JSON.parse(existing) : [];
            customers.push(customerData);
            localStorage.setItem('footballCustomers', JSON.stringify(customers));
            
            // Display instruction to user
            this.showSaveInstruction('customers.json', JSON.stringify(customers, null, 2));
            
            return true;
        } catch (error) {
            console.error('❌ Error saving to localStorage:', error);
            return false;
        }
    }

    static async saveAdminLog(logData) {
        console.log('⚠️ Cannot save directly to admin-logs.json from browser');
        console.log('💾 Saving to localStorage instead');
        
        try {
            const existing = localStorage.getItem('footballAdminLogs');
            const logs = existing ? JSON.parse(existing) : [];
            
            const now = new Date();
            const log = {
                id: Date.now() + Math.random(),
                type: logData.type,
                action: logData.action,
                admin: logData.admin,
                timestamp: now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR'),
                date: now.toISOString()
            };
            
            logs.push(log);
            localStorage.setItem('footballAdminLogs', JSON.stringify(logs));
            
            // Display instruction to user
            this.showSaveInstruction('admin-logs.json', JSON.stringify(logs, null, 2));
            
            return { success: true, log: log };
        } catch (error) {
            console.error('❌ Error saving admin log to localStorage:', error);
            return { success: false };
        }
    }

    static showSaveInstruction(filename, content) {
        // Create a notification to show user how to save
        console.log(`📝 To update ${filename}, copy this content:`);
        console.log(content);
        
        // You could also show a modal or notification in the UI
        if (typeof zeph !== 'undefined' && zeph.showNotification) {
            zeph.showNotification(`${filename} updated in localStorage. Check console for content to copy.`, 'info');
        }
    }

    static async deleteCustomer(customerName) {
        console.log('⚠️ Cannot delete directly from customers.json from browser');
        console.log('💾 Deleting from localStorage instead');
        
        try {
            const existing = localStorage.getItem('footballCustomers');
            const customers = existing ? JSON.parse(existing) : [];
            const filtered = customers.filter(c => c.name !== customerName);
            localStorage.setItem('footballCustomers', JSON.stringify(filtered));
            
            // Display instruction to user
            this.showSaveInstruction('customers.json', JSON.stringify(filtered, null, 2));
            
            return true;
        } catch (error) {
            console.error('❌ Error deleting from localStorage:', error);
            return false;
        }
    }
}

// Export for use in main script
window.JSONHandler = JSONHandler;