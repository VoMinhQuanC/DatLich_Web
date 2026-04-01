// admin-users.js - JavaScript cho trang quản lý tài khoản người dùng

document.addEventListener('DOMContentLoaded', function() {
    // Sử dụng API_CONFIG từ config.js (được load trước)
    const API_BASE_URL = window.API_CONFIG ? window.API_CONFIG.BASE_URL : 'http://localhost:3001/api';
    
    // Biến lưu trữ dữ liệu
    let users = [];
    let selectedUserId = null;
    let isEditMode = false;
    
    // Kiểm tra xác thực admin
    checkAdminAuth();
    
    // Load dữ liệu ban đầu
    loadUserStats();
    loadUsers();
    
    // Event listeners
    document.getElementById('addUserBtn').addEventListener('click', openAddUserModal);
    document.getElementById('saveUserBtn').addEventListener('click', saveUser);
    document.getElementById('confirmDeleteBtn').addEventListener('click', deleteUser);
    document.getElementById('changePasswordBtn').addEventListener('click', changePassword);
    document.getElementById('applyFilterBtn').addEventListener('click', applyFilters);
    document.getElementById('searchUser').addEventListener('input', filterUsers);
    
    // Sự kiện đăng xuất
    document.getElementById('logout-link').addEventListener('click', logout);
    document.getElementById('dropdown-logout').addEventListener('click', logout);
    
    // Role selector event handler - hiển thị/ẩn các phần tương ứng trong form
    document.getElementById('userRole').addEventListener('change', function() {
        const role = this.value;
        
        // Ẩn tất cả các phần đặc biệt
        document.getElementById('adminKeySection').style.display = 'none';
        document.getElementById('mechanicInfoSection').style.display = 'none';
        
        // Hiển thị phần tương ứng với vai trò được chọn
        if (role === '1') { // Admin
            document.getElementById('adminKeySection').style.display = 'block';
        } else if (role === '3') { // Thợ sửa xe
            document.getElementById('mechanicInfoSection').style.display = 'block';
        }
    });
    
    // Sự kiện hiện/ẩn mật khẩu
    document.querySelector('.toggle-password').addEventListener('click', function() {
        togglePasswordVisibility('password', this.querySelector('i'));
    });
    
    document.querySelector('.toggle-new-password').addEventListener('click', function() {
        togglePasswordVisibility('newPassword', this.querySelector('i'));
    });
    
    document.querySelector('.toggle-confirm-password').addEventListener('click', function() {
        togglePasswordVisibility('confirmNewPassword', this.querySelector('i'));
    });
    
    /**
     * Kiểm tra xác thực admin
     */
    function checkAdminAuth() {
        const token = localStorage.getItem('token');
        const userInfo = localStorage.getItem('user');
        
        if (!token || !userInfo) {
            // Chưa đăng nhập, chuyển hướng đến trang đăng nhập
            window.location.href = '/login';
            return;
        }
        
        try {
            const user = JSON.parse(userInfo);
            
            // Kiểm tra quyền admin (role = 1)
            if (user.role !== 1) {
                alert('Bạn không có quyền truy cập trang quản trị');
                window.location.href = '/';
                return;
            }
            
            // Hiển thị thông tin admin
            updateUserInfo(user);
            
        } catch (error) {
            console.error('Lỗi phân tích dữ liệu người dùng:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    }
    
    /**
     * Cập nhật thông tin người dùng hiển thị trên giao diện
     */
    function updateUserInfo(user) {
        // Hiển thị tên người dùng
        const adminNameElement = document.getElementById('adminName');
        if (adminNameElement) {
            adminNameElement.textContent = user.fullName || user.email || 'Admin';
        }
        
        // Hiển thị avatar với chữ cái đầu tiên của tên
        const avatarElement = document.getElementById('avatarPlaceholder');
        if (avatarElement && user.fullName) {
            avatarElement.textContent = user.fullName.charAt(0).toUpperCase();
        }
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
     * Tải thống kê người dùng từ API
     */
    async function loadUserStats() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Gọi API
            const response = await fetch(`${API_BASE_URL}/users/stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                updateUserStats(data.stats);
            } else {
                throw new Error(data.message || 'Không thể tải thống kê người dùng');
            }
            
        } catch (error) {
            console.error('Lỗi khi tải thống kê người dùng:', error);
            showErrorMessage('Không thể tải thống kê người dùng: ' + error.message);
        }
    }
    
    /**
     * Cập nhật hiển thị thống kê
     */
    function updateUserStats(stats) {
        document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
        document.getElementById('totalCustomers').textContent = stats.totalCustomers || 0;
        document.getElementById('totalMechanics').textContent = stats.totalMechanics || 0;
        document.getElementById('totalAdmins').textContent = stats.totalAdmins || 0;
    }
    
    /**
     * Tải danh sách người dùng từ API
     */
    async function loadUsers(filters = {}) {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Hiển thị trạng thái loading
            document.getElementById('usersList').innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-3">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Đang tải...</span>
                        </div>
                        <p class="mt-2">Đang tải danh sách người dùng...</p>
                    </td>
                </tr>
            `;
            
            // Xây dựng URL với bộ lọc
            let url = `${API_BASE_URL}/users`;
            const queryParams = [];
            
            if (filters.role) {
                queryParams.push(`role=${encodeURIComponent(filters.role)}`);
            }
            
            if (filters.status) {
                queryParams.push(`status=${encodeURIComponent(filters.status)}`);
            }
            
            if (filters.search) {
                queryParams.push(`search=${encodeURIComponent(filters.search)}`);
            }
            
            if (queryParams.length > 0) {
                url += `?${queryParams.join('&')}`;
            }
            
            // Gọi API
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Lưu người dùng vào biến toàn cục
                users = data.users || [];
                
                // Render bảng người dùng
                renderUsersTable(users);
            } else {
                throw new Error(data.message || 'Không thể tải danh sách người dùng');
            }
            
        } catch (error) {
            console.error('Lỗi khi tải danh sách người dùng:', error);
            showErrorMessage('Không thể tải danh sách người dùng: ' + error.message);
            
            document.getElementById('usersList').innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-danger">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Lỗi: ${error.message}
                    </td>
                </tr>
            `;
        }
    }
    
    /**
     * Render bảng người dùng
     */
    function renderUsersTable(usersData) {
        const tableBody = document.getElementById('usersList');
        
        if (!usersData || usersData.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">Không có người dùng nào</td>
                </tr>
            `;
            return;
        }
        
        let html = '';
        
        usersData.forEach(user => {
            // Tạo badge vai trò
            let roleBadge = '';
            
            switch (user.RoleID) {
                case 1:
                    roleBadge = '<span class="badge bg-purple">Quản trị viên</span>';
                    break;
                case 2:
                    roleBadge = '<span class="badge bg-primary">Khách hàng</span>';
                    break;
                case 3:
                    roleBadge = '<span class="badge bg-orange">Thợ sửa xe</span>';
                    break;
                default:
                    roleBadge = '<span class="badge bg-secondary">Không xác định</span>';
            }
            
            // Tạo badge trạng thái
            let statusBadge = '';
            
            if (user.Status === 1) {
                statusBadge = '<span class="badge bg-success">Hoạt động</span>';
            } else {
                statusBadge = '<span class="badge bg-danger">Bị khóa</span>';
            }
            
            // Format ngày tạo
            const createdAt = new Date(user.CreatedAt);
            const formattedDate = createdAt.toLocaleDateString('vi-VN');
            
            // Tạo hàng trong bảng
            html += `
                <tr>
                    <td>${user.UserID}</td>
                    <td>${user.FullName || ''}</td>
                    <td>${user.Email || ''}</td>
                    <td>${user.PhoneNumber || ''}</td>
                    <td>${roleBadge}</td>
                    <td>${statusBadge}</td>
                    <td>${formattedDate}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-primary btn-edit" onclick="editUser(${user.UserID})" title="Chỉnh sửa">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-secondary btn-password" onclick="openChangePasswordModal(${user.UserID}, '${user.FullName || user.Email}')" title="Đổi mật khẩu">
                                <i class="bi bi-key"></i>
                            </button>
                            <button class="btn btn-sm btn-danger btn-delete" onclick="confirmDeleteUser(${user.UserID}, '${user.FullName || user.Email}')" title="Xóa">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html;
        
        // Khởi tạo DataTable nếu có jQuery
        if ($.fn.DataTable) {
            // Hủy DataTable cũ nếu đã tồn tại
            if ($.fn.DataTable.isDataTable('#usersTable')) {
                $('#usersTable').DataTable().destroy();
            }
            
            $('#usersTable').DataTable({
                language: {
                    url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/vi.json'
                },
                responsive: true,
                pageLength: 10,
                lengthMenu: [10, 25, 50, 100],
                columnDefs: [
                    // Vô hiệu hóa sắp xếp cho cột Action (7)
                    { orderable: false, targets: 7 },
                    // Định nghĩa các cột tìm kiếm chính xác (đối với cột vai trò và trạng thái)
                    { searchable: true, targets: [4, 5] }
                ],
                initComplete: function() {
                    // Lưu tham chiếu DataTable để sử dụng trong các hàm lọc
                    window.usersDataTable = this.api();
                    
                    // Áp dụng lại bộ lọc nếu có
                    const roleFilter = document.getElementById('roleFilter').value;
                    const statusFilter = document.getElementById('statusFilter').value;
                    
                    if (roleFilter || statusFilter) {
                        applyFilters();
                    }
                }
            });
        }
        
        // Đặt các hàm xử lý sự kiện cho các nút thao tác ra global để có thể gọi từ onclick
        window.editUser = editUser;
        window.openChangePasswordModal = openChangePasswordModal;
        window.confirmDeleteUser = confirmDeleteUser;
    }
    
    /**
     * Mở modal thêm người dùng mới
     */
    function openAddUserModal() {
        // Reset form
        document.getElementById('userForm').reset();
        document.getElementById('userModalTitle').textContent = "Thêm người dùng mới";
        document.getElementById('userId').value = "";
        
        // Ẩn các phần đặc biệt
        document.getElementById('adminKeySection').style.display = 'none';
        document.getElementById('mechanicInfoSection').style.display = 'none';
        
        // Hiển thị yêu cầu mật khẩu, ẩn gợi ý
        document.querySelector('.password-required').style.display = 'inline-block';
        document.querySelector('.password-hint').style.display = 'none';
        
        // Đặt trạng thái mặc định là "Hoạt động"
        document.getElementById('userStatus').value = "1";
        
        // Đặt chế độ form
        isEditMode = false;
        
        // Hiển thị modal
        const modal = new bootstrap.Modal(document.getElementById('userModal'));
        modal.show();
    }
    
    /**
     * Mở modal chỉnh sửa người dùng
     */
    function editUser(id) {
        // Tìm người dùng trong danh sách
        const user = users.find(u => u.UserID === id);
        
        if (!user) {
            showErrorMessage('Không tìm thấy thông tin người dùng');
            return;
        }
        
        // Lưu ID người dùng đang chỉnh sửa
        selectedUserId = id;
        
        // Cập nhật tiêu đề modal
        document.getElementById('userModalTitle').textContent = "Chỉnh sửa người dùng";
        
        // Điền thông tin người dùng vào form
        document.getElementById('userId').value = user.UserID;
        document.getElementById('fullName').value = user.FullName || '';
        document.getElementById('email').value = user.Email || '';
        document.getElementById('phone').value = user.PhoneNumber || '';
        document.getElementById('userRole').value = user.RoleID || '';
        document.getElementById('userStatus').value = user.Status === 1 ? "1" : "0";
        
        // Ẩn yêu cầu mật khẩu, hiển thị gợi ý
        document.querySelector('.password-required').style.display = 'none';
        document.querySelector('.password-hint').style.display = 'block';
        
        // Reset trường mật khẩu
        document.getElementById('password').value = '';
        
        // Hiển thị phần tương ứng dựa vào vai trò
        document.getElementById('adminKeySection').style.display = 'none';
        document.getElementById('mechanicInfoSection').style.display = 'none';
        
        if (user.RoleID === 1) { // Admin
            document.getElementById('adminKeySection').style.display = 'block';
        } else if (user.RoleID === 3) { // Thợ sửa xe
            document.getElementById('mechanicInfoSection').style.display = 'block';
            
            // Điền kỹ năng thợ nếu có
            if (user.MechanicSkills) {
                document.getElementById('mechanicSkills').value = user.MechanicSkills;
            }
        }
        
        // Đặt chế độ form
        isEditMode = true;
        
        // Hiển thị modal
        const modal = new bootstrap.Modal(document.getElementById('userModal'));
        modal.show();
    }
    
    /**
     * Mở modal đổi mật khẩu
     */
    function openChangePasswordModal(userId, userName) {
        // Lưu ID người dùng đang được đổi mật khẩu
        selectedUserId = userId;
        
        // Cập nhật tiêu đề modal
        const modalTitle = document.querySelector('#changePasswordModal .modal-title');
        modalTitle.textContent = `Đổi mật khẩu (${userName})`;
        
        // Reset form
        document.getElementById('changePasswordForm').reset();
        document.getElementById('passwordUserId').value = userId;
        
        // Hiển thị modal
        const modal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
        modal.show();
    }
    
    /**
     * Đổi mật khẩu người dùng
     */
    async function changePassword() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            const userId = document.getElementById('passwordUserId').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmNewPassword').value;
            
            // Kiểm tra dữ liệu
            if (!newPassword) {
                showErrorMessage('Vui lòng nhập mật khẩu mới');
                return;
            }
            
            if (newPassword.length < 6) {
                showErrorMessage('Mật khẩu phải có ít nhất 6 ký tự');
                return;
            }
            
            if (newPassword !== confirmPassword) {
                showErrorMessage('Mật khẩu xác nhận không khớp');
                return;
            }
            
            // Hiển thị spinner
            const changePasswordBtn = document.getElementById('changePasswordBtn');
            const passwordSpinner = document.getElementById('passwordSpinner');
            
            changePasswordBtn.disabled = true;
            passwordSpinner.classList.remove('d-none');
            
            // Gọi API
            const response = await fetch(`${API_BASE_URL}/users/${userId}/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    newPassword: newPassword
                })
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Đóng modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('changePasswordModal'));
                modal.hide();
                
                // Hiển thị thông báo thành công
                showSuccessMessage('Đổi mật khẩu thành công');
            } else {
                throw new Error(data.message || 'Không thể đổi mật khẩu');
            }
            
        } catch (error) {
            console.error('Lỗi khi đổi mật khẩu:', error);
            showErrorMessage('Không thể đổi mật khẩu: ' + error.message);
        } finally {
            // Khôi phục trạng thái nút
            const changePasswordBtn = document.getElementById('changePasswordBtn');
            const passwordSpinner = document.getElementById('passwordSpinner');
            
            changePasswordBtn.disabled = false;
            passwordSpinner.classList.add('d-none');
        }
    }
    
    /**
     * Hiển thị modal xác nhận xóa người dùng
     */
    function confirmDeleteUser(id, name) {
        selectedUserId = id;
        document.getElementById('deleteUserName').textContent = name;
        
        const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
        modal.show();
    }
    
    /**
     * Xóa người dùng
     */
    async function deleteUser() {
        if (!selectedUserId) {
            showErrorMessage('Không có ID người dùng để xóa');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Hiển thị trạng thái đang xóa
            const deleteBtn = document.getElementById('confirmDeleteBtn');
            const deleteSpinner = document.getElementById('deleteSpinner');
            deleteBtn.disabled = true;
            deleteSpinner.classList.remove('d-none');
            
            // Gọi API để xóa người dùng
            const response = await fetch(`${API_BASE_URL}/users/${selectedUserId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Đóng modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
                modal.hide();
                
                // Hiển thị thông báo thành công
                showSuccessMessage('Xóa người dùng thành công');
                
                // Tải lại danh sách người dùng
                loadUsers();
                loadUserStats();
            } else {
                throw new Error(data.message || 'Không thể xóa người dùng');
            }
            
        } catch (error) {
            console.error('Lỗi khi xóa người dùng:', error);
            showErrorMessage('Không thể xóa người dùng: ' + error.message);
        } finally {
            // Khôi phục trạng thái nút
            const deleteBtn = document.getElementById('confirmDeleteBtn');
            const deleteSpinner = document.getElementById('deleteSpinner');
            deleteBtn.disabled = false;
            deleteSpinner.classList.add('d-none');
        }
    }
    
    /**
     * Lưu người dùng (thêm mới hoặc cập nhật)
     */
    async function saveUser() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Lấy dữ liệu từ form
            const userId = document.getElementById('userId').value;
            const fullName = document.getElementById('fullName').value.trim();
            const email = document.getElementById('email').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const role = document.getElementById('userRole').value;
            const status = document.getElementById('userStatus').value;
            const password = document.getElementById('password').value;
            const adminKey = document.getElementById('adminKey').value;
            const mechanicSkills = document.getElementById('mechanicSkills').value;
            
            // Kiểm tra dữ liệu
            if (!fullName) {
                showErrorMessage('Vui lòng nhập họ và tên');
                return;
            }
            
            if (!email) {
                showErrorMessage('Vui lòng nhập email');
                return;
            }
            
            if (!phone) {
                showErrorMessage('Vui lòng nhập số điện thoại');
                return;
            }
            
            if (!role) {
                showErrorMessage('Vui lòng chọn vai trò');
                return;
            }
            
            // Kiểm tra mật khẩu cho người dùng mới
            if (!isEditMode && !password) {
                showErrorMessage('Vui lòng nhập mật khẩu');
                return;
            }
            
            // Kiểm tra độ dài mật khẩu nếu có
            if (password && password.length < 6) {
                showErrorMessage('Mật khẩu phải có ít nhất 6 ký tự');
                return;
            }
            
            // Kiểm tra mã xác thực Admin nếu vai trò là Admin
            if (role === '1' && !isEditMode && !adminKey) {
                showErrorMessage('Vui lòng nhập mã xác thực Admin');
                return;
            }
            
            // Hiển thị trạng thái đang lưu
            const saveBtn = document.getElementById('saveUserBtn');
            const saveSpinner = document.getElementById('saveSpinner');
            saveBtn.disabled = true;
            saveSpinner.classList.remove('d-none');
            
            // Chuẩn bị dữ liệu
            const userData = {
                fullName,
                email,
                phone,
                role: parseInt(role),
                status: parseInt(status)
            };
            
            // Thêm mật khẩu nếu có
            if (password) {
                userData.password = password;
            }
            
            // Thêm mã xác thực admin nếu cần
            if (role === '1' && adminKey) {
                userData.adminKey = adminKey;
            }
            
            // Thêm kỹ năng thợ nếu áp dụng
            if (role === '3' && mechanicSkills) {
                userData.mechanicSkills = mechanicSkills;
            }
            
            let response;
            
            if (isEditMode) {
                // Cập nhật người dùng đã có
                response = await fetch(`${API_BASE_URL}/users/${userId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(userData)
                });
            } else {
                // Tạo người dùng mới
                response = await fetch(`${API_BASE_URL}/users`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(userData)
                });
            }
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Đóng modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('userModal'));
                modal.hide();
                
                // Hiển thị thông báo thành công
                showSuccessMessage(isEditMode ? 'Cập nhật người dùng thành công' : 'Thêm người dùng mới thành công');
                
                // Tải lại danh sách người dùng
                loadUsers();
                loadUserStats();
            } else {
                throw new Error(data.message || 'Không thể lưu người dùng');
            }
            
        } catch (error) {
            console.error('Lỗi khi lưu người dùng:', error);
            showErrorMessage('Không thể lưu người dùng: ' + error.message);
        } finally {
            // Khôi phục trạng thái nút
            const saveBtn = document.getElementById('saveUserBtn');
            const saveSpinner = document.getElementById('saveSpinner');
            saveBtn.disabled = false;
            saveSpinner.classList.add('d-none');
        }
    }
    
    /**
     * Áp dụng bộ lọc cho danh sách người dùng
     */
    function applyFilters() {
        const roleFilter = document.getElementById('roleFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        const searchFilter = document.getElementById('searchUser').value.trim();
        
        // Nếu sử dụng DataTables và chỉ cần lọc trong dữ liệu hiện có (không gọi API)
        if ($.fn.DataTable && $.fn.DataTable.isDataTable('#usersTable')) {
            const dataTable = $('#usersTable').DataTable();
            
            // Xóa các bộ lọc hiện tại
            dataTable.search('').columns().search('').draw();
            
            // Áp dụng bộ lọc mới
            if (searchFilter) {
                dataTable.search(searchFilter);
            }
            
            // Áp dụng bộ lọc vai trò (cột thứ 4)
            if (roleFilter) {
                // Tìm theo văn bản hiển thị trong cột vai trò
                let roleText = '';
                switch (roleFilter) {
                    case '1': roleText = 'Quản trị viên'; break;
                    case '2': roleText = 'Khách hàng'; break;
                    case '3': roleText = 'Thợ sửa xe'; break;
                }
                dataTable.column(4).search(roleText);
            }
            
            // Áp dụng bộ lọc trạng thái (cột thứ 5)
            if (statusFilter) {
                // Tìm theo văn bản hiển thị trong cột trạng thái
                let statusText = statusFilter === '1' ? 'Hoạt động' : 'Bị khóa';
                dataTable.column(5).search(statusText);
            }
            
            // Vẽ lại bảng với các bộ lọc đã áp dụng
            dataTable.draw();
            return;
        }
        
        // Nếu không sử dụng DataTables hoặc muốn gọi API để lọc dữ liệu
        const filters = {};
        
        if (roleFilter) {
            filters.role = roleFilter;
        }
        
        if (statusFilter) {
            filters.status = statusFilter;
        }
        
        if (searchFilter) {
            filters.search = searchFilter;
        }
        
        // Gọi API để lấy dữ liệu đã lọc
        loadUsers(filters);
    }
    
/**
     * Lọc người dùng theo từ khóa tìm kiếm
     */
function filterUsers() {
    // Lấy giá trị hiện tại của các bộ lọc
    const roleFilter = document.getElementById('roleFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const searchTerm = this.value.toLowerCase().trim();
    
    // Nếu DataTables đang hoạt động, sử dụng chức năng tìm kiếm của nó
    if ($.fn.DataTable && $.fn.DataTable.isDataTable('#usersTable')) {
        const dataTable = $('#usersTable').DataTable();
        dataTable.search(searchTerm).draw();
        return;
    }
    
    // Tìm kiếm thủ công nếu không có DataTables
    if (!users || users.length === 0) {
        return;
    }
    
    // Lọc người dùng dựa trên tất cả các điều kiện
    const filteredUsers = users.filter(user => {
        // Lọc theo từ khóa tìm kiếm
        const matchesSearch = !searchTerm || 
            (user.FullName && user.FullName.toLowerCase().includes(searchTerm)) ||
            (user.Email && user.Email.toLowerCase().includes(searchTerm)) ||
            (user.PhoneNumber && user.PhoneNumber.includes(searchTerm));
        
        // Lọc theo vai trò
        const matchesRole = !roleFilter || user.RoleID === parseInt(roleFilter);
        
        // Lọc theo trạng thái
        const matchesStatus = !statusFilter || user.Status === parseInt(statusFilter);
        
        // Người dùng phải khớp với tất cả các điều kiện đã áp dụng
        return matchesSearch && matchesRole && matchesStatus;
    });
    
    // Hiển thị kết quả lọc
    renderUsersTable(filteredUsers);
}

/**
 * Toggle hiện/ẩn mật khẩu
 */
function togglePasswordVisibility(inputId, iconElement) {
    const input = document.getElementById(inputId);
    
    if (input.type === 'password') {
        input.type = 'text';
        iconElement.classList.remove('bi-eye');
        iconElement.classList.add('bi-eye-slash');
    } else {
        input.type = 'password';
        iconElement.classList.remove('bi-eye-slash');
        iconElement.classList.add('bi-eye');
    }
}

/**
 * Hiển thị thông báo lỗi
 */
function showErrorMessage(message) {
    const errorAlert = document.getElementById('errorAlert');
    const errorMessage = document.getElementById('errorMessage');
    
    errorMessage.textContent = message;
    errorAlert.style.display = 'block';
    
    // Tự động ẩn sau 5 giây
    setTimeout(() => {
        errorAlert.style.display = 'none';
    }, 5000);
}

/**
 * Hiển thị thông báo thành công
 */
function showSuccessMessage(message) {
    const successAlert = document.getElementById('successAlert');
    const successMessage = document.getElementById('successMessage');
    
    successMessage.textContent = message;
    successAlert.style.display = 'block';
    
    // Tự động ẩn sau 5 giây
    setTimeout(() => {
        successAlert.style.display = 'none';
    }, 5000);
}
});