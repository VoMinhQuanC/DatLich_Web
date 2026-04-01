// File: app/routes/client/userRoutes.js
const express = require('express');
const router = express.Router();

// Nhúng Controller
const userController = require('../../controllers/client/userController');

// Nhúng Middleware xác thực từ authRoutes
const { authenticateToken } = require('../auth/authRoutes');

// Định tuyến API Quản lý Người Dùng
router.get('/stats', authenticateToken, userController.checkAdminAccess, userController.getUserStats);
router.get('/', authenticateToken, userController.checkAdminAccess, userController.getAllUsers);
router.get('/:id', authenticateToken, userController.getUserById);
router.post('/', authenticateToken, userController.checkAdminAccess, userController.createUser);
router.put('/:id', authenticateToken, userController.checkAdminAccess, userController.updateUser);
router.post('/change-password', authenticateToken, userController.changeOwnPassword);
router.post('/:id/change-password', authenticateToken, userController.checkAdminAccess, userController.changePassword);
router.delete('/:id', authenticateToken, userController.checkAdminAccess, userController.deleteUser);

module.exports = router;