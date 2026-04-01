// login.js - JavaScript cho trang đăng nhập

document.addEventListener('DOMContentLoaded', function() {
    // Sử dụng API_CONFIG từ config.js (được load trước)
    const API_BASE_URL = window.API_CONFIG ? window.API_CONFIG.BASE_URL : 'http://localhost:3001/api';
    
    // Cập nhật URL đăng nhập cho các nút xã hội
    updateSocialLoginButtons();
    
    // Kiểm tra nếu đã đăng nhập
    checkAlreadyLoggedIn();
    
    // Lấy các phần tử DOM
    const loginForm = document.getElementById('loginForm');
    const loginButton = document.getElementById('loginButton');
    const loginSpinner = document.getElementById('loginSpinner');
    const errorAlert = document.getElementById('error-alert');
    const successAlert = document.getElementById('success-alert');
    const togglePasswordBtn = document.querySelector('.toggle-password');
    
    // Thiết lập hiện/ẩn mật khẩu
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', function() {
            const passwordInput = document.getElementById('password');
            const icon = this.querySelector('i');
            
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.remove('bi-eye');
                icon.classList.add('bi-eye-slash');
            } else {
                passwordInput.type = 'password';
                icon.classList.remove('bi-eye-slash');
                icon.classList.add('bi-eye');
            }
        });
    }
    
    // Xử lý đăng nhập form
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Ẩn thông báo cũ
            hideAlerts();
            
            // Lấy giá trị từ form
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('rememberMe').checked;
            
            // Validate
            if (!email || !password) {
                showError('Vui lòng nhập đầy đủ email và mật khẩu');
                return;
            }
            
            // Hiển thị trạng thái đang đăng nhập
            setLoading(true);
            
            try {
                // Gọi API đăng nhập
                const response = await fetch(`${API_BASE_URL}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    // Lưu thông tin đăng nhập
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    // Lưu trạng thái "ghi nhớ đăng nhập" nếu được chọn
                    if (rememberMe) {
                        localStorage.setItem('rememberLogin', 'true');
                    } else {
                        localStorage.removeItem('rememberLogin');
                    }
                    
                    // Thông báo phù hợp dựa trên vai trò
                    let successMessage = 'Đăng nhập thành công! Đang chuyển hướng...';
                    if (data.user.role === 1) {
                        successMessage = 'Đăng nhập Admin thành công! Đang chuyển hướng...';
                    } else if (data.user.role === 3) {
                        successMessage = 'Đăng nhập Kỹ thuật viên thành công! Đang chuyển hướng...';
                    }
                    
                    // Hiển thị thông báo thành công
                    showSuccess(successMessage);
                    
                    // Chuyển hướng dựa trên vai trò người dùng
                    setTimeout(() => {
                        if (data.user.role === 1) {
                            // Admin - Chuyển đến trang quản trị
                            window.location.href = '/admin';
                        } else if (data.user.role === 3) {
                            // Thợ sửa xe - Chuyển đến trang thợ
                            window.location.href = '/mechanic-dashboard';
                        } else {
                            // Khách hàng thông thường - Chuyển đến trang chủ
                            window.location.href = '/';
                        }
                    }, 1500);
                } else {
                    // Xử lý lỗi
                    const errorMessage = data.message || 'Đăng nhập thất bại';
                    showError(errorMessage);
                    setLoading(false);
                }
            } catch (error) {
                console.error('Lỗi đăng nhập:', error);
                showError('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
                setLoading(false);
            }
        });
    }
    
    /**
     * Cập nhật URL đăng nhập cho các nút xã hội
     */
    function updateSocialLoginButtons() {
        // Nút đăng nhập bằng Google
        const googleLoginBtn = document.querySelector('a.btn.btn-danger');
        if (googleLoginBtn) {
            googleLoginBtn.href = `${API_BASE_URL}/auth0/login?connection=google-oauth2`;
        }
        
        // Nút đăng nhập bằng Auth0
        const auth0LoginBtn = document.querySelector('a.btn.btn-outline-secondary');
        if (auth0LoginBtn) {
            auth0LoginBtn.href = `${API_BASE_URL}/auth0/login`;
        }
    }
    
    /**
     * Kiểm tra nếu đã đăng nhập
     */
    function checkAlreadyLoggedIn() {
        const token = localStorage.getItem('token');
        const userInfo = localStorage.getItem('user');
        
        if (token && userInfo) {
            try {
                const user = JSON.parse(userInfo);
                
                // Kiểm tra token hợp lệ
                fetch(`${API_BASE_URL}/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Token không hợp lệ');
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        // Nếu token vẫn hợp lệ, chuyển hướng tự động
                        redirectBasedOnRole(user.role);
                    }
                })
                .catch(error => {
                    // Token không hợp lệ, xóa thông tin đăng nhập
                    console.error('Lỗi xác thực:', error);
                    clearLoginData();
                });
            } catch (error) {
                // Dữ liệu user không hợp lệ
                console.error('Lỗi xác thực:', error);
                clearLoginData();
            }
        }
    }
    
    /**
     * Chuyển hướng dựa trên vai trò người dùng
     */
    function redirectBasedOnRole(role) {
        if (role === 1) {
            // Admin
            window.location.href = '/admin';
        } else if (role === 3) {
            // Kỹ thuật viên
            window.location.href = '/mechanic-dashboard';
        } else {
            // Khách hàng thông thường
            window.location.href = '/';
        }
    }
    
    /**
     * Xóa dữ liệu đăng nhập
     */
    function clearLoginData() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('rememberLogin');
    }
    
    /**
     * Hiển thị thông báo lỗi
     */
    function showError(message) {
        if (errorAlert) {
            errorAlert.textContent = message;
            errorAlert.style.display = 'block';
            
            // Tự động ẩn sau 5 giây
            setTimeout(() => {
                errorAlert.style.display = 'none';
            }, 5000);
        }
    }
    
    /**
     * Hiển thị thông báo thành công
     */
    function showSuccess(message) {
        if (successAlert) {
            successAlert.textContent = message;
            successAlert.style.display = 'block';
        }
    }
    
    /**
     * Ẩn tất cả thông báo
     */
    function hideAlerts() {
        if (errorAlert) errorAlert.style.display = 'none';
        if (successAlert) successAlert.style.display = 'none';
    }
    
    /**
     * Thay đổi trạng thái đang tải
     */
    function setLoading(isLoading) {
        if (loginButton && loginSpinner) {
            loginButton.disabled = isLoading;
            loginSpinner.style.display = isLoading ? 'inline-block' : 'none';
        }
    }

    // Kiểm tra xem URL có chứa thông báo lỗi không
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    const errorMessage = urlParams.get('message');
    
    if (errorParam) {
        let displayMessage = 'Đã xảy ra lỗi khi đăng nhập.';
        
        switch (errorParam) {
            case 'auth0_failed':
                displayMessage = 'Đăng nhập Auth0 thất bại. Vui lòng thử lại.';
                break;
            case 'no_user':
                displayMessage = 'Không nhận được thông tin người dùng.';
                break;
            case 'no_email':
                displayMessage = 'Không nhận được email từ tài khoản đăng nhập.';
                break;
            case 'auth_error':
                displayMessage = errorMessage ? decodeURIComponent(errorMessage) : 'Lỗi xác thực. Vui lòng thử lại.';
                break;
        }
        
        showError(displayMessage);
    }
});