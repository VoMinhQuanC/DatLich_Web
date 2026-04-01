// File: app/routes/vehicleRoutes.js
const express = require('express');
const router = express.Router();

// Lấy middleware check token
const { authenticateToken } = require('../auth/authRoutes');

// Import Controller
const vehicleController = require('../../controllers/client/vehicleController');

/**
 * Các đường dẫn cho Vehicle API
 * Gốc: /api/vehicles
 */
router.get('/user', authenticateToken, vehicleController.getUserVehicles);
router.get('/user/:userId', authenticateToken, vehicleController.getUserVehicles);
router.get('/:id', authenticateToken, vehicleController.getVehicleById);
router.post('/', authenticateToken, vehicleController.createVehicle);
router.put('/:id', authenticateToken, vehicleController.updateVehicle);
router.delete('/:id', authenticateToken, vehicleController.deleteVehicle);

module.exports = router;