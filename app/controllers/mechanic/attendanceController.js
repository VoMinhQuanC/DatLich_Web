// File: app/controllers/mechanic/attendanceController.js
const { pool } = require('../../../config/db');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { getCurrentVietnamDate } = require('../../utils/timeUtils');

// --- CÁC HÀM HELPER NỘI BỘ ---

const findTodaySchedule = async (mechanicId, date) => {
    try {
        const [schedules] = await pool.query(
            `SELECT * FROM StaffSchedule
             WHERE MechanicID = ? AND WorkDate = ?
             AND (Status IS NULL OR Status NOT IN ('ApprovedLeave', 'PendingLeave'))
             AND (Type IS NULL OR Type != 'unavailable')
             ORDER BY StartTime ASC LIMIT 1`,
            [mechanicId, date]
        );
        return schedules.length > 0 ? schedules[0] : null;
    } catch (err) { return null; }
};

const calculateHours = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return parseFloat(((end - start) / (1000 * 60 * 60)).toFixed(2));
};

const calculateScheduledHours = (startTime, endTime) => {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return parseFloat(((endMinutes - startMinutes) / 60).toFixed(2));
};

const getDateParamOrToday = (inputDate) => inputDate || getCurrentVietnamDate();

// --- CÁC HÀM XỬ LÝ CHÍNH (CONTROLLERS) ---

// 1. Tạo QR Code (Admin/System)
const generateQRCode = async (req, res) => {
    try {
        const now = new Date();
        const timestamp = now.getTime();
        const randomStr = crypto.randomBytes(16).toString('hex');
        const token = `${timestamp}_${crypto.createHash('sha256').update(`${timestamp}_${randomStr}_SECRET`).digest('hex').substring(0, 20)}`;
        const expiresAt = new Date(now.getTime() + 30000); // 30 giây

        await pool.query('INSERT INTO AttendanceQRCodes (QRToken, GeneratedAt, ExpiresAt) VALUES (?, ?, ?)', [token, now, expiresAt]);
        await pool.query('DELETE FROM AttendanceQRCodes WHERE ExpiresAt < NOW()');

        const qrImage = await QRCode.toDataURL(token, { width: 300, margin: 2 });

        res.json({ success: true, token, image: qrImage, expiresAt: expiresAt.toISOString(), validFor: 30 });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 2. Mechanic Check-in
const checkIn = async (req, res) => {
    try {
        const mechanicId = req.user.userId;
        const { qrToken, latitude, longitude, address } = req.body;
        if (!qrToken || !latitude || !longitude) return res.status(400).json({ success: false, message: 'Thiếu thông tin' });

        const [qrRows] = await pool.query('SELECT * FROM AttendanceQRCodes WHERE QRToken = ? AND ExpiresAt > NOW() AND IsUsed = FALSE', [qrToken]);
        if (qrRows.length === 0) return res.status(400).json({ success: false, message: 'Mã QR không hợp lệ hoặc đã hết hạn' });

        const today = getCurrentVietnamDate();
        const [existing] = await pool.query('SELECT * FROM Attendance WHERE MechanicID = ? AND AttendanceDate = ?', [mechanicId, today]);
        if (existing.length > 0 && existing[0].CheckInTime) return res.status(400).json({ success: false, message: 'Đã chấm công vào rồi' });

        const schedule = await findTodaySchedule(mechanicId, today);
        const checkInTime = new Date();
        const hour = checkInTime.getHours();
        const minute = checkInTime.getMinutes();

        let status = 'Present';
        let scheduledStart = null, scheduledEnd = null, scheduledHours = null, scheduleId = null;

        if (schedule) {
            scheduleId = schedule.ScheduleID;
            scheduledStart = schedule.StartTime;
            scheduledEnd = schedule.EndTime;
            scheduledHours = calculateScheduledHours(scheduledStart, scheduledEnd);
            const [schedStartH, schedStartM] = scheduledStart.split(':').map(Number);
            if ((hour > schedStartH) || (hour === schedStartH && minute > schedStartM + 15)) status = 'Late';
        } else {
            if ((hour > 8) || (hour === 8 && minute > 30)) status = 'Late';
        }

        if (existing.length > 0) {
            await pool.query(`UPDATE Attendance SET CheckInTime=?, CheckInLatitude=?, CheckInLongitude=?, CheckInAddress=?, Status=?, ScheduleID=?, ScheduledStartTime=?, ScheduledEndTime=?, ScheduledWorkHours=? WHERE AttendanceID=?`,
                [checkInTime, latitude, longitude, address, status, scheduleId, scheduledStart, scheduledEnd, scheduledHours, existing[0].AttendanceID]);
        } else {
            await pool.query(`INSERT INTO Attendance (MechanicID, AttendanceDate, CheckInTime, CheckInLatitude, CheckInLongitude, CheckInAddress, Status, ScheduleID, ScheduledStartTime, ScheduledEndTime, ScheduledWorkHours) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [mechanicId, today, checkInTime, latitude, longitude, address, status, scheduleId, scheduledStart, scheduledEnd, scheduledHours]);
        }

        await pool.query('UPDATE AttendanceQRCodes SET IsUsed = TRUE WHERE QRToken = ?', [qrToken]);
        res.json({ success: true, message: 'Chấm công thành công', status, checkInTime: checkInTime.toISOString() });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 3. Mechanic Check-out
const checkOut = async (req, res) => {
    try {
        const mechanicId = req.user.userId;
        const { qrToken, latitude, longitude, address } = req.body;
        const today = getCurrentVietnamDate();

        const [qrRows] = await pool.query('SELECT * FROM AttendanceQRCodes WHERE QRToken = ? AND ExpiresAt > NOW() AND IsUsed = FALSE', [qrToken]);
        if (qrRows.length === 0) return res.status(400).json({ success: false, message: 'Mã QR không hợp lệ hoặc đã hết hạn' });

        const [attendance] = await pool.query('SELECT * FROM Attendance WHERE MechanicID = ? AND AttendanceDate = ?', [mechanicId, today]);
        if (attendance.length === 0 || !attendance[0].CheckInTime) return res.status(400).json({ success: false, message: 'Chưa chấm công vào' });

        const checkOutTime = new Date();
        const actualWorkHours = calculateHours(attendance[0].CheckInTime, checkOutTime);
        let overtimeHours = 0;
        if (attendance[0].ScheduledWorkHours && actualWorkHours > attendance[0].ScheduledWorkHours) {
            overtimeHours = parseFloat((actualWorkHours - attendance[0].ScheduledWorkHours).toFixed(2));
        }

        await pool.query(`UPDATE Attendance SET CheckOutTime=?, CheckOutLatitude=?, CheckOutLongitude=?, CheckOutAddress=?, ActualWorkHours=?, OvertimeHours=? WHERE AttendanceID=?`,
            [checkOutTime, latitude, longitude, address, actualWorkHours, overtimeHours, attendance[0].AttendanceID]);

        await pool.query('UPDATE AttendanceQRCodes SET IsUsed = TRUE WHERE QRToken = ?', [qrToken]);
        res.json({ success: true, actualWorkHours, overtimeHours });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 4. Lịch sử chấm công (Mechanic)
const getAttendanceHistory = async (req, res) => {
    try {
        const mechanicId = req.user.userId;
        const { month } = req.query;
        let query = `SELECT * FROM Attendance WHERE MechanicID = ?`;
        const params = [mechanicId];

        if (month) {
            const [year, monthNum] = month.split('-');
            query += ` AND YEAR(AttendanceDate) = ? AND MONTH(AttendanceDate) = ?`;
            params.push(parseInt(year), parseInt(monthNum));
        }
        query += ` ORDER BY AttendanceDate DESC`;
        const [rows] = await pool.query(query, params);
        res.json({ success: true, attendance: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 5. Admin xem chấm công
const adminGetAttendance = async (req, res) => {
    try {
        if (req.user.role !== 1) return res.status(403).json({ success: false, message: 'Chỉ Admin' });
        const date = getDateParamOrToday(req.query.date);
        const [rows] = await pool.query(
            `SELECT a.*, u.FullName, u.PhoneNumber
             FROM Attendance a
             JOIN Users u ON a.MechanicID = u.UserID
             WHERE a.AttendanceDate = ?
             ORDER BY a.CheckInTime DESC, u.FullName ASC`,
            [date]
        );
        res.json({ success: true, attendance: rows, date });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const adminGetAttendanceStats = async (req, res) => {
    try {
        if (req.user.role !== 1) {
            return res.status(403).json({ success: false, message: 'Chỉ Admin' });
        }

        const date = getDateParamOrToday(req.query.date);

        const [attendanceRows] = await pool.query(
            `SELECT
                COUNT(CASE WHEN CheckInTime IS NOT NULL THEN 1 END) AS checkedIn,
                COUNT(CASE WHEN CheckOutTime IS NOT NULL THEN 1 END) AS checkedOut,
                COUNT(CASE WHEN Status = 'Late' THEN 1 END) AS late
             FROM Attendance
             WHERE AttendanceDate = ?`,
            [date]
        );

        const [scheduledRows] = await pool.query(
            `SELECT COUNT(DISTINCT MechanicID) AS scheduledCount
             FROM StaffSchedule
             WHERE WorkDate = ?
             AND (Status IS NULL OR Status NOT IN ('ApprovedLeave', 'PendingLeave'))
             AND (Type IS NULL OR Type != 'unavailable')`,
            [date]
        );

        const checkedIn = Number(attendanceRows[0]?.checkedIn || 0);
        const checkedOut = Number(attendanceRows[0]?.checkedOut || 0);
        const late = Number(attendanceRows[0]?.late || 0);
        const scheduledCount = Number(scheduledRows[0]?.scheduledCount || 0);
        const absent = Math.max(0, scheduledCount - checkedIn);

        res.json({
            success: true,
            date,
            stats: {
                checkedIn,
                checkedOut,
                late,
                absent,
                scheduled: scheduledCount
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = { generateQRCode, checkIn, checkOut, getAttendanceHistory, adminGetAttendance, adminGetAttendanceStats };
