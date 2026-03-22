// File: app/controllers/core/bookingController.js
const socketService = require('../../../socket-service');
const Booking = require('../../models/Booking');
const Service = require('../../models/Service');
const { pool } = require('../../../config/db');
const notificationHelper = require('../../utils/notificationHelper'); 

// 1. Lấy tất cả lịch hẹn (Admin)
const getAllAppointments = async (req, res) => {
    try {
        if (req.user.role !== 1) return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
        
        const { dateFrom, dateTo, status } = req.query;
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const filters = {};
        
        if (dateFrom && dateRegex.test(dateFrom)) filters.dateFrom = dateFrom;
        if (dateTo && dateRegex.test(dateTo)) filters.dateTo = dateTo;
        if (status) filters.status = status;
        
        const appointments = await Booking.getAllAppointments(filters);
        res.json({ success: true, appointments, totalFiltered: appointments.length });
    } catch (err) {
        console.error('Lỗi khi lấy danh sách lịch hẹn:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 2. Lấy lịch hẹn theo ID
const getAppointmentById = async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const appointment = await Booking.getAppointmentById(appointmentId);
        
        if (!appointment) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' });
        
        // ✅ FIXED: Kiểm tra quyền truy cập - cho phép admin, owner, và mechanic được assign
        const isAdmin = req.user.role === 1;
        const isOwner = req.user.userId === appointment.UserID;
        const isMechanic = appointment.MechanicID === req.user.userId;
        
        if (!isAdmin && !isOwner && !isMechanic) {
            return res.status(403).json({ success: false, message: 'Không có quyền truy cập lịch hẹn này' });
        }
        res.json({ success: true, appointment });
    } catch (err) {
        console.error('Lỗi khi lấy thông tin lịch hẹn:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 3. Lấy lịch hẹn của tôi
const getMyAppointments = async (req, res) => {
    try {
        const userId = req.user.userId;
        const appointments = await Booking.getAppointmentsByUserId(userId);
        res.json({ success: true, appointments });
    } catch (err) {
        console.error('Lỗi khi lấy lịch hẹn của người dùng:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 4. Lấy danh sách lịch hẹn đã xóa (Admin)
const getDeletedAppointments = async (req, res) => {
    try {
        if (req.user.role !== 1) return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
        
        const [rows] = await pool.query(`
            SELECT a.AppointmentID, a.UserID, a.VehicleID, a.AppointmentDate, a.Status, a.Notes, a.MechanicID, a.ServiceDuration, a.EstimatedEndTime,
                u.FullName, u.Email, u.PhoneNumber, v.LicensePlate, v.Brand, v.Model, v.Year, m.FullName as MechanicName,
                GROUP_CONCAT(s.ServiceName SEPARATOR ', ') as Services
            FROM Appointments a
            LEFT JOIN Users u ON a.UserID = u.UserID
            LEFT JOIN Vehicles v ON a.VehicleID = v.VehicleID
            LEFT JOIN Users m ON a.MechanicID = m.UserID
            LEFT JOIN AppointmentServices aps ON a.AppointmentID = aps.AppointmentID
            LEFT JOIN Services s ON aps.ServiceID = s.ServiceID
            WHERE a.IsDeleted = 1
            GROUP BY a.AppointmentID 
            ORDER BY a.AppointmentDate DESC
        `);
        res.json({ success: true, appointments: rows, total: rows.length });
    } catch (err) {
        console.error('Lỗi khi lấy danh sách lịch hẹn đã xóa:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 5. Khôi phục lịch hẹn đã xóa (Admin)
const restoreAppointment = async (req, res) => {
    try {
        const appointmentId = req.params.id;
        if (req.user.role !== 1) return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
        
        const [appointment] = await pool.query('SELECT AppointmentID FROM Appointments WHERE AppointmentID = ? AND IsDeleted = 1', [appointmentId]);
        if (appointment.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn đã xóa' });
        
        const [result] = await pool.query('UPDATE Appointments SET IsDeleted = 0 WHERE AppointmentID = ?', [appointmentId]);
        if (result.affectedRows === 0) return res.status(400).json({ success: false, message: 'Không thể khôi phục lịch hẹn' });
        
        res.json({ success: true, message: 'Khôi phục lịch hẹn thành công' });
    } catch (err) {
        console.error('Lỗi khi khôi phục lịch hẹn:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 6. Lấy dữ liệu Dashboard (Admin)
const getAdminDashboard = async (req, res) => {
    try {
        if (req.user.role !== 1) return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
        const stats = await Booking.getDashboardStats();
        const recentBookings = await Booking.getRecentBookings(5);
        res.json({ success: true, stats: stats, recentBookings: recentBookings });
    } catch (error) {
        console.error('Lỗi khi lấy dữ liệu dashboard:', error);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    }
};

// 7. Tạo lịch hẹn (Chung)
const createAppointment = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { vehicleId, licensePlate, brand, model, year, appointmentDate, mechanicId, services, notes, totalServiceTime, endTime, paymentMethod } = req.body;
        
        if (!appointmentDate || !services || services.length === 0) return res.status(400).json({ success: false, message: 'Thiếu thông tin cần thiết để đặt lịch' });
        if (!vehicleId && !licensePlate) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp thông tin xe' });
        
        if (mechanicId) {
            const appointmentDateTime = new Date(appointmentDate);
            const formattedDate = appointmentDateTime.toISOString().split('T')[0];
            
            const [schedulesResult] = await pool.query(`SELECT * FROM StaffSchedule WHERE MechanicID = ? AND WorkDate = ?`, [mechanicId, formattedDate]);
            if (schedulesResult.length === 0) return res.status(400).json({ success: false, message: 'Kỹ thuật viên không có lịch làm việc trong ngày này' });
            
            const [appointmentsResult] = await pool.query(`
                SELECT * FROM Appointments 
                WHERE MechanicID = ? AND DATE(AppointmentDate) = ? AND Status NOT IN ('Canceled')
                AND (
                    (TIME(AppointmentDate) <= TIME(?) AND TIME(EstimatedEndTime) > TIME(?))
                    OR (TIME(AppointmentDate) < TIME(?) AND TIME(EstimatedEndTime) >= TIME(?))
                    OR (TIME(AppointmentDate) >= TIME(?) AND TIME(EstimatedEndTime) <= TIME(?))
                )
            `, [mechanicId, formattedDate, appointmentDate, appointmentDate, endTime, endTime, appointmentDate, endTime]);
            
            if (appointmentsResult.length > 0) return res.status(400).json({ success: false, message: 'Kỹ thuật viên đã có lịch hẹn trùng thời gian này' });
        }
        
        const bookingData = {
            userId, vehicleId, licensePlate, brand, model, year, appointmentDate, mechanicId, services, notes, totalServiceTime, endTime,
            paymentMethod: paymentMethod && (paymentMethod.toLowerCase().includes('chuyển khoản') || paymentMethod.toLowerCase().includes('bank') || paymentMethod.toLowerCase().includes('transfer')) ? 'Chuyển khoản ngân hàng' : 'Thanh toán tại tiệm'
        };
        
        const result = await Booking.createAppointment(bookingData);
        
        // ✅ TẠO NOTIFICATION
        try {
            const [users] = await pool.query('SELECT FullName FROM Users WHERE UserID = ?', [userId]);
            if (users.length > 0) {
                const customerName = users[0].FullName;
                let serviceNames = null;
                if (services && Array.isArray(services)) {
                    const serviceIds = services.map(s => s.serviceId || s.ServiceID).filter(Boolean);
                    if (serviceIds.length > 0) {
                        const [serviceData] = await pool.query('SELECT ServiceName FROM Services WHERE ServiceID IN (?)', [serviceIds]);
                        serviceNames = serviceData.map(s => s.ServiceName).join(', ');
                    }
                }
                await notificationHelper.notifyBookingCreated({
                    userId: userId, customerName: customerName, appointmentId: result.appointmentId,
                    appointmentDate: bookingData.appointmentDate || null, services: serviceNames, mechanicId: bookingData.mechanicId || mechanicId,
                });
            }
        } catch (notifError) { console.error('❌ Error sending notification:', notifError); }
        
        res.status(201).json({ success: true, message: 'Đặt lịch thành công', appointmentId: result.appointmentId, vehicleId: result.vehicleId });
    } catch (err) {
        console.error('Lỗi khi tạo lịch hẹn:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 8. Lấy Slot thời gian
const getAvailableSlots = async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ngày muốn đặt lịch' });
        
        const [mechanicSchedules] = await pool.query(`
            SELECT ss.MechanicID, ss.StartTime, ss.EndTime, u.FullName as MechanicName FROM StaffSchedule ss
            JOIN Users u ON ss.MechanicID = u.UserID WHERE ss.WorkDate = ? ORDER BY ss.StartTime
        `, [date]);
        
        if (mechanicSchedules.length === 0) return res.json({ success: true, availableSlots: [], message: 'Không có kỹ thuật viên làm việc trong ngày này' });
        
        const [existingAppointments] = await pool.query(`
            SELECT AppointmentID, MechanicID, AppointmentDate, EstimatedEndTime, ServiceDuration FROM Appointments
            WHERE DATE(AppointmentDate) = ? AND Status NOT IN ('Canceled')
        `, [date]);
        
        const availableSlots = [];
        for (const schedule of mechanicSchedules) {
            const startTime = new Date(`${date}T${schedule.StartTime}`);
            const endTime = new Date(`${date}T${schedule.EndTime}`);
            let currentSlot = new Date(startTime);
            
            while (currentSlot < endTime) {
                const slotTimeString = `${String(currentSlot.getHours()).padStart(2, '0')}:${String(currentSlot.getMinutes()).padStart(2, '0')}`;
                let isBooked = false;
                
                for (const appointment of existingAppointments) {
                    if (appointment.MechanicID === schedule.MechanicID) {
                        const appointmentTime = new Date(appointment.AppointmentDate);
                        const appointmentTimeString = `${String(appointmentTime.getHours()).padStart(2, '0')}:${String(appointmentTime.getMinutes()).padStart(2, '0')}`;
                        if (slotTimeString === appointmentTimeString) { isBooked = true; break; }
                        
                        const [blockedSlots] = await pool.query(`
                            SELECT * FROM BlockedTimeSlots WHERE MechanicID = ? AND DATE(SlotTime) = ? AND TIME(SlotTime) = ? AND IsBlocked = true
                        `, [schedule.MechanicID, date, slotTimeString]);
                        if (blockedSlots.length > 0) { isBooked = true; break; }
                    }
                }
                
                availableSlots.push({
                    time: slotTimeString, label: slotTimeString, mechanicId: schedule.MechanicID, mechanicName: schedule.MechanicName, status: isBooked ? 'booked' : 'available'
                });
                currentSlot.setHours(currentSlot.getHours() + 1);
            }
        }
        availableSlots.sort((a, b) => a.time.localeCompare(b.time));
        res.json({ success: true, availableSlots });
    } catch (err) {
        console.error('Lỗi khi lấy slot thời gian:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 9. Tạo thanh toán độc lập (từ /payments/create)
const createPayment = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { appointmentId, userId, totalAmount, paymentMethod, status, paymentDetails } = req.body;
        
        if (!appointmentId || !userId || !totalAmount) return res.status(400).json({ success: false, message: 'Thiếu thông tin thanh toán' });
        
        const cleanAppointmentId = appointmentId.replace('BK', '');
        const [appointmentDetails] = await connection.query(`
            SELECT a.MechanicID, u.FullName as CustomerName,
                (SELECT GROUP_CONCAT(s.ServiceName SEPARATOR ', ') FROM AppointmentServices aps JOIN Services s ON aps.ServiceID = s.ServiceID WHERE aps.AppointmentID = a.AppointmentID) AS Services,
                (SELECT FullName FROM Users WHERE UserID = a.MechanicID) AS MechanicName
            FROM Appointments a JOIN Users u ON a.UserID = u.UserID WHERE a.AppointmentID = ?
        `, [cleanAppointmentId]);
        
        const [paymentResult] = await connection.query(`
            INSERT INTO Payments (UserID, AppointmentID, Amount, PaymentMethod, Status, PaymentDetails, CustomerName, Services, MechanicName)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [userId, cleanAppointmentId, totalAmount, paymentMethod, status || 'Pending', paymentDetails || '',
            appointmentDetails[0]?.CustomerName || 'Không xác định', appointmentDetails[0]?.Services || 'Không xác định', appointmentDetails[0]?.MechanicName || 'Không xác định'
        ]);
        
        await connection.commit();
        res.status(201).json({ success: true, message: 'Tạo thanh toán thành công', paymentId: paymentResult.insertId });
    } catch (error) {
        await connection.rollback();
        console.error('Lỗi khi tạo thanh toán:', error);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    } finally { connection.release(); }
};

// 10. Xóa mềm lịch hẹn
const deleteAppointmentSoft = async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const appointment = await Booking.getAppointmentById(appointmentId);
        
        if (!appointment) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' });
        if (req.user.role !== 1 && req.user.userId !== appointment.UserID) return res.status(403).json({ success: false, message: 'Không có quyền xóa lịch hẹn này' });
        
        const [result] = await pool.query('UPDATE Appointments SET IsDeleted = 1 WHERE AppointmentID = ?', [appointmentId]);
        if (result.affectedRows === 0) return res.status(400).json({ success: false, message: 'Không thể xóa lịch hẹn' });
        
        res.json({ success: true, message: 'Xóa lịch hẹn thành công' });
    } catch (err) {
        console.error('Lỗi khi xóa lịch hẹn:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 11. Tạo thanh toán gắn với Appointment ID (từ /appointments/:id/payment)
const createAppointmentPayment = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const appointmentId = req.params.id;
        const { userId, totalAmount, paymentMethod, status, paymentDetails } = req.body;
        
        if (!appointmentId || !userId || !totalAmount) return res.status(400).json({ success: false, message: 'Thiếu thông tin thanh toán' });
        
        const [appointmentDetails] = await connection.query(`
            SELECT a.MechanicID, a.AppointmentDate, u.FullName as CustomerName,
                (SELECT GROUP_CONCAT(s.ServiceName SEPARATOR ', ') FROM AppointmentServices aps JOIN Services s ON aps.ServiceID = s.ServiceID WHERE aps.AppointmentID = a.AppointmentID) AS Services,
                (SELECT FullName FROM Users WHERE UserID = a.MechanicID) AS MechanicName
            FROM Appointments a JOIN Users u ON a.UserID = u.UserID WHERE a.AppointmentID = ?
        `, [appointmentId]);
        
        if (appointmentDetails.length === 0) throw new Error('Không tìm thấy thông tin lịch hẹn');
        
        let normalizedPaymentMethod = 'Thanh toán tại tiệm';
        if (paymentMethod && (paymentMethod.toLowerCase().includes('chuyển khoản') || paymentMethod.toLowerCase().includes('bank') || paymentMethod.toLowerCase().includes('transfer'))) {
            normalizedPaymentMethod = 'Chuyển khoản ngân hàng';
        }
        const paymentStatus = status || (normalizedPaymentMethod === 'Chuyển khoản ngân hàng' ? 'Completed' : 'Pending');
        
        const [paymentResult] = await connection.query(`
            INSERT INTO Payments (UserID, AppointmentID, Amount, PaymentMethod, Status, PaymentDetails, CustomerName, Services, MechanicName, PaymentDate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [userId, appointmentId, totalAmount, normalizedPaymentMethod, paymentStatus, paymentDetails || '',
            appointmentDetails[0]?.CustomerName || 'Không xác định', appointmentDetails[0]?.Services || 'Không xác định', appointmentDetails[0]?.MechanicName || 'Không xác định'
        ]);
        
        if (normalizedPaymentMethod === 'Thanh toán tại tiệm' && appointmentDetails[0]?.AppointmentDate) {
            try {
                await connection.query('CALL SchedulePaymentUpdate(?, ?, ?)', [paymentResult.insertId, appointmentId, appointmentDetails[0].AppointmentDate]);
            } catch (scheduleError) { console.error('Lỗi khi lên lịch cập nhật thanh toán:', scheduleError); }
        }
        
        await connection.commit();
        res.status(201).json({ success: true, message: 'Tạo thanh toán thành công', paymentId: paymentResult.insertId, status: paymentStatus });
    } catch (error) {
        await connection.rollback();
        console.error('Lỗi khi tạo thanh toán:', error);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    } finally { connection.release(); }
};

// 12. Hủy lịch hẹn
const cancelAppointment = async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const appointment = await Booking.getAppointmentById(appointmentId);
        
        if (!appointment) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' });
        if (req.user.role !== 1 && req.user.userId !== appointment.UserID) return res.status(403).json({ success: false, message: 'Không có quyền hủy lịch hẹn này' });
        if (appointment.Status === 'Completed') return res.status(400).json({ success: false, message: 'Không thể hủy lịch hẹn đã hoàn thành' });
        
        await Booking.cancelAppointment(appointmentId);
        res.json({ success: true, message: 'Hủy lịch hẹn thành công' });
    } catch (err) {
        console.error('Lỗi khi hủy lịch hẹn:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 13. Lấy danh sách thợ sửa xe
const getMechanics = async (req, res) => {
    try {
        const mechanics = await Booking.getMechanics();
        res.json({ success: true, mechanics });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 14. Lấy xe của người dùng
const getMyVehicles = async (req, res) => {
    try {
        const userId = req.user.userId;
        const vehicles = await Booking.getUserVehicles(userId);
        res.json({ success: true, vehicles });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 15. Lấy danh sách dịch vụ
const getServices = async (req, res) => {
    try {
        const [services] = await pool.query('SELECT * FROM Services');
        services.forEach(service => {
            if (service.ServiceImage && !service.ServiceImage.startsWith('http') && !service.ServiceImage.startsWith('/')) {
                service.ServiceImage = `images/services/${service.ServiceImage}`;
            }
        });
        res.json({ success: true, services });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 16. Cập nhật lịch hẹn (PUT)
const updateAppointment = async (req, res) => {
    try {
        const appointmentId = req.params.id;
        const appointment = await Booking.getAppointmentById(appointmentId);
        
        if (!appointment) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' });
        if (req.user.role !== 1 && req.user.userId !== appointment.UserID) return res.status(403).json({ success: false, message: 'Không có quyền cập nhật lịch hẹn này' });

        const previousStatus = appointment.Status;
        const { status, notes, mechanicId, appointmentDate, services, vehicleId, licensePlate, brand, model, year } = req.body;
        
        const updateData = { status, notes, mechanicId, appointmentDate, services, vehicleId, licensePlate, brand, model, year };
        await Booking.updateAppointment(appointmentId, updateData);

        const [updatedAppointments] = await pool.query(`
            SELECT a.*, u.FullName, u.Email, u.PhoneNumber, v.LicensePlate, v.Brand, v.Model, v.Year,
                (SELECT GROUP_CONCAT(s.ServiceName SEPARATOR ', ') FROM AppointmentServices aps JOIN Services s ON aps.ServiceID = s.ServiceID WHERE aps.AppointmentID = a.AppointmentID) AS Services
            FROM Appointments a LEFT JOIN Users u ON a.UserID = u.UserID LEFT JOIN Vehicles v ON a.VehicleID = v.VehicleID
            WHERE a.AppointmentID = ?
        `, [appointmentId]);
        const appointmentData = updatedAppointments[0];

        // ✅ GỬI NOTIFICATION KHI STATUS THAY ĐỔI
        if (status && status !== previousStatus) {
            try {
                const [mechanicInfo] = await pool.query('SELECT FullName FROM Users WHERE UserID = ?', [appointmentData.MechanicID]);
                const [totalAmountInfo] = await pool.query(`
                    SELECT SUM(s.Price * aps.Quantity) as TotalAmount FROM AppointmentServices aps JOIN Services s ON aps.ServiceID = s.ServiceID WHERE aps.AppointmentID = ?
                `, [appointmentId]);
                
                const mechanicName = mechanicInfo.length > 0 ? mechanicInfo[0].FullName : null;
                const totalAmount = totalAmountInfo[0]?.TotalAmount || 0;
                
                if (status === 'Confirmed') await notificationHelper.notifyBookingConfirmed({ userId: appointmentData.UserID, appointmentId, appointmentDate: appointmentData.AppointmentDate, garage: appointmentData.GarageName || null, mechanicName });
                else if (status === 'InProgress') await notificationHelper.notifyServiceInProgress({ userId: appointmentData.UserID, appointmentId, mechanicName });
                else if (status === 'Completed') await notificationHelper.notifyServiceCompleted({ userId: appointmentData.UserID, appointmentId, totalAmount, paymentMethod: appointmentData.PaymentMethod });
                else if (status === 'Rejected' || status === 'Canceled') await notificationHelper.notifyBookingRejected({ userId: appointmentData.UserID, appointmentId, reason: notes || '', status });
            } catch (notifError) { console.error('❌ Error sending status change notification:', notifError); }
        }

        // 🔥 EMIT SOCKET EVENT
        socketService.emitAppointmentUpdated(appointmentData, previousStatus);
        res.json({ success: true, message: 'Cập nhật lịch hẹn thành công', appointment: appointmentData });
    } catch (err) {
        console.error('Lỗi khi cập nhật lịch hẹn:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 17. Tạo lịch hẹn (USER - từ /create)
const createAppointmentUser = async (req, res) => {
    try {
        const { userId, vehicleId, appointmentDate, notes, serviceIds } = req.body;
        if (!userId || !vehicleId || !appointmentDate || !serviceIds || serviceIds.length === 0) return res.status(400).json({ success: false, message: 'Thiếu thông bắt buộc' });
        if (req.user.userId !== userId && req.user.role !== 1) return res.status(403).json({ success: false, message: 'Không có quyền tạo lịch cho user khác' });
        
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [appointmentResult] = await connection.query(`INSERT INTO Appointments (UserID, VehicleID, AppointmentDate, Status, Notes) VALUES (?, ?, ?, 'Pending', ?)`, [userId, vehicleId, appointmentDate, notes || null]);
            const appointmentId = appointmentResult.insertId;
            
            const [services] = await connection.query(`SELECT ServiceID, EstimatedTime FROM Services WHERE ServiceID IN (?)`, [serviceIds]);
            let totalTime = services.reduce((acc, curr) => acc + (curr.EstimatedTime || 0), 0);
            
            for (const serviceId of serviceIds) {
                await connection.query(`INSERT INTO AppointmentServices (AppointmentID, ServiceID, Quantity) VALUES (?, ?, 1)`, [appointmentId, serviceId]);
            }
            
            const estimatedEndTime = new Date(new Date(appointmentDate).getTime() + totalTime * 60000);
            await connection.query(`UPDATE Appointments SET ServiceDuration = ?, EstimatedEndTime = ? WHERE AppointmentID = ?`, [totalTime, estimatedEndTime, appointmentId]);
            await connection.commit();
            
            const [fullAppointment] = await connection.query(`
                SELECT a.*, u.FullName, u.Email, u.PhoneNumber, v.LicensePlate, v.Brand, v.Model, v.Year,
                    (SELECT GROUP_CONCAT(s.ServiceName SEPARATOR ', ') FROM AppointmentServices aps JOIN Services s ON aps.ServiceID = s.ServiceID WHERE aps.AppointmentID = a.AppointmentID) AS Services
                FROM Appointments a LEFT JOIN Users u ON a.UserID = u.UserID LEFT JOIN Vehicles v ON a.VehicleID = v.VehicleID
                WHERE a.AppointmentID = ?
            `, [appointmentId]);
            
            // 🔥 EMIT SOCKET EVENT
            socketService.emitNewAppointment(fullAppointment[0]);
            res.status(201).json({ success: true, message: 'Tạo lịch hẹn thành công', appointment: fullAppointment[0] });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally { connection.release(); }
    } catch (err) {
        console.error('Lỗi khi tạo lịch hẹn (USER):', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

module.exports = {
    getAllAppointments, getAppointmentById, getMyAppointments, getDeletedAppointments, restoreAppointment,
    getAdminDashboard, createAppointment, getAvailableSlots, createPayment, deleteAppointmentSoft,
    createAppointmentPayment, cancelAppointment, getMechanics, getMyVehicles, getServices, updateAppointment, createAppointmentUser
};