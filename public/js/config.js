// js/config.js - Cấu hình API endpoints cho ứng dụng Web Sửa Xe
// File này quản lý các URL API để dễ dàng chuyển đổi giữa môi trường development và production

// Xác định URL API backend dựa trên hostname
const API_BASE_URL = (() => {
    // Kiểm tra nếu đang chạy trên localhost (development)
    if (location.hostname === 'localhost' || 
        location.hostname === '127.0.0.1' || 
        location.hostname.includes('192.168.') ||
        location.hostname.includes('10.0.')) {
        return 'http://localhost:3001/api'; // URL local development
    }
    
    // Nếu đang chạy trên Firebase hosting (production)
    if (location.hostname.includes('firebaseapp.com') || 
        location.hostname.includes('web.app')) {
        return 'https://suaxeweb-production.up.railway.app/api'; // URL Railway production
    }
    
    // Fallback cho các trường hợp khác
    return 'https://suaxeweb-production.up.railway.app/api';
})();

// Cấu hình API endpoints
const API_CONFIG = {
    // Base URL
    BASE_URL: API_BASE_URL,
    
    // Authentication endpoints
    AUTH: {
        LOGIN: `${API_BASE_URL}/auth/login`,
        REGISTER: `${API_BASE_URL}/auth/register`,
        LOGOUT: `${API_BASE_URL}/auth/logout`,
        REFRESH: `${API_BASE_URL}/auth/refresh`
    },
    
    // User management endpoints
    USERS: {
        PROFILE: `${API_BASE_URL}/users/profile`,
        UPDATE_PROFILE: `${API_BASE_URL}/users/profile`,
        UPLOAD_AVATAR: `${API_BASE_URL}/upload/avatar`,
        CHANGE_PASSWORD: `${API_BASE_URL}/users/change-password`,
        VEHICLES: `${API_BASE_URL}/users/vehicles/user`,
        VEHICLE_DETAIL: `${API_BASE_URL}/users/vehicles`
    },
    
    // Services endpoints
    SERVICES: {
        LIST: `${API_BASE_URL}/services`,
        CREATE: `${API_BASE_URL}/services`,
        UPDATE: `${API_BASE_URL}/services`,
        DELETE: `${API_BASE_URL}/services`,
        UPLOAD_IMAGE: `${API_BASE_URL}/upload/service`
    },
    
    // Booking endpoints
    BOOKING: {
        CREATE: `${API_BASE_URL}/booking/create`,
        LIST: `${API_BASE_URL}/booking/appointments`,
        DETAIL: `${API_BASE_URL}/booking/appointments`,
        UPDATE: `${API_BASE_URL}/booking/appointments`,
        CANCEL: `${API_BASE_URL}/booking/appointments`,
        HISTORY: `${API_BASE_URL}/booking/history`
    },
    
    // Image upload endpoints
    IMAGES: {
        UPLOAD_AVATAR: `${API_BASE_URL}/upload/avatar`,
        UPLOAD_SERVICE: `${API_BASE_URL}/upload/service`,
        UPLOAD_VEHICLE: `${API_BASE_URL}/upload/vehicle`
    },
    
    // Admin endpoints
    ADMIN: {
        DASHBOARD: `${API_BASE_URL}/admin/dashboard/summary`,
        BOOKING_STATS: `${API_BASE_URL}/booking/admin/dashboard`,
        RECENT_BOOKINGS: `${API_BASE_URL}/booking/admin/recent-bookings`,
        MECHANICS: `${API_BASE_URL}/admin/mechanics`,
        REVENUE: `${API_BASE_URL}/revenue`
    },
    
    // Test endpoint
    TEST: `${API_BASE_URL}/test`
};

// Utility functions
const API_UTILS = {
    // Tạo headers với authorization token
    getHeaders: (token = null) => {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        } else {
            // Lấy token từ localStorage nếu có
            const storedToken = localStorage.getItem('authToken');
            if (storedToken) {
                headers['Authorization'] = `Bearer ${storedToken}`;
            }
        }
        
        return headers;
    },
    
    // Tạo headers cho form-data (upload file)
    getFormHeaders: (token = null) => {
        const headers = {};
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        } else {
            // Lấy token từ localStorage nếu có
            const storedToken = localStorage.getItem('authToken');
            if (storedToken) {
                headers['Authorization'] = `Bearer ${storedToken}`;
            }
        }
        
        // KHÔNG set Content-Type, để browser tự động set với boundary
        return headers;
    },
    
    // Xử lý response từ API
    handleResponse: async (response) => {
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return response.json();
    },
    
    // Tạo URL với parameters
    buildUrl: (baseUrl, params = {}) => {
        const url = new URL(baseUrl);
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                url.searchParams.append(key, params[key]);
            }
        });
        return url.toString();
    }
};

// Debug information
console.log('API Configuration loaded:', {
    hostname: location.hostname,
    baseUrl: API_BASE_URL,
    environment: location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'development' : 'production'
});

// ============================================================
// ⭐ FIX: EXPOSE API_BASE_URL RA GLOBAL SCOPE
// ============================================================
// Để các file khác (như booking.js) có thể sử dụng
window.API_BASE_URL = API_BASE_URL;

// Export cho sử dụng global
window.API_CONFIG = API_CONFIG;
window.API_UTILS = API_UTILS;

console.log('✅ API_BASE_URL exposed to global scope:', API_BASE_URL);