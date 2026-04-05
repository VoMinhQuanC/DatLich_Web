// booking-history.js - Xử lý chức năng cho trang lịch sử đặt lịch

document.addEventListener('DOMContentLoaded', function() {
    // Sử dụng API_CONFIG từ config.js (được load trước)
    const API_BASE_URL = window.API_CONFIG ? window.API_CONFIG.BASE_URL : 'http://localhost:3001/api';
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.get('paymentStatus') === 'success') {
        localStorage.removeItem('pendingAppointmentId');
        localStorage.removeItem('pendingTotalAmount');
        localStorage.removeItem('pendingBookingFingerprint');
    }
    
    // Biến lưu trữ dữ liệu
    let bookings = [];
    let selectedAppointment = null;
    let selectedRating = 0;
    
    // Elements
    const loginRequiredAlert = document.getElementById('loginRequiredAlert');
    const bookingHistoryContainer = document.getElementById('bookingHistoryContainer');
    const bookingList = document.getElementById('bookingList');
    
    // Phần filter buttons mới - thay thế cho dropdown
    const filterButtons = document.querySelectorAll('.status-filter-buttons .btn-group button');
    
    // Modals
    const bookingDetailModal = new bootstrap.Modal(document.getElementById('bookingDetailModal'));
    const reviewModal = new bootstrap.Modal(document.getElementById('reviewModal'));
    const cancelConfirmModal = new bootstrap.Modal(document.getElementById('cancelConfirmModal'));
    
    // Buttons
    const cancelBookingBtn = document.getElementById('cancelBookingBtn');
    const confirmCancelBtn = document.getElementById('confirmCancelBtn');
    const submitReviewBtn = document.getElementById('submitReviewBtn');
    
    // Kiểm tra trạng thái đăng nhập
    checkLoginStatus();
    
    // Event listeners cho các nút filter
    if (filterButtons.length > 0) {
        filterButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Bỏ class active khỏi tất cả các nút
                filterButtons.forEach(btn => btn.classList.remove('active'));
                
                // Thêm class active cho nút được chọn
                this.classList.add('active');
                
                // Lấy giá trị trạng thái từ data-status
                const status = this.getAttribute('data-status');
                
                // Lọc lịch hẹn theo trạng thái
                filterAppointmentsByStatus(status);
            });
        });
    }
    
    // Rating stars
    document.querySelectorAll('.rating-star').forEach(star => {
        star.addEventListener('click', function() {
            const rating = parseInt(this.getAttribute('data-rating'));
            updateRatingStars(rating);
        });
        
        star.addEventListener('mouseover', function() {
            const rating = parseInt(this.getAttribute('data-rating'));
            highlightRatingStars(rating);
        });
        
        star.addEventListener('mouseout', function() {
            resetRatingStars();
            highlightRatingStars(selectedRating);
        });
    });
    
    // Nút hủy lịch hẹn trong modal chi tiết
    cancelBookingBtn.addEventListener('click', function() {
        // Hiển thị modal xác nhận hủy
        cancelConfirmModal.show();
    });
    
    // Nút xác nhận hủy lịch hẹn
    confirmCancelBtn.addEventListener('click', cancelAppointment);
    
    // Nút gửi đánh giá
    submitReviewBtn.addEventListener('click', submitReview);
    
    /**
     * Kiểm tra trạng thái đăng nhập
     */
    function checkLoginStatus() {
        const token = localStorage.getItem('token');
        const userInfo = localStorage.getItem('user');
        
        if (token && userInfo) {
            try {
                // Đã đăng nhập
                loginRequiredAlert.style.display = 'none';
                bookingHistoryContainer.style.display = 'block';
                
                // Load dữ liệu lịch sử đặt lịch
                loadBookingHistory();
                
            } catch (error) {
                console.error('Lỗi xử lý thông tin người dùng:', error);
                showLoginRequired();
            }
        } else {
            // Chưa đăng nhập
            showLoginRequired();
        }
    }
    
    /**
     * Hiển thị thông báo yêu cầu đăng nhập
     */
    function showLoginRequired() {
        loginRequiredAlert.style.display = 'block';
        bookingHistoryContainer.style.display = 'none';
    }
    
    /**
     * Tải lịch sử đặt lịch
     */
    async function loadBookingHistory() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Hiển thị trạng thái loading
            bookingList.innerHTML = `
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Đang tải...</span>
                    </div>
                    <p class="mt-2">Đang tải lịch sử đặt lịch...</p>
                </div>
            `;
            
            const response = await fetch(`${API_BASE_URL}/booking/my-appointments`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi kết nối: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                bookings = result.appointments;
                renderBookingHistory(bookings);
            } else {
                throw new Error('Không thể tải lịch sử đặt lịch');
            }
            
        } catch (error) {
            console.error('Lỗi khi tải lịch sử đặt lịch:', error);
            
            // Hiển thị thông báo lỗi
            bookingList.innerHTML = `
                <div class="alert alert-danger">
                    <p>Không thể tải lịch sử đặt lịch: ${error.message}</p>
                    <button class="btn btn-outline-primary mt-2" onclick="location.reload()">Tải lại</button>
                </div>
            `;
        }
    }
    
    /**
     * Hiển thị lịch sử đặt lịch - Cập nhật với nút xóa cho lịch đã hủy
     */
    function renderBookingHistory(appointments) {
        if (!appointments || appointments.length === 0) {
            // Hiển thị trạng thái trống
            bookingList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i class="bi bi-calendar-x"></i>
                    </div>
                    <h4>Chưa có lịch hẹn nào</h4>
                    <p class="empty-state-text">Bạn chưa có lịch hẹn sửa xe nào. Hãy đặt lịch ngay!</p>
                    <a href="/booking" class="btn btn-primary">Đặt lịch ngay</a>
                </div>
            `;
            return;
        }
        
        let html = '';
        
        appointments.forEach(booking => {
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
            
            // Xác định class cho trạng thái
            let statusClass = '';
            let statusText = '';
            
            switch (booking.Status) {
                case 'PendingPayment':
                    statusClass = 'status-pending';
                    statusText = 'Chờ thanh toán';
                    break;
                case 'Pending':
                    statusClass = 'status-pending';
                    statusText = 'Chờ xác nhận';
                    break;
                case 'Confirmed':
                    statusClass = 'status-confirmed';
                    statusText = 'Đã xác nhận';
                    break;
                case 'Completed':
                    statusClass = 'status-completed';
                    statusText = 'Hoàn thành';
                    break;
                case 'Canceled':
                    statusClass = 'status-canceled';
                    statusText = 'Đã hủy';
                    break;
                default:
                    statusClass = 'status-pending';
                    statusText = booking.Status;
            }
            
            html += `
                <div class="booking-card" data-id="${booking.AppointmentID}" data-status="${booking.Status}">
                    <div class="booking-header">
                        <span class="booking-id">Mã đặt lịch: BK${booking.AppointmentID}</span>
                        <span class="booking-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="booking-body">
                        <div class="booking-date">
                            <i class="bi bi-calendar-check"></i> ${formattedDate} lúc ${formattedTime}
                        </div>
                        <div class="booking-vehicle">
                            <strong>Xe:</strong> ${booking.LicensePlate || ''} ${booking.Brand || ''} ${booking.Model || ''}
                        </div>
                        ${booking.Notes ? `
                        <div class="booking-notes">
                            <strong>Ghi chú:</strong> ${booking.Notes}
                        </div>
                        ` : ''}

                        <div class="booking-payment">
                            <strong>Hình thức thanh toán:</strong> 
                            <span class="payment-method">
                                ${booking.PaymentMethod ? booking.PaymentMethod : 'Thanh toán tại tiệm'}
                            </span>
                        </div>
                    </div>
                    <div class="booking-footer">
                        <div class="booking-actions">
                            <button class="btn btn-outline-primary btn-sm view-detail-btn" data-id="${booking.AppointmentID}">
                                Xem chi tiết
                            </button>
                            ${booking.Status === 'PendingPayment' || booking.Status === 'Pending' || booking.Status === 'Confirmed' ? `
                            <button class="btn btn-outline-danger btn-sm cancel-btn" data-id="${booking.AppointmentID}">
                                Hủy lịch
                            </button>
                            ` : ''}
                            ${booking.Status === 'Completed' ? `
                            <button class="btn btn-outline-success btn-sm review-btn" data-id="${booking.AppointmentID}">
                                Đánh giá
                            </button>
                            ` : ''}
                            ${booking.Status === 'Canceled' ? `
                            <button class="btn btn-outline-danger btn-sm delete-btn" data-id="${booking.AppointmentID}">
                                <i class="bi bi-trash"></i> Xóa
                            </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        
        bookingList.innerHTML = html;
        
        // Thêm event listeners
        document.querySelectorAll('.view-detail-btn').forEach(button => {
            button.addEventListener('click', function() {
                const appointmentId = this.getAttribute('data-id');
                viewBookingDetail(appointmentId);
            });
        });
        
        document.querySelectorAll('.cancel-btn').forEach(button => {
            button.addEventListener('click', function() {
                const appointmentId = this.getAttribute('data-id');
                prepareToCancel(appointmentId);
            });
        });
        
        document.querySelectorAll('.review-btn').forEach(button => {
            button.addEventListener('click', function() {
                const appointmentId = this.getAttribute('data-id');
                prepareToReview(appointmentId);
            });
        });
        
        // Thêm event listener cho nút xóa lịch đã hủy
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', function() {
                const appointmentId = this.getAttribute('data-id');
                deleteBooking(appointmentId);
            });
        });
    }

    /**
     * Xóa lịch hẹn đã hủy khỏi danh sách
     */
    async function deleteBooking(appointmentId) {
        // Xác nhận lại với người dùng
        if (confirm('Bạn có chắc chắn muốn xóa lịch hẹn này khỏi lịch sử? Hành động này không thể hoàn tác.')) {
            try {
                const token = localStorage.getItem('token');
                
                if (!token) {
                    throw new Error('Không có token xác thực');
                }
                
                // Hiển thị loading
                const deleteButton = document.querySelector(`.delete-btn[data-id="${appointmentId}"]`);
                if (deleteButton) {
                    deleteButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang xóa...';
                    deleteButton.disabled = true;
                }
                
                // Gửi yêu cầu xóa mềm đến máy chủ
                const response = await fetch(`${API_BASE_URL}/booking/appointments/${appointmentId}/delete`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                // Xử lý phản hồi từ máy chủ
                const result = await response.json();
                
                if (response.ok && result.success) {
                    // Xóa booking khỏi mảng dữ liệu
                    bookings = bookings.filter(booking => booking.AppointmentID != appointmentId);
                    
                    // Xóa phần tử khỏi DOM
                    const bookingCard = document.querySelector(`.booking-card[data-id="${appointmentId}"]`);
                    if (bookingCard) {
                        // Thêm hiệu ứng fade out trước khi xóa
                        bookingCard.style.transition = 'opacity 0.5s ease';
                        bookingCard.style.opacity = '0';
                        
                        setTimeout(() => {
                            bookingCard.remove();
                            
                            // Kiểm tra nếu không còn booking nào
                            if (document.querySelectorAll('.booking-card').length === 0) {
                                bookingList.innerHTML = `
                                    <div class="empty-state">
                                        <div class="empty-state-icon">
                                            <i class="bi bi-calendar-x"></i>
                                        </div>
                                        <h4>Chưa có lịch hẹn nào</h4>
                                        <p class="empty-state-text">Bạn chưa có lịch hẹn sửa xe nào. Hãy đặt lịch ngay!</p>
                                        <a href="/booking" class="btn btn-primary">Đặt lịch ngay</a>
                                    </div>
                                `;
                            }
                        }, 500);
                    }
                    
                    // Hiển thị thông báo thành công
                    alert('Xóa lịch hẹn thành công');
                } else {
                    throw new Error(result.message || 'Không thể xóa lịch hẹn');
                }
            } catch (error) {
                console.error('Lỗi khi xóa lịch hẹn:', error);
                alert(`Lỗi: ${error.message}`);
                
                // Reset nút xóa nếu có lỗi
                const deleteButton = document.querySelector(`.delete-btn[data-id="${appointmentId}"]`);
                if (deleteButton) {
                    deleteButton.innerHTML = '<i class="bi bi-trash"></i> Xóa';
                    deleteButton.disabled = false;
                }
            }
        }
    }

    /**
     * Lọc lịch hẹn theo trạng thái
     * @param {string} status - Trạng thái cần lọc
     */
    function filterAppointmentsByStatus(status) {
        if (status === 'all') {
            // Hiển thị tất cả lịch hẹn
            renderBookingHistory(bookings);
            return;
        }
        
        // Lọc theo trạng thái
        const filteredBookings = bookings.filter(booking => booking.Status === status);
        renderBookingHistory(filteredBookings);
        
        // Nếu không có kết quả nào, hiển thị thông báo
        if (filteredBookings.length === 0) {
            bookingList.innerHTML = `
                <div class="alert alert-info text-center">
                    <i class="bi bi-info-circle me-2"></i>
                    Không có lịch hẹn nào có trạng thái "${getStatusText(status)}"
                </div>
            `;
        }
    }

    /**
     * Lấy text hiển thị của trạng thái
     * @param {string} status - Trạng thái
     * @returns {string} - Text hiển thị
     */
    function getStatusText(status) {
        switch (status) {
            case 'PendingPayment': return 'Chờ thanh toán';
            case 'Pending': return 'Chờ xác nhận';
            case 'Confirmed': return 'Đã xác nhận';
            case 'Completed': return 'Hoàn thành';
            case 'Canceled': return 'Đã hủy';
            default: return status;
        }
    }
    
    /**
     * Xem chi tiết lịch hẹn
     */
    async function viewBookingDetail(appointmentId) {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Hiển thị trạng thái loading
            document.getElementById('bookingDetailContent').innerHTML = `
                <div class="text-center py-3">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Đang tải...</span>
                    </div>
                    <p class="mt-2">Đang tải thông tin chi tiết...</p>
                </div>
            `;
            
            // Hiển thị modal
            bookingDetailModal.show();
            
            const response = await fetch(`${API_BASE_URL}/booking/appointments/${appointmentId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi kết nối: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                renderBookingDetail(result.appointment);
                
                // Lưu lịch hẹn đã chọn
                selectedAppointment = result.appointment;
                
                // Hiển thị hoặc ẩn nút hủy lịch hẹn
                if (selectedAppointment.Status === 'PendingPayment' || selectedAppointment.Status === 'Pending' || selectedAppointment.Status === 'Confirmed') {
                    cancelBookingBtn.style.display = 'block';
                } else {
                    cancelBookingBtn.style.display = 'none';
                }
            } else {
                throw new Error('Không thể tải thông tin chi tiết');
            }
            
        } catch (error) {
            console.error('Lỗi khi tải thông tin chi tiết:', error);
            
            // Hiển thị thông báo lỗi
            document.getElementById('bookingDetailContent').innerHTML = `
                <div class="alert alert-danger">
                    <p>Không thể tải thông tin chi tiết: ${error.message}</p>
                </div>
            `;
        }
    }
    
    /**
     * Hiển thị chi tiết lịch hẹn
     */
    function renderBookingDetail(appointment) {
        const appointmentDate = new Date(appointment.AppointmentDate);
        const formattedDate = appointmentDate.toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        
        const formattedTime = appointmentDate.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Xác định class và text cho trạng thái
        let statusClass = '';
        let statusText = '';
        
        switch (appointment.Status) {
            case 'PendingPayment':
                statusClass = 'status-pending';
                statusText = 'Chờ thanh toán';
                break;
            case 'Pending':
                statusClass = 'status-pending';
                statusText = 'Chờ xác nhận';
                break;
            case 'Confirmed':
                statusClass = 'status-confirmed';
                statusText = 'Đã xác nhận';
                break;
            case 'Completed':
                statusClass = 'status-completed';
                statusText = 'Hoàn thành';
                break;
            case 'Canceled':
                statusClass = 'status-canceled';
                statusText = 'Đã hủy';
                break;
            default:
                statusClass = 'status-pending';
                statusText = appointment.Status;
        }
        
        // Tính tổng tiền
        let totalPrice = 0;
        if (appointment.services && appointment.services.length > 0) {
            appointment.services.forEach(service => {
                totalPrice += (service.Price * service.Quantity);
            });
        }
        
        // Tạo bảng dịch vụ
        let servicesHtml = '';
        if (appointment.services && appointment.services.length > 0) {
            servicesHtml = `
                <table class="table service-table">
                    <thead>
                        <tr>
                            <th>Dịch vụ</th>
                            <th class="text-center">Số lượng</th>
                            <th class="text-end">Giá</th>
                            <th class="text-end">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            appointment.services.forEach(service => {
                const price = service.Price;
                const quantity = service.Quantity;
                const subtotal = price * quantity;
                
                servicesHtml += `
                    <tr>
                        <td>${service.ServiceName}</td>
                        <td class="text-center">${quantity}</td>
                        <td class="text-end">${formatCurrency(price)}</td>
                        <td class="text-end">${formatCurrency(subtotal)}</td>
                    </tr>
                `;
            });
            
            servicesHtml += `
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" class="text-end"><strong>Tổng cộng:</strong></td>
                            <td class="text-end"><strong>${formatCurrency(totalPrice)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            `;
        } else {
            servicesHtml = '<p class="text-muted">Không có thông tin dịch vụ</p>';
        }
        
        // Tạo HTML chi tiết
        const detailHtml = `
            <div class="booking-detail-header">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <span class="booking-id">Mã đặt lịch: BK${appointment.AppointmentID}</span>
                        <span class="booking-status ${statusClass}">${statusText}</span>
                    </div>
                    <div>
                        <span class="text-muted">Ngày tạo: ${new Date(appointment.CreatedAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h5>Thông tin lịch hẹn</h5>
                <div class="detail-row">
                    <div class="detail-label">Ngày hẹn:</div>
                    <div class="detail-value">${formattedDate}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Giờ hẹn:</div>
                    <div class="detail-value">${formattedTime}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Trạng thái:</div>
                    <div class="detail-value"><span class="booking-status ${statusClass}">${statusText}</span></div>
                </div>
            </div>
            
            <div class="detail-section">
                <h5>Thông tin xe</h5>
                <div class="detail-row">
                    <div class="detail-label">Biển số:</div>
                    <div class="detail-value">${appointment.LicensePlate || 'Không có thông tin'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Hãng xe:</div>
                    <div class="detail-value">${appointment.Brand || 'Không có thông tin'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Dòng xe:</div>
                    <div class="detail-value">${appointment.Model || 'Không có thông tin'}</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h5>Dịch vụ đã chọn</h5>
                ${servicesHtml}
            </div>
            
            ${appointment.Notes ? `
            <div class="detail-section">
                <h5>Ghi chú</h5>
                <p>${appointment.Notes}</p>
            </div>
            ` : ''}
            
            ${appointment.MechanicID ? `
            <div class="detail-section">
                <h5>Thợ sửa xe</h5>
                <p>${appointment.MechanicName || 'Chưa có thông tin'}</p>
            </div>
            ` : ''}
            
            ${appointment.ReviewID ? `
            <div class="detail-section">
                <h5>Đánh giá của bạn</h5>
                <div class="review-item">
                    <div class="review-rating">
                        ${generateStars(appointment.Rating)}
                    </div>
                    <p class="review-comment">${appointment.Comment || 'Không có nhận xét'}</p>
                </div>
            </div>
            ` : ''}
        `;
        
        document.getElementById('bookingDetailContent').innerHTML = detailHtml;
    }
    
    /**
     * Chuẩn bị để hủy lịch hẹn
     */
    function prepareToCancel(appointmentId) {
        // Lưu ID lịch hẹn đã chọn
        selectedAppointment = { AppointmentID: appointmentId };
        
        // Hiển thị modal xác nhận hủy
        cancelConfirmModal.show();
    }
    
    /**
     * Thực hiện hủy lịch hẹn
     */
    async function cancelAppointment() {
        if (!selectedAppointment) return;
        
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Hiển thị spinner
            document.getElementById('cancelSpinner').style.display = 'inline-block';
            confirmCancelBtn.disabled = true;
            
            const response = await fetch(`${API_BASE_URL}/booking/appointments/${selectedAppointment.AppointmentID}/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                // Đóng modal
                cancelConfirmModal.hide();
                
                // Đóng modal chi tiết nếu đang mở
                bookingDetailModal.hide();
                
                // Hiển thị thông báo thành công
                alert('Hủy lịch hẹn thành công');
                
                // Cập nhật trạng thái trong mảng dữ liệu
                const bookingIndex = bookings.findIndex(b => b.AppointmentID == selectedAppointment.AppointmentID);
                if (bookingIndex !== -1) {
                    bookings[bookingIndex].Status = 'Canceled';
                }
                
                // Cập nhật UI để hiển thị trạng thái mới và nút xóa
                const bookingCard = document.querySelector(`.booking-card[data-id="${selectedAppointment.AppointmentID}"]`);
                if (bookingCard) {
                    // Cập nhật data-status
                    bookingCard.setAttribute('data-status', 'Canceled');
                    
                    // Cập nhật badge trạng thái
                    const statusBadge = bookingCard.querySelector('.booking-status');
                    if (statusBadge) {
                        statusBadge.className = 'booking-status status-canceled';
                        statusBadge.textContent = 'Đã hủy';
                    }
                    
                    // Thay thế nút hủy bằng nút xóa
                    const bookingActions = bookingCard.querySelector('.booking-actions');
                    if (bookingActions) {
                        const cancelButton = bookingActions.querySelector('.cancel-btn');
                        if (cancelButton) {
                            const deleteButton = document.createElement('button');
                            deleteButton.className = 'btn btn-outline-danger btn-sm delete-btn';
                            deleteButton.setAttribute('data-id', selectedAppointment.AppointmentID);
                            deleteButton.innerHTML = '<i class="bi bi-trash"></i> Xóa';
                            
                            // Thêm event listener cho nút xóa
                            deleteButton.addEventListener('click', function() {
                                deleteBooking(selectedAppointment.AppointmentID);
                            });
                            
                            // Thay thế nút cũ bằng nút mới
                            cancelButton.replaceWith(deleteButton);
                        }
                    }
                }
            } else {
                throw new Error(result.message || 'Không thể hủy lịch hẹn');
            }
        } catch (error) {
            console.error('Lỗi khi hủy lịch hẹn:', error);
            alert(`Lỗi: ${error.message}`);
        } finally {
            // Ẩn spinner
            document.getElementById('cancelSpinner').style.display = 'none';
            confirmCancelBtn.disabled = false;
        }
    }
    
    /**
     * Chuẩn bị để đánh giá
     */
    function prepareToReview(appointmentId) {
        // Lưu ID lịch hẹn đã chọn
        selectedAppointment = { AppointmentID: appointmentId };
        
        // Reset form đánh giá
        document.getElementById('reviewAppointmentId').value = appointmentId;
        document.getElementById('reviewComment').value = '';
        
        // Reset rating stars
        selectedRating = 0;
        resetRatingStars();
        
        // Hiển thị modal đánh giá
        reviewModal.show();
    }
    
    /**
     * Gửi đánh giá
     */
    async function submitReview() {
        if (!selectedAppointment) return;
        
        // Kiểm tra đã chọn số sao chưa
        if (selectedRating === 0) {
            alert('Vui lòng chọn số sao để đánh giá');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Lấy dữ liệu từ form
            const appointmentId = document.getElementById('reviewAppointmentId').value;
            const comment = document.getElementById('reviewComment').value.trim();
            
            // Disable nút gửi
            submitReviewBtn.disabled = true;
            
            const response = await fetch(`${API_BASE_URL}/booking/appointments/${appointmentId}/review`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    rating: selectedRating,
                    comment: comment
                })
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                // Đóng modal
                reviewModal.hide();
                
                // Hiển thị thông báo thành công
                alert('Đánh giá của bạn đã được ghi nhận. Cảm ơn bạn đã đánh giá!');
                
                // Tải lại lịch sử đặt lịch
                loadBookingHistory();
            } else {
                throw new Error(result.message || 'Không thể gửi đánh giá');
            }
        } catch (error) {
            console.error('Lỗi khi gửi đánh giá:', error);
            alert(`Lỗi: ${error.message}`);
        } finally {
            // Enable nút gửi
            submitReviewBtn.disabled = false;
        }
    }
    
    /**
     * Cập nhật giao diện stars khi chọn rating
     */
    function updateRatingStars(rating) {
        selectedRating = rating;
        highlightRatingStars(rating);
        
        // Cập nhật text
        let ratingText = '';
        
        switch (rating) {
            case 1:
                ratingText = 'Rất không hài lòng';
                break;
            case 2:
                ratingText = 'Không hài lòng';
                break;
            case 3:
                ratingText = 'Bình thường';
                break;
            case 4:
                ratingText = 'Hài lòng';
                break;
            case 5:
                ratingText = 'Rất hài lòng';
                break;
            default:
                ratingText = 'Hãy chọn số sao để đánh giá';
        }
        
        document.querySelector('.rating-text').textContent = ratingText;
    }
    
    /**
     * Highlight stars khi hover
     */
    function highlightRatingStars(rating) {
        document.querySelectorAll('.rating-star').forEach(star => {
            const starRating = parseInt(star.getAttribute('data-rating'));
            
            if (starRating <= rating) {
                star.classList.remove('bi-star');
                star.classList.add('bi-star-fill');
                star.classList.add('active');
            } else {
                star.classList.remove('bi-star-fill');
                star.classList.remove('active');
                star.classList.add('bi-star');
            }
        });
    }
    
    /**
     * Reset stars
     */
    function resetRatingStars() {
        document.querySelectorAll('.rating-star').forEach(star => {
            star.classList.remove('bi-star-fill');
            star.classList.remove('active');
            star.classList.add('bi-star');
        });
    }
    
    /**
     * Tạo HTML cho stars theo rating
     */
    function generateStars(rating) {
        let starsHtml = '';
        
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                starsHtml += '<i class="bi bi-star-fill"></i>';
            } else {
                starsHtml += '<i class="bi bi-star"></i>';
            }
        }
        
        return starsHtml;
    }
    
    /**
     * Format số tiền thành VNĐ
     */
    function formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', { 
            style: 'currency', 
            currency: 'VND',
            maximumFractionDigits: 0
        }).format(amount);
    }
});
