// File: app/controllers/mechanic/mechanicController.js
const { pool } = require('../../../config/db');
const nodemailer = require('nodemailer');
const { getCurrentVietnamDate } = require('../../utils/timeUtils');

// Cấu hình nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-password'
    }
});

// --- DASHBOARD ---
const getDashboardStats = async (req, res) => {
    try {
        const mechanicId = req.user.userId;
        const today = getCurrentVietnamDate();
        
        const [todayAppointments] = await pool.query('SELECT COUNT(*) as count FROM Appointments WHERE MechanicID = ? AND DATE(AppointmentDate) = ? AND IsDeleted = 0', [mechanicId, today]);
        const [pendingAppointments] = await pool.query('SELECT COUNT(*) as count FROM Appointments WHERE MechanicID = ? AND Status IN ("Pending", "Confirmed") AND IsDeleted = 0', [mechanicId]);
        const [weeklyCompleted] = await pool.query(`SELECT COUNT(*) as count FROM Appointments WHERE MechanicID = ? AND Status = "Completed" AND IsDeleted = 0 AND YEARWEEK(AppointmentDate, 1) = YEARWEEK(CURDATE(), 1)`, [mechanicId]);
        const [averageRating] = await pool.query('SELECT AVG(Rating) as avgRating FROM MechanicReviews WHERE MechanicID = ?', [mechanicId]);

        res.json({
            success: true,
            stats: {
                todayAppointments: todayAppointments[0].count,
                pendingAppointments: pendingAppointments[0].count,
                weeklyCompleted: weeklyCompleted[0].count,
                averageRating: averageRating[0].avgRating ? parseFloat(averageRating[0].avgRating).toFixed(1) : 0
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const getUpcomingAppointments = async (req, res) => {
    try {
        const mechanicId = req.user.userId;
        const [appointments] = await pool.query(
            `SELECT a.*, u.FullName as CustomerName, u.PhoneNumber as CustomerPhone, v.LicensePlate, v.Brand, v.Model,
             (SELECT GROUP_CONCAT(s.ServiceName SEPARATOR ', ') FROM AppointmentServices ap JOIN Services s ON ap.ServiceID = s.ServiceID WHERE ap.AppointmentID = a.AppointmentID) AS Services
             FROM Appointments a LEFT JOIN Users u ON a.UserID = u.UserID LEFT JOIN Vehicles v ON a.VehicleID = v.VehicleID
             WHERE a.MechanicID = ? AND a.Status IN ('Pending', 'Confirmed') AND a.AppointmentDate >= CURDATE() AND a.IsDeleted = 0
             ORDER BY a.AppointmentDate ASC LIMIT 10`, [mechanicId]);
        res.json({ success: true, appointments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// --- NOTIFICATIONS ---
const getNotifications = async (req, res) => {
    try {
        const mechanicId = req.user.userId;
        const limit = parseInt(req.query.limit) || 10;
        const [notifications] = await pool.query('SELECT * FROM Notifications WHERE UserID = ? ORDER BY CreatedAt DESC LIMIT ?', [mechanicId, limit]);
        res.json({ success: true, notifications });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('UPDATE Notifications SET IsRead = 1 WHERE NotificationID = ? AND UserID = ?', [id, req.user.userId]);
        res.json({ success: true, message: 'Đã đánh dấu đã đọc' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// --- TEAM SCHEDULES ---
const getTeamSchedules = async (req, res) => {
    try {
        const { startDate, endDate } = req.params;
        const [schedules] = await pool.query(
            `SELECT ss.*, u.FullName as MechanicName, u.PhoneNumber as MechanicPhone
             FROM StaffSchedule ss JOIN Users u ON ss.MechanicID = u.UserID
             WHERE ss.WorkDate BETWEEN ? AND ? ORDER BY ss.WorkDate ASC, ss.StartTime ASC`, [startDate, endDate]);
        res.json({ success: true, schedules });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// --- APPOINTMENT ACTIONS ---
const updateAppointmentStatus = async (req, res, targetStatus) => {
    try {
        const appointmentId = req.params.id;
        const mechanicId = req.user.userId;
        const { notes } = req.body;

        const [appointments] = await pool.query('SELECT * FROM Appointments WHERE AppointmentID = ? AND MechanicID = ?', [appointmentId, mechanicId]);
        if (appointments.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' });

        let query = 'UPDATE Appointments SET Status = ?';
        const params = [targetStatus];
        if (notes) { query += ', Notes = ?'; params.push(notes); }
        query += ' WHERE AppointmentID = ?';
        params.push(appointmentId);

        await pool.query(query, params);
        res.json({ success: true, message: `Đã chuyển sang trạng thái ${targetStatus}` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const confirmAppointment = (req, res) => updateAppointmentStatus(req, res, 'Confirmed');
const completeAppointment = (req, res) => updateAppointmentStatus(req, res, 'Completed');

// --- LEAVE REQUESTS (ADMIN SIDE) ---
const getLeaveRequestStats = async (req, res) => {
    try {
        const [pendingL] = await pool.query("SELECT COUNT(*) as count FROM StaffSchedule WHERE Status = 'PendingLeave'");
        const [pendingE] = await pool.query("SELECT COUNT(*) as count FROM StaffSchedule WHERE Status = 'PendingEdit'");
        res.json({
            success: true,
            stats: { pending: pendingL[0].count + pendingE[0].count, pendingLeave: pendingL[0].count, pendingEdit: pendingE[0].count }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = {
    getDashboardStats,
    getUpcomingAppointments,
    getNotifications,
    markNotificationRead,
    getTeamSchedules,
    confirmAppointment,
    completeAppointment,
    getLeaveRequestStats
    // Bạn có thể thêm tiếp các hàm request-edit, reject... từ file gốc vào đây nhé
};
