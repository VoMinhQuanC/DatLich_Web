// File: app/routes/core/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../../controllers/core/paymentController');

// API lấy QR Code - không cần authenticateToken nếu bạn muốn khách xem nhanh, 
// hoặc thêm vào nếu muốn bảo mật
router.get('/qr/:appointmentId', paymentController.generatePaymentQR);

module.exports = router;