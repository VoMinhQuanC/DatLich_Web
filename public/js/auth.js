// auth.js - JavaScript xử lý xác thực và phân quyền

document.addEventListener('DOMContentLoaded', function() {
    // Kiểm tra trạng thái đăng nhập
    checkLoginStatus();
    
    // Thiết lập sự kiện đăng xuất
    setupLogoutEvent();
    
    /**
     * Kiểm tra trạng thái đăng nhập
     */
    function checkLoginStatus() {
        const token = localStorage.getItem('token');
        const userInfo = localStorage.getItem('user');
        
        if (token && userInfo) {
            try {
                const user = JSON.parse(userInfo);
                
                // Cập nhật giao diện khi đã đăng nhập
                updateLoggedInUI(user);
                
                // Kiểm tra quyền truy cập các trang cần quyền riêng
                checkPagePermission(user);
            } catch (error) {
                console.error('Lỗi xử lý thông tin đăng nhập:', error);
                clearLoginData();
            }
        } else {
            // Cập nhật giao diện khi chưa đăng nhập
            updateLoggedOutUI();
            
            // Kiểm tra trang hiện tại có yêu cầu đăng nhập không
            checkRequireLogin();
        }
    }
    
    /**
     * Cập nhật giao diện khi đã đăng nhập
     */
    function updateLoggedInUI(user) {
        // Ẩn nút đăng nhập/đăng ký
        const loginButtons = document.getElementById('loginButtons');
        if (loginButtons) {
            loginButtons.classList.add('d-none');
        }
        
        // Hiển thị dropdown người dùng
        const userDropdown = document.getElementById('userDropdown');
        if (userDropdown) {
            userDropdown.classList.remove('d-none');
            
            // Cập nhật tên người dùng
            const userName = document.getElementById('userName');
            if (userName) {
                userName.textContent = user.fullName || user.email || 'Người dùng';
            }
            
            // Cập nhật avatar
            updateAvatar(user);
        }
    }
    
    /**
     * Cập nhật giao diện khi chưa đăng nhập
     */
    function updateLoggedOutUI() {
        // Hiển thị nút đăng nhập/đăng ký
        const loginButtons = document.getElementById('loginButtons');
        if (loginButtons) {
            loginButtons.classList.remove('d-none');
        }
        
        // Ẩn dropdown người dùng
        const userDropdown = document.getElementById('userDropdown');
        if (userDropdown) {
            userDropdown.classList.add('d-none');
        }
    }
    
    /**
     * Cập nhật avatar người dùng
     */
    function updateAvatar(user) {
        const avatarImg = document.getElementById('userAvatar');
        const avatarPlaceholder = document.getElementById('avatarPlaceholder');
        
        if (avatarImg && avatarPlaceholder) {
            if (user.avatarUrl) {
                // Hiển thị ảnh đại diện nếu có
                avatarImg.src = user.avatarUrl;
                avatarImg.classList.remove('d-none');
                avatarPlaceholder.classList.add('d-none');
            } else {
                // Hiển thị chữ cái đầu trong tên làm avatar
                avatarImg.classList.add('d-none');
                avatarPlaceholder.classList.remove('d-none');
                
                // Lấy chữ cái đầu tiên trong tên
                const firstChar = (user.fullName || user.email || 'U').charAt(0).toUpperCase();
                avatarPlaceholder.textContent = firstChar;
            }
        }
    }
    
    /**
     * Thiết lập sự kiện đăng xuất
     */
    function setupLogoutEvent() {
        const logoutBtn = document.getElementById('logoutBtn');
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                clearLoginData();
                window.location.href = '/login';
            });
        }
    }
    
    /**
     * Xóa dữ liệu đăng nhập
     */
    function clearLoginData() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
    
    /**
     * Kiểm tra quyền truy cập trang
     */
    function checkPagePermission(user) {
        const currentPath = window.location.pathname;
        
        // Kiểm tra trang admin
        if (currentPath.includes('admin') && user.role !== 1) {
            // Chuyển hướng về trang chủ nếu không phải admin
            window.location.href = '/';
            return;
        }
        
        // Kiểm tra trang mechanic
        if ((currentPath.includes('mechanic') || currentPath.includes('ky-thuat-vien')) && user.role !== 3) {
            // Chuyển hướng về trang chủ nếu không phải kỹ thuật viên
            window.location.href = '/';
            return;
        }
    }
    
    /**
     * Kiểm tra trang yêu cầu đăng nhập
     */
    function checkRequireLogin() {
        const currentPath = window.location.pathname;
        const loginRequiredPages = [
            'profile', 'thong-tin-ca-nhan',
            'booking-history', 'lich-su-dat-lich',
            'dat-lich', 'admin', 'mechanic', 'ky-thuat-vien'
        ];
        
        // Kiểm tra nếu đường dẫn hiện tại có chứa các trang yêu cầu đăng nhập
        const requiresLogin = loginRequiredPages.some(page => currentPath.includes(page));
        
        if (requiresLogin) {
            // Lưu URL hiện tại để sau khi đăng nhập có thể chuyển về
            const returnUrl = encodeURIComponent(window.location.href);
            
            // Chuyển hướng đến trang đăng nhập
            window.location.href = `/login?returnUrl=${returnUrl}`;
        }
    }
    
    /**
     * Kiểm tra token còn hạn hay không
     */
    async function validateToken() {
        const token = localStorage.getItem('token');
        
        if (!token) {
            return false;
        }
        
        try {
            const API_BASE_URL = window.API_CONFIG ? window.API_CONFIG.BASE_URL : 'http://localhost:3001/api';
            const response = await fetch(`${API_BASE_URL}/auth/validate-token`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const data = await response.json();
            
            return data.success;
        } catch (error) {
            console.error('Lỗi xác thực token:', error);
            return false;
        }
    }
});