// File: app/models/Booking.js
const { pool } = require('../../config/db');
class Booking {
    // 1. Lấy danh sách tất cả lịch hẹn (Dùng cho Admin)
    static async getAllAppointments(filters = {}) {
        try {
            let query = `
                SELECT a.AppointmentID, a.UserID, a.VehicleID, a.AppointmentDate, a.Status, a.Notes, a.MechanicID, a.ServiceDuration, a.EstimatedEndTime,
                    u.FullName, u.Email, u.PhoneNumber, v.LicensePlate, v.Brand, v.Model, v.Year, m.FullName as MechanicName,
                    GROUP_CONCAT(s.ServiceName SEPARATOR ', ') as Services
                FROM Appointments a
                LEFT JOIN Users u ON a.UserID = u.UserID
                LEFT JOIN Vehicles v ON a.VehicleID = v.VehicleID
                LEFT JOIN Users m ON a.MechanicID = m.UserID
                LEFT JOIN AppointmentServices aps ON a.AppointmentID = aps.AppointmentID
                LEFT JOIN Services s ON aps.ServiceID = s.ServiceID
                WHERE a.IsDeleted = 0
            `;
            const params = [];
            if (filters.dateFrom) { query += ' AND DATE(a.AppointmentDate) >= ?'; params.push(filters.dateFrom); }
            if (filters.dateTo) { query += ' AND DATE(a.AppointmentDate) <= ?'; params.push(filters.dateTo); }
            if (filters.status) { query += ' AND a.Status = ?'; params.push(filters.status); }
            
            query += ' GROUP BY a.AppointmentID ORDER BY a.AppointmentDate DESC';
            const [rows] = await pool.query(query, params);
            return rows;
        } catch (error) { throw error; }
    }

    // 2. Lấy lịch hẹn theo UserID (Dùng cho Khách hàng xem lịch sử)
    static async getAppointmentsByUserId(userId) {
        try {
            const [rows] = await pool.query(`
                SELECT a.*, v.LicensePlate, v.Brand, v.Model,
                    (SELECT GROUP_CONCAT(s.ServiceName SEPARATOR ', ') 
                     FROM AppointmentServices ap JOIN Services s ON ap.ServiceID = s.ServiceID 
                     WHERE ap.AppointmentID = a.AppointmentID) AS Services
                FROM Appointments a LEFT JOIN Vehicles v ON a.VehicleID = v.VehicleID
                WHERE a.UserID = ? AND a.IsDeleted = 0 ORDER BY a.AppointmentDate DESC
            `, [userId]);
            return rows;
        } catch (err) { throw err; }
    }

    // 3. Lấy chi tiết 1 lịch hẹn
    static async getAppointmentById(appointmentId) {
        try {
            const [rows] = await pool.query(`
                SELECT a.*, u.FullName, u.PhoneNumber, u.Email, v.LicensePlate, v.Brand, v.Model
                FROM Appointments a
                LEFT JOIN Users u ON a.UserID = u.UserID
                LEFT JOIN Vehicles v ON a.VehicleID = v.VehicleID
                WHERE a.AppointmentID = ?
            `, [appointmentId]);
            if (rows.length === 0) return null;

            const [services] = await pool.query(`
                SELECT as2.*, s.ServiceName, s.Price, s.EstimatedTime 
                FROM AppointmentServices as2 JOIN Services s ON as2.ServiceID = s.ServiceID
                WHERE as2.AppointmentID = ?
            `, [appointmentId]);
            rows[0].services = services;
            return rows[0];
        } catch (err) { throw err; }
    }

    // 4. Tạo lịch hẹn mới (Kèm tạo xe nếu chưa có)
    static async createAppointment(bookingData) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            let vehicleId = bookingData.vehicleId;

            if (!vehicleId && bookingData.licensePlate) {
                const [existing] = await connection.query('SELECT VehicleID FROM Vehicles WHERE LicensePlate = ?', [bookingData.licensePlate]);
                if (existing.length > 0) {
                    vehicleId = existing[0].VehicleID;
                } else {
                    const [insertV] = await connection.query(
                        'INSERT INTO Vehicles (UserID, LicensePlate, Brand, Model, Year) VALUES (?, ?, ?, ?, ?)',
                        [bookingData.userId, bookingData.licensePlate, bookingData.brand, bookingData.model, bookingData.year || 2024]
                    );
                    vehicleId = insertV.insertId;
                }
            }

            const [result] = await connection.query(
                'INSERT INTO Appointments (UserID, VehicleID, MechanicID, AppointmentDate, Status, Notes, EstimatedEndTime, ServiceDuration, PaymentMethod) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [bookingData.userId, vehicleId, bookingData.mechanicId || null, bookingData.appointmentDate, 'Pending', bookingData.notes, bookingData.endTime, bookingData.totalServiceTime, bookingData.paymentMethod]
            );

            const appointmentId = result.insertId;
            if (bookingData.services?.length > 0) {
                for (const sId of bookingData.services) {
                    await connection.query('INSERT INTO AppointmentServices (AppointmentID, ServiceID, Quantity) VALUES (?, ?, ?)', [appointmentId, sId, 1]);
                }
            }

            await connection.commit();
            return { appointmentId, vehicleId };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally { connection.release(); }
    }

    // 5. Cập nhật trạng thái/thông tin lịch hẹn
    static async updateAppointment(appointmentId, data) {
        try {
            const [result] = await pool.query(
                'UPDATE Appointments SET Status = ?, Notes = ?, MechanicID = ? WHERE AppointmentID = ?',
                [data.status, data.notes, data.mechanicId, appointmentId]
            );
            return result.affectedRows > 0;
        } catch (err) { throw err; }
    }

    // 5.1. Hủy lịch hẹn
    static async cancelAppointment(appointmentId) {
        try {
            const [result] = await pool.query(
                'UPDATE Appointments SET Status = ? WHERE AppointmentID = ?',
                ['Canceled', appointmentId]
            );
            return result.affectedRows > 0;
        } catch (err) { throw err; }
    }

    // 6. Lấy danh sách thợ máy
    static async getMechanics() {
        const [rows] = await pool.query('SELECT UserID, FullName, Email, PhoneNumber FROM Users WHERE RoleID = 3 AND Status = 1');
        return rows;
    }

    // 7. Lấy danh sách xe của User
    static async getUserVehicles(userId) {
        const [rows] = await pool.query('SELECT * FROM Vehicles WHERE UserID = ? ORDER BY CreatedAt DESC', [userId]);
        return rows;
    }

    // 8. Thống kê dashboard (Admin)
    static async getDashboardStats() {
        try {
            const [[total]] = await pool.query('SELECT COUNT(*) as count FROM Appointments WHERE IsDeleted = 0');
            const [[pending]] = await pool.query("SELECT COUNT(*) as count FROM Appointments WHERE Status = 'Pending' AND IsDeleted = 0");
            const [[confirmed]] = await pool.query("SELECT COUNT(*) as count FROM Appointments WHERE Status = 'Confirmed' AND IsDeleted = 0");
            const [[completed]] = await pool.query("SELECT COUNT(*) as count FROM Appointments WHERE Status = 'Completed' AND IsDeleted = 0");
            return {
                total: total.count,
                pending: pending.count,
                confirmed: confirmed.count,
                completed: completed.count
            };
        } catch (err) { throw err; }
    }

    // 9. Lấy lịch hẹn gần đây (Admin Dashboard)
    static async getRecentBookings(limit = 5) {
        try {
            const [rows] = await pool.query(`
                SELECT a.AppointmentID, a.AppointmentDate, a.Status,
                    u.FullName as CustomerName,
                    GROUP_CONCAT(s.ServiceName SEPARATOR ', ') as Services
                FROM Appointments a
                LEFT JOIN Users u ON a.UserID = u.UserID
                LEFT JOIN AppointmentServices aps ON a.AppointmentID = aps.AppointmentID
                LEFT JOIN Services s ON aps.ServiceID = s.ServiceID
                WHERE a.IsDeleted = 0
                GROUP BY a.AppointmentID
                ORDER BY a.AppointmentDate DESC
                LIMIT ?
            `, [limit]);
            return rows;
        } catch (err) { throw err; }
    }
}

module.exports = Booking;
