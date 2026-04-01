// admin-services.js - JavaScript cho trang quản lý dịch vụ

document.addEventListener('DOMContentLoaded', function() {
    // Sử dụng API_CONFIG từ config.js (được load trước)
    const API_BASE_URL = window.API_CONFIG ? window.API_CONFIG.BASE_URL : 'http://localhost:3001/api';
    
    // Biến lưu trữ dữ liệu
    let services = [];
    let selectedServiceId = null;
    let selectedImage = null; // Biến lưu trữ file hình ảnh đã chọn
    
    // Kiểm tra xác thực admin
    checkAdminAuth();
    
    // Tải danh sách dịch vụ khi trang được load
    loadServices();
    
    // Thêm event listener cho các nút
    document.getElementById('addServiceBtn').addEventListener('click', openAddServiceModal);
    document.getElementById('saveServiceBtn').addEventListener('click', saveService);
    document.getElementById('confirmDeleteBtn').addEventListener('click', deleteService);
    document.getElementById('logout-link').addEventListener('click', logout);
    document.getElementById('dropdown-logout').addEventListener('click', logout);
    
    // Xử lý preview hình ảnh khi chọn file
    document.getElementById('serviceImage').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Lưu file đã chọn
            selectedImage = file;
            
            // Hiển thị preview
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById('serviceImagePreview').src = e.target.result;
            }
            reader.readAsDataURL(file);
        }
    });

    // Xuất các hàm để có thể gọi từ bên ngoài
    window.loadServices = loadServices;
    window.openAddServiceModal = openAddServiceModal;

    /**
     * Kiểm tra xác thực admin
     */
    function checkAdminAuth() {
        const token = localStorage.getItem('token');
        const userInfo = localStorage.getItem('user');
        
        if (!token || !userInfo) {
            console.error('Không có token hoặc thông tin người dùng.');
            window.location.href = '/login';
            return;
        }
        
        try {
            const user = JSON.parse(userInfo);
            console.log('Thông tin user từ localStorage:', user);
            
            // Kiểm tra quyền admin (role = 1)
            if (user.role !== 1) {
                console.error('Người dùng không có quyền admin. Role:', user.role);
                alert('Bạn không có quyền truy cập trang quản trị');
                window.location.href = '/';
                return;
            }
            
            // Hiển thị thông tin người dùng trước khi kiểm tra token
            updateUserInfo(user);
            
            // Kiểm tra token có hợp lệ hay không bằng cách gọi API kiểm tra
            fetch(`${API_BASE_URL}/auth/check-auth`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => {
                if (!response.ok) {
                    // Nếu status code là 401 hoặc 403 mới logout
                    if (response.status === 401 || response.status === 403) {
                        console.error('Token không hợp lệ hoặc đã hết hạn');
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        window.location.href = '/login';
                    }
                    return { success: false };
                }
                return response.json();
            })
            .then(data => {
                if (data && data.success) {
                    console.log('Token hợp lệ, người dùng có quyền admin');
                } else {
                    console.warn('Phản hồi kiểm tra xác thực không hợp lệ, nhưng vẫn tiếp tục phiên làm việc');
                }
            })
            .catch(error => {
                console.error('Lỗi khi kiểm tra xác thực:', error);
                // Quan trọng: Không logout khi gặp lỗi kết nối mạng
            });
            
        } catch (error) {
            console.error('Lỗi phân tích dữ liệu người dùng:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    }
    
    /**
     * Cập nhật thông tin người dùng trên giao diện
     */
    function updateUserInfo(user) {
        // Hiển thị tên người dùng
        const userNameElement = document.getElementById('adminName');
        if (userNameElement) {
            userNameElement.textContent = user.fullName || user.email || 'Admin';
        }
        
        // Hiển thị avatar với chữ cái đầu tiên của tên
        const avatarPlaceholder = document.getElementById('avatarPlaceholder');
        if (avatarPlaceholder) {
            // Lấy chữ cái đầu tiên của tên và chuyển thành chữ hoa
            const firstLetter = user.fullName ? user.fullName.charAt(0).toUpperCase() : 'A';
            avatarPlaceholder.textContent = firstLetter;
            
            // Tạo màu nền dựa trên tên người dùng (giống trang admin)
            avatarPlaceholder.style.backgroundColor = generateColorFromName(user.fullName || user.email);
        }
    }

    /**
     * Tạo màu ngẫu nhiên từ tên
     */
    function generateColorFromName(name) {
        if (!name) return '#0d6efd';
        
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const colors = [
            '#0d6efd'
        ];
        
        return colors[Math.abs(hash) % colors.length];
    }
    
    /**
     * Đăng xuất
     */
    function logout(e) {
        e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }
    
    /**
     * Tải danh sách dịch vụ từ API
     */
    async function loadServices() {
        try {
            // Hiển thị loading
            document.getElementById('servicesList').innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Đang tải...</span>
                        </div>
                        <p class="mt-2">Đang tải danh sách dịch vụ...</p>
                    </td>
                </tr>
            `;
            
            // Lấy token xác thực
            const token = localStorage.getItem('token');
            
            // Chuẩn bị headers với token xác thực
            const headers = token ? {
                'Authorization': `Bearer ${token}`
            } : {};
            
            // Gọi API với headers xác thực
            console.log('Đang gọi API:', `${API_BASE_URL}/services`);
            const response = await fetch(`${API_BASE_URL}/services`, {
                method: 'GET',
                headers: headers
            });
            
            console.log('Trạng thái phản hồi:', response.status);
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            // Lưu dữ liệu vào biến toàn cục
            const data = await response.json();
            console.log('Dữ liệu nhận được:', data);
            
            // Kiểm tra cấu trúc dữ liệu
            if (!data || (data.success === false)) {
                throw new Error(data.message || 'Không nhận được dữ liệu hợp lệ từ server');
            }
            
            // Xử lý các trường hợp khác nhau của dữ liệu
            if (Array.isArray(data)) {
                services = data;
            } else if (data.services && Array.isArray(data.services)) {
                services = data.services;
            } else if (data.success && data.services && Array.isArray(data.services)) {
                services = data.services;
            } else {
                console.warn('Cấu trúc dữ liệu không như mong đợi:', data);
                services = [];
            }
            
            // Log số lượng dịch vụ đã tải
            console.log(`Đã tải ${services.length} dịch vụ`);
            
            // Render dữ liệu vào bảng
            renderServicesTable();
            
        } catch (error) {
            console.error('Lỗi khi tải dịch vụ:', error);
            showErrorMessage('Không thể tải danh sách dịch vụ. Vui lòng thử lại sau.');
            
            document.getElementById('servicesList').innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-danger">
                        <i class="bi bi-exclamation-triangle me-2"></i> Lỗi: ${error.message}
                        <div class="mt-3">
                            <button class="btn btn-outline-primary" onclick="loadServices()">
                                <i class="bi bi-arrow-clockwise me-1"></i> Thử lại
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }
    }
    
    /**
     * Hiển thị danh sách dịch vụ vào bảng
     */
    function renderServicesTable() {
        const tableBody = document.getElementById('servicesList');
        
        if (!services || services.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div class="p-4">
                            <i class="bi bi-info-circle fs-2 text-info"></i>
                            <p class="mt-2">Chưa có dịch vụ nào. Hãy thêm dịch vụ mới!</p>
                            <button class="btn btn-primary mt-2" onclick="openAddServiceModal()">
                                <i class="bi bi-plus-circle me-1"></i> Thêm dịch vụ
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        let html = '';
        
        services.forEach(service => {
            // Đảm bảo đường dẫn hình ảnh đầy đủ
            let imagePath = service.ServiceImage || '/images/service-placeholder.jpg';
            
            // Nếu đường dẫn không bắt đầu bằng http hoặc / thì thêm / vào đầu
            if (!imagePath.startsWith('http') && !imagePath.startsWith('/')) {
                imagePath = '/' + imagePath;
            }
            
            html += `
                <tr>
                    <td>${service.ServiceID}</td>
                    <td>
                        <img src="${imagePath}" alt="${service.ServiceName}" 
                             onerror="this.onerror=null; this.src='/images/service-placeholder.jpg';" 
                             style="width: 60px; height: 60px; object-fit: cover;" class="rounded">
                    </td>
                    <td>${service.ServiceName}</td>
                    <td>${service.Description || 'Không có mô tả'}</td>
                    <td>${formatCurrency(service.Price)}</td>
                    <td>${service.EstimatedTime || 0} phút</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="editService(${service.ServiceID})">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="confirmDeleteService(${service.ServiceID}, '${service.ServiceName}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html;
        
        // Khởi tạo DataTable nếu có jQuery
        if ($.fn.DataTable) {
            // Hủy DataTable cũ nếu đã tồn tại
            if ($.fn.DataTable.isDataTable('#servicesTable')) {
                $('#servicesTable').DataTable().destroy();
            }
            
            $('#servicesTable').DataTable({
                language: {
                    url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/vi.json'
                },
                responsive: true
            });
        }
    }
    
    /**
     * Mở modal thêm dịch vụ mới
     */
    function openAddServiceModal() {
        // Reset form
        document.getElementById('serviceForm').reset();
        document.getElementById('serviceModalTitle').textContent = "Thêm dịch vụ mới";
        document.getElementById('serviceId').value = "";
        
        // Cập nhật đường dẫn hình ảnh với dấu / ở đầu
        const img = document.getElementById('serviceImagePreview');
        img.onerror = function() {
            this.onerror = null;
            this.src = '/images/service-placeholder.jpg';
        };
        img.src = "/images/service-placeholder.jpg";
        
        // Reset biến lưu trữ
        selectedServiceId = null;
        selectedImage = null;
        
        // Hiện modal
        const modal = new bootstrap.Modal(document.getElementById('serviceModal'));
        modal.show();
    }
    
    /**
     * Mở modal chỉnh sửa dịch vụ
     * @param {number} id ID của dịch vụ cần chỉnh sửa
     */
    window.editService = function(id) {
        const service = services.find(s => s.ServiceID === id);
        
        if (!service) {
            showErrorMessage('Không tìm thấy thông tin dịch vụ');
            return;
        }
        
        // Lưu ID dịch vụ đang chỉnh sửa
        selectedServiceId = id;
        selectedImage = null;
        
        // Cập nhật tiêu đề modal
        document.getElementById('serviceModalTitle').textContent = "Chỉnh sửa dịch vụ";
        
        // Điền thông tin dịch vụ vào form
        document.getElementById('serviceId').value = service.ServiceID;
        document.getElementById('serviceName').value = service.ServiceName;
        document.getElementById('serviceDescription').value = service.Description || '';
        document.getElementById('servicePrice').value = service.Price;
        document.getElementById('serviceTime').value = service.EstimatedTime || 0;
        
        // Hiển thị hình ảnh dịch vụ
        let imagePath = service.ServiceImage || '/images/service-placeholder.jpg';
        
        // Nếu đường dẫn không bắt đầu bằng http hoặc / thì thêm / vào đầu
        if (!imagePath.startsWith('http') && !imagePath.startsWith('/')) {
            imagePath = '/' + imagePath;
        }
        
        // Thêm xử lý lỗi cho hình ảnh
        const img = document.getElementById('serviceImagePreview');
        img.onerror = function() {
            this.onerror = null;
            this.src = '/images/service-placeholder.jpg';
        };
        img.src = imagePath;
        
        // Hiện modal
        const modal = new bootstrap.Modal(document.getElementById('serviceModal'));
        modal.show();
    }
    
    /**
     * Hiển thị modal xác nhận xóa dịch vụ
     * @param {number} id ID của dịch vụ cần xóa
     * @param {string} name Tên dịch vụ
     */
    window.confirmDeleteService = function(id, name) {
        selectedServiceId = id;
        document.getElementById('deleteServiceName').textContent = name;
        
        const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
        modal.show();
    }
    
    /**
     * Upload hình ảnh dịch vụ
     * @param {number} serviceId ID của dịch vụ
     * @returns {Promise<string>} Đường dẫn hình ảnh sau khi upload
     */
    async function uploadServiceImage(serviceId) {
        if (!selectedImage) {
            return null;
        }
        
        try {
            // Tạo form data để upload file
            const formData = new FormData();
            formData.append('image', selectedImage);
            
            // Lấy token xác thực
            const token = localStorage.getItem('token');
            
            // Gọi API upload hình ảnh
            const response = await fetch(`${API_BASE_URL}/upload/service/${serviceId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Không thể upload hình ảnh');
            }
            
            return result.imagePath;
        } catch (error) {
            console.error('Lỗi khi upload hình ảnh:', error);
            // Không throw error, chỉ log và trả về null để tiếp tục lưu dịch vụ
            return null;
        }
    }
    
    /**
     * Lưu dịch vụ (thêm mới hoặc cập nhật)
     */
    async function saveService() {
        try {
            // Validate form
            const serviceName = document.getElementById('serviceName').value.trim();
            const servicePrice = document.getElementById('servicePrice').value;
            const serviceTime = document.getElementById('serviceTime').value;
            
            if (!serviceName) {
                showErrorMessage('Vui lòng nhập tên dịch vụ');
                return;
            }
            
            if (!servicePrice || isNaN(servicePrice) || parseFloat(servicePrice) < 0) {
                showErrorMessage('Vui lòng nhập giá dịch vụ hợp lệ');
                return;
            }
            
            if (!serviceTime || isNaN(serviceTime) || parseInt(serviceTime) <= 0) {
                showErrorMessage('Vui lòng nhập thời gian dự kiến hợp lệ');
                return;
            }
            
            // Hiển thị trạng thái đang lưu
            const saveBtn = document.getElementById('saveServiceBtn');
            const saveSpinner = document.getElementById('saveSpinner');
            saveBtn.disabled = true;
            saveSpinner.classList.remove('d-none');
            
            // Chuẩn bị dữ liệu
            const serviceData = {
                ServiceName: serviceName,
                Description: document.getElementById('serviceDescription').value,
                Price: parseFloat(servicePrice),
                EstimatedTime: parseInt(serviceTime),
                EstimatedTimeHours: `${serviceTime} phút` // Định dạng cho dễ hiển thị
            };
            
            // Token xác thực
            const token = localStorage.getItem('token');
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };
            
            let response;
            let insertedId;
            
            if (selectedServiceId) {
                // Cập nhật dịch vụ
                response = await fetch(`${API_BASE_URL}/services/${selectedServiceId}`, {
                    method: 'PUT',
                    headers: headers,
                    body: JSON.stringify(serviceData)
                });
                
                insertedId = selectedServiceId;
            } else {
                // Thêm mới dịch vụ
                response = await fetch(`${API_BASE_URL}/services`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(serviceData)
                });
                
                // Lấy ID của dịch vụ mới thêm
                const result = await response.json();
                insertedId = result.ServiceID;
            }
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            // Upload hình ảnh nếu có
            if (selectedImage && insertedId) {
                await uploadServiceImage(insertedId);
            }
            
            // Đóng modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('serviceModal'));
            modal.hide();
            
            // Hiển thị thông báo thành công
            showSuccessMessage(selectedServiceId ? 'Cập nhật dịch vụ thành công' : 'Thêm dịch vụ mới thành công');
            
            // Tải lại danh sách dịch vụ
            loadServices();
            
        } catch (error) {
            console.error('Lỗi khi lưu dịch vụ:', error);
            showErrorMessage('Không thể lưu dịch vụ: ' + error.message);
        } finally {
            // Đặt lại trạng thái nút lưu
            const saveBtn = document.getElementById('saveServiceBtn');
            const saveSpinner = document.getElementById('saveSpinner');
            saveBtn.disabled = false;
            saveSpinner.classList.add('d-none');
        }
    }
    
    /**
     * Xóa dịch vụ
     */
    async function deleteService() {
        if (!selectedServiceId) {
            showErrorMessage('Không có ID dịch vụ để xóa');
            return;
        }
        
        try {
            // Hiển thị trạng thái đang xóa
            const deleteBtn = document.getElementById('confirmDeleteBtn');
            const deleteSpinner = document.getElementById('deleteSpinner');
            deleteBtn.disabled = true;
            deleteSpinner.classList.remove('d-none');
            
            // Gọi API để xóa dịch vụ
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/services/${selectedServiceId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            // Đóng modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
            modal.hide();
            
            // Hiển thị thông báo thành công
            showSuccessMessage('Xóa dịch vụ thành công');
            
            // Tải lại danh sách dịch vụ
            loadServices();
            
        } catch (error) {
            console.error('Lỗi khi xóa dịch vụ:', error);
            showErrorMessage('Không thể xóa dịch vụ: ' + error.message);
        } finally {
            // Đặt lại trạng thái nút xóa
            const deleteBtn = document.getElementById('confirmDeleteBtn');
            const deleteSpinner = document.getElementById('deleteSpinner');
            deleteBtn.disabled = false;
            deleteSpinner.classList.add('d-none');
        }
    }

    document.querySelectorAll('.modal').forEach(modalElement => {
    // Khởi tạo lại tất cả các modal
        new bootstrap.Modal(modalElement);
    });
    
    /**
     * Hiển thị thông báo lỗi
     * @param {string} message Nội dung thông báo
     */
    function showErrorMessage(message) {
        const errorAlert = document.getElementById('errorAlert');
        errorAlert.textContent = message;
        errorAlert.style.display = 'block';
        
        // Tự động ẩn sau 5 giây
        setTimeout(() => {
            errorAlert.style.display = 'none';
        }, 5000);
    }
    
    /**
     * Hiển thị thông báo thành công
     * @param {string} message Nội dung thông báo
     */
    function showSuccessMessage(message) {
        const successAlert = document.getElementById('successAlert');
        successAlert.textContent = message;
        successAlert.style.display = 'block';
        
        // Tự động ẩn sau 5 giây
        setTimeout(() => {
            successAlert.style.display = 'none';
        }, 5000);
    }
    
    /**
     * Format số thành định dạng tiền tệ VNĐ
     * @param {number} amount Số tiền cần format
     * @returns {string} Chuỗi tiền tệ đã được format
     */
    function formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0
        }).format(amount);
    }
});