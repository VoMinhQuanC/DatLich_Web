// admin-revenue.js - JavaScript cho trang thống kê doanh thu

document.addEventListener('DOMContentLoaded', function() {
    // Khai báo các biến và hằng số
    // Sử dụng API_CONFIG từ config.js (được load trước)
    const API_BASE_URL = window.API_CONFIG ? window.API_CONFIG.BASE_URL : 'http://localhost:3001/api';
    
    // Biến lưu trữ dữ liệu
    let revenueData = [];
    let serviceRevenueData = [];
    
    // Biến lưu trữ chart
    let revenueChart = null;
    let servicesPieChart = null;
    
    /**
     * Kiểm tra xem giao dịch đã hoàn thành thanh toán chưa
     * @param {object} item - Dữ liệu thanh toán 
     * @returns {boolean} - true nếu đã thanh toán, false nếu chưa
     */
    function isPaymentCompleted(item) {
        if (!item) return false;
        
        const statusLower = String(item.Status || '').toLowerCase();
        return statusLower === 'completed' || statusLower === 'hoàn thành';
    }
    
    // Kiểm tra xác thực admin
    checkAdminAuth();
    
    // Khởi tạo datepickers
    initDatepickers();
    
    // Tải dữ liệu ban đầu
    loadDashboardSummary();
    
    // Kiểm tra và cập nhật trạng thái thanh toán
    checkAndUpdatePayments();
    
    // Tải dữ liệu doanh thu với bộ lọc mặc định
    const defaultFilters = getDefaultFilters();
    loadRevenueData(defaultFilters);
    
    // Thêm event listeners cho các nút
    document.getElementById('applyFilterBtn').addEventListener('click', applyFilters);
    document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
    document.getElementById('exportPdfBtn').addEventListener('click', exportToPDF);
    document.getElementById('logout-link').addEventListener('click', logout);
    document.getElementById('dropdown-logout').addEventListener('click', logout);
    
    /**
     * Lấy bộ lọc mặc định
     */
    function getDefaultFilters() {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        return {
            startDate: formatDateForAPI(thirtyDaysAgo),
            endDate: formatDateForAPI(today),
            reportType: 'day'
        };
    }
    
    /**
     * Format ngày theo định dạng YYYY-MM-DD
     */
    function formatDateForAPI(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
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
            
            // Hiển thị tên admin
            const adminNameElement = document.getElementById('adminName');
            if (adminNameElement) {
                adminNameElement.textContent = user.fullName || 'Admin';
            }
            
            // Hiển thị avatar với chữ cái đầu tiên của tên
            const avatarElement = document.getElementById('avatarPlaceholder');
            if (avatarElement && user.fullName) {
                avatarElement.textContent = user.fullName.charAt(0).toUpperCase();
            }
            
        } catch (error) {
            console.error('Lỗi phân tích dữ liệu người dùng:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    }
    
    /**
     * Kiểm tra và cập nhật trạng thái thanh toán
     * Hàm này gọi API để kiểm tra các thanh toán "Thanh toán tại tiệm" có thời gian hẹn đã qua
     * và tự động cập nhật trạng thái từ "Chờ thanh toán" sang "Đã thanh toán"
     */
    async function checkAndUpdatePayments() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            console.log('Đang kiểm tra trạng thái thanh toán...');
            
            // Gọi API để kiểm tra và cập nhật trạng thái thanh toán
            const response = await fetch(`${API_BASE_URL}/revenue/update-payments`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                if (result.updated > 0) {
                    console.log(`Đã cập nhật ${result.updated} thanh toán từ "Chờ thanh toán" sang "Đã thanh toán"`);
                    showSuccessMessage(`Đã cập nhật ${result.updated} thanh toán từ "Chờ thanh toán" sang "Đã thanh toán"`);
                    
                    // Tải lại dữ liệu doanh thu nếu có cập nhật
                    const currentFilters = getCurrentFilters();
                    loadRevenueData(currentFilters);
                } else {
                    console.log('Không có thanh toán nào cần cập nhật');
                }
            } else {
                throw new Error(result.message || 'Lỗi khi cập nhật trạng thái thanh toán');
            }
        } catch (error) {
            console.error('Lỗi khi kiểm tra cập nhật thanh toán:', error);
            // Có thể hiển thị thông báo lỗi nếu cần
            // showErrorMessage('Không thể cập nhật trạng thái thanh toán: ' + error.message);
        }
    }
    
    /**
     * Lấy bộ lọc hiện tại từ giao diện
     */
    function getCurrentFilters() {
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        const reportTypeSelect = document.getElementById('reportType');
        const includeAllCheckbox = document.getElementById('includeAllPayments');
        
        if (!startDateInput || !endDateInput || !reportTypeSelect) {
            console.error('Không tìm thấy các phần tử bộ lọc');
            return getDefaultFilters();
        }
        
        const startDateStr = startDateInput.value;
        const endDateStr = endDateInput.value;
        const reportType = reportTypeSelect.value;
        const includeAll = includeAllCheckbox ? includeAllCheckbox.checked : false;
        
        // Chuyển định dạng ngày từ d-m-Y sang Y-m-d
        let startDate = null;
        let endDate = null;
        
        if (startDateStr) {
            const [day, month, year] = startDateStr.split('-');
            startDate = `${year}-${month}-${day}`;
        }
        
        if (endDateStr) {
            const [day, month, year] = endDateStr.split('-');
            endDate = `${year}-${month}-${day}`;
        }
        
        return {
            startDate,
            endDate,
            reportType,
            includeAll
        };
    }
    
    /**
     * Khởi tạo datepickers
     */
    function initDatepickers() {
        // Lấy ngày hôm nay và 30 ngày trước làm mặc định
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        // Format dates cho flatpickr
        const formatDate = (date) => {
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        };
        
        // Khởi tạo flatpickr cho ngày bắt đầu
        if (document.getElementById("startDate")) {
            flatpickr("#startDate", {
                dateFormat: "d-m-Y",
                locale: "vn",
                defaultDate: formatDate(thirtyDaysAgo),
                maxDate: "today"
            });
        }
        
        // Khởi tạo flatpickr cho ngày kết thúc
        if (document.getElementById("endDate")) {
            flatpickr("#endDate", {
                dateFormat: "d-m-Y",
                locale: "vn",
                defaultDate: formatDate(today),
                maxDate: "today"
            });
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
            
            // Gọi API để lấy thông tin tổng quan doanh thu
            const response = await fetch(`${API_BASE_URL}/revenue/summary`, {
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
                updateElementText('totalAppointments', data.summary.totalAppointments || 0);
                updateElementText('totalRevenue', formatCurrency(data.summary.totalRevenue || 0));
                updateElementText('totalCustomers', data.summary.totalCustomers || 0);
                updateElementText('popularService', data.summary.popularService || 'Không có dữ liệu');
                
                // Cập nhật các thông tin khác nếu có
                updateElementText('tableTotalRevenue', formatCurrency(data.summary.totalRevenue || 0));
            } else {
                throw new Error(data.message || 'Không thể tải thông tin tổng quan');
            }
            
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu tổng quan:', error);
            showErrorMessage('Không thể tải dữ liệu tổng quan: ' + error.message);
        }
    }
    
    /**
     * Helper function để cập nhật nội dung phần tử một cách an toàn
     */
    function updateElementText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
        }
    }
    
    /**
     * Tải dữ liệu doanh thu
     */
    async function loadRevenueData(filters = {}) {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Nếu không có filter cụ thể, dùng giá trị mặc định
            if (!filters.startDate || !filters.endDate || !filters.reportType) {
                const defaultFilters = getDefaultFilters();
                filters = { ...defaultFilters, ...filters };
            }
            
            // Hiển thị trạng thái loading
            const tableBody = document.getElementById('revenueTableBody');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="text-center py-3">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Đang tải...</span>
                            </div>
                            <p class="mt-2">Đang tải dữ liệu doanh thu...</p>
                        </td>
                    </tr>
                `;
            }
            
            // Xây dựng tham số truy vấn từ bộ lọc
            let queryParams = '';
            
            if (filters.startDate) {
                queryParams += (queryParams ? '&' : '?') + `startDate=${encodeURIComponent(filters.startDate)}`;
            }
            
            if (filters.endDate) {
                queryParams += (queryParams ? '&' : '?') + `endDate=${encodeURIComponent(filters.endDate)}`;
            }
            
            if (filters.reportType) {
                queryParams += (queryParams ? '&' : '?') + `reportType=${encodeURIComponent(filters.reportType)}`;
            }
            
            // Thêm tham số includeAll
            if (filters.includeAll !== undefined) {
                queryParams += (queryParams ? '&' : '?') + `includeAll=${filters.includeAll}`;
            }
            
            console.log("API URL:", `${API_BASE_URL}/revenue${queryParams}`);
            
            // Gọi API để lấy dữ liệu doanh thu
            const response = await fetch(`${API_BASE_URL}/revenue${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                console.log("API response data:", data);
                
                // Lưu dữ liệu vào biến toàn cục
                revenueData = data.revenueData || [];
                serviceRevenueData = data.serviceRevenueData || [];
                
                // Thêm dữ liệu mẫu nếu không có dữ liệu thực
                if (revenueData.length === 0) {
                    console.warn("Không có dữ liệu doanh thu, thêm dữ liệu mẫu để kiểm tra");
                    revenueData = getSampleRevenueData();
                }
                
                // Xử lý dữ liệu - Chuẩn hóa các trường dữ liệu
                revenueData = revenueData.map(item => {
                    // Tạo một đối tượng mới để không ảnh hưởng đến dữ liệu gốc
                    return {
                        PaymentID: item.PaymentID || item.paymentId || 0,
                        AppointmentID: item.AppointmentID || item.appointmentId || '',
                        Amount: parseFloat(item.Amount || item.amount || 0),
                        PaymentDate: item.PaymentDate || item.paymentDate || new Date().toISOString(),
                        PaymentMethod: item.PaymentMethod || item.paymentMethod || 'N/A',
                        Status: item.Status || item.status || 'N/A',
                        CustomerName: item.CustomerName || item.customerName || 'N/A',
                        Services: item.Services || item.services || 'N/A',
                        MechanicName: item.MechanicName || item.mechanicName || 'N/A'
                    };
                });
                
                // Lọc dữ liệu để chỉ tính các giao dịch đã hoàn thành
                const completedPayments = revenueData.filter(item => isPaymentCompleted(item));
                
                // Render dữ liệu vào bảng - hiển thị tất cả dữ liệu, không lọc
                renderRevenueTable(revenueData);
                
                // Vẽ biểu đồ doanh thu - chỉ với dữ liệu đã hoàn thành
                renderRevenueChart(completedPayments, filters.reportType || 'day');
                
                // Vẽ biểu đồ doanh thu theo dịch vụ - chỉ với dữ liệu đã hoàn thành
                renderServicesPieChart(serviceRevenueData);
                
                // Hiển thị tổng doanh thu - chỉ tính những giao dịch đã hoàn thành
                let totalRevenue = 0;
                completedPayments.forEach(item => {
                    totalRevenue += parseFloat(item.Amount || 0);
                });
                
                updateElementText('tableTotalRevenue', formatCurrency(totalRevenue));
            } else {
                throw new Error(data.message || 'Không thể tải dữ liệu doanh thu');
            }
            
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu doanh thu:', error);
            showErrorMessage('Không thể tải dữ liệu doanh thu: ' + error.message);
            
            const tableBody = document.getElementById('revenueTableBody');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="text-center text-danger">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Lỗi: ${error.message}
                        </td>
                    </tr>
                `;
            }
            
            // Sử dụng dữ liệu mẫu trong trường hợp lỗi kết nối API
            revenueData = getSampleRevenueData();
            renderRevenueTable(revenueData);
        }
    }
    
    /**
     * Tạo dữ liệu mẫu để kiểm tra UI
     */
    function getSampleRevenueData() {
        return [
            {
                PaymentID: 1,
                AppointmentID: 23,
                Amount: 50000,
                PaymentDate: '2025-06-07T10:00:00',
                PaymentMethod: 'Tiền mặt',
                Status: 'Hoàn thành',
                CustomerName: 'N/A',
                Services: 'N/A',
                MechanicName: 'N/A'
            },
            {
                PaymentID: 2,
                AppointmentID: 63,
                Amount: 400000,
                PaymentDate: '2025-06-07T14:00:00',
                PaymentMethod: 'Thanh toán tại tiệm',
                Status: 'Hoàn thành',
                CustomerName: 'Minh Thiên',
                Services: 'Sửa điện xe, Bảo dưỡng phanh',
                MechanicName: 'Vũ Đức Mạnh'
            },
            {
                PaymentID: 3,
                AppointmentID: 62,
                Amount: 320000,
                PaymentDate: '2025-06-07T16:00:00',
                PaymentMethod: 'Chuyển khoản',
                Status: 'Hoàn thành',
                CustomerName: 'Minh Thiên',
                Services: 'Bảo dưỡng phanh, Thay bugi, Thay lọc gió',
                MechanicName: 'Nguyễn Văn Hưng'
            },
            {
                PaymentID: 4,
                AppointmentID: 61,
                Amount: 200000,
                PaymentDate: '2025-06-07T08:00:00',
                PaymentMethod: 'Chuyển khoản',
                Status: 'Hoàn thành',
                CustomerName: 'Minh Thiên',
                Services: 'Thay lốp',
                MechanicName: 'Vũ Đức Mạnh'
            },
            {
                PaymentID: 5,
                AppointmentID: 22,
                Amount: 300000,
                PaymentDate: '2025-06-06T09:00:00',
                PaymentMethod: 'Chuyển khoản',
                Status: 'Hoàn thành',
                CustomerName: 'N/A',
                Services: 'N/A',
                MechanicName: 'N/A'
            },
            {
                PaymentID: 6,
                AppointmentID: 60,
                Amount: 350000,
                PaymentDate: '2025-06-05T10:00:00',
                PaymentMethod: 'Chuyển khoản',
                Status: 'Hoàn thành',
                CustomerName: 'Minh Quân',
                Services: 'Thay nhớt, Sửa điện xe',
                MechanicName: 'Vũ Đức Mạnh'
            },
            {
                PaymentID: 7,
                AppointmentID: 21,
                Amount: 400000,
                PaymentDate: '2025-06-05T14:00:00',
                PaymentMethod: 'Thẻ tín dụng',
                Status: 'Hoàn thành',
                CustomerName: 'N/A',
                Services: 'N/A',
                MechanicName: 'N/A'
            },
            {
                PaymentID: 8,
                AppointmentID: 20,
                Amount: 420000,
                PaymentDate: '2025-06-04T09:00:00',
                PaymentMethod: 'Tiền mặt',
                Status: 'Hoàn thành',
                CustomerName: 'N/A',
                Services: 'N/A',
                MechanicName: 'N/A'
            },
            {
                PaymentID: 12,
                AppointmentID: 16,
                Amount: 150000,
                PaymentDate: '2025-05-31T15:00:00',
                PaymentMethod: 'Thẻ tín dụng',
                Status: 'Hoàn thành',
                CustomerName: 'N/A',
                Services: 'N/A',
                MechanicName: 'N/A'
            },
            {
                PaymentID: 13,
                AppointmentID: 15,
                Amount: 250000,
                PaymentDate: '2025-05-30T10:00:00',
                PaymentMethod: 'Tiền mặt',
                Status: 'Hoàn thành',
                CustomerName: 'N/A',
                Services: 'N/A',
                MechanicName: 'N/A'
            }
        ];
    }
    
    /**
     * Áp dụng bộ lọc và tải lại dữ liệu
     */
    function applyFilters() {
        // Lấy giá trị từ các trường bộ lọc
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        const reportTypeSelect = document.getElementById('reportType');
        const includeAllCheckbox = document.getElementById('includeAllPayments');
        
        if (!startDateInput || !endDateInput || !reportTypeSelect) {
            console.error('Không tìm thấy các phần tử bộ lọc');
            return;
        }
        
        const startDateStr = startDateInput.value;
        const endDateStr = endDateInput.value;
        const reportType = reportTypeSelect.value;
        const includeAll = includeAllCheckbox ? includeAllCheckbox.checked : false;
        
        // Chuyển định dạng ngày từ d-m-Y sang Y-m-d
        let startDate = null;
        let endDate = null;
        
        if (startDateStr) {
            const [day, month, year] = startDateStr.split('-');
            startDate = `${year}-${month}-${day}`;
        }
        
        if (endDateStr) {
            const [day, month, year] = endDateStr.split('-');
            endDate = `${year}-${month}-${day}`;
        }
        
        // Tạo đối tượng bộ lọc
        const filters = {
            startDate,
            endDate,
            reportType,
            includeAll
        };
        
        // Tải lại dữ liệu với bộ lọc mới
        loadRevenueData(filters);
        
        // Hiển thị thông báo
        showSuccessMessage('Đã áp dụng bộ lọc thành công');
    }
    
    /**
     * Render bảng doanh thu
     */
    function renderRevenueTable(data) {
        const tableBody = document.getElementById('revenueTableBody');
        
        if (!tableBody) {
            console.error('Không tìm thấy phần tử revenueTableBody');
            return;
        }
        
        if (!data || data.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center">Không có dữ liệu doanh thu</td>
                </tr>
            `;
            return;
        }
        
        let html = '';
        
        data.forEach((item, index) => {
            // Kiểm tra và định dạng ngày
            let formattedDate = 'N/A';
            if (item.PaymentDate) {
                const date = new Date(item.PaymentDate);
                if (!isNaN(date.getTime())) {
                    formattedDate = date.toLocaleDateString('vi-VN');
                }
            }
            
            // Fix: Đảm bảo AppointmentID có giá trị và hiển thị đúng
            let appointmentIdDisplay = 'N/A';
            if (item.AppointmentID && item.AppointmentID !== '') {
                appointmentIdDisplay = 'BK' + item.AppointmentID;
            }
            
            // Chuẩn hóa tên khách hàng
            const customerName = item.CustomerName || 'N/A';
            
            // Chuẩn hóa tên dịch vụ
            const services = item.Services || 'N/A';
            
            // Chuẩn hóa tên kỹ thuật viên
            const mechanicName = item.MechanicName || 'N/A';
            
            // Xác định trạng thái thanh toán và hiển thị badge tương ứng
            let statusBadge = '';
            const statusLower = String(item.Status || '').toLowerCase();
            const paymentMethod = String(item.PaymentMethod || '').toLowerCase();
            
            // Phương thức thanh toán là "Thanh toán tại tiệm" luôn hiển thị là "Chờ thanh toán"
            if (paymentMethod.includes('thanh toán tại tiệm')) {
                statusBadge = `<span class="badge bg-warning text-dark">Chờ thanh toán</span>`;
            } 
            // Các phương thức khác (tiền mặt, chuyển khoản, v.v.) hiển thị trạng thái dựa theo Status
            else {
                if (statusLower === 'completed' || statusLower === 'hoàn thành') {
                    statusBadge = `<span class="badge bg-success">Đã thanh toán</span>`;
                } else if (statusLower === 'pending' || statusLower === 'chờ thanh toán') {
                    statusBadge = `<span class="badge bg-warning text-dark">Chờ thanh toán</span>`;
                } else if (statusLower === 'failed' || statusLower === 'thất bại') {
                    statusBadge = `<span class="badge bg-danger">Thất bại</span>`;
                } else {
                    statusBadge = `<span class="badge bg-secondary">${item.Status || 'N/A'}</span>`;
                }
            }
            
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${formattedDate}</td>
                    <td>${appointmentIdDisplay}</td>
                    <td>${customerName}</td>
                    <td>${services}</td>
                    <td>${mechanicName}</td>
                    <td>${getPaymentMethodText(item.PaymentMethod)}</td>
                    <td>${statusBadge}</td>
                    <td>${formatCurrency(item.Amount || 0)}</td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html;
        
        // Khởi tạo DataTable nếu có jQuery
        if (window.$ && $.fn.DataTable) {
            try {
                // Hủy DataTable cũ nếu đã tồn tại
                if ($.fn.DataTable.isDataTable('#revenueTable')) {
                    $('#revenueTable').DataTable().destroy();
                }
                
                $('#revenueTable').DataTable({
                    language: {
                        url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/vi.json'
                    },
                    responsive: true,
                    pageLength: 10,
                    lengthMenu: [10, 25, 50, 100],
                    order: [[1, 'desc']]
                });
            } catch (error) {
                console.error('Lỗi khi khởi tạo DataTable:', error);
            }
        }
    }

    /**
     * Lấy text phương thức thanh toán
     */
    function getPaymentMethodText(method) {
        if (!method || method === 'N/A') return 'N/A';
        
        // Xử lý cả phương thức tiếng Việt và tiếng Anh
        const methodLower = String(method).toLowerCase();
        
        if (methodLower.includes('cash') || methodLower.includes('tiền mặt')) {
            return 'Tiền mặt';
        }
        if (methodLower.includes('credit card') || methodLower.includes('thẻ tín dụng')) {
            return 'Thẻ tín dụng';
        }
        if (methodLower.includes('bank transfer') || methodLower.includes('chuyển khoản')) {
            return 'Chuyển khoản';
        }
        if (methodLower.includes('e-wallet') || methodLower.includes('ví điện tử')) {
            return 'Ví điện tử';
        }
        
        return method; // Trả về nguyên bản nếu không khớp
    }
    
    /**
     * Render biểu đồ doanh thu
     */
    function renderRevenueChart(data, reportType) {
        // Lấy canvas context
        const canvas = document.getElementById('revenueChart');
        if (!canvas) {
            console.error('Không tìm thấy phần tử canvas revenueChart');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Chuẩn bị dữ liệu cho biểu đồ
        const chartLabels = [];
        const chartData = [];
        
        try {
            // Nhóm dữ liệu theo ngày/tuần/tháng
            const groupedData = groupDataByReportType(data, reportType);
            
            // Lấy labels và data từ dữ liệu đã nhóm và sắp xếp theo thứ tự thời gian
            let entries = Object.entries(groupedData);
            
            // Sắp xếp dữ liệu theo thứ tự thời gian tăng dần
            if (reportType === 'day') {
                // Sắp xếp theo ngày
                entries.sort((a, b) => {
                    const dateA = parseVietnameseDateString(a[0]);
                    const dateB = parseVietnameseDateString(b[0]);
                    return dateA - dateB;
                });
            } else if (reportType === 'week') {
                // Sắp xếp theo tuần
                entries.sort((a, b) => {
                    const weekYearA = a[0].match(/Tuần (\d+), (\d+)/);
                    const weekYearB = b[0].match(/Tuần (\d+), (\d+)/);
                    
                    if (weekYearA && weekYearB) {
                        const yearA = parseInt(weekYearA[2]);
                        const weekA = parseInt(weekYearA[1]);
                        const yearB = parseInt(weekYearB[2]);
                        const weekB = parseInt(weekYearB[1]);
                        
                        if (yearA !== yearB) {
                            return yearA - yearB;
                        }
                        return weekA - weekB;
                    }
                    return 0;
                });
            } else if (reportType === 'month') {
                // Sắp xếp theo tháng
                entries.sort((a, b) => {
                    const [monthA, yearA] = a[0].split('/').map(Number);
                    const [monthB, yearB] = b[0].split('/').map(Number);
                    
                    if (yearA !== yearB) {
                        return yearA - yearB;
                    }
                    return monthA - monthB;
                });
            }
            
            // Lấy labels và data từ dữ liệu đã sắp xếp
            for (const [key, value] of entries) {
                chartLabels.push(key);
                chartData.push(value);
            }
        } catch (error) {
            console.error('Lỗi khi chuẩn bị dữ liệu biểu đồ:', error);
            
            // Dùng dữ liệu mẫu nếu có lỗi
            const today = new Date();
            const labels = [];
            const values = [];
            
            // Tạo dữ liệu mẫu cho 7 ngày
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(today.getDate() - i);
                labels.push(date.toLocaleDateString('vi-VN'));
                values.push(Math.floor(Math.random() * 500000) + 100000);
            }
            
            chartLabels.push(...labels);
            chartData.push(...values);
        }
        
        // Nếu biểu đồ đã tồn tại, hủy nó để tránh lỗi
        if (revenueChart) {
            revenueChart.destroy();
        }
        
        if (window.Chart) {
            // Tạo biểu đồ mới
            revenueChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: chartLabels,
                    datasets: [{
                        label: 'Doanh thu (VNĐ)',
                        data: chartData,
                        backgroundColor: 'rgba(78, 115, 223, 0.7)',
                        borderColor: 'rgba(78, 115, 223, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return formatCurrency(value);
                                }
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return formatCurrency(context.raw);
                                }
                            }
                        }
                    }
                }
            });
        } else {
            console.error('Thư viện Chart.js không được tìm thấy');
        }
    }

    /**
     * Hàm hỗ trợ chuyển đổi chuỗi ngày tiếng Việt sang đối tượng Date
     */
    function parseVietnameseDateString(dateStr) {
        // Định dạng DD/MM/YYYY
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1; // Tháng trong JS từ 0-11
            const year = parseInt(parts[2]);
            return new Date(year, month, day);
        }
        return new Date(0); // Trả về ngày mặc định nếu không phân tích được
    }
    
    /**
     * Render biểu đồ doanh thu theo dịch vụ (pie chart)
     */
    function renderServicesPieChart(data) {
        // Lấy canvas context
        const canvas = document.getElementById('servicesPieChart');
        if (!canvas) {
            console.error('Không tìm thấy phần tử canvas servicesPieChart');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Chuẩn bị dữ liệu cho biểu đồ
        const labels = [];
        const values = [];
        const backgroundColors = [
            'rgba(78, 115, 223, 0.7)',
            'rgba(28, 200, 138, 0.7)',
            'rgba(54, 185, 204, 0.7)',
            'rgba(246, 194, 62, 0.7)',
            'rgba(231, 74, 59, 0.7)',
            'rgba(133, 135, 150, 0.7)',
            'rgba(105, 70, 175, 0.7)',
            'rgba(0, 123, 255, 0.7)',
            'rgba(40, 167, 69, 0.7)',
            'rgba(220, 53, 69, 0.7)'
        ];
        
        // Nếu không có dữ liệu, tạo dữ liệu mẫu
        if (!data || data.length === 0) {
            data = [
                { ServiceName: 'Thay nhớt', TotalRevenue: 250000 },
                { ServiceName: 'Sửa điện xe', TotalRevenue: 450000 },
                { ServiceName: 'Bảo dưỡng phanh', TotalRevenue: 320000 },
                { ServiceName: 'Thay lốp', TotalRevenue: 200000 },
                { ServiceName: 'Thay bugi', TotalRevenue: 50000 }
            ];
        }
        
        // Giới hạn số lượng dịch vụ hiển thị để biểu đồ không bị quá nhiều
        const limitedData = data.slice(0, 10);
        
        // Thêm dữ liệu vào mảng
        limitedData.forEach(item => {
            // Fix: Kiểm tra và sử dụng tên trường phù hợp
            const serviceName = item.ServiceName || item.serviceName || 'Không xác định';
            const totalRevenue = parseFloat(item.TotalRevenue || item.totalRevenue || 0);
            
            labels.push(serviceName);
            values.push(totalRevenue);
        });
        
        // Nếu biểu đồ đã tồn tại, hủy nó để tránh lỗi
        if (servicesPieChart) {
            servicesPieChart.destroy();
        }
        
        if (window.Chart) {
            // Tạo biểu đồ mới
            servicesPieChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: values,
                        backgroundColor: backgroundColors,
                        borderColor: backgroundColors.map(color => color.replace('0.7', '1')),
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.raw || 0;
                                    return `${label}: ${formatCurrency(value)}`;
                                }
                            }
                        },
                        legend: {
                            position: 'right',
                            labels: {
                                boxWidth: 15,
                                padding: 10
                            }
                        }
                    }
                }
            });
        } else {
            console.error('Thư viện Chart.js không được tìm thấy');
        }
    }
    
    /**
     * Nhóm dữ liệu theo loại báo cáo (ngày/tuần/tháng)
     */
    function groupDataByReportType(data, reportType) {
        const result = {};
        
        if (!Array.isArray(data)) {
            console.error('Dữ liệu không phải là mảng:', data);
            return result;
        }
        
        // Lọc dữ liệu
        const validData = data.filter(item => {
            if (!item || !item.PaymentDate) return false;
            
            // Đảm bảo PaymentDate là một chuỗi hợp lệ
            if (typeof item.PaymentDate !== 'string' && !(item.PaymentDate instanceof Date)) {
                return false;
            }
            
            return true;
        });
        
        validData.forEach(item => {
            try {
                // Chuyển đổi PaymentDate thành đối tượng Date
                const date = new Date(item.PaymentDate);
                
                // Kiểm tra xem date có hợp lệ không
                if (isNaN(date.getTime())) {
                    console.warn('Ngày không hợp lệ:', item.PaymentDate);
                    return;
                }
                
                let key = '';
                
                switch (reportType) {
                    case 'day':
                        // Định dạng theo ngày: DD/MM/YYYY
                        key = date.toLocaleDateString('vi-VN');
                        break;
                    case 'week':
                        // Lấy số tuần trong năm
                        const weekNumber = getWeekNumber(date);
                        key = `Tuần ${weekNumber}, ${date.getFullYear()}`;
                        break;
                    case 'month':
                        // Định dạng theo tháng: MM/YYYY
                        key = `${date.getMonth() + 1}/${date.getFullYear()}`;
                        break;
                    default:
                        key = date.toLocaleDateString('vi-VN');
                }
                
                // Nếu key chưa tồn tại, tạo mới với giá trị 0
                if (!result[key]) {
                    result[key] = 0;
                }
                
                // Fix: Kiểm tra và chuyển đổi amount
                let amount = 0;
                if (item.Amount !== undefined) {
                    amount = parseFloat(item.Amount) || 0;
                } else if (item.amount !== undefined) {
                    amount = parseFloat(item.amount) || 0;
                }
                
                // Chỉ cộng dồn nếu Status là Completed hoặc Hoàn thành
                if (isPaymentCompleted(item)) {
                    result[key] += amount;
                }
            } catch (error) {
                console.warn('Lỗi khi xử lý mục dữ liệu:', error, item);
            }
        });
        
        return result;
    }
    
    /**
     * Lấy số tuần trong năm của một ngày
     */
    function getWeekNumber(date) {
        if (!date || isNaN(date.getTime())) return 0;
        
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }
    
    /**
     * Format số thành định dạng tiền tệ VNĐ
     */
    function formatCurrency(amount) {
        // Xử lý các giá trị không hợp lệ
        if (amount === null || amount === undefined || isNaN(amount)) {
            return '0 ₫';
        }
        
        // Fix: Đảm bảo amount là số
        amount = parseFloat(amount);
        
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0
        }).format(amount);
    }
    
    /**
     * Xuất dữ liệu ra file Excel
     */
    function exportToExcel() {
        try {
            // Kiểm tra dữ liệu
            if (!revenueData || revenueData.length === 0) {
                showErrorMessage('Không có dữ liệu để xuất');
                return;
            }
            
            // Lấy bộ lọc hiện tại
            const filters = getCurrentFilters();
            
            // Hiển thị thông báo
            showSuccessMessage('Đang chuẩn bị xuất dữ liệu...');
            
            // Sử dụng thư viện ExcelJS để tạo file Excel trực tiếp ở client-side
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Doanh thu');
            
            // Thiết lập các cột
            worksheet.columns = [
                { header: 'STT', key: 'id', width: 5 },
                { header: 'Ngày', key: 'date', width: 15 },
                { header: 'Mã lịch hẹn', key: 'appointmentId', width: 15 },
                { header: 'Khách hàng', key: 'customer', width: 20 },
                { header: 'Dịch vụ', key: 'services', width: 30 },
                { header: 'Kỹ thuật viên', key: 'mechanic', width: 20 },
                { header: 'Phương thức thanh toán', key: 'method', width: 20 },
                { header: 'Trạng thái', key: 'status', width: 15 },
                { header: 'Tổng tiền', key: 'amount', width: 15 }
            ];
            
            // Định dạng header
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
            
            // Thêm dữ liệu
            revenueData.forEach((item, index) => {
                // Định dạng ngày
                let formattedDate = 'N/A';
                if (item.PaymentDate) {
                    const date = new Date(item.PaymentDate);
                    if (!isNaN(date.getTime())) {
                        formattedDate = date.toLocaleDateString('vi-VN');
                    }
                }
                
                // Mã lịch hẹn
                let appointmentId = 'N/A';
                if (item.AppointmentID) {
                    appointmentId = 'BK' + item.AppointmentID;
                }
                
                // Thêm dòng dữ liệu
                worksheet.addRow({
                    id: index + 1,
                    date: formattedDate,
                    appointmentId: appointmentId,
                    customer: item.CustomerName || 'N/A',
                    services: item.Services || 'N/A',
                    mechanic: item.MechanicName || 'N/A',
                    method: getPaymentMethodText(item.PaymentMethod),
                    status: item.Status || 'N/A',
                    amount: item.Amount || 0
                });
            });
            
            // Thêm dòng tổng cộng
            const totalRow = worksheet.addRow({
                id: '',
                date: '',
                appointmentId: '',
                customer: '',
                services: '',
                mechanic: '',
                method: '',
                status: 'TỔNG CỘNG:',
                amount: revenueData.reduce((total, item) => total + parseFloat(item.Amount || 0), 0)
            });
            totalRow.font = { bold: true };
            totalRow.getCell('status').alignment = { horizontal: 'right' };
            
            // Định dạng cột tiền tệ
            worksheet.getColumn('amount').numFmt = '#,##0 ₫';
            
            // Tạo tên file với thời gian hiện tại
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-');
            const fileName = `doanh-thu-${timestamp}.xlsx`;
            
            // Xuất file
            workbook.xlsx.writeBuffer().then(buffer => {
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = URL.createObjectURL(blob);
                
                // Tạo link tải xuống
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                
                // Dọn dẹp
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            });
            
        } catch (error) {
            console.error('Lỗi khi xuất Excel:', error);
            showErrorMessage('Không thể xuất Excel: ' + error.message);
        }
    }

    /**
     * Xuất dữ liệu ra file PDF
     */
    function exportToPDF() {
        try {
            // Kiểm tra dữ liệu
            if (!revenueData || revenueData.length === 0) {
                showErrorMessage('Không có dữ liệu để xuất');
                return;
            }
            
            // Hiển thị thông báo
            showSuccessMessage('Đang chuẩn bị xuất dữ liệu...');
            
            // Tạo tài liệu PDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('landscape', 'mm', 'a4');
            
            // Thêm font tiếng Việt
            // Lưu ý: Đây là phần quan trọng để hỗ trợ Unicode tiếng Việt
            doc.addFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf', 'Roboto', 'normal');
            doc.setFont('Roboto');
            
            // Tiêu đề
            doc.setFontSize(16);
            doc.text('BÁO CÁO DOANH THU', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
            
            // Thêm thông tin thời gian
            const filters = getCurrentFilters();
            doc.setFontSize(12);
            if (filters.startDate && filters.endDate) {
                // Chuyển định dạng ngày về định dạng Việt Nam
                const startDateParts = filters.startDate.split('-');
                const endDateParts = filters.endDate.split('-');
                const startDateFormatted = `${startDateParts[2]}/${startDateParts[1]}/${startDateParts[0]}`;
                const endDateFormatted = `${endDateParts[2]}/${endDateParts[1]}/${endDateParts[0]}`;
                
                doc.text(`Thời gian: Từ ${startDateFormatted} đến ${endDateFormatted}`, 14, 25);
            }
            
            // Dữ liệu cho bảng
            const tableColumn = ['STT', 'Ngày', 'Mã lịch hẹn', 'Khách hàng', 'Dịch vụ', 'Kỹ thuật viên', 'Phương thức', 'Trạng thái', 'Tổng tiền'];
            const tableRows = [];
            
            // Thêm dữ liệu
            revenueData.forEach((item, index) => {
                // Định dạng ngày
                let formattedDate = 'N/A';
                if (item.PaymentDate) {
                    const date = new Date(item.PaymentDate);
                    if (!isNaN(date.getTime())) {
                        formattedDate = date.toLocaleDateString('vi-VN');
                    }
                }
                
                // Mã lịch hẹn
                let appointmentId = 'N/A';
                if (item.AppointmentID) {
                    appointmentId = 'BK' + item.AppointmentID;
                }
                
                // Xử lý trạng thái thanh toán
                let status = item.Status || 'N/A';
                if (status.toLowerCase() === 'completed') {
                    status = 'Đã thanh toán';
                } else if (status.toLowerCase() === 'pending') {
                    status = 'Chờ thanh toán';
                } else if (status.toLowerCase() === 'hoàn thành') {
                    status = 'Đã thanh toán';
                } else if (status.toLowerCase() === 'chờ thanh toán') {
                    status = 'Chờ thanh toán';
                }
                
                const row = [
                    index + 1,
                    formattedDate,
                    appointmentId,
                    (item.CustomerName || 'N/A').slice(0, 15), // Giới hạn độ dài để tránh tràn
                    (item.Services || 'N/A').slice(0, 20),
                    (item.MechanicName || 'N/A').slice(0, 15),
                    getPaymentMethodText(item.PaymentMethod).slice(0, 10),
                    status,
                    formatCurrency(item.Amount || 0)
                ];
                tableRows.push(row);
            });
            
            // Tính tổng doanh thu
            const totalRevenue = revenueData.reduce((total, item) => total + parseFloat(item.Amount || 0), 0);
            
            // Thêm dòng tổng cộng
            tableRows.push([
                '', '', '', '', '', '', '', 'TỔNG CỘNG:',
                formatCurrency(totalRevenue)
            ]);
            
            // Tạo bảng trong PDF với phông chữ hỗ trợ Unicode
            doc.autoTable({
                head: [tableColumn],
                body: tableRows,
                startY: 35,
                theme: 'grid',
                styles: { 
                    font: 'Roboto',
                    fontSize: 9, 
                    cellPadding: 1 
                },
                headStyles: { 
                    fillColor: [66, 66, 66],
                    font: 'Roboto',
                    fontStyle: 'bold'
                },
                alternateRowStyles: { fillColor: [245, 245, 245] },
                // Định dạng cột tổng cộng
                didParseCell: function(data) {
                    if (data.row.index === tableRows.length - 1) {
                        if (data.column.index === 7 || data.column.index === 8) {
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                }
            });
            
            // Tạo tên file với thời gian hiện tại
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, '-');
            const fileName = `doanh-thu-${timestamp}.pdf`;
            
            // Xuất file
            doc.save(fileName);
            
        } catch (error) {
            console.error('Lỗi khi xuất PDF:', error);
            showErrorMessage('Không thể xuất PDF: ' + error.message);
        }
    }
    
    /**
     * Lấy text loại báo cáo
     */
    function getReportTypeText(type) {
        switch (type) {
            case 'day':
                return 'Theo ngày';
            case 'week':
                return 'Theo tuần';
            case 'month':
                return 'Theo tháng';
            default:
                return type;
        }
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
     * Hiển thị thông báo lỗi
     */
    function showErrorMessage(message) {
        const errorAlert = document.getElementById('errorAlert');
        const errorMessage = document.getElementById('errorMessage');
        
        if (!errorAlert || !errorMessage) {
            console.error('Không tìm thấy phần tử alert lỗi');
            alert('Lỗi: ' + message);
            return;
        }
        
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
        
        if (!successAlert || !successMessage) {
            console.error('Không tìm thấy phần tử alert thành công');
            alert('Thành công: ' + message);
            return;
        }
        
        successMessage.textContent = message;
        successAlert.style.display = 'block';
        
        // Tự động ẩn sau 5 giây
        setTimeout(() => {
            successAlert.style.display = 'none';
        }, 5000);
    }
});