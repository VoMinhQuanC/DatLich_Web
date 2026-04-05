// File: app/controllers/mechanic/scheduleController.js
const { pool } = require('../../../config/db');
const { parseVietnamTime, parseVietnamDate } = require('../../utils/timeUtils');

const getRequestValue = (body, ...keys) => {
    for (const key of keys) {
        if (body[key] !== undefined && body[key] !== null && body[key] !== '') {
            return body[key];
        }
    }
    return undefined;
};

const shouldRestrictToCurrentMechanic = (req) => req.user?.role === 3 && req.baseUrl.includes('/api/mechanics/schedules');

const formatScheduleRow = (row) => ({
    ...row,
    StartTime: row.StartTime && typeof row.StartTime === 'string' ? row.StartTime.substring(0, 8) : row.StartTime,
    EndTime: row.EndTime && typeof row.EndTime === 'string' ? row.EndTime.substring(0, 8) : row.EndTime
});

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
        let query = `
            SELECT s.*, u.FullName AS MechanicName, u.PhoneNumber AS MechanicPhone
            FROM StaffSchedule s
            LEFT JOIN Users u ON s.MechanicID = u.UserID
        `;
        const params = [];

        if (shouldRestrictToCurrentMechanic(req)) {
            query += ` WHERE s.MechanicID = ?`;
            params.push(req.user.userId);
        }

        query += ` ORDER BY s.WorkDate DESC, s.StartTime ASC`;

        const [schedules] = await pool.query(query, params);
        const formattedSchedules = schedules.map(formatScheduleRow);
        res.json({ success: true, schedules: formattedSchedules, data: formattedSchedules });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    }
};

// 3. Lấy lịch theo khoảng ngày
const getSchedulesByRange = async (req, res) => {
    try {
        const startDate = req.params.startDate || req.query.startDate;
        const endDate = req.params.endDate || req.query.endDate;
        const { includeLeave } = req.query;
        if (!startDate || !endDate) return res.status(400).json({ success: false, message: 'Thiếu tham số ngày' });

        let query = `SELECT s.*, u.FullName AS MechanicName, u.PhoneNumber AS MechanicPhone FROM StaffSchedule s LEFT JOIN Users u ON s.MechanicID = u.UserID WHERE s.WorkDate BETWEEN ? AND ?`;
        const params = [startDate, endDate];

        if (shouldRestrictToCurrentMechanic(req)) {
            query += ` AND s.MechanicID = ?`;
            params.push(req.user.userId);
        }

        if (includeLeave !== 'true' && !shouldRestrictToCurrentMechanic(req)) {
            query += ` AND (s.Status IS NULL OR s.Status NOT IN ('ApprovedLeave', 'PendingLeave', 'RejectedLeave'))`;
            query += ` AND (s.Type IS NULL OR s.Type != 'unavailable')`;
        }
        query += ` ORDER BY s.WorkDate ASC, s.StartTime ASC`;

        const [schedules] = await pool.query(query, params);
        const formattedSchedules = schedules.map(formatScheduleRow);
        res.json({ success: true, schedules: formattedSchedules, data: formattedSchedules });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    }
};

// 4. Tạo lịch làm việc mới
const createSchedule = async (req, res) => {
    try {
        const mechanicId = Number(getRequestValue(req.body, 'mechanicId', 'MechanicID')) || req.user?.userId;
        const workDate = getRequestValue(req.body, 'workDate', 'WorkDate');
        const startTime = getRequestValue(req.body, 'startTime', 'StartTime');
        const endTime = getRequestValue(req.body, 'endTime', 'EndTime');
        const notes = getRequestValue(req.body, 'notes', 'Notes') || null;
        const type = getRequestValue(req.body, 'type', 'Type') || 'available';
        const status = getRequestValue(req.body, 'status', 'Status') || 'Approved';
        const parsedDate = parseVietnamDate(workDate);
        const parsedStartTime = parseVietnamTime(startTime);
        const parsedEndTime = parseVietnamTime(endTime);

        if (!parsedDate || !parsedStartTime || !parsedEndTime) {
            return res.status(400).json({ success: false, message: 'Định dạng ngày hoặc giờ không hợp lệ' });
        }

        if (req.user?.role !== 1 && mechanicId !== req.user?.userId) {
            return res.status(403).json({ success: false, message: 'Bạn chỉ có thể tạo lịch cho chính mình' });
        }

        const [duplicateRows] = await pool.query(`
            SELECT * FROM StaffSchedule 
            WHERE MechanicID = ? AND WorkDate = ? AND
            ((StartTime <= ? AND EndTime >= ?) OR (StartTime <= ? AND EndTime >= ?) OR (StartTime >= ? AND EndTime <= ?))
        `, [mechanicId, parsedDate, parsedStartTime, parsedStartTime, parsedEndTime, parsedEndTime, parsedStartTime, parsedEndTime]);

        if (duplicateRows.length > 0) return res.status(400).json({ success: false, message: 'Lịch bị trùng lặp' });

        const [result] = await pool.query(
            'INSERT INTO StaffSchedule (MechanicID, WorkDate, StartTime, EndTime, Type, Status, Notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [mechanicId, parsedDate, parsedStartTime, parsedEndTime, type, status, notes]
        );
        res.status(201).json({ success: true, message: 'Thêm lịch thành công', scheduleId: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    }
};

const updateSchedule = async (req, res) => {
    try {
        const scheduleId = Number(req.params.id);
        const [rows] = await pool.query('SELECT * FROM StaffSchedule WHERE ScheduleID = ?', [scheduleId]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch' });

        const existing = rows[0];
        if (req.user?.role !== 1 && existing.MechanicID !== req.user?.userId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền sửa lịch này' });
        }

        const workDate = getRequestValue(req.body, 'workDate', 'WorkDate') || existing.WorkDate;
        const startTime = getRequestValue(req.body, 'startTime', 'StartTime') || existing.StartTime;
        const endTime = getRequestValue(req.body, 'endTime', 'EndTime') || existing.EndTime;
        const notes = getRequestValue(req.body, 'notes', 'Notes');
        const type = getRequestValue(req.body, 'type', 'Type') || existing.Type || 'available';
        const status = getRequestValue(req.body, 'status', 'Status') || existing.Status || 'Approved';

        const parsedDate = parseVietnamDate(workDate);
        const parsedStartTime = parseVietnamTime(startTime);
        const parsedEndTime = parseVietnamTime(endTime);

        if (!parsedDate || !parsedStartTime || !parsedEndTime) {
            return res.status(400).json({ success: false, message: 'Định dạng ngày hoặc giờ không hợp lệ' });
        }

        const [duplicateRows] = await pool.query(`
            SELECT * FROM StaffSchedule 
            WHERE MechanicID = ? AND WorkDate = ? AND ScheduleID != ? AND
            ((StartTime <= ? AND EndTime >= ?) OR (StartTime <= ? AND EndTime >= ?) OR (StartTime >= ? AND EndTime <= ?))
        `, [existing.MechanicID, parsedDate, scheduleId, parsedStartTime, parsedStartTime, parsedEndTime, parsedEndTime, parsedStartTime, parsedEndTime]);

        if (duplicateRows.length > 0) return res.status(400).json({ success: false, message: 'Lịch bị trùng lặp' });

        await pool.query(
            `UPDATE StaffSchedule
             SET WorkDate = ?, StartTime = ?, EndTime = ?, Type = ?, Status = ?, Notes = ?
             WHERE ScheduleID = ?`,
            [parsedDate, parsedStartTime, parsedEndTime, type, status, notes ?? existing.Notes ?? null, scheduleId]
        );

        res.json({ success: true, message: 'Cập nhật lịch thành công' });
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
    res.json({ success: true, mechanics, data: mechanics });
};

const getCanEditStatus = async (req, res) => {
    try {
        const scheduleId = Number(req.params.id);
        const [rows] = await pool.query('SELECT * FROM StaffSchedule WHERE ScheduleID = ?', [scheduleId]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch' });

        const schedule = rows[0];
        if (req.user?.role !== 1 && schedule.MechanicID !== req.user?.userId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xem lịch này' });
        }

        const lockedStatuses = ['PendingLeave', 'ApprovedLeave', 'PendingEdit'];
        const canEdit = !lockedStatuses.includes(schedule.Status);
        const canLeave = !['PendingLeave', 'ApprovedLeave'].includes(schedule.Status);

        res.json({
            success: true,
            canEdit,
            canLeave,
            lockReason: canEdit ? '' : 'Lịch này đang ở trạng thái chờ duyệt hoặc đã được duyệt nghỉ.'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    }
};

const requestEdit = async (req, res) => {
    try {
        const scheduleId = Number(req.params.id);
        const [rows] = await pool.query('SELECT * FROM StaffSchedule WHERE ScheduleID = ?', [scheduleId]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch' });

        const schedule = rows[0];
        if (req.user?.role !== 1 && schedule.MechanicID !== req.user?.userId) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền sửa lịch này' });
        }

        const newWorkDate = parseVietnamDate(req.body.newWorkDate);
        const newStartTime = parseVietnamTime(req.body.newStartTime);
        const newEndTime = parseVietnamTime(req.body.newEndTime);
        const reason = req.body.reason || '';

        if (!newWorkDate || !newStartTime || !newEndTime) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin ngày hoặc giờ mới' });
        }

        const notes = JSON.stringify({
            editRequest: {
                oldWorkDate: schedule.WorkDate,
                oldStartTime: schedule.StartTime,
                oldEndTime: schedule.EndTime,
                newWorkDate,
                newStartTime,
                newEndTime,
                reason
            }
        });

        await pool.query(
            `UPDATE StaffSchedule
             SET Status = 'PendingEdit', Notes = ?
             WHERE ScheduleID = ?`,
            [notes, scheduleId]
        );

        res.json({ success: true, message: 'Đã gửi yêu cầu chỉnh sửa lịch' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    }
};

const getMechanicCountByDate = async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ success: false, message: 'Thiếu ngày cần kiểm tra' });

        const [rows] = await pool.query(
            `SELECT COUNT(DISTINCT MechanicID) AS mechanicCount
             FROM StaffSchedule
             WHERE WorkDate = ?
             AND (Status IS NULL OR Status NOT IN ('PendingLeave', 'ApprovedLeave'))
             AND (Type IS NULL OR Type != 'unavailable')`,
            [date]
        );

        const mechanicCount = Number(rows[0]?.mechanicCount || 0);
        res.json({ success: true, mechanicCount, available: Math.max(0, 6 - mechanicCount) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    }
};

const checkOverlap = async (req, res) => {
    try {
        const mechanicId = req.user?.userId;
        const date = parseVietnamDate(req.body.date);
        const startTime = parseVietnamTime(req.body.startTime);
        const endTime = parseVietnamTime(req.body.endTime);
        const excludeScheduleId = Number(req.body.excludeScheduleId || 0);

        if (!mechanicId || !date || !startTime || !endTime) {
            return res.status(400).json({ success: false, message: 'Thiếu dữ liệu kiểm tra' });
        }

        const [rows] = await pool.query(
            `SELECT * FROM StaffSchedule
             WHERE MechanicID = ? AND WorkDate = ? AND ScheduleID != ?`,
            [mechanicId, date, excludeScheduleId]
        );

        const toMinutes = (timeStr) => {
            const [hours, minutes] = String(timeStr).substring(0, 5).split(':').map(Number);
            return hours * 60 + minutes;
        };

        const newStart = toMinutes(startTime);
        const newEnd = toMinutes(endTime);

        const overlaps = rows.filter((row) => {
            const existingStart = toMinutes(row.StartTime);
            const existingEnd = toMinutes(row.EndTime);
            return newStart < existingEnd + 240 && newEnd > existingStart - 240;
        }).map(formatScheduleRow);

        res.json({ success: true, hasOverlap: overlaps.length > 0, overlaps });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    }
};

module.exports = {
    getAvailableSlots,
    getAllSchedules,
    getSchedulesByRange,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    getMechanicsList,
    getCanEditStatus,
    requestEdit,
    getMechanicCountByDate,
    checkOverlap
};
