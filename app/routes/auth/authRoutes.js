// File: app/routes/auth/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../../controllers/auth/authController');

// Phân luồng cho Lễ tân (Routes)
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.get('/check-auth', authController.authenticateToken, authController.checkAuth);
router.get('/me', authController.authenticateToken, authController.getMe);

// ✅ CÁCH SỬA: Export router làm giá trị chính
module.exports = router;

// ✅ CÁCH SỬA: Gán thêm hàm middleware vào chính cái router đó để các file khác vẫn lấy được
module.exports.authenticateToken = authController.authenticateToken;