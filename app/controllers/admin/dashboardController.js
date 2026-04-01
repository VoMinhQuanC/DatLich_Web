// File: app/controllers/admin/dashboardController.js
const { pool } = require('../../../config/db');

// 1. Lấy thống kê tổng quan (Summary)
const getSummary = async (req, res) => {
    try {
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));
        
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
        
        // Lịch hẹn hôm nay
        const [todayAppointments] = await pool.query(`
            SELECT COUNT(*) as count FROM Appointments
            WHERE AppointmentDate BETWEEN ? AND ? AND IsDeleted = 0
        `, [startOfDay, endOfDay]);
        
        // Doanh thu tháng này
        const [monthlyRevenue] = await pool.query(`
            SELECT SUM(Amount) as total FROM Payments
            WHERE PaymentDate BETWEEN ? AND ? AND (Status = 'Completed' OR Status = 'Hoàn thành')
        `, [startOfMonth, endOfMonth]);
        
        // Tổng số khách hàng
        const [totalCustomers] = await pool.query(`
            SELECT COUNT(*) as count FROM Users WHERE RoleID = 2 AND Status = 1
        `);
        
        // Lịch hẹn chờ xử lý
        const [pendingAppointments] = await pool.query(`
            SELECT COUNT(*) as count FROM Appointments WHERE Status = 'Pending' AND IsDeleted = 0
        `);
        
        res.json({
            success: true,
            data: {
                todayAppointments: todayAppointments[0].count || 0,
                monthlyRevenue: monthlyRevenue[0].total || 0,
                totalCustomers: totalCustomers[0].count || 0,
                pendingAppointments: pendingAppointments[0].count || 0
            }
        });
    } catch (error) {
        console.error('Dashboard Summary Error:', error);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    }
};

// 2. Lấy danh sách lịch hẹn gần đây
const getRecentBookings = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const [bookings] = await pool.query(`
            SELECT 
                a.AppointmentID, a.AppointmentDate, a.Status,
                u.FullName as CustomerName, u.PhoneNumber,
                COALESCE(
                    (SELECT GROUP_CONCAT(s.ServiceName SEPARATOR ', ')
                     FROM AppointmentServices aps JOIN Services s ON aps.ServiceID = s.ServiceID
                     WHERE aps.AppointmentID = a.AppointmentID), 'N/A'
                ) as Services
            FROM Appointments a LEFT JOIN Users u ON a.UserID = u.UserID
            WHERE a.IsDeleted = 0 AND a.UserID IS NOT NULL
            ORDER BY a.AppointmentID DESC LIMIT ?
        `, [limit]);
        
        res.json({ success: true, bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

// 3. Lấy thống kê chi tiết (Biểu đồ)
const getDetailedStats = async (req, res) => {
    try {
        // Thống kê theo trạng thái
        const [statusStats] = await pool.query('SELECT Status, COUNT(*) as count FROM Appointments WHERE IsDeleted = 0 GROUP BY Status');
        
        // Dịch vụ phổ biến
        const [popularServices] = await pool.query(`
            SELECT s.ServiceName, COUNT(aps.ServiceID) as count, SUM(s.Price * aps.Quantity) as revenue
            FROM AppointmentServices aps
            JOIN Services s ON aps.ServiceID = s.ServiceID
            JOIN Appointments a ON aps.AppointmentID = a.AppointmentID
            WHERE a.Status = 'Completed' OR a.Status = 'Hoàn thành'
            GROUP BY s.ServiceID ORDER BY count DESC LIMIT 5
        `);
        
        res.json({ success: true, data: { statusStats, popularServices } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

module.exports = {
    getSummary,
    getRecentBookings,
    getDetailedStats
};