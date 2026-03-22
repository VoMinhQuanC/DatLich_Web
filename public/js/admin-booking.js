// admin-booking.js - JavaScript cho trang quản lý đặt lịch

document.addEventListener('DOMContentLoaded', function() {
    // Sử dụng API_CONFIG từ config.js (được load trước)
    const API_BASE_URL = window.API_CONFIG ? window.API_CONFIG.BASE_URL : 'http://localhost:3001/api';
    
    // Biến lưu trữ dữ liệu
    let bookings = [];
    let mechanics = [];
    let selectedBookingId = null;
    let dataTable = null;
    let currentFilters = {};
    let isDataLoaded = false;
    
    // Kiểm tra xác thực admin
    checkAdminAuth();
    
    // Khởi tạo datepickers
    initDatepickers();
    
    // Tải dữ liệu ban đầu
    loadDashboardSummary();
    loadBookings();
    loadMechanics();
    
    // Event listeners cho các nút
    document.getElementById('applyFilterBtn').addEventListener('click', applyFilters);
    document.getElementById('resetFilterBtn').addEventListener('click', resetFilters);
    document.getElementById('saveBookingBtn').addEventListener('click', saveBooking);
    document.getElementById('cancelBookingBtn').addEventListener('click', showCancelConfirmation);
    document.getElementById('completeBookingBtn').addEventListener('click', showCompleteConfirmation);
    document.getElementById('confirmCancelButton').addEventListener('click', cancelBooking);
    document.getElementById('confirmCompleteButton').addEventListener('click', completeBooking);
    document.getElementById('logout-link').addEventListener('click', logout);
    document.getElementById('dropdown-logout').addEventListener('click', logout);
    
    // Thêm sự kiện thay đổi cho bộ lọc trạng thái
    document.getElementById('statusFilter').addEventListener('change', function() {
        // Tự động áp dụng bộ lọc khi người dùng thay đổi trạng thái
        applyFilters();
    });
    
    // Định nghĩa hàm xử lý sự kiện toàn cục
    window.viewBookingDetail = viewBookingDetail;
    window.completeBookingDirectly = completeBookingDirectly;
    window.cancelBookingDirectly = cancelBookingDirectly;
    window.confirmAppointment = confirmAppointment;
    
    /**
     * Kiểm tra xác thực admin
     */
    function checkAdminAuth() {
        const token = localStorage.getItem('token');
        const userInfo = localStorage.getItem('user');
        
        if (!token || !userInfo) {
            // Chưa đăng nhập, chuyển hướng đến trang đăng nhập admin
            window.location.href = '/login';
            return;
        }
        
        try {
            const user = JSON.parse(userInfo);
            
            // Kiểm tra quyền admin (RoleID = 1)
            if (user.role !== 1) {
                alert('Bạn không có quyền truy cập trang quản trị');
                window.location.href = '/login';
                return;
            }
            
            // Hiển thị tên admin
            document.getElementById('adminName').textContent = user.fullName || 'Admin';
            // Cập nhật avatar với chữ cái đầu tiên của tên
            const avatarPlaceholder = document.getElementById('avatarPlaceholder');
            if (avatarPlaceholder && user.fullName) {
                avatarPlaceholder.textContent = user.fullName.charAt(0).toUpperCase();
            }

        } catch (error) {
            console.error('Lỗi phân tích dữ liệu người dùng:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    }
    
    /**
     * Khởi tạo datepickers
     */
    function initDatepickers() {
        // Datepicker cho bộ lọc từ ngày
        if (typeof flatpickr === 'function') {
            try {
                flatpickr("#dateFrom", {
                    dateFormat: "d-m-Y",
                    locale: "vn",
                    maxDate: "today",
                    allowInput: true,
                    onChange: function(selectedDates, dateStr, instance) {
                        // Cập nhật minDate cho dateTo
                        const dateToInstance = document.querySelector("#dateTo")._flatpickr;
                        if (dateToInstance && selectedDates[0]) {
                            dateToInstance.set("minDate", selectedDates[0]);
                        }
                    }
                });
                
                // Datepicker cho bộ lọc đến ngày
                flatpickr("#dateTo", {
                    dateFormat: "d-m-Y",
                    locale: "vn",
                    maxDate: "today",
                    allowInput: true,
                    onChange: function(selectedDates, dateStr, instance) {
                        // Cập nhật maxDate cho dateFrom
                        const dateFromInstance = document.querySelector("#dateFrom")._flatpickr;
                        if (dateFromInstance && selectedDates[0]) {
                            dateFromInstance.set("maxDate", selectedDates[0]);
                        }
                    }
                });
                
                // Datepicker cho ngày giờ hẹn trong form chi tiết
                flatpickr("#bookingDate", {
                    dateFormat: "d-m-Y H:i",
                    enableTime: true,
                    time_24hr: true,
                    locale: "vn",
                    minuteIncrement: 15
                });
            } catch (error) {
                console.error("Lỗi khởi tạo flatpickr:", error);
            }
        } else {
            console.warn("flatpickr không được tìm thấy");
        }
    }
    
    /**
     * Tải thông tin tổng quan dashboard
     */
    async function loadDashboardSummary() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Gọi API để lấy thông tin tổng quan
            const response = await fetch(`${API_BASE_URL}/booking/admin/dashboard`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Cập nhật UI với dữ liệu tổng quan
                document.getElementById('totalAppointments').textContent = data.stats.total || 0;
                document.getElementById('pendingAppointments').textContent = data.stats.pending || 0;
                document.getElementById('confirmedAppointments').textContent = data.stats.confirmed || 0;
                document.getElementById('completedAppointments').textContent = data.stats.completed || 0;
            }
            
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu tổng quan:', error);
            showErrorMessage('Không thể tải dữ liệu tổng quan: ' + error.message);
        }
    }
    
    /**
     * Tải danh sách lịch hẹn
     */
    async function loadBookings(filters = {}) {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Lưu filters hiện tại để sử dụng lại sau này
            currentFilters = {...filters};
            
            // Hiển thị trạng thái loading
            document.getElementById('bookingsList').innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-3">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Đang tải...</span>
                        </div>
                        <p class="mt-2">Đang tải danh sách lịch hẹn...</p>
                    </td>
                </tr>
            `;
            
            // Hủy DataTable cũ nếu đã tồn tại
            if (dataTable) {
                try {
                    dataTable.destroy();
                    dataTable = null;
                } catch (error) {
                    console.error("Lỗi khi hủy DataTable cũ:", error);
                }
            }
            
            // Xây dựng URL với các bộ lọc
            let url = `${API_BASE_URL}/booking/appointments`;
            const queryParams = [];
            
            if (filters.dateFrom) {
                queryParams.push(`dateFrom=${encodeURIComponent(filters.dateFrom)}`);
            }
            
            if (filters.dateTo) {
                queryParams.push(`dateTo=${encodeURIComponent(filters.dateTo)}`);
            }
            
            if (filters.status) {
                queryParams.push(`status=${encodeURIComponent(filters.status)}`);
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
                // Lưu dữ liệu vào biến toàn cục sau khi đã xử lý an toàn
                bookings = sanitizeData(data.appointments || []);
                isDataLoaded = true;
                
                // QUAN TRỌNG: Gọi hàm render để hiển thị dữ liệu
                renderBookingsTable(bookings);
            } else {
                throw new Error(data.message || 'Không thể tải danh sách lịch hẹn');
            }
            
        } catch (error) {
            console.error('Lỗi khi tải danh sách lịch hẹn:', error);
            showErrorMessage('Không thể tải danh sách lịch hẹn: ' + error.message);
            
            document.getElementById('bookingsList').innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-danger">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Lỗi: ${error.message}
                    </td>
                </tr>
            `;
            isDataLoaded = false;
        }
    }
    
    /**
     * Xử lý dữ liệu để loại bỏ tham chiếu vòng tròn
     */
    function sanitizeData(data) {
        try {
            // Đơn giản hóa bằng cách tạo một bản sao mới
            return JSON.parse(JSON.stringify(data));
        } catch (error) {
            console.error("Lỗi khi xử lý dữ liệu:", error);
            
            // Nếu có lỗi JSON.stringify, thủ công tạo bản sao đơn giản
            if (Array.isArray(data)) {
                return data.map(item => {
                    const newItem = {};
                    for (const key in item) {
                        // Chỉ sao chép các thuộc tính nguyên thủy
                        if (typeof item[key] !== 'object' || item[key] === null) {
                            newItem[key] = item[key];
                        } else if (Array.isArray(item[key])) {
                            newItem[key] = [...item[key]]; // Sao chép nông
                        } else {
                            newItem[key] = {...item[key]}; // Sao chép nông
                        }
                    }
                    return newItem;
                });
            }
            return [];
        }
    }
    
    /**
     * Render bảng lịch hẹn đơn giản không sử dụng DataTables
     */
    function renderBookingsTable(bookingsData) {
        try {
            const tableBody = document.getElementById('bookingsList');
            
            if (!bookingsData || bookingsData.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center">Không có lịch hẹn nào phù hợp với điều kiện lọc</td>
                    </tr>
                `;
                return;
            }
            
            let html = '';
            
            // Xử lý từng booking để tạo HTML
            bookingsData.forEach((booking) => {
                // Format ngày giờ
                const appointmentDate = new Date(booking.AppointmentDate);
                const formattedDate = appointmentDate.toLocaleDateString('vi-VN', {
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit'
                });
                
                const formattedTime = appointmentDate.toLocaleTimeString('vi-VN', {
                    hour: '2-digit', 
                    minute: '2-digit'
                });
                
                // Trạng thái lịch hẹn
                let statusBadge;
                switch (booking.Status) {
                    case 'Pending':
                        statusBadge = '<span class="badge bg-warning">Chờ xác nhận</span>';
                        break;
                    case 'Confirmed':
                        statusBadge = '<span class="badge bg-info">Đã xác nhận</span>';
                        break;
                    case 'Completed':
                        statusBadge = '<span class="badge bg-success">Hoàn thành</span>';
                        break;
                    case 'Canceled':
                        statusBadge = '<span class="badge bg-danger">Đã hủy</span>';
                        break;
                    default:
                        statusBadge = `<span class="badge bg-secondary">${booking.Status}</span>`;
                }
                
                // Thông tin dịch vụ
                const servicesInfo = booking.Services || 'Không có thông tin';
                
                // Tạo các nút thao tác
                let actionButtons = `
                    <button class="btn btn-sm btn-primary action-btn" onclick="viewBookingDetail(${booking.AppointmentID})" title="Xem chi tiết">
                        <i class="bi bi-eye"></i>
                    </button>
                `;
                
                // Nếu lịch hẹn đang ở trạng thái Chờ xác nhận, hiển thị nút xác nhận
                if (booking.Status === 'Pending') {
                    actionButtons += `
                        <button class="btn btn-sm btn-warning action-btn" onclick="confirmAppointment(${booking.AppointmentID})" title="Xác nhận lịch hẹn">
                            <i class="bi bi-check2"></i>
                        </button>
                    `;
                }
                
                // Nếu lịch hẹn chưa hoàn thành và chưa bị hủy, hiển thị nút hoàn thành
                if (booking.Status !== 'Completed' && booking.Status !== 'Canceled') {
                    actionButtons += `
                        <button class="btn btn-sm btn-success action-btn" onclick="completeBookingDirectly(${booking.AppointmentID})" title="Hoàn thành">
                            <i class="bi bi-check-circle"></i>
                        </button>
                    `;
                }
                
                // Nếu lịch hẹn chưa hoàn thành và chưa bị hủy, hiển thị nút hủy
                if (booking.Status !== 'Completed' && booking.Status !== 'Canceled') {
                    actionButtons += `
                        <button class="btn btn-sm btn-danger action-btn" onclick="cancelBookingDirectly(${booking.AppointmentID})" title="Hủy lịch">
                            <i class="bi bi-x-circle"></i>
                        </button>
                    `;
                }
                
                // Tạo HTML cho từng hàng
                html += `
                    <tr>
                        <td>BK${booking.AppointmentID}</td>
                        <td>${booking.FullName || 'N/A'}</td>
                        <td>${booking.PhoneNumber || 'N/A'}</td>
                        <td>${booking.LicensePlate || 'N/A'} ${booking.Brand ? `<br><small>(${booking.Brand} ${booking.Model || ''})</small>` : ''}</td>
                        <td>${formattedDate} <br> ${formattedTime}</td>
                        <td>${servicesInfo}</td>
                        <td>${statusBadge}</td>
                        <td>${actionButtons}</td>
                    </tr>
                `;
            });
            
            // Cập nhật nội dung bảng
            tableBody.innerHTML = html;
            
            // Khởi tạo DataTable đơn giản
            initSimpleDataTable();
            
        } catch (error) {
            console.error("Lỗi khi hiển thị danh sách lịch hẹn:", error);
            showErrorMessage("Lỗi khi hiển thị danh sách lịch hẹn: " + error.message);
            
            // Đảm bảo người dùng vẫn thấy một số thông tin
            const tableBody = document.getElementById('bookingsList');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-danger">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Lỗi khi hiển thị dữ liệu: ${error.message}
                    </td>
                </tr>
            `;
        }
    }
    
    /**
     * Khởi tạo DataTable đơn giản
     */
    function initSimpleDataTable() {
        // Chỉ khởi tạo nếu jQuery và DataTable có sẵn
        if (typeof $ === 'undefined' || !$.fn.DataTable) {
            console.warn("jQuery hoặc DataTable không có sẵn");
            return;
        }
        
        try {
            setTimeout(() => {
                // Nếu đã có DataTable, hủy nó trước
                if ($.fn.DataTable.isDataTable('#bookingsTable')) {
                    $('#bookingsTable').DataTable().destroy();
                }
                
                // Khởi tạo với cài đặt tối thiểu
                dataTable = $('#bookingsTable').DataTable({
                    paging: true,
                    searching: true,
                    ordering: true,
                    responsive: true,
                    language: {
                        "sProcessing":   "Đang xử lý...",
                        "sLengthMenu":   "Hiển thị _MENU_ mục",
                        "sZeroRecords":  "Không tìm thấy dòng nào phù hợp",
                        "sInfo":         "Đang xem _START_ đến _END_ trong tổng số _TOTAL_ mục",
                        "sInfoEmpty":    "Đang xem 0 đến 0 trong tổng số 0 mục",
                        "sInfoFiltered": "(được lọc từ _MAX_ mục)",
                        "sInfoPostFix":  "",
                        "sSearch":       "Tìm:",
                        "sUrl":          "",
                        "oPaginate": {
                            "sFirst":    "Đầu",
                            "sPrevious": "Trước",
                            "sNext":     "Tiếp",
                            "sLast":     "Cuối"
                        }
                    }
                });
                
                // Áp dụng lại bộ lọc trạng thái nếu có
                const statusFilter = document.getElementById('statusFilter').value;
                if (statusFilter) {
                    filterBookingsByStatus(statusFilter);
                }
            }, 100);
        } catch (error) {
            console.error("Lỗi khi khởi tạo DataTable:", error);
        }
    }
    
    /**
     * Áp dụng bộ lọc
     */
    function applyFilters() {
        // Lấy giá trị từ input
        const dateFromInput = document.getElementById('dateFrom').value;
        const dateToInput = document.getElementById('dateTo').value;
        const statusSelect = document.getElementById('statusFilter').value;
        
        // Tạo đối tượng filters
        const filters = {};
        
        // Xử lý ngày từ: d-m-Y -> Y-m-d
        if (dateFromInput) {
            const parts = dateFromInput.split('-');
            if (parts.length === 3) {
                filters.dateFrom = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }
        
        // Xử lý ngày đến: d-m-Y -> Y-m-d
        if (dateToInput) {
            const parts = dateToInput.split('-');
            if (parts.length === 3) {
                filters.dateTo = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }
        
        // Xử lý trạng thái
        if (statusSelect) {
            filters.status = statusSelect;
        }
        
        // Kiểm tra ngày hợp lệ
        if (filters.dateFrom && filters.dateTo) {
            const fromDate = new Date(filters.dateFrom);
            const toDate = new Date(filters.dateTo);
            
            if (fromDate > toDate) {
                showErrorMessage('Ngày bắt đầu không thể lớn hơn ngày kết thúc');
                return;
            }
        }
        
        // Nếu đã có DataTable và chỉ muốn lọc trạng thái trên dữ liệu hiện có
        if (dataTable && isDataLoaded && statusSelect && !dateFromInput && !dateToInput) {
            // Lọc theo trạng thái bằng DataTable
            filterBookingsByStatus(statusSelect);
            return;
        }
        
        // Tải danh sách với bộ lọc từ API
        loadBookings(filters);
        
        // Hiển thị thông báo cho người dùng
        if (Object.keys(filters).length > 0) {
            showSuccessMessage('Đã áp dụng bộ lọc');
        } else {
            showSuccessMessage('Đang hiển thị tất cả lịch hẹn');
        }
    }
    
    /**
     * Lọc danh sách lịch hẹn theo trạng thái sử dụng DataTable
     */
    function filterBookingsByStatus(status) {
        if (!dataTable) return;
        
        try {
            // Xóa các bộ lọc trước đó
            dataTable.search('').columns().search('');
            
            // Áp dụng bộ lọc trạng thái
            if (status) {
                // Chuyển đổi mã trạng thái sang văn bản tiếng Việt để tìm kiếm
                let statusText = '';
                switch (status) {
                    case 'Pending': statusText = 'Chờ xác nhận'; break;
                    case 'Confirmed': statusText = 'Đã xác nhận'; break;
                    case 'Completed': statusText = 'Hoàn thành'; break;
                    case 'Canceled': statusText = 'Đã hủy'; break;
                }
                
                // Tìm chỉ mục của cột trạng thái
                const statusColumnIndex = findColumnIndexByText('Trạng thái');
                
                // Áp dụng tìm kiếm cho cột trạng thái
                if (statusColumnIndex !== -1) {
                    dataTable.column(statusColumnIndex).search(statusText);
                }
            }
            
            // Vẽ lại bảng
            dataTable.draw();
            
            // Hiển thị thông báo kết quả
            const filteredCount = dataTable.page.info().recordsDisplay;
            if (filteredCount === 0) {
                showErrorMessage('Không tìm thấy lịch hẹn nào phù hợp với bộ lọc');
            } else {
                showSuccessMessage(`Đã tìm thấy ${filteredCount} lịch hẹn phù hợp với bộ lọc`);
            }
        } catch (error) {
            console.error("Lỗi khi lọc theo trạng thái:", error);
        }
    }
    
    /**
     * Tìm chỉ mục cột theo tiêu đề
     */
    function findColumnIndexByText(columnText) {
        const headers = document.querySelectorAll('#bookingsTable thead th');
        for (let i = 0; i < headers.length; i++) {
            if (headers[i].textContent.trim() === columnText) {
                return i;
            }
        }
        return -1; // Không tìm thấy
    }
    
    /**
     * Reset bộ lọc
     */
    function resetFilters() {
        // Clear các input
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        document.getElementById('statusFilter').value = '';
        
        // Clear flatpickr instances
        if (typeof flatpickr === 'function') {
            const dateFromInstance = document.querySelector("#dateFrom")._flatpickr;
            const dateToInstance = document.querySelector("#dateTo")._flatpickr;
            
            if (dateFromInstance) {
                dateFromInstance.clear();
                // Reset constraints
                dateFromInstance.set("maxDate", "today");
            }
            
            if (dateToInstance) {
                dateToInstance.clear();
                // Reset constraints
                dateToInstance.set("maxDate", "today");
            }
        }
        
        // Nếu đã có DataTable, reset bộ lọc
        if (dataTable) {
            dataTable.search('').columns().search('').draw();
        }
        
        // Xóa bộ lọc hiện tại
        currentFilters = {};
        
        // Hiển thị thông báo
        showSuccessMessage('Đã xóa bộ lọc');
        
        // Tải lại danh sách không có bộ lọc
        loadBookings();
    }
    
    /**
     * Tải danh sách kỹ thuật viên
     */
    async function loadMechanics() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            const response = await fetch(`${API_BASE_URL}/booking/mechanics`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                mechanics = data.mechanics || [];
                populateMechanicsDropdown();
            } else {
                throw new Error(data.message || 'Không thể tải danh sách kỹ thuật viên');
            }
            
        } catch (error) {
            console.error('Lỗi khi tải danh sách kỹ thuật viên:', error);
            showErrorMessage('Không thể tải danh sách kỹ thuật viên: ' + error.message);
        }
    }
    
    /**
     * Điền danh sách kỹ thuật viên vào dropdown
     */
    function populateMechanicsDropdown() {
        const mechanicSelect = document.getElementById('mechanicId');
        
        if (!mechanicSelect) return;
        
        // Xóa tất cả option cũ trừ option mặc định
        while (mechanicSelect.options.length > 1) {
            mechanicSelect.remove(1);
        }
        
        // Thêm các option mới
        mechanics.forEach(mechanic => {
            const option = document.createElement('option');
            option.value = mechanic.UserID;
            option.textContent = mechanic.FullName;
            mechanicSelect.appendChild(option);
        });
    }
    
    /**
     * Xem chi tiết lịch hẹn
     */
    async function viewBookingDetail(bookingId) {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            selectedBookingId = bookingId;
            
            // Hiển thị trạng thái loading
            document.getElementById('bookingDetailContent').style.display = 'block';
            document.getElementById('bookingDetailForm').style.display = 'none';
            
            // Hiển thị modal
            const modal = new bootstrap.Modal(document.getElementById('bookingDetailModal'));
            modal.show();
            
            // Gọi API
            const response = await fetch(`${API_BASE_URL}/booking/appointments/${bookingId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Hiển thị form và ẩn loading
                document.getElementById('bookingDetailContent').style.display = 'none';
                document.getElementById('bookingDetailForm').style.display = 'block';
                
                // Điền thông tin vào form
                fillBookingDetailForm(data.appointment);
            } else {
                throw new Error(data.message || 'Không thể tải thông tin chi tiết lịch hẹn');
            }
            
        } catch (error) {
            console.error('Lỗi khi tải chi tiết lịch hẹn:', error);
            
            document.getElementById('bookingDetailContent').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Lỗi: ${error.message}
                </div>
            `;
        }
    }
    
    /**
     * Điền thông tin vào form chi tiết lịch hẹn
     */
    function fillBookingDetailForm(booking) {
        // Thông tin cơ bản
        document.getElementById('bookingId').value = booking.AppointmentID;
        document.getElementById('bookingStatus').value = booking.Status;
        
        // Format ngày giờ cho datepicker
        const appointmentDate = new Date(booking.AppointmentDate);
        const formattedDate = appointmentDate.toLocaleDateString('vi-VN', {
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit'
        }).split('/').reverse().join('-');
        
        const formattedTime = appointmentDate.toLocaleTimeString('vi-VN', {
            hour: '2-digit', 
            minute: '2-digit'
        });
        
        document.getElementById('bookingDate').value = `${formattedDate} ${formattedTime}`;
        
        // Thông tin khách hàng
        document.getElementById('customerName').value = booking.FullName || '';
        document.getElementById('customerPhone').value = booking.PhoneNumber || '';
        document.getElementById('customerEmail').value = booking.Email || '';
        
        // Thông tin xe
        document.getElementById('vehicleLicense').value = booking.LicensePlate || '';
        document.getElementById('vehicleInfo').value = `${booking.Brand || ''} ${booking.Model || ''} ${booking.Year ? '(' + booking.Year + ')' : ''}`;
        
        // Ghi chú
        document.getElementById('bookingNotes').value = booking.Notes || '';
        
        // Kỹ thuật viên
        document.getElementById('mechanicId').value = booking.MechanicID || '';
        
        // Dịch vụ
        renderBookingServices(booking.services || []);
        
        // Hiển thị/ẩn nút dựa vào trạng thái
        const cancelBtn = document.getElementById('cancelBookingBtn');
        const completeBtn = document.getElementById('completeBookingBtn');
        
        if (booking.Status === 'Canceled' || booking.Status === 'Completed') {
            cancelBtn.style.display = 'none';
            completeBtn.style.display = 'none';
        } else {
            cancelBtn.style.display = 'inline-block';
            completeBtn.style.display = 'inline-block';
        }
    }
    
    /**
     * Render dịch vụ trong chi tiết lịch hẹn
     */
    function renderBookingServices(services) {
        const servicesTableBody = document.getElementById('servicesTableBody');
        const totalAmountElement = document.getElementById('totalAmount');
        
        if (!services || services.length === 0) {
            servicesTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center">Không có dịch vụ nào</td>
                </tr>
            `;
            totalAmountElement.textContent = formatCurrency(0);
            return;
        }
        
        let html = '';
        let totalAmount = 0;
        
        services.forEach(service => {
            const quantity = service.Quantity || 1;
            const price = service.Price || 0;
            const subtotal = price * quantity;
            
            totalAmount += subtotal;
            
            html += `
                <tr>
                    <td>${service.ServiceName}</td>
                    <td class="text-center">${quantity}</td>
                    <td class="text-end">${formatCurrency(price)}</td>
                    <td class="text-end">${formatCurrency(subtotal)}</td>
                </tr>
            `;
        });
        
        servicesTableBody.innerHTML = html;
        totalAmountElement.textContent = formatCurrency(totalAmount);
    }
    
    /**
     * Hiển thị hộp thoại xác nhận hủy lịch hẹn
     */
    function showCancelConfirmation() {
        if (!selectedBookingId) {
            showErrorMessage('Không có lịch hẹn nào được chọn để hủy');
            return;
        }
        
        // Hiển thị ID lịch hẹn trong modal xác nhận
        document.getElementById('cancelBookingId').textContent = `BK${selectedBookingId}`;
        
        // Hiển thị modal xác nhận
        const modal = new bootstrap.Modal(document.getElementById('confirmCancelModal'));
        modal.show();
    }
    
    /**
     * Hiển thị hộp thoại xác nhận hoàn thành lịch hẹn
     */
    function showCompleteConfirmation() {
        if (!selectedBookingId) {
            showErrorMessage('Không có lịch hẹn nào được chọn để đánh dấu hoàn thành');
            return;
        }
        
        // Hiển thị ID lịch hẹn trong modal xác nhận
        document.getElementById('completeBookingId').textContent = `BK${selectedBookingId}`;
        
        // Hiển thị modal xác nhận
        const modal = new bootstrap.Modal(document.getElementById('confirmCompleteModal'));
        modal.show();
    }
    
    /**
     * Hủy lịch hẹn từ form chi tiết
     */
    async function cancelBooking() {
        if (!selectedBookingId) {
            showErrorMessage('Không có ID lịch hẹn để hủy');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Hiển thị spinner và vô hiệu hóa nút
            const cancelBtn = document.getElementById('confirmCancelButton');
            const cancelSpinner = document.getElementById('cancelSpinner');
            cancelBtn.disabled = true;
            cancelSpinner.classList.remove('d-none');
            
            // Gọi API
            const response = await fetch(`${API_BASE_URL}/booking/appointments/${selectedBookingId}/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Đóng modal xác nhận
                const confirmModal = bootstrap.Modal.getInstance(document.getElementById('confirmCompleteModal'));
                    if (confirmModal) {
                        confirmModal.hide();
                    }
                
                // Đóng modal chi tiết nếu đang mở
                 const detailModal = bootstrap.Modal.getInstance(document.getElementById('bookingDetailModal'));
                    if (detailModal) {
                        detailModal.hide();
                    }
                
                // Hiển thị thông báo thành công
                showSuccessMessage('Hủy lịch hẹn thành công');
                
                // Tải lại danh sách lịch hẹn
                loadBookings(currentFilters);
                loadDashboardSummary();
            } else {
                throw new Error(data.message || 'Không thể hủy lịch hẹn');
            }
            
        } catch (error) {
            console.error('Lỗi khi hủy lịch hẹn:', error);
            showErrorMessage('Không thể hủy lịch hẹn: ' + error.message);
        } finally {
            // Khôi phục trạng thái nút
            const cancelBtn = document.getElementById('confirmCancelButton');
            const cancelSpinner = document.getElementById('cancelSpinner');
            cancelBtn.disabled = false;
            cancelSpinner.classList.add('d-none');
        }
    }
    
    /**
     * Hủy lịch hẹn trực tiếp từ bảng
     */
    function cancelBookingDirectly(bookingId) {
        selectedBookingId = bookingId;
        document.getElementById('cancelBookingId').textContent = `BK${bookingId}`;
        
        // Hiển thị modal xác nhận
        const modal = new bootstrap.Modal(document.getElementById('confirmCancelModal'));
        modal.show();
    }
    
    /**
     * Xác nhận lịch hẹn trực tiếp từ bảng
     */
    async function confirmAppointment(bookingId) {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Hiển thị thông báo xác nhận
            if (confirm('Bạn có chắc chắn muốn xác nhận lịch hẹn này?')) {
                // Dữ liệu cập nhật
                const updateData = {
                    status: 'Confirmed'
                };
                
                // Gọi API
                const response = await fetch(`${API_BASE_URL}/booking/appointments/${bookingId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(updateData)
                });
                
                if (!response.ok) {
                    throw new Error(`Lỗi HTTP: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.success) {
                    // Hiển thị thông báo thành công
                    showSuccessMessage('Xác nhận lịch hẹn thành công');
                    
                    // Tải lại danh sách lịch hẹn
                    loadBookings(currentFilters);
                    loadDashboardSummary();
                } else {
                    throw new Error(data.message || 'Không thể xác nhận lịch hẹn');
                }
            }
        } catch (error) {
            console.error('Lỗi khi xác nhận lịch hẹn:', error);
            showErrorMessage('Không thể xác nhận lịch hẹn: ' + error.message);
        }
    }
    
    /**
     * Hoàn thành lịch hẹn từ form chi tiết
     */
    async function completeBooking() {
        if (!selectedBookingId) {
            showErrorMessage('Không có ID lịch hẹn để hoàn thành');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Hiển thị spinner và vô hiệu hóa nút
            const completeBtn = document.getElementById('confirmCompleteButton');
            const completeSpinner = document.getElementById('completeSpinner');
            completeBtn.disabled = true;
            completeSpinner.classList.remove('d-none');
            
            // Dữ liệu cập nhật
            const updateData = {
                status: 'Completed'
            };
            
            // Gọi API
            const response = await fetch(`${API_BASE_URL}/booking/appointments/${selectedBookingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updateData)
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Đóng modal xác nhận
               const confirmModal = bootstrap.Modal.getInstance(document.getElementById('confirmCompleteModal'));
                if (confirmModal) {
                    confirmModal.hide();
                }
                
                // Đóng modal chi tiết nếu đang mở
                const detailModal = bootstrap.Modal.getInstance(document.getElementById('bookingDetailModal'));
                if (detailModal) {
                    detailModal.hide();
                }
                
                // Hiển thị thông báo thành công
                showSuccessMessage('Đã đánh dấu lịch hẹn là hoàn thành');
                
                // Tải lại danh sách lịch hẹn
                loadBookings(currentFilters);
                loadDashboardSummary();
            } else {
                throw new Error(data.message || 'Không thể hoàn thành lịch hẹn');
            }
            
        } catch (error) {
            console.error('Lỗi khi hoàn thành lịch hẹn:', error);
            showErrorMessage('Không thể hoàn thành lịch hẹn: ' + error.message);
        } finally {
            // Khôi phục trạng thái nút
            const completeBtn = document.getElementById('confirmCompleteButton');
            const completeSpinner = document.getElementById('completeSpinner');
            completeBtn.disabled = false;
            completeSpinner.classList.add('d-none');
        }
    }
    
    /**
     * Hoàn thành lịch hẹn trực tiếp từ bảng
     */
    function completeBookingDirectly(bookingId) {
        selectedBookingId = bookingId;
        document.getElementById('completeBookingId').textContent = `BK${bookingId}`;
        
        // Hiển thị modal xác nhận
        const modal = new bootstrap.Modal(document.getElementById('confirmCompleteModal'));
        modal.show();
    }
    
    /**
     * Cập nhật lịch hẹn
     */
    async function saveBooking() {
        if (!selectedBookingId) {
            showErrorMessage('Không có ID lịch hẹn để cập nhật');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Hiển thị spinner và vô hiệu hóa nút
            const saveBtn = document.getElementById('saveBookingBtn');
            const originalBtnText = saveBtn.innerHTML;
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Đang lưu...';
            
            // Lấy dữ liệu từ form
            const status = document.getElementById('bookingStatus').value;
            const notes = document.getElementById('bookingNotes').value;
            const mechanicId = document.getElementById('mechanicId').value;
            
            // Xử lý ngày giờ
            const dateTimeStr = document.getElementById('bookingDate').value;
            let appointmentDate = '';
            
            if (dateTimeStr) {
                // Chuyển định dạng ngày giờ từ d-m-Y H:i sang Y-m-d H:i:s
                const [datePart, timePart] = dateTimeStr.split(' ');
                if (datePart && timePart) {
                    const [day, month, year] = datePart.split('-');
                    appointmentDate = `${year}-${month}-${day} ${timePart}:00`;
                }
            }
            
            // Dữ liệu cập nhật
            const updateData = {
                status,
                notes,
                mechanicId: mechanicId || null,
                appointmentDate
            };
            
            // Gọi API
            const response = await fetch(`${API_BASE_URL}/booking/appointments/${selectedBookingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updateData)
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Đóng modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('bookingDetailModal'));
                if (modal) {
                    modal.hide();
                }
                                
                // Hiển thị thông báo thành công
                showSuccessMessage('Cập nhật lịch hẹn thành công');
                
                // Tải lại danh sách lịch hẹn
                loadBookings(currentFilters);
                loadDashboardSummary();
            } else {
                throw new Error(data.message || 'Không thể cập nhật lịch hẹn');
            }
            
        } catch (error) {
            console.error('Lỗi khi cập nhật lịch hẹn:', error);
            showErrorMessage('Không thể cập nhật lịch hẹn: ' + error.message);
        } finally {
            // Khôi phục trạng thái nút
            const saveBtn = document.getElementById('saveBookingBtn');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="bi bi-save me-1"></i> Cập nhật';
        }
    }
    
    /**
     * Đăng xuất
     */
    function logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
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
    
    /**
     * Format số thành định dạng tiền tệ VNĐ
     */
    function formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0
        }).format(amount);
    }
});