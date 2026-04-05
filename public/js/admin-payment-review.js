/**
 * Admin Payment Review Module
 * Module duyệt ảnh chứng từ thanh toán cho Admin
 * Tự động thêm button và modal vào trang admin-booking.html
 */

// API URL - Tự động detect môi trường
const ADMIN_API_URL = (function() {
    if (typeof API_CONFIG !== 'undefined' && API_CONFIG.BASE_URL) {
        return API_CONFIG.BASE_URL;
    }
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:8080/api';
    }
    return 'https://suaxeweb-production.up.railway.app/api';
})();

// ========================================
// ADMIN PAYMENT REVIEW MODULE
// ========================================
const AdminPaymentReview = {
    currentProofId: null,
    currentFilter: 'WaitingReview',
    refreshInterval: null,

    /**
     * Khởi tạo module
     */
    init() {
        console.log('🔄 AdminPaymentReview.init()');
        
        // Chỉ chạy trên trang admin-booking
        if (!this.isAdminBookingPage()) {
            console.log('⏭️ Not admin-booking page, skipping...');
            return;
        }

        // Tạo button và modal
        this.createReviewButton();
        this.createReviewModal();
        this.createImageModal();
        this.createRejectModal();

        // Load pending count
        this.loadPendingCount();

        // Auto refresh mỗi 30s
        this.refreshInterval = setInterval(() => {
            this.loadPendingCount();
        }, 30000);

        console.log('✅ AdminPaymentReview initialized');
    },

    /**
     * Kiểm tra có phải trang admin-booking không
     */
    isAdminBookingPage() {
        const path = window.location.pathname;
        return path.includes('admin-booking') || path.endsWith('/admin-booking.html');
    },

    /**
     * Tạo button "Duyệt thanh toán"
     */
    createReviewButton() {
        // Tìm vị trí để thêm button (cạnh nút "Áp dụng bộ lọc")
        const filterSection = document.querySelector('.card-body .row.g-3');
        if (!filterSection) {
            console.error('❌ Không tìm thấy filter section');
            return;
        }

        // Tìm col chứa các button
        const buttonCol = filterSection.querySelector('.col-md-3.d-flex');
        if (!buttonCol) return;

        // Tạo button mới
        const reviewBtn = document.createElement('button');
        reviewBtn.className = 'btn btn-warning ms-2';
        reviewBtn.id = 'openPaymentReviewBtn';
        reviewBtn.title = 'Duyệt thanh toán chuyển khoản';
        reviewBtn.innerHTML = `
            <i class="bi bi-credit-card-2-front me-1"></i>
            Duyệt thanh toán
            <span class="badge bg-danger ms-1" id="pendingProofCount" style="display: none;">0</span>
        `;
        reviewBtn.onclick = () => this.openModal();

        buttonCol.appendChild(reviewBtn);
    },

    /**
     * Tạo modal chính để duyệt thanh toán
     */
    createReviewModal() {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'paymentReviewModal';
        modal.setAttribute('tabindex', '-1');
        modal.innerHTML = `
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header bg-warning">
                        <h5 class="modal-title">
                            <i class="bi bi-credit-card-2-front me-2"></i>
                            Duyệt thanh toán chuyển khoản
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <!-- Stats Cards -->
                        <div class="row mb-4" id="paymentStatsCards">
                            <div class="col-md-3">
                                <div class="card bg-warning text-dark">
                                    <div class="card-body text-center py-3">
                                        <h3 class="mb-0" id="statWaiting">0</h3>
                                        <small>Chờ duyệt</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card bg-success text-white">
                                    <div class="card-body text-center py-3">
                                        <h3 class="mb-0" id="statApproved">0</h3>
                                        <small>Đã duyệt hôm nay</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card bg-danger text-white">
                                    <div class="card-body text-center py-3">
                                        <h3 class="mb-0" id="statRejected">0</h3>
                                        <small>Từ chối hôm nay</small>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card bg-secondary text-white">
                                    <div class="card-body text-center py-3">
                                        <h3 class="mb-0" id="statExpired">0</h3>
                                        <small>Hết hạn hôm nay</small>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Filter -->
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <select class="form-select w-auto" id="proofStatusFilter" onchange="AdminPaymentReview.filterProofs(this.value)">
                                <option value="WaitingReview">Chờ duyệt</option>
                                <option value="Approved">Đã duyệt</option>
                                <option value="Rejected">Đã từ chối</option>
                                <option value="Expired">Hết hạn</option>
                                <option value="">Tất cả</option>
                            </select>
                            <button class="btn btn-outline-primary btn-sm" onclick="AdminPaymentReview.loadProofs()">
                                <i class="bi bi-arrow-clockwise me-1"></i>Refresh
                            </button>
                        </div>

                        <!-- Alert -->
                        <div class="alert alert-success" id="reviewSuccessAlert" style="display: none;"></div>
                        <div class="alert alert-danger" id="reviewErrorAlert" style="display: none;"></div>

                        <!-- Table -->
                        <div class="table-responsive">
                            <table class="table table-hover" id="proofsTable">
                                <thead class="table-light">
                                    <tr>
                                        <th>Mã đơn</th>
                                        <th>Khách hàng</th>
                                        <th>Số tiền</th>
                                        <th>Nội dung CK</th>
                                        <th>Thời gian upload</th>
                                        <th>Chờ</th>
                                        <th>Trạng thái</th>
                                        <th>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody id="proofsTableBody">
                                    <tr>
                                        <td colspan="8" class="text-center py-4">
                                            <div class="spinner-border text-primary" role="status"></div>
                                            <p class="mt-2 mb-0">Đang tải...</p>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    /**
     * Tạo modal xem ảnh chi tiết
     */
    createImageModal() {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'proofImageModal';
        modal.setAttribute('tabindex', '-1');
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Chi tiết chứng từ thanh toán</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-7">
                                <div class="text-center mb-3">
                                    <img id="proofImageLarge" src="" class="img-fluid rounded" style="max-height: 500px; cursor: zoom-in;" onclick="window.open(this.src, '_blank')">
                                </div>
                            </div>
                            <div class="col-md-5">
                                <div id="proofDetails">
                                    <!-- Details will be loaded here -->
                                </div>

                                <!-- Checklist cho admin -->
                                <div class="card mt-3">
                                    <div class="card-header bg-light">
                                        <strong><i class="bi bi-list-check me-2"></i>Checklist xác nhận</strong>
                                    </div>
                                    <div class="card-body">
                                        <div class="form-check mb-2">
                                            <input class="form-check-input" type="checkbox" id="checkAmount">
                                            <label class="form-check-label" for="checkAmount">Số tiền khớp</label>
                                        </div>
                                        <div class="form-check mb-2">
                                            <input class="form-check-input" type="checkbox" id="checkContent">
                                            <label class="form-check-label" for="checkContent">Nội dung CK khớp</label>
                                        </div>
                                        <div class="form-check">
                                            <input class="form-check-input" type="checkbox" id="checkTime">
                                            <label class="form-check-label" for="checkTime">Thời gian hợp lệ</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>
                        <button type="button" class="btn btn-danger" onclick="AdminPaymentReview.showRejectForm()">
                            <i class="bi bi-x-circle me-1"></i>Từ chối
                        </button>
                        <button type="button" class="btn btn-success" onclick="AdminPaymentReview.approveProof()">
                            <i class="bi bi-check-circle me-1"></i>Duyệt thanh toán
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    /**
     * Tạo modal từ chối
     */
    createRejectModal() {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'rejectProofModal';
        modal.setAttribute('tabindex', '-1');
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-danger text-white">
                        <h5 class="modal-title"><i class="bi bi-x-circle me-2"></i>Từ chối thanh toán</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">Lý do từ chối</label>
                            <select class="form-select" id="rejectReason">
                                <option value="">-- Chọn lý do --</option>
                                <option value="Số tiền không khớp">Số tiền không khớp</option>
                                <option value="Nội dung CK không đúng">Nội dung CK không đúng</option>
                                <option value="Ảnh không rõ ràng">Ảnh không rõ ràng</option>
                                <option value="Nghi ngờ gian lận">Nghi ngờ gian lận</option>
                                <option value="Khác">Khác</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Ghi chú thêm (tùy chọn)</label>
                            <textarea class="form-control" id="rejectNote" rows="3" placeholder="Nhập ghi chú..."></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Hủy</button>
                        <button type="button" class="btn btn-danger" onclick="AdminPaymentReview.rejectProof()">
                            <i class="bi bi-x-circle me-1"></i>Xác nhận từ chối
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    /**
     * Mở modal duyệt thanh toán
     */
    openModal() {
        const modal = new bootstrap.Modal(document.getElementById('paymentReviewModal'));
        modal.show();
        this.loadStats();
        this.loadProofs();
    },

    /**
     * Load số lượng pending
     */
    async loadPendingCount() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${ADMIN_API_URL}/payment-proof/admin/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();

            if (result.success) {
                const badge = document.getElementById('pendingProofCount');
                if (badge) {
                    const count = result.data.waiting || 0;
                    badge.textContent = count;
                    badge.style.display = count > 0 ? 'inline' : 'none';
                }
            }
        } catch (error) {
            console.error('❌ Load pending count error:', error);
        }
    },

    /**
     * Load thống kê
     */
    async loadStats() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${ADMIN_API_URL}/payment-proof/admin/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();

            if (result.success) {
                document.getElementById('statWaiting').textContent = result.data.waiting || 0;
                document.getElementById('statApproved').textContent = result.data.approved || 0;
                document.getElementById('statRejected').textContent = result.data.rejected || 0;
                document.getElementById('statExpired').textContent = result.data.expired || 0;
            }
        } catch (error) {
            console.error('❌ Load stats error:', error);
        }
    },

    /**
     * Load danh sách proofs
     */
    async loadProofs() {
        const tbody = document.getElementById('proofsTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <div class="spinner-border text-primary" role="status"></div>
                </td>
            </tr>
        `;

        try {
            const token = localStorage.getItem('token');
            const status = this.currentFilter;
            const url = status 
                ? `${ADMIN_API_URL}/payment-proof/admin/all?status=${status}`
                : `${ADMIN_API_URL}/payment-proof/admin/all`;

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();

            if (result.success && result.data.length > 0) {
                this.renderProofsTable(result.data);
            } else {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center py-4 text-muted">
                            <i class="bi bi-inbox" style="font-size: 2rem;"></i>
                            <p class="mt-2 mb-0">Không có dữ liệu</p>
                        </td>
                    </tr>
                `;
            }
        } catch (error) {
            console.error('❌ Load proofs error:', error);
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4 text-danger">
                        <i class="bi bi-exclamation-triangle me-2"></i>Lỗi tải dữ liệu
                    </td>
                </tr>
            `;
        }
    },

    /**
     * Render bảng danh sách
     */
    renderProofsTable(proofs) {
        const tbody = document.getElementById('proofsTableBody');
        tbody.innerHTML = proofs.map(proof => {
            const statusBadge = this.getStatusBadge(proof.Status);
            const waitTime = this.getWaitTime(proof.ProofUploadedAt || proof.CreatedAt);
            
            return `
                <tr>
                    <td><strong>BK${proof.AppointmentID}</strong></td>
                    <td>
                        <div>${proof.CustomerName || 'N/A'}</div>
                        <small class="text-muted">${proof.CustomerPhone || ''}</small>
                    </td>
                    <td class="text-primary fw-bold">${this.formatCurrency(proof.Amount)}</td>
                    <td><code>${proof.TransferContent || `BK${proof.AppointmentID}`}</code></td>
                    <td>
                        <small>${this.formatDateTime(proof.ProofUploadedAt || proof.CreatedAt)}</small>
                    </td>
                    <td><small class="text-muted">${waitTime}</small></td>
                    <td>${statusBadge}</td>
                    <td>
                        ${proof.ImageUrl ? `
                            <button class="btn btn-sm btn-outline-primary" onclick="AdminPaymentReview.viewProof(${proof.ProofID})">
                                <i class="bi bi-eye"></i> Xem
                            </button>
                        ` : '<span class="text-muted">Chưa upload</span>'}
                    </td>
                </tr>
            `;
        }).join('');
    },

    /**
     * Xem chi tiết proof
     */
    async viewProof(proofId) {
        this.currentProofId = proofId;
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${ADMIN_API_URL}/payment-proof/admin/all`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const result = await response.json();

            if (result.success) {
                const proof = result.data.find(p => p.ProofID === proofId);
                if (proof) {
                    // Update image
                    document.getElementById('proofImageLarge').src = proof.ImageUrl;

                    // Update details
                    document.getElementById('proofDetails').innerHTML = `
                        <div class="card">
                            <div class="card-body">
                                <h6 class="card-title mb-3">Thông tin đơn hàng</h6>
                                <table class="table table-sm table-borderless mb-0">
                                    <tr>
                                        <td class="text-muted">Mã đơn:</td>
                                        <td><strong>BK${proof.AppointmentID}</strong></td>
                                    </tr>
                                    <tr>
                                        <td class="text-muted">Khách hàng:</td>
                                        <td>${proof.CustomerName || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td class="text-muted">SĐT:</td>
                                        <td>${proof.CustomerPhone || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <td class="text-muted">Số tiền:</td>
                                        <td class="text-primary fw-bold">${this.formatCurrency(proof.Amount)}</td>
                                    </tr>
                                    <tr>
                                        <td class="text-muted">Nội dung CK:</td>
                                        <td><code>${proof.TransferContent || `BK${proof.AppointmentID}`}</code></td>
                                    </tr>
                                    <tr>
                                        <td class="text-muted">Upload lúc:</td>
                                        <td>${this.formatDateTime(proof.ProofUploadedAt)}</td>
                                    </tr>
                                </table>
                            </div>
                        </div>
                    `;

                    // Reset checkboxes
                    document.getElementById('checkAmount').checked = false;
                    document.getElementById('checkContent').checked = false;
                    document.getElementById('checkTime').checked = false;

                    // Show modal
                    const imageModal = new bootstrap.Modal(document.getElementById('proofImageModal'));
                    imageModal.show();
                }
            }
        } catch (error) {
            console.error('❌ View proof error:', error);
            this.showAlert('error', 'Lỗi tải chi tiết');
        }
    },

    /**
     * Duyệt thanh toán
     */
    async approveProof() {
        if (!this.currentProofId) return;

        if (!confirm('Xác nhận DUYỆT thanh toán này?')) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${ADMIN_API_URL}/payment-proof/admin/approve/${this.currentProofId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            const result = await response.json();

            if (result.success) {
                this.showAlert('success', 'Đã duyệt thanh toán thành công!');
                bootstrap.Modal.getInstance(document.getElementById('proofImageModal')).hide();
                this.loadStats();
                this.loadProofs();
                this.loadPendingCount();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('❌ Approve error:', error);
            this.showAlert('error', error.message || 'Lỗi duyệt thanh toán');
        }
    },

    /**
     * Hiện form từ chối
     */
    showRejectForm() {
        const rejectModal = new bootstrap.Modal(document.getElementById('rejectProofModal'));
        rejectModal.show();
    },

    /**
     * Từ chối thanh toán
     */
    async rejectProof() {
        if (!this.currentProofId) return;

        const reason = document.getElementById('rejectReason').value;
        const note = document.getElementById('rejectNote').value;

        if (!reason) {
            alert('Vui lòng chọn lý do từ chối');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${ADMIN_API_URL}/payment-proof/admin/reject/${this.currentProofId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    reason: reason,
                    note: note
                })
            });
            const result = await response.json();

            if (result.success) {
                this.showAlert('success', 'Đã từ chối thanh toán');
                bootstrap.Modal.getInstance(document.getElementById('rejectProofModal')).hide();
                bootstrap.Modal.getInstance(document.getElementById('proofImageModal')).hide();
                this.loadStats();
                this.loadProofs();
                this.loadPendingCount();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('❌ Reject error:', error);
            this.showAlert('error', error.message || 'Lỗi từ chối');
        }
    },

    /**
     * Filter theo status
     */
    filterProofs(status) {
        this.currentFilter = status;
        this.loadProofs();
    },

    /**
     * Helper functions
     */
    getStatusBadge(status) {
        const badges = {
            'Pending': '<span class="badge bg-secondary">Chờ upload</span>',
            'WaitingReview': '<span class="badge bg-warning text-dark">Chờ duyệt</span>',
            'Approved': '<span class="badge bg-success">Đã duyệt</span>',
            'Rejected': '<span class="badge bg-danger">Từ chối</span>',
            'Expired': '<span class="badge bg-secondary">Hết hạn</span>',
            'Canceled': '<span class="badge bg-dark">Đã hủy</span>'
        };
        return badges[status] || `<span class="badge bg-secondary">${status}</span>`;
    },

    parseServerDate(dateInput) {
        if (!dateInput) return null;

        if (dateInput instanceof Date) {
            return Number.isNaN(dateInput.getTime()) ? null : dateInput;
        }

        if (typeof dateInput === 'string') {
            const trimmed = dateInput.trim();

            if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
                return new Date(trimmed.replace(' ', 'T') + 'Z');
            }

            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(trimmed)) {
                return new Date(trimmed + 'Z');
            }

            const parsed = new Date(trimmed);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        const parsed = new Date(dateInput);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    },

    getWaitTime(dateStr) {
        if (!dateStr) return 'N/A';
        const date = this.parseServerDate(dateStr);
        if (!date) return 'N/A';
        const now = new Date();
        const diff = Math.floor((now - date) / 60000); // minutes
        
        if (diff < 1) return 'Vừa xong';
        if (diff < 60) return `${diff} phút trước`;
        if (diff < 1440) return `${Math.floor(diff/60)} giờ trước`;
        return `${Math.floor(diff/1440)} ngày trước`;
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND'
        }).format(amount || 0);
    },

    formatDateTime(dateStr) {
        if (!dateStr) return 'N/A';
        const date = this.parseServerDate(dateStr);
        if (!date) return 'N/A';

        return new Intl.DateTimeFormat('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(date);
    },

    showAlert(type, message) {
        const alertId = type === 'success' ? 'reviewSuccessAlert' : 'reviewErrorAlert';
        const alert = document.getElementById(alertId);
        if (alert) {
            alert.innerHTML = `<i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-triangle'} me-2"></i>${message}`;
            alert.style.display = 'block';
            setTimeout(() => { alert.style.display = 'none'; }, 5000);
        }
    }
};

// Expose to global scope
window.AdminPaymentReview = AdminPaymentReview;

// Auto init khi DOM ready
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        AdminPaymentReview.init();
    }, 500);
});

console.log('✅ AdminPaymentReview loaded');
