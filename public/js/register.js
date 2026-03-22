// register.js - JavaScript cho trang đăng ký thống nhất

document.addEventListener('DOMContentLoaded', function() {
    // Sử dụng API_CONFIG từ config.js (được load trước)
    const API_BASE_URL = window.API_CONFIG ? window.API_CONFIG.BASE_URL : 'http://localhost:3001/api';
    
    // Kiểm tra nếu đã đăng nhập
    checkAlreadyLoggedIn();
    
    // Form đăng ký
    const registerForm = document.getElementById('registerForm');
    const registerButton = document.getElementById('registerButton');
    const registerSpinner = document.getElementById('registerSpinner');
    const errorAlert = document.getElementById('error-alert');
    const successAlert = document.getElementById('success-alert');
    
    // Các input fields
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const agreeTermsInput = document.getElementById('agreeTerms');
    
    // Toggle hiện/ẩn mật khẩu
    const togglePasswordBtn = document.querySelector('.toggle-password');
    const toggleConfirmPasswordBtn = document.querySelector('.toggle-confirm-password');
    
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', function() {
            togglePasswordVisibility(passwordInput, this.querySelector('i'));
        });
    }
    
    if (toggleConfirmPasswordBtn) {
        toggleConfirmPasswordBtn.addEventListener('click', function() {
            togglePasswordVisibility(confirmPasswordInput, this.querySelector('i'));
        });
    }
    
    // Xử lý submit form đăng ký
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Reset validation
            resetValidation();
            
            // Ẩn thông báo cũ
            hideAlerts();
            
            // Lấy giá trị từ form
            const fullName = fullNameInput.value.trim();
            const email = emailInput.value.trim();
            const phone = phoneInput.value.trim();
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            const agreeTerms = agreeTermsInput.checked;
            
            // Kiểm tra validation
            let isValid = true;
            
            // Kiểm tra họ tên
            if (!fullName) {
                showInvalidFeedback(fullNameInput, 'fullName-feedback');
                isValid = false;
            }
            
            // Kiểm tra email
            if (!email || !isValidEmail(email)) {
                showInvalidFeedback(emailInput, 'email-feedback');
                isValid = false;
            }
            
            // Kiểm tra số điện thoại
            if (!phone || !isValidPhone(phone)) {
                showInvalidFeedback(phoneInput, 'phone-feedback');
                isValid = false;
            }
            
            // Kiểm tra mật khẩu
            if (!password || password.length < 6) {
                showInvalidFeedback(passwordInput, 'password-feedback');
                isValid = false;
            }
            
            // Kiểm tra xác nhận mật khẩu
            if (password !== confirmPassword) {
                showInvalidFeedback(confirmPasswordInput, 'confirmPassword-feedback');
                isValid = false;
            }
            
            // Kiểm tra đồng ý điều khoản
            if (!agreeTerms) {
                showInvalidFeedback(agreeTermsInput, 'agreeTerms-feedback');
                isValid = false;
            }
            
            if (!isValid) {
                return;
            }
            
            // Hiển thị trạng thái đang đăng ký
            setLoading(true);
            
            try {
                // Gọi API đăng ký
                const response = await fetch(`${API_BASE_URL}/auth/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fullName,
                        email,
                        phone,
                        password
                    })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    // Reset form
                    registerForm.reset();
                    
                    // Hiển thị thông báo thành công
                    showSuccess('Đăng ký tài khoản thành công! Đang chuyển hướng đến trang đăng nhập...');
                    
                    // Chuyển hướng đến trang đăng nhập sau 2 giây
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 2000);
                } else {
                    // Xử lý lỗi
                    const errorMessage = data.message || 'Đăng ký tài khoản thất bại';
                    showError(errorMessage);
                    setLoading(false);
                }
            } catch (error) {
                console.error('Lỗi đăng ký:', error);
                showError('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.');
                setLoading(false);
            }
        });
    }
    
    /**
     * Kiểm tra nếu đã đăng nhập
     */
    function checkAlreadyLoggedIn() {
        const token = localStorage.getItem('token');
        const userInfo = localStorage.getItem('user');
        
        if (token && userInfo) {
            try {
                // Kiểm tra token hợp lệ bằng cách gọi API
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
                        // Người dùng đã đăng nhập, chuyển hướng đến trang chủ
                        showSuccess('Bạn đã đăng nhập. Đang chuyển hướng...');
                        setTimeout(() => {
                            window.location.href = '/';
                        }, 1500);
                    }
                })
                .catch(error => {
                    // Token không hợp lệ, xóa thông tin đăng nhập
                    console.error('Lỗi xác thực:', error);
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                });
            } catch (error) {
                // Xóa thông tin đăng nhập không hợp lệ
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                console.error('Lỗi xác thực:', error);
            }
        }
    }
    
    /**
     * Toggle hiện/ẩn mật khẩu
     */
    function togglePasswordVisibility(inputElement, iconElement) {
        if (inputElement.type === 'password') {
            inputElement.type = 'text';
            iconElement.classList.remove('bi-eye');
            iconElement.classList.add('bi-eye-slash');
        } else {
            inputElement.type = 'password';
            iconElement.classList.remove('bi-eye-slash');
            iconElement.classList.add('bi-eye');
        }
    }
    
    /**
     * Kiểm tra email hợp lệ
     */
    function isValidEmail(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }
    
    /**
     * Kiểm tra số điện thoại hợp lệ
     */
    function isValidPhone(phone) {
        // Kiểm tra số điện thoại Việt Nam (10 số, bắt đầu bằng 0)
        const re = /^(0[3|5|7|8|9])+([0-9]{8})\b/;
        return re.test(phone);
    }
    
    /**
     * Hiển thị thông báo invalid feedback
     */
    function showInvalidFeedback(inputElement, feedbackId) {
        inputElement.classList.add('is-invalid');
        const feedbackElement = document.getElementById(feedbackId);
        if (feedbackElement) {
            feedbackElement.style.display = 'block';
        }
    }
    
    /**
     * Reset validation
     */
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
        if (registerButton && registerSpinner) {
            registerButton.disabled = isLoading;
            registerSpinner.style.display = isLoading ? 'inline-block' : 'none';
        }
    }
});
