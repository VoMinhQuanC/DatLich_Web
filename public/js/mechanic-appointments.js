// mechanic-appointments.js - COMPLETE VERSION with Action Buttons
// Trang quản lý lịch hẹn của kỹ thuật viên

document.addEventListener('DOMContentLoaded', function() {
    // ✅ UPDATED: Production API URL
    const API_BASE_URL = window.API_CONFIG ? window.API_CONFIG.BASE_URL : 'https://suaxeweb-production.up.railway.app/api';
    
    // Lưu trữ dữ liệu
    let mechanicData = {};
    let appointments = [];
    let dataTable = null;
    let selectedAppointmentId = null;
    
    // Kiểm tra xác thực kỹ thuật viên
    checkMechanicAuth();
    
    // Tải dữ liệu ban đầu
    loadAppointments();
    
    // Đăng ký sự kiện
    document.getElementById('refreshAppointmentsBtn').addEventListener('click', refreshAppointments);
    document.getElementById('applyFilterBtn').addEventListener('click', applyFilter);
    document.getElementById('todayBtn').addEventListener('click', () => filterByDate('today'));
    document.getElementById('tomorrowBtn').addEventListener('click', () => filterByDate('tomorrow'));
    document.getElementById('thisWeekBtn').addEventListener('click', () => filterByDate('thisWeek'));
    document.getElementById('updateAppointmentBtn')?.addEventListener('click', updateAppointmentStatusFromModal);
    document.getElementById('logout-link').addEventListener('click', logout);
    document.getElementById('sidebar-logout').addEventListener('click', logout);
    
    /**
     * Kiểm tra xác thực kỹ thuật viên
     */
    function checkMechanicAuth() {
        const token = localStorage.getItem('token');
        const userInfo = localStorage.getItem('user');
        
        if (!token || !userInfo) {
            window.location.href = '/login';
            return;
        }
        
        try {
            const user = JSON.parse(userInfo);
            
            // Kiểm tra vai trò kỹ thuật viên (role = 3)
            if (user.role !== 3) {
                alert('Bạn không có quyền truy cập trang kỹ thuật viên');
                window.location.href = '/';
                return;
            }
            
            mechanicData = user;
            document.getElementById('mechanicName').textContent = user.fullName || 'Kỹ thuật viên';
            
            if (user.fullName) {
                document.getElementById('avatarPlaceholder').textContent = user.fullName.charAt(0).toUpperCase();
            }
            
            console.log("✅ Auth check successful. Mechanic ID:", user.userId);
            
        } catch (error) {
            console.error('❌ Lỗi phân tích dữ liệu người dùng:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    }
    
    /**
     * Tải danh sách lịch hẹn
     */
    async function loadAppointments(filters = {}) {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            console.log("📋 Loading appointments...");
            
            // Hiển thị trạng thái đang tải
            document.getElementById('appointmentsList').innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-3">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Đang tải...</span>
                        </div>
                        <p class="mt-2">Đang tải danh sách lịch hẹn...</p>
                    </td>
                </tr>
            `;
            
            // Xây dựng URL với các tham số lọc
            let url = `${API_BASE_URL}/mechanics/appointments`;
            const params = new URLSearchParams();
            
            if (filters.status) params.append('status', filters.status);
            if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
            if (filters.dateTo) params.append('dateTo', filters.dateTo);
            
            if (params.toString()) {
                url += `?${params.toString()}`;
            }
            
            console.log("API URL:", url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log("Response status:", response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error("API Error response:", errorText);
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            console.log("📋 API Response:", data);
            
            if (data.success) {
                // ✅ FIX: Handle ALL possible response structures
                let appointmentsArray = null;
                
                // Case 1: data.data.appointments (nested structure)
                if (data.data && data.data.appointments && Array.isArray(data.data.appointments)) {
                    appointmentsArray = data.data.appointments;
                    console.log("✅ Parsed from data.data.appointments");
                }
                // Case 2: data.appointments (direct appointments)
                else if (data.appointments && Array.isArray(data.appointments)) {
                    appointmentsArray = data.appointments;
                    console.log("✅ Parsed from data.appointments");
                }
                // Case 3: data.data is array directly
                else if (Array.isArray(data.data)) {
                    appointmentsArray = data.data;
                    console.log("✅ Parsed from data.data (array)");
                }
                // Case 4: Empty response
                else {
                    appointmentsArray = [];
                    console.warn("⚠️ No appointments array found in response");
                }
                
                console.log("✅ Appointments loaded:", appointmentsArray.length);
                appointments = appointmentsArray;
                renderAppointmentsTable(appointments);
            } else {
                throw new Error(data.message || 'Không thể tải danh sách lịch hẹn');
            }
            
        } catch (error) {
            console.error('❌ Lỗi khi tải danh sách lịch hẹn:', error);
            
            document.getElementById('appointmentsList').innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-danger">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Lỗi: ${error.message}
                    </td>
                </tr>
            `;
            
            showErrorAlert('Không thể tải danh sách lịch hẹn: ' + error.message);
        }
    }
    
    /**
     * ✅ NEW: Get action buttons based on status
     */
    function getActionButtons(appointment) {
        const status = appointment.Status;
        const appointmentId = appointment.AppointmentID;
        
        let buttons = '';
        
        // Nút xem chi tiết (luôn có)
        buttons += `
            <button class="btn btn-sm btn-info me-1" onclick="viewAppointmentDetail(${appointmentId})" title="Xem chi tiết">
                <i class="bi bi-eye"></i>
            </button>
        `;
        
        // Nút theo status
        if (status === 'Confirmed') {
            // Bắt đầu sửa
            buttons += `
                <button class="btn btn-sm btn-primary" 
                        onclick="startWork(${appointmentId})"
                        title="Bắt đầu sửa xe">
                    <i class="bi bi-play-circle"></i> Bắt đầu
                </button>
            `;
        } else if (status === 'InProgress') {
            // Hoàn thành
            buttons += `
                <button class="btn btn-sm btn-success" 
                        onclick="completeWork(${appointmentId})"
                        title="Hoàn thành công việc">
                    <i class="bi bi-check-circle"></i> Hoàn thành
                </button>
            `;
        } else if (status === 'Completed') {
            // Đã hoàn thành - disabled
            buttons += `
                <button class="btn btn-sm btn-secondary" disabled>
                    <i class="bi bi-check-circle-fill"></i> Đã xong
                </button>
            `;
        }
        
        return buttons;
    }
    
    /**
     * ✅ NEW: Get status badge with proper styling
     */
    function getStatusBadge(status) {
        const statusMap = {
            'Pending': '<span class="badge bg-warning text-dark">Chờ xác nhận</span>',
            'PendingApproval': '<span class="badge bg-warning text-dark">Chờ duyệt</span>',
            'Confirmed': '<span class="badge bg-info">Đã xác nhận</span>',
            'InProgress': '<span class="badge bg-primary">Đang sửa</span>',
            'Completed': '<span class="badge bg-success">Hoàn thành</span>',
            'Canceled': '<span class="badge bg-danger">Đã hủy</span>',
            'Rejected': '<span class="badge bg-danger">Đã từ chối</span>'
        };
        
        return statusMap[status] || `<span class="badge bg-secondary">${status}</span>`;
    }
    
    /**
     * Hiển thị danh sách lịch hẹn trong bảng
     */
    function renderAppointmentsTable(appointmentsData) {
        if (!appointmentsData || appointmentsData.length === 0) {
            document.getElementById('appointmentsList').innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-3">
                        <i class="bi bi-calendar-x me-2"></i>
                        Không có lịch hẹn nào
                    </td>
                </tr>
            `;
            return;
        }
        
        console.log("📊 Rendering", appointmentsData.length, "appointments");
        
        // Hủy DataTable cũ nếu đã tồn tại
        if (dataTable) {
            dataTable.destroy();
        }
        
        // Chuẩn bị dữ liệu cho DataTable
        const tableData = appointmentsData.map(appointment => {
            // Format ngày giờ
            const appointmentDate = new Date(appointment.AppointmentDate);
            const formattedDate = appointmentDate.toLocaleDateString('vi-VN') + ' ' + 
                                 appointmentDate.toLocaleTimeString('vi-VN', {
                                     hour: '2-digit',
                                     minute: '2-digit'
                                 });
            
            // ✅ FIX: Parse Services an toàn (string, array, hoặc object)
            let servicesDisplay = 'Không có dịch vụ';
            if (appointment.Services) {
                // Case 1: Services là string (từ GROUP_CONCAT)
                if (typeof appointment.Services === 'string') {
                    servicesDisplay = appointment.Services;
                }
                // Case 2: Services là array (từ API detail)
                else if (Array.isArray(appointment.Services)) {
                    servicesDisplay = appointment.Services
                        .map(s => s.ServiceName || s)
                        .join(', ');
                }
                // Case 3: Services là object (parse lỗi)
                else if (typeof appointment.Services === 'object') {
                    servicesDisplay = appointment.Services.ServiceName || JSON.stringify(appointment.Services);
                }
            }
            
            return [
                appointment.AppointmentID,
                appointment.CustomerName || appointment.FullName || 'Không có tên',
                appointment.PhoneNumber || appointment.CustomerPhone || 'N/A', // ✅ FIX: Thêm CustomerPhone
                servicesDisplay, // ✅ FIXED: An toàn với mọi type
                formattedDate,
                getStatusBadge(appointment.Status),
                getActionButtons(appointment)
            ];
        });
        
        // Khởi tạo DataTable
        dataTable = $('#appointmentsTable').DataTable({
            data: tableData,
            columns: [
                { title: 'Mã' },
                { title: 'Khách hàng' },
                { title: 'SĐT' },
                { title: 'Dịch vụ' },
                { title: 'Ngày giờ' },
                { title: 'Trạng thái' },
                { title: 'Thao tác' }
            ],
            language: {
                url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/vi.json'
            },
            order: [[4, 'desc']], // Sắp xếp theo ngày giờ mới nhất
            pageLength: 10,
            responsive: true,
            columnDefs: [
                { orderable: false, targets: [6] } // Không cho phép sắp xếp cột thao tác
            ]
        });
        
        console.log("✅ DataTable initialized");
    }
    
    /**
     * ✅ NEW: Bắt đầu sửa xe (Confirmed → InProgress)
     */
    window.startWork = async function(appointmentId) {
        if (!confirm('Bạn có chắc muốn bắt đầu sửa xe cho lịch hẹn này không?')) {
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            console.log("🔧 Starting work on appointment:", appointmentId);
            
            const response = await fetch(`${API_BASE_URL}/mechanics/appointments/${appointmentId}/start`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log("Response status:", response.status);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Không thể bắt đầu sửa xe');
            }
            
            const data = await response.json();
            
            if (data.success) {
                console.log("✅ Started work successfully");
                showSuccessAlert('Đã bắt đầu sửa xe thành công!');
                
                // Reload appointments
                setTimeout(() => {
                    loadAppointments();
                }, 1000);
            } else {
                throw new Error(data.message || 'Không thể bắt đầu sửa xe');
            }
            
        } catch (error) {
            console.error('❌ Error starting work:', error);
            showErrorAlert('Lỗi: ' + error.message);
        }
    };
    
    /**
     * ✅ NEW: Hoàn thành công việc (InProgress → Completed)
     */
    window.completeWork = async function(appointmentId) {
        // Optional: Show modal để nhập notes
        const notes = prompt('Ghi chú hoàn thành (tùy chọn):');
        
        if (!confirm('Xác nhận hoàn thành công việc cho lịch hẹn này?')) {
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            console.log("✅ Completing appointment:", appointmentId);
            
            const response = await fetch(`${API_BASE_URL}/mechanics/appointments/${appointmentId}/complete`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    notes: notes || '' 
                })
            });
            
            console.log("Response status:", response.status);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Không thể hoàn thành công việc');
            }
            
            const data = await response.json();
            
            if (data.success) {
                console.log("✅ Completed work successfully");
                showSuccessAlert('Đã hoàn thành công việc thành công!');
                
                // Reload appointments
                setTimeout(() => {
                    loadAppointments();
                }, 1000);
            } else {
                throw new Error(data.message || 'Không thể hoàn thành công việc');
            }
            
        } catch (error) {
            console.error('❌ Error completing work:', error);
            showErrorAlert('Lỗi: ' + error.message);
        }
    };
    
    /**
     * Xem chi tiết lịch hẹn
     */
    window.viewAppointmentDetail = async function(appointmentId) {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            console.log("👁️ Viewing appointment detail:", appointmentId);
            selectedAppointmentId = appointmentId;
            
            const response = await fetch(`${API_BASE_URL}/mechanics/appointments/${appointmentId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                const appointment = data.appointment || data.data;
                if (!appointment) {
                    throw new Error('Dữ liệu chi tiết lịch hẹn không hợp lệ');
                }

                const setText = (ids, value) => {
                    const idList = Array.isArray(ids) ? ids : [ids];
                    const element = idList.map((id) => document.getElementById(id)).find(Boolean);
                    if (element) {
                        element.textContent = value;
                    }
                };

                const setHtml = (ids, value) => {
                    const idList = Array.isArray(ids) ? ids : [ids];
                    const element = idList.map((id) => document.getElementById(id)).find(Boolean);
                    if (element) {
                        element.innerHTML = value;
                    }
                };
                
                // Điền thông tin vào modal
                setText(['detailAppointmentId', 'appointmentId'], appointment.AppointmentID || 'N/A');
                setText(['detailCustomerName', 'customerName'], appointment.CustomerName || 'N/A');
                setText(['detailPhoneNumber', 'customerPhone'], appointment.PhoneNumber || appointment.CustomerPhone || 'N/A');
                setText(['detailEmail', 'customerEmail'], appointment.Email || 'N/A');
                
                const appointmentDate = new Date(appointment.AppointmentDate);
                const formattedDate = appointmentDate.toLocaleDateString('vi-VN');
                const formattedTime = appointmentDate.toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                setText(['detailAppointmentDate'], formattedDate);
                setText(['detailAppointmentTime'], formattedTime);
                setText(['appointmentDateTime'], `${formattedDate} ${formattedTime}`);
                
                setText(['detailVehicleInfo'], appointment.VehicleInfo || 'N/A');
                setText(['vehiclePlate'], appointment.LicensePlate || 'N/A');
                setText(['vehicleBrand'], appointment.Brand || 'N/A');
                setText(['vehicleModel'], appointment.Model || 'N/A');
                setText(['detailNotes', 'appointmentNotes'], appointment.Notes || 'Không có ghi chú');
                setText(['createdAt'], appointment.CreatedAt ? new Date(appointment.CreatedAt).toLocaleString('vi-VN') : 'N/A');
                
                // Status badge
                setHtml(['detailStatus', 'currentStatus'], getStatusBadge(appointment.Status));
                const statusSelect = document.getElementById('appointmentStatus');
                if (statusSelect) statusSelect.value = appointment.Status || 'Pending';
                
                // Services
                const services = appointment.services || appointment.ServicesDetails || [];
                if (services.length > 0) {
                    const servicesHTML = services.map(service => `
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            ${service.ServiceName}
                            <span class="badge bg-primary rounded-pill">${formatCurrency(service.Price)}</span>
                        </li>
                    `).join('');
                    
                    setHtml(['detailServicesList', 'servicesList'], servicesHTML);
                    
                    const totalPrice = services.reduce((sum, s) => sum + ((s.Price || 0) * (s.Quantity || 1)), 0);
                    setText(['detailTotalPrice', 'totalPrice'], formatCurrency(totalPrice));
                    const totalTimeMinutes = services.reduce((sum, s) => sum + ((s.EstimatedTime || 0) * (s.Quantity || 1)), 0);
                    setText(['totalTime'], formatTime(totalTimeMinutes));
                } else {
                    setHtml(['detailServicesList', 'servicesList'], '<li class="list-group-item">Không có dịch vụ</li>');
                    setText(['detailTotalPrice', 'totalPrice'], formatCurrency(0));
                    setText(['totalTime'], formatTime(appointment.ServiceDuration || 0));
                }
                
                // Hiển thị modal
                const modal = new bootstrap.Modal(document.getElementById('appointmentDetailModal'));
                modal.show();
            } else {
                throw new Error(data.message || 'Không thể tải chi tiết lịch hẹn');
            }
            
        } catch (error) {
            console.error('❌ Lỗi khi tải chi tiết lịch hẹn:', error);
            showErrorAlert('Không thể tải chi tiết lịch hẹn: ' + error.message);
        }
    };
    
    /**
     * Làm mới danh sách
     */
    function refreshAppointments() {
        console.log("🔄 Refreshing appointments...");
        loadAppointments();
    }

    async function updateAppointmentStatusFromModal() {
        if (!selectedAppointmentId) {
            showErrorAlert('Không xác định được lịch hẹn cần cập nhật');
            return;
        }

        const statusSelect = document.getElementById('appointmentStatus');
        const notesInput = document.getElementById('appointmentNotes');
        const updateButton = document.getElementById('updateAppointmentBtn');
        const updateSpinner = document.getElementById('updateSpinner');

        const status = statusSelect ? statusSelect.value : '';
        const notes = notesInput ? notesInput.value.trim() : '';

        if (!status) {
            showErrorAlert('Vui lòng chọn trạng thái');
            return;
        }

        updateButton?.setAttribute('disabled', 'disabled');
        updateSpinner?.classList.remove('d-none');

        try {
            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Không có token xác thực');
            }

            const response = await fetch(`${API_BASE_URL}/mechanics/appointments/${selectedAppointmentId}/status`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status, notes })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || `Không thể cập nhật trạng thái (${response.status})`);
            }

            const currentStatusElement = document.getElementById('currentStatus');
            if (currentStatusElement) {
                currentStatusElement.innerHTML = getStatusBadge(status);
            }

            showSuccessAlert('Cập nhật trạng thái lịch hẹn thành công');

            const modalElement = document.getElementById('appointmentDetailModal');
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (modalInstance) {
                modalInstance.hide();
            }

            await loadAppointments();
        } catch (error) {
            console.error('❌ Error updating appointment status:', error);
            showErrorAlert(error.message || 'Không thể cập nhật trạng thái lịch hẹn');
        } finally {
            updateButton?.removeAttribute('disabled');
            updateSpinner?.classList.add('d-none');
        }
    }
    
    /**
     * Áp dụng bộ lọc
     */
    function applyFilter() {
        const filters = {
            status: document.getElementById('statusFilter').value,
            dateFrom: document.getElementById('dateFromFilter').value,
            dateTo: document.getElementById('dateToFilter').value
        };
        
        console.log("🔍 Applying filters:", filters);
        loadAppointments(filters);
    }
    
    /**
     * Lọc theo ngày
     */
    function filterByDate(type) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let dateFrom, dateTo;
        
        switch(type) {
            case 'today':
                dateFrom = today;
                dateTo = new Date(today);
                dateTo.setHours(23, 59, 59, 999);
                break;
                
            case 'tomorrow':
                dateFrom = new Date(today);
                dateFrom.setDate(dateFrom.getDate() + 1);
                dateTo = new Date(dateFrom);
                dateTo.setHours(23, 59, 59, 999);
                break;
                
            case 'thisWeek':
                const dayOfWeek = today.getDay();
                const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                dateFrom = new Date(today.setDate(diff));
                dateTo = new Date(dateFrom);
                dateTo.setDate(dateTo.getDate() + 6);
                dateTo.setHours(23, 59, 59, 999);
                break;
        }
        
        // Format dates for input fields
        document.getElementById('dateFromFilter').value = dateFrom.toISOString().split('T')[0];
        document.getElementById('dateToFilter').value = dateTo.toISOString().split('T')[0];
        
        // Apply filter
        applyFilter();
    }
    
    /**
     * ✅ NEW: Show success alert
     */
    function showSuccessAlert(message) {
        const successAlert = document.getElementById('successAlert');
        const successMessage = document.getElementById('successMessage');
        
        if (successAlert && successMessage) {
            successMessage.textContent = message;
            successAlert.classList.remove('d-none');
            
            // Auto hide after 3 seconds
            setTimeout(() => {
                successAlert.classList.add('d-none');
            }, 3000);
        } else {
            alert(message);
        }
    }
    
    /**
     * ✅ NEW: Show error alert
     */
    function showErrorAlert(message) {
        const errorAlert = document.getElementById('errorAlert');
        const errorMessage = document.getElementById('errorMessage');
        
        if (errorAlert && errorMessage) {
            errorMessage.textContent = message;
            errorAlert.classList.remove('d-none');
            
            // Auto hide after 5 seconds
            setTimeout(() => {
                errorAlert.classList.add('d-none');
            }, 5000);
        } else {
            alert(message);
        }
    }
    
    /**
     * Format currency
     */
    function formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount || 0);
    }
    
    /**
     * Format time
     */
    function formatTime(minutes) {
        if (!minutes) return '0 phút';
        
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (hours > 0) {
            return mins > 0 ? `${hours} giờ ${mins} phút` : `${hours} giờ`;
        }
        
        return `${mins} phút`;
    }
    
    /**
     * Đăng xuất
     */
    function logout(e) {
        e.preventDefault();
        
        if (confirm('Bạn có chắc muốn đăng xuất?')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    }
    
    console.log("✅ Mechanic appointments page initialized");
});
