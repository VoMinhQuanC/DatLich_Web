// File: app/models/StaffSchedule.js
const { pool } = require('../../config/db');

class StaffSchedule {
    // 1. Lấy tất cả lịch làm việc (kèm tên thợ)
    static async getAllSchedules() {
        try {
            const [rows] = await pool.query(`
                SELECT ss.*, u.FullName as MechanicName
                FROM StaffSchedule ss
                JOIN Users u ON ss.MechanicID = u.UserID
                ORDER BY ss.WorkDate DESC, ss.StartTime ASC
            `);
            return rows;
        } catch (err) { throw err; }
    }

    // 2. Lấy chi tiết 1 lịch theo ID
    static async getScheduleById(scheduleId) {
        try {
            const [rows] = await pool.query(`
                SELECT ss.*, u.FullName as MechanicName
                FROM StaffSchedule ss
                JOIN Users u ON ss.MechanicID = u.UserID
                WHERE ss.ScheduleID = ?
            `, [scheduleId]);
            return rows.length > 0 ? rows[0] : null;
        } catch (err) { throw err; }
    }

    // 3. Lấy lịch theo khoảng ngày (Range)
    static async getSchedulesByDateRange(startDate, endDate) {
        try {
            const [rows] = await pool.query(`
                SELECT ss.*, u.FullName as MechanicName, u.PhoneNumber as MechanicPhone
                FROM StaffSchedule ss
                JOIN Users u ON ss.MechanicID = u.UserID
                WHERE ss.WorkDate BETWEEN ? AND ?
                ORDER BY ss.WorkDate ASC, ss.StartTime ASC
            `, [startDate, endDate]);
            return rows;
        } catch (err) { throw err; }
    }

    // 4. Kiểm tra xem thợ có bị trùng lịch không (Conflict Check)
    static async checkConflict(mechanicId, workDate, startTime, endTime, excludeId = null) {
        try {
            let query = `
                SELECT ScheduleID FROM StaffSchedule 
                WHERE MechanicID = ? AND WorkDate = ? 
                AND Status NOT IN ('Rejected', 'RejectedLeave')
                AND ((StartTime < ? AND EndTime > ?) 
                    OR (StartTime >= ? AND StartTime < ?) 
                    OR (StartTime < ? AND EndTime >= ?))
            `;
            const params = [mechanicId, workDate, endTime, startTime, startTime, endTime, endTime, endTime];
            
            if (excludeId) {
                query += ' AND ScheduleID != ?';
                params.push(excludeId);
            }
            
            const [rows] = await pool.query(query, params);
            return rows.length > 0;
        } catch (err) { throw err; }
    }

    // 5. Thêm lịch làm việc mới
    static async addSchedule(data) {
        try {
            const { mechanicId, workDate, startTime, endTime, type, notes, status } = data;
            const [result] = await pool.query(
                `INSERT INTO StaffSchedule (MechanicID, WorkDate, StartTime, EndTime, Type, Notes, Status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [mechanicId, workDate, startTime, endTime, type || 'available', notes || '', status || 'Pending']
            );
            return result.insertId;
        } catch (err) { throw err; }
    }

    // 6. Cập nhật trạng thái lịch (Dùng cho Admin Duyệt/Từ chối)
    static async updateStatus(scheduleId, status, adminNotes = null) {
        try {
            const [result] = await pool.query(
                'UPDATE StaffSchedule SET Status = ?, Notes = COALESCE(?, Notes) WHERE ScheduleID = ?',
                [status, adminNotes, scheduleId]
            );
            return result.affectedRows > 0;
        } catch (err) { throw err; }
    }

    // 7. Xóa lịch
    static async deleteSchedule(scheduleId) {
        try {
            const [result] = await pool.query('DELETE FROM StaffSchedule WHERE ScheduleID = ?', [scheduleId]);
            return result.affectedRows > 0;
        } catch (err) { throw err; }
    }
}

module.exports = StaffSchedule;