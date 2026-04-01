// File: app/utils/notificationHelper.js
const { pool } = require('../../config/db');
const fcmController = require('../controllers/core/fcmController');

// --- HÀM CORE DÙNG CHUNG ---
async function sendSystemNotification(data) {
    try {
        const { userId, title, message, type, priority, iconType, relatedId, relatedType } = data;
        
        // 1. Lưu vào MySQL (Lịch sử)
        const [result] = await pool.query(`
            INSERT INTO Notifications 
            (UserID, Title, Message, Type, Priority, IconType, RelatedID, RelatedType, CreatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [userId, title, message, type || 'system', priority || 'normal', iconType || 'info', relatedId, relatedType]);

        // 2. Gửi Push (Ting ting)
        await fcmController.sendPushNotification(userId, {
            title, body: message, type, referenceId: relatedId
        });

        return result.insertId;
    } catch (error) {
        console.error('❌ Notification Error:', error.message);
        return null;
    }
}

// --- WORKFLOW DÀNH RIÊNG CHO MECHANIC ---

/**
 * 1. Thông báo phân công lịch hẹn mới
 */
async function notifyMechanicNewAppointment(mechanicId, appointmentId, details) {
    return await sendSystemNotification({
        userId: mechanicId,
        title: '🔧 Lịch hẹn mới được phân công',
        message: `Bạn được phân công đơn #${appointmentId}. Khách hàng: ${details.customerName || 'N/A'}`,
        type: 'appointment_assigned',
        relatedId: appointmentId,
        relatedType: 'appointment',
        priority: 'high',
        iconType: 'info'
    });
}

/**
 * 2. Thông báo duyệt/từ chối đơn xin nghỉ của thợ
 */
async function notifyMechanicLeaveResponse(mechanicId, leaveDetails) {
    const isApproved = leaveDetails.status.includes('Approved');
    return await sendSystemNotification({
        userId: mechanicId,
        title: isApproved ? '✅ Đơn nghỉ đã được duyệt' : '❌ Đơn nghỉ bị từ chối',
        message: isApproved 
            ? `Đơn nghỉ ngày ${leaveDetails.workDate} của bạn đã được phê duyệt.`
            : `Đơn nghỉ ngày ${leaveDetails.workDate} bị từ chối. Lý do: ${leaveDetails.adminNotes || 'N/A'}`,
        type: isApproved ? 'leave_approved' : 'leave_rejected',
        relatedId: leaveDetails.scheduleId,
        relatedType: 'schedule',
        iconType: isApproved ? 'success' : 'error'
    });
}

/**
 * 3. Thông báo nhắc nhở công việc (Cron Job gọi)
 */
async function sendMechanicWorkReminder(mechanicId, appointmentId, time) {
    return await sendSystemNotification({
        userId: mechanicId,
        title: '⏰ Nhắc nhở công việc',
        message: `Bạn có lịch hẹn #${appointmentId} vào lúc ${time}. Chuẩn bị nhé!`,
        type: 'work_reminder',
        relatedId: appointmentId,
        relatedType: 'appointment'
    });
}

// Giữ lại các hàm notifyBookingCreated, notifyPaymentApproved... như file cũ

module.exports = {
    sendSystemNotification,
    notifyMechanicNewAppointment,
    notifyMechanicLeaveResponse,
    sendMechanicWorkReminder,
    // ... export các hàm khác
};