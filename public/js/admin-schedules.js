// admin-schedules.js - JavaScript cho trang quản lý lịch làm việc

document.addEventListener('DOMContentLoaded', function() {
    // Sử dụng API_CONFIG từ config.js (được load trước)
    const API_BASE_URL = window.API_CONFIG ? window.API_CONFIG.BASE_URL : 'http://localhost:3001/api';
    
    // Biến lưu trữ dữ liệu
    let schedules = [];
    let mechanics = [];
    let selectedScheduleId = null;
    let currentWeekDays = []; // Lưu trữ các ngày trong tuần hiện tại
    
    // Kiểm tra xác thực admin
    checkAdminAuth();
    
    // Khởi tạo các datepickers và timepickers
    initDateTimePickers();
    
    // Tải dữ liệu ban đầu
    initializePage();
    
    // Thêm event listeners cho các nút
    document.getElementById('addScheduleBtn').addEventListener('click', openAddScheduleModal);
    document.getElementById('saveScheduleBtn').addEventListener('click', saveSchedule);
    document.getElementById('confirmDeleteBtn').addEventListener('click', deleteSchedule);
    document.getElementById('searchScheduleBtn').addEventListener('click', searchSchedules);
    document.getElementById('logout-link').addEventListener('click', logout);
    document.getElementById('dropdown-logout').addEventListener('click', logout);
    
    // Thêm event listeners cho các nút điều hướng tuần
    document.getElementById('prevWeekBtn').addEventListener('click', navigateToPreviousWeek);
    document.getElementById('nextWeekBtn').addEventListener('click', navigateToNextWeek);
    
    // Thêm event listener cho nút xem tất cả kỹ thuật viên
    document.getElementById('viewAllMechanicsBtn').addEventListener('click', showAllMechanicsModal);

    async function initializePage() {
        currentWeekDays = getWeekDays();
        updateWeeklyScheduleHeader();
        updateCurrentWeekDisplay();

        await Promise.all([
            loadMechanics(),
            loadSchedules()
        ]);

        await loadSchedulesForWeek();
    }
    

     /*
     * Hiển thị modal tất cả kỹ thuật viên
     */
    function showAllMechanicsModal() {
        // Cập nhật header bảng với ngày trong tuần hiện tại
        updateModalWeeklyScheduleHeader();
        
        // Tải dữ liệu lịch trình cho tuần hiện tại
        renderModalWeeklySchedule();
        
        // Hiển thị modal
        const modal = new bootstrap.Modal(document.getElementById('allMechanicsModal'));
        modal.show();
    }

    /**
     * Cập nhật header của bảng lịch trình tuần trong modal
     */
    function updateModalWeeklyScheduleHeader() {
    const weeklyTable = document.getElementById('modalWeeklyScheduleTable');
    const headerRow = weeklyTable.querySelector('thead tr');
    
    const firstTh = headerRow.querySelector('th:first-child');
    const html = [firstTh.outerHTML];
    
    currentWeekDays.forEach((day, index) => {
        const dayName = getDayName(day.getDay());
        const formattedDate = day.toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'});
        
        const isToday = isDateToday(day);
        const todayClass = isToday ? 'today-column' : '';
        
        // Không thêm nhãn Hôm nay nữa
        html.push(`<th class="table-light ${todayClass}">${dayName}<br>${formattedDate}</th>`);
    });
    
    headerRow.innerHTML = html.join('');
}

/**
 * Cập nhật header của bảng lịch trình tuần chính - không có nhãn Hôm nay
 */
    function updateWeeklyScheduleHeader() {
        const weeklyTable = document.getElementById('weeklyScheduleTable');
        const headerRow = weeklyTable.querySelector('thead tr');
        
        const firstTh = headerRow.querySelector('th:first-child');
        const html = [firstTh.outerHTML];
        
        currentWeekDays.forEach((day, index) => {
            const dayName = getDayName(day.getDay());
            const formattedDate = day.toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'});
            
            const isToday = isDateToday(day);
            const todayClass = isToday ? 'today-column' : '';
            
            // Không thêm nhãn Hôm nay nữa
            html.push(`<th class="table-light ${todayClass}">${dayName}<br>${formattedDate}</th>`);
        });
        
        headerRow.innerHTML = html.join('');
    }

    /**
     * Hiển thị lịch trình tuần cho tất cả kỹ thuật viên trong modal
     */
    function renderModalWeeklySchedule() {
        const tableBody = document.getElementById('modalWeeklyScheduleBody');
        
        if (!mechanics || mechanics.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        Chưa có kỹ thuật viên nào. Vui lòng thêm kỹ thuật viên trước.
                    </td>
                </tr>
            `;
            return;
        }
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-3">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Đang tải...</span>
                    </div>
                    <p class="mt-2">Đang tải dữ liệu lịch trình tuần...</p>
                </td>
            </tr>
        `;
        
        // Lấy dữ liệu lịch trình cho tuần hiện tại trong modal
        fetchWeeklyScheduleForModal();
    }

    /**
     * Lấy dữ liệu lịch trình cho tuần hiện tại trong modal
     */
    async function fetchWeeklyScheduleForModal() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            // Lấy ngày bắt đầu và kết thúc của tuần
            const startDate = formatDateForAPI(currentWeekDays[0]);
            const endDate = formatDateForAPI(currentWeekDays[6]);
            
            // Gọi API để lấy dữ liệu lịch trình
            const response = await fetch(`${API_BASE_URL}/schedules/by-date-range/${startDate}/${endDate}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Tổ chức lại dữ liệu theo ngày
                const schedulesByDay = {};
                
                // Khởi tạo mảng rỗng cho mỗi ngày trong tuần
                currentWeekDays.forEach(day => {
                    const dateStr = formatDateForAPI(day);
                    schedulesByDay[dateStr] = [];
                });
                
                // Phân loại lịch trình theo ngày
                const schedules = data.schedules || [];
                schedules.forEach(schedule => {
                    const dateStr = schedule.WorkDate.split('T')[0]; // Lấy phần ngày từ ISO date
                    if (schedulesByDay[dateStr]) {
                        schedulesByDay[dateStr].push(schedule);
                    }
                });
                
                // Hiển thị lịch trình
                renderAllMechanicsWeeklySchedule(schedulesByDay);
            } else {
                throw new Error(data.message || 'Không thể tải lịch trình tuần');
            }
            
        } catch (error) {
            console.error('Lỗi khi tải lịch trình tuần cho modal:', error);
            
            document.getElementById('modalWeeklyScheduleBody').innerHTML = `
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
     * Hiển thị lịch trình tuần cho tất cả kỹ thuật viên
     */
    function renderAllMechanicsWeeklySchedule(schedulesByDay) {
        const tableBody = document.getElementById('modalWeeklyScheduleBody');
        
        if (!mechanics || mechanics.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        Chưa có kỹ thuật viên nào. Vui lòng thêm kỹ thuật viên trước.
                    </td>
                </tr>
            `;
            return;
        }
        
        // === LỌC CHỈ KTV CÓ LỊCH TRONG TUẦN ===
        const mechanicIdsWithSchedule = new Set();
        currentWeekDays.forEach(day => {
            const dateStr = formatDateForAPI(day);
            const daySchedules = schedulesByDay[dateStr] || [];
            daySchedules.forEach(schedule => {
                mechanicIdsWithSchedule.add(parseInt(schedule.MechanicID));
            });
        });
        
        const mechanicsWithSchedule = mechanics.filter(
            m => mechanicIdsWithSchedule.has(parseInt(m.UserID))
        );
        
        if (mechanicsWithSchedule.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted py-4">
                        <i class="bi bi-calendar-x fs-1 d-block mb-2"></i>
                        Không có kỹ thuật viên nào đăng ký làm việc trong tuần này.
                    </td>
                </tr>
            `;
            return;
        }
        // === END LỌC ===
        
        let html = '';
        
        // Hiển thị lịch trình cho các kỹ thuật viên CÓ LỊCH
        mechanicsWithSchedule.forEach(mechanic => {
            html += `<tr><td>${mechanic.FullName}</td>`;
            
            currentWeekDays.forEach(day => {
                const dateStr = formatDateForAPI(day);
                const daySchedules = schedulesByDay[dateStr] || [];
                
                const mechanicSchedules = daySchedules.filter(
                    schedule => parseInt(schedule.MechanicID) === parseInt(mechanic.UserID)
                );
                
                const isTodayClass = isDateToday(day) ? 'today-cell' : '';
                
                if (mechanicSchedules.length === 0) {
                    html += `<td class="no-schedule ${isTodayClass}">-</td>`;
                } else {
                    html += `<td class="${isTodayClass}">`;
                    
                    mechanicSchedules.forEach(schedule => {
                        html += `
                            <div class="time-slot" title="Nhấn để xem chi tiết" data-id="${schedule.ScheduleID}" 
                                onclick="editScheduleFromModal(${schedule.ScheduleID})">
                                <div class="slot-time">${schedule.StartTime} - ${schedule.EndTime}</div>
                            </div>
                        `;
                    });
                    
                    html += `</td>`;
                }
            });
            
            html += `</tr>`;
        });
        
        tableBody.innerHTML = html;
    }

    /**
     * Điều hướng đến tuần trước
     */
    function navigateToPreviousWeek() {
        // Lấy ngày Thứ Hai của tuần hiện tại
        const monday = currentWeekDays[0];
        
        // Tính ngày Thứ Hai của tuần trước
        const prevMonday = new Date(monday);
        prevMonday.setDate(monday.getDate() - 7);
        
        // Tạo mảng ngày mới
        const newWeekDays = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(prevMonday);
            day.setDate(prevMonday.getDate() + i);
            newWeekDays.push(day);
        }
        
        // Cập nhật tuần hiện tại
        currentWeekDays = newWeekDays;
        
        // Cập nhật hiển thị
        updateWeeklyScheduleHeader();
        updateCurrentWeekDisplay();
        loadSchedulesForWeek();
    }
    
    /**
     * Điều hướng đến tuần tiếp theo
     */
    function navigateToNextWeek() {
        // Lấy ngày Thứ Hai của tuần hiện tại
        const monday = currentWeekDays[0];
        
        // Tính ngày Thứ Hai của tuần tiếp theo
        const nextMonday = new Date(monday);
        nextMonday.setDate(monday.getDate() + 7);
        
        // Tạo mảng ngày mới
        const newWeekDays = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(nextMonday);
            day.setDate(nextMonday.getDate() + i);
            newWeekDays.push(day);
        }
        
        // Cập nhật tuần hiện tại
        currentWeekDays = newWeekDays;
        
        // Cập nhật hiển thị
        updateWeeklyScheduleHeader();
        updateCurrentWeekDisplay();
        loadSchedulesForWeek();
    }
    
    /**
     * Cập nhật hiển thị tuần hiện tại
     */
    function updateCurrentWeekDisplay() {
        const startDate = formatDateForDisplay(currentWeekDays[0]);
        const endDate = formatDateForDisplay(currentWeekDays[6]);
        
        document.getElementById('currentWeekDisplay').textContent = `${startDate} - ${endDate}`;
    }
    
    /**
     * Kiểm tra xác thực admin
     */
    function checkAdminAuth() {
        const token = localStorage.getItem('token');
        const userInfo = localStorage.getItem('user');
        
        if (!token || !userInfo) {
            window.location.href = '/login';
            return;
        }
        
        try {
            const user = JSON.parse(userInfo);
            
            if (user.role !== 1) {
                alert('Bạn không có quyền truy cập trang quản trị');
                window.location.href = '/';
                return;
            }
            
            document.getElementById('adminName').textContent = user.fullName || 'Admin';
            
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
     * Khởi tạo datepickers và timepickers
     */
    function initDateTimePickers() {
        // Datepickers
        flatpickr("#searchDate", {
            dateFormat: "d-m-Y",
            locale: "vn",
            allowInput: true
        });
        
        flatpickr("#workDate", {
            dateFormat: "Y-m-d",
            locale: "vn",
            allowInput: true
        });
        
        // Timepickers
        flatpickr("#startTime", {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            time_24hr: true,
            minuteIncrement: 30,
            defaultHour: 8,
            defaultMinute: 0
        });
        
        flatpickr("#endTime", {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            time_24hr: true,
            minuteIncrement: 30,
            defaultHour: 17,
            defaultMinute: 0
        });
    }
    

    /**
 * Mở modal chỉnh sửa lịch làm việc từ modal xem tất cả kỹ thuật viên
 */
function editScheduleFromModal(id) {
    try {
        // Đóng modal xem tất cả kỹ thuật viên trước
        const allMechanicsModal = bootstrap.Modal.getInstance(document.getElementById('allMechanicsModal'));
        if (allMechanicsModal) {
            allMechanicsModal.hide();
        }
        
        // Lưu ID lịch cần chỉnh sửa để xử lý sau khi modal đóng
        sessionStorage.setItem('editScheduleId', id);
        
        // Lắng nghe sự kiện khi modal đã ẩn hoàn toàn
        const modalElement = document.getElementById('allMechanicsModal');
        modalElement.addEventListener('hidden.bs.modal', function openEditModalAfterClose() {
            // Lấy ID từ sessionStorage
            const scheduleId = sessionStorage.getItem('editScheduleId');
            if (scheduleId) {
                // Gọi hàm edit thực tế
                editScheduleActual(parseInt(scheduleId));
                // Xóa dữ liệu đã lưu
                sessionStorage.removeItem('editScheduleId');
            }
            // Gỡ bỏ event listener để tránh trùng lặp
            modalElement.removeEventListener('hidden.bs.modal', openEditModalAfterClose);
        });
    } catch (error) {
        console.error('Lỗi khi chuẩn bị chỉnh sửa lịch làm việc:', error);
        showErrorMessage('Không thể mở form chỉnh sửa: ' + error.message);
    }
}

    /**
     * Hàm thực hiện việc chỉnh sửa lịch (được gọi sau khi modal đầu đóng)
     */
    async function editScheduleActual(id) {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            let schedule = schedules.find(s => s.ScheduleID === id);
            
            if (!schedule) {
                const response = await fetch(`${API_BASE_URL}/schedules/${id}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Lỗi HTTP: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.success && data.schedule) {
                    schedule = data.schedule;
                } else {
                    throw new Error('Không tìm thấy thông tin lịch làm việc');
                }
            }
            
            selectedScheduleId = id;
            
            document.getElementById('scheduleModalTitle').textContent = "Chỉnh sửa lịch làm việc";
            document.getElementById('scheduleId').value = schedule.ScheduleID;
            document.getElementById('mechanicId').value = schedule.MechanicID;
            
            let workDate = schedule.WorkDate;
            if (typeof workDate === 'string') {
                workDate = workDate.split('T')[0];
            }
            document.getElementById('workDate').value = workDate;
            
            document.getElementById('startTime').value = schedule.StartTime;
            document.getElementById('endTime').value = schedule.EndTime;
            
            // Mở modal chỉnh sửa
            const modal = new bootstrap.Modal(document.getElementById('scheduleModal'));
            modal.show();
            
        } catch (error) {
            console.error('Lỗi khi tải thông tin lịch làm việc:', error);
            showErrorMessage('Không thể tải thông tin lịch làm việc: ' + error.message);
        }
    }

    // Xuất hàm ra window scope
    window.editScheduleFromModal = editScheduleFromModal;


    /**
     * Tải danh sách kỹ thuật viên
     */
    async function loadMechanics() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            const response = await fetch(`${API_BASE_URL}/schedules/mechanics/list`, {
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
                populateMechanicDropdowns();
                if (currentWeekDays.length > 0) {
                    renderWeeklyScheduleCompact({});
                }
            } else {
                throw new Error(data.message || 'Không thể tải danh sách kỹ thuật viên');
            }
            
        } catch (error) {
            console.error('Lỗi khi tải danh sách kỹ thuật viên:', error);
            showErrorMessage('Không thể tải danh sách kỹ thuật viên: ' + error.message);
        }
    }
    
    /**
     * Điền danh sách kỹ thuật viên vào các dropdown
     */
    function populateMechanicDropdowns() {
        const mechanicIdSelect = document.getElementById('mechanicId');
        const mechanicFilterSelect = document.getElementById('mechanicFilter');
        
        while (mechanicIdSelect.options.length > 1) {
            mechanicIdSelect.remove(1);
        }
        
        while (mechanicFilterSelect.options.length > 1) {
            mechanicFilterSelect.remove(1);
        }
        
        mechanics.forEach(mechanic => {
            const option1 = document.createElement('option');
            option1.value = mechanic.UserID;
            option1.textContent = mechanic.FullName;
            mechanicIdSelect.appendChild(option1);
            
            const option2 = document.createElement('option');
            option2.value = mechanic.UserID;
            option2.textContent = mechanic.FullName;
            mechanicFilterSelect.appendChild(option2);
        });
    }
    
    /**
     * Tải danh sách lịch làm việc
     */
    async function loadSchedules() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            document.getElementById('schedulesList').innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-3">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Đang tải...</span>
                        </div>
                        <p class="mt-2">Đang tải danh sách lịch làm việc...</p>
                    </td>
                </tr>
            `;
            
            const response = await fetch(`${API_BASE_URL}/schedules`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                schedules = data.schedules || [];
                renderSchedulesTable(schedules);
            } else {
                throw new Error(data.message || 'Không thể tải danh sách lịch làm việc');
            }
            
        } catch (error) {
            console.error('Lỗi khi tải danh sách lịch làm việc:', error);
            showErrorMessage('Không thể tải danh sách lịch làm việc: ' + error.message);
            
            document.getElementById('schedulesList').innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-danger">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Lỗi: ${error.message}
                    </td>
                </tr>
            `;
        }
    }
    
    /**
     * Hiển thị danh sách lịch làm việc vào bảng
     */
    function renderSchedulesTable(schedulesData) {
        const tableBody = document.getElementById('schedulesList');
        
        if (!schedulesData || schedulesData.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">Chưa có lịch làm việc nào</td>
                </tr>
            `;
            return;
        }
        
        let html = '';
        
        schedulesData.forEach(schedule => {
            const workDate = new Date(schedule.WorkDate);
            const formattedDate = workDate.toLocaleDateString('vi-VN');
            
            html += `
                <tr>
                    <td>${schedule.ScheduleID}</td>
                    <td>${schedule.MechanicName || 'Không xác định'}</td>
                    <td>${formattedDate}</td>
                    <td>${schedule.StartTime}</td>
                    <td>${schedule.EndTime}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-primary action-btn" onclick="editSchedule(${schedule.ScheduleID})" title="Chỉnh sửa">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-danger action-btn" onclick="confirmDeleteSchedule(${schedule.ScheduleID})" title="Xóa">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html;
        
        if ($.fn.DataTable) {
            if ($.fn.DataTable.isDataTable('#schedulesTable')) {
                $('#schedulesTable').DataTable().destroy();
            }
            
            $('#schedulesTable').DataTable({
                language: {
                    url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/vi.json'
                },
                order: [[2, 'desc'], [3, 'asc']],
                responsive: true,
                pageLength: 10
            });
        }
        
        window.editSchedule = editSchedule;
        window.confirmDeleteSchedule = confirmDeleteSchedule;
        window.openAddScheduleModal = openAddScheduleModal;

        // Thêm hàm xử lý thêm lịch mới trực tiếp từ modal
        window.handleAddNewSchedule = function() {
        // Đóng modal hiện tại
        const allMechanicsModal = bootstrap.Modal.getInstance(document.getElementById('allMechanicsModal'));
        if (allMechanicsModal) {
            allMechanicsModal.hide();
        }
    
        // Đợi modal đóng hoàn toàn trước khi mở modal mới
        setTimeout(() => {
            openAddScheduleModal();
        }, 300);
        };

        // Đảm bảo các hàm khác cũng được xuất ra window scope
        window.editSchedule = editSchedule;
        window.confirmDeleteSchedule = confirmDeleteSchedule;
    }
    

    /**
     * Tải và hiển thị lịch trình tuần
     */
    async function loadWeeklySchedule() {
        currentWeekDays = getWeekDays();
        updateWeeklyScheduleHeader();
        updateCurrentWeekDisplay();
        await loadSchedulesForWeek();
    }
    
    /**
     * Lấy mảng 7 ngày trong tuần hiện tại (Thứ 2 - Chủ nhật)
     */
    function getWeekDays() {
        const now = new Date();
        const currentDay = now.getDay();
        const diff = currentDay === 0 ? 6 : currentDay - 1;
        
        const monday = new Date(now);
        monday.setDate(now.getDate() - diff);
        
        const weekDays = [];
        
        for (let i = 0; i < 7; i++) {
            const day = new Date(monday);
            day.setDate(monday.getDate() + i);
            weekDays.push(day);
        }
        
        return weekDays;
    }
    
    /**
     * Cập nhật header của bảng lịch trình tuần
     */
    function updateWeeklyScheduleHeader() {
        const weeklyTable = document.getElementById('weeklyScheduleTable');
        const headerRow = weeklyTable.querySelector('thead tr');
        
        const firstTh = headerRow.querySelector('th:first-child');
        const html = [firstTh.outerHTML];
        
        currentWeekDays.forEach((day, index) => {
            const dayName = getDayName(day.getDay());
            const formattedDate = day.toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'});
            
            const isToday = isDateToday(day);
            const todayClass = isToday ? 'today-column' : '';
            
            html.push(`<th class="table-light ${todayClass}">${dayName}<br>${formattedDate}</th>`);
        });
        
        headerRow.innerHTML = html.join('');
    }
    
    /**
     * Kiểm tra xem một ngày có phải ngày hiện tại không
     */
    function isDateToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }
    
    /**
     * Lấy tên thứ trong tuần từ số ngày
     */
    function getDayName(dayNumber) {
        const dayNames = [
            'Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 
            'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'
        ];
        return dayNames[dayNumber];
    }
    
    /**
     * Tải lịch trình cho tuần hiện tại
     */
    async function loadSchedulesForWeek() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            document.getElementById('weeklyScheduleBody').innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-3">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Đang tải...</span>
                        </div>
                        <p class="mt-2">Đang tải dữ liệu lịch trình tuần...</p>
                    </td>
                </tr>
            `;
            
            // Lấy ngày bắt đầu và kết thúc của tuần
            const startDate = formatDateForAPI(currentWeekDays[0]);
            const endDate = formatDateForAPI(currentWeekDays[6]);
            
            // Giả định API endpoint - điều chỉnh theo API thực tế của bạn
            const response = await fetch(`${API_BASE_URL}/schedules/by-date-range/${startDate}/${endDate}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Tổ chức lại dữ liệu theo ngày
                const schedulesByDay = {};
                
                // Khởi tạo mảng rỗng cho mỗi ngày trong tuần
                currentWeekDays.forEach(day => {
                    const dateStr = formatDateForAPI(day);
                    schedulesByDay[dateStr] = [];
                });
                
                // Phân loại lịch trình theo ngày
                const schedules = data.schedules || [];
                schedules.forEach(schedule => {
                    const dateStr = schedule.WorkDate.split('T')[0]; // Lấy phần ngày từ ISO date
                    if (schedulesByDay[dateStr]) {
                        schedulesByDay[dateStr].push(schedule);
                    }
                });
                
                renderWeeklyScheduleCompact(schedulesByDay);
            } else {
                throw new Error(data.message || 'Không thể tải lịch trình tuần');
            }
            
        } catch (error) {
            console.error('Lỗi khi tải lịch trình tuần:', error);
            
            document.getElementById('weeklyScheduleBody').innerHTML = `
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
     * Hiển thị lịch trình tuần dạng thu gọn
     */
    function renderWeeklyScheduleCompact(schedulesByDay) {
        if (!mechanics || mechanics.length === 0) {
            document.getElementById('weeklyScheduleBody').innerHTML = `
                <tr>
                    <td colspan="8" class="text-center">
                        Chưa có kỹ thuật viên nào. Vui lòng thêm kỹ thuật viên trước.
                    </td>
                </tr>
            `;
            return;
        }
        
        // === LỌC CHỈ KTV CÓ LỊCH TRONG TUẦN ===
        const mechanicIdsWithSchedule = new Set();
        currentWeekDays.forEach(day => {
            const dateStr = formatDateForAPI(day);
            const daySchedules = schedulesByDay[dateStr] || [];
            daySchedules.forEach(schedule => {
                mechanicIdsWithSchedule.add(parseInt(schedule.MechanicID));
            });
        });
        
        const mechanicsWithSchedule = mechanics.filter(
            m => mechanicIdsWithSchedule.has(parseInt(m.UserID))
        );
        
        if (mechanicsWithSchedule.length === 0) {
            document.getElementById('weeklyScheduleBody').innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted py-4">
                        <i class="bi bi-calendar-x fs-1 d-block mb-2"></i>
                        Không có kỹ thuật viên nào đăng ký làm việc trong tuần này.
                    </td>
                </tr>
            `;
            return;
        }
        // === END LỌC ===
        
        let html = '';
        
        // Chỉ hiển thị tối đa 5 kỹ thuật viên CÓ LỊCH
        const displayMechanics = mechanicsWithSchedule.slice(0, 5);
        
        displayMechanics.forEach(mechanic => {
            html += `<tr><td>${mechanic.FullName}</td>`;
            
            currentWeekDays.forEach(day => {
                const dateStr = formatDateForAPI(day);
                const daySchedules = schedulesByDay[dateStr] || [];
                
                const mechanicSchedules = daySchedules.filter(
                    schedule => parseInt(schedule.MechanicID) === parseInt(mechanic.UserID)
                );
                
                const isTodayClass = isDateToday(day) ? 'today-cell' : '';
                
                if (mechanicSchedules.length === 0) {
                    html += `<td class="no-schedule ${isTodayClass}">-</td>`;
                } else {
                    html += `<td class="${isTodayClass}">`;
                    
                    // Chỉ hiển thị tối đa 2 ca làm việc mỗi ngày
                    const displaySchedules = mechanicSchedules.slice(0, 2);
                    
                    displaySchedules.forEach(schedule => {
                        html += `
                            <div class="time-slot" title="Nhấn để xem chi tiết" data-id="${schedule.ScheduleID}" 
                                 onclick="editSchedule(${schedule.ScheduleID})">
                                <div class="slot-time">${schedule.StartTime} - ${schedule.EndTime}</div>
                            </div>
                        `;
                    });
                    
                    // Nếu có nhiều hơn 2 ca làm việc, hiển thị một thông báo
                    if (mechanicSchedules.length > 2) {
                        html += `<small class="text-muted">+${mechanicSchedules.length - 2} ca khác</small>`;
                    }
                    
                    html += `</td>`;
                }
            });
            
            html += `</tr>`;
        });
        
        // Nếu có nhiều hơn 5 kỹ thuật viên CÓ LỊCH, hiển thị thông báo
        if (mechanicsWithSchedule.length > 5) {
            html += `
                <tr>
                    <td colspan="8" class="text-center text-muted">
                        <small>+ ${mechanicsWithSchedule.length - 5} kỹ thuật viên khác. Sử dụng chức năng "Xem tất cả kỹ thuật viên" để xem đầy đủ.</small>
                    </td>
                </tr>
            `;
        }
        
        document.getElementById('weeklyScheduleBody').innerHTML = html;
        
        // Đặt sự kiện cho các time-slot
        window.editSchedule = editSchedule;
    }
    
    /**
     * Format ngày theo định dạng YYYY-MM-DD cho API
     */
    function formatDateForAPI(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    /**
     * Format ngày theo định dạng DD-MM-YYYY cho hiển thị
     */
    function formatDateForDisplay(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
    }
    
    /**
     * Tìm kiếm lịch làm việc
     */
    async function searchSchedules(isToday = false) {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            const searchDate = document.getElementById('searchDate').value;
            const mechanicId = document.getElementById('mechanicFilter').value;
            
            if (!isToday && !searchDate && !mechanicId) {
                showErrorMessage('Vui lòng chọn ít nhất một điều kiện tìm kiếm');
                return;
            }
            
            document.getElementById('schedulesList').innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-3">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Đang tải...</span>
                        </div>
                        <p class="mt-2">Đang tìm kiếm lịch làm việc...</p>
                    </td>
                </tr>
            `;
            
            let url = `${API_BASE_URL}/schedules/by-date`;
            let date;
            
            if (searchDate) {
                const [day, month, year] = searchDate.split('-');
                date = `${year}-${month}-${day}`;
            } else if (isToday) {
                const today = new Date();
                date = formatDateForAPI(today);
            }
            
            if (date) {
                url += `/${date}`;
            }
            
            if (mechanicId) {
                url += `?mechanicId=${mechanicId}`;
            }
            
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
                const filteredSchedules = data.schedules || [];
                renderSchedulesTable(filteredSchedules);
                
                if (filteredSchedules.length === 0) {
                    showInfoMessage('Không tìm thấy lịch làm việc nào phù hợp với điều kiện tìm kiếm');
                } else {
                    showSuccessMessage(`Tìm thấy ${filteredSchedules.length} lịch làm việc`);
                }
            } else {
                throw new Error(data.message || 'Không thể tìm kiếm lịch làm việc');
            }
            
        } catch (error) {
            console.error('Lỗi khi tìm kiếm lịch làm việc:', error);
            showErrorMessage('Không thể tìm kiếm lịch làm việc: ' + error.message);
            
            document.getElementById('schedulesList').innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-danger">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Lỗi: ${error.message}
                    </td>
                </tr>
            `;
        }
    }
    
    /**
     * Mở modal thêm lịch làm việc mới
     */
    function openAddScheduleModal(mechanicId = null, date = null) {
        document.getElementById('scheduleForm').reset();
        document.getElementById('scheduleModalTitle').textContent = "Thêm lịch làm việc";
        document.getElementById('scheduleId').value = "";
        
        selectedScheduleId = null;
        
        if (mechanicId) {
            document.getElementById('mechanicId').value = mechanicId;
        }
        
        if (date) {
            document.getElementById('workDate').value = date;
        }
        
        const modal = new bootstrap.Modal(document.getElementById('scheduleModal'));
        modal.show();
    }
    
    /**
     * Mở modal chỉnh sửa lịch làm việc
     */
    async function editSchedule(id) {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            let schedule = schedules.find(s => s.ScheduleID === id);
            
            if (!schedule) {
                const response = await fetch(`${API_BASE_URL}/schedules/${id}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Lỗi HTTP: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.success && data.schedule) {
                    schedule = data.schedule;
                } else {
                    throw new Error('Không tìm thấy thông tin lịch làm việc');
                }
            }
            
            selectedScheduleId = id;
            
            document.getElementById('scheduleModalTitle').textContent = "Chỉnh sửa lịch làm việc";
            
            document.getElementById('scheduleId').value = schedule.ScheduleID;
            document.getElementById('mechanicId').value = schedule.MechanicID;
            
            let workDate = schedule.WorkDate;
            if (typeof workDate === 'string') {
                workDate = workDate.split('T')[0];
            }
            document.getElementById('workDate').value = workDate;
            
            document.getElementById('startTime').value = schedule.StartTime;
            document.getElementById('endTime').value = schedule.EndTime;
            
            const modal = new bootstrap.Modal(document.getElementById('scheduleModal'));
            modal.show();
            
        } catch (error) {
            console.error('Lỗi khi tải thông tin lịch làm việc:', error);
            showErrorMessage('Không thể tải thông tin lịch làm việc: ' + error.message);
        }
    }
    
    /**
     * Hiển thị modal xác nhận xóa lịch làm việc
     */
    function confirmDeleteSchedule(id) {
        selectedScheduleId = id;
        
        const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
        modal.show();
    }
    
    /**
 * Cập nhật header của bảng lịch trình tuần
 */
function updateWeeklyScheduleHeader() {
    const weeklyTable = document.getElementById('weeklyScheduleTable');
    const headerRow = weeklyTable.querySelector('thead tr');
    
    const firstTh = headerRow.querySelector('th:first-child');
    const html = [firstTh.outerHTML];
    
    currentWeekDays.forEach((day, index) => {
        const dayName = getDayName(day.getDay());
        const formattedDate = day.toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit'});
        
        const isToday = isDateToday(day);
        const todayClass = isToday ? 'today-column' : '';
        
        // Thêm thẻ span riêng cho chỉ báo "Hôm nay" thay vì sử dụng :after trong CSS
        const todayIndicator = isToday ? '<span class="today-indicator">Hôm nay</span>' : '';
        
        html.push(`<th class="table-light ${todayClass}">${todayIndicator}${dayName}<br>${formattedDate}</th>`);
    });
    
    headerRow.innerHTML = html.join('');
}

    /**
     * Lưu lịch làm việc (thêm mới hoặc cập nhật)
     */
    async function saveSchedule() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            const mechanicId = document.getElementById('mechanicId').value;
            const workDate = document.getElementById('workDate').value;
            const startTime = document.getElementById('startTime').value;
            const endTime = document.getElementById('endTime').value;
            
            if (!mechanicId) {
                showErrorMessage('Vui lòng chọn kỹ thuật viên');
                return;
            }
            
            if (!workDate) {
                showErrorMessage('Vui lòng chọn ngày làm việc');
                return;
            }
            
            if (!startTime) {
                showErrorMessage('Vui lòng chọn giờ bắt đầu');
                return;
            }
            
            if (!endTime) {
                showErrorMessage('Vui lòng chọn giờ kết thúc');
                return;
            }
            
            if (startTime >= endTime) {
                showErrorMessage('Giờ bắt đầu phải trước giờ kết thúc');
                return;
            }
            
            const saveBtn = document.getElementById('saveScheduleBtn');
            const saveSpinner = document.getElementById('saveSpinner');
            saveBtn.disabled = true;
            saveSpinner.classList.remove('d-none');
            
            const scheduleData = {
                mechanicId: parseInt(mechanicId),
                workDate,
                startTime,
                endTime
            };
            
            let response;
            
            if (selectedScheduleId) {
                response = await fetch(`${API_BASE_URL}/schedules/${selectedScheduleId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(scheduleData)
                });
            } else {
                response = await fetch(`${API_BASE_URL}/schedules`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(scheduleData)
                });
            }
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('scheduleModal'));
                modal.hide();
                
                showSuccessMessage(selectedScheduleId ? 'Cập nhật lịch làm việc thành công' : 'Thêm lịch làm việc mới thành công');
                
                loadSchedules();
                loadWeeklySchedule();
            } else {
                throw new Error(result.message || 'Không thể lưu lịch làm việc');
            }
            
        } catch (error) {
            console.error('Lỗi khi lưu lịch làm việc:', error);
            showErrorMessage('Không thể lưu lịch làm việc: ' + error.message);
        } finally {
            const saveBtn = document.getElementById('saveScheduleBtn');
            const saveSpinner = document.getElementById('saveSpinner');
            saveBtn.disabled = false;
            saveSpinner.classList.add('d-none');
        }
    }
    
    /**
     * Xóa lịch làm việc
     */
    async function deleteSchedule() {
        if (!selectedScheduleId) {
            showErrorMessage('Không có ID lịch làm việc để xóa');
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Không có token xác thực');
            }
            
            const deleteBtn = document.getElementById('confirmDeleteBtn');
            const deleteSpinner = document.getElementById('deleteSpinner');
            deleteBtn.disabled = true;
            deleteSpinner.classList.remove('d-none');
            
            const response = await fetch(`${API_BASE_URL}/schedules/${selectedScheduleId}`, {
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
                const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
                modal.hide();
                
                showSuccessMessage('Xóa lịch làm việc thành công');
                
                loadSchedules();
                loadWeeklySchedule();
            } else {
                throw new Error(data.message || 'Không thể xóa lịch làm việc');
            }
            
        } catch (error) {
            console.error('Lỗi khi xóa lịch làm việc:', error);
            showErrorMessage('Không thể xóa lịch làm việc: ' + error.message);
        } finally {
            const deleteBtn = document.getElementById('confirmDeleteBtn');
            const deleteSpinner = document.getElementById('deleteSpinner');
            deleteBtn.disabled = false;
            deleteSpinner.classList.add('d-none');
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
        
        errorMessage.textContent = message;
        errorAlert.style.display = 'block';
        
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
        
        setTimeout(() => {
            successAlert.style.display = 'none';
        }, 5000);
    }
    
    /**
     * Hiển thị thông báo thông tin
     */
    function showInfoMessage(message) {
        const infoDiv = document.createElement('div');
        infoDiv.className = 'alert alert-info alert-dismissible fade show';
        infoDiv.role = 'alert';
        infoDiv.innerHTML = `
            <span>${message}</span>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        const container = document.querySelector('.container-fluid');
        if (container && container.firstChild) {
            container.insertBefore(infoDiv, container.firstChild);
            
            setTimeout(() => {
                infoDiv.remove();
            }, 5000);
        }
    }
});
