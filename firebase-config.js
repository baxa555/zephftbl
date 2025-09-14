// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBqJ8K2xX9LZ3vH8wX9QY5Qz4R6mN2kP8T",
    authDomain: "zephftbl-dashboard.firebaseapp.com",
    projectId: "zephftbl-dashboard", 
    storageBucket: "zephftbl-dashboard.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abc123def456789ghi"
};

// Initialize Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Firebase operations
class FirebaseDB {
    // Get all customers
    static async getCustomers() {
        try {
            const q = query(collection(db, 'customers'), orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            const customers = [];
            querySnapshot.forEach((doc) => {
                customers.push({ id: doc.id, ...doc.data() });
            });
            return customers;
        } catch (error) {
            console.error('Firebase get customers error:', error);
            return [];
        }
    }

    // Add customer
    static async addCustomer(customerData) {
        try {
            customerData.timestamp = new Date().toISOString();
            const docRef = await addDoc(collection(db, 'customers'), customerData);
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Firebase add customer error:', error);
            return { success: false, error: error.message };
        }
    }

    // Delete customer
    static async deleteCustomer(customerId) {
        try {
            await deleteDoc(doc(db, 'customers', customerId));
            return { success: true };
        } catch (error) {
            console.error('Firebase delete customer error:', error);
            return { success: false, error: error.message };
        }
    }

    // Get admin logs
    static async getAdminLogs() {
        try {
            const q = query(collection(db, 'adminLogs'), orderBy('timestamp', 'desc'));
            const querySnapshot = await getDocs(q);
            const logs = [];
            querySnapshot.forEach((doc) => {
                logs.push({ id: doc.id, ...doc.data() });
            });
            return logs;
        } catch (error) {
            console.error('Firebase get logs error:', error);
            return [];
        }
    }

    // Add admin log
    static async addAdminLog(logData) {
        try {
            logData.timestamp = new Date().toISOString();
            const docRef = await addDoc(collection(db, 'adminLogs'), logData);
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Firebase add log error:', error);
            return { success: false, error: error.message };
        }
    }
}

window.FirebaseDB = FirebaseDB;