// File: app/routes/core/serviceRoutes.js
const express = require('express');
const router = express.Router();

// Nhúng Controller
const serviceController = require('../../controllers/core/serviceController');
// Nhúng Middleware xác thực
const { authenticateToken } = require('../auth/authRoutes');

// Định tuyến API Dịch Vụ
router.get('/', serviceController.getAllServices);
router.get('/:id', serviceController.getServiceById);
router.post('/', authenticateToken, serviceController.checkAdminAccess, serviceController.createService);
router.put('/:id', authenticateToken, serviceController.checkAdminAccess, serviceController.updateService);
router.delete('/:id', authenticateToken, serviceController.checkAdminAccess, serviceController.deleteService);

module.exports = router;