// File: app/controllers/core/notificationController.js
const { pool } = require('../../../config/db');

// Helper để lấy userId từ request (Hỗ trợ nhiều kiểu đặt tên field trong JWT)
const getUserIdFromReq = (req) => req.user?.userId || req.user?.id || req.user?.UserID;

// 1. Lấy danh sách thông báo của user
const getNotifications = async (req, res) => {
    try {
        const userId = getUserIdFromReq(req);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const unreadOnly = req.query.unread === 'true';

        if (!userId) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });

        let query = `
            SELECT n.*, u.FullName as SenderName
            FROM Notifications n
            LEFT JOIN Users u ON n.SenderID = u.UserID
            WHERE (n.UserID = ? OR n.UserID IS NULL)
              AND n.IsDeleted = FALSE
              AND (n.ExpiresAt IS NULL OR n.ExpiresAt > NOW())
        `;
        const params = [userId];

        if (unreadOnly) query += ' AND n.IsRead = FALSE';
        query += ' ORDER BY n.CreatedAt DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [notifications] = await pool.query(query, params);

        // Lấy tổng số để làm phân trang
        const [countResult] = await pool.query(`
            SELECT COUNT(*) as total FROM Notifications
            WHERE (UserID = ? OR UserID IS NULL) AND IsDeleted = FALSE
              AND (ExpiresAt IS NULL OR ExpiresAt > NOW())
              ${unreadOnly ? ' AND IsRead = FALSE' : ''}
        `, [userId]);

        const total = countResult[0].total;

        res.json({
            success: true,
            data: notifications,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi khi lấy thông báo', error: error.message });
    }
};

// 2. Đếm số thông báo chưa đọc
const getUnreadCount = async (req, res) => {
    try {
        const userId = getUserIdFromReq(req);
        if (!userId) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });

        const [result] = await pool.query(`
            SELECT COUNT(*) as unreadCount FROM Notifications
            WHERE (UserID = ? OR UserID IS NULL) AND IsRead = FALSE
              AND IsDeleted = FALSE AND (ExpiresAt IS NULL OR ExpiresAt > NOW())
        `, [userId]);

        res.json({ success: true, unreadCount: result[0].unreadCount });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
};

// 3. Đánh dấu đã đọc (1 thông báo)
const markAsRead = async (req, res) => {
    try {
        const userId = getUserIdFromReq(req);
        const notificationId = req.params.id;

        await pool.query(`
            UPDATE Notifications SET IsRead = TRUE, ReadAt = NOW()
            WHERE NotificationID = ? AND (UserID = ? OR UserID IS NULL) AND IsDeleted = FALSE
        `, [notificationId, userId]);

        res.json({ success: true, message: 'Đã đánh dấu đã đọc' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi cập nhật', error: error.message });
    }
};

// 4. Đánh dấu tất cả đã đọc
const markAllAsRead = async (req, res) => {
    try {
        const userId = getUserIdFromReq(req);
        await pool.query(`
            UPDATE Notifications SET IsRead = TRUE, ReadAt = NOW()
            WHERE (UserID = ? OR UserID IS NULL) AND IsRead = FALSE AND IsDeleted = FALSE
        `, [userId]);

        res.json({ success: true, message: 'Đã đánh dấu tất cả đã đọc' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi cập nhật', error: error.message });
    }
};

// 5. Xóa thông báo (Soft delete)
const deleteNotification = async (req, res) => {
    try {
        const userId = getUserIdFromReq(req);
        await pool.query(`
            UPDATE Notifications SET IsDeleted = TRUE, DeletedAt = NOW()
            WHERE NotificationID = ? AND (UserID = ? OR UserID IS NULL)
        `, [req.params.id, userId]);

        res.json({ success: true, message: 'Đã xóa thông báo' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi khi xóa', error: error.message });
    }
};

// 6. Gửi thông báo (Admin Only)
const sendNotification = async (req, res) => {
    try {
        const adminId = getUserIdFromReq(req);
        const adminRoleId = req.user?.role || req.user?.roleId || req.user?.RoleID;

        if (adminRoleId !== 1) return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền này' });

        const { userId, title, message, type = 'system', priority = 'normal', iconType = 'info', actionUrl, relatedId, relatedType, expiresAt } = req.body;

        const [result] = await pool.query(`
            INSERT INTO Notifications (UserID, SenderID, Title, Message, Type, Priority, IconType, ActionUrl, RelatedID, RelatedType, ExpiresAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [userId, adminId, title, message, type, priority, iconType, actionUrl, relatedId, relatedType, expiresAt]);

        // Real-time bắn qua Socket.io
        const io = req.app.get('io');
        if (io) {
            const payload = { NotificationID: result.insertId, Title: title, Message: message, Type: type, CreatedAt: new Date(), IsRead: false };
            if (userId) io.to(`user_${userId}`).emit('new_notification', payload);
            else io.emit('new_notification', payload);
        }

        res.json({ success: true, message: 'Đã gửi thông báo', notificationId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi gửi thông báo', error: error.message });
    }
};

module.exports = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    sendNotification
};