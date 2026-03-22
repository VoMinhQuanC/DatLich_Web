// File: app/routes/admin/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/admin/dashboardController');
const { authenticateToken } = require('../auth/authRoutes');

// Middleware kiểm tra quyền admin
const checkAdminAccess = (req, res, next) => {
    if (req.user && req.user.role === 1) {
        next();
    } else {
        return res.status(403).json({ success: false, message: 'Yêu cầu quyền admin.' });
    }
};

// Áp dụng bảo mật cho toàn bộ routes trong dashboard
router.use(authenticateToken);
router.use(checkAdminAccess);

// Định tuyến API
router.get('/summary', dashboardController.getSummary);
router.get('/recent-booking', dashboardController.getRecentBookings);
router.get('/stats', dashboardController.getDetailedStats);

module.exports = router;