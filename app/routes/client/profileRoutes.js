// File: app/routes/client/profileRoutes.js
const express = require('express');
const router = express.Router();

// Nhúng Controller
const profileController = require('../../controllers/client/profileController');

// Nhúng Middleware xác thực
const { authenticateToken } = require('../auth/authRoutes');

// =====================================
// ROUTES QUẢN LÝ HỒ SƠ
// =====================================
router.get('/profile', authenticateToken, profileController.getProfile);
router.put('/profile', authenticateToken, profileController.updateProfile);
router.get('/stats', authenticateToken, profileController.getMechanicStats);
router.post('/change-password', authenticateToken, profileController.changePassword);

// (Route upload avatar đang được ẩn trong file cũ, nếu bạn cần bật lại thì dùng dòng này)
// router.post('/profile/upload-avatar', authenticateToken, profileController.uploadAvatar.single('avatar'), ...);

// =====================================
// ROUTES QUẢN LÝ XE (TRONG HỒ SƠ CÁ NHÂN)
// =====================================
router.get('/vehicles/user', authenticateToken, profileController.getUserVehicles);
router.get('/vehicles/:id', authenticateToken, profileController.getVehicleById);
router.post('/vehicles', authenticateToken, profileController.createVehicle);
router.put('/vehicles/:id', authenticateToken, profileController.updateVehicle);
router.delete('/vehicles/:id', authenticateToken, profileController.deleteVehicle);

module.exports = router;