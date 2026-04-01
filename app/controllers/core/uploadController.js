// File: app/controllers/core/uploadController.js
const cloudinary = require('../../../config/cloudinary');
const { pool } = require('../../../config/db');

/**
 * Helper: Upload buffer ảnh lên Cloudinary
 */
const uploadToCloudinary = async (buffer, folder, filename) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: `suaxe/${folder}`,
                public_id: filename,
                resource_type: 'image',
                transformation: [
                    { width: 800, height: 800, crop: 'limit' },
                    { quality: 'auto' },
                    { fetch_format: 'auto' }
                ]
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        uploadStream.end(buffer);
    });
};

// 1. Upload Avatar cho người dùng
const uploadAvatar = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'Không tìm thấy file' });

        const userId = req.user.userId;
        const filename = `avatar_${userId}_${Date.now()}`;

        const result = await uploadToCloudinary(req.file.buffer, 'avatars', filename);

        await pool.query(
            'UPDATE Users SET AvatarUrl = ?, ProfilePicture = ? WHERE UserID = ?',
            [result.secure_url, result.secure_url, userId]
        );

        res.json({
            success: true,
            message: 'Upload avatar thành công',
            avatarUrl: result.secure_url
        });
    } catch (error) {
        console.error('Upload avatar error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. Upload ảnh dịch vụ (Admin only)
const uploadServiceImage = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'Không tìm thấy file' });
        if (req.user.role !== 1) return res.status(403).json({ success: false, message: 'Chỉ admin được upload' });

        const serviceId = req.params.serviceId;
        const filename = `service_${serviceId}_${Date.now()}`;

        const result = await uploadToCloudinary(req.file.buffer, 'services', filename);

        await pool.query(
            'UPDATE Services SET ServiceImage = ? WHERE ServiceID = ?',
            [result.secure_url, serviceId]
        );

        res.json({
            success: true,
            message: 'Upload service image thành công',
            imageUrl: result.secure_url
        });
    } catch (error) {
        console.error('Upload service error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. Upload ảnh xe
const uploadVehicleImage = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'Không tìm thấy file' });

        const vehicleId = req.params.vehicleId;
        const userId = req.user.userId;

        const [vehicles] = await pool.query('SELECT UserID FROM Vehicles WHERE VehicleID = ?', [vehicleId]);

        if (vehicles.length === 0 || vehicles[0].UserID !== userId) {
            return res.status(403).json({ success: false, message: 'Không có quyền' });
        }

        const filename = `vehicle_${vehicleId}_${Date.now()}`;
        const result = await uploadToCloudinary(req.file.buffer, 'vehicles', filename);

        await pool.query('UPDATE Vehicles SET VehicleImage = ? WHERE VehicleID = ?', [result.secure_url, vehicleId]);

        res.json({
            success: true,
            message: 'Upload vehicle image thành công',
            imageUrl: result.secure_url
        });
    } catch (error) {
        console.error('Upload vehicle error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    uploadAvatar,
    uploadServiceImage,
    uploadVehicleImage
};