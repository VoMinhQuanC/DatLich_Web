// File: app/controllers/admin/revenueController.js
const { pool } = require('../../../config/db');

// 1. Lấy thông tin tổng quan doanh thu (Summary)
const getRevenueSummary = async (req, res) => {
    try {
        const [appointmentsResult] = await pool.query('SELECT COUNT(*) as totalAppointments FROM Appointments WHERE Status = "Completed"');
        const [revenueResult] = await pool.query('SELECT SUM(Amount) as totalRevenue FROM Payments WHERE Status = "Completed" OR Status = "Hoàn thành"');
        const [customersResult] = await pool.query('SELECT COUNT(DISTINCT UserID) as totalCustomers FROM Appointments');
        const [popularServiceResult] = await pool.query(`
            SELECT s.ServiceName, COUNT(a.ServiceID) as serviceCount
            FROM AppointmentServices a
            JOIN Services s ON a.ServiceID = s.ServiceID
            JOIN Appointments ap ON a.AppointmentID = ap.AppointmentID
            WHERE ap.Status = "Completed" OR ap.Status = "Hoàn thành"
            GROUP BY a.ServiceID ORDER BY serviceCount DESC LIMIT 1
        `);

        res.json({
            success: true,
            summary: {
                totalAppointments: appointmentsResult[0].totalAppointments || 0,
                totalRevenue: revenueResult[0].totalRevenue || 0,
                totalCustomers: customersResult[0].totalCustomers || 0,
                popularService: popularServiceResult[0]?.ServiceName || 'Không có dữ liệu'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    }
};

// 2. Cập nhật trạng thái thanh toán đã lên lịch
const updateScheduledPayments = async (req, res) => {
    try {
        const [scheduledPayments] = await pool.query('SELECT PaymentID FROM PaymentScheduledUpdates WHERE ScheduledTime <= NOW() AND IsProcessed = 0');
        let updatedCount = 0;

        if (scheduledPayments.length > 0) {
            const [updateResult] = await pool.query(`
                UPDATE Payments p JOIN PaymentScheduledUpdates psu ON p.PaymentID = psu.PaymentID
                SET p.Status = 'Completed' WHERE psu.ScheduledTime <= NOW() AND psu.IsProcessed = 0 AND p.Status = 'Pending'
            `);
            updatedCount = updateResult.affectedRows;
            await pool.query('UPDATE PaymentScheduledUpdates SET IsProcessed = 1 WHERE ScheduledTime <= NOW() AND IsProcessed = 0');
        }
        res.json({ success: true, updated: updatedCount, message: `Đã cập nhật ${updatedCount} thanh toán` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 3. Lấy dữ liệu doanh thu chi tiết (có filter ngày)
const getRevenueDetails = async (req, res) => {
    try {
        const { startDate, endDate, includeAll } = req.query;
        if (!startDate || !endDate) return res.status(400).json({ success: false, message: 'Thiếu thông tin ngày' });

        const startDateTime = `${startDate} 00:00:00`;
        const endDateTime = `${endDate} 23:59:59`;

        let query = `
            SELECT p.*, COALESCE(u.FullName, p.CustomerName, 'N/A') as CustomerName,
            COALESCE(m.FullName, p.MechanicName, 'N/A') as MechanicName,
            COALESCE((SELECT GROUP_CONCAT(s.ServiceName) FROM AppointmentServices aps JOIN Services s ON aps.ServiceID = s.ServiceID WHERE aps.AppointmentID = p.AppointmentID), p.Services, 'N/A') as Services
            FROM Payments p LEFT JOIN Appointments a ON p.AppointmentID = a.AppointmentID
            LEFT JOIN Users u ON a.UserID = u.UserID LEFT JOIN Users m ON a.MechanicID = m.UserID
            WHERE p.PaymentDate BETWEEN ? AND ? AND (p.Status = 'Completed' OR p.Status = 'Hoàn thành'
        `;
        query += includeAll === 'true' ? " OR p.Status = 'Pending' OR p.Status = 'Chờ thanh toán')" : ")";
        query += " ORDER BY p.PaymentDate DESC";

        const [payments] = await pool.query(query, [startDateTime, endDateTime]);
        res.json({ success: true, revenueData: payments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// 4. Doanh thu theo tháng
const getMonthlyRevenue = async (req, res) => {
    try {
        const year = req.query.year || new Date().getFullYear();
        const [monthlyData] = await pool.query('SELECT MONTH(PaymentDate) as month, SUM(Amount) as revenue FROM Payments WHERE (Status = "Completed" OR Status = "Hoàn thành") AND YEAR(PaymentDate) = ? GROUP BY MONTH(PaymentDate) ORDER BY month', [year]);
        
        const revenueByMonth = Array(12).fill(0);
        monthlyData.forEach(item => { revenueByMonth[item.month - 1] = parseFloat(item.revenue || 0); });
        
        res.json({ success: true, year, data: revenueByMonth });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getRevenueSummary,
    updateScheduledPayments,
    getRevenueDetails,
    getMonthlyRevenue
};