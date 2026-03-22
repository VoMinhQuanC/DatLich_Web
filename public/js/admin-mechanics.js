// admin-mechanics.js - JavaScript cho trang quản lý kỹ thuật viên

document.addEventListener('DOMContentLoaded', function() {
    // Khai báo các biến và hằng số
    // Sử dụng API_CONFIG từ config.js (được load trước)
    const API_BASE_URL = window.API_CONFIG ? window.API_CONFIG.BASE_URL : 'http://localhost:3001/api';
    
    // Biến lưu trữ dữ liệu
    let mechanics = [];
    let selectedMechanicId = null;
    let isEditMode = false;
    let dataTable = null;
    
    // Kiểm tra xác thực admin
    checkAdminAuth();
    
    // Tải dữ liệu ban đầu
    loadMechanicsData();
    loadMechanicsStats();
    
    // Đăng ký sự kiện cho các nút
    document.getElementById('addMechanicBtn').addEventListener('click', openAddMechanicModal);
    document.getElementById('saveMechanicBtn').addEventListener('click', saveMechanic);
    document.getElementById('confirmDeleteBtn').addEventListener('click', deleteMechanic);
    document.getElementById('searchBtn').addEventListener('click', applyFilters);
    document.getElementById('resetBtn').addEventListener('click', resetSearch);
    document.getElementById('editFromDetailBtn').addEventListener('click', editFromDetail);
    document.getElementById('logout-link').addEventListener('click', logout);
    document.getElementById('dropdown-logout').addEventListener('click', logout);
    
    // Đăng ký sự kiện cho upload ảnh
    document.getElementById('profilePicUpload').addEventListener('change', handleProfileImageUpload);
    
    // Đăng ký sự kiện cho phím Enter trong ô tìm kiếm
    document.getElementById('searchName').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            applyFilters();
        }
    });
    
    // Đăng ký sự kiện input cho ô tìm kiếm để lọc trực tiếp
    document.getElementById('searchName').addEventListener('input', filterMechanics);

    // Đăng ký sự kiện cho bộ lọc trạng thái
    document.getElementById('statusFilter').addEventListener('change', function() {
        // Tự động lọc khi thay đổi trạng thái
        applyFilters();
    });

    /**
     * Kiểm tra xác thực admin
     */
    function checkAdminAuth() {
        const token = localStorage.getItem('token');
        const userInfo = localStorage.getItem('user');
        
        if (!token || !userInfo) {
            // Chưa đăng nhập, chuyển hướng đến trang đăng nhập
            window.location.href = 'login.html';
            return;
        }
        
        try {
            const user = JSON.parse(userInfo);
            
            // Kiểm tra quyền admin (RoleID = 1)
            if (user.role !== 1) {
                alert('Bạn không có quyền truy cập trang quản trị');
                window.location.href = 'index.html';
                return;
            }
            
            // Hiển thị tên admin
            document.getElementById('adminName').textContent = user.fullName || 'Admin';
            
            // Hiển thị avatar với chữ cái đầu tiên của tên
            const avatarElement = document.getElementById('avatarPlaceholder');
            if (avatarElement && user.fullName) {
                avatarElement.textContent = user.fullName.charAt(0).toUpperCase();
            }
            
        } catch (error) {
            console.error('Lỗi phân tích dữ liệu người dùng:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        }
    }
    
    /**
     * Tải danh sách kỹ thuật viên
     */
    async function loadMechanicsData() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Hiển thị trạng thái loading
            document.getElementById('mechanicsList').innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-3">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Đang tải...</span>
                        </div>
                        <p class="mt-2">Đang tải danh sách kỹ thuật viên...</p>
                    </td>
                </tr>
            `;
            
            // Gọi API để lấy danh sách kỹ thuật viên
            const response = await fetch(`${API_BASE_URL}/users?role=3`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                    // ✅ DEBUG: Check response structure
                    console.log('🔥 RAW RESPONSE:', JSON.stringify(data, null, 2));
                    console.log('🔥 data.leaveRequests exists?', !!data.leaveRequests);
                    console.log('🔥 data.pending exists?', !!data.pending);
                    
                mechanics = data.users || [];
                renderMechanicsTable(mechanics);
                
                // Cập nhật số lượng kỹ thuật viên trong thống kê
                document.getElementById('totalMechanics').textContent = mechanics.length;
            } else {
                throw new Error(data.message || 'Không thể tải danh sách kỹ thuật viên');
            }
            
        } catch (error) {
            console.error('Lỗi khi tải danh sách kỹ thuật viên:', error);
            showErrorMessage('Không thể tải danh sách kỹ thuật viên: ' + error.message);
            
            document.getElementById('mechanicsList').innerHTML = `
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
     * Tải thống kê kỹ thuật viên
     */
    async function loadMechanicsStats() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Gọi API để lấy thống kê
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
                    // ✅ DEBUG: Check response structure
                    console.log('🔥 RAW RESPONSE:', JSON.stringify(data, null, 2));
                    console.log('🔥 data.leaveRequests exists?', !!data.leaveRequests);
                    console.log('🔥 data.pending exists?', !!data.pending);
                    
                // Cập nhật thống kê
                document.getElementById('totalMechanics').textContent = data.stats.totalMechanics || 0;
            }
            
        } catch (error) {
            console.error('Lỗi khi tải thống kê kỹ thuật viên:', error);
        }
    }
    
    /**
     * Hiển thị danh sách kỹ thuật viên vào bảng
     */
    function renderMechanicsTable(mechanicsData) {
        const tableBody = document.getElementById('mechanicsList');
        
        if (!mechanicsData || mechanicsData.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">Không có kỹ thuật viên nào</td>
                </tr>
            `;
            
            // Nếu đang sử dụng DataTable, hủy và khởi tạo lại với dữ liệu trống
            if ($.fn.DataTable.isDataTable('#mechanicsTable')) {
                $('#mechanicsTable').DataTable().destroy();
                dataTable = null;
            }
            
            // Khởi tạo DataTable mới
            initializeDataTable();
            return;
        }
        
        let html = '';
        
        mechanicsData.forEach(mechanic => {
            // Tạo ảnh đại diện
            const profileImage = mechanic.ProfilePicture 
                ? `<img src="${mechanic.ProfilePicture}" alt="${mechanic.FullName}" class="mechanic-avatar">`
                : `<div class="mechanic-avatar-placeholder">${mechanic.FullName.charAt(0)}</div>`;
            
            // Tạo badge trạng thái
            const statusBadge = mechanic.Status === 1 
                ? '<span class="badge bg-success">Đang hoạt động</span>'
                : '<span class="badge bg-danger">Không hoạt động</span>';
            
            html += `
                <tr>
                    <td>${mechanic.UserID}</td>
                    <td>${profileImage}</td>
                    <td>${mechanic.FullName}</td>
                    <td>${mechanic.Email}</td>
                    <td>${mechanic.PhoneNumber}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <div class="d-flex gap-1">
                            <button class="btn btn-sm btn-info action-btn" onclick="viewMechanicDetail(${mechanic.UserID})" title="Xem chi tiết">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-primary action-btn" onclick="editMechanic(${mechanic.UserID})" title="Chỉnh sửa">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-danger action-btn" onclick="confirmDeleteMechanic(${mechanic.UserID}, '${mechanic.FullName}')" title="Xóa">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html;
        
        // Nếu đang sử dụng DataTable, hủy và khởi tạo lại
        if ($.fn.DataTable.isDataTable('#mechanicsTable')) {
            $('#mechanicsTable').DataTable().destroy();
            dataTable = null;
        }
        
        // Khởi tạo DataTable mới
        initializeDataTable();
        
        // Đặt các hàm xử lý sự kiện cho các nút thao tác ra global để có thể gọi từ onclick
        window.viewMechanicDetail = viewMechanicDetail;
        window.editMechanic = editMechanic;
        window.confirmDeleteMechanic = confirmDeleteMechanic;
        
        // Kiểm tra và áp dụng lại bộ lọc nếu có
        const statusFilter = document.getElementById('statusFilter').value;
        const searchTerm = document.getElementById('searchName').value.trim();
        
        if (statusFilter || searchTerm) {
            applyFilters();
        }
    }
    
    /**
     * Khởi tạo DataTable với cấu hình chuẩn
     */
    function initializeDataTable() {
        if ($.fn.DataTable) {
            dataTable = $('#mechanicsTable').DataTable({
                language: {
                    url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/vi.json'
                },
                pageLength: 10,
                lengthMenu: [10, 25, 50, 100],
                responsive: true,
                dom: 'lrtip', // Bỏ thanh tìm kiếm mặc định của DataTable
                columnDefs: [
                    // Vô hiệu hóa sắp xếp cho cột hình ảnh (1) và thao tác (6)
                    { orderable: false, targets: [1, 6] },
                    // Định nghĩa các cột tìm kiếm chính xác (đối với cột trạng thái)
                    { searchable: true, targets: [5] }
                ],
                drawCallback: function() {
                    // Cập nhật thông tin hiển thị số lượng bản ghi
                    const api = this.api();
                    const pageInfo = api.page.info();
                    
                    // Hiển thị thông tin số bản ghi nếu không phải là toàn bộ danh sách
                    if (pageInfo.recordsDisplay !== mechanics.length) {
                        updateResultsCount(pageInfo.recordsDisplay);
                    } else {
                        // Ẩn thông tin nếu hiển thị tất cả
                        const resultsInfoElement = document.getElementById('resultsInfo');
                        if (resultsInfoElement) {
                            resultsInfoElement.style.display = 'none';
                        }
                    }
                }
            });
            
            // Lưu tham chiếu DataTable vào biến toàn cục để sử dụng trong các hàm lọc
            window.mechanicsDataTable = dataTable;
        }
    }
    
    /**
     * Mở modal thêm kỹ thuật viên mới
     */
    function openAddMechanicModal() {
        // Reset form
        document.getElementById('mechanicForm').reset();
        document.getElementById('mechanicModalTitle').textContent = "Thêm kỹ thuật viên mới";
        document.getElementById('mechanicId').value = "";
        document.getElementById('passwordRequired').style.display = 'inline'; // Hiển thị dấu * cho mật khẩu là bắt buộc
        document.getElementById('profileImage').src = "images/avatar-placeholder.jpg";
        
        // Reset các trường ẩn khác
        document.getElementById('certificationsInput').value = '';
        
        // Đánh dấu là thêm mới
        isEditMode = false;
        selectedMechanicId = null;
        
        // Hiện modal
        const modal = new bootstrap.Modal(document.getElementById('mechanicModal'));
        modal.show();
    }
    
    /**
     * Xem chi tiết kỹ thuật viên
     */
    async function viewMechanicDetail(id) {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            selectedMechanicId = id;
            
            // Lấy thông tin chi tiết của kỹ thuật viên từ API
            const response = await fetch(`${API_BASE_URL}/users/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                    // ✅ DEBUG: Check response structure
                    console.log('🔥 RAW RESPONSE:', JSON.stringify(data, null, 2));
                    console.log('🔥 data.leaveRequests exists?', !!data.leaveRequests);
                    console.log('🔥 data.pending exists?', !!data.pending);
                    
                const mechanic = data.user;
                
                // Cập nhật thông tin trong modal
                document.getElementById('detailFullName').textContent = mechanic.FullName;
                document.getElementById('detailEmail').textContent = mechanic.Email;
                document.getElementById('detailPhone').textContent = mechanic.PhoneNumber;
                
                // Cập nhật ảnh đại diện
                if (mechanic.ProfilePicture) {
                    document.getElementById('detailProfileImage').src = mechanic.ProfilePicture;
                } else {
                    document.getElementById('detailProfileImage').src = "images/avatar-placeholder.jpg";
                }
                
                // Cập nhật trạng thái
                const statusElement = document.getElementById('detailStatus');
                if (mechanic.Status === 1) {
                    statusElement.textContent = 'Đang hoạt động';
                    statusElement.className = 'badge bg-success';
                } else {
                    statusElement.textContent = 'Không hoạt động';
                    statusElement.className = 'badge bg-danger';
                }
                
                // Cập nhật chuyên môn
                document.getElementById('detailSpecialization').textContent = 'Chuyên môn: ' + (mechanic.Specialization || 'Chưa cập nhật');
                
                // Cập nhật kinh nghiệm
                document.getElementById('detailExperience').textContent = mechanic.Experience ? `${mechanic.Experience} năm` : 'Chưa cập nhật';
                
                // Cập nhật chứng chỉ
                const certContainer = document.getElementById('detailCertifications');
                if (mechanic.Certifications && mechanic.Certifications.length > 0) {
                    let certHtml = '';
                    mechanic.Certifications.forEach(cert => {
                        certHtml += `<span class="badge bg-secondary me-1 mb-1">${cert}</span>`;
                    });
                    certContainer.innerHTML = certHtml;
                } else {
                    certContainer.innerHTML = '<span class="text-muted">Chưa có chứng chỉ</span>';
                }
                
                // Cập nhật số lượng công việc
                document.getElementById('detailPendingJobs').textContent = mechanic.PendingAppointments || 0;
                
                // Cập nhật ghi chú
                document.getElementById('detailNotes').textContent = mechanic.Notes || 'Không có ghi chú';
                
                // Hiện modal
                const modal = new bootstrap.Modal(document.getElementById('mechanicDetailModal'));
                modal.show();
                
            } else {
                throw new Error(data.message || 'Không thể tải thông tin kỹ thuật viên');
            }
            
        } catch (error) {
            console.error('Lỗi khi tải thông tin chi tiết kỹ thuật viên:', error);
            showErrorMessage('Không thể tải thông tin chi tiết: ' + error.message);
        }
    }
    
    /**
     * Mở modal chỉnh sửa từ modal chi tiết
     */
    function editFromDetail() {
        // Đóng modal chi tiết
        const detailModal = bootstrap.Modal.getInstance(document.getElementById('mechanicDetailModal'));
        detailModal.hide();
        
        // Mở modal chỉnh sửa
        editMechanic(selectedMechanicId);
    }
    
    /**
     * Chỉnh sửa kỹ thuật viên
     */
    async function editMechanic(id) {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            selectedMechanicId = id;
            
            // Tìm thông tin kỹ thuật viên trong danh sách
            let mechanicInfo = mechanics.find(m => m.UserID === id);
            
            if (!mechanicInfo) {
                // Nếu không tìm thấy trong danh sách, lấy từ API
                const response = await fetch(`${API_BASE_URL}/users/${id}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Lỗi HTTP: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.success) {
                    // ✅ DEBUG: Check response structure
                    console.log('🔥 RAW RESPONSE:', JSON.stringify(data, null, 2));
                    console.log('🔥 data.leaveRequests exists?', !!data.leaveRequests);
                    console.log('🔥 data.pending exists?', !!data.pending);
                    
                    mechanicInfo = data.user;
                } else {
                    throw new Error(data.message || 'Không thể tải thông tin kỹ thuật viên');
                }
            }
            
            // Đánh dấu là chế độ chỉnh sửa
            isEditMode = true;
            
            // Cập nhật tiêu đề modal
            document.getElementById('mechanicModalTitle').textContent = "Chỉnh sửa kỹ thuật viên";
            
            // Điền thông tin vào form
            document.getElementById('mechanicId').value = mechanicInfo.UserID;
            document.getElementById('fullName').value = mechanicInfo.FullName;
            document.getElementById('email').value = mechanicInfo.Email;
            document.getElementById('phoneNumber').value = mechanicInfo.PhoneNumber;
            document.getElementById('status').value = mechanicInfo.Status;
            
            // Mật khẩu không bắt buộc khi chỉnh sửa
            document.getElementById('password').value = '';
            document.getElementById('passwordRequired').style.display = 'none';
            
            // Điền thông tin thêm nếu có
            if (mechanicInfo.Specialization) {
                document.getElementById('specialization').value = mechanicInfo.Specialization;
            }
            
            if (mechanicInfo.Experience !== undefined) {
                document.getElementById('experience').value = mechanicInfo.Experience;
            }
            
            if (mechanicInfo.Notes) {
                document.getElementById('notes').value = mechanicInfo.Notes;
            }
            
            // Cập nhật chứng chỉ
            if (mechanicInfo.Certifications && Array.isArray(mechanicInfo.Certifications)) {
                document.getElementById('certificationsInput').value = mechanicInfo.Certifications.join(', ');
            }
            
            // Cập nhật ảnh đại diện
            if (mechanicInfo.ProfilePicture) {
                document.getElementById('profileImage').src = mechanicInfo.ProfilePicture;
            } else {
                document.getElementById('profileImage').src = "images/avatar-placeholder.jpg";
            }
            
            // Hiện modal
            const modal = new bootstrap.Modal(document.getElementById('mechanicModal'));
            modal.show();
            
        } catch (error) {
            console.error('Lỗi khi tải thông tin kỹ thuật viên để chỉnh sửa:', error);
            showErrorMessage('Không thể tải thông tin kỹ thuật viên: ' + error.message);
        }
    }
    
    /**
     * Xử lý tải lên ảnh đại diện
     */
    function handleProfileImageUpload(event) {
        const file = event.target.files[0];
        
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                showErrorMessage('Kích thước ảnh tối đa là 5MB');
                return;
            }
            
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
            if (!allowedTypes.includes(file.type)) {
                showErrorMessage('Định dạng ảnh không hỗ trợ. Vui lòng sử dụng JPEG, PNG hoặc GIF');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('profileImage').src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }
    
    /**
     * Hiển thị hộp thoại xác nhận xóa kỹ thuật viên
     */
    function confirmDeleteMechanic(id, name) {
        selectedMechanicId = id;
        document.getElementById('deleteMechanicName').textContent = name;
        
        // Hiện modal xác nhận
        const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
        modal.show();
    }
    
    /**
     * Áp dụng bộ lọc cho danh sách kỹ thuật viên
     */
    function applyFilters() {
        const statusFilter = document.getElementById('statusFilter').value;
        const searchTerm = document.getElementById('searchName').value.trim();
        
        // Sử dụng DataTables để lọc nếu có
        if (dataTable) {
            // Xóa tất cả bộ lọc
            dataTable.search('').columns().search('').draw();
            
            // Áp dụng bộ lọc từ khóa tìm kiếm
            if (searchTerm) {
                dataTable.search(searchTerm);
            }
            
            // Áp dụng bộ lọc trạng thái
            if (statusFilter) {
                // Tìm văn bản hiển thị cho trạng thái
                const statusText = statusFilter === '1' ? 'Đang hoạt động' : 'Không hoạt động';
                // Áp dụng lọc cho cột trạng thái (cột 5)
                dataTable.column(5).search(statusText);
            }
            
            // Vẽ lại bảng
            dataTable.draw();
            
            // Cập nhật thông tin số lượng kết quả
            updateResultsCount(dataTable.page.info().recordsDisplay);
            
            return;
        }
        
        // Lọc thủ công nếu không có DataTables
        let filteredMechanics = [...mechanics];
        
        // Lọc theo trạng thái
        if (statusFilter) {
            filteredMechanics = filteredMechanics.filter(mechanic => 
                mechanic.Status.toString() === statusFilter
            );
        }
        
        // Lọc theo từ khóa tìm kiếm
        if (searchTerm) {
            filteredMechanics = filteredMechanics.filter(mechanic => 
                (mechanic.FullName && mechanic.FullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (mechanic.Email && mechanic.Email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (mechanic.PhoneNumber && mechanic.PhoneNumber.includes(searchTerm))
            );
        }
        
        // Hiển thị kết quả
        renderMechanicsTable(filteredMechanics);
        
        // Cập nhật thông tin số lượng kết quả
        updateResultsCount(filteredMechanics.length);
        
        // Hiển thị thông báo kết quả
        if (filteredMechanics.length === 0) {
            showErrorMessage('Không tìm thấy kỹ thuật viên nào phù hợp với điều kiện tìm kiếm');
        } else if (searchTerm || statusFilter) {
            showSuccessMessage(`Tìm thấy ${filteredMechanics.length} kỹ thuật viên`);
        }
    }
    
    /**
     * Lọc kỹ thuật viên theo từ khóa tìm kiếm trực tiếp
     * Sự kiện này được kích hoạt khi người dùng nhập vào ô tìm kiếm
     */
    function filterMechanics() {
        const searchTerm = this.value.toLowerCase().trim();
        const statusFilter = document.getElementById('statusFilter').value;
        
        // Nếu DataTables đang hoạt động, sử dụng chức năng tìm kiếm của nó
        if (dataTable) {
            dataTable.search(searchTerm).draw();
            
            // Cập nhật hiển thị số lượng kết quả
            updateResultsCount(dataTable.page.info().recordsDisplay);
            return;
        }
        
        // Tìm kiếm thủ công nếu không có DataTables
        let filteredMechanics = [...mechanics];
        
        // Lọc theo trạng thái nếu đã chọn
        if (statusFilter) {
            filteredMechanics = filteredMechanics.filter(mechanic => 
                mechanic.Status.toString() === statusFilter
            );
        }
        
        // Lọc theo từ khóa tìm kiếm
        if (searchTerm) {
            filteredMechanics = filteredMechanics.filter(mechanic => {
                return (
                    (mechanic.FullName && mechanic.FullName.toLowerCase().includes(searchTerm)) ||
                    (mechanic.Email && mechanic.Email.toLowerCase().includes(searchTerm)) ||
                    (mechanic.PhoneNumber && mechanic.PhoneNumber.includes(searchTerm))
                );
            });
        }
        
        // Hiển thị kết quả lọc
        renderMechanicsTable(filteredMechanics);
        
        // Cập nhật thông tin số lượng kết quả
        updateResultsCount(filteredMechanics.length);
    }

    /**
     * Cập nhật và hiển thị số lượng kết quả tìm kiếm
     * @param {number} count Số lượng kết quả
     */
    function updateResultsCount(count) {
        const resultCountElement = document.getElementById('resultCount');
        const resultsInfoElement = document.getElementById('resultsInfo');
        
        if (resultCountElement && resultsInfoElement) {
            resultCountElement.textContent = count;
            
            if (count < mechanics.length) {
                // Nếu số lượng kết quả ít hơn tổng số, hiển thị thông tin
                resultsInfoElement.style.display = 'block';
            } else {
                // Nếu hiển thị tất cả, ẩn thông tin
                resultsInfoElement.style.display = 'none';
            }
        }
    }
    
    /**
     * Đặt lại bộ lọc tìm kiếm
     */
    function resetSearch() {
        document.getElementById('searchName').value = '';
        document.getElementById('statusFilter').value = '';
        
        // Nếu đang sử dụng DataTables, xóa tất cả bộ lọc
        if (dataTable) {
            dataTable.search('').columns().search('').draw();
        }
        
        // Ẩn thông tin số lượng kết quả
        const resultsInfoElement = document.getElementById('resultsInfo');
        if (resultsInfoElement) {
            resultsInfoElement.style.display = 'none';
        }
        
        // Hiển thị lại toàn bộ danh sách
        renderMechanicsTable(mechanics);
    }
    
    /**
     * Lưu thông tin kỹ thuật viên (Thêm mới hoặc cập nhật)
     */
    async function saveMechanic() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Lấy dữ liệu từ form
            const fullName = document.getElementById('fullName').value;
            const email = document.getElementById('email').value;
            const phoneNumber = document.getElementById('phoneNumber').value;
            const password = document.getElementById('password').value;
            const status = document.getElementById('status').value;
            const specialization = document.getElementById('specialization').value;
            const experience = document.getElementById('experience').value;
            const notes = document.getElementById('notes').value;
            const certifications = document.getElementById('certificationsInput').value;
            const profileImage = document.getElementById('profileImage').src;
            
            // Validate dữ liệu
            if (!fullName) {
                showErrorMessage('Vui lòng nhập họ và tên');
                return;
            }
            
            if (!email) {
                showErrorMessage('Vui lòng nhập email');
                return;
            }
            
            if (!phoneNumber) {
                showErrorMessage('Vui lòng nhập số điện thoại');
                return;
            }
            
            if (!isEditMode && !password) {
                showErrorMessage('Vui lòng nhập mật khẩu');
                return;
            }
            
            // Hiển thị spinner và vô hiệu hóa nút
            const saveBtn = document.getElementById('saveMechanicBtn');
            const saveSpinner = document.getElementById('saveSpinner');
            saveBtn.disabled = true;
            saveSpinner.classList.remove('d-none');
            
            // Chuẩn bị dữ liệu
            const mechanicData = {
                fullName,
                email,
                phone: phoneNumber,
                status: parseInt(status),
                role: 3, // Role ID 3 = Kỹ thuật viên
                specialization,
                experience: experience ? parseInt(experience) : null,
                notes
            };
            
            // Thêm mật khẩu nếu có
            if (password) {
                mechanicData.password = password;
            }
            
            // Thêm chứng chỉ nếu có
            if (certifications) {
                mechanicData.certifications = certifications.split(',').map(cert => cert.trim()).filter(cert => cert);
            }
            
            // Thêm ảnh đại diện nếu có
            if (profileImage && !profileImage.includes('avatar-placeholder.jpg')) {
                mechanicData.profilePicture = profileImage;
            }
            
            let response;
            
            if (isEditMode) {
                // Cập nhật kỹ thuật viên
                response = await fetch(`${API_BASE_URL}/users/${selectedMechanicId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(mechanicData)
                });
            } else {
                // Thêm kỹ thuật viên mới
                response = await fetch(`${API_BASE_URL}/users`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(mechanicData)
                });
            }
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                // Đóng modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('mechanicModal'));
                modal.hide();
                
                // Hiển thị thông báo thành công
                showSuccessMessage(isEditMode ? 'Cập nhật kỹ thuật viên thành công' : 'Thêm kỹ thuật viên mới thành công');
                
                // Tải lại danh sách kỹ thuật viên
                loadMechanicsData();
                loadMechanicsStats();
                
            } else {
                throw new Error(result.message || 'Không thể lưu thông tin kỹ thuật viên');
            }
            
        } catch (error) {
            console.error('Lỗi khi lưu thông tin kỹ thuật viên:', error);
            showErrorMessage('Không thể lưu thông tin kỹ thuật viên: ' + error.message);
        } finally {
            // Khôi phục trạng thái nút
            const saveBtn = document.getElementById('saveMechanicBtn');
            const saveSpinner = document.getElementById('saveSpinner');
            saveBtn.disabled = false;
            saveSpinner.classList.add('d-none');
        }
    }
    
    /**
     * Xóa kỹ thuật viên
     */
    async function deleteMechanic() {
        if (!selectedMechanicId) {
            showErrorMessage('Không có kỹ thuật viên nào được chọn để xóa');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Hiển thị spinner và vô hiệu hóa nút
            const deleteBtn = document.getElementById('confirmDeleteBtn');
            const deleteSpinner = document.getElementById('deleteSpinner');
            deleteBtn.disabled = true;
            deleteSpinner.classList.remove('d-none');
            
            // Gọi API xóa kỹ thuật viên
            const response = await fetch(`${API_BASE_URL}/users/${selectedMechanicId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                // Đóng modal xác nhận
                const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
                modal.hide();
                
                // Hiển thị thông báo thành công
                showSuccessMessage('Xóa kỹ thuật viên thành công');
                
                // Tải lại danh sách kỹ thuật viên
                loadMechanicsData();
                loadMechanicsStats();
                
            } else {
                throw new Error(result.message || 'Không thể xóa kỹ thuật viên');
            }
            
        } catch (error) {
            console.error('Lỗi khi xóa kỹ thuật viên:', error);
            showErrorMessage('Không thể xóa kỹ thuật viên: ' + error.message);
        } finally {
            // Khôi phục trạng thái nút
            const deleteBtn = document.getElementById('confirmDeleteBtn');
            const deleteSpinner = document.getElementById('deleteSpinner');
            deleteBtn.disabled = false;
            deleteSpinner.classList.add('d-none');
        }
    }
    
    /**
     * Đăng xuất
     */
    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
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
    
    // =====================================================
    // QUẢN LÝ ĐƠN (XIN SỬA LỊCH + XIN NGHỈ)
    // =====================================================
    
    let leaveRequests = {
        pending: [],
        approved: [],
        rejected: []
    };
    
    // Filter theo loại đơn: 'all' | 'edit' | 'leave'
    let requestTypeFilter = 'all';
    
    // Đăng ký sự kiện cho nút quản lý đơn
    document.getElementById('manageLeaveBtn').addEventListener('click', openLeaveRequestModal);
    // Click vào card xin nghỉ → mở modal với filter = 'leave'
    document.getElementById('leaveRequestCard').addEventListener('click', function() {
        openLeaveRequestModalWithFilter('leave');
    });
    // Click vào card xin sửa lịch → mở modal với filter = 'edit'
    const editCard = document.getElementById('editRequestCard');
    if (editCard) {
        editCard.addEventListener('click', function() {
            openLeaveRequestModalWithFilter('edit');
        });
    }
    document.getElementById('filterLeaveBtn').addEventListener('click', filterLeaveRequests);
    document.getElementById('resetLeaveFilterBtn').addEventListener('click', resetLeaveFilter);
    
    // Set default date range (30 ngày gần nhất)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    document.getElementById('leaveToDate').value = today.toISOString().split('T')[0];
    document.getElementById('leaveFromDate').value = thirtyDaysAgo.toISOString().split('T')[0];
    
    // Load thống kê đơn khi trang load
    loadLeaveRequestStats();
    
    // Đổi text button từ "Đơn xin nghỉ" thành "Quản lý đơn"
    const manageBtnEl = document.getElementById('manageLeaveBtn');
    if (manageBtnEl) {
        manageBtnEl.innerHTML = '<i class="bi bi-folder2-open me-1"></i> Quản lý đơn <span class="badge bg-danger ms-1" id="leaveRequestBadge" style="display: none;">0</span>';
    }
    
    // Đổi title của modal
    const modalTitle = document.querySelector('#leaveRequestModal .modal-title');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="bi bi-folder2-open me-2"></i>Quản lý đơn xin phép';
    }
    
    /**
     * Mở modal với filter cụ thể
     */
    function openLeaveRequestModalWithFilter(filterType) {
        requestTypeFilter = filterType;
        injectRequestTypeFilterButtons();
        
        // Cập nhật UI buttons
        setTimeout(() => {
            const buttons = document.querySelectorAll('#requestTypeFilterContainer .btn');
            buttons.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.filter === filterType) {
                    btn.classList.add('active');
                }
            });
        }, 100);
        
        loadAllLeaveRequests();
        const modal = new bootstrap.Modal(document.getElementById('leaveRequestModal'));
        modal.show();
    }
    
    /**
     * Mở modal quản lý đơn (hiển thị tất cả)
     */
    function openLeaveRequestModal() {
        // Reset filter về 'all'
        requestTypeFilter = 'all';
        
        // Inject filter buttons nếu chưa có
        injectRequestTypeFilterButtons();
        
        loadAllLeaveRequests();
        const modal = new bootstrap.Modal(document.getElementById('leaveRequestModal'));
        modal.show();
    }
    
    /**
     * Inject filter buttons vào modal header
     */
    function injectRequestTypeFilterButtons() {
        const filterContainer = document.getElementById('requestTypeFilterContainer');
        if (filterContainer) return; // Đã có rồi
        
        // Tìm vị trí để chèn (sau card thống kê)
        const statsCard = document.querySelector('#leaveRequestModal .card.bg-light');
        if (!statsCard) return;
        
        const filterHTML = `
            <div id="requestTypeFilterContainer" class="mt-3 mb-2">
                <div class="btn-group w-100" role="group">
                    <button type="button" class="btn btn-outline-secondary active" data-filter="all" onclick="filterByRequestType('all')">
                        <i class="bi bi-list-ul me-1"></i>Tất cả
                    </button>
                    <button type="button" class="btn btn-outline-info" data-filter="edit" onclick="filterByRequestType('edit')">
                        <i class="bi bi-pencil-square me-1"></i>Xin sửa lịch
                        <span class="badge bg-info ms-1" id="editRequestCount">0</span>
                    </button>
                    <button type="button" class="btn btn-outline-warning" data-filter="leave" onclick="filterByRequestType('leave')">
                        <i class="bi bi-calendar-x me-1"></i>Xin nghỉ
                        <span class="badge bg-warning text-dark ms-1" id="leaveRequestCount">0</span>
                    </button>
                </div>
            </div>
        `;
        
        statsCard.insertAdjacentHTML('afterend', filterHTML);
    }
    
    /**
     * Filter theo loại đơn
     */
    window.filterByRequestType = function(type) {
        requestTypeFilter = type;
        
        // Cập nhật UI buttons
        const buttons = document.querySelectorAll('#requestTypeFilterContainer .btn');
        buttons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.filter === type) {
                btn.classList.add('active');
            }
        });
        
        // Re-render tables với filter mới
        renderPendingLeaveTable(leaveRequests.pending);
        renderApprovedLeaveTable(leaveRequests.approved);
        renderRejectedLeaveTable(leaveRequests.rejected);
        
        // Cập nhật tab counts
        updateTabCounts();
    };
    
    /**
     * Load thống kê đơn xin phép
     */
    async function loadLeaveRequestStats() {
        try {
            const token = localStorage.getItem('token');
            
            const response = await fetch(`${API_BASE_URL}/mechanics/leave-requests/stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.success) {
                    // ✅ DEBUG: Check response structure
                    console.log('🔥 RAW RESPONSE:', JSON.stringify(data, null, 2));
                    console.log('🔥 data.leaveRequests exists?', !!data.leaveRequests);
                    console.log('🔥 data.pending exists?', !!data.pending);
                    
                    // Số đơn xin nghỉ (riêng)
                    const pendingLeave = data.stats.pendingLeave || 0;
                    // Số đơn xin sửa lịch (riêng)
                    const pendingEdit = data.stats.pendingEdit || 0;
                    // Tổng đơn chờ duyệt
                    const totalPending = data.stats.pending || (pendingLeave + pendingEdit);
                    
                    // Cập nhật card "Đơn xin nghỉ"
                    document.getElementById('pendingLeaveCount').textContent = pendingLeave;
                    
                    // Cập nhật card "Đơn xin sửa lịch"
                    const editCountEl = document.getElementById('pendingEditCount');
                    if (editCountEl) {
                        editCountEl.textContent = pendingEdit;
                    }
                    
                    // Cập nhật KTV nghỉ hôm nay
                    document.getElementById('todayLeaveCount').textContent = data.stats.todayLeave || 0;
                    
                    // Cập nhật badge trên nút (tổng đơn chờ)
                    const badge = document.getElementById('leaveRequestBadge');
                    if (badge) {
                        if (totalPending > 0) {
                            badge.textContent = totalPending;
                            badge.style.display = 'inline';
                        } else {
                            badge.style.display = 'none';
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error loading leave request stats:', error);
        }
    }
    
    /**
     * Load tất cả đơn (xin sửa lịch + xin nghỉ)
     */
    async function loadAllLeaveRequests() {
        try {
            const token = localStorage.getItem('token');
            const fromDate = document.getElementById('leaveFromDate').value;
            const toDate = document.getElementById('leaveToDate').value;
            
            let url = `${API_BASE_URL}/mechanics/leave-requests`;
            if (fromDate && toDate) {
                url += `?from=${fromDate}&to=${toDate}`;
            }
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.success) {
                    // ✅ DEBUG: Check response structure
                    console.log('🔥 RAW RESPONSE:', JSON.stringify(data, null, 2));
                    console.log('🔥 data.leaveRequests exists?', !!data.leaveRequests);
                    console.log('🔥 data.pending exists?', !!data.pending);
                    
                    leaveRequests = data.leaveRequests;
                    
                    // Debug: Log data để kiểm tra
                    console.log('Leave Requests Data:', leaveRequests);
                    console.log('Approved count:', leaveRequests.approved?.length || 0);
                    console.log('Approved data:', leaveRequests.approved);
                    
                    // ✅ DEBUG LOGS
                    console.log('🔍 DEBUG - Pending:', leaveRequests.pending);
                    console.log('🔍 DEBUG - Approved:', leaveRequests.approved);
                    console.log('🔍 DEBUG - First pending:', leaveRequests.pending?.[0]);
                    console.log('🔍 DEBUG - First approved:', leaveRequests.approved?.[0]);
                    
                    
                    // Đếm số đơn theo loại trong pending
                    const editPending = leaveRequests.pending.filter(r => isEditRequest(r)).length;
                    const leavePending = leaveRequests.pending.filter(r => !isEditRequest(r)).length;
                    
                    // Cập nhật filter counts (trong nút filter)
                    const editCountEl = document.getElementById('editRequestCount');
                    const leaveCountEl = document.getElementById('leaveRequestCount');
                    if (editCountEl) editCountEl.textContent = editPending;
                    if (leaveCountEl) leaveCountEl.textContent = leavePending;
                    
                    renderPendingLeaveTable(leaveRequests.pending);
                    renderApprovedLeaveTable(leaveRequests.approved);
                    renderRejectedLeaveTable(leaveRequests.rejected);
                    
                    // Cập nhật tab counts và thống kê (theo filter hiện tại)
                    updateTabCounts();
                }
            }
        } catch (error) {
            console.error('Error loading leave requests:', error);
            showErrorMessage('Không thể tải danh sách đơn');
        }
    }
    
    /**
     * Cập nhật tab counts dựa trên filter
     */
    function updateTabCounts() {
        const pendingFiltered = filterRequestsByType(leaveRequests.pending);
        const approvedFiltered = filterRequestsByType(leaveRequests.approved);
        const rejectedFiltered = filterRequestsByType(leaveRequests.rejected);
        
        document.getElementById('pendingTabCount').textContent = pendingFiltered.length;
        document.getElementById('approvedTabCount').textContent = approvedFiltered.length;
        document.getElementById('rejectedTabCount').textContent = rejectedFiltered.length;
        
        // Cập nhật thống kê theo filter
        updateStats(pendingFiltered.length, approvedFiltered.length, rejectedFiltered.length);
    }
    
    /**
     * Cập nhật thống kê theo filter hiện tại
     */
    function updateStats(pending, approved, rejected) {
        document.getElementById('statPending').textContent = pending;
        document.getElementById('statApproved').textContent = approved;
        document.getElementById('statRejected').textContent = rejected;
        
        // Cập nhật title thống kê theo filter
        const statsTitle = document.querySelector('#leaveRequestModal .card.bg-light h6');
        if (statsTitle) {
            if (requestTypeFilter === 'edit') {
                statsTitle.innerHTML = '<i class="bi bi-bar-chart me-2"></i>Thống kê đơn xin sửa lịch';
            } else if (requestTypeFilter === 'leave') {
                statsTitle.innerHTML = '<i class="bi bi-bar-chart me-2"></i>Thống kê đơn xin nghỉ';
            } else {
                statsTitle.innerHTML = '<i class="bi bi-bar-chart me-2"></i>Thống kê tất cả đơn';
            }
        }
    }
    
    /**
     * Filter requests theo loại đơn
     */
    /**
     * Kiểm tra đơn có phải là đơn xin sửa lịch không
     */
    function isEditRequest(req) {
        // ✅ GUARD CHECK
        if (!req) {
            console.warn('⚠️ isEditRequest called with undefined!');
            return false;
        }
        
        console.log('Checking:', req.ScheduleID, 'Type:', req.RequestType, 'Status:', req.Status);
        
        // Check RequestType first (backend trả về)
        if (req.RequestType === 'edit') return true;
        // Check Status cho đơn chờ duyệt
        if (req.Status === 'PendingEdit') return true;
        // Check Status cho đơn đã duyệt/từ chối
        if (req.Status === 'ApprovedEdit') return true;
        if (req.Status === 'RejectedEdit') return true;
        // Check OriginalRequestType (backup)
        if (req.OriginalRequestType === 'edit') return true;
        // Kiểm tra Notes có chứa editRequest không
        if (req.Notes) {
            try {
                const notes = JSON.parse(req.Notes);
                if (notes.editRequest) return true;
                // ✅ ALSO check notes.type
                if (notes.type === 'edit') return true;
            } catch (e) {
                // Notes không phải JSON, kiểm tra string
                if (req.Notes.includes('"editRequest"') || req.Notes.includes('editRequest')) return true;
                if (req.Notes.includes('"type":"edit"')) return true;
            }
        }
        return false;
    }
    
    
    function filterRequestsByType(requests) {
        if (requestTypeFilter === 'all') return requests;
        
        return requests.filter(req => {
            const isEdit = isEditRequest(req);
            if (requestTypeFilter === 'edit') return isEdit;
            if (requestTypeFilter === 'leave') return !isEdit;
            return true;
        });
    }
    
    /**
     * Render bảng đơn chờ duyệt (cả xin nghỉ và xin sửa)
     */
    function renderPendingLeaveTable(requests) {
        const tbody = document.getElementById('pendingLeaveBody');
        
        // Apply filter theo loại đơn
        const filteredRequests = filterRequestsByType(requests);
        
        if (!filteredRequests || filteredRequests.length === 0) {
            const filterMsg = requestTypeFilter === 'edit' ? 'xin sửa lịch' : 
                             requestTypeFilter === 'leave' ? 'xin nghỉ' : '';
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                        <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                        Không có đơn ${filterMsg} nào đang chờ duyệt
                    </td>
                </tr>
            `;
            return;
        }
        
        let html = '';
        filteredRequests.forEach(req => {
            const workDate = new Date(req.WorkDate).toLocaleDateString('vi-VN');
            const startTime = formatTime(req.StartTime);
            const endTime = formatTime(req.EndTime);
            const createdAt = req.CreatedAt ? new Date(req.CreatedAt).toLocaleDateString('vi-VN') : '--';
            
            // Xác định loại đơn
            const isEditReq = isEditRequest(req);
            
            // Parse thông tin xin sửa nếu có
            let editInfo = null;
            const notesDisplay = parseRequestReason(req.Notes);
            
            if (isEditReq && req.Notes) {
                try {
                    const notesData = JSON.parse(req.Notes);
                    if (notesData.editRequest) {
                        editInfo = notesData.editRequest;
                    }
                } catch (e) {
                    // Notes không phải JSON, giữ nguyên
                }
            }
            
            // Badge loại đơn
            const typeBadge = isEditReq 
                ? '<span class="badge bg-info me-1"><i class="bi bi-pencil-square"></i> Xin sửa</span>'
                : '<span class="badge bg-warning text-dark me-1"><i class="bi bi-calendar-x"></i> Xin nghỉ</span>';
            
            // Hiển thị thông tin sửa nếu có
            let editInfoHtml = '';
            if (editInfo) {
                const newDate = new Date(editInfo.newWorkDate).toLocaleDateString('vi-VN');
                editInfoHtml = `
                    <div class="mt-1 small">
                        <span class="text-muted">Đổi sang:</span>
                        <span class="badge bg-info">${newDate}</span>
                        <span class="text-muted">${editInfo.newStartTime} - ${editInfo.newEndTime}</span>
                    </div>
                `;
            }
            
            html += `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="mechanic-avatar-placeholder me-2 ${isEditReq ? 'bg-info' : ''}">${req.MechanicName ? req.MechanicName.charAt(0).toUpperCase() : 'K'}</div>
                            <div>
                                <strong>${req.MechanicName || 'N/A'}</strong>
                                <br><small class="text-muted">${req.Phone || ''}</small>
                            </div>
                        </div>
                    </td>
                    <td>
                        ${typeBadge}
                        <span class="badge bg-light text-dark">${workDate}</span>
                        ${editInfoHtml}
                    </td>
                    <td>${startTime} - ${endTime}</td>
                    <td>
                        <span class="text-truncate d-inline-block" style="max-width: 200px;" title="${notesDisplay}">
                            ${notesDisplay}
                        </span>
                    </td>
                    <td>${createdAt}</td>
                    <td>
                        <button class="btn btn-sm btn-success me-1" onclick="approveLeaveRequest(${req.ScheduleID}, ${isEditReq})" title="Duyệt">
                            <i class="bi bi-check-lg"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="rejectLeaveRequest(${req.ScheduleID}, ${isEditReq})" title="Từ chối">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    }
    
    /**
     * Render bảng đơn đã duyệt
     */
    function renderApprovedLeaveTable(requests) {
        const tbody = document.getElementById('approvedLeaveBody');
        
        // Apply filter theo loại đơn
        const filteredRequests = filterRequestsByType(requests);
        
        if (!filteredRequests || filteredRequests.length === 0) {
            const filterMsg = requestTypeFilter === 'edit' ? 'xin sửa lịch' : 
                             requestTypeFilter === 'leave' ? 'xin nghỉ' : '';
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                        <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                        Không có đơn ${filterMsg} nào đã được duyệt
                    </td>
                </tr>
            `;
            return;
        }
        
        let html = '';
        filteredRequests.forEach(req => {
            const workDate = new Date(req.WorkDate).toLocaleDateString('vi-VN');
            const startTime = formatTime(req.StartTime);
            const endTime = formatTime(req.EndTime);
            const updatedAt = req.UpdatedAt ? new Date(req.UpdatedAt).toLocaleDateString('vi-VN') : '--';
            
            // Xác định loại đơn
            const isEditReq = isEditRequest(req);
            const notesDisplay = parseRequestReason(req.Notes);
            
            // Badge loại đơn
            const typeBadge = isEditReq 
                ? '<span class="badge bg-info me-1"><i class="bi bi-pencil-square"></i> Xin sửa</span>'
                : '<span class="badge bg-warning text-dark me-1"><i class="bi bi-calendar-x"></i> Xin nghỉ</span>';
            
            html += `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="mechanic-avatar-placeholder me-2 ${isEditReq ? 'bg-info' : 'bg-success'}">${req.MechanicName ? req.MechanicName.charAt(0).toUpperCase() : 'K'}</div>
                            <div>
                                <strong>${req.MechanicName || 'N/A'}</strong>
                                <br><small class="text-muted">${req.Phone || ''}</small>
                            </div>
                        </div>
                    </td>
                    <td>
                        ${typeBadge}
                        <span class="badge bg-success">${workDate}</span>
                    </td>
                    <td>${startTime} - ${endTime}</td>
                    <td>
                        <span class="text-truncate d-inline-block" style="max-width: 200px;" title="${notesDisplay}">
                            ${notesDisplay}
                        </span>
                    </td>
                    <td>${updatedAt}</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    }
    
    /**
     * Render bảng đơn đã từ chối
     */
    function renderRejectedLeaveTable(requests) {
        const tbody = document.getElementById('rejectedLeaveBody');
        
        // Apply filter theo loại đơn
        const filteredRequests = filterRequestsByType(requests);
        
        if (!filteredRequests || filteredRequests.length === 0) {
            const filterMsg = requestTypeFilter === 'edit' ? 'xin sửa lịch' : 
                             requestTypeFilter === 'leave' ? 'xin nghỉ' : '';
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                        <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                        Không có đơn ${filterMsg} nào bị từ chối
                    </td>
                </tr>
            `;
            return;
        }
        
        let html = '';
        filteredRequests.forEach(req => {
            const workDate = new Date(req.WorkDate).toLocaleDateString('vi-VN');
            const startTime = formatTime(req.StartTime);
            const endTime = formatTime(req.EndTime);
            const updatedAt = req.UpdatedAt ? new Date(req.UpdatedAt).toLocaleDateString('vi-VN') : '--';
            
            // Xác định loại đơn
            const isEditReq = isEditRequest(req);
            const notesDisplay = parseRequestReason(req.Notes);
            
            // Badge loại đơn
            const typeBadge = isEditReq 
                ? '<span class="badge bg-info me-1"><i class="bi bi-pencil-square"></i> Xin sửa</span>'
                : '<span class="badge bg-warning text-dark me-1"><i class="bi bi-calendar-x"></i> Xin nghỉ</span>';
            
            html += `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="mechanic-avatar-placeholder me-2 ${isEditReq ? 'bg-info' : 'bg-danger'}">${req.MechanicName ? req.MechanicName.charAt(0).toUpperCase() : 'K'}</div>
                            <div>
                                <strong>${req.MechanicName || 'N/A'}</strong>
                                <br><small class="text-muted">${req.Phone || ''}</small>
                            </div>
                        </div>
                    </td>
                    <td>
                        ${typeBadge}
                        <span class="badge bg-danger">${workDate}</span>
                    </td>
                    <td>${startTime} - ${endTime}</td>
                    <td>
                        <span class="text-truncate d-inline-block" style="max-width: 200px;" title="${notesDisplay}">
                            ${notesDisplay}
                        </span>
                    </td>
                    <td>${updatedAt}</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    }
    
    /**
     * Format time từ ISO hoặc HH:MM:SS
     */
    function formatTime(timeStr) {
        if (!timeStr) return '--:--';
        
        if (timeStr.includes('T')) {
            return new Date(timeStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        }
        
        return timeStr.substring(0, 5);
    }
    
    /**
     * Duyệt đơn xin nghỉ / xin sửa lịch
     */
    window.approveLeaveRequest = async function(scheduleId, isEdit = false) {
        const requestType = isEdit ? 'xin sửa lịch' : 'xin nghỉ';
        const confirmMessage = `Bạn có chắc chắn muốn DUYỆT đơn ${requestType} này?`;
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            
            const response = await fetch(`${API_BASE_URL}/mechanics/schedules/${scheduleId}/approve`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                    // ✅ DEBUG: Check response structure
                    console.log('🔥 RAW RESPONSE:', JSON.stringify(data, null, 2));
                    console.log('🔥 data.leaveRequests exists?', !!data.leaveRequests);
                    console.log('🔥 data.pending exists?', !!data.pending);
                    
                const successMessage = isEdit 
                    ? 'Đã duyệt đơn xin sửa lịch thành công!' 
                    : 'Đã duyệt đơn xin nghỉ thành công!';
                showSuccessMessage(successMessage);
                loadAllLeaveRequests();
                loadLeaveRequestStats();
            } else {
                const errorMessage = isEdit 
                    ? (data.message || 'Không thể duyệt đơn xin sửa lịch')
                    : (data.message || 'Không thể duyệt đơn xin nghỉ');
                showErrorMessage(errorMessage);
            }
        } catch (error) {
            console.error('Error approving request:', error);
            const errorMessage = isEdit 
                ? 'Lỗi khi duyệt đơn xin sửa lịch'
                : 'Lỗi khi duyệt đơn xin nghỉ';
            showErrorMessage(errorMessage);
        }
    };
    
    /**
     * Từ chối đơn xin nghỉ / xin sửa lịch
     */
    window.rejectLeaveRequest = async function(scheduleId, isEdit = false) {
        const requestType = isEdit ? 'xin sửa lịch' : 'xin nghỉ';
        const reason = prompt(`Nhập lý do từ chối đơn ${requestType} (không bắt buộc):`);
        
        if (reason === null) {
            return; // User cancelled
        }
        
        try {
            const token = localStorage.getItem('token');
            
            const response = await fetch(`${API_BASE_URL}/mechanics/schedules/${scheduleId}/reject`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reason })
            });
            
            const data = await response.json();
            
            if (data.success) {
                    // ✅ DEBUG: Check response structure
                    console.log('🔥 RAW RESPONSE:', JSON.stringify(data, null, 2));
                    console.log('🔥 data.leaveRequests exists?', !!data.leaveRequests);
                    console.log('🔥 data.pending exists?', !!data.pending);
                    
                const successMessage = isEdit 
                    ? 'Đã từ chối đơn xin sửa lịch!' 
                    : 'Đã từ chối đơn xin nghỉ!';
                showSuccessMessage(successMessage);
                loadAllLeaveRequests();
                loadLeaveRequestStats();
            } else {
                const errorMessage = isEdit 
                    ? (data.message || 'Không thể từ chối đơn xin sửa lịch')
                    : (data.message || 'Không thể từ chối đơn xin nghỉ');
                showErrorMessage(errorMessage);
            }
        } catch (error) {
            console.error('Error rejecting request:', error);
            const errorMessage = isEdit 
                ? 'Lỗi khi từ chối đơn xin sửa lịch'
                : 'Lỗi khi từ chối đơn xin nghỉ';
            showErrorMessage(errorMessage);
        }
    };
    
    /**
     * Lọc đơn xin nghỉ theo ngày
     */
    function filterLeaveRequests() {
        loadAllLeaveRequests();
    }
    
    /**
     * Reset bộ lọc
     */
    function resetLeaveFilter() {
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        document.getElementById('leaveToDate').value = today.toISOString().split('T')[0];
        document.getElementById('leaveFromDate').value = thirtyDaysAgo.toISOString().split('T')[0];
        
        loadAllLeaveRequests();
    }
})
// ✅ Parse reason từ Notes (support cả structure mới và cũ)
function parseRequestReason(notes) {
    if (!notes) return 'Không có lý do';
    
    try {
        const notesData = JSON.parse(notes);
        
        // ✅ Structure MỚI: { type: "leave"/"edit", reason: "..." }
        if (notesData.reason) {
            return notesData.reason;
        }
        
        // ✅ Structure CŨ: { editRequest: { reason: "..." } }
        if (notesData.editRequest && notesData.editRequest.reason) {
            return notesData.editRequest.reason;
        }
        
        // Fallback: Không tìm thấy reason trong JSON
        return 'Không có lý do';
    } catch (e) {
        // ❌ Notes không phải JSON → Hiển thị text gốc
        return notes.replace('[XIN NGHỈ] ', '');
    }
}