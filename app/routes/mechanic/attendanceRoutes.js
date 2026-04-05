// File: app/routes/mechanic/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const attendanceController = require('../../controllers/mechanic/attendanceController');
const { authenticateToken } = require('../auth/authRoutes');

const checkMechanicAccess = (req, res, next) => {
    if (req.user.role !== 3 && req.user.role !== 1) {
        return res.status(403).json({ success: false, message: 'Yêu cầu quyền KTV' });
    }
    next();
};

const checkAdminAccess = (req, res, next) => {
    if (req.user.role !== 1) {
        return res.status(403).json({ success: false, message: 'Yêu cầu quyền Admin' });
    }
    next();
};

// QR Code API
router.get('/qr/image', authenticateToken, checkAdminAccess, attendanceController.generateQRCode);

// Mechanic APIs
router.post('/check-in', authenticateToken, checkMechanicAccess, attendanceController.checkIn);
router.post('/check-out', authenticateToken, checkMechanicAccess, attendanceController.checkOut);
router.get('/history', authenticateToken, checkMechanicAccess, attendanceController.getAttendanceHistory);

// Admin APIs
router.get('/admin/today', authenticateToken, checkAdminAccess, attendanceController.adminGetAttendance);

module.exports = router;
