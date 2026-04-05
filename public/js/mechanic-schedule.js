// mechanic-schedule.js - JavaScript cho trang lịch làm việc kỹ thuật viên

/**
 * Format Notes để hiển thị trong card (global function)
 * Parse JSON nếu là đơn xin sửa
 */
function formatCardNotes(notes) {
    if (!notes) return '';
    
    try {
        const data = JSON.parse(notes);
        const isLegacyEdit = !!data.editRequest;
        const isEditRequest = isLegacyEdit || data.type === 'edit';
        const isLeaveRequest = data.type === 'leave';
        
        if (isEditRequest) {
            const edit = data.editRequest || data;
            const newDate = edit.newWorkDate ? new Date(edit.newWorkDate).toLocaleDateString('vi-VN') : '';
            
            if (data.approved) {
                return `<span class="text-success">✅ Đã duyệt sửa${newDate ? ` sang ${newDate}` : ''}</span>${edit.reason ? ` - ${edit.reason}` : ''}`;
            } else if (data.rejected) {
                return `<span class="text-danger">❌ Từ chối sửa</span> ${data.rejectedReason ? `- ${data.rejectedReason}` : ''}`;
            } else {
                return `⏳ Xin đổi${newDate ? ` sang ${newDate}` : ''}${edit.newStartTime && edit.newEndTime ? ` (${edit.newStartTime} - ${edit.newEndTime})` : ''}${edit.reason ? ` - ${edit.reason}` : ''}`;
            }
        }

        if (isLeaveRequest) {
            const leaveDate = data.newWorkDate ? new Date(data.newWorkDate).toLocaleDateString('vi-VN') : '';
            if (data.approved) {
                return `<span class="text-warning">📅 Đã duyệt nghỉ</span>${leaveDate ? ` ${leaveDate}` : ''}${data.reason ? ` - ${data.reason}` : ''}`;
            }
            if (data.rejected) {
                return `<span class="text-danger">❌ Từ chối nghỉ</span>${data.rejectedReason ? ` - ${data.rejectedReason}` : ''}`;
            }
            return `📝 Xin nghỉ${leaveDate ? ` ${leaveDate}` : ''}${data.reason ? ` - ${data.reason}` : ''}`;
        }
        
        return notes;
    } catch (e) {
        // Không phải JSON
        if (notes.startsWith('[XIN NGHỈ]')) {
            return notes.replace('[XIN NGHỈ] ', '');
        }
        return notes;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Sử dụng API_CONFIG từ config.js (được load trước)
    const API_BASE_URL = window.API_CONFIG ? window.API_CONFIG.BASE_URL : 'http://localhost:3001/api';
    
    // Lưu trữ dữ liệu
    let mechanicData = {};
    let schedules = [];
    let listViewSchedules = []; // Schedules cho List View
    let appointments = [];
    let calendar; // FullCalendar instance
    let selectedDate = null;
    let isEditMode = false;
    let selectedScheduleId = null;
    let allMechanicSchedules = []; // Lịch của TẤT CẢ kỹ thuật viên
    let mechanicCountByDate = {}; // Đếm số KTV theo ngày
    let currentWeekStart = null; // Ngày đầu tuần hiện tại (Weekly Schedule)
    let allMechanicsData = []; // Data tất cả KTV cho Weekly Schedule
    let currentViewMonth = new Date(); // Tháng đang xem (List View)
    
    // Kiểm tra xác thực kỹ thuật viên TRƯỚC (để load mechanicData)
    checkMechanicAuth();
    
    // SAU ĐÓ mới initialize các views (cần mechanicData)
    initializeWeeklySchedule();
    initializeTabs();
    initializeListView();
    updateMonthText();
    
    // Khởi tạo lịch
    initializeCalendar();
    
    // Tải dữ liệu ban đầu
    loadScheduleData();
    
    // Đăng ký sự kiện
    document.getElementById('addScheduleBtn').addEventListener('click', openAddScheduleModal);
    document.getElementById('refreshScheduleBtn').addEventListener('click', refreshScheduleData);
    document.getElementById('saveScheduleBtn').addEventListener('click', saveSchedule);
    document.getElementById('confirmLeaveRequestBtn').addEventListener('click', submitLeaveRequest);
    document.getElementById('confirmEditRequestBtn').addEventListener('click', submitEditRequest);
    document.getElementById('viewAllSchedulesBtn').addEventListener('click', viewAllSchedules);
    document.getElementById('logout-link').addEventListener('click', logout);
    document.getElementById('sidebar-logout').addEventListener('click', logout);
    
    /**
     * Kiểm tra xác thực kỹ thuật viên
     */
    function checkMechanicAuth() {
        const token = localStorage.getItem('token');
        const userInfo = localStorage.getItem('user');
        
        if (!token || !userInfo) {
            // Chưa đăng nhập, chuyển hướng đến trang đăng nhập
            window.location.href = '/login';
            return;
        }
        
        try {
            const user = JSON.parse(userInfo);
            
            // Kiểm tra vai trò kỹ thuật viên (role = 3)
            if (user.role !== 3) {
                // Không phải kỹ thuật viên, chuyển hướng đến trang chủ
                alert('Bạn không có quyền truy cập trang kỹ thuật viên');
                window.location.href = '/';
                return;
            }
            
            // Lưu thông tin kỹ thuật viên
            mechanicData = user;
            
            // Hiển thị tên kỹ thuật viên
            document.getElementById('mechanicName').textContent = user.fullName || 'Kỹ thuật viên';
            
            // Hiển thị avatar với chữ cái đầu tiên của tên
            if (user.fullName) {
                document.getElementById('avatarPlaceholder').textContent = user.fullName.charAt(0).toUpperCase();
            }
            
        } catch (error) {
            console.error('Lỗi phân tích dữ liệu người dùng:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
    }
    
    /**
     * Khởi tạo FullCalendar
     */
    function initializeCalendar() {
        const calendarEl = document.getElementById('calendar');
        
        if (!calendarEl) return;
        
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'timeGridWeek',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
            },
            locale: 'vi',
            buttonText: {
                today: 'Hôm nay',
                month: 'Tháng',
                week: 'Tuần',
                day: 'Ngày',
                list: 'Danh sách'
            },
            firstDay: 1, // Thứ 2 là ngày đầu tuần
            allDaySlot: false,
            slotMinTime: '07:00:00',
            slotMaxTime: '22:00:00',
            slotDuration: '00:30:00',
            navLinks: true,
            editable: false,
            selectable: true,
            selectMirror: true,
            dayMaxEvents: true,
            nowIndicator: true,
            slotEventOverlap: false,
            eventTimeFormat: {
                hour: '2-digit',
                minute: '2-digit',
                meridiem: false,
                hour12: false
            },
            select: function(info) {
                handleDateSelection(info.start, info.end);
            },
            eventClick: function(info) {
                handleEventClick(info.event);
            },
            dateClick: function(info) {
                handleDateClick(info.date);
            }
        });
        
        calendar.render();
        
        // Lưu tham chiếu toàn cục đến calendar
        window.schedulesCalendar = calendar;
    }
    
    /**
     * Tải dữ liệu lịch làm việc và lịch hẹn
     */
    async function loadScheduleData() {
        try {
            const token = localStorage.getItem('token');
            
            // Hàm này load TẤT CẢ lịch của mechanic (không cần date range)
            // Dùng cho FullCalendar - calendar tự filter theo visible range
            const response = await fetch(`${API_BASE_URL}/mechanics/schedules/all`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Không thể tải dữ liệu lịch làm việc');
            }
            
            const data = await response.json();
            
            if (data.success) {
                schedules = data.schedules;
                
                // Load lịch của tất cả KTV
                await loadAllMechanicSchedules();
                
                // Render calendar
                if (calendar) calendar.refetchEvents();
                
                // Render table
                renderSchedulesList(schedules);
            } else {
                showAlert(data.message || 'Không thể tải dữ liệu', 'danger');
            }
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu:', error);
            showAlert('Có lỗi xảy ra khi tải dữ liệu', 'danger');
        }
    }
    
    /**
     * Tải lịch làm việc của kỹ thuật viên
     */
    async function loadMechanicSchedules() {
        try {
            const token = localStorage.getItem('token');
            
            // Hiển thị trạng thái đang tải
            document.getElementById('schedulesList').innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-3">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Đang tải...</span>
                        </div>
                        <p class="mt-2">Đang tải lịch làm việc...</p>
                    </td>
                </tr>
            `;
            
            // Gọi API để lấy lịch làm việc
            const response = await fetch(`${API_BASE_URL}/mechanics/schedules?startDate=${startDateStr}&endDate=${endDateStr}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Lưu lịch làm việc
                schedules = data.schedules || [];
                
                // Hiển thị danh sách lịch làm việc
                renderSchedulesList(schedules);
            } else {
                throw new Error(data.message || 'Không thể tải lịch làm việc');
            }
            
        } catch (error) {
            console.error('Lỗi khi tải lịch làm việc:', error);
            
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
     * Tải lịch hẹn của kỹ thuật viên
     */
    async function loadMechanicAppointments() {
        try {
            const token = localStorage.getItem('token');
            
            // Gọi API để lấy lịch hẹn
            const response = await fetch(`${API_BASE_URL}/mechanics/appointments`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Lưu lịch hẹn
                appointments = data.appointments || [];
            } else {
                throw new Error(data.message || 'Không thể tải lịch hẹn');
            }
            
        } catch (error) {
            console.error('Lỗi khi tải lịch hẹn:', error);
            showError('Không thể tải lịch hẹn: ' + error.message);
        }
    }
    
    /**
     * Format thời gian từ HH:MM:SS thành HH:MM
     */
    function formatTimeDisplay(timeStr) {
        if (!timeStr) return '--:--';
        // Nếu là ISO string, extract time
        if (timeStr.includes('T')) {
            const date = new Date(timeStr);
            return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        }
        // Nếu là HH:MM:SS, lấy HH:MM
        return timeStr.substring(0, 5);
    }
    
    /**
     * Format Notes để hiển thị đẹp
     * Parse JSON nếu là đơn xin sửa đã duyệt/từ chối
     */
    function formatNotesDisplay(notes) {
        if (!notes) return '<span class="text-muted">Không có ghi chú</span>';
        
        // Thử parse JSON
        try {
            const data = JSON.parse(notes);
            const isLegacyEdit = !!data.editRequest;
            const isEditRequest = isLegacyEdit || data.type === 'edit';
            const isLeaveRequest = data.type === 'leave';
            
            if (isEditRequest) {
                const edit = data.editRequest || data;
                const newDate = edit.newWorkDate ? new Date(edit.newWorkDate).toLocaleDateString('vi-VN') : '--/--/----';
                const status = data.approved ? '✅ Đã duyệt sửa' : (data.rejected ? '❌ Đã từ chối sửa' : '⏳ Chờ duyệt');
                
                return `
                    <div class="small">
                        <span class="badge bg-info">${status}</span>
                        <div class="mt-1">
                            <i class="bi bi-arrow-right-circle me-1"></i>
                            Đổi sang: <strong>${newDate}</strong> (${edit.newStartTime} - ${edit.newEndTime})
                        </div>
                        ${edit.reason ? `<div class="text-muted"><i class="bi bi-chat-left-text me-1"></i>${edit.reason}</div>` : ''}
                    </div>
                `;
            }

            if (isLeaveRequest) {
                const leaveDate = data.newWorkDate ? new Date(data.newWorkDate).toLocaleDateString('vi-VN') : '--/--/----';
                const status = data.approved ? '✅ Đã duyệt nghỉ' : (data.rejected ? '❌ Từ chối nghỉ' : '⏳ Chờ duyệt nghỉ');

                return `
                    <div class="small">
                        <span class="badge bg-warning text-dark">${status}</span>
                        <div class="mt-1">
                            <i class="bi bi-calendar-x me-1"></i>
                            Ngày nghỉ: <strong>${leaveDate}</strong>
                        </div>
                        ${data.reason ? `<div class="text-muted"><i class="bi bi-chat-left-text me-1"></i>${data.reason}</div>` : ''}
                        ${data.rejectedReason ? `<div class="text-danger"><i class="bi bi-x-circle me-1"></i>${data.rejectedReason}</div>` : ''}
                    </div>
                `;
            }
            
            // Không phải format đặc biệt, return raw
            return notes;
        } catch (e) {
            // Không phải JSON, check các prefix đặc biệt
            if (notes.startsWith('[XIN NGHỈ]')) {
                return `<span class="badge bg-warning text-dark">Xin nghỉ</span> ${notes.replace('[XIN NGHỈ] ', '')}`;
            }
            return notes;
        }
    }
    
    /**
     * Hiển thị danh sách lịch làm việc
     */
    function renderSchedulesList(schedulesData) {
        const tableBody = document.getElementById('schedulesList');
        
        if (!schedulesData || schedulesData.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-3">
                        <i class="bi bi-calendar-x me-2"></i>
                        Bạn chưa đăng ký lịch làm việc nào
                    </td>
                </tr>
            `;
            return;
        }
        
        // Sắp xếp lịch làm việc theo WorkDate mới nhất đến cũ nhất
        const sortedSchedules = [...schedulesData].sort((a, b) => {
            const dateA = new Date(a.WorkDate);
            const dateB = new Date(b.WorkDate);
            return dateB - dateA;
        });
        
        // Giới hạn hiển thị 5 lịch gần nhất
        const recentSchedules = sortedSchedules.slice(0, 5);
        
        let html = '';
        
        recentSchedules.forEach(schedule => {
            // Format ngày làm việc
            const workDate = new Date(schedule.WorkDate);
            const formattedDate = workDate.toLocaleDateString('vi-VN');
            
            // Format thời gian
            const startTime = formatTimeDisplay(schedule.StartTime);
            const endTime = formatTimeDisplay(schedule.EndTime);
            
            // Tạo badge trạng thái
            let statusBadge = '';
            let statusClass = '';
            
            switch (schedule.Status) {
                case 'Approved':
                case 'ApprovedEdit':
                    statusBadge = 'Đã duyệt';
                    statusClass = 'bg-success';
                    break;
                case 'ApprovedLeave':
                    statusBadge = 'Đã duyệt nghỉ';
                    statusClass = 'bg-warning text-dark';
                    break;
                case 'Pending':
                    statusBadge = 'Chờ duyệt';
                    statusClass = 'bg-info';
                    break;
                case 'PendingLeave':
                    statusBadge = 'Chờ duyệt nghỉ';
                    statusClass = 'bg-warning text-dark';
                    break;
                case 'PendingEdit':
                    statusBadge = 'Chờ duyệt sửa';
                    statusClass = 'bg-info';
                    break;
                case 'Rejected':
                case 'RejectedEdit':
                    statusBadge = 'Đã từ chối';
                    statusClass = 'bg-danger';
                    break;
                case 'RejectedLeave':
                    statusBadge = 'Từ chối nghỉ';
                    statusClass = 'bg-danger';
                    break;
                default:
                    statusBadge = schedule.Status || 'Đang hoạt động';
                    statusClass = 'bg-primary';
            }
            
            // Format Notes - parse JSON nếu cần
            let notesDisplay = formatNotesDisplay(schedule.Notes);
            
            // Kiểm tra có thể edit không
            const canEdit = !['ApprovedLeave', 'PendingLeave', 'RejectedLeave', 'ApprovedEdit', 'PendingEdit', 'RejectedEdit'].includes(schedule.Status);
            
            html += `
                <tr>
                    <td>${schedule.ScheduleID}</td>
                    <td>${formattedDate}</td>
                    <td>${startTime} - ${endTime}</td>
                    <td><span class="badge ${statusClass}">${statusBadge}</span></td>
                    <td>${notesDisplay}</td>
                    <td>
                        ${canEdit ? `
                            <button class="btn btn-sm btn-primary btn-action" onclick="editSchedule(${schedule.ScheduleID})">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-warning btn-action" onclick="openLeaveRequestModal(${schedule.ScheduleID})">
                                <i class="bi bi-calendar-x"></i>
                            </button>
                        ` : `
                            <span class="text-muted small">--</span>
                        `}
                    </td>
                </tr>
            `;
        });
        
        tableBody.innerHTML = html;
        
        // Đặt hàm xử lý sự kiện cho các nút
        window.editSchedule = editSchedule;
        window.openLeaveRequestModal = openLeaveRequestModal;
    }
    
    /**
     * Cập nhật sự kiện trên lịch
     */
    function updateCalendarEvents() {
        if (!window.schedulesCalendar) return;
        
        // Xóa tất cả sự kiện hiện tại
        window.schedulesCalendar.removeAllEvents();
        
        // Thêm lịch làm việc
        const scheduleEvents = schedules.map(schedule => {
            // Xác định màu sắc dựa trên loại lịch
            let className = 'bg-schedule';
            
            if (schedule.Type === 'unavailable') {
                className = 'bg-unavailable';
            }
            
            return {
                id: 'schedule-' + schedule.ScheduleID,
                title: schedule.Type === 'available' ? 'Lịch làm việc' : 'Không làm việc',
                start: schedule.StartTime,
                end: schedule.EndTime,
                className: className,
                extendedProps: {
                    type: 'schedule',
                    schedule: schedule
                }
            };
        });
        
        // Thêm lịch hẹn
        const appointmentEvents = appointments.map(appointment => {
            return {
                id: 'appointment-' + appointment.AppointmentID,
                title: 'Lịch hẹn: ' + (appointment.CustomerName || 'Khách hàng'),
                start: appointment.AppointmentDate,
                end: new Date(new Date(appointment.AppointmentDate).getTime() + 60 * 60 * 1000), // Thêm 1 giờ
                className: 'bg-appointment',
                extendedProps: {
                    type: 'appointment',
                    appointment: appointment
                }
            };
        });
        
        // Thêm tất cả sự kiện vào lịch
        window.schedulesCalendar.addEventSource(scheduleEvents);
        window.schedulesCalendar.addEventSource(appointmentEvents);
    }
    
    /**
     * Xử lý khi chọn một khoảng thời gian trên lịch
     */
    function handleDateSelection(start, end) {
        // Lưu ngày được chọn
        selectedDate = start;
        
        // Mở modal đăng ký lịch với thời gian đã chọn
        openAddScheduleModal(start, end);
    }
    
    /**
     * Xử lý khi nhấp vào một ngày trên lịch
     */
    function handleDateClick(date) {
        // Lưu ngày được chọn
        selectedDate = date;
        
        // Có thể thêm hành động khác ở đây nếu cần
    }
    
    /**
     * Xử lý khi nhấp vào một sự kiện trên lịch
     */
    function handleEventClick(event) {
        const eventData = event.extendedProps;
        
        if (eventData.type === 'schedule') {
            // Mở modal chỉnh sửa lịch làm việc
            editSchedule(eventData.schedule.ScheduleID);
        } else if (eventData.type === 'appointment') {
            // Hiển thị thông tin lịch hẹn
            alert('Lịch hẹn: ' + event.title);
            // Có thể mở modal chi tiết lịch hẹn ở đây
        }
    }
    
    
    /**
     * Mở modal thêm lịch làm việc mới - V2
     * KHÔNG hiển thị checkbox đăng ký nghỉ
     */
    function openAddScheduleModal(start = null, end = null) {
        // Reset form
        document.getElementById('scheduleForm').reset();
        document.getElementById('scheduleId').value = '';
        document.getElementById('isEditMode').value = 'false';
        
        // Enable giờ bắt đầu/kết thúc
        document.getElementById('startTime').disabled = false;
        document.getElementById('endTime').disabled = false;
        document.getElementById('startTime').setAttribute('required', 'required');
        document.getElementById('endTime').setAttribute('required', 'required');
        
        // Reset ghi chú
        document.getElementById('notesLabel').textContent = 'Ghi chú';
        document.getElementById('scheduleNotes').required = false;
        document.getElementById('scheduleNotes').placeholder = 'VD: Ca sáng, ca chiều...';
        
        // Ẩn trạng thái
        document.getElementById('statusDisplay').style.display = 'none';
        
        // Nếu có thời gian đã chọn, điền vào form
        if (start && end) {
            const startDate = new Date(start);
            const endDate = new Date(end);
            
            // Điền ngày
            document.getElementById('scheduleDate').value = formatDateForInput(startDate);
            
            // Điền giờ (chuyển sang format HH:MM cho dropdown)
            const startHour = startDate.getHours().toString().padStart(2, '0');
            const startMin = startDate.getMinutes().toString().padStart(2, '0');
            document.getElementById('startTime').value = `${startHour}:${startMin}`;
            
            const endHour = endDate.getHours().toString().padStart(2, '0');
            const endMin = endDate.getMinutes().toString().padStart(2, '0');
            document.getElementById('endTime').value = `${endHour}:${endMin}`;
        } else {
            // Set ngày mặc định là ngày mai
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            document.getElementById('scheduleDate').value = formatDateForInput(tomorrow);
        }
        
        // ✅ FIX: Cập nhật tiêu đề modal (with null checks)
        const modalLabel = document.getElementById('scheduleModalLabel');
        const saveBtnText = document.getElementById('saveBtnText');
        
        if (modalLabel) {
            modalLabel.textContent = 'Đăng ký lịch làm việc mới';
        } else {
            console.error('❌ Element scheduleModalLabel not found');
        }
        
        if (saveBtnText) {
            saveBtnText.textContent = 'Lưu lịch';
        } else {
            console.error('❌ Element saveBtnText not found');
        }
        
        // Đặt chế độ thêm mới
        isEditMode = false;
        selectedScheduleId = null;
        
        // Hiển thị modal
        const modal = new bootstrap.Modal(document.getElementById('scheduleModal'));
        modal.show();
    }
    
    /**
     * Mở modal chỉnh sửa lịch làm việc - V2
     * HIỂN THỊ checkbox đăng ký nghỉ
     */
    async function editSchedule(scheduleId) {
        // Convert scheduleId sang number để so sánh
        const id = parseInt(scheduleId);
        
        // ===== CHECK CAN-EDIT TRƯỚC KHI MỞ MODAL =====
        try {
            const token = localStorage.getItem('token');
            const checkResponse = await fetch(`${API_BASE_URL}/mechanics/schedules/check-can-edit/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            const checkData = await checkResponse.json();
            
            if (checkData.success) {
                // Nếu không thể sửa VÀ không thể nghỉ → Hiện modal khóa hoàn toàn
                if (!checkData.canEdit && !checkData.canLeave) {
                    showLockInfoModal(checkData.lockReason, false, id);
                    return;
                }
                
                // Nếu không thể sửa nhưng có thể nghỉ → Hiện modal khóa + nút xin nghỉ
                if (!checkData.canEdit && checkData.canLeave) {
                    showLockInfoModal(checkData.lockReason, true, id);
                    return;
                }
                
                // Nếu có thể sửa → Mở modal xin sửa (cần Admin duyệt)
                openEditRequestModal(id);
                return;
            }
        } catch (error) {
            console.error('Lỗi khi kiểm tra can-edit:', error);
            // Fallback: Mở modal xin sửa
        }
        // ===== KẾT THÚC CHECK CAN-EDIT =====
        
        // Fallback: Mở modal xin sửa
        openEditRequestModal(id);
    }
    
    /**
     * Hiển thị modal thông báo lịch bị khóa
     */
    function showLockInfoModal(reason, canLeave, scheduleId) {
        document.getElementById('lockReasonText').textContent = reason || 'Lịch này đã bị khóa.';
        
        const leaveBtn = document.getElementById('lockLeaveRequestBtn');
        const hintText = document.getElementById('lockActionHint');
        
        if (canLeave) {
            leaveBtn.style.display = 'inline-block';
            hintText.innerHTML = '<i class="bi bi-lightbulb text-warning me-1"></i> Bạn vẫn có thể <strong>xin nghỉ</strong> nếu có việc bận.';
            
            // Gắn event listener cho nút xin nghỉ
            leaveBtn.onclick = function() {
                // Đóng modal khóa
                const lockModal = bootstrap.Modal.getInstance(document.getElementById('lockInfoModal'));
                lockModal.hide();
                
                // Mở modal xin nghỉ
                setTimeout(() => {
                    openLeaveRequestModal(scheduleId);
                }, 300);
            };
        } else {
            leaveBtn.style.display = 'none';
            hintText.textContent = '';
        }
        
        const modal = new bootstrap.Modal(document.getElementById('lockInfoModal'));
        modal.show();
    }
    
    /**
     * Mở modal xin sửa lịch
     */
    function openEditRequestModal(scheduleId) {
        const id = parseInt(scheduleId);
        selectedScheduleId = id;
        
        // Tìm thông tin lịch
        let schedule = null;
        
        if (window.listViewSchedules && window.listViewSchedules.length > 0) {
            schedule = window.listViewSchedules.find(s => s.ScheduleID === id);
        }
        
        if (!schedule && schedules && schedules.length > 0) {
            schedule = schedules.find(s => s.ScheduleID === id);
        }
        
        if (!schedule) {
            showAlert('Không tìm thấy thông tin lịch làm việc', 'danger');
            return;
        }
        
        // Điền thông tin lịch hiện tại
        const workDate = new Date(schedule.WorkDate);
        const dateStr = workDate.toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        document.getElementById('editCurrentDate').textContent = dateStr;
        
        // Format giờ
        let startTime = schedule.StartTime;
        let endTime = schedule.EndTime;
        
        if (startTime && startTime.includes('T')) {
            startTime = new Date(startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        } else if (startTime && startTime.includes(':')) {
            startTime = startTime.substring(0, 5);
        }
        
        if (endTime && endTime.includes('T')) {
            endTime = new Date(endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        } else if (endTime && endTime.includes(':')) {
            endTime = endTime.substring(0, 5);
        }
        
        document.getElementById('editCurrentTime').textContent = `${startTime || '--:--'} - ${endTime || '--:--'}`;
        
        // Set giá trị mặc định cho form mới
        const newDateInput = document.getElementById('editNewDate');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 2); // Tối thiểu 2 ngày
        newDateInput.min = tomorrow.toISOString().split('T')[0];
        
        const maxDate = new Date();
        maxDate.setMonth(maxDate.getMonth() + 3);
        newDateInput.max = maxDate.toISOString().split('T')[0];
        
        // Mặc định ngày mới = ngày hiện tại + 2
        newDateInput.value = tomorrow.toISOString().split('T')[0];
        
        // Set giờ mặc định
        document.getElementById('editNewStartTime').value = startTime || '08:00';
        document.getElementById('editNewEndTime').value = endTime || '17:00';
        
        // Clear lý do
        document.getElementById('editReason').value = '';
        document.getElementById('editScheduleId').value = id;
        
        // Hiển thị modal
        const modal = new bootstrap.Modal(document.getElementById('editRequestModal'));
        modal.show();
    }
    
    /**
     * Gửi đơn xin sửa lịch
     */
    async function submitEditRequest() {
        const scheduleId = document.getElementById('editScheduleId').value;
        const newWorkDate = document.getElementById('editNewDate').value;
        const newStartTime = document.getElementById('editNewStartTime').value;
        const newEndTime = document.getElementById('editNewEndTime').value;
        const reason = document.getElementById('editReason').value.trim();
        
        // Validate
        if (!newWorkDate) {
            showAlert('Vui lòng chọn ngày mới', 'danger');
            return;
        }
        
        if (!newStartTime || !newEndTime) {
            showAlert('Vui lòng chọn thời gian bắt đầu và kết thúc', 'danger');
            return;
        }
        
        if (newStartTime >= newEndTime) {
            showAlert('Thời gian kết thúc phải sau thời gian bắt đầu', 'danger');
            return;
        }
        
        if (!reason) {
            showAlert('Vui lòng nhập lý do xin sửa lịch', 'danger');
            return;
        }
        
        // Kiểm tra thời gian làm việc tối thiểu 4 tiếng
        const start = new Date(`2000-01-01T${newStartTime}`);
        const end = new Date(`2000-01-01T${newEndTime}`);
        const hoursDiff = (end - start) / (1000 * 60 * 60);
        
        if (hoursDiff < 4) {
            showAlert('Thời gian làm việc tối thiểu phải 4 tiếng', 'danger');
            return;
        }
        
        try {
            const spinner = document.getElementById('editRequestSpinner');
            const btn = document.getElementById('confirmEditRequestBtn');
            spinner.classList.remove('d-none');
            btn.disabled = true;
            
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/mechanics/schedules/${scheduleId}/request-edit`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    newWorkDate,
                    newStartTime,
                    newEndTime,
                    reason
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showAlert('Đã gửi đơn xin sửa lịch. Vui lòng đợi Admin duyệt.', 'success');
                
                // Đóng modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('editRequestModal'));
                modal.hide();
                
                // Reload dữ liệu
                await loadScheduleData();
                
                // Refresh list view nếu đang ở list view
                if (typeof loadScheduleListView === 'function') {
                    loadScheduleListView();
                }
            } else {
                showAlert(data.message || 'Có lỗi xảy ra khi gửi đơn', 'danger');
            }
            
        } catch (error) {
            console.error('Lỗi khi gửi đơn xin sửa:', error);
            showAlert('Có lỗi xảy ra khi gửi đơn xin sửa', 'danger');
        } finally {
            const spinner = document.getElementById('editRequestSpinner');
            const btn = document.getElementById('confirmEditRequestBtn');
            spinner.classList.add('d-none');
            btn.disabled = false;
        }
    }

/**
 * Load lịch của TẤT CẢ kỹ thuật viên để hiển thị trên calendar
 */

    
/**
 * Lưu lịch làm việc (tạo mới hoặc cập nhật)
 */
async function saveSchedule() {
    try {
        // Lấy dữ liệu từ form
        const scheduleDate = document.getElementById('scheduleDate').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        const notes = document.getElementById('scheduleNotes').value;
        
        // Form Sửa chỉ dành cho lịch làm việc bình thường
        // Xin nghỉ đã tách riêng ra modal khác
        const isUnavailable = false;
        
        // Kiểm tra dữ liệu cơ bản
        if (!scheduleDate) {
            showAlert('Vui lòng chọn ngày', 'danger');
            return;
        }
        
        // Kiểm tra quy tắc 24 giờ (chỉ khi tạo mới, không áp dụng khi edit)
        if (!isEditMode) {
            const selectedDateTime = new Date(scheduleDate);
            const now = new Date();
            const diffHours = (selectedDateTime - now) / (1000 * 60 * 60);
            
            if (diffHours < 24) {
                showAlert('Lịch làm việc phải được đăng ký trước ít nhất 24 giờ', 'danger');
                return;
            }
        }
        
        // Kiểm tra thời gian làm việc
        if (!startTime || !endTime) {
            showAlert('Vui lòng chọn thời gian bắt đầu và kết thúc', 'danger');
            return;
        }
        
        if (startTime >= endTime) {
            showAlert('Thời gian kết thúc phải sau thời gian bắt đầu', 'danger');
            return;
        }
        
        // ===== THÊM VALIDATION MỚI Ở ĐÂY =====
        const isValid = await validateScheduleData(
            scheduleDate,
            startTime,
            endTime,
            isUnavailable,
            isEditMode,
            selectedScheduleId
        );
        
        if (!isValid) {
            return; // Dừng lại nếu validation fail
        }
        // ===== KẾT THÚC VALIDATION MỚI =====
        
        const saveBtn = document.getElementById('saveScheduleBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Đang lưu...';
        
        const token = localStorage.getItem('token');
        
        // Chuẩn bị dữ liệu gửi lên server
        const scheduleData = {
            WorkDate: scheduleDate,
            StartTime: startTime,       // ✅ Gửi trực tiếp "HH:MM"
            EndTime: endTime,           // ✅ Gửi trực tiếp "HH:MM"
            Type: 'available',
            IsAvailable: 1,
            Notes: notes
        };
        
        // ❌ REMOVED - Không cần convert sang ISO string nữa
        // scheduleData.startTime = new Date(`${scheduleDate}T${startTime}`).toISOString();
        // scheduleData.endTime = new Date(`${scheduleDate}T${endTime}`).toISOString();
        
        
        let url, method;
        
        if (isEditMode) {
            url = `${API_BASE_URL}/mechanics/schedules/${selectedScheduleId}`;
            method = 'PUT';
        } else {
            url = `${API_BASE_URL}/mechanics/schedules`;
            method = 'POST';
        }
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(scheduleData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            const successMessage = isEditMode ? 'Cập nhật lịch làm việc thành công!' : 'Đã đăng ký lịch làm việc thành công!';
            
            showAlert(successMessage, 'success');
            
            // Đóng modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('scheduleModal'));
            modal.hide();
            
            // Reload dữ liệu
            await loadScheduleData();
        } else {
            showAlert(data.message || 'Có lỗi xảy ra khi lưu lịch', 'danger');
        }
        
    } catch (error) {
        console.error('Lỗi khi lưu lịch:', error);
        showAlert('Có lỗi xảy ra khi lưu lịch', 'danger');
    } finally {
        const saveBtn = document.getElementById('saveScheduleBtn');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Lưu lịch';
    }
}
    
    /**
     * Mở modal xin nghỉ
     */
    function openLeaveRequestModal(scheduleId) {
        // Lưu ID lịch cần xin nghỉ (convert sang number)
        selectedScheduleId = parseInt(scheduleId);
        console.log('📝 openLeaveRequestModal - ID:', selectedScheduleId);
        
        // Tìm thông tin lịch
        let schedule = null;
        
        if (window.listViewSchedules && window.listViewSchedules.length > 0) {
            schedule = window.listViewSchedules.find(s => s.ScheduleID === selectedScheduleId);
        }
        
        if (!schedule && schedules && schedules.length > 0) {
            schedule = schedules.find(s => s.ScheduleID === selectedScheduleId);
        }
        
        console.log('📝 Found schedule for leave request:', schedule);
        
        // Điền thông tin lịch vào modal
        if (schedule) {
            // Format ngày
            const workDate = new Date(schedule.WorkDate);
            const dateStr = workDate.toLocaleDateString('vi-VN', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
            document.getElementById('leaveScheduleDate').textContent = dateStr;
            
            // Format giờ
            let startTime = schedule.StartTime;
            let endTime = schedule.EndTime;
            
            // Nếu là ISO string, parse và format
            if (startTime && startTime.includes('T')) {
                startTime = new Date(startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            } else if (startTime && startTime.includes(':')) {
                startTime = startTime.substring(0, 5);
            }
            
            if (endTime && endTime.includes('T')) {
                endTime = new Date(endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            } else if (endTime && endTime.includes(':')) {
                endTime = endTime.substring(0, 5);
            }
            
            document.getElementById('leaveScheduleTime').textContent = `${startTime || '--:--'} - ${endTime || '--:--'}`;
        } else {
            document.getElementById('leaveScheduleDate').textContent = '--/--/----';
            document.getElementById('leaveScheduleTime').textContent = '--:-- - --:--';
        }
        
        // Clear form
        document.getElementById('leaveReason').value = '';
        document.getElementById('leaveScheduleId').value = selectedScheduleId;
        
        // Hiển thị modal
        const modal = new bootstrap.Modal(document.getElementById('leaveRequestModal'));
        modal.show();
    }
    
    // EXPOSE FUNCTIONS ra window để có thể gọi từ List View
    window.editSchedule = editSchedule;
    window.openLeaveRequestModal = openLeaveRequestModal;
    window.openEditRequestModal = openEditRequestModal;
    window.submitEditRequest = submitEditRequest;
    
    /**
     * Gửi đơn xin nghỉ - Cập nhật status thành PendingLeave
     */
    async function submitLeaveRequest() {
        try {
            const token = localStorage.getItem('token');
            const leaveReason = document.getElementById('leaveReason').value.trim();
            
            if (!token || !selectedScheduleId) {
                throw new Error('Không có thông tin cần thiết');
            }
            
            if (!leaveReason) {
                showAlert('Vui lòng nhập lý do xin nghỉ', 'warning');
                document.getElementById('leaveReason').focus();
                return;
            }
            
            // Hiển thị trạng thái đang gửi
            const submitBtn = document.getElementById('confirmLeaveRequestBtn');
            const submitSpinner = document.getElementById('leaveRequestSpinner');
            submitBtn.disabled = true;
            submitSpinner.classList.remove('d-none');
            
            // Gọi API để cập nhật lịch thành xin nghỉ
            const response = await fetch(`${API_BASE_URL}/mechanics/schedules/${selectedScheduleId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    Type: 'unavailable',
                    IsAvailable: 0,
                    Status: 'PendingLeave',
                    Notes: `[XIN NGHỈ] ${leaveReason}`
                })
            });
            
            if (!response.ok) {
                throw new Error(`Lỗi HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Đóng modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('leaveRequestModal'));
                modal.hide();
                
                // Hiển thị thông báo thành công
                showSuccess('Đã gửi đơn xin nghỉ thành công. Vui lòng chờ Admin duyệt.');
                
                // Tải lại dữ liệu
                await loadScheduleData();
                
                // Refresh list view nếu đang hiển thị
                if (typeof refreshListView === 'function') {
                    refreshListView();
                }
            } else {
                throw new Error(data.message || 'Không thể gửi đơn xin nghỉ');
            }
            
        } catch (error) {
            console.error('Lỗi khi gửi đơn xin nghỉ:', error);
            showError('Không thể gửi đơn xin nghỉ: ' + error.message);
        } finally {
            // Khôi phục trạng thái nút
            const submitBtn = document.getElementById('confirmLeaveRequestBtn');
            const submitSpinner = document.getElementById('leaveRequestSpinner');
            submitBtn.disabled = false;
            submitSpinner.classList.add('d-none');
        }
    }
    
    /**
     * Xem tất cả lịch làm việc
     */
    function viewAllSchedules() {
        // Tải tất cả lịch làm việc và hiển thị
        renderSchedulesList(schedules);
    }
    
    /**
     * Làm mới dữ liệu lịch làm việc
     */
    function refreshScheduleData() {
        loadScheduleData();
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
    function showError(message) {
        const errorAlert = document.getElementById('errorAlert');
        const errorMessage = document.getElementById('errorMessage');
        
        errorMessage.textContent = message;
        errorAlert.classList.remove('d-none');
        
        // Tự động ẩn sau 5 giây
        setTimeout(() => {
            errorAlert.classList.add('d-none');
        }, 5000);
    }
    
    /**
     * Hiển thị thông báo thành công
     */
    function showSuccess(message) {
        const successAlert = document.getElementById('successAlert');
        const successMessage = document.getElementById('successMessage');
        
        successMessage.textContent = message;
        successAlert.classList.remove('d-none');
        
        // Tự động ẩn sau 5 giây
        setTimeout(() => {
            successAlert.classList.add('d-none');
        }, 5000);
    }
    
    /**
     * Format ngày cho input date
     */
    function formatDateForInput(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    }
    
    /**
     * Format giờ cho input time
     */
    function formatTimeForInput(date) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${hours}:${minutes}`;
    }
    async function loadAllMechanicSchedules() {
        try {
            const token = localStorage.getItem('token');
        
            // Lấy ngày bắt đầu và kết thúc của tháng hiện tại
            const now = new Date();
            const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        
            const response = await fetch(
                `${API_BASE_URL}/schedules/all?startDate=${formatDateForInput(startDate)}&endDate=${formatDateForInput(endDate)}`,
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
        
            if (!response.ok) throw new Error('Không thể tải lịch kỹ thuật viên');
        
            const data = await response.json();
        
            if (data.success) {
                allMechanicSchedules = data.data || data.schedules || [];
            
                // Đếm số KTV theo ngày
                mechanicCountByDate = {};
                allMechanicSchedules.forEach(schedule => {
                    const dateKey = schedule.WorkDate.split('T')[0];
                    if (!mechanicCountByDate[dateKey]) {
                        mechanicCountByDate[dateKey] = {
                            count: 0,
                            mechanics: []
                        };
                    }
                
                    // Chỉ đếm unique mechanic
                    if (!mechanicCountByDate[dateKey].mechanics.find(m => m.id === schedule.MechanicID)) {
                        mechanicCountByDate[dateKey].count++;
                        mechanicCountByDate[dateKey].mechanics.push({
                            id: schedule.MechanicID,
                            name: schedule.MechanicName,
                            phone: schedule.MechanicPhone,
                            startTime: schedule.StartTime,
                            endTime: schedule.EndTime
                        });
                    }
                });
            
                console.log('✅ Đã load lịch tất cả KTV:', allMechanicSchedules.length);
                console.log('📊 Số KTV theo ngày:', mechanicCountByDate);
            }
        } catch (error) {
            console.error('Lỗi khi load lịch tất cả KTV:', error);
        }
    }

/**
 * Kiểm tra số lượng KTV đã đăng ký ngày cụ thể
 */
    async function checkMechanicCountByDate(date) {
        try {
            const token = localStorage.getItem('token');
        
            const response = await fetch(
                `${API_BASE_URL}/mechanics/schedules/count-by-date?date=${date}`,
                {
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
        
            if (!response.ok) throw new Error('Không thể kiểm tra số lượng KTV');
        
            const data = await response.json();
        
            return data;
        } catch (error) {
            console.error('Lỗi khi kiểm tra số lượng KTV:', error);
            return { success: false, mechanicCount: 0, available: 6 };
        }
    }

/**
 * Kiểm tra overlap 4 tiếng
 */
    async function checkTimeOverlap(date, startTime, endTime, excludeScheduleId = null) {
        try {
            const token = localStorage.getItem('token');
        
            const response = await fetch(
                `${API_BASE_URL}/mechanics/schedules/check-overlap`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        date,
                        startTime,
                        endTime,
                        excludeScheduleId
                    })
                }
            );
        
            if (!response.ok) throw new Error('Không thể kiểm tra overlap');
        
            const data = await response.json();
        
            return data;
        } catch (error) {
            console.error('Lỗi khi kiểm tra overlap:', error);
            return { success: false, hasOverlap: false };
        }
    }

/**
 * Validate dữ liệu trước khi lưu
 */
    async function validateScheduleData(scheduleDate, startTime, endTime, isUnavailable, isEdit, scheduleId) {
        // VALIDATE 1: Thời gian tối thiểu 4 tiếng
        if (!isUnavailable && startTime && endTime) {
            const start = new Date(`2000-01-01T${startTime}`);
            const end = new Date(`2000-01-01T${endTime}`);
            const hoursDiff = (end - start) / (1000 * 60 * 60);
        
            if (hoursDiff < 4) {
                showAlert('Thời gian làm việc tối thiểu phải 4 tiếng', 'danger');
                return false;
            }
        }
    
        // VALIDATE 2: Số lượng KTV (max 6)
        if (!isEdit) {
            const countData = await checkMechanicCountByDate(scheduleDate);
        
            if (countData.success && countData.mechanicCount >= 6) {
                showAlert('Đã đủ 6 kỹ thuật viên đăng ký ngày này. Vui lòng chọn ngày khác.', 'danger');
                return false;
            }
        }
    
        // VALIDATE 3: Overlap 4 tiếng
        if (!isUnavailable && startTime && endTime) {
            const overlapData = await checkTimeOverlap(
                scheduleDate,
                startTime,
                endTime,
                isEdit ? scheduleId : null
            );
        
            if (overlapData.success && overlapData.hasOverlap) {
                if (overlapData.overlaps && overlapData.overlaps.length > 0) {
                    const existingTime = new Date(overlapData.overlaps[0].StartTime).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    showAlert(`Bạn đã có lịch lúc ${existingTime}. Lịch phải cách nhau tối thiểu 4 tiếng.`, 'danger');
                } else {
                    showAlert('Thời gian này xung đột với lịch khác. Phải cách nhau tối thiểu 4 tiếng.', 'danger');
                }
                return false;
            }
        }
    
        return true;
    }
    /**
     * Hiển thị thông báo
     */

// ========================================
// FUNCTIONS CHO BẢNG LỊCH TRÌNH TUẦN
// ========================================

/**
 * Biến toàn cục cho weekly schedule
 */

/**
 * Khởi tạo weekly schedule view
 */
function initializeWeeklySchedule() {
    // Set tuần hiện tại (Thứ Hai)
    currentWeekStart = getMonday(new Date());
    
    // Load data
    loadWeeklyScheduleData();
    
    // Event listeners
    document.getElementById('prevWeekBtn').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        loadWeeklyScheduleData();
    });
    
    document.getElementById('nextWeekBtn').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        loadWeeklyScheduleData();
    });
    
    document.getElementById('addScheduleFromWeeklyBtn').addEventListener('click', () => {
        openAddScheduleModal();
    });
}

/**
 * Lấy ngày Thứ Hai của tuần chứa date
 */
function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
}

/**
 * Load dữ liệu lịch tuần từ API
 */
async function loadWeeklyScheduleData() {
    try {
        // Tính ngày bắt đầu và kết thúc tuần
        const weekStart = new Date(currentWeekStart);
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        // FIX: Format dates for API (YYYY-MM-DD) using local timezone
        const startDateStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
        const endDateStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`;
        
        // Update header text
        const weekRangeText = `${formatDateVN(weekStart)} - ${formatDateVN(weekEnd)}`;
        document.getElementById('weekRangeText').textContent = weekRangeText;
        
        // Update ngày cho mỗi cột
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(currentWeekStart);
            dayDate.setDate(dayDate.getDate() + i);
            const dayElement = document.getElementById(`day${i+1}`);
            if (dayElement) {
                dayElement.textContent = formatDateShort(dayDate);
            }
        }
        
        // Call API lấy lịch theo tuần (DÙNG ĐÚNG API)
        const token = localStorage.getItem('token');
        const apiUrl = `${API_BASE_URL}/schedules/by-date-range/${startDateStr}/${endDateStr}`;
        
        console.log('🔗 Calling API:', apiUrl);
        
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Không thể tải dữ liệu');
        }
        
        const data = await response.json();
        
        console.log('📊 Weekly API Response:', {
            success: data.success,
            hasSchedules: !!data.schedules,
            hasDataSchedules: !!data.data?.schedules,
            count: data.schedules?.length || data.data?.schedules?.length || 0,
            structure: Object.keys(data)
        });
        
        if (data.success) {
            // Check data.schedules tồn tại
            const allSchedules = data.schedules || data.data?.schedules || [];
            console.log('📅 Total schedules for weekly:', allSchedules.length);
            
            // FIX: So sánh string YYYY-MM-DD thay vì Date objects để tránh timezone issue
            const weekSchedules = allSchedules.filter(schedule => {
                const d = new Date(schedule.WorkDate);
                const scheduleDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                return scheduleDateStr >= startDateStr && scheduleDateStr <= endDateStr;
            });
            
            console.log('🔍 Filter result:', {
                startDateStr,
                endDateStr,
                totalFromAPI: allSchedules.length,
                afterFilter: weekSchedules.length,
                mechanic20: weekSchedules.filter(s => s.MechanicID === 20)
            });
            
            // Group theo MechanicID
            const mechanicSchedules = groupSchedulesByMechanic(weekSchedules);
            
            // Render bảng
            renderWeeklyScheduleTable(mechanicSchedules, weekStart);
        } else {
            console.warn('⚠️ API response: success = false');
            // Render empty table
            renderWeeklyScheduleTable([], weekStart);
        }
        
    } catch (error) {
        console.error('❌ Lỗi load weekly schedule:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
        
        // Render empty table thay vì crash
        const tbody = document.getElementById('weeklyScheduleBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-3 text-danger">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Không thể tải lịch trình tuần. Vui lòng thử lại.
                    </td>
                </tr>
            `;
        }
    }
}

/**
 * Group schedules theo MechanicID
 */
function groupSchedulesByMechanic(schedules) {
    const grouped = {};
    
    schedules.forEach(schedule => {
        const mechanicId = schedule.MechanicID;
        const mechanicName = schedule.MechanicName || 'KTV #' + mechanicId;
        
        if (!grouped[mechanicId]) {
            grouped[mechanicId] = {
                id: mechanicId,
                name: mechanicName,
                schedules: []
            };
        }
        
        grouped[mechanicId].schedules.push(schedule);
    });
    
    return Object.values(grouped);
}

/**
 * Render bảng lịch tuần
 */
function renderWeeklyScheduleTable(mechanicSchedules, weekStart) {
    const tbody = document.getElementById('weeklyScheduleBody');
    
    // DEBUG: Log tất cả mechanics
    console.log('🔧 All mechanics in table:', mechanicSchedules.map(m => ({id: m.id, name: m.name})));
    const mechanic20 = mechanicSchedules.find(m => m.id === 20);
    console.log('🔧 Mechanic ID=20:', mechanic20);
    
    if (!mechanicSchedules || mechanicSchedules.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-3 text-muted">
                    <i class="bi bi-calendar-x me-2"></i>
                    Chưa có lịch làm việc nào trong tuần này
                </td>
            </tr>
        `;
        document.getElementById('hiddenMechanicsCount').textContent = '0';
        return;
    }
    
    // Sort theo tên
    mechanicSchedules.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    
    let html = '';
    const maxDisplay = 10; // Hiển thị tối đa 10 KTV
    const displayMechanics = mechanicSchedules.slice(0, maxDisplay);
    const hiddenCount = Math.max(0, mechanicSchedules.length - maxDisplay);
    
    displayMechanics.forEach(mechanic => {
        html += '<tr>';
        html += `<td><strong>${mechanic.name}</strong></td>`;
        
        // 7 cột cho 7 ngày
        for (let i = 0; i < 7; i++) {
            const dayDate = new Date(weekStart);
            dayDate.setDate(dayDate.getDate() + i);
            // FIX: Dùng local date thay vì toISOString() để tránh timezone shift
            const dateStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
            
            // Lọc schedules cho ngày này
            const daySchedules = mechanic.schedules.filter(s => {
                // FIX: Dùng local date thay vì toISOString()
                const d = new Date(s.WorkDate);
                const sDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                return sDate === dateStr;
            });
            
            html += '<td class="text-center">';
            
            if (daySchedules.length === 0) {
                html += '<span class="text-muted">-</span>';
            } else {
                // Hiển thị tối đa 2 ca đầu tiên
                const displaySchedules = daySchedules.slice(0, 2);
                
                displaySchedules.forEach((schedule, idx) => {
                    const startTime = formatTime(schedule.StartTime);
                    const endTime = formatTime(schedule.EndTime);
                    const bgClass = schedule.Type === 'work' ? 'bg-light' : 'bg-warning bg-opacity-25';
                    
                    html += `
                        <div class="schedule-cell ${bgClass} p-2 mb-1 rounded">
                            <small>${startTime} - ${endTime}</small>
                        </div>
                    `;
                });
                
                // Nếu có nhiều hơn 2 ca
                if (daySchedules.length > 2) {
                    const moreCount = daySchedules.length - 2;
                    html += `
                        <small class="text-muted">+${moreCount} ca khác</small>
                    `;
                }
            }
            
            html += '</td>';
        }
        
        html += '</tr>';
    });
    
    tbody.innerHTML = html;
    document.getElementById('hiddenMechanicsCount').textContent = hiddenCount;
}

/**
 * Format date sang dd-mm-yyyy
 */
function formatDateVN(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

/**
 * Format date ngắn gọn (dd/mm)
 */
function formatDateShort(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
}

/**
 * Format time từ ISO string sang HH:MM:SS
 */
// ========================================
// TAB SWITCHING FUNCTIONALITY
// ========================================

/**
 * Khởi tạo tabs
 */
// ========================================
// LIST VIEW FUNCTIONS - CHỈ HIỂN THỊ NGÀY CÓ LỊCH
// ========================================

/**
 * Biến toàn cục cho list view
 */

/**
 * Khởi tạo list view
 */
function initializeListView() {
    // Load lịch tháng hiện tại
    loadScheduleListView();
    
    // Event listeners
    document.getElementById('prevMonthBtn').addEventListener('click', () => {
        currentViewMonth.setMonth(currentViewMonth.getMonth() - 1);
        updateMonthText();
        loadScheduleListView();
    });
    
    document.getElementById('nextMonthBtn').addEventListener('click', () => {
        currentViewMonth.setMonth(currentViewMonth.getMonth() + 1);
        updateMonthText();
        loadScheduleListView();
    });
    
    document.getElementById('todayBtn').addEventListener('click', () => {
        currentViewMonth = new Date();
        updateMonthText();
        loadScheduleListView();
    });
    
    // Event cho empty state button
    const addFromEmptyBtn = document.getElementById('addScheduleFromEmptyBtn');
    if (addFromEmptyBtn) {
        addFromEmptyBtn.addEventListener('click', () => {
            openAddScheduleModal();
        });
    }
    
    console.log('✅ List view initialized');
}

/**
 * Update text hiển thị tháng
 */
function updateMonthText() {
    const monthNames = [
        'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
        'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
    ];
    
    const month = monthNames[currentViewMonth.getMonth()];
    const year = currentViewMonth.getFullYear();
    
    document.getElementById('currentMonthText').textContent = `${month}/${year}`;
}

/**
 * Load lịch làm việc cho list view
 */
async function loadScheduleListView() {
    try {
        // Show loading
        document.getElementById('scheduleLoading').style.display = 'block';
        document.getElementById('scheduleEmpty').style.display = 'none';
        document.getElementById('scheduleList').innerHTML = '';
        
        // Tính start và end date của tháng
        const year = currentViewMonth.getFullYear();
        const month = currentViewMonth.getMonth();
        
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);
        
        // FIX: Format dates using local timezone
        const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
        const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
        
        // Call API - Lấy tất cả lịch rồi filter ở frontend
        const token = localStorage.getItem('token');
        
        // Get current user's MechanicID - handle nhiều trường hợp
        const currentMechanicId = mechanicData.UserID || mechanicData.userId || mechanicData.id || mechanicData.MechanicID;
        
        console.log('📅 mechanicData:', mechanicData);
        console.log('📅 Loading schedules for Mechanic ID:', currentMechanicId);
        
        if (!currentMechanicId) {
            console.error('❌ Không tìm thấy MechanicID! mechanicData:', mechanicData);
            document.getElementById('scheduleLoading').style.display = 'none';
            document.getElementById('scheduleEmpty').style.display = 'block';
            return;
        }
        console.log('📅 Date range:', startDateStr, 'to', endDateStr);
        
        const response = await fetch(
            `${API_BASE_URL}/mechanics/schedules?startDate=${startDateStr}&endDate=${endDateStr}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        if (!response.ok) {
            throw new Error('Failed to load schedules');
        }
        
        const data = await response.json();
        
        console.log('📊 Total schedules from API:', data.schedules?.length || 0);
        
        // FILTER: Chỉ lấy lịch của user hiện tại
        let allSchedules = data.schedules || [];
        const mySchedules = allSchedules.filter(schedule => 
            schedule.MechanicID === currentMechanicId
        );
        
        console.log('✅ My schedules only:', mySchedules.length);
        
        // Override data.schedules với filtered schedules
        data.schedules = mySchedules;
        
        // LƯU VÀO BIẾN GLOBAL để các hàm khác có thể access
        window.listViewSchedules = mySchedules;
        
        console.log('📅 Loaded schedules for list view:', data.schedules?.length || 0);
        
        // Hide loading
        document.getElementById('scheduleLoading').style.display = 'none';
        
        if (!data.schedules || data.schedules.length === 0) {
            // Show empty state
            document.getElementById('scheduleEmpty').style.display = 'block';
        } else {
            // Render list
            renderScheduleList(data.schedules);
        }
        
    } catch (error) {
        console.error('❌ Error loading schedule list:', error);
        document.getElementById('scheduleLoading').style.display = 'none';
        
        // Show error message
        document.getElementById('scheduleList').innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Không thể tải lịch làm việc. Vui lòng thử lại.
            </div>
        `;
    }
}

/**
 * Render danh sách lịch - GROUP THEO NGÀY
 */
function renderScheduleList(schedules) {
    const container = document.getElementById('scheduleList');
    
    // Group schedules theo ngày
    const schedulesByDate = {};
    
    schedules.forEach(schedule => {
        // FIX: Dùng local date thay vì toISOString()
        const d = new Date(schedule.WorkDate);
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!schedulesByDate[date]) {
            schedulesByDate[date] = [];
        }
        schedulesByDate[date].push(schedule);
    });
    
    // Sort dates
    const sortedDates = Object.keys(schedulesByDate).sort();
    
    // Render
    let html = '';
    
    sortedDates.forEach(date => {
        const dateObj = new Date(date);
        const daySchedules = schedulesByDate[date];
        
        // Date header
        html += `
            <div class="schedule-date-group schedule-fade-in">
                <div class="schedule-date-header">
                    <h6>
                        <i class="bi bi-calendar-event me-2"></i>
                        ${formatDateHeader(dateObj)}
                    </h6>
                    <small>${formatDayOfWeek(dateObj)}</small>
                </div>
        `;
        
        // Schedule cards cho ngày này
        daySchedules.forEach(schedule => {
            html += renderScheduleCard(schedule);
        });
        
        html += '</div>';
    });
    
    container.innerHTML = html;
    
    // Attach event listeners cho các buttons
    attachScheduleCardEvents();
}

/**
 * Render 1 schedule card
 */
function renderScheduleCard(schedule) {
    console.log('🎨 Rendering card for schedule:', {
        ScheduleID: schedule.ScheduleID,
        MechanicID: schedule.MechanicID,
        WorkDate: schedule.WorkDate,
        StartTime: schedule.StartTime,
        EndTime: schedule.EndTime,
        Type: schedule.Type,
        Status: schedule.Status
    });
    
    const startTime = formatTimeOnly(schedule.StartTime);
    const endTime = formatTimeOnly(schedule.EndTime);
    
    console.log('⏰ Formatted times:', { startTime, endTime });
    
    // Determine type class và text
    let typeClass = 'work';
    let typeText = 'Lịch làm việc';
    let isPendingLeave = schedule.Status === 'PendingLeave';
    let isPendingEdit = schedule.Status === 'PendingEdit';
    let isApprovedLeave = schedule.Type === 'unavailable' && schedule.Status === 'ApprovedLeave';
    let isApprovedEdit = schedule.Status === 'ApprovedEdit';
    let isRejectedEdit = schedule.Status === 'RejectedEdit';
    
    if (isPendingLeave) {
        typeClass = 'pending-leave';
        typeText = '⏳ Chờ duyệt nghỉ';
    } else if (isPendingEdit) {
        typeClass = 'pending-edit';
        typeText = '⏳ Chờ duyệt sửa';
    } else if (isApprovedLeave) {
        typeClass = 'unavailable';
        typeText = '✅ Đã duyệt nghỉ';
    } else if (isApprovedEdit) {
        typeClass = 'approved-edit';
        typeText = '✅ Đã duyệt sửa';
    } else if (isRejectedEdit) {
        typeClass = 'rejected-edit';
        typeText = '❌ Từ chối sửa';
    } else if (schedule.Type === 'appointment') {
        typeClass = 'appointment';
        typeText = 'Lịch hẹn';
    }
    
    // Nếu đã xin nghỉ, xin sửa hoặc đã được duyệt -> không cho sửa/xin nghỉ nữa
    const canEdit = !isPendingLeave && !isPendingEdit && !isApprovedLeave && !isApprovedEdit && !isRejectedEdit;
    
    return `
        <div class="schedule-card ${isPendingLeave ? 'pending-leave-card' : ''}" data-schedule-id="${schedule.ScheduleID}">
            <div class="schedule-card-time">
                <i class="bi bi-clock"></i>
                ${startTime} - ${endTime}
            </div>
            
            <span class="schedule-card-type ${typeClass}">
                ${typeText}
            </span>
            
            ${schedule.Notes ? `
                <div class="schedule-card-notes">
                    <i class="bi bi-sticky me-1"></i>
                    ${formatCardNotes(schedule.Notes)}
                </div>
            ` : ''}
            
            ${canEdit ? `
                <div class="schedule-card-actions">
                    <button class="btn btn-sm btn-outline-primary edit-schedule-btn" 
                            data-schedule-id="${schedule.ScheduleID}">
                        <i class="bi bi-pencil me-1"></i>Sửa
                    </button>
                    <button class="btn btn-sm btn-outline-warning leave-request-btn"
                            data-schedule-id="${schedule.ScheduleID}">
                        <i class="bi bi-calendar-x me-1"></i>Xin nghỉ
                    </button>
                </div>
            ` : `
                <div class="schedule-card-actions">
                    <span class="text-muted small">
                        <i class="bi bi-info-circle me-1"></i>
                        ${isPendingLeave ? 'Đang chờ Admin duyệt' : 'Đã được Admin duyệt'}
                    </span>
                </div>
            `}
        </div>
    `;
}

/**
 * Attach event listeners cho schedule cards
 */
function attachScheduleCardEvents() {
    // Edit buttons
    document.querySelectorAll('.edit-schedule-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const scheduleId = this.getAttribute('data-schedule-id');
            editScheduleFromList(scheduleId);
        });
    });
    
    // Leave Request buttons (thay thế Delete buttons)
    document.querySelectorAll('.leave-request-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const scheduleId = this.getAttribute('data-schedule-id');
            requestLeaveFromList(scheduleId);
        });
    });
}

/**
 * Edit schedule từ list
 */
function editScheduleFromList(scheduleId) {
    console.log('✏️ Edit schedule:', scheduleId);
    // Gọi hàm editSchedule đã được expose ra window
    if (window.editSchedule) {
        window.editSchedule(scheduleId);
    } else {
        console.error('❌ editSchedule function not found');
        alert('Không thể mở form chỉnh sửa. Vui lòng tải lại trang.');
    }
}

/**
 * Request leave từ list - Mở modal xin nghỉ
 */
function requestLeaveFromList(scheduleId) {
    console.log('📝 Request leave for schedule:', scheduleId);
    // Gọi hàm openLeaveRequestModal đã được expose ra window
    if (window.openLeaveRequestModal) {
        window.openLeaveRequestModal(scheduleId);
    } else {
        console.error('❌ openLeaveRequestModal function not found');
        alert('Không thể mở form xin nghỉ. Vui lòng tải lại trang.');
    }
}

/**
 * Format date header (ngày tháng năm)
 */
function formatDateHeader(date) {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    
    return `${day} tháng ${month}, ${year}`;
}

/**
 * Format day of week
 */
function formatDayOfWeek(date) {
    const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    return days[date.getDay()];
}

/**
 * Format time only (HH:MM)
 */
function formatTimeOnly(timeStr) {
    console.log('⏰ formatTimeOnly called with:', timeStr, '| type:', typeof timeStr);
    
    if (!timeStr) {
        console.log('⏰ → Empty, returning "-"');
        return '-';
    }
    
    // Nếu đã là HH:MM hoặc HH:MM:SS
    if (typeof timeStr === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)) {
        return timeStr.substring(0, 5); // Lấy HH:MM
    }
    
    // Parse ISO datetime
    const date = new Date(timeStr);
    
    if (isNaN(date.getTime())) {
        return '-';
    }
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${hours}:${minutes}`;
}

/**
 * Refresh list view sau khi thêm/sửa/xóa
 */
function refreshListView() {
    loadScheduleListView();
}

// ========================================
// THÊM VÀO DOMContentLoaded
// ========================================

// Thêm dòng này sau initializeTabs():
// initializeListView();
// updateMonthText();


function initializeTabs() {
    const tabMySchedule = document.getElementById('tabMySchedule');
    const tabTeamSchedule = document.getElementById('tabTeamSchedule');
    
    const myScheduleSection = document.getElementById('myScheduleSection');
    const teamScheduleSection = document.getElementById('teamScheduleSection');
    
    const myScheduleActions = document.getElementById('myScheduleActions');
    const teamScheduleActions = document.getElementById('teamScheduleActions');
    
    // Event: Click "Lịch của tôi"
    tabMySchedule.addEventListener('click', function() {
        // Update active state
        tabMySchedule.classList.add('active');
        tabTeamSchedule.classList.remove('active');
        
        // Show/hide sections
        myScheduleSection.style.display = 'block';
        teamScheduleSection.style.display = 'none';
        
        // Show/hide action buttons
        myScheduleActions.style.display = 'block';
        teamScheduleActions.style.display = 'none';
        
        console.log('✅ Switched to: My Schedule');
        
        // Refresh calendar nếu cần
        if (calendar) {
            if (calendar) calendar.refetchEvents();
        }
    });
    
    // Event: Click "Lịch team"
    tabTeamSchedule.addEventListener('click', function() {
        // Update active state
        tabTeamSchedule.classList.add('active');
        tabMySchedule.classList.remove('active');
        
        // Show/hide sections
        teamScheduleSection.style.display = 'block';
        myScheduleSection.style.display = 'none';
        
        // Show/hide action buttons
        teamScheduleActions.style.display = 'block';
        myScheduleActions.style.display = 'none';
        
        console.log('✅ Switched to: Team Schedule');
        
        // Refresh weekly schedule
        loadWeeklyScheduleData();
    });
    
    console.log('✅ Tabs initialized');
}

// ========================================
// THÊM VÀO DOMContentLoaded
// ========================================

// Thêm dòng này vào cuối hàm DOMContentLoaded, SAU initializeWeeklySchedule():
// initializeTabs();


function formatTime(timeStr) {
    if (!timeStr) return '-';
    
    // Nếu đã là định dạng HH:MM:SS
    if (typeof timeStr === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)) {
        return timeStr;
    }
    
    // Parse ISO datetime string
    const date = new Date(timeStr);
    
    // Check valid date
    if (isNaN(date.getTime())) {
        console.warn('Invalid time format:', timeStr);
        return '-';
    }
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

// ========================================
// THÊM VÀO DOMContentLoaded
// ========================================

// Thêm dòng này vào cuối hàm DOMContentLoaded, TRƯỚC dòng checkMechanicAuth():
// initializeWeeklySchedule();


    function showAlert(message, type) {
        const alertId = type === 'success' ? 'successAlert' : 'errorAlert';
        const messageId = type === 'success' ? 'successMessage' : 'errorMessage';
        
        const alert = document.getElementById(alertId);
        const messageEl = document.getElementById(messageId);
        
        if (alert && messageEl) {
            messageEl.textContent = message;
            alert.classList.remove('d-none');
            
            // Scroll to top để thấy alert
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            // Tự động ẩn sau 5 giây
            setTimeout(() => {
                alert.classList.add('d-none');
            }, 5000);
        }
    }});
