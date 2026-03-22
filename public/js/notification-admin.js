// ================================
// NOTIFICATION SYSTEM - ADMIN VERSION
// CHỈ LOGIC, KHÔNG INJECT HTML
// ================================

document.addEventListener('DOMContentLoaded', function() {
    // Bell HTML đã có sẵn trong admin pages
    // Chỉ cần init logic thôi
    initNotificationLogic();
});

// ================================
// NOTIFICATION LOGIC
// ================================
function initNotificationLogic() {
    const API_URL = 'https://suaxeweb-production.up.railway.app';
    let currentTab = 'all';
    
    // DOM Elements
    const bellButton = document.getElementById('notificationBell');
    const badge = document.getElementById('notificationBadge');
    const dropdown = document.getElementById('notificationDropdown');
    const notificationsList = document.getElementById('notificationsList');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const markAllReadBtn = document.getElementById('markAllRead');
    const tabButtons = document.querySelectorAll('.tab-button');
    const unreadTabCount = document.getElementById('unreadTabCount');
    
    // Check if elements exist
    if (!bellButton || !dropdown) {
        console.error('Notification bell elements not found');
        return;
    }
    
    console.log('✅ Notification system initialized for admin');
    
    // Toggle dropdown
    bellButton.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.classList.toggle('show');
        if (dropdown.classList.contains('show')) {
            loadNotifications();
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.notification-bell')) {
            dropdown.classList.remove('show');
        }
    });
    
    // Mark all as read
    markAllReadBtn.addEventListener('click', markAllAsRead);
    
    // Tab switching
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            currentTab = this.dataset.tab;
            tabButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            loadNotifications();
        });
    });
    
    // Load notifications from API
    async function loadNotifications() {
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.warn('No auth token found');
            showEmptyState('Vui lòng đăng nhập');
            return;
        }
        
        try {
            showLoading();
            
            const unreadOnly = currentTab === 'unread';
            const url = `${API_URL}/api/notifications?limit=5&unread=${unreadOnly}`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                renderNotifications(data.data);
                updateUnreadCount();
            } else {
                showEmptyState(data.message || 'Lỗi tải thông báo');
            }
            
        } catch (error) {
            console.error('Error loading notifications:', error);
            showEmptyState('Không thể tải thông báo');
        }
    }
    
    // Render notifications
    function renderNotifications(notifications) {
        hideLoading();
        
        if (!notifications || notifications.length === 0) {
            showEmptyState('Không có thông báo');
            return;
        }
        
        hideEmptyState();
        
        const html = notifications.map(notif => `
            <div class="notification-item ${notif.IsRead ? '' : 'unread'}" 
                 data-id="${notif.NotificationID}"
                 onclick="handleNotificationClick(${notif.NotificationID}, '${notif.ActionUrl || ''}')">
                <div class="notification-icon ${notif.IconType || 'info'}">
                    ${getIconSVG(notif.IconType || 'info')}
                </div>
                <div class="notification-content">
                    <p class="notification-title">${notif.Title}</p>
                    <p class="notification-message">${notif.Message}</p>
                    <p class="notification-time">${formatTime(notif.CreatedAt)}</p>
                </div>
            </div>
        `).join('');
        
        notificationsList.innerHTML = html;
    }
    
    // Handle notification click
    window.handleNotificationClick = async function(notificationId, actionUrl) {
        await markAsRead(notificationId);
        
        if (actionUrl) {
            window.location.href = actionUrl;
        }
    };
    
    // Mark as read
    async function markAsRead(notificationId) {
        const token = localStorage.getItem('token');
        
        try {
            const response = await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                loadNotifications();
                updateUnreadCount();
            }
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    }
    
    // Mark all as read
    async function markAllAsRead() {
        const token = localStorage.getItem('token');
        
        try {
            const response = await fetch(`${API_URL}/api/notifications/read-all`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                loadNotifications();
                updateUnreadCount();
            }
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    }
    
    // Update unread count
    async function updateUnreadCount() {
        const token = localStorage.getItem('token');
        
        if (!token) return;
        
        try {
            const response = await fetch(`${API_URL}/api/notifications/unread-count`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const count = data.unreadCount || 0;
                
                if (count > 0) {
                    badge.textContent = count > 99 ? '99+' : count;
                    badge.style.display = 'block';
                    unreadTabCount.textContent = count;
                } else {
                    badge.style.display = 'none';
                    unreadTabCount.textContent = '';
                }
            }
        } catch (error) {
            console.error('Error updating count:', error);
        }
    }
    
    // Start polling
    function startPolling() {
        setInterval(() => {
            updateUnreadCount();
            if (dropdown.classList.contains('show')) {
                loadNotifications();
            }
        }, 30000);
    }
    
    // UI Helpers
    function showLoading() {
        loadingState.style.display = 'flex';
        emptyState.style.display = 'none';
        Array.from(notificationsList.children).forEach(child => {
            if (child !== loadingState && child !== emptyState) {
                child.style.display = 'none';
            }
        });
    }
    
    function hideLoading() {
        loadingState.style.display = 'none';
    }
    
    function showEmptyState(message) {
        hideLoading();
        emptyState.style.display = 'flex';
        emptyState.querySelector('p').textContent = message || 'Không có thông báo';
    }
    
    function hideEmptyState() {
        emptyState.style.display = 'none';
    }
    
    function formatTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMins < 1) return 'Vừa xong';
        if (diffMins < 60) return `${diffMins} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        if (diffDays < 7) return `${diffDays} ngày trước`;
        
        return date.toLocaleDateString('vi-VN');
    }
    
    function getIconSVG(type) {
        const icons = {
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 6L9 17l-5-5"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };
        
        return icons[type] || icons.info;
    }
    
    // Initialize
    loadNotifications();
    updateUnreadCount();
    startPolling();
}