// profile.js - JavaScript cho trang thông tin cá nhân

document.addEventListener('DOMContentLoaded', function() {
    // Khai báo các biến và hằng số
    // Khai báo các biến và hằng số
    // Sử dụng API_CONFIG từ config.js (được load trước)
    const API_BASE_URL = window.API_CONFIG ? window.API_CONFIG.BASE_URL : 'http://localhost:3001/api';
    
    console.log('API_BASE_URL đã được khởi tạo:', API_BASE_URL);
    console.log('window.location:', window.location.href);
    let userInfo = null;
    let vehicles = [];
    let selectedVehicleId = null;
    let isEditMode = false;

    // Kiểm tra trạng thái đăng nhập và tải thông tin người dùng
    checkAuth();

    // Khởi tạo các sự kiện
    initializeEvents();

    /**
     * Kiểm tra xác thực người dùng
     */
    function checkAuth() {
        const token = localStorage.getItem('token');
        
        if (!token) {
            // Chưa đăng nhập, chuyển hướng tới trang đăng nhập
            window.location.href = '/login';
            return;
        }

        // Tải thông tin người dùng
        loadUserProfile();
    }

    /**
     * Tải thông tin profile người dùng từ API
     */
    async function loadUserProfile() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Thêm log để debug
            console.log('Đang gọi API với BASE_URL:', API_BASE_URL);
            
            // Gọi API để lấy thông tin người dùng
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            // Thêm log trạng thái phản hồi
            console.log('Trạng thái phản hồi API:', response.status);
            
            if (!response.ok) {
                // Nếu có lỗi, thêm log để debug
                const errorText = await response.text();
                console.error('Phản hồi lỗi từ API:', errorText);
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('API response:', data); // Debug: Hiển thị dữ liệu từ API
            
            if (data.success) {
                userInfo = data.user;
                console.log('User info:', userInfo); // Debug: Hiển thị thông tin user
                
                // Chuẩn hóa dữ liệu từ API
                const normalizedUser = normalizeUserData(userInfo);
                
                // Lưu thông tin người dùng vào localStorage
                localStorage.setItem('user', JSON.stringify(normalizedUser));
                
                // Cập nhật giao diện với thông tin người dùng
                updateUserInterface(normalizedUser);
                
                // Cập nhật avatar và tên trong header
                updateHeaderUserInfo(normalizedUser);
                
                // Cập nhật hiển thị avatar
                updateAvatarDisplay(normalizedUser);
                
                // Tải danh sách xe của người dùng
                loadVehicles();
            } else {
                throw new Error(data.message || 'Không thể tải thông tin người dùng');
            }
            
        } catch (error) {
            console.error('Lỗi khi tải thông tin người dùng:', error);
            
            // Nếu lỗi xác thực, chuyển hướng về trang đăng nhập
            if (error.message.includes('401') || error.message.includes('403')) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            } else {
                showError('Không thể tải thông tin người dùng: ' + error.message);
            }
        }
    }

    /**
     * Chuẩn hóa dữ liệu người dùng từ API
     */
    function normalizeUserData(user) {
        // Thêm log để debug dữ liệu đầu vào
        console.log('Dữ liệu người dùng cần chuẩn hóa:', user);
        
        // Chuẩn hóa dữ liệu, hỗ trợ cả snake_case và camelCase
        return {
            userId: user.userId || user.UserID || user.id || user.ID,
            fullName: user.fullName || user.FullName || '',
            email: user.email || user.Email || '',
            phoneNumber: user.phoneNumber || user.PhoneNumber || '',
            address: user.address || user.Address || '',
            avatarUrl: user.avatarUrl || user.AvatarUrl || user.ProfilePicture || null,
            role: user.role || user.RoleID || 2,
            createdAt: user.createdAt || user.CreatedAt || new Date().toISOString(),
            status: user.status || user.Status || 1
        };
    }

    /**
     * Cập nhật hiển thị avatar
     */
    function updateAvatarDisplay(user) {
        console.log('Updating avatar display with user data:', user);
        const profileAvatar = document.getElementById('profileAvatar');
        const profileAvatarPlaceholder = document.getElementById('profileAvatarPlaceholder');
        
        if (!profileAvatar || !profileAvatarPlaceholder) {
            console.error('Không tìm thấy các phần tử avatar');
            return;
        }
        
        // Kiểm tra nếu không có URL avatar
        if (!user.avatarUrl) {
            console.log('Không tìm thấy avatar, hiển thị placeholder');
            
            // Ẩn avatar và hiển thị placeholder
            profileAvatar.style.display = 'none';
            profileAvatarPlaceholder.style.display = 'flex';
            
            // Lấy chữ cái đầu tiên của tên hoặc dùng 'U' nếu không có tên
            const firstLetter = user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U';
            
            // Tìm thẻ span trong placeholder và cập nhật nội dung
            const placeholderSpan = profileAvatarPlaceholder.querySelector('span');
            if (placeholderSpan) {
                placeholderSpan.textContent = firstLetter;
            } else {
                profileAvatarPlaceholder.innerHTML = `<span>${firstLetter}</span>`;
            }
            return;
        }
        
        // Đảm bảo luôn có một URL hợp lệ
        let avatarUrl = user.avatarUrl;
        
        // Xử lý đường dẫn
        if (!avatarUrl.startsWith('http') && !avatarUrl.startsWith('/')) {
            avatarUrl = '/' + avatarUrl;
        }
        
        // Thêm tham số ngẫu nhiên để tránh cache
        avatarUrl = avatarUrl + '?t=' + new Date().getTime();
        console.log('Avatar URL sau khi xử lý:', avatarUrl);
        
        // Hiển thị avatar
        profileAvatar.style.display = 'block';
        profileAvatar.src = avatarUrl;
        
        // Xử lý lỗi khi hình ảnh không tải được
        profileAvatar.onerror = function() {
            console.log('Avatar image failed to load, showing placeholder');
            this.onerror = null;
            
            // Thử dùng đường dẫn mặc định
            this.src = '/images/user-placeholder.png';
            
            // Nếu vẫn lỗi, hiển thị chữ cái đầu
            this.onerror = function() {
                profileAvatar.style.display = 'none';
                profileAvatarPlaceholder.style.display = 'flex';
                
                // Lấy chữ cái đầu tiên của tên
                const firstLetter = user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U';
                
                // Cập nhật nội dung placeholder
                const placeholderSpan = profileAvatarPlaceholder.querySelector('span');
                if (placeholderSpan) {
                    placeholderSpan.textContent = firstLetter;
                } else {
                    profileAvatarPlaceholder.innerHTML = `<span>${firstLetter}</span>`;
                }
            };
        };
        
        // Ẩn placeholder
        profileAvatarPlaceholder.style.display = 'none';
    }

    /**
     * Cập nhật thông tin người dùng trong header
     */
    function updateHeaderUserInfo(user) {
        console.log('Updating header user info');
        const userInfoHeader = document.getElementById('userInfoHeader');
        const userAvatarSmall = document.getElementById('userAvatarSmall');
        const userNameSmall = document.getElementById('userNameSmall');
        
        if (userInfoHeader) {
            // Hiển thị dropdown người dùng trên header
            userInfoHeader.style.display = 'flex';
        }
        
        if (userNameSmall) {
            // Cập nhật tên hiển thị trong dropdown
            userNameSmall.textContent = user.fullName || user.email || 'Người dùng';
        }
        
        if (userAvatarSmall) {
            if (user.avatarUrl) {
                // Dùng URL trực tiếp từ Cloudinary
                let avatarUrl = user.avatarUrl;
                // Tạo thẻ img cho avatar với xử lý khi lỗi
                const imgElement = document.createElement('img');
                imgElement.src = avatarUrl;
                imgElement.alt = 'Avatar';
                imgElement.className = 'rounded-circle';
                imgElement.style.width = '24px';
                imgElement.style.height = '24px';
                imgElement.style.objectFit = 'cover';
                
                // Xử lý khi hình ảnh không tải được
                imgElement.onerror = function() {
                    // Hiển thị chữ cái đầu trong header
                    const firstLetter = user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U';
                    userAvatarSmall.innerHTML = `<div class="btn-avatar">${firstLetter}</div>`;
                };
                
                // Xóa nội dung cũ và thêm thẻ img mới
                userAvatarSmall.innerHTML = '';
                userAvatarSmall.appendChild(imgElement);
            } else {
                // Hiển thị chữ cái đầu trong header
                const firstLetter = user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U';
                userAvatarSmall.innerHTML = `<div class="btn-avatar">${firstLetter}</div>`;
            }
        }
    }

    /**
     * Cập nhật giao diện người dùng với thông tin từ API
     */
    function updateUserInterface(user) {
        // Cập nhật tên người dùng trong trang profile
        const profileNameElement = document.getElementById('profileName');
        if (profileNameElement) {
            profileNameElement.textContent = user.fullName || user.email || 'Người dùng';
        }
        
        // Cập nhật thời gian thành viên
        const memberSinceElement = document.getElementById('memberSince');
        if (memberSinceElement && user.createdAt) {
            try {
                const createdDate = new Date(user.createdAt);
                memberSinceElement.textContent = `Thành viên từ: ${createdDate.toLocaleDateString('vi-VN')}`;
            } catch (e) {
                console.error('Lỗi định dạng ngày:', e);
                memberSinceElement.textContent = `Thành viên`;
            }
        }
        
        // Cập nhật form thông tin cá nhân
        const fullNameInput = document.getElementById('fullName');
        const phoneNumberInput = document.getElementById('phoneNumber');
        const emailInput = document.getElementById('email');
        const addressInput = document.getElementById('address');
        
        if (fullNameInput) fullNameInput.value = user.fullName || '';
        if (phoneNumberInput) phoneNumberInput.value = user.phoneNumber || '';
        if (emailInput) emailInput.value = user.email || '';
        if (addressInput) addressInput.value = user.address || '';
        
        // Cập nhật tab thông tin tài khoản
        const accountEmailElement = document.getElementById('accountEmail');
        if (accountEmailElement) {
            accountEmailElement.textContent = user.email || '';
        }
        
        // Cập nhật vai trò
        const accountRoleElement = document.getElementById('accountRole');
        if (accountRoleElement) {
            let roleBadge = '';
            switch (user.role) {
                case 1:
                    roleBadge = '<span class="badge bg-danger">Quản trị viên</span>';
                    break;
                case 2:
                    roleBadge = '<span class="badge bg-primary">Khách hàng</span>';
                    break;
                case 3:
                    roleBadge = '<span class="badge bg-warning text-dark">Kỹ thuật viên</span>';
                    break;
                default:
                    roleBadge = '<span class="badge bg-secondary">Không xác định</span>';
            }
            accountRoleElement.innerHTML = roleBadge;
        }
        
        // Cập nhật trạng thái tài khoản
        const accountStatusElement = document.getElementById('accountStatus');
        if (accountStatusElement) {
            const statusBadge = user.status === 1 
                ? '<span class="badge bg-success">Hoạt động</span>' 
                : '<span class="badge bg-danger">Bị khóa</span>';
            accountStatusElement.innerHTML = statusBadge;
        }
        
        // Cập nhật ngày tạo tài khoản
        const accountCreatedAtElement = document.getElementById('accountCreatedAt');
        if (accountCreatedAtElement && user.createdAt) {
            try {
                const createdDate = new Date(user.createdAt);
                accountCreatedAtElement.textContent = createdDate.toLocaleDateString('vi-VN');
            } catch (e) {
                console.error('Lỗi định dạng ngày tạo:', e);
                accountCreatedAtElement.textContent = 'Không có thông tin';
            }
        }
    }

    /**
     * Tải danh sách xe của người dùng
     */
    async function loadVehicles() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Hiển thị trạng thái đang tải
            showVehiclesLoading();
            
            // Gọi API để lấy danh sách xe
            const response = await fetch(`${API_BASE_URL}/users/vehicles/user`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Vehicles data:', data); // Debug: Hiển thị dữ liệu xe
            
            if (data.success) {
                vehicles = data.vehicles || [];
                renderVehiclesTable(vehicles);
            } else {
                throw new Error(data.message || 'Không thể tải danh sách xe');
            }
            
        } catch (error) {
            console.error('Lỗi khi tải danh sách xe:', error);
            showVehiclesError(error);
            showError('Không thể tải danh sách xe: ' + error.message);
        }
    }

    /**
     * Hiển thị trạng thái đang tải khi tải danh sách xe
     */
    function showVehiclesLoading() {
        const vehiclesList = document.getElementById('vehiclesList');
        if (vehiclesList) {
            vehiclesList.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        <div class="d-flex flex-column align-items-center">
                            <div class="spinner-border text-primary mb-3" role="status">
                                <span class="visually-hidden">Đang tải...</span>
                            </div>
                            <p class="mb-0">Đang tải danh sách xe...</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    /**
     * Hiển thị trạng thái lỗi khi tải danh sách xe
     */
    function showVehiclesError(error) {
        const vehiclesList = document.getElementById('vehiclesList');
        if (vehiclesList) {
            vehiclesList.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        <div class="d-flex flex-column align-items-center">
                            <i class="bi bi-exclamation-triangle-fill text-danger mb-3" style="font-size: 3rem;"></i>
                            <p class="text-danger mb-0">Lỗi: ${error.message}</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    /**
     * Hiển thị danh sách xe trong bảng
     */
    function renderVehiclesTable(vehiclesData) {
        const tableBody = document.getElementById('vehiclesList');
        if (!tableBody) return;
        
        if (!vehiclesData || vehiclesData.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4">
                        <div class="d-flex flex-column align-items-center">
                            <i class="bi bi-car-front-fill text-secondary mb-3" style="font-size: 3rem;"></i>
                            <p class="mb-0">Bạn chưa có xe nào. Hãy thêm xe mới để đặt lịch dễ dàng hơn!</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        let html = '';
        
        vehiclesData.forEach(vehicle => {
            html += `
                <tr>
                    <td><strong>${vehicle.LicensePlate || ''}</strong></td>
                    <td>${vehicle.Brand || ''}</td>
                    <td>${vehicle.Model || ''}</td>
                    <td>${vehicle.Year || ''}</td>
                    <td class="text-center">
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-outline-primary" onclick="editVehicle(${vehicle.VehicleID})" title="Chỉnh sửa">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="confirmDeleteVehicle(${vehicle.VehicleID}, '${vehicle.LicensePlate}')" title="Xóa">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html;
    }

    /**
     * Khởi tạo các sự kiện trên trang
     */
    function initializeEvents() {
        // Các sự kiện tabs
        const tabLinks = document.querySelectorAll('.list-group-item');
        tabLinks.forEach(link => {
            link.addEventListener('click', switchTab);
        });
        
        // Sự kiện đăng xuất
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', logout);
        }
        
        // Sự kiện đổi avatar
        const changeAvatarBtn = document.getElementById('changeAvatarBtn');
        if (changeAvatarBtn) {
            changeAvatarBtn.addEventListener('click', function() {
                const avatarModal = new bootstrap.Modal(document.getElementById('avatarModal'));
                avatarModal.show();
            });
        }
        
        // Event listener cho input file avatar
        const avatarFile = document.getElementById('avatarFile');
        if (avatarFile) {
            avatarFile.addEventListener('change', function(event) {
                const file = event.target.files[0];
                if (file) {
                    // Kiểm tra kích thước file
                    if (file.size > 5 * 1024 * 1024) {
                        showError('Kích thước file không được vượt quá 5MB');
                        event.target.value = '';
                        return;
                    }
                    
                    // Kiểm tra loại file
                    if (!file.type.startsWith('image/')) {
                        showError('Vui lòng chọn file hình ảnh');
                        event.target.value = '';
                        return;
                    }

                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const avatarPreview = document.getElementById('avatarPreview');
                        if (avatarPreview) {
                            avatarPreview.src = e.target.result;
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        
        // Sự kiện form thông tin cá nhân
        const personalInfoForm = document.getElementById('personalInfoForm');
        if (personalInfoForm) {
            personalInfoForm.addEventListener('submit', savePersonalInfo);
        }
        
        // Sự kiện đổi mật khẩu
        const changePasswordForm = document.getElementById('changePasswordForm');
        if (changePasswordForm) {
            changePasswordForm.addEventListener('submit', changePassword);
        }
        
        // Sự kiện hiện/ẩn mật khẩu
        const togglePasswordButtons = document.querySelectorAll('.toggle-password');
        togglePasswordButtons.forEach(button => {
            button.addEventListener('click', togglePasswordVisibility);
        });
        
        // Sự kiện quản lý xe
        const addVehicleBtn = document.getElementById('addVehicleBtn');
        if (addVehicleBtn) {
            addVehicleBtn.addEventListener('click', openAddVehicleModal);
        }
        
        const saveVehicleBtn = document.getElementById('saveVehicleBtn');
        if (saveVehicleBtn) {
            saveVehicleBtn.addEventListener('click', saveVehicle);
        }
        
        const confirmDeleteVehicleBtn = document.getElementById('confirmDeleteVehicleBtn');
        if (confirmDeleteVehicleBtn) {
            confirmDeleteVehicleBtn.addEventListener('click', deleteVehicle);
        }
        
        // Đóng thông báo khi nhấn nút đóng
        const alertCloseButtons = document.querySelectorAll('.alert .btn-close');
        alertCloseButtons.forEach(button => {
            button.addEventListener('click', function() {
                this.closest('.alert').classList.add('d-none');
            });
        });

        // Event listener cho nút lưu avatar
        const saveAvatarBtn = document.getElementById('saveAvatarBtn');
        if (saveAvatarBtn) {
            saveAvatarBtn.addEventListener('click', function(e) {
                e.preventDefault();
                saveAvatar();
            });
        }
    }

    /**
     * Chuyển đổi giữa các tab (cải tiến)
     */
    function switchTab(e) {
        e.preventDefault();
        
        const targetId = this.getAttribute('href').substring(1);
        
        // Cập nhật trạng thái active trong menu
        document.querySelectorAll('.list-group-item').forEach(item => {
            item.classList.remove('active');
        });
        this.classList.add('active');
        
        // Ẩn/hiện các tab nội dung với hiệu ứng
        const activeTabs = document.querySelectorAll('.profile-tab.active');
        const targetTab = document.getElementById(targetId);
        
        if (!targetTab) return;
        
        // Ẩn tab đang hiển thị
        activeTabs.forEach(tab => {
            if (tab.id !== targetId) {
                tab.style.opacity = '1';
                tab.style.transition = 'opacity 0.3s ease';
                tab.style.opacity = '0';
                
                setTimeout(() => {
                    tab.classList.add('d-none');
                    tab.classList.remove('active');
                    tab.style.opacity = '1';
                }, 300);
            }
        });
        
        // Hiển thị tab đích
        setTimeout(() => {
            targetTab.classList.remove('d-none');
            targetTab.classList.add('active');
            
            // Hiệu ứng xuất hiện
            targetTab.style.opacity = '0';
            targetTab.style.transition = 'opacity 0.3s ease';
            
            setTimeout(() => {
                targetTab.style.opacity = '1';
            }, 50);
        }, activeTabs.length > 0 && activeTabs[0].id !== targetId ? 300 : 0);
    }

    /**
     * Xử lý đăng xuất
     */
    function logout(e) {
        e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }

    /**
     * Mở modal thêm avatar
     */
    function openAvatarModal() {
        // Reset form và preview
        const avatarForm = document.getElementById('avatarForm');
        const avatarPreview = document.getElementById('avatarPreview');
        const avatarUploadStatus = document.getElementById('avatarUploadStatus');
        
        if (avatarForm) avatarForm.reset();
        if (avatarPreview) {
            // Kiểm tra nếu người dùng đã có avatar thì hiển thị avatar đó
            if (userInfo && userInfo.avatarUrl) {
                // Đảm bảo URL chính xác
                let avatarUrl = userInfo.avatarUrl;
                if (!avatarUrl.startsWith('http') && !avatarUrl.startsWith('/')) {
                    avatarUrl = '/' + avatarUrl;
                }
                avatarPreview.src = avatarUrl;
                // Thêm fallback khi ảnh không tải được
                avatarPreview.onerror = function() {
                    console.log('Không thể tải avatar, sử dụng placeholder');
                    this.onerror = null; // Tránh vòng lặp vô hạn
                    this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2aWV3Qm94PSIwIDAgMTUwIDE1MCIgcHJlc2VydmVBc3BlY3RSYXRpbz0ibm9uZSI+PHJlY3Qgd2lkdGg9IjE1MCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiNFRUVFRUUiPjwvcmVjdD48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsLCBIZWx2ZXRpY2EsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzAiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIj5BdmF0YXI8L3RleHQ+PC9zdmc+';
                };
            } else {
                // Sử dụng Base64 SVG inline thay vì file hình ảnh
                avatarPreview.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2aWV3Qm94PSIwIDAgMTUwIDE1MCIgcHJlc2VydmVBc3BlY3RSYXRpbz0ibm9uZSI+PHJlY3Qgd2lkdGg9IjE1MCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiNFRUVFRUUiPjwvcmVjdD48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsLCBIZWx2ZXRpY2EsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMzAiIGZpbGw9IiM5OTk5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIj5BdmF0YXI8L3RleHQ+PC9zdmc+';
            }
        }
        if (avatarUploadStatus) {
            avatarUploadStatus.classList.add('d-none');
        }
        
        // Hiển thị modal
        const avatarModal = document.getElementById('avatarModal');
        if (avatarModal) {
            const modal = new bootstrap.Modal(avatarModal);
            modal.show();
        }
    }

    /**
     * Xử lý cập nhật avatar
     */
    async function saveAvatar() {
        try {
            const fileInput = document.getElementById('avatarFile');
            const file = fileInput.files[0];
            
            if (!file) {
                showError('Vui lòng chọn một hình ảnh');
                return;
            }
            
            // Kiểm tra kích thước file
            if (file.size > 5 * 1024 * 1024) {
                showError('Kích thước file không được vượt quá 5MB');
                return;
            }
            
            // Kiểm tra loại file
            if (!file.type.startsWith('image/')) {
                showError('Vui lòng chọn file hình ảnh');
                return;
            }
            
            const formData = new FormData();
            formData.append('avatar', file);
            
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Hiển thị loading
            const saveButton = document.getElementById('saveAvatarBtn');
            const saveSpinner = document.getElementById('saveAvatarSpinner');
            
            if (saveButton) saveButton.disabled = true;
            if (saveSpinner) saveSpinner.classList.remove('d-none');
            
            try {
                const response = await fetch(`${API_BASE_URL}/upload/avatar`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || 'Lỗi khi upload avatar');
                }
                
                if (data.success) {
                    // Cập nhật thông tin người dùng
                    userInfo = {
                        ...userInfo,
                        avatarUrl: data.avatarUrl,
                        ProfilePicture: data.imagePath
                    };
                    
                    // Cập nhật localStorage
                    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
                    storedUser.avatarUrl = data.avatarUrl;
                    localStorage.setItem('user', JSON.stringify(storedUser));
                    
                    // Cập nhật hiển thị avatar
                    updateAvatarDisplay(userInfo);
                    updateHeaderUserInfo(userInfo);
                    
                    // Đóng modal
                    const avatarModal = document.getElementById('avatarModal');
                    const modalInstance = bootstrap.Modal.getInstance(avatarModal);
                    if (modalInstance) modalInstance.hide();
                    
                    showSuccess('Cập nhật avatar thành công');
                } else {
                    throw new Error(data.message || 'Không thể cập nhật avatar');
                }
            } finally {
                // Khôi phục trạng thái button
                if (saveButton) {
                    saveButton.disabled = false;
                }
                if (saveSpinner) {
                    saveSpinner.classList.add('d-none');
                }
            }
        } catch (error) {
            console.error('Lỗi khi lưu avatar:', error);
            showError(error.message || 'Có lỗi xảy ra khi cập nhật avatar');
        }
    }

    /**
     * Lưu thông tin cá nhân
     */
    async function savePersonalInfo(e) {
        e.preventDefault();
        
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Lấy dữ liệu từ form
            const fullNameInput = document.getElementById('fullName');
            const phoneNumberInput = document.getElementById('phoneNumber');
            const addressInput = document.getElementById('address');
            
            if (!fullNameInput || !phoneNumberInput) {
                throw new Error('Không tìm thấy các trường dữ liệu');
            }
            
            const fullName = fullNameInput.value.trim();
            const phoneNumber = phoneNumberInput.value.trim();
            const address = addressInput ? addressInput.value.trim() : '';
            
            // Kiểm tra dữ liệu
            if (!fullName) {
                showError('Vui lòng nhập họ và tên');
                return;
            }
            
            if (!phoneNumber) {
                showError('Vui lòng nhập số điện thoại');
                return;
            }
            
            // Hiển thị trạng thái đang xử lý
            const saveButton = document.querySelector('#personalInfoForm button[type="submit"]');
            const saveSpinner = document.getElementById('savePersonalInfoSpinner');
            
            if (saveButton) saveButton.disabled = true;
            if (saveSpinner) saveSpinner.classList.remove('d-none');
            
            // Chuẩn bị dữ liệu
            const profileData = {
                fullName,
                phoneNumber,
                address
            };
            
            // Gọi API cập nhật thông tin
            const response = await fetch(`${API_BASE_URL}/users/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(profileData)
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Update profile response:', data); // Debug: Hiển thị kết quả cập nhật
            
            if (data.success) {
                // Cập nhật thông tin người dùng
                userInfo = { ...userInfo, ...profileData };
                
                // Cập nhật localStorage
                const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
                storedUser.fullName = fullName;
                storedUser.phoneNumber = phoneNumber;
                storedUser.address = address;
                localStorage.setItem('user', JSON.stringify(storedUser));
                
                // Chuẩn hóa dữ liệu
                const normalizedUser = normalizeUserData(userInfo);
                
                // Cập nhật giao diện
                updateUserInterface(normalizedUser);
                
                // Cập nhật thông tin trong header
                updateHeaderUserInfo(normalizedUser);
                
                // Hiển thị thông báo thành công
                showSuccess('Cập nhật thông tin cá nhân thành công');
            } else {
                throw new Error(data.message || 'Không thể cập nhật thông tin cá nhân');
            }
            
        } catch (error) {
            console.error('Lỗi khi cập nhật thông tin cá nhân:', error);
            showError('Không thể cập nhật thông tin cá nhân: ' + error.message);
        } finally {
            // Khôi phục trạng thái nút
            const saveButton = document.querySelector('#personalInfoForm button[type="submit"]');
            const saveSpinner = document.getElementById('savePersonalInfoSpinner');
            
            if (saveButton) saveButton.disabled = false;
            if (saveSpinner) saveSpinner.classList.add('d-none');
        }
    }

    /**
     * Làm mới thông tin người dùng từ server
     */
    async function refreshUserData() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                console.error('Không tìm thấy token đăng nhập');
                return;
            }
            
            // Gọi API lấy thông tin người dùng
            const response = await fetch('/api/images/upload/avatar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Không thể lấy thông tin người dùng');
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Cập nhật thông tin trong localStorage
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Cập nhật giao diện
                updateAvatarDisplay(data.user);
                
                console.log('Đã làm mới thông tin người dùng thành công');
                return true;
            }
            return false;
        } catch (error) {
            console.error('Lỗi khi làm mới thông tin người dùng:', error);
            return false;
        }
    }

    // Thêm event listener để làm mới thông tin khi trang được tải
    document.addEventListener('DOMContentLoaded', function() {
        refreshUserData();
        
        // Thêm sự kiện cho nút đổi avatar
        const changeAvatarBtn = document.getElementById('changeAvatarBtn');
        if (changeAvatarBtn) {
            changeAvatarBtn.addEventListener('click', function() {
                const avatarModal = new bootstrap.Modal(document.getElementById('avatarModal'));
                avatarModal.show();
            });
        }
        
        // Thêm sự kiện cho nút lưu avatar
        const saveAvatarBtn = document.getElementById('saveAvatarBtn');
        if (saveAvatarBtn) {
            saveAvatarBtn.addEventListener('click', function(e) {
                e.preventDefault();
                saveAvatar();
            });
        }
    });

    /**
     * Đổi mật khẩu
     */
    async function changePassword(e) {
        e.preventDefault();
        
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Lấy dữ liệu từ form
            const currentPasswordInput = document.getElementById('currentPassword');
            const newPasswordInput = document.getElementById('newPassword');
            const confirmPasswordInput = document.getElementById('confirmPassword');
            
            if (!currentPasswordInput || !newPasswordInput || !confirmPasswordInput) {
                throw new Error('Không tìm thấy các trường dữ liệu');
            }
            
            const currentPassword = currentPasswordInput.value;
            const newPassword = newPasswordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            
            // Kiểm tra dữ liệu
            if (!currentPassword) {
                showError('Vui lòng nhập mật khẩu hiện tại');
                return;
            }
            
            if (!newPassword) {
                showError('Vui lòng nhập mật khẩu mới');
                return;
            }
            
            if (newPassword.length < 6) {
                showError('Mật khẩu mới phải có ít nhất 6 ký tự');
                return;
            }
            
            if (newPassword !== confirmPassword) {
                showError('Mật khẩu xác nhận không khớp');
                return;
            }
            
            // Hiển thị trạng thái đang xử lý
            const saveButton = document.querySelector('#changePasswordForm button[type="submit"]');
            const saveSpinner = document.getElementById('changePasswordSpinner');
            
            if (saveButton) saveButton.disabled = true;
            if (saveSpinner) saveSpinner.classList.remove('d-none');
            
            // Chuẩn bị dữ liệu
            const passwordData = {
                currentPassword,
                newPassword
            };
            
            // Gọi API đổi mật khẩu
            const response = await fetch(`${API_BASE_URL}/users/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(passwordData)
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Change password response:', data); // Debug: Hiển thị kết quả đổi mật khẩu
            
            if (data.success) {
                // Reset form
                const changePasswordForm = document.getElementById('changePasswordForm');
                if (changePasswordForm) changePasswordForm.reset();
                
                // Hiển thị thông báo thành công
                showSuccess('Đổi mật khẩu thành công');
            } else {
                throw new Error(data.message || 'Không thể đổi mật khẩu');
            }
            
        } catch (error) {
            console.error('Lỗi khi đổi mật khẩu:', error);
            showError('Không thể đổi mật khẩu: ' + error.message);
        } finally {
            // Khôi phục trạng thái nút
            const saveButton = document.querySelector('#changePasswordForm button[type="submit"]');
            const saveSpinner = document.getElementById('changePasswordSpinner');
            
            if (saveButton) saveButton.disabled = false;
            if (saveSpinner) saveSpinner.classList.add('d-none');
        }
    }

    /**
     * Hiện/ẩn mật khẩu
     */
    function togglePasswordVisibility() {
        const inputField = this.parentElement.querySelector('input');
        const icon = this.querySelector('i');
        
        if (inputField && icon) {
            if (inputField.type === 'password') {
                inputField.type = 'text';
                icon.classList.remove('bi-eye');
                icon.classList.add('bi-eye-slash');
            } else {
                inputField.type = 'password';
                icon.classList.remove('bi-eye-slash');
                icon.classList.add('bi-eye');
            }
        }
    }

    /**
     * Mở modal thêm xe mới
     */
    function openAddVehicleModal() {
        // Reset form
        const vehicleForm = document.getElementById('vehicleForm');
        const vehicleIdInput = document.getElementById('vehicleId');
        const vehicleModalTitle = document.getElementById('vehicleModalTitle');
        
        if (vehicleForm) vehicleForm.reset();
        if (vehicleIdInput) vehicleIdInput.value = '';
        
        // Cập nhật tiêu đề modal
        if (vehicleModalTitle) {
            vehicleModalTitle.innerHTML = '<i class="bi bi-car-front me-2"></i>Thêm xe mới';
        }
        
        // Đặt chế độ form
        isEditMode = false;
        
        // Hiển thị modal
        const vehicleModal = document.getElementById('vehicleModal');
        if (vehicleModal) {
            const modal = new bootstrap.Modal(vehicleModal);
            modal.show();
        }
    }

    /**
     * Lưu thông tin xe (thêm mới hoặc cập nhật)
     */
    async function saveVehicle() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Lấy dữ liệu từ form
            const vehicleIdInput = document.getElementById('vehicleId');
            const licensePlateInput = document.getElementById('licensePlate');
            const brandInput = document.getElementById('brand');
            const modelInput = document.getElementById('model');
            const yearInput = document.getElementById('year');
            
            if (!licensePlateInput || !brandInput || !modelInput) {
                throw new Error('Không tìm thấy các trường dữ liệu');
            }
            
            const vehicleId = vehicleIdInput ? vehicleIdInput.value : '';
            const licensePlate = licensePlateInput.value.trim();
            const brand = brandInput.value.trim();
            const model = modelInput.value.trim();
            const year = yearInput ? yearInput.value : '';
            
            // Kiểm tra dữ liệu
            if (!licensePlate) {
                showError('Vui lòng nhập biển số xe');
                return;
            }
            
            if (!brand) {
                showError('Vui lòng nhập hãng xe');
                return;
            }
            
            if (!model) {
                showError('Vui lòng nhập mẫu xe');
                return;
            }
            
            // Hiển thị trạng thái đang xử lý
            const saveButton = document.getElementById('saveVehicleBtn');
            const saveSpinner = document.getElementById('saveVehicleSpinner');
            
            if (saveButton) saveButton.disabled = true;
            if (saveSpinner) saveSpinner.classList.remove('d-none');
            
            // Chuẩn bị dữ liệu
            const vehicleData = {
                licensePlate,
                brand,
                model,
                year: year ? parseInt(year) : null
            };
            
            let response;
            
            if (isEditMode) {
                // Cập nhật xe đã có
                response = await fetch(`${API_BASE_URL}/users/vehicles/${vehicleId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(vehicleData)
                });
            } else {
                // Thêm xe mới
                response = await fetch(`${API_BASE_URL}/users/vehicles`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(vehicleData)
                });
            }
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Save vehicle response:', data); // Debug: Hiển thị kết quả lưu xe
            
            if (data.success) {
                // Đóng modal
                const vehicleModal = document.getElementById('vehicleModal');
                if (vehicleModal) {
                    const modal = bootstrap.Modal.getInstance(vehicleModal);
                    if (modal) modal.hide();
                }
                
                // Hiển thị thông báo thành công
                showSuccess(isEditMode ? 'Cập nhật thông tin xe thành công' : 'Thêm xe mới thành công');
                
                // Tải lại danh sách xe
                loadVehicles();
            } else {
                throw new Error(data.message || 'Không thể lưu thông tin xe');
            }
            
        } catch (error) {
            console.error('Lỗi khi lưu thông tin xe:', error);
            showError('Không thể lưu thông tin xe: ' + error.message);
        } finally {
            // Khôi phục trạng thái nút
            const saveButton = document.getElementById('saveVehicleBtn');
            const saveSpinner = document.getElementById('saveVehicleSpinner');
            
            if (saveButton) saveButton.disabled = false;
            if (saveSpinner) saveSpinner.classList.add('d-none');
        }
    }

    /**
     * Hiển thị thông báo lỗi
     */
    function showError(message) {
        const errorAlert = document.getElementById('errorAlert');
        const errorMessage = document.getElementById('errorMessage');
        
        if (errorAlert && errorMessage) {
            errorMessage.textContent = message;
            errorAlert.classList.remove('d-none');
            
            // Thêm hiệu ứng
            errorAlert.style.animation = 'none';
            setTimeout(() => {
                errorAlert.style.animation = 'fadeIn 0.5s';
            }, 10);
            
            // Tự động ẩn sau 5 giây
            setTimeout(() => {
                errorAlert.classList.add('d-none');
            }, 5000);
            
            // Scroll lên đầu trang để hiển thị thông báo
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        } else {
            console.error('Không tìm thấy phần tử errorAlert hoặc errorMessage');
            alert(message);
        }
    }

    /**
     * Hiển thị thông báo thành công
     */
    function showSuccess(message) {
        const successAlert = document.getElementById('successAlert');
        const successMessage = document.getElementById('successMessage');
        
        if (successAlert && successMessage) {
            successMessage.textContent = message;
            successAlert.classList.remove('d-none');
            
            // Thêm hiệu ứng
            successAlert.style.animation = 'none';
            setTimeout(() => {
                successAlert.style.animation = 'fadeIn 0.5s';
            }, 10);
            
            // Tự động ẩn sau 5 giây
            setTimeout(() => {
                successAlert.classList.add('d-none');
            }, 5000);
            
            // Scroll lên đầu trang để hiển thị thông báo
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        } else {
            console.error('Không tìm thấy phần tử successAlert hoặc successMessage');
            alert(message);
        }
    }
});

// Khai báo hàm editVehicle và confirmDeleteVehicle ở phạm vi toàn cục
// để có thể truy cập từ các sự kiện onclick trong HTML
let selectedVehicleId = null;

function editVehicle(id) {
    // Lấy thông tin xe từ danh sách
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('Không có token xác thực');
        return;
    }
    
    // Lưu ID xe đang chỉnh sửa
    selectedVehicleId = id;
    
    // Gọi API để lấy thông tin chi tiết của xe
    fetch(`http://localhost:3001/api/users/vehicles/${id}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Lỗi HTTP: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success && data.vehicle) {
            const vehicle = data.vehicle;
            
            // Cập nhật tiêu đề modal
            const vehicleModalTitle = document.getElementById('vehicleModalTitle');
            if (vehicleModalTitle) {
                vehicleModalTitle.innerHTML = '<i class="bi bi-pencil me-2"></i>Chỉnh sửa thông tin xe';
            }
            
            // Điền thông tin xe vào form
            const vehicleIdInput = document.getElementById('vehicleId');
            const licensePlateInput = document.getElementById('licensePlate');
            const brandInput = document.getElementById('brand');
            const modelInput = document.getElementById('model');
            const yearInput = document.getElementById('year');
            
            if (vehicleIdInput) vehicleIdInput.value = vehicle.VehicleID;
            if (licensePlateInput) licensePlateInput.value = vehicle.LicensePlate || '';
            if (brandInput) brandInput.value = vehicle.Brand || '';
            if (modelInput) modelInput.value = vehicle.Model || '';
            if (yearInput) yearInput.value = vehicle.Year || '';
            
            // Hiển thị modal
            const vehicleModal = document.getElementById('vehicleModal');
            if (vehicleModal) {
                const modal = new bootstrap.Modal(vehicleModal);
                modal.show();
            }
        } else {
            console.error('Không thể lấy thông tin xe:', data.message);
            alert('Không thể lấy thông tin xe: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Lỗi khi lấy thông tin xe:', error);
        alert('Không thể lấy thông tin xe: ' + error.message);
    });
}

function confirmDeleteVehicle(id, licensePlate) {
    selectedVehicleId = id;
    
    const deleteVehicleLicense = document.getElementById('deleteVehicleLicense');
    if (deleteVehicleLicense) {
        deleteVehicleLicense.textContent = licensePlate;
    }
    
    const deleteVehicleModal = document.getElementById('deleteVehicleModal');
    if (deleteVehicleModal) {
        const modal = new bootstrap.Modal(deleteVehicleModal);
        modal.show();
    }
}

function deleteVehicle() {
    if (!selectedVehicleId) {
        alert('Không có ID xe để xóa');
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        alert('Không có token xác thực');
        return;
    }
    
    // Hiển thị trạng thái đang xử lý
    const deleteBtn = document.getElementById('confirmDeleteVehicleBtn');
    const deleteSpinner = document.getElementById('deleteVehicleSpinner');
    
    if (deleteBtn) deleteBtn.disabled = true;
    if (deleteSpinner) deleteSpinner.classList.remove('d-none');
    
    // Gọi API để xóa xe
    fetch(`http://localhost:3001/api/users/vehicles/${selectedVehicleId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(async response => {
        // Lấy dữ liệu phản hồi ngay cả khi response.ok = false
        const data = await response.json();
        
        // Nếu không thành công, ném lỗi với thông báo từ server
        if (!response.ok) {
            throw new Error(data.message || `Lỗi HTTP: ${response.status}`);
        }
        
        return data;
    })
    .then(data => {
        if (data.success) {
            // Đóng modal
            const deleteVehicleModal = document.getElementById('deleteVehicleModal');
            if (deleteVehicleModal) {
                const modal = bootstrap.Modal.getInstance(deleteVehicleModal);
                if (modal) modal.hide();
            }
            
            // Hiển thị thông báo thành công
            const successAlert = document.getElementById('successAlert');
            const successMessage = document.getElementById('successMessage');
            
            if (successAlert && successMessage) {
                successMessage.textContent = 'Xóa xe thành công';
                successAlert.classList.remove('d-none');
                
                // Tự động ẩn sau 5 giây
                setTimeout(() => {
                    successAlert.classList.add('d-none');
                }, 5000);
            }
            
            // Gọi hàm loadVehicles để tải lại danh sách xe mà không cần tải lại trang
            const loadVehiclesEvent = new CustomEvent('loadVehicles');
            document.dispatchEvent(loadVehiclesEvent);
        } else {
            throw new Error(data.message || 'Không thể xóa xe');
        }
    })
    .catch(error => {
        console.error('Lỗi khi xóa xe:', error);
        
        // Hiển thị thông báo lỗi
        const errorAlert = document.getElementById('errorAlert');
        const errorMessage = document.getElementById('errorMessage');
        
        if (errorAlert && errorMessage) {
            errorMessage.textContent = error.message || 'Không thể xóa xe';
            errorAlert.classList.remove('d-none');
            
            // Tự động ẩn sau 5 giây
            setTimeout(() => {
                errorAlert.classList.add('d-none');
            }, 5000);
            
            // Đóng modal xác nhận xóa
            const deleteVehicleModal = document.getElementById('deleteVehicleModal');
            if (deleteVehicleModal) {
                const modal = bootstrap.Modal.getInstance(deleteVehicleModal);
                if (modal) modal.hide();
            }
        } else {
            alert('Không thể xóa xe: ' + error.message);
        }
    })
    .finally(() => {
        // Khôi phục trạng thái nút
        if (deleteBtn) deleteBtn.disabled = false;
        if (deleteSpinner) deleteSpinner.classList.add('d-none');
    });
}

// Thêm event listener để tải lại danh sách xe
document.addEventListener('loadVehicles', function() {
    // Tìm và gọi hàm loadVehicles từ scope của DOMContentLoaded
    // Hoặc gọi fetch API trực tiếp tại đây
    
    const token = localStorage.getItem('token');
    
    if (!token) {
        return;
    }
    
    // Gọi API để lấy danh sách xe
    fetch(`http://localhost:3001/api/users/vehicles/user`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Lỗi HTTP: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Cập nhật biến vehicles trong phạm vi global
            window.vehicles = data.vehicles || [];
            
            // Render lại danh sách xe
            const tableBody = document.getElementById('vehiclesList');
            if (!tableBody) return;
            
            if (!window.vehicles || window.vehicles.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center py-4">
                            <div class="d-flex flex-column align-items-center">
                                <i class="bi bi-car-front-fill text-secondary mb-3" style="font-size: 3rem;"></i>
                                <p class="mb-0">Bạn chưa có xe nào. Hãy thêm xe mới để đặt lịch dễ dàng hơn!</p>
                            </div>
                        </td>
                    </tr>
                `;
                return;
            }
            
            let html = '';
            
            window.vehicles.forEach(vehicle => {
                html += `
                    <tr>
                        <td><strong>${vehicle.LicensePlate || ''}</strong></td>
                        <td>${vehicle.Brand || ''}</td>
                        <td>${vehicle.Model || ''}</td>
                        <td>${vehicle.Year || ''}</td>
                        <td class="text-center">
                            <div class="action-buttons">
                                <button class="btn btn-sm btn-outline-primary" onclick="editVehicle(${vehicle.VehicleID})" title="Chỉnh sửa">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="confirmDeleteVehicle(${vehicle.VehicleID}, '${vehicle.LicensePlate}')" title="Xóa">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            
            tableBody.innerHTML = html;
        }
    })
    .catch(error => {
        console.error('Lỗi khi tải lại danh sách xe:', error);
    });
});
