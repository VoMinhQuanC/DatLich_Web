// File: app/routes/admin/revenueRoutes.js
const express = require('express');
const router = express.Router();
const revenueController = require('../../controllers/admin/revenueController');
const { authenticateToken } = require('../auth/authRoutes');

// Middleware kiểm tra quyền admin
const checkAdminAccess = (req, res, next) => {
    if (req.user && req.user.role === 1) {
        next();
    } else {
        return res.status(403).json({ success: false, message: 'Yêu cầu quyền admin.' });
    }
};

// Áp dụng bảo mật cho toàn bộ Route doanh thu
router.use(authenticateToken);
router.use(checkAdminAccess);

// Định tuyến API
router.get('/summary', revenueController.getRevenueSummary);
router.get('/monthly', revenueController.getMonthlyRevenue);
router.get('/', revenueController.getRevenueDetails);
router.post('/update-payments', revenueController.updateScheduledPayments);

module.exports = router;