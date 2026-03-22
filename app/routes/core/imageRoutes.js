// File: app/routes/core/imageRoutes.js
const express = require('express');
const router = express.Router();
const imageController = require('../../controllers/core/imageController');
const { authenticateToken } = require('../auth/authRoutes');

// API Upload Avatar
router.post('/upload-avatar', authenticateToken, imageController.upload.single('avatar'), imageController.uploadAvatar);

// API Upload Ảnh Dịch vụ (Admin)
router.post('/upload/service/:id', 
    authenticateToken, 
    imageController.checkServiceBeforeUpload, 
    imageController.upload.single('image'), 
    imageController.uploadServiceImage
);

// Khởi tạo thư mục
router.get('/init-directories', imageController.initDirectories);

// Kiểm tra trạng thái
router.get('/check', (req, res) => res.json({ success: true, message: 'Image API OK' }));

module.exports = router;