// File: app/routes/mechanic/schedulesRoutes.js
const express = require('express');
const router = express.Router();
const scheduleController = require('../../controllers/mechanic/scheduleController');
const { authenticateToken } = require('../auth/authRoutes');

// Middleware xác thực cho toàn bộ route này
router.use(authenticateToken);

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

// Định tuyến
router.get('/available-slots', scheduleController.getAvailableSlots);
router.get('/mechanics/list', checkMechanicAccess, scheduleController.getMechanicsList);
router.get('/by-date-range/:startDate/:endDate', checkMechanicAccess, scheduleController.getSchedulesByRange);
router.get('/', checkMechanicAccess, scheduleController.getAllSchedules);
router.post('/', checkAdminAccess, scheduleController.createSchedule);
router.delete('/:id', checkAdminAccess, scheduleController.deleteSchedule);

module.exports = router;
