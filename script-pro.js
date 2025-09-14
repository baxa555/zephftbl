class ZephyrAnalytics {
    constructor() {
        this.currentSection = 'overview';
        this.customersData = [];
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.currentPage = 1;
        this.itemsPerPage = 25;
        this.filteredData = [];
        this.charts = {};
        this.isAuthenticated = false;
        this.currentAdmin = null;
        this.adminLogs = [];
        this.credentials = [
            { username: 'zephadmin', password: 'admin123', displayName: 'Zeph' },
            { username: 'zephadmin2', password: '2admin123', displayName: 'Admin 2' },
            { username: 'zephadmin3', password: '3admin123', displayName: 'Admin 3' }
        ];
        
        this.init();
    }

    async init() {
        this.setupLoginListener();
        this.checkAuth();
        if (!this.isAuthenticated) {
            this.showLoginScreen();
        } else {
            this.showLoadingScreen();
            await this.loadAllData();
            setTimeout(() => {
                this.hideLoadingScreen();
                this.setupEventListeners();
                this.updateDateTime();
                this.calculateStats();
                this.renderDashboard();
                this.initCharts();
                if (!this.timeInterval) {
                    this.timeInterval = setInterval(() => this.updateDateTime(), 1000);
                }
            }, 1000);
        }
    }

    setupLoginListener() {
        document.getElementById('loginForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });
    }

    checkAuth() {
        this.isAuthenticated = localStorage.getItem('footballDashAuth') === 'true';
        this.currentAdmin = localStorage.getItem('footballCurrentAdmin');
    }

    async loadAdminLogs() {
        // First try direct JSON file loading
        try {
            const data = await JSONHandler.loadAdminLogs();
            if (Array.isArray(data)) {
                // Save to localStorage as backup
                localStorage.setItem('footballAdminLogs', JSON.stringify(data));
                console.log('✅ Loaded', data.length, 'admin logs from JSON file');
                return data;
            }
        } catch (error) {
            console.error('❌ JSON file error:', error.message);
        }
        
        // Try API as backup
        try {
            console.log('📡 Trying admin logs API as backup...');
            const response = await fetch('/api/kv-db?action=get-logs');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            if (Array.isArray(data)) {
                // Save to localStorage as backup
                localStorage.setItem('footballAdminLogs', JSON.stringify(data));
                console.log('✅ Loaded', data.length, 'admin logs from API');
                return data;
            }
        } catch (error) {
            console.error('❌ API also failed:', error.message);
        }
        
        // Final fallback to localStorage
        const localLogs = localStorage.getItem('footballAdminLogs');
        if (localLogs) {
            try {
                const parsedLogs = JSON.parse(localLogs);
                console.log('📦 Loading admin logs from localStorage final fallback:', parsedLogs.length, 'logs');
                return parsedLogs;
            } catch (parseError) {
                console.error('Error parsing localStorage admin logs:', parseError);
            }
        }
        
        return [];
    }

    showLoginScreen() {
        document.getElementById('loginOverlay').style.display = 'flex';
        document.getElementById('loadingScreen').style.display = 'none';
    }

    hideLoginScreen() {
        document.getElementById('loginOverlay').style.display = 'none';
    }

    showLoadingScreen() {
        document.getElementById('loadingScreen').style.display = 'flex';
    }

    hideLoadingScreen() {
        document.getElementById('loadingScreen').classList.add('hidden');
        setTimeout(() => {
            document.getElementById('loadingScreen').style.display = 'none';
        }, 500);
    }

    async loadCustomersData() {
        // First try API database
        try {
            console.log('🔥 Primary: Loading from API database...');
            const response = await fetch('/api/kv-db?action=get-customers');
            
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    console.log('✅ Loaded', data.length, 'customers from API database');
                    // Save to localStorage as backup
                    localStorage.setItem('footballCustomers', JSON.stringify(data));
                    return data.map(customer => ({
                        ...customer,
                        endDate: customer.endDate ? new Date(customer.endDate) : null
                    }));
                }
            }
            throw new Error('API response not ok');
        } catch (error) {
            console.error('❌ API database error:', error.message);
        }
        
        // Try API as backup
        try {
            console.log('📡 Trying API as backup...');
            // API re-enabled - using real database
            console.log('🔥 Loading from API database...');
            const response = await fetch('/api/kv-db?action=get-customers');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            if (Array.isArray(data)) {
                // Save to localStorage as backup
                localStorage.setItem('footballCustomers', JSON.stringify(data));
                console.log('✅ Loaded', data.length, 'customers from API');
                return data.map(customer => ({
                    ...customer,
                    endDate: customer.endDate ? new Date(customer.endDate) : null
                }));
            }
        } catch (error) {
            console.error('❌ API also failed:', error.message);
        }
        
        // Final fallback to localStorage
        const localData = localStorage.getItem('footballCustomers');
        if (localData) {
            try {
                const parsedData = JSON.parse(localData);
                console.log('📦 Loading from localStorage final fallback:', parsedData.length, 'customers');
                return parsedData.map(customer => ({
                    ...customer,
                    endDate: customer.endDate ? new Date(customer.endDate) : null
                }));
            } catch (parseError) {
                console.error('Error parsing localStorage data:', parseError);
            }
        }
        
        // Return empty array if everything fails
        return [];
    }

    async saveCustomer(customerData) {
        // Save directly via API
        try {
            console.log('🔥 Saving customer via API:', customerData.name);
            const response = await fetch('/api/kv-db?action=add-customer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(customerData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Customer saved to JSON file via API');
                
                // Update localStorage as backup
                const existing = localStorage.getItem('footballCustomers');
                const customers = existing ? JSON.parse(existing) : [];
                customers.push(result.customer);
                localStorage.setItem('footballCustomers', JSON.stringify(customers));
                
                return true;
            }
        } catch (error) {
            console.error('❌ API save error:', error.message);
        }
        
        // Fallback: Use JSON Handler (localStorage only)
        try {
            console.log('💾 Fallback: JSON Handler save:', customerData.name);
            
            // Calculate additional fields 
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
            
            const endDate = this.calculateEndDate(customerData.purchaseDate, customerData.type);
            customerData.endDate = endDate ? endDate.toISOString().split('T')[0] : null;
            customerData.remainingDays = this.calculateRemainingDays(endDate);
            customerData.status = this.getStatus(customerData.remainingDays);
            
            const success = await JSONHandler.saveCustomer(customerData);
            
            if (success) {
                console.log('✅ Customer saved via fallback');
                return true;
            }
        } catch (error) {
            console.error('❌ JSON Handler fallback error:', error.message);
        }
        
        return false;
    }

    async deleteCustomer(customerName) {
        // Primary: Try API first (will update JSON files directly)
        try {
            console.log('📡 Deleting customer via API:', customerName);
            // API calls re-enabled - using real database
            console.log('🔥 Using real API database');
            const response = await fetch('/api/kv-db?action=delete-customer', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: customerName })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Customer deleted from JSON file via API');
                
                // Update localStorage as backup
                const existing = localStorage.getItem('footballCustomers');
                const customers = existing ? JSON.parse(existing) : [];
                const filteredCustomers = customers.filter(c => c.name !== customerName);
                localStorage.setItem('footballCustomers', JSON.stringify(filteredCustomers));
                
                return true;
            }
        } catch (error) {
            console.error('❌ API delete error:', error.message);
        }
        
        // Fallback: Use JSON Handler (localStorage only)
        try {
            console.log('💾 Fallback: JSON Handler delete:', customerName);
            const success = await JSONHandler.deleteCustomer(customerName);
            
            if (success) {
                console.log('✅ Customer deleted via fallback');
                return true;
            }
        } catch (error) {
            console.error('❌ JSON Handler fallback error:', error.message);
        }
        
        return false;
    }

    async loadAllData() {
        // Initialize localStorage with data if it doesn't exist
        await this.initializeLocalStorage();
        
        this.customersData = await this.loadCustomersData();
        this.adminLogs = await this.loadAdminLogs();
        this.filteredData = [...this.customersData];
    }

    // Helper method to sync data back to JSON files (for development/testing)
    syncToJsonFiles(customersData = null, logsData = null) {
        // This is mainly for development - in production, the PHP API handles file writes
        if (customersData) {
            console.log('Would sync customers to customers.json:', customersData.length, 'customers');
        }
        if (logsData) {
            console.log('Would sync logs to admin-logs.json:', logsData.length, 'logs');
        }
    }

    // Debug method to force reload data
    async forceReloadData() {
        console.log('🔄 Force reloading all data...');
        
        // Clear localStorage
        localStorage.removeItem('footballCustomers');
        localStorage.removeItem('footballAdminLogs');
        
        // Reload everything
        await this.loadAllData();
        this.calculateStats();
        this.renderTable();
        
        console.log('✅ Data reloaded:', this.customersData.length, 'customers,', this.adminLogs.length, 'admin logs');
    }

    async initializeLocalStorage() {
        // Always try to load fresh data from customers.json first
        try {
            console.log('Trying to load customers.json...');
            const response = await fetch('customers.json');
            if (response.ok) {
                const customersData = await response.json();
                if (Array.isArray(customersData) && customersData.length > 0) {
                    localStorage.setItem('footballCustomers', JSON.stringify(customersData));
                    console.log(`Loaded ${customersData.length} customers from customers.json to localStorage`);
                    return;
                }
            }
        } catch (error) {
            console.error('Error loading customers.json:', error);
        }
        
        // Check if localStorage already has data as fallback
        const existingCustomers = localStorage.getItem('footballCustomers');
        if (!existingCustomers) {
            console.log('No existing localStorage data, creating minimal fallback');
            // Minimal fallback data
            const defaultCustomers = [
                {
                    "name": "Test User",
                    "platform": "telegram", 
                    "purchaseDate": "14.09.25",
                    "type": "sınırsız",
                    "package": "GS Premium",
                    "revenue": 3588,
                    "endDate": null,
                    "remainingDays": null,
                    "status": "active"
                }
            ];
            
            localStorage.setItem('footballCustomers', JSON.stringify(defaultCustomers));
            console.log('Initialized localStorage with minimal fallback data');
        } else {
            console.log('Using existing localStorage data');
        }
    }

    async saveAdminLog(logData) {
        // Primary: Try API first (will update JSON files directly)
        try {
            console.log('📡 Saving admin log via API:', logData.action);
            // API calls re-enabled - using real database
            console.log('🔥 Using real API database');
            const response = await fetch('/api/kv-db?action=add-log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(logData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Admin log saved to JSON file via API');
                
                // Add to local arrays and localStorage as backup
                this.adminLogs.push(result.log);
                
                const existing = localStorage.getItem('footballAdminLogs');
                const logs = existing ? JSON.parse(existing) : [];
                logs.push(result.log);
                localStorage.setItem('footballAdminLogs', JSON.stringify(logs));
                
                return true;
            }
        } catch (error) {
            console.error('❌ API log save error:', error.message);
        }
        
        // Fallback: Use JSON Handler (localStorage only)
        try {
            console.log('💾 Fallback: JSON Handler log save:', logData.action);
            const result = await JSONHandler.saveAdminLog(logData);
            
            if (result.success) {
                console.log('✅ Admin log saved via fallback');
                this.adminLogs.push(result.log);
                return true;
            }
        } catch (error) {
            console.error('❌ JSON Handler fallback error:', error.message);
        }
        
        return false;
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const section = e.currentTarget.dataset.section;
                if (section) this.switchSection(section);
            });
        });

        // Add customer form (remove existing listeners first)
        const addForm = document.getElementById('addCustomerForm');
        if (addForm) {
            // Remove existing listeners
            const newForm = addForm.cloneNode(true);
            addForm.parentNode.replaceChild(newForm, addForm);
            
            // Add single listener
            newForm.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.addCustomer();
            });
        }

        // Mobile menu toggle
        document.getElementById('mobileMenuToggle')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        // Search functionality
        document.getElementById('globalSearch')?.addEventListener('input', (e) => {
            this.performGlobalSearch(e.target.value);
        });

        document.getElementById('tableSearch')?.addEventListener('input', (e) => {
            this.filterCustomers(e.target.value);
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                this.applyFilter(filter);
                this.setActiveFilter(e.target);
            });
        });

        // Table sorting
        document.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', (e) => {
                const column = e.currentTarget.dataset.sort;
                this.sortTable(column);
            });
        });

        // Pagination
        document.getElementById('entriesPerPage')?.addEventListener('change', (e) => {
            this.itemsPerPage = parseInt(e.target.value);
            this.currentPage = 1;
            this.renderTable();
        });

        // Chart period selector
        document.getElementById('growthPeriod')?.addEventListener('change', (e) => {
            this.updateGrowthChart(e.target.value);
        });
    }

    updateDateTime() {
        const now = new Date();
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Istanbul'
        };
        document.getElementById('currentDateTime').textContent = 
            now.toLocaleDateString('tr-TR', options);
    }

    parseDateTurkish(dateStr) {
        const [day, month, year] = dateStr.split('.');
        const fullYear = year.length === 2 ? '20' + year : year;
        return new Date(fullYear, month - 1, day);
    }

    calculateEndDate(purchaseDate, type) {
        const date = this.parseDateTurkish(purchaseDate);
        
        if (type === 'sınırsız') {
            return null;
        } else if (type === 'sezonluk') {
            const endDate = new Date(date.getFullYear(), 5, 30);
            if (date.getMonth() >= 6) {
                endDate.setFullYear(date.getFullYear() + 1);
            }
            return endDate;
        } else if (type === '1 aylık') {
            date.setMonth(date.getMonth() + 1);
            return date;
        }
        
        return null;
    }

    calculateRemainingDays(endDate) {
        if (!endDate) return null;
        
        const today = new Date();
        const diffTime = endDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    }

    getStatus(remainingDays) {
        if (remainingDays === null) return 'active';
        if (remainingDays <= 0) return 'expired';
        if (remainingDays <= 7) return 'expiring';
        return 'active';
    }

    calculateStats() {
        const stats = {
            totalRevenue: this.customersData.reduce((sum, customer) => sum + customer.revenue, 0),
            totalCustomers: this.customersData.length,
            activeSubscribers: this.customersData.filter(c => c.status === 'active').length,
            expiringSoon: this.customersData.filter(c => c.status === 'expiring').length,
            unlimitedMembers: this.customersData.filter(c => c.type === 'sınırsız').length,
            seasonalMembers: this.customersData.filter(c => c.type === 'sezonluk').length,
            monthlyMembers: this.customersData.filter(c => c.type === '1 aylık').length,
            gsMembers: this.customersData.filter(c => c.package.includes('GS')).length,
            fbMembers: this.customersData.filter(c => c.package.includes('FB')).length,
            bjkMembers: this.customersData.filter(c => c.package.includes('BJK')).length,
            discordUsers: this.customersData.filter(c => c.platform === 'discord').length,
            telegramUsers: this.customersData.filter(c => c.platform === 'telegram').length
        };

        this.stats = stats;
        this.updateStatsDisplay();
    }

    updateStatsDisplay() {
        document.getElementById('totalRevenue').textContent = 
            '₺' + this.stats.totalRevenue.toLocaleString('tr-TR');
        document.getElementById('activeSubscribers').textContent = this.stats.activeSubscribers;
        document.getElementById('expiringSoon').textContent = this.stats.expiringSoon;
        document.getElementById('conversionRate').textContent = '94.2%';
        document.getElementById('customerCount').textContent = this.stats.totalCustomers;
        document.getElementById('unlimitedCount').textContent = this.stats.unlimitedMembers;
        document.getElementById('seasonalCount').textContent = this.stats.seasonalMembers;
        document.getElementById('monthlyCount').textContent = this.stats.monthlyMembers;
    }

    switchSection(sectionName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(sectionName).classList.add('active');

        // Update page title
        const titles = {
            overview: 'Genel Bakış',
            customers: 'Müşteri Yönetimi',
            analytics: 'Gelişmiş Analizler',
            subscriptions: 'Abonelik Yönetimi',
            reports: 'Son Aktiviteler',
            'admin-logs': 'Admin Logları'
        };

        const subtitles = {
            overview: 'Gerçek zamanlı abonelik analitikleri ve müşteri yönetimi',
            customers: 'Tüm müşteri aboneliklerini yönetin ve izleyin',
            analytics: 'Performans metriklerine ve trendlere derinlemesine bakış',
            subscriptions: 'Abonelik paketlerini yapılandırın ve yönetin',
            reports: 'Son kullanıcı aktivitelerini görüntüleyin ve takip edin',
            'admin-logs': 'Admin aktivitelerini görüntüleyin ve yönetin'
        };

        document.getElementById('pageTitle').textContent = titles[sectionName];
        document.getElementById('pageSubtitle').textContent = subtitles[sectionName];

        this.currentSection = sectionName;

        if (sectionName === 'customers') {
            this.renderTable();
        } else if (sectionName === 'analytics') {
            this.renderAnalyticsCharts();
        } else if (sectionName === 'reports') {
            this.renderActivitiesPage();
        } else if (sectionName === 'admin-logs') {
            this.renderAdminLogsPage();
        }
    }

    renderDashboard() {
        this.renderTable();
        this.updateCurrentAdminDisplay();
    }

    updateCurrentAdminDisplay() {
        const currentAdminEl = document.getElementById('currentAdmin');
        if (currentAdminEl && this.currentAdmin) {
            currentAdminEl.textContent = this.currentAdmin;
        }
    }

    renderTable() {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const pageData = this.filteredData.slice(start, end);

        const tbody = document.getElementById('customersTableBody');
        tbody.innerHTML = pageData.map(customer => `
            <tr>
                <td>
                    <div>
                        <strong>${customer.name}</strong>
                        ${customer.discordId ? `<br><small style="color: #64748b;">ID: ${customer.discordId}</small>` : ''}
                        ${customer.telegramId ? `<br><small style="color: #64748b;">${customer.telegramId}</small>` : ''}
                    </div>
                </td>
                <td>
                    <span class="platform-badge platform-${customer.platform}">
                        ${customer.platform === 'discord' ? 'Discord' : 'Telegram'}
                    </span>
                </td>
                <td>
                    <span class="package-badge package-${customer.type}">
                        ${customer.package} - ${customer.type}
                    </span>
                </td>
                <td>${customer.purchaseDate}</td>
                <td>${customer.endDate ? this.formatDate(customer.endDate) : '∞'}</td>
                <td>${customer.remainingDays !== null ? customer.remainingDays + ' gün' : '∞'}</td>
                <td>
                    <span class="status-badge status-${customer.status}">
                        ${this.getStatusText(customer.status)}
                    </span>
                </td>
                <td>
                    <button class="btn-outline btn-sm" onclick="zeph.viewCustomerDetails('${customer.name}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        this.renderPagination();
        this.updateTableInfo();
    }

    formatDate(date) {
        // Handle string dates or null/undefined
        if (!date) return '-';
        
        if (typeof date === 'string') {
            if (date.includes('-')) {
                // ISO format: 2025-09-14 -> 14.09.2025
                const parts = date.split('-');
                return `${parts[2]}.${parts[1]}.${parts[0]}`;
            } else if (date.includes('.')) {
                // Already in DD.MM.YYYY format
                return date;
            }
            return date;
        }
        
        // Handle Date objects
        try {
            const dateObj = new Date(date);
            if (isNaN(dateObj.getTime())) {
                return '-';
            }
            
            const day = dateObj.getDate().toString().padStart(2, '0');
            const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
            const year = dateObj.getFullYear();
            return `${day}.${month}.${year}`;
        } catch (error) {
            console.error('Date format error:', error);
            return '-';
        }
    }

    getStatusText(status) {
        const statusTexts = {
            'active': 'Aktif',
            'expired': 'Süresi Doldu',
            'expiring': 'Süresi Bitiyor'
        };
        return statusTexts[status] || 'Bilinmiyor';
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
        const pagination = document.getElementById('pagination');
        
        let paginationHTML = '';
        
        // Previous button
        paginationHTML += `
            <button class="page-btn" ${this.currentPage <= 1 ? 'disabled' : ''} 
                    onclick="zeph.goToPage(${this.currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Page numbers
        for (let i = Math.max(1, this.currentPage - 2); i <= Math.min(totalPages, this.currentPage + 2); i++) {
            paginationHTML += `
                <button class="page-btn ${i === this.currentPage ? 'active' : ''}" 
                        onclick="zeph.goToPage(${i})">${i}</button>
            `;
        }
        
        // Next button
        paginationHTML += `
            <button class="page-btn" ${this.currentPage >= totalPages ? 'disabled' : ''} 
                    onclick="zeph.goToPage(${this.currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        pagination.innerHTML = paginationHTML;
    }

    updateTableInfo() {
        const start = (this.currentPage - 1) * this.itemsPerPage + 1;
        const end = Math.min(this.currentPage * this.itemsPerPage, this.filteredData.length);
        const total = this.filteredData.length;
        
        document.getElementById('tableInfo').textContent = 
            `${start} - ${end} arası gösteriliyor (toplam ${total} kayıt)`;
    }

    goToPage(page) {
        const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.renderTable();
        }
    }

    applyFilter(filter) {
        switch (filter) {
            case 'all':
                this.filteredData = [...this.customersData];
                break;
            case 'unlimited':
                this.filteredData = this.customersData.filter(c => c.type === 'sınırsız');
                break;
            case 'seasonal':
                this.filteredData = this.customersData.filter(c => c.type === 'sezonluk');
                break;
            case 'monthly':
                this.filteredData = this.customersData.filter(c => c.type === '1 aylık');
                break;
            case 'expiring':
                this.filteredData = this.customersData.filter(c => c.status === 'expiring');
                break;
        }
        this.currentPage = 1;
        this.renderTable();
    }

    setActiveFilter(activeButton) {
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        activeButton.classList.add('active');
    }

    filterCustomers(searchTerm) {
        const term = searchTerm.toLowerCase();
        this.filteredData = this.customersData.filter(customer =>
            customer.name.toLowerCase().includes(term) ||
            customer.package.toLowerCase().includes(term) ||
            customer.platform.toLowerCase().includes(term) ||
            (customer.discordId && customer.discordId.includes(term))
        );
        this.currentPage = 1;
        this.renderTable();
    }

    sortTable(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        this.filteredData.sort((a, b) => {
            let aVal = a[column];
            let bVal = b[column];

            if (column === 'purchaseDate' || column === 'endDate') {
                aVal = column === 'purchaseDate' ? this.parseDateTurkish(aVal) : aVal;
                bVal = column === 'purchaseDate' ? this.parseDateTurkish(bVal) : bVal;
                if (!aVal) aVal = new Date(0);
                if (!bVal) bVal = new Date(0);
            } else if (column === 'remaining') {
                aVal = a.remainingDays || 0;
                bVal = b.remainingDays || 0;
            }

            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (this.sortDirection === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        this.renderTable();
        this.updateSortIcons(column);
    }

    updateSortIcons(activeColumn) {
        document.querySelectorAll('.sortable i').forEach(icon => {
            icon.className = 'fas fa-sort';
        });

        const activeIcon = document.querySelector(`[data-sort="${activeColumn}"] i`);
        if (activeIcon) {
            activeIcon.className = this.sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
        }
    }

    initCharts() {
        this.initGrowthChart();
        this.initPackageChart();
    }

    initGrowthChart() {
        const ctx = document.getElementById('growthChart');
        if (!ctx) return;

        const monthlyData = this.generateMonthlyGrowthData();

        this.charts.growthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: monthlyData.labels,
                datasets: [{
                    label: 'New Customers',
                    data: monthlyData.values,
                    borderColor: '#0f766e',
                    backgroundColor: 'rgba(15, 118, 110, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#f1f5f9'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    initPackageChart() {
        const ctx = document.getElementById('packageChart');
        if (!ctx) return;

        // Destroy existing chart first
        if (this.charts.packageChart) {
            this.charts.packageChart.destroy();
        }

        // Reset canvas dimensions
        ctx.style.width = '';
        ctx.style.height = '';
        ctx.width = 400;
        ctx.height = 400;

        this.charts.packageChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Sınırsız', 'Sezonluk', '1 Aylık'],
                datasets: [{
                    data: [this.stats.unlimitedMembers, this.stats.seasonalMembers, this.stats.monthlyMembers],
                    backgroundColor: ['#7c3aed', '#ea580c', '#0891b2'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    generateMonthlyGrowthData() {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
        const values = [2, 5, 8, 12, 15, 18, 22, 28, 35];
        return { labels: months, values };
    }

    renderAnalyticsCharts() {
        setTimeout(() => {
            this.initPlatformChart();
            this.initRevenueChart();
            this.initRetentionChart();
            this.initMonthlyGrowthChart();
        }, 100);
    }

    initPlatformChart() {
        const ctx = document.getElementById('platformChart');
        if (!ctx) return;

        this.charts.platformChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Discord', 'Telegram'],
                datasets: [{
                    data: [this.stats.discordUsers, this.stats.telegramUsers],
                    backgroundColor: ['#5865f2', '#0088cc'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    initRevenueChart() {
        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;

        this.charts.revenueChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Revenue (₺)',
                    data: [15000, 23000, 28000, 35000, 42000, 58000],
                    backgroundColor: '#10b981',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    initRetentionChart() {
        const ctx = document.getElementById('retentionChart');
        if (!ctx) return;

        this.charts.retentionChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5', 'Month 6'],
                datasets: [{
                    label: 'Retention Rate (%)',
                    data: [100, 85, 78, 72, 68, 65],
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 100
                    }
                }
            }
        });
    }

    initMonthlyGrowthChart() {
        const ctx = document.getElementById('monthlyGrowthChart');
        if (!ctx) return;

        this.charts.monthlyGrowthChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
                datasets: [{
                    label: 'New Customers',
                    data: [5, 8, 12, 15, 18, 22, 25, 28, 35],
                    backgroundColor: '#2563eb',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    performGlobalSearch(searchTerm) {
        if (this.currentSection === 'customers') {
            this.filterCustomers(searchTerm);
        }
    }

    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('loginError');

        const admin = this.credentials.find(cred => cred.username === username && cred.password === password);
        
        if (admin) {
            localStorage.setItem('footballDashAuth', 'true');
            localStorage.setItem('footballCurrentAdmin', admin.displayName);
            this.isAuthenticated = true;
            this.currentAdmin = admin.displayName;
            
            // Add login log
            await this.addAdminLog('login', `${admin.displayName} sisteme giriş yaptı`, admin.displayName);
            
            this.hideLoginScreen();
            this.showLoadingScreen();
            
            await this.loadAllData();
            setTimeout(() => {
                this.hideLoadingScreen();
                this.setupEventListeners();
                this.updateDateTime();
                this.calculateStats();
                this.renderDashboard();
                this.initCharts();
                this.updateCurrentAdminDisplay();
                if (!this.timeInterval) {
                    this.timeInterval = setInterval(() => this.updateDateTime(), 1000);
                }
            }, 1000);
        } else {
            errorDiv.textContent = 'Kullanıcı adı veya şifre hatalı!';
            errorDiv.classList.add('show');
            
            // Clear the password field
            document.getElementById('password').value = '';
            
            setTimeout(() => {
                errorDiv.classList.remove('show');
            }, 3000);
        }
    }

    showAddCustomerModal() {
        document.getElementById('addCustomerModal').classList.add('show');
    }

    showDeleteCustomerModal() {
        const select = document.getElementById('deleteCustomerSelect');
        select.innerHTML = '<option value="">Müşteri seçin...</option>';
        
        this.customersData.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.name;
            option.textContent = `${customer.name} - ${customer.package} (${customer.type})`;
            select.appendChild(option);
        });
        
        document.getElementById('deleteCustomerModal').classList.add('show');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('show');
        if (modalId === 'addCustomerModal') {
            document.getElementById('addCustomerForm').reset();
        }
    }

    async addCustomer() {
        const formData = new FormData(document.getElementById('addCustomerForm'));
        const customerData = {
            name: formData.get('customerName'),
            platform: formData.get('platform'),
            purchaseDate: formData.get('purchaseDate'),
            type: formData.get('packageType'),
            package: formData.get('package'),
            note: formData.get('note') || undefined
        };

        if (formData.get('discordId')) {
            if (formData.get('platform') === 'discord') {
                customerData.discordId = formData.get('discordId');
            } else {
                customerData.telegramId = formData.get('discordId');
            }
        }

        try {
            const success = await this.saveCustomer(customerData);
            
            if (success) {
                // Reload customers data from server
                this.customersData = await this.loadCustomersData();
                this.filteredData = [...this.customersData];
                
                // Add admin log
                await this.saveAdminLog({
                    type: 'add',
                    action: `${customerData.name} müşterisi eklendi (${customerData.package} - ${customerData.type})`,
                    admin: this.currentAdmin
                });
                
                // Update stats and tables
                this.calculateStats();
                this.renderTable();
                
                // Update charts if they exist
                setTimeout(() => {
                    this.initPackageChart();
                }, 100);

                // Close modal
                this.closeModal('addCustomerModal');

                // Show success message
                this.showNotification('Müşteri başarıyla eklendi!', 'success');
            } else {
                this.showNotification('Müşteri eklenirken hata oluştu!', 'error');
            }
        } catch (error) {
            console.error('Error adding customer:', error);
            this.showNotification('Müşteri eklenirken hata oluştu!', 'error');
        }
    }

    async deleteSelectedCustomer() {
        const selectedCustomer = document.getElementById('deleteCustomerSelect').value;
        
        if (!selectedCustomer) {
            this.showNotification('Lütfen silinecek müşteriyi seçin!', 'error');
            return;
        }

        // Get customer info for log
        const customer = this.customersData.find(c => c.name === selectedCustomer);
        
        try {
            const success = await this.deleteCustomer(selectedCustomer);
            
            if (success) {
                // Reload customers data from server
                this.customersData = await this.loadCustomersData();
                this.filteredData = [...this.customersData];
                
                // Add admin log
                if (customer) {
                    await this.saveAdminLog({
                        type: 'delete',
                        action: `${selectedCustomer} müşterisi silindi (${customer.package} - ${customer.type})`,
                        admin: this.currentAdmin
                    });
                }
                
                // Update stats and tables
                this.calculateStats();
                this.renderTable();
                
                // Update charts if they exist
                setTimeout(() => {
                    this.initPackageChart();
                }, 100);

                // Close modal
                this.closeModal('deleteCustomerModal');

                // Show success message
                this.showNotification(`${selectedCustomer} başarıyla silindi!`, 'success');
            } else {
                this.showNotification('Müşteri silinirken hata oluştu!', 'error');
            }
        } catch (error) {
            console.error('Error deleting customer:', error);
            this.showNotification('Müşteri silinirken hata oluştu!', 'error');
        }
    }

    async addAdminLog(type, action, admin) {
        await this.saveAdminLog({
            type: type,
            action: action,
            admin: admin
        });
    }

    getLogIcon(type) {
        const icons = {
            'login': 'fa-sign-in-alt',
            'add': 'fa-plus',
            'delete': 'fa-trash',
            'edit': 'fa-edit'
        };
        return icons[type] || 'fa-info';
    }

    renderAdminLogsPage() {
        const logsGrid = document.getElementById('adminLogsGrid');
        if (!logsGrid) return;

        const logs = [...this.adminLogs].reverse();
        
        logsGrid.innerHTML = logs.map(log => `
            <div class="log-card">
                <div class="log-icon ${log.type}">
                    <i class="fas ${this.getLogIcon(log.type)}"></i>
                </div>
                <div class="log-content">
                    <h4>${log.action}</h4>
                    <p>${log.admin} tarafından gerçekleştirildi</p>
                </div>
                <div class="log-time">${log.timestamp}</div>
            </div>
        `).join('') || '<p style="text-align: center; color: var(--text-muted); padding: 3rem;">Henüz admin log kaydı bulunmuyor</p>';
    }

    filterLogs(filterType) {
        // Update active filter button
        document.querySelectorAll('.logs-filters .filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');

        const logsGrid = document.getElementById('adminLogsGrid');
        if (!logsGrid) return;

        let filteredLogs = [...this.adminLogs];
        
        if (filterType !== 'all') {
            filteredLogs = filteredLogs.filter(log => log.type === filterType);
        }
        
        filteredLogs.reverse();
        
        logsGrid.innerHTML = filteredLogs.map(log => `
            <div class="log-card">
                <div class="log-icon ${log.type}">
                    <i class="fas ${this.getLogIcon(log.type)}"></i>
                </div>
                <div class="log-content">
                    <h4>${log.action}</h4>
                    <p>${log.admin} tarafından gerçekleştirildi</p>
                </div>
                <div class="log-time">${log.timestamp}</div>
            </div>
        `).join('') || '<p style="text-align: center; color: var(--text-muted); padding: 3rem;">Bu kategoride log kaydı bulunmuyor</p>';
    }


    async logout() {
        if (this.currentAdmin) {
            await this.addAdminLog('login', `${this.currentAdmin} sistemden çıkış yaptı`, this.currentAdmin);
        }
        localStorage.removeItem('footballDashAuth');
        localStorage.removeItem('footballCurrentAdmin');
        location.reload();
    }

    renderActivitiesPage() {
        const activities = this.generateFullActivities();
        const activitiesGrid = document.getElementById('activitiesGrid');
        
        if (!activitiesGrid) return;
        
        activitiesGrid.innerHTML = activities.map(activity => `
            <div class="activity-card">
                <div class="activity-icon ${activity.type}">
                    <i class="fas ${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <h4>${activity.title}</h4>
                    <p>${activity.description}</p>
                </div>
                <div class="activity-meta">
                    <span class="activity-time">${activity.time}</span>
                    <span class="activity-platform ${activity.platform}">${activity.platform}</span>
                </div>
            </div>
        `).join('');
    }

    generateFullActivities() {
        const activities = [];
        
        // Add purchase activities
        this.customersData
            .sort((a, b) => this.parseDateTurkish(b.purchaseDate) - this.parseDateTurkish(a.purchaseDate))
            .forEach(customer => {
                activities.push({
                    type: 'purchase',
                    icon: 'fa-shopping-cart',
                    title: 'Yeni Satın Alma',
                    description: `${customer.name} - ${customer.package} (${customer.type})`,
                    time: customer.purchaseDate,
                    platform: customer.platform
                });
            });

        // Add expiring activities
        const expiringCustomers = this.customersData.filter(c => c.status === 'expiring');
        expiringCustomers.forEach(customer => {
            activities.push({
                type: 'expiry',
                icon: 'fa-exclamation-triangle',
                title: 'Abonelik Bitiyor',
                description: `${customer.name} - ${customer.remainingDays} gün kaldı`,
                time: this.formatDate(customer.endDate),
                platform: customer.platform
            });
        });

        // Add some sample renewal activities
        const renewalSamples = ['denzy', 'Alp Çeliktürk', 'berataep'];
        renewalSamples.forEach(name => {
            const customer = this.customersData.find(c => c.name === name);
            if (customer) {
                activities.push({
                    type: 'renewal',
                    icon: 'fa-sync-alt',
                    title: 'Abonelik Yenilendi',
                    description: `${customer.name} - ${customer.package}`,
                    time: customer.purchaseDate,
                    platform: customer.platform
                });
            }
        });

        return activities.sort((a, b) => {
            const dateA = this.parseDateTurkish(a.time);
            const dateB = this.parseDateTurkish(b.time);
            return dateB - dateA;
        }).slice(0, 20);
    }

    refreshActivities() {
        if (this.currentSection === 'reports') {
            this.renderActivitiesPage();
        }
        // Show success message
        const btn = event.target.closest('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Yenilendi';
        btn.disabled = true;
        
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 2000);
    }

    exportActivities() {
        const activities = this.generateFullActivities();
        const dataStr = JSON.stringify(activities, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `aktiviteler_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        // Show success message
        alert('Aktiviteler başarıyla dışa aktarıldı!');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        // Add to page
        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    viewCustomerDetails(customerName) {
        const customer = this.customersData.find(c => c.name === customerName);
        if (customer) {
            this.showNotification(`Müşteri Detayları:\n\nAd: ${customer.name}\nPlatform: ${customer.platform}\nPaket: ${customer.package}\nTür: ${customer.type}\nSatın Alma Tarihi: ${customer.purchaseDate}\nGelir: ₺${customer.revenue.toLocaleString('tr-TR')}`, 'info');
        }
    }
}

// Initialize the application
const zeph = new ZephyrAnalytics();