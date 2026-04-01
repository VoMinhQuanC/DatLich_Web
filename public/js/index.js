document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM đã tải xong - Kiểm tra trạng thái đăng nhập');
    // Sử dụng API_CONFIG từ config.js (được load trước)
    const API_BASE_URL = window.API_CONFIG ? window.API_CONFIG.BASE_URL : 'http://localhost:3001/api';
    
    // Phần tử DOM
    const authButtons = document.getElementById('authButtons');
    const userInfoHeader = document.getElementById('userInfoHeader');
    const userAvatarSmall = document.getElementById('userAvatarSmall');
    const userNameSmall = document.getElementById('userNameSmall');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const modalLogoutBtn = document.getElementById('modalLogoutBtn');
    
    // Debug: Kiểm tra các phần tử DOM
    console.log('authButtons:', authButtons);
    console.log('userInfoHeader:', userInfoHeader);
    
    // Sự kiện đăng xuất
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
        console.log('Đã thêm event listener cho nút đăng xuất');
    }
    if (modalLogoutBtn) {
        modalLogoutBtn.addEventListener('click', handleLogout);
    }
    
    // Kiểm tra trạng thái đăng nhập ngay khi trang tải
    // checkLoginStatus();
    
    // Kiểm tra trạng thái đăng nhập
    // function checkLoginStatus() {
    //     const token = localStorage.getItem('token');
    //     const userStr = localStorage.getItem('user');
        
    //     console.log('Token:', token ? 'Có' : 'Không');
    //     console.log('User data:', userStr);
        
    //     if (token && userStr) {
    //         try {
    //             const user = JSON.parse(userStr);
    //             console.log('Người dùng đã đăng nhập:', user);
    //             console.log('Role ID của người dùng:', user.roleID, typeof user.roleID);
                
    //             // Cập nhật UI trực tiếp
    //             if (authButtons) {
    //                 authButtons.style.cssText = 'display: none !important';
    //                 console.log('Đã ẩn nút đăng nhập');
    //             }
                
    //             if (userInfoHeader) {
    //                 userInfoHeader.style.cssText = 'display: block !important';
    //                 console.log('Đã hiện dropdown người dùng');
    //             }
                
    //             // Cập nhật thông tin người dùng
    //             if (userAvatarSmall) {
    //                 userAvatarSmall.textContent = getFirstLetter(user.fullName);
    //             }
    //             if (userNameSmall) {
    //                 userNameSmall.textContent = user.fullName || 'Người dùng';
    //             }
                
    //             // Gọi hàm cập nhật UI đầy đủ
    //             updateUIForLoggedInUser(user);
    //         } catch (error) {
    //             console.error('Lỗi phân tích cú pháp dữ liệu người dùng:', error);
    //             updateUIForLoggedOutUser();
    //         }
    //     } else {
    //         console.log('Người dùng chưa đăng nhập');
            
    //         // Cập nhật UI trực tiếp
    //         if (authButtons) {
    //             authButtons.style.cssText = 'display: flex !important';
    //             console.log('Đã hiện nút đăng nhập');
    //         }
            
    //         if (userInfoHeader) {
    //             userInfoHeader.style.cssText = 'display: none !important';
    //             console.log('Đã ẩn dropdown người dùng');
    //         }
            
    //         updateUIForLoggedOutUser();
    //     }
    // }
    
    // Cập nhật UI khi đã đăng nhập
    function updateUIForLoggedInUser(user) {
        // Cập nhật thông tin trong modal (nếu có)
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');
        const adminMenuItem = document.getElementById('adminMenuItem');
        
        if (userAvatar) userAvatar.textContent = getFirstLetter(user.fullName);
        if (userName) userName.textContent = user.fullName || 'Người dùng';
        if (userEmail) userEmail.textContent = user.email || '';
        
        // Kiểm tra vai trò người dùng và hiển thị nút Admin nếu là admin
        if (adminMenuItem) {
            // RoleID 1 là Admin theo database của bạn
            if (user.roleID === 1) {
                adminMenuItem.style.display = 'block';
                console.log('Đã hiện nút Admin cho quản trị viên');
            } else {
                adminMenuItem.style.display = 'none';
                console.log('Ẩn nút Admin cho người dùng thường');
            }
        } else {
            console.error('Không tìm thấy phần tử adminMenuItem');
        }
        
        // Cập nhật thông tin ở header
        // if (userAvatarSmall) {
        //     userAvatarSmall.textContent = getFirstLetter(user.fullName);
        //     console.log('Đã cập nhật avatar:', getFirstLetter(user.fullName));
        // }
        // if (userNameSmall) {
        //     userNameSmall.textContent = user.fullName || 'Người dùng';
        //     console.log('Đã cập nhật tên người dùng:', user.fullName);
        // }
        
        // Ẩn nút đăng nhập, hiện dropdown người dùng
        if (authButtons) {
            authButtons.style.cssText = 'display: none !important';
            console.log('Đã ẩn nút đăng nhập');
        } else {
            console.error('Không tìm thấy phần tử authButtons');
        }
        
        if (userInfoHeader) {
            userInfoHeader.style.cssText = 'display: block !important';
            console.log('Đã hiện dropdown người dùng');
        } else {
            console.error('Không tìm thấy phần tử userInfoHeader');
        }
    }
    
    // Cập nhật UI khi chưa đăng nhập
    function updateUIForLoggedOutUser() {
        // Hiện nút đăng nhập, ẩn dropdown người dùng
        if (authButtons) {
            authButtons.style.cssText = 'display: flex !important';
            console.log('Đã hiện nút đăng nhập');
        } else {
            console.error('Không tìm thấy phần tử authButtons');
        }
        
        if (userInfoHeader) {
            userInfoHeader.style.cssText = 'display: none !important';
            console.log('Đã ẩn dropdown người dùng');
        } else {
            console.error('Không tìm thấy phần tử userInfoHeader');
        }
    }
    
    // Hàm xử lý đăng xuất
    function handleLogout(e) {
        if (e) e.preventDefault();
        console.log('Đang đăng xuất...');
        
        // Xóa dữ liệu đăng nhập
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Cập nhật UI trực tiếp
        if (authButtons) {
            authButtons.style.cssText = 'display: flex !important';
        }
        
        if (userInfoHeader) {
            userInfoHeader.style.cssText = 'display: none !important';
        }
        
        // Cập nhật UI
        updateUIForLoggedOutUser();
        
        // Thông báo thành công
        alert('Đăng xuất thành công');
        
        // Tải lại trang để đảm bảo mọi thứ được reset
        window.location.reload();
    }
    
    // Lấy chữ cái đầu tiên từ tên
    function getFirstLetter(fullName) {
        return fullName ? fullName.charAt(0).toUpperCase() : 'U';
    }
    
    // Xử lý đăng nhập trong form modal (nếu có)
    const modalLoginBtn = document.querySelector('.modal-login-btn');
    if (modalLoginBtn) {
        modalLoginBtn.addEventListener('click', handleModalLogin);
    }
    
    // Hàm xử lý đăng nhập từ modal
    async function handleModalLogin() {
        const loginEmail = document.getElementById('loginEmail');
        const loginPassword = document.getElementById('loginPassword');
        
        if (!loginEmail || !loginPassword) {
            console.error('Không tìm thấy phần tử form đăng nhập');
            return;
        }
        
        const email = loginEmail.value;
        const password = loginPassword.value;
        
        // Kiểm tra đầu vào
        if (!email || !password) {
            showError('Vui lòng nhập email và mật khẩu');
            return;
        }
        
        console.log('Đang đăng nhập với email:', email);
        
        try {
            // Hiển thị spinner
            const loginSpinner = document.getElementById('loginSpinner');
            if (loginSpinner) loginSpinner.style.display = 'inline-block';
            
            // Gửi yêu cầu đăng nhập tới API
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });
            
            const data = await response.json();
            console.log('Kết quả đăng nhập:', data);
            
            // Ẩn spinner
            if (loginSpinner) loginSpinner.style.display = 'none';
            
            if (response.ok && data.token && data.user) {
                // Lưu thông tin đăng nhập
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Hiển thị thông báo thành công
                showSuccess('Đăng nhập thành công');
                
                // Cập nhật UI trực tiếp
                if (authButtons) {
                    authButtons.style.cssText = 'display: none !important';
                }
                
                if (userInfoHeader) {
                    userInfoHeader.style.cssText = 'display: block !important';
                }
                
                // Cập nhật UI
                updateUIForLoggedInUser(data.user);
                
                // Đóng modal
                hideModal();
                
                // Tải lại trang sau 1 giây
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                showError(data.message || 'Đăng nhập thất bại');
            }
        } catch (error) {
            // Ẩn spinner
            const loginSpinner = document.getElementById('loginSpinner');
            if (loginSpinner) loginSpinner.style.display = 'none';
            
            showError('Lỗi kết nối với máy chủ. Vui lòng thử lại sau.');
            console.error('Login error:', error);
        }
    }
    
    // Hiển thị thông báo lỗi
    function showError(message) {
        const errorAlert = document.getElementById('errorAlert');
        if (errorAlert) {
            errorAlert.textContent = message;
            errorAlert.style.display = 'block';
            
            // Ẩn thông báo sau 3 giây
            setTimeout(() => {
                errorAlert.style.display = 'none';
            }, 3000);
        } else {
            console.error('Không tìm thấy phần tử errorAlert');
            alert('Lỗi: ' + message);
        }
    }
    
    // Hiển thị thông báo thành công
    function showSuccess(message) {
        const successAlert = document.getElementById('successAlert');
        if (successAlert) {
            successAlert.textContent = message;
            successAlert.style.display = 'block';
            
            // Ẩn thông báo sau 3 giây
            setTimeout(() => {
                successAlert.style.display = 'none';
            }, 3000);
        } else {
            console.log('Thành công: ' + message);
        }
    }
    
    // Ẩn modal đăng nhập
    function hideModal() {
        const authModal = document.getElementById('authModal');
        if (authModal) {
            const modal = bootstrap.Modal.getInstance(authModal);
            if (modal) {
                modal.hide();
            }
        }
    }
    
    // Bỏ comment dòng dưới để tạo người dùng test (chỉ khi cần debug)
    // setupTestUser();
});


 function toggleSearch() {
    const form = document.getElementById("searchForm");
    form.classList.toggle("d-none");
  }

  document.addEventListener("click", function (event) {
    const container = document.getElementById("search-container");
    if (!container.contains(event.target)) {
      document.getElementById("searchForm").classList.add("d-none");
    }
  });