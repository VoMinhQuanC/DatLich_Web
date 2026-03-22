// File: app/utils/notificationHelper.js
const { pool } = require('../../config/db');
const fcmController = require('../controllers/core/fcmController');

/**
 * 1. Core logic: Lưu vào DB + Gửi Push qua Firebase
 */
async function sendSystemNotification(data) {
    try {
        const { userId, title, message, type, priority, iconType, relatedId, relatedType } = data;

        // BƯỚC 1: Lưu vào bảng Notifications trong MySQL để user xem lại lịch sử
        const [result] = await pool.query(`
            INSERT INTO Notifications 
            (UserID, Title, Message, Type, Priority, IconType, RelatedID, RelatedType, CreatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [userId, title, message, type || 'system', priority || 'normal', iconType || 'info', relatedId, relatedType]);

        // BƯỚC 2: Gửi Push Notification qua Firebase (FCM)
        // Hàm này sẽ tự động bỏ qua nếu user chưa đăng ký token FCM
        await fcmController.sendPushNotification(userId, {
            title: title,
            body: message,
            type: type,
            referenceId: relatedId,
            data: { relatedType }
        });

        return result.insertId;
    } catch (error) {
        console.error('❌ Notification Helper Error:', error.message);
        return null; 
    }
}

/**
 * 2. Thông báo cho Admin (Gửi cho tất cả User có RoleID = 1)
 */
async function notifyAdmin(notificationData) {
    try {
        const [admins] = await pool.query('SELECT UserID FROM Users WHERE RoleID = 1');
        for (const admin of admins) {
            await sendSystemNotification({ ...notificationData, userId: admin.UserID });
        }
    } catch (e) { console.error('Notify Admin Error:', e); }
}

/**
 * 3. Workflow: Đặt lịch mới (Booking Created)
 */
async function notifyBookingCreated({ userId, customerName, appointmentId, mechanicId }) {
    // Cho Khách
    await sendSystemNotification({
        userId,
        title: '📝 Đặt lịch thành công',
        message: `Yêu cầu #${appointmentId} đã được gửi. Chờ admin xác nhận nhé!`,
        type: 'booking',
        relatedId: appointmentId
    });

    // Cho Admin
    await notifyAdmin({
        title: '🔔 Có lịch hẹn mới',
        message: `Khách ${customerName} vừa đặt lịch mới #${appointmentId}`,
        type: 'booking',
        relatedId: appointmentId
    });

    // Cho Thợ (nếu được phân công ngay)
    if (mechanicId) {
        await sendSystemNotification({
            userId: mechanicId,
            title: '🔧 Công việc mới',
            message: `Bạn được phân công cho lịch hẹn #${appointmentId}`,
            type: 'booking',
            relatedId: appointmentId
        });
    }
}

/**
 * 4. Workflow: Thanh toán (Payment)
 */
async function notifyPaymentProofUploaded({ userId, customerName, appointmentId, amount }) {
    // Cho Admin duyệt
    await notifyAdmin({
        title: '💰 Chứng từ mới',
        message: `Khách ${customerName} đã gửi chứng từ cho đơn #${appointmentId}`,
        type: 'payment',
        relatedId: appointmentId
    });
}

async function notifyPaymentApproved({ userId, appointmentId, amount }) {
    await sendSystemNotification({
        userId,
        title: '✅ Thanh toán thành công',
        message: `Thanh toán cho đơn #${appointmentId} đã được duyệt. Cảm ơn bạn!`,
        type: 'payment',
        relatedId: appointmentId,
        iconType: 'success'
    });
}

// ... Bạn có thể thêm notifyServiceInProgress, notifyBookingRejected tương tự

module.exports = {
    sendSystemNotification,
    notifyAdmin,
    notifyBookingCreated,
    notifyPaymentProofUploaded,
    notifyPaymentApproved
};