// admin-register.js - Xử lý chức năng đăng ký tài khoản Admin

document.addEventListener('DOMContentLoaded', function() {
    // Sử dụng API_CONFIG từ config.js (được load trước)
    const API_BASE_URL = window.API_CONFIG ? window.API_CONFIG.BASE_URL : 'http://localhost:3001/api'; // Đảm bảo cổng API đúng
    const registerForm = document.getElementById('registerForm');
    const errorAlert = document.getElementById('error-alert');
    const successAlert = document.getElementById('success-alert');
    const registerButton = document.getElementById('registerButton');
    const registerSpinner = document.getElementById('registerSpinner');
    
    // Mã xác thực Admin - Thông thường nên được lưu trữ an toàn hoặc kiểm tra ở server
    const ADMIN_KEY = "admin123456"; // Đây chỉ là ví dụ, nên thay đổi thành mã phức tạp hơn
    
    // Kiểm tra nếu đã đăng nhập thì chuyển hướng
    const token = localStorage.getItem('token');
    if (token) {
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
                // Đã đăng nhập, chuyển hướng
                showSuccess('Bạn đã đăng nhập. Đang chuyển hướng...');
                setTimeout(() => {
                    window.location.href = '/';
                }, 1500);
            }
        })
        .catch(error => {
            // Token không hợp lệ, xóa
            console.error('Lỗi kiểm tra token:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        });
    }
    
    // Xử lý đăng ký
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Reset validation
        resetValidation();
        
        // Hiển thị spinner và vô hiệu hóa nút đăng ký
        registerButton.disabled = true;
        registerSpinner.style.display = 'inline-block';
        
        // Ẩn thông báo trước đó (nếu có)
        errorAlert.style.display = 'none';
        successAlert.style.display = 'none';
        
        // Lấy giá trị từ form
        const fullName = document.getElementById('fullName').value.trim();
        const email = document.getElementById('email').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const adminKey = document.getElementById('adminKey').value;
        const agreeTerms = document.getElementById('agreeTerms').checked;
        
        // Kiểm tra validation
        let isValid = true;
        
        // Kiểm tra họ tên
        if (!fullName) {
            showInvalidFeedback('fullName', 'fullName-feedback');
            isValid = false;
        }
        
        // Kiểm tra email
        if (!email || !isValidEmail(email)) {
            showInvalidFeedback('email', 'email-feedback');
            isValid = false;
        }
        
        // Kiểm tra số điện thoại
        if (!phone || !isValidPhone(phone)) {
            showInvalidFeedback('phone', 'phone-feedback');
            isValid = false;
        }
        
        // Kiểm tra mật khẩu
        if (!password || password.length < 6) {
            showInvalidFeedback('password', 'password-feedback');
            isValid = false;
        }
        
        // Kiểm tra xác nhận mật khẩu
        if (password !== confirmPassword) {
            showInvalidFeedback('confirmPassword', 'confirmPassword-feedback');
            isValid = false;
        }
        
        // Kiểm tra mã Admin
        if (adminKey !== ADMIN_KEY) {
            showInvalidFeedback('adminKey', 'adminKey-feedback');
            isValid = false;
        }
        
        // Kiểm tra đồng ý điều khoản
        if (!agreeTerms) {
            showInvalidFeedback('agreeTerms', 'agreeTerms-feedback');
            isValid = false;
        }
        
        if (!isValid) {
            resetButton();
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fullName,
                    email,
                    phone,
                    password,
                    role: 1, // Đăng ký với quyền admin (role = 1)
                    adminKey // Gửi kèm mã admin để server xác thực
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Hiển thị thông báo thành công
                showSuccess('Đăng ký tài khoản Admin thành công! Đang chuyển hướng đến trang đăng nhập...');
                
                // Reset form
                registerForm.reset();
                
                // Chuyển hướng đến trang đăng nhập admin sau 2 giây
                setTimeout(() => {
                    window.location.href = '/login'; // Hoặc đường dẫn đến trang đăng nhập admin của bạn
                }, 2000);
            } else {
                showError(data.message || 'Đăng ký thất bại');
            }
        } catch (error) {
            console.error('Lỗi đăng ký:', error);
            showError('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
        } finally {
            resetButton();
        }
    });
    
    // Hàm kiểm tra email hợp lệ
    function isValidEmail(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }
    
    // Hàm kiểm tra số điện thoại hợp lệ
    function isValidPhone(phone) {
        // Kiểm tra số điện thoại Việt Nam (10 số, bắt đầu bằng 0)
        const re = /^(0[3|5|7|8|9])+([0-9]{8})\b/;
        return re.test(phone);
    }
    
    // Hiển thị thông báo invalid feedback
    function showInvalidFeedback(inputId, feedbackId) {
        document.getElementById(inputId).classList.add('is-invalid');
        document.getElementById(feedbackId).style.display = 'block';
    }
    
    // Reset validation
    function resetValidation() {
        // Reset tất cả các input và feedback
        const inputs = registerForm.querySelectorAll('input');
        inputs.forEach(input => {
            input.classList.remove('is-invalid');
        });
        
        const feedbacks = registerForm.querySelectorAll('.invalid-feedback');
        feedbacks.forEach(feedback => {
            feedback.style.display = 'none';
        });
    }
    
    // Hàm reset trạng thái nút đăng ký
    function resetButton() {
        registerButton.disabled = false;
        registerSpinner.style.display = 'none';
    }
    
    // Hiển thị thông báo lỗi
    function showError(message) {
        errorAlert.textContent = message;
        errorAlert.style.display = 'block';
        successAlert.style.display = 'none';
        
        // Tự động ẩn sau 5 giây
        setTimeout(() => {
            errorAlert.style.display = 'none';
        }, 5000);
    }
    
    // Hiển thị thông báo thành công
    function showSuccess(message) {
        successAlert.textContent = message;
        successAlert.style.display = 'block';
        errorAlert.style.display = 'none';
    }
});