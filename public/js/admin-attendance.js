// ================================================
// ADMIN ATTENDANCE - FULL VERSION WITH LOCATION POPUP
// File: js/admin-attendance.js
// ✅ INCLUDES: Location popup with address text
// ================================================

const API_URL = window.API_BASE_URL || (window.API_CONFIG ? window.API_CONFIG.BASE_URL : 'https://suaxeweb-production.up.railway.app/api');

let currentQRToken = '';
let countdown = 30;
let countdownInterval;

console.log('📅 [ATTENDANCE] Module loading with API:', API_URL);

// ================================================
// INITIALIZATION
// ================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('📅 [ATTENDANCE] Page loaded - Initializing...');
    
    if (!window.API_CONFIG) {
        console.error('❌ [ATTENDANCE] config.js not loaded!');
    } else {
        console.log('✅ [ATTENDANCE] config.js detected');
    }
    
    // ✅ Load user info first
    loadUserInfo();
    
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) {
        dateFilter.value = today;
    }
    
    // Initialize
    generateQRCode();
    loadStats();
    loadAttendance();
    
    // Auto refresh
    setInterval(generateQRCode, 30000);
    setInterval(loadStats, 10000);
    setInterval(loadAttendance, 15000);
    
    // Date filter listener
    if (dateFilter) {
        dateFilter.addEventListener('change', function() {
            console.log('📅 [ATTENDANCE] Date changed:', dateFilter.value);
            loadStats();
            loadAttendance();
        });
    }
    
    console.log('✅ [ATTENDANCE] Initialization complete');
});

// ================================================
// LOAD USER INFO
// ================================================

function loadUserInfo() {
    try {
        const userStr = localStorage.getItem('user');
        
        if (!userStr) {
            console.warn('⚠️ [USER] No user data');
            return;
        }
        
        const user = JSON.parse(userStr);
        console.log('👤 [USER] Loading:', user);
        
        // Update name
        const adminNameEl = document.getElementById('adminName');
        if (adminNameEl) {
            const fullName = user.fullName || user.FullName || 'Admin';
            adminNameEl.textContent = fullName;
            console.log('✅ [USER] Name:', fullName);
        }
        
        // Update avatar
        const avatarEl = document.getElementById('avatarPlaceholder');
        if (avatarEl) {
            const fullName = user.fullName || user.FullName || 'Admin';
            const firstLetter = fullName.charAt(0).toUpperCase();
            avatarEl.textContent = firstLetter;
            avatarEl.style.fontSize = '1.2rem';
            avatarEl.style.fontWeight = '600';
            console.log('✅ [USER] Avatar:', firstLetter);
        }
        
    } catch (err) {
        console.error('❌ [USER] Error:', err);
    }
}

// ================================================
// QR CODE GENERATION
// ================================================

async function generateQRCode() {
    try {
        console.log('🔄 [QR] Fetching...');
        
        const response = await fetch(`${API_URL}/attendance/qr/image`);
        const data = await response.json();
        
        if (data.success) {
            currentQRToken = data.token;
            console.log('✅ [QR] Token:', currentQRToken.substring(0, 20) + '...');
            
            const container = document.getElementById('qrCodeContainer');
            if (!container) {
                console.error('❌ [QR] Container not found');
                return;
            }
            
            container.innerHTML = `<img src="${data.image}" alt="QR Code" style="max-width: 100%; height: auto;">`;
            console.log('✅ [QR] Displayed');
            
            startCountdown();
        } else {
            console.error('❌ [QR] Failed:', data.message);
        }
    } catch (err) {
        console.error('❌ [QR] Error:', err);
    }
}

// ================================================
// COUNTDOWN TIMER
// ================================================

function startCountdown() {
    countdown = 30;
    clearInterval(countdownInterval);
    
    const countdownEl = document.getElementById('countdown');
    const progressBar = document.getElementById('progressBar');
    
    if (!countdownEl || !progressBar) return;
    
    countdownEl.classList.remove('warning');
    
    countdownInterval = setInterval(() => {
        countdown--;
        countdownEl.textContent = countdown;
        
        const progress = (countdown / 30) * 100;
        progressBar.style.width = progress + '%';
        
        if (countdown <= 5) {
            progressBar.classList.remove('bg-success');
            progressBar.classList.add('bg-danger');
            countdownEl.classList.add('warning');
        } else {
            progressBar.classList.remove('bg-danger');
            progressBar.classList.add('bg-success');
            countdownEl.classList.remove('warning');
        }
        
        if (countdown <= 0) {
            clearInterval(countdownInterval);
        }
    }, 1000);
}

// ================================================
// LOAD STATISTICS
// ================================================

async function loadStats() {
    try {
        const token = localStorage.getItem('token');
        const dateFilter = document.getElementById('dateFilter');
        const date = dateFilter ? dateFilter.value : new Date().toISOString().split('T')[0];
        
        if (!token) {
            console.warn('⚠️ [STATS] No token');
            return;
        }
        
        console.log('📊 [STATS] Loading for:', date);
        
        const response = await fetch(
            `${API_URL}/attendance/admin/stats?date=${date}`,
            { 
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                } 
            }
        );
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('checkedInCount').textContent = data.stats.checkedIn;
            document.getElementById('checkedOutCount').textContent = data.stats.checkedOut;
            document.getElementById('lateCount').textContent = data.stats.late;
            document.getElementById('absentCount').textContent = data.stats.absent;
            console.log('✅ [STATS] Updated:', data.stats);
        }
    } catch (err) {
        console.error('❌ [STATS] Error:', err);
    }
}

// ================================================
// LOAD ATTENDANCE LIST
// ================================================

async function loadAttendance() {
    try {
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.warn('⚠️ [ATTENDANCE] No token');
            return;
        }
        
        const dateFilter = document.getElementById('dateFilter');
        const date = dateFilter ? dateFilter.value : new Date().toISOString().split('T')[0];
        
        console.log('📋 [ATTENDANCE] Loading for:', date);
        
        const response = await fetch(
            `${API_URL}/attendance/admin/today?date=${date}`,
            { 
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                } 
            }
        );
        
        const data = await response.json();
        
        if (data.success) {
            renderAttendanceTable(data.attendance);
            console.log('✅ [ATTENDANCE] Rendered', data.attendance.length, 'records');
            updateDateDisplay(data.date);
        }
    } catch (err) {
        console.error('❌ [ATTENDANCE] Error:', err);
    }
}

// ================================================
// RENDER ATTENDANCE TABLE WITH LOCATION BUTTON
// ================================================

function renderAttendanceTable(attendance) {
    const tbody = document.getElementById('attendanceTable');
    
    if (!tbody) {
        console.error('❌ [RENDER] Table not found');
        return;
    }
    
    if (!attendance || attendance.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4 text-muted">
                    <i class="bi bi-inbox fs-1 d-block mb-2"></i>
                    Chưa có ai chấm công hôm nay
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    attendance.forEach(record => {
        // Format times
        const checkIn = record.CheckInTime 
            ? formatTime(record.CheckInTime)
            : '<span class="text-muted">--:--</span>';
        
        const checkOut = record.CheckOutTime 
            ? formatTime(record.CheckOutTime)
            : '<span class="text-muted">--:--</span>';
        
        // ✅ Ca làm việc từ schedule
        const schedule = record.ScheduledStartTime && record.ScheduledEndTime
            ? `<small>${record.ScheduledStartTime.substring(0,5)}-${record.ScheduledEndTime.substring(0,5)}</small>`
            : '<span class="text-muted">Không lịch</span>';
        
        // ✅ Giờ theo lịch
        const scheduledHours = record.ScheduledWorkHours 
            ? `<strong>${record.ScheduledWorkHours}h</strong>`
            : '<span class="text-muted">--</span>';
        
        // ✅ Giờ thực tế
        const actualHours = record.ActualWorkHours 
            ? `<strong>${record.ActualWorkHours}h</strong>`
            : (record.CheckOutTime 
                ? '<span class="text-warning">Đang tính...</span>'
                : '<span class="text-muted">--</span>');
        
        // ✅ Tăng ca
        const overtime = record.OvertimeHours && record.OvertimeHours > 0
            ? `<span class="badge bg-warning text-dark">+${record.OvertimeHours}h</span>`
            : '<span class="text-muted">--</span>';
        
        // Status badge
        const status = record.Status || 'Present';
        const statusBadge = getStatusBadge(status);
        
        // ✅ Location button - FIXED với tên kỹ thuật viên
        const locationBtn = record.CheckInLatitude 
            ? `<button class="btn btn-sm btn-outline-primary" 
                    onclick='showLocationPopup(${record.CheckInLatitude}, ${record.CheckInLongitude}, "${record.FullName || 'N/A'}")'
                    title="Xem vị trí chấm công">
                    <i class="bi bi-geo-alt"></i>
                </button>` 
            : '<span class="text-muted">--</span>';
        
        html += `
            <tr>
                <td>
                    <div>
                        <strong>${record.FullName || 'N/A'}</strong><br>
                        <small class="text-muted">${record.PhoneNumber || ''}</small>
                    </div>
                </td>
                <td>
                    <i class="bi bi-box-arrow-in-right text-success"></i> ${checkIn}
                </td>
                <td>
                    <i class="bi bi-box-arrow-right text-danger"></i> ${checkOut}
                </td>
                <td>${schedule}</td>
                <td>${scheduledHours}</td>
                <td>${actualHours}</td>
                <td>${overtime}</td>
                <td>${statusBadge}</td>
                <td>${locationBtn}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// ================================================
// SHOW LOCATION POPUP - NEW FUNCTION
// ================================================

async function showLocationPopup(lat, lng, name) {
    console.log('🗺️ [LOCATION] Showing popup for:', name, lat, lng);
    
    // Get address from coordinates
    const address = await getAddressFromCoords(lat, lng);
    
    // Create modal HTML
    const modalHTML = `
        <div class="modal fade" id="locationModal" tabindex="-1">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">
                            <i class="bi bi-geo-alt-fill me-2"></i>
                            Vị trí chấm công
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label text-muted small">Kỹ thuật viên</label>
                            <div class="fw-bold fs-5">${name}</div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label text-muted small">Vị trí</label>
                            <div class="d-flex align-items-start gap-2">
                                <i class="bi bi-geo-alt text-primary mt-1"></i>
                                <div class="flex-grow-1">
                                    <div class="text-dark" id="locationAddress">
                                        ${address}
                                    </div>
                                    <small class="text-muted">
                                        <i class="bi bi-crosshair"></i>
                                        ${lat.toFixed(6)}, ${lng.toFixed(6)}
                                    </small>
                                </div>
                            </div>
                        </div>
                        
                        <div class="alert alert-light border mb-0">
                            <div class="d-flex align-items-center justify-content-between">
                                <div>
                                    <i class="bi bi-map text-primary me-2"></i>
                                    <strong>Xem trên Google Maps</strong>
                                </div>
                                <button class="btn btn-primary btn-sm" onclick="openInMaps(${lat}, ${lng})">
                                    <i class="bi bi-box-arrow-up-right me-1"></i>
                                    Mở Maps
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('locationModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('locationModal'));
    modal.show();
    
    // Remove modal from DOM when closed
    document.getElementById('locationModal').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
}

// ================================================
// GET ADDRESS FROM COORDINATES (REVERSE GEOCODING)
// ================================================

async function getAddressFromCoords(lat, lng) {
    try {
        // Using Nominatim OpenStreetMap API (free, no API key needed)
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=vi`
        );
        
        const data = await response.json();
        
        if (data && data.display_name) {
            console.log('✅ [GEOCODE] Address:', data.display_name);
            return data.display_name;
        }
        
        return `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
    } catch (error) {
        console.error('❌ [GEOCODE] Error:', error);
        return `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
    }
}

// ================================================
// OPEN IN MAPS
// ================================================

function openInMaps(lat, lng) {
    if (lat && lng) {
        const url = `https://www.google.com/maps?q=${lat},${lng}`;
        window.open(url, '_blank');
        console.log('🗺️ [MAPS] Opening:', lat, lng);
    }
}

// ================================================
// HELPER FUNCTIONS
// ================================================

function formatTime(dateTimeString) {
    try {
        const date = new Date(dateTimeString);
        return date.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return '--:--';
    }
}

function getStatusBadge(status) {
    switch (status) {
        case 'Late':
            return '<span class="badge bg-warning text-dark">Đi muộn</span>';
        case 'Present':
            return '<span class="badge bg-success">Đúng giờ</span>';
        case 'Absent':
            return '<span class="badge bg-danger">Vắng</span>';
        case 'CheckedIn':
            return '<span class="badge bg-info">Đã vào</span>';
        default:
            return '<span class="badge bg-secondary">' + status + '</span>';
    }
}

// ================================================
// DATE NAVIGATION
// ================================================

function updateDateDisplay(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const isToday = date.getTime() === today.getTime();
    console.log('📅 Viewing:', isToday ? 'TODAY' : dateStr);
}

function goToToday() {
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) {
        const today = new Date().toISOString().split('T')[0];
        dateFilter.value = today;
        loadStats();
        loadAttendance();
        console.log('📅 Jumped to today');
    }
}

function previousDay() {
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) {
        const currentDate = new Date(dateFilter.value);
        currentDate.setDate(currentDate.getDate() - 1);
        dateFilter.value = currentDate.toISOString().split('T')[0];
        loadStats();
        loadAttendance();
    }
}

function nextDay() {
    const dateFilter = document.getElementById('dateFilter');
    if (dateFilter) {
        const currentDate = new Date(dateFilter.value);
        currentDate.setDate(currentDate.getDate() + 1);
        dateFilter.value = currentDate.toISOString().split('T')[0];
        loadStats();
        loadAttendance();
    }
}

// ================================================
// EXPORTS
// ================================================

window.loadAttendance = loadAttendance;
window.showLocationPopup = showLocationPopup;
window.openInMaps = openInMaps;
window.generateQRCode = generateQRCode;
window.goToToday = goToToday;
window.previousDay = previousDay;
window.nextDay = nextDay;

window.attendanceApp = {
    generateQRCode,
    loadStats,
    loadAttendance,
    showLocationPopup,
    openInMaps,
    goToToday,
    previousDay,
    nextDay,
    loadUserInfo
};

console.log('✅ [ATTENDANCE] Module loaded with location popup');