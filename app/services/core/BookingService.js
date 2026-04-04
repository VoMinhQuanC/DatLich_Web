// File: app/services/core/BookingService.js

class BookingService {
    constructor(dbPool, bookingModel, notificationHelper, socketService) {
        this.pool = dbPool;
        this.bookingModel = bookingModel;
        this.notificationHelper = notificationHelper;
        this.socketService = socketService;
    }

    async getAllAppointments(user, query) {
        if (user.role !== 1) throw new Error('FORBIDDEN');
        
        const { dateFrom, dateTo, status } = query;
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const filters = {};
        
        if (dateFrom && dateRegex.test(dateFrom)) filters.dateFrom = dateFrom;
        if (dateTo && dateRegex.test(dateTo)) filters.dateTo = dateTo;
        if (status) filters.status = status;
        
        const appointments = await this.bookingModel.getAllAppointments(filters);
        return { appointments, totalFiltered: appointments.length };
    }

    async getAppointmentById(appointmentId, user) {
        const appointment = await this.bookingModel.getAppointmentById(appointmentId);
        
        if (!appointment) throw new Error('NOT_FOUND');
        
        const isAdmin = user.role === 1;
        const isOwner = user.userId === appointment.UserID;
        const isMechanic = appointment.MechanicID === user.userId;
        
        if (!isAdmin && !isOwner && !isMechanic) {
            throw new Error('FORBIDDEN');
        }
        return appointment;
    }

    async getMyAppointments(userId) {
        return await this.bookingModel.getAppointmentsByUserId(userId);
    }

    async getDeletedAppointments(user) {
        if (user.role !== 1) throw new Error('FORBIDDEN');
        
        const [rows] = await this.pool.query(`
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
        return { appointments: rows, total: rows.length };
    }

    async restoreAppointment(appointmentId, user) {
        if (user.role !== 1) throw new Error('FORBIDDEN');
        
        const [appointment] = await this.pool.query('SELECT AppointmentID FROM Appointments WHERE AppointmentID = ? AND IsDeleted = 1', [appointmentId]);
        if (appointment.length === 0) throw new Error('NOT_FOUND');
        
        const [result] = await this.pool.query('UPDATE Appointments SET IsDeleted = 0 WHERE AppointmentID = ?', [appointmentId]);
        if (result.affectedRows === 0) throw new Error('UPDATE_FAILED');
        
        return true;
    }

    async getAdminDashboard(user) {
        if (user.role !== 1) throw new Error('FORBIDDEN');
        const stats = await this.bookingModel.getDashboardStats();
        const recentBookings = await this.bookingModel.getRecentBookings(5);
        return { stats, recentBookings };
    }

    async createAppointment(userId, data) {
        const { vehicleId, licensePlate, brand, model, year, appointmentDate, mechanicId, services, notes, totalServiceTime, endTime, paymentMethod } = data;
        
        if (!appointmentDate || !services || services.length === 0) throw new Error('MISSING_INFO');
        if (!vehicleId && !licensePlate) throw new Error('MISSING_VEHICLE');
        
        if (mechanicId) {
            const appointmentDateTime = new Date(appointmentDate);
            const formattedDate = appointmentDateTime.toISOString().split('T')[0];
            
            const [schedulesResult] = await this.pool.query(`SELECT * FROM StaffSchedule WHERE MechanicID = ? AND WorkDate = ?`, [mechanicId, formattedDate]);
            if (schedulesResult.length === 0) throw new Error('MECHANIC_NO_SCHEDULE');
            
            const [appointmentsResult] = await this.pool.query(`
                SELECT * FROM Appointments 
                WHERE MechanicID = ? AND DATE(AppointmentDate) = ? AND Status NOT IN ('Canceled')
                AND (
                    (TIME(AppointmentDate) <= TIME(?) AND TIME(EstimatedEndTime) > TIME(?))
                    OR (TIME(AppointmentDate) < TIME(?) AND TIME(EstimatedEndTime) >= TIME(?))
                    OR (TIME(AppointmentDate) >= TIME(?) AND TIME(EstimatedEndTime) <= TIME(?))
                )
            `, [mechanicId, formattedDate, appointmentDate, appointmentDate, endTime, endTime, appointmentDate, endTime]);
            
            if (appointmentsResult.length > 0) throw new Error('MECHANIC_BUSY');
        }
        
        const bookingData = {
            userId, vehicleId, licensePlate, brand, model, year, appointmentDate, mechanicId, services, notes, totalServiceTime, endTime,
            paymentMethod: paymentMethod && (paymentMethod.toLowerCase().includes('chuyển khoản') || paymentMethod.toLowerCase().includes('bank') || paymentMethod.toLowerCase().includes('transfer')) ? 'Chuyển khoản ngân hàng' : 'Thanh toán tại tiệm'
        };
        
        console.log('🚨 [DEBUG BookingService] bookingData created:', JSON.stringify(bookingData));
        console.log('🚨 [DEBUG BookingService] services format:', typeof services, Array.isArray(services), JSON.stringify(services));
        
        const result = await this.bookingModel.createAppointment(bookingData);
        
        // Notifications
        try {
            const [users] = await this.pool.query('SELECT FullName FROM Users WHERE UserID = ?', [userId]);
            if (users.length > 0) {
                const customerName = users[0].FullName;
                let serviceNames = null;
                if (services && Array.isArray(services)) {
                    const serviceIds = services.map(s => s.serviceId || s.ServiceID).filter(Boolean);
                    if (serviceIds.length > 0) {
                        const [serviceData] = await this.pool.query('SELECT ServiceName FROM Services WHERE ServiceID IN (?)', [serviceIds]);
                        serviceNames = serviceData.map(s => s.ServiceName).join(', ');
                    }
                }
                await this.notificationHelper.notifyBookingCreated({
                    userId: userId, customerName: customerName, appointmentId: result.appointmentId,
                    appointmentDate: bookingData.appointmentDate || null, services: serviceNames, mechanicId: bookingData.mechanicId || mechanicId,
                });
            }
        } catch (notifError) { 
            console.error('❌ Error sending notification:', notifError); 
        }
        
        return result;
    }

    async getAvailableSlots({ date }) {
        if (!date) throw new Error('MISSING_DATE');
        
        const [mechanicSchedules] = await this.pool.query(`
            SELECT ss.MechanicID, ss.StartTime, ss.EndTime, u.FullName as MechanicName FROM StaffSchedule ss
            JOIN Users u ON ss.MechanicID = u.UserID WHERE ss.WorkDate = ? ORDER BY ss.StartTime
        `, [date]);
        
        if (mechanicSchedules.length === 0) return [];
        
        const [existingAppointments] = await this.pool.query(`
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
                        
                        const [blockedSlots] = await this.pool.query(`
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
        return availableSlots;
    }

    async createPayment(data) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            const { appointmentId, userId, totalAmount, paymentMethod, status, paymentDetails } = data;
            
            if (!appointmentId || !userId || !totalAmount) throw new Error('MISSING_INFO');
            
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
            return { paymentId: paymentResult.insertId };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async deleteAppointmentSoft(appointmentId, user) {
        const appointment = await this.bookingModel.getAppointmentById(appointmentId);
        
        if (!appointment) throw new Error('NOT_FOUND');
        if (user.role !== 1 && user.userId !== appointment.UserID) throw new Error('FORBIDDEN');
        
        const [result] = await this.pool.query('UPDATE Appointments SET IsDeleted = 1 WHERE AppointmentID = ?', [appointmentId]);
        if (result.affectedRows === 0) throw new Error('UPDATE_FAILED');
        
        return true;
    }

    async createAppointmentPayment(appointmentId, data) {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            const { userId, totalAmount, paymentMethod, status, paymentDetails } = data;
            
            if (!appointmentId || !userId || !totalAmount) throw new Error('MISSING_INFO');
            
            const [appointmentDetails] = await connection.query(`
                SELECT a.MechanicID, a.AppointmentDate, u.FullName as CustomerName,
                    (SELECT GROUP_CONCAT(s.ServiceName SEPARATOR ', ') FROM AppointmentServices aps JOIN Services s ON aps.ServiceID = s.ServiceID WHERE aps.AppointmentID = a.AppointmentID) AS Services,
                    (SELECT FullName FROM Users WHERE UserID = a.MechanicID) AS MechanicName
                FROM Appointments a JOIN Users u ON a.UserID = u.UserID WHERE a.AppointmentID = ?
            `, [appointmentId]);
            
            if (appointmentDetails.length === 0) throw new Error('NOT_FOUND');
            
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
            return { paymentId: paymentResult.insertId, status: paymentStatus };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async cancelAppointment(appointmentId, user) {
        const appointment = await this.bookingModel.getAppointmentById(appointmentId);
        
        if (!appointment) throw new Error('NOT_FOUND');
        if (user.role !== 1 && user.userId !== appointment.UserID) throw new Error('FORBIDDEN');
        if (appointment.Status === 'Completed') throw new Error('COMPLETED_APPOINTMENT');
        
        await this.bookingModel.cancelAppointment(appointmentId);
        return true;
    }

    async getMechanics() {
        return await this.bookingModel.getMechanics();
    }

    async getMyVehicles(userId) {
        return await this.bookingModel.getUserVehicles(userId);
    }

    async getServices() {
        const [services] = await this.pool.query('SELECT * FROM Services');
        services.forEach(service => {
            if (service.ServiceImage && !service.ServiceImage.startsWith('http') && !service.ServiceImage.startsWith('/')) {
                service.ServiceImage = `images/services/${service.ServiceImage}`;
            }
        });
        return services;
    }

    async updateAppointment(appointmentId, user, data) {
        const appointment = await this.bookingModel.getAppointmentById(appointmentId);
        
        if (!appointment) throw new Error('NOT_FOUND');
        if (user.role !== 1 && user.userId !== appointment.UserID) throw new Error('FORBIDDEN');

        const previousStatus = appointment.Status;
        const { status, notes, mechanicId, appointmentDate, services, vehicleId, licensePlate, brand, model, year } = data;
        
        const updateData = { status, notes, mechanicId, appointmentDate, services, vehicleId, licensePlate, brand, model, year };
        await this.bookingModel.updateAppointment(appointmentId, updateData);

        const [updatedAppointments] = await this.pool.query(`
            SELECT a.*, u.FullName, u.Email, u.PhoneNumber, v.LicensePlate, v.Brand, v.Model, v.Year,
                (SELECT GROUP_CONCAT(s.ServiceName SEPARATOR ', ') FROM AppointmentServices aps JOIN Services s ON aps.ServiceID = s.ServiceID WHERE aps.AppointmentID = a.AppointmentID) AS Services
            FROM Appointments a LEFT JOIN Users u ON a.UserID = u.UserID LEFT JOIN Vehicles v ON a.VehicleID = v.VehicleID
            WHERE a.AppointmentID = ?
        `, [appointmentId]);
        const appointmentData = updatedAppointments[0];

        // Notifications
        if (status && status !== previousStatus) {
            try {
                const [mechanicInfo] = await this.pool.query('SELECT FullName FROM Users WHERE UserID = ?', [appointmentData.MechanicID]);
                const [totalAmountInfo] = await this.pool.query(`
                    SELECT SUM(s.Price * aps.Quantity) as TotalAmount FROM AppointmentServices aps JOIN Services s ON aps.ServiceID = s.ServiceID WHERE aps.AppointmentID = ?
                `, [appointmentId]);
                
                const mechanicName = mechanicInfo.length > 0 ? mechanicInfo[0].FullName : null;
                const totalAmount = totalAmountInfo[0]?.TotalAmount || 0;
                
                if (status === 'Confirmed') await this.notificationHelper.notifyBookingConfirmed({ userId: appointmentData.UserID, appointmentId, appointmentDate: appointmentData.AppointmentDate, garage: appointmentData.GarageName || null, mechanicName });
                else if (status === 'InProgress') await this.notificationHelper.notifyServiceInProgress({ userId: appointmentData.UserID, appointmentId, mechanicName });
                else if (status === 'Completed') await this.notificationHelper.notifyServiceCompleted({ userId: appointmentData.UserID, appointmentId, totalAmount, paymentMethod: appointmentData.PaymentMethod });
                else if (status === 'Rejected' || status === 'Canceled') await this.notificationHelper.notifyBookingRejected({ userId: appointmentData.UserID, appointmentId, reason: notes || '', status });
            } catch (notifError) { console.error('❌ Error sending status change notification:', notifError); }
        }

        this.socketService.emitAppointmentUpdated(appointmentData, previousStatus);
        
        return appointmentData;
    }

    async createAppointmentUser(user, data) {
        const { userId, vehicleId, appointmentDate, notes, serviceIds } = data;
        if (!userId || !vehicleId || !appointmentDate || !serviceIds || serviceIds.length === 0) throw new Error('MISSING_INFO');
        if (user.userId !== userId && user.role !== 1) throw new Error('FORBIDDEN');
        
        const connection = await this.pool.getConnection();
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
            
            this.socketService.emitNewAppointment(fullAppointment[0]);
            
            return fullAppointment[0];
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }
}

module.exports = BookingService;
