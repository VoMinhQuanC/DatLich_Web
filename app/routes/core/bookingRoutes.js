// File: app/routes/core/bookingRoutes.js
const express = require('express');
const router = express.Router();

// 1. GỌI CÁC DEPENDENCIES CẦN THIẾT
const { pool } = require('../../../config/db');
const BookingModel = require('../../models/Booking');
const notificationHelper = require('../../utils/notificationHelper');
const socketService = require('../../../socket-service');

// 2. GỌI SERVICE & CONTROLLER CLASSES
const BookingService = require('../../services/core/BookingService');
const BookingController = require('../../controllers/core/bookingController'); // tên file vẫn là bookingController.js

// 3. COMPOSITION ROOT: KHỞI TẠO VÀ INJECT DEPENDENCIES
const bookingService = new BookingService(pool, BookingModel, notificationHelper, socketService);
const bookingController = new BookingController(bookingService);

// 4. GỌI MIDDLEWARE XÁC THỰC
const { authenticateToken } = require('../auth/authRoutes');

// =====================================
// API DÀNH CHO ADMIN
// =====================================
router.get('/appointments', authenticateToken, bookingController.getAllAppointments);
router.get('/admin/deleted-appointments', authenticateToken, bookingController.getDeletedAppointments);
router.post('/admin/appointments/:id/restore', authenticateToken, bookingController.restoreAppointment);
router.get('/admin/dashboard', authenticateToken, bookingController.getAdminDashboard);

// =====================================
// API DÀNH CHO NGƯỜI DÙNG CHUNG
// =====================================
router.get('/my-appointments', authenticateToken, bookingController.getMyAppointments);
router.get('/my-vehicles', authenticateToken, bookingController.getMyVehicles);
router.get('/mechanics', authenticateToken, bookingController.getMechanics);
router.get('/services', bookingController.getServices); // Không cần token (để hiển thị danh sách)
router.get('/available-slots', bookingController.getAvailableSlots); 

// =====================================
// API TƯƠNG TÁC VỚI LỊCH HẸN (CRUD & PAYMENTS)
// =====================================
router.get('/appointments/:id', authenticateToken, bookingController.getAppointmentById);
router.post('/appointments', authenticateToken, bookingController.createAppointment);
router.put('/appointments/:id', authenticateToken, bookingController.updateAppointment);
router.delete('/appointments/:id/delete', authenticateToken, bookingController.deleteAppointmentSoft);
router.post('/appointments/:id/cancel', authenticateToken, bookingController.cancelAppointment);
router.post('/appointments/:id/payment', authenticateToken, bookingController.createAppointmentPayment);

// =====================================
// CÁC ENDPOINT KHÁC
// =====================================
router.post('/create', authenticateToken, bookingController.createAppointmentUser);
router.post('/payments/create', authenticateToken, bookingController.createPayment);

module.exports = router;