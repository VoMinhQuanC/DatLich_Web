// File: app/routes/mechanic/mechanicsRoutes.js
const express = require('express');
const router = express.Router();
const mechanicController = require('../../controllers/mechanic/mechanicController');
const { authenticateToken } = require('../auth/authRoutes');

// Middleware check quyền
const checkMechanicAccess = (req, res, next) => {
    if (req.user.role !== 3 && req.user.role !== 1) { // Thợ hoặc Admin
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

// Dashboard & Thông báo
router.get('/dashboard/stats', authenticateToken, checkMechanicAccess, mechanicController.getDashboardStats);
router.get('/appointments/upcoming', authenticateToken, checkMechanicAccess, mechanicController.getUpcomingAppointments);
router.get('/notifications', authenticateToken, checkMechanicAccess, mechanicController.getNotifications);
router.put('/notifications/:id/read', authenticateToken, checkMechanicAccess, mechanicController.markNotificationRead);

// Lịch nhóm (Calendar)
router.get('/schedules/team/by-date-range/:startDate/:endDate', authenticateToken, checkMechanicAccess, mechanicController.getTeamSchedules);

// Thao tác với lịch hẹn
router.put('/appointments/:id/confirm', authenticateToken, checkMechanicAccess, mechanicController.confirmAppointment);
router.put('/appointments/:id/complete', authenticateToken, checkMechanicAccess, mechanicController.completeAppointment);

// Admin Quản lý đơn nghỉ
router.get('/leave-requests/stats', authenticateToken, checkAdminAccess, mechanicController.getLeaveRequestStats);

module.exports = router;
