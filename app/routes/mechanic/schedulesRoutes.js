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
router.get('/all', checkMechanicAccess, (req, res) => {
    if (req.query.startDate && req.query.endDate) {
        return scheduleController.getSchedulesByRange(req, res);
    }
    return scheduleController.getAllSchedules(req, res);
});
router.get('/available-slots', scheduleController.getAvailableSlots);
router.get('/count-by-date', checkMechanicAccess, scheduleController.getMechanicCountByDate);
router.get('/check-can-edit/:id', checkMechanicAccess, scheduleController.getCanEditStatus);
router.get('/mechanics/list', checkMechanicAccess, scheduleController.getMechanicsList);
router.get('/by-date-range/:startDate/:endDate', checkMechanicAccess, scheduleController.getSchedulesByRange);
router.get('/', checkMechanicAccess, (req, res) => {
    if (req.query.startDate && req.query.endDate) {
        return scheduleController.getSchedulesByRange(req, res);
    }
    return scheduleController.getAllSchedules(req, res);
});
router.post('/check-overlap', checkMechanicAccess, scheduleController.checkOverlap);
router.post('/:id/request-edit', checkMechanicAccess, scheduleController.requestEdit);
router.post('/', checkMechanicAccess, scheduleController.createSchedule);
router.put('/:id', checkMechanicAccess, scheduleController.updateSchedule);
router.delete('/:id', checkAdminAccess, scheduleController.deleteSchedule);

module.exports = router;
