// File: app/routes/core/fcmRoutes.js
const express = require('express');
const router = express.Router();
const fcmController = require('../../controllers/core/fcmController');
// Lưu ý: require từ authRoutes bây giờ phải lấy đúng thuộc tính .authenticateToken
const { authenticateToken } = require('../auth/authRoutes'); 

router.post('/fcm-token', authenticateToken, fcmController.saveToken);
router.post('/test-push', authenticateToken, fcmController.testPush);
router.get('/status', authenticateToken, fcmController.getStatus);

// ✅ Export router làm default
module.exports = router;
// ✅ Các helper khác nếu cần
module.exports.sendPushNotification = fcmController.sendPushNotification;