// File: app/routes/core/uploadRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadController = require('../../controllers/core/uploadController');
const { authenticateToken } = require('../auth/authRoutes');

// Cấu hình multer lưu vào RAM tạm thời
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Chỉ chấp nhận file hình ảnh!'), false);
        }
        cb(null, true);
    }
});

// Định tuyến API Upload
router.post('/avatar', authenticateToken, upload.single('avatar'), uploadController.uploadAvatar);
router.post('/service/:serviceId', authenticateToken, upload.single('image'), uploadController.uploadServiceImage);
router.post('/vehicle/:vehicleId', authenticateToken, upload.single('image'), uploadController.uploadVehicleImage);

module.exports = router;