// js/socket-client.js
// Socket.io client cho Web Admin - Real-time updates

const SOCKET_CONFIG = {
  url: API_BASE_URL.replace('/api', ''), // Remove /api suffix
  options: {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    autoConnect: false
  }
};

class SocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.listeners = new Map();
    this.connectionStatus = 'disconnected';
  }

  /**
   * Kết nối Socket.io với token
   */
  connect() {
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.error('❌ Cannot connect socket: No auth token');
      return;
    }

    if (this.socket && this.connected) {
      console.log('✅ Socket already connected');
      return;
    }

    console.log('🔌 Connecting to socket server:', SOCKET_CONFIG.url);

    // Initialize socket với auth token
    this.socket = io(SOCKET_CONFIG.url, {
      ...SOCKET_CONFIG.options,
      auth: { token }
    });

    this.setupEventListeners();
  }

  /**
   * Setup các event listeners cơ bản
   */
  setupEventListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
      this.connected = true;
      this.connectionStatus = 'connected';
      this.showConnectionStatus('Đã kết nối real-time', 'success');
      
      // Trigger custom connect event
      this.emit('socket_connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      this.connected = false;
      this.connectionStatus = 'disconnected';
      this.showConnectionStatus('Mất kết nối real-time', 'warning');
      
      // Trigger custom disconnect event
      this.emit('socket_disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
      this.connectionStatus = 'error';
      this.showConnectionStatus('Lỗi kết nối real-time', 'error');
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Socket reconnected after ${attemptNumber} attempts`);
      this.showConnectionStatus('Đã kết nối lại', 'success');
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}`);
    });

    // Ping-pong
    this.socket.on('pong', () => {
      console.log('🏓 Pong received');
    });

    // Business events
    this.setupBusinessEvents();
  }

  /**
   * Setup các business event listeners
   */
  setupBusinessEvents() {
    // Appointment mới
    this.socket.on('new_appointment', (event) => {
      console.log('📢 New appointment received:', event);
      this.handleNewAppointment(event);
    });

    // Appointment updated
    this.socket.on('appointment_updated', (event) => {
      console.log('📢 Appointment updated:', event);
      this.handleAppointmentUpdated(event);
    });

    // Schedule created
    this.socket.on('schedule_created', (event) => {
      console.log('📢 Schedule created:', event);
      this.handleScheduleCreated(event);
    });

    // Schedule status changed
    this.socket.on('schedule_status_changed', (event) => {
      console.log('📢 Schedule status changed:', event);
      this.handleScheduleStatusChanged(event);
    });

    // New notification
    this.socket.on('new_notification', (event) => {
      console.log('📢 New notification:', event);
      this.handleNewNotification(event);
    });
  }

  /**
   * Handle appointment mới
   */
  handleNewAppointment(event) {
    const data = event.data;
    
    // Show toast notification
    this.showToast(
      '🆕 Lịch hẹn mới!',
      `${data.FullName} - ${data.Services || 'Dịch vụ'}`,
      'info'
    );

    // Play sound
    this.playNotificationSound();

    // Trigger custom event
    this.emit('new_appointment', data);

    // Auto refresh if on bookings page
    if (window.location.pathname.includes('booking') || 
        window.location.pathname.includes('appointments')) {
      this.refreshAppointmentsTable();
    }
  }

  /**
   * Handle appointment updated
   */
  handleAppointmentUpdated(event) {
    const data = event.data;
    const previousStatus = event.previousStatus;
    
    // Show toast
    this.showToast(
      '🔄 Cập nhật lịch hẹn',
      `${data.FullName}: ${previousStatus} → ${data.Status}`,
      'success'
    );

    // Trigger custom event
    this.emit('appointment_updated', data);

    // Auto refresh if on bookings page
    if (window.location.pathname.includes('booking') || 
        window.location.pathname.includes('appointments')) {
      this.refreshAppointmentsTable();
    }
  }

  /**
   * Handle schedule created
   */
  handleScheduleCreated(event) {
    const data = event.data;
    
    this.showToast(
      '📅 Lịch làm việc mới',
      `Kỹ thuật viên đã đăng ký lịch làm việc`,
      'info'
    );

    this.emit('schedule_created', data);

    // Auto refresh if on schedules page
    if (window.location.pathname.includes('schedule')) {
      location.reload();
    }
  }

  /**
   * Handle schedule status changed
   */
  handleScheduleStatusChanged(event) {
    const data = event.data;
    
    this.showToast(
      '✅ Trạng thái lịch',
      `Lịch làm việc: ${data.Status}`,
      data.Status === 'Approved' ? 'success' : 'warning'
    );

    this.emit('schedule_status_changed', data);
  }

  /**
   * Handle notification mới
   */
  handleNewNotification(event) {
    const data = event.data;
    
    this.showToast(
      data.Title,
      data.Message,
      'info'
    );

    this.emit('new_notification', data);

    // Update notification badge
    this.updateNotificationBadge();
  }

  /**
   * Refresh appointments table
   */
  refreshAppointmentsTable() {
    // Trigger global function if exists
    if (typeof loadBookings === 'function') {
      loadBookings();
    }
  }

  /**
   * Update notification badge
   */
  updateNotificationBadge() {
    // Implement badge update logic
    const badge = document.querySelector('.notification-badge');
    if (badge) {
      const currentCount = parseInt(badge.textContent) || 0;
      badge.textContent = currentCount + 1;
      badge.style.display = 'block';
    }
  }

  /**
   * Show toast notification
   */
  showToast(title, message, type = 'info') {
    // Check if toast container exists
    let container = document.getElementById('socket-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'socket-toast-container';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        max-width: 400px;
      `;
      document.body.appendChild(container);
    }

    // Create toast
    const toast = document.createElement('div');
    toast.className = `socket-toast socket-toast-${type}`;
    toast.style.cssText = `
      background: white;
      padding: 16px;
      margin-bottom: 10px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border-left: 4px solid ${this.getColorForType(type)};
      animation: slideIn 0.3s ease-out;
    `;

    toast.innerHTML = `
      <div style="display: flex; align-items: start; gap: 12px;">
        <div style="font-size: 24px;">${this.getIconForType(type)}</div>
        <div style="flex: 1;">
          <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
          <div style="font-size: 14px; color: #666;">${message}</div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" 
                style="border: none; background: none; font-size: 20px; cursor: pointer; color: #999;">
          ×
        </button>
      </div>
    `;

    container.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  getColorForType(type) {
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };
    return colors[type] || colors.info;
  }

  getIconForType(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  }

  /**
   * Play notification sound
   */
  playNotificationSound() {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZWBYOI6Xn77BeFg==');
      audio.volume = 0.3;
      audio.play().catch(e => console.log('Cannot play sound:', e));
    } catch (error) {
      console.log('Sound play error:', error);
    }
  }

  /**
   * Show connection status
   */
  showConnectionStatus(message, type) {
    console.log(`🔔 ${message} [${type}]`);
    
    // Optional: Show in UI
    const statusEl = document.getElementById('socket-status');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = `socket-status ${type}`;
    }
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      console.log('👋 Socket disconnected manually');
    }
  }

  /**
   * Emit custom event to listeners
   */
  emit(eventName, data) {
    const listeners = this.listeners.get(eventName) || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${eventName} listener:`, error);
      }
    });
  }

  /**
   * Register event listener
   */
  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(callback);
  }

  /**
   * Unregister event listener
   */
  off(eventName, callback) {
    if (!this.listeners.has(eventName)) return;
    
    const listeners = this.listeners.get(eventName);
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * Send ping
   */
  ping() {
    if (this.socket && this.connected) {
      this.socket.emit('ping');
    }
  }

  /**
   * Get connection status
   */
  isConnected() {
    return this.connected;
  }

  getStatus() {
    return this.connectionStatus;
  }
}

// Create global instance
const socketClient = new SocketClient();

// Auto connect when user is logged in
window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (token) {
    setTimeout(() => {
      socketClient.connect();
    }, 1000); // Delay 1s để đảm bảo page đã load xong
  }
});

// Keep backend awake
setInterval(() => {
  fetch(API_BASE_URL + '/test')
    .catch(() => console.log('Ping failed'));
}, 5 * 60 * 1000); // Ping mỗi 5 phút

// Expose to window
window.socketClient = socketClient;

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);