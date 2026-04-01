// File: app/routes/mechanic/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const attendanceController = require('../../controllers/mechanic/attendanceController');
const { authenticateToken } = require('../auth/authRoutes');

// QR Code API
router.get('/qr/image', attendanceController.generateQRCode);

// Mechanic APIs
router.post('/check-in', authenticateToken, attendanceController.checkIn);
router.post('/check-out', authenticateToken, attendanceController.checkOut);
router.get('/history', authenticateToken, attendanceController.getAttendanceHistory);

// Admin APIs
router.get('/admin/today', authenticateToken, attendanceController.adminGetAttendance);

module.exports = router;