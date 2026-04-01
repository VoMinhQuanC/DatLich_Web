// File: app/routes/core/notificationRoutes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../../controllers/core/notificationController');
const { authenticateToken } = require('../auth/authRoutes');

// Tất cả các route này đều yêu cầu đăng nhập
router.use(authenticateToken);

router.get('/', notificationController.getNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.put('/read-all', notificationController.markAllAsRead);
router.put('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);

// API gửi thông báo (Admin mới có quyền - Check trong controller)
router.post('/send', notificationController.sendNotification);

module.exports = router;