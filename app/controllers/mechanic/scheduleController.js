// File: app/controllers/mechanic/scheduleController.js
const { pool } = require('../../../config/db');
const { parseVietnamTime, parseVietnamDate } = require('../../utils/timeUtils');

// 1. Lấy slot thời gian khả dụng
const getAvailableSlots = async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ success: false, message: 'Thiếu ngày cần kiểm tra' });

        const [rows] = await pool.query(
            `SELECT s.ScheduleID, s.MechanicID, u.FullName AS MechanicName, s.WorkDate, s.StartTime, s.EndTime
             FROM StaffSchedule s
             JOIN Users u ON s.MechanicID = u.UserID
             WHERE s.WorkDate = ? 
             AND (s.Status IS NULL OR s.Status NOT IN ('ApprovedLeave', 'PendingLeave', 'RejectedLeave'))
             AND (s.Type IS NULL OR s.Type != 'unavailable')
             ORDER BY s.StartTime`,
            [date]
        );

        res.json({ success: true, date, availableSlots: rows });
    } catch (err) {
        console.error('Lỗi /available-slots schedules:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 2. Lấy danh sách tất cả lịch làm việc
const getAllSchedules = async (req, res) => {
    try {
        const [schedules] = await pool.query(`
            SELECT s.*, u.FullName AS MechanicName
            FROM StaffSchedule s
            LEFT JOIN Users u ON s.MechanicID = u.UserID
            ORDER BY s.WorkDate DESC, s.StartTime ASC
        `);
        res.json({ success: true, schedules });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    }
};

// 3. Lấy lịch theo khoảng ngày
const getSchedulesByRange = async (req, res) => {
    try {
        const { startDate, endDate } = req.params;
        const { includeLeave } = req.query;
        if (!startDate || !endDate) return res.status(400).json({ success: false, message: 'Thiếu tham số ngày' });

        let query = `SELECT s.*, u.FullName AS MechanicName FROM StaffSchedule s LEFT JOIN Users u ON s.MechanicID = u.UserID WHERE s.WorkDate BETWEEN ? AND ?`;
        if (includeLeave !== 'true') {
            query += ` AND (s.Status IS NULL OR s.Status NOT IN ('ApprovedLeave', 'PendingLeave', 'RejectedLeave'))`;
            query += ` AND (s.Type IS NULL OR s.Type != 'unavailable')`;
        }
        query += ` ORDER BY s.WorkDate ASC, s.StartTime ASC`;

        const [schedules] = await pool.query(query, [startDate, endDate]);
        res.json({ success: true, schedules });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    }
};

// 4. Tạo lịch làm việc mới
const createSchedule = async (req, res) => {
    try {
        const { mechanicId, workDate, startTime, endTime } = req.body;
        const parsedDate = parseVietnamDate(workDate);
        const parsedStartTime = parseVietnamTime(startTime);
        const parsedEndTime = parseVietnamTime(endTime);

        if (!parsedDate || !parsedStartTime || !parsedEndTime) {
            return res.status(400).json({ success: false, message: 'Định dạng ngày hoặc giờ không hợp lệ' });
        }

        const [duplicateRows] = await pool.query(`
            SELECT * FROM StaffSchedule 
            WHERE MechanicID = ? AND WorkDate = ? AND
            ((StartTime <= ? AND EndTime >= ?) OR (StartTime <= ? AND EndTime >= ?) OR (StartTime >= ? AND EndTime <= ?))
        `, [mechanicId, parsedDate, parsedStartTime, parsedStartTime, parsedEndTime, parsedEndTime, parsedStartTime, parsedEndTime]);

        if (duplicateRows.length > 0) return res.status(400).json({ success: false, message: 'Lịch bị trùng lặp' });

        const [result] = await pool.query(
            'INSERT INTO StaffSchedule (MechanicID, WorkDate, StartTime, EndTime) VALUES (?, ?, ?, ?)',
            [mechanicId, parsedDate, parsedStartTime, parsedEndTime]
        );
        res.status(201).json({ success: true, message: 'Thêm lịch thành công', scheduleId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    }
};

// 5. Xóa lịch
const deleteSchedule = async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM StaffSchedule WHERE ScheduleID = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch' });
        res.json({ success: true, message: 'Xóa lịch thành công' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    }
};

// Thêm các hàm phụ khác từ file của bạn...
const getMechanicsList = async (req, res) => {
    const [mechanics] = await pool.query(`SELECT UserID, FullName, Email, PhoneNumber FROM Users WHERE RoleID = 3 ORDER BY FullName`);
    res.json({ success: true, mechanics });
};

module.exports = {
    getAvailableSlots,
    getAllSchedules,
    getSchedulesByRange,
    createSchedule,
    deleteSchedule,
    getMechanicsList
};