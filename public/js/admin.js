// ADMIN.JS - JAVASCRIPT CHO BẢNG ĐIỀU KHIỂN QUẢN TRỊ

document.addEventListener('DOMContentLoaded', function() {
    // Khai báo các biến và hằng số toàn cục
    // Sử dụng API_CONFIG từ config.js (được load trước)
    const API_BASE_URL = window.API_CONFIG ? window.API_CONFIG.BASE_URL : 'http://localhost:3001/api';
    
    // Biến lưu trữ biểu đồ - khai báo ở đầu file
    let revenueChart = null;
    let servicesChart = null;
    
    
    // KHỞI TẠO ỨNG DỤNG VÀ ĐĂNG KÝ SỰ KIỆN
    // Kiểm tra đăng nhập admin
    checkAdminAuth();
    
    // Đăng ký sự kiện đăng xuất
    const logoutLink = document.getElementById('logout-link');
    if (logoutLink) {
        logoutLink.addEventListener('click', handleLogout);
    }
    
    const dropdownLogout = document.getElementById('dropdown-logout');
    if (dropdownLogout) {
        dropdownLogout.addEventListener('click', handleLogout);
    }
    
    // XÁC THỰC VÀ QUẢN LÝ PHIÊN ĐĂNG NHẬP
    
    /**
     * Kiểm tra xác thực admin
     * - Kiểm tra sự tồn tại của token và thông tin người dùng
     * - Xác minh quyền admin (role = 1)
     * - Hiển thị thông tin admin nếu hợp lệ
     */
    function checkAdminAuth() {
        const token = localStorage.getItem('token');
        const userInfo = localStorage.getItem('user');
        
        if (!token || !userInfo) {
            // Chưa đăng nhập hoặc token không hợp lệ, chuyển hướng đến trang đăng nhập admin
            window.location.href = '/login';
            return;
        }
        
        try {
            const user = JSON.parse(userInfo);
            
            // Kiểm tra quyền admin (RoleID = 1)
            if (user.role !== 1 && user.RoleID !== 1) {
                alert('Bạn không có quyền truy cập trang quản trị');
                window.location.href = '/'; // Chuyển về trang chủ
                return;
            }
            
            // Hiển thị tên admin
            const adminNameElement = document.getElementById('adminName');
            if (adminNameElement) {
                adminNameElement.textContent = user.fullName || 'Admin';
            }

            // Cập nhật avatar với chữ cái đầu tiên của tên người dùng
            const avatarPlaceholder = document.getElementById('avatarPlaceholder');
            if (avatarPlaceholder && user.fullName) {
                // Lấy chữ cái đầu tiên và chuyển thành chữ hoa
                avatarPlaceholder.textContent = user.fullName.charAt(0).toUpperCase();
            }
            
            // Sau khi xác thực thành công, TRƯỚC TIÊN khởi tạo biểu đồ rồi mới tải dữ liệu
            initCharts();
            loadDashboardData();
            
        } catch (error) {
            console.error('Lỗi phân tích dữ liệu người dùng:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    }
    
    /**
     * Xử lý đăng xuất
     * - Xóa token và thông tin người dùng khỏi localStorage
     * - Chuyển hướng về trang đăng nhập
     */
    function handleLogout(e) {
        e.preventDefault();
        
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        window.location.href = '/login';
    }
    
    // TẢI DỮ LIỆU DASHBOARD VÀ HIỂN THỊ
    
    /**
     * Tải dữ liệu dashboard
     * - Lấy dữ liệu tổng quan từ API
     * - Xử lý lỗi và hiển thị dữ liệu giả trong trường hợp cần thiết
     */
    async function loadDashboardData() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Kiểm tra xem các phần tử DOM cần thiết có tồn tại không
            const elements = [
                document.getElementById('todayAppointments'),
                document.getElementById('monthlyRevenue'),
                document.getElementById('totalCustomers'),
                document.getElementById('pendingAppointments')
            ];
            
            // Nếu một trong các phần tử không tồn tại, không cần tải dữ liệu
            if (elements.some(el => !el)) {
                console.warn('Trang không có các phần tử cần thiết để hiển thị dashboard');
                return;
            }
            
            try {
                // Đảm bảo token được gửi đúng định dạng (Bearer token)
                const response = await fetch(`${API_BASE_URL}/admin/dashboard/summary`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    if (response.status === 403) {
                        // Xử lý lỗi 403 cụ thể - có thể token hết hạn
                        console.error('Lỗi xác thực: Token có thể đã hết hạn hoặc không hợp lệ');
//                         localStorage.removeItem('token'); // Xóa token không hợp lệ
//                         localStorage.removeItem('user');
//                         alert('Phiên làm việc của bạn đã hết hạn. Vui lòng đăng nhập lại.');
//                         window.location.href = 'login.html';
                        return;
                    }
                    throw new Error(`API error: ${response.status}`);
                }
                
                const result = await response.json();
                
                if (result.success) {
                    updateDashboardSummary(result.data || {});
                    
                    // Tải danh sách lịch hẹn gần đây
                    loadRecentBookings();
                    loadRevenueChartData();
                } else {
                    throw new Error(result.message || 'Không thể tải dữ liệu dashboard');
                }
            } catch (fetchError) {
                console.error('Lỗi kết nối API:', fetchError);
                // Sử dụng mockup data trong trường hợp API không hoạt động
                const mockupData = {
                    todayAppointments: 5,
                    monthlyRevenue: 15000000,
                    totalCustomers: 120,
                    pendingAppointments: 8
                };
                updateDashboardSummary(mockupData);
                showErrorMessage('Không thể kết nối đến máy chủ. Hiển thị dữ liệu mẫu.');
            }
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu dashboard:', error);
            showErrorMessage('Không thể tải dữ liệu tổng quan: ' + error.message);
        }
    }

    /**
     * Tải danh sách lịch hẹn gần đây
     */
    async function loadRecentBookings() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Kiểm tra xem phần tử DOM cần thiết có tồn tại không
            const tableBody = document.getElementById('recentBookingsList');
            if (!tableBody) {
                console.warn('Không tìm thấy phần tử recentBookingsList');
                return;
            }
            
            try {
                // Đảm bảo sử dụng endpoint chính xác và token được định dạng đúng
                const response = await fetch(`${API_BASE_URL}/admin/dashboard/recent-booking`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    if (response.status === 403) {
                        // Xử lý lỗi 403 cụ thể - có thể token hết hạn
                        console.error('Lỗi xác thực: Token có thể đã hết hạn hoặc không hợp lệ');
//                         localStorage.removeItem('token');
//                         localStorage.removeItem('user');
//                         alert('Phiên làm việc của bạn đã hết hạn. Vui lòng đăng nhập lại.');
//                         window.location.href = 'login.html';
                        console.warn("⚠️ Booking API 403 - Skipped");
                        return;
                    }
//                     throw new Error(`Lỗi API: ${response.status}`);
                }
                
                const result = await response.json();
                
                if (result.success) {
                    renderRecentBookings(result.bookings || []);
                } else {
                    throw new Error(result.message || 'Không thể tải danh sách lịch hẹn');
                }
            } catch (fetchError) {
                console.error('Lỗi kết nối API:', fetchError);
                // Hiển thị trạng thái lỗi trong bảng
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center text-danger">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Không thể kết nối đến máy chủ. Vui lòng thử lại sau.
                        </td>
                    </tr>
                `;
            }
        } catch (error) {
            console.error('Lỗi khi tải danh sách lịch hẹn:', error);
            
            // Hiển thị trạng thái lỗi trong bảng
            const tableBody = document.getElementById('recentBookingsList');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center text-danger">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Không thể tải danh sách lịch hẹn. Vui lòng thử lại sau.
                        </td>
                    </tr>
                `;
            }
        }
    }


    /**
 * Tải dữ liệu doanh thu theo tháng cho biểu đồ
 */
async function loadRevenueChartData() {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            throw new Error('Không có token xác thực');
        }
        
        // Lấy năm hiện tại
        const currentYear = new Date().getFullYear();
        
        // Gọi API lấy dữ liệu doanh thu theo tháng
        const response = await fetch(`${API_BASE_URL}/revenue/monthly?year=${currentYear}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Lỗi API: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && revenueChart) {
            // Cập nhật biểu đồ doanh thu với dữ liệu thực tế
            revenueChart.data.datasets[0].data = result.data;
            revenueChart.update();
            console.log('Cập nhật biểu đồ doanh thu thành công');
        }
    } catch (error) {
        console.error('Lỗi khi tải dữ liệu doanh thu:', error);
        
        // Sử dụng dữ liệu mẫu nếu có lỗi
        if (revenueChart) {
            const mockupData = [
                2500000, 3200000, 2800000, 4500000, 
                5200000, 4800000, 5500000, 6200000, 
                7100000, 6800000, 7500000, 8200000
            ];
            revenueChart.data.datasets[0].data = mockupData;
            revenueChart.update();
        }
    }
}


    /**
     * Kiểm tra tính hợp lệ của token
     * @param {string} token - JWT token cần kiểm tra
     * @returns {boolean} - Kết quả kiểm tra
     */
    function isTokenValid(token) {
        // Kiểm tra cơ bản dựa trên định dạng JWT
        if (!token) return false;
        
        // JWT có 3 phần được phân tách bởi dấu chấm
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        
        // Kiểm tra thời gian hết hạn nếu có thể
        try {
            const payload = JSON.parse(atob(parts[1]));
            // Nếu token có trường exp (expiration time)
            if (payload.exp) {
                const expirationTime = payload.exp * 1000; // Chuyển từ giây sang mili giây
                if (Date.now() >= expirationTime) {
                    return false; // Token đã hết hạn
                }
            }
            return true;
        } catch (e) {
            console.error('Lỗi khi kiểm tra token:', e);
            return false;
        }
    }
    
    /**
     * Cập nhật thông tin tổng quan dashboard
     * - Hiển thị các số liệu thống kê
     * - Cập nhật dữ liệu cho biểu đồ
     * @param {Object} data - Dữ liệu tổng quan
     */
    function updateDashboardSummary(data) {
    // Cập nhật các thông số tổng quan
    const todayAppointments = document.getElementById('todayAppointments');
    const monthlyRevenue = document.getElementById('monthlyRevenue');
    const totalCustomers = document.getElementById('totalCustomers');
    const pendingAppointments = document.getElementById('pendingAppointments');
    
    if (todayAppointments) todayAppointments.textContent = data.todayAppointments || 0;
    if (monthlyRevenue) monthlyRevenue.textContent = formatCurrency(data.monthlyRevenue || 0);
    if (totalCustomers) totalCustomers.textContent = data.totalCustomers || 0;
    if (pendingAppointments) pendingAppointments.textContent = data.pendingAppointments || 0;
    
    // Cập nhật dữ liệu biểu đồ nếu có
    if (data && data.revenueData && revenueChart && typeof revenueChart.update === 'function') {
        revenueChart.data.datasets[0].data = data.revenueData.values;
        revenueChart.update();
        console.log('Biểu đồ doanh thu được cập nhật với dữ liệu mới');
    }
    
    if (data && data.serviceData && servicesChart && typeof servicesChart.update === 'function') {
        servicesChart.data.labels = data.serviceData.labels;
        servicesChart.data.datasets[0].data = data.serviceData.values;
        servicesChart.update();
        console.log('Biểu đồ dịch vụ được cập nhật với dữ liệu mới');
    }
    }

    // XỬ LÝ NAVIGATION SIDEBAR
    
    // Xử lý sự kiện click cho các menu item
    const menuItems = document.querySelectorAll('#sidebar .nav-link');
    if (menuItems && menuItems.length > 0) {
        menuItems.forEach(item => {
            item.addEventListener('click', function(e) {
                // Nếu href là "#" thì ngăn chặn hành vi mặc định
                if (this.getAttribute('href') === '#') {
                    e.preventDefault();
                }
                
                // Ngược lại để trang chuyển hướng bình thường
                // Gỡ bỏ class 'active' từ tất cả các liên kết
                menuItems.forEach(menuItem => {
                    menuItem.classList.remove('active');
                });
                
                // Thêm class 'active' cho liên kết được click
                this.classList.add('active');
            });
        });
    }

    // Đảm bảo liên kết đến trang admin-services hoạt động đúng
    const servicesLink = document.getElementById('services-link');
    if (servicesLink) {
        servicesLink.addEventListener('click', function(e) {
            // Đừng ngăn chặn chuyển hướng mặc định
            // Chỉ log để debug
            console.log('Clicked on Services link, navigating to:', this.getAttribute('href'));
        });
    }
    
    // HIỂN THỊ LỊCH HẸN
    
    /**
     * Render lịch hẹn gần đây
     * - Tạo HTML cho bảng lịch hẹn
     * - Định dạng ngày tháng và trạng thái
     * - Khởi tạo DataTable nếu có jQuery
     * @param {Array} bookings - Danh sách lịch hẹn
     */
    function renderRecentBookings(bookings) {
        const tableBody = document.getElementById('recentBookingsList');
        
        if (!tableBody) {
            console.warn('Không tìm thấy phần tử recentBookingsList');
            return;
        }
        
        if (!bookings || bookings.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center">Không có lịch hẹn nào</td></tr>`;
            return;
        }
        
        let html = '';
        
        bookings.forEach(booking => {
            let formattedDate = 'N/A';
            try {
                const appointmentDate = new Date(booking.AppointmentDate);
                if (!isNaN(appointmentDate.getTime())) {
                    formattedDate = `${appointmentDate.toLocaleDateString('vi-VN')} ${appointmentDate.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}`;
                }
            } catch (error) {
                console.error('Lỗi định dạng ngày tháng:', error);
            }
            
            // Tạo badge trạng thái
            let statusBadge = '';
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
                    statusBadge = `<span class="badge bg-secondary">${booking.Status || 'Không xác định'}</span>`;
            }
            
            html += `
                <tr>
                    <td>BK${booking.AppointmentID}</td>
                    <td>${booking.CustomerName || 'N/A'}</td>
                    <td>${formattedDate}</td>
                    <td>${booking.Services || 'N/A'}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <a href="/admin-booking?id=${booking.AppointmentID}" class="btn btn-sm btn-primary">
                            <i class="bi bi-eye"></i>
                        </a>
                    </td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html;
        
        // Khởi tạo DataTable nếu có jQuery
        if (typeof $ !== 'undefined' && $.fn && $.fn.DataTable) {
            try {
                // Kiểm tra xem DataTable đã được khởi tạo chưa
                if ($.fn.dataTable.isDataTable && $.fn.dataTable.isDataTable('#recentBookingsTable')) {
                    $('#recentBookingsTable').DataTable().destroy();
                }
                
                $('#recentBookingsTable').DataTable({
                    paging: true,
                    searching: true,
                    ordering: true,
                    info: true,
                    lengthChange: false,
                    pageLength: 5,
                    language: {
                        url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/vi.json'
                    }
                });
            } catch (e) {
                console.error('Lỗi khi khởi tạo DataTable:', e);
            }
        }
    }
    
    // KHỞI TẠO VÀ CẬP NHẬT BIỂU ĐỒ
    
    /**
     * Khởi tạo các biểu đồ
     * - Tạo biểu đồ doanh thu theo tháng
     * - Tạo biểu đồ thống kê dịch vụ phổ biến
     */
    function initCharts() {
        // Kiểm tra xem phần tử canvas có tồn tại không
        const revenueCanvas = document.getElementById('revenueChart');
        const servicesCanvas = document.getElementById('servicesChart');
        
        if (!revenueCanvas || !servicesCanvas) {
            console.warn('Không tìm thấy canvas cho biểu đồ');
            return;
        }
        
        // Kiểm tra xem thư viện Chart.js đã được load chưa
        if (typeof Chart === 'undefined') {
            console.error('Thư viện Chart.js chưa được load');
            
            // Hiển thị thông báo lỗi thay vì biểu đồ
            const revenueContainer = revenueCanvas.parentNode;
            const servicesContainer = servicesCanvas.parentNode;
            
            if (revenueContainer) {
                const errorElement = document.createElement('div');
                errorElement.className = 'alert alert-warning';
                errorElement.textContent = 'Không thể tải biểu đồ - Thư viện Chart.js chưa được load';
                revenueContainer.appendChild(errorElement);
            }
            
            if (servicesContainer) {
                const errorElement = document.createElement('div');
                errorElement.className = 'alert alert-warning';
                errorElement.textContent = 'Không thể tải biểu đồ - Thư viện Chart.js chưa được load';
                servicesContainer.appendChild(errorElement);
            }
            
            return;
        }
        
        try {
            // Biểu đồ doanh thu
            const revenueCtx = revenueCanvas.getContext('2d');
            revenueChart = new Chart(revenueCtx, {
                type: 'line',
                data: {
                    labels: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'],
                    datasets: [{
                        label: 'Doanh thu (VNĐ)',
                        data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Dữ liệu mẫu, sẽ được cập nhật sau
                        borderColor: '#0d6efd',
                        backgroundColor: 'rgba(13, 110, 253, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += formatCurrency(context.parsed.y);
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    if (value >= 1000000) {
                                        return (value / 1000000) + 'tr';
                                    } else if (value >= 1000) {
                                        return (value / 1000) + 'k';
                                    }
                                    return value;
                                }
                            }
                        }
                    }
                }
            });
            
            // Biểu đồ dịch vụ phổ biến
            const servicesCtx = servicesCanvas.getContext('2d');
            servicesChart = new Chart(servicesCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Thay nhớt', 'Thay lốp', 'Bảo dưỡng phanh', 'Sửa điện xe', 'Thay bugi'],
                    datasets: [{
                        data: [30, 20, 15, 10, 25], // Dữ liệu mẫu, sẽ được cập nhật sau
                        backgroundColor: [
                            '#0d6efd',
                            '#20c997',
                            '#fd7e14',
                            '#dc3545',
                            '#6f42c1'
                        ],
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right'
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Lỗi khi khởi tạo biểu đồ:', error);
            
            // Hiển thị thông báo lỗi
            const errorMessage = document.createElement('div');
            errorMessage.className = 'alert alert-danger';
            errorMessage.textContent = 'Không thể tải biểu đồ. Vui lòng tải lại trang.';
            
            if (revenueCanvas && revenueCanvas.parentNode) {
                revenueCanvas.parentNode.appendChild(errorMessage.cloneNode(true));
            }
            
            if (servicesCanvas && servicesCanvas.parentNode) {
                servicesCanvas.parentNode.appendChild(errorMessage);
            }
        }
    }
    
    // CÁC HÀM TIỆN ÍCH
    
    /**
     * Hiển thị thông báo lỗi
     * - Hiển thị thông báo trong phần tử errorAlert hoặc sử dụng alert
     * - Tự động ẩn sau 5 giây
     * @param {string} message - Nội dung thông báo lỗi
     */
    function showErrorMessage(message) {
        // Kiểm tra nếu có phần tử thông báo lỗi
        const errorAlert = document.getElementById('errorAlert');
        if (errorAlert) {
            errorAlert.textContent = message;
            errorAlert.style.display = 'block';
            
            // Tự động ẩn sau 5 giây
            setTimeout(() => {
                errorAlert.style.display = 'none';
            }, 5000);
        } else {
            // Nếu không có phần tử thông báo lỗi, dùng alert
            console.error(message);
            alert(message);
        }
    }
    
    /**
     * Format số thành định dạng tiền tệ VNĐ
     * - Sử dụng Intl.NumberFormat để định dạng tiền tệ
     * @param {number} amount - Số tiền cần định dạng
     * @returns {string} - Chuỗi đã định dạng
     */
    function formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
            maximumFractionDigits: 0
        }).format(amount);
    }
});