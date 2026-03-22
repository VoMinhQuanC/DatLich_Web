// File: app/routes/mechanic/schedulesRoutes.js
const express = require('express');
const router = express.Router();
const scheduleController = require('../../controllers/mechanic/scheduleController');
const { authenticateToken } = require('../auth/authRoutes');

// Middleware xác thực cho toàn bộ route này
router.use(authenticateToken);

// Định tuyến
router.get('/available-slots', scheduleController.getAvailableSlots);
router.get('/mechanics/list', scheduleController.getMechanicsList);
router.get('/by-date-range/:startDate/:endDate', scheduleController.getSchedulesByRange);
router.get('/', scheduleController.getAllSchedules);
router.post('/', scheduleController.createSchedule);
router.delete('/:id', scheduleController.deleteSchedule);

module.exports = router;