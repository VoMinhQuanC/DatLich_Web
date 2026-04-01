// File: app/controllers/profileController.js
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../../../config/db');

// ==========================================
// CẤU HÌNH UPLOAD AVATAR
// ==========================================
let avatarDir;
try {
    if (process.env.NODE_ENV === 'production') {
        avatarDir = '/tmp/avatars';
    } else {
        avatarDir = path.join(__dirname, '../../../Web/images/avatars'); // Lưu ý đã lùi thêm 1 cấp do ở trong controllers
    }

    if (!fs.existsSync(avatarDir)) {
        fs.mkdirSync(avatarDir, { recursive: true });
        console.log('Đã tạo thư mục avatar:', avatarDir);
    }
} catch (err) {
    console.error('Không thể tạo thư mục avatar:', err);
    avatarDir = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(__dirname, '../../');
    console.log('Sử dụng thư mục dự phòng:', avatarDir);
}

const avatarStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, avatarDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ cho phép upload file hình ảnh!'), false);
    }
};

const uploadAvatar = multer({
    storage: avatarStorage,
    fileFilter: fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 } // Giới hạn 2MB
});

// ==========================================
// CÁC HÀM XỬ LÝ LOGIC (CONTROLLERS)
// ==========================================

// 1. Lấy thông tin hồ sơ cá nhân
const getProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        console.log('📋 Getting profile for userId:', userId);
        
        const [users] = await pool.query(
            `SELECT UserID, FullName, Email, PhoneNumber, RoleID, AvatarUrl, Status, CreatedAt FROM Users WHERE UserID = ?`,
            [userId]
        );
        
        if (users.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        
        const user = users[0];
        res.json({
            success: true,
            user: {
                userId: user.UserID,
                fullName: user.FullName,
                email: user.Email,
                phoneNumber: user.PhoneNumber,
                roleId: user.RoleID,
                avatarUrl: user.AvatarUrl,
                status: user.Status,
                createdAt: user.CreatedAt
            }
        });
    } catch (err) {
        console.error('❌ Error getting profile:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 2. Lấy thống kê công việc của kỹ thuật viên
const getMechanicStats = async (req, res) => {
    try {
        const userId = req.user.userId;
        const roleId = req.user.role;
        
        if (roleId !== 3) {
            return res.status(403).json({ success: false, message: 'Chỉ kỹ thuật viên mới có thể xem thống kê' });
        }
        
        const [totalJobsResult] = await pool.query(`SELECT COUNT(*) as count FROM Appointments WHERE MechanicID = ?`, [userId]);
        const [completedJobsResult] = await pool.query(`SELECT COUNT(*) as count FROM Appointments WHERE MechanicID = ? AND Status = 'Completed'`, [userId]);
        
        let averageRating = 4.8; // Mock rating
        try {
            const [ratingResult] = await pool.query(`SELECT AVG(Rating) as avgRating FROM Reviews WHERE MechanicID = ?`, [userId]);
            if (ratingResult[0] && ratingResult[0].avgRating !== null) {
                averageRating = parseFloat(ratingResult[0].avgRating).toFixed(1);
            }
        } catch (err) { console.log('⚠️ Reviews table not found, using mock rating'); }
        
        res.json({
            success: true,
            stats: {
                totalJobs: totalJobsResult[0].count,
                completedJobs: completedJobsResult[0].count,
                rating: parseFloat(averageRating)
            }
        });
    } catch (err) {
        console.error('❌ Error getting stats:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 3. Cập nhật thông tin hồ sơ
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { fullName, phoneNumber } = req.body;
        
        if (!fullName || !phoneNumber) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ thông tin họ tên và số điện thoại' });
        }
        
        await pool.query('UPDATE Users SET FullName = ?, PhoneNumber = ? WHERE UserID = ?', [fullName, phoneNumber, userId]);
        
        res.json({ success: true, message: 'Cập nhật thông tin cá nhân thành công' });
    } catch (err) {
        console.error('Lỗi khi cập nhật thông tin cá nhân:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 4. Đổi mật khẩu
const changePassword = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ mật khẩu hiện tại và mật khẩu mới' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
        }
        
        const [users] = await pool.query('SELECT PasswordHash FROM Users WHERE UserID = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        
        const passwordMatch = await bcrypt.compare(currentPassword, users[0].PasswordHash);
        if (!passwordMatch) return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
        
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        
        await pool.query('UPDATE Users SET PasswordHash = ? WHERE UserID = ?', [hashedPassword, userId]);
        
        res.json({ success: true, message: 'Đổi mật khẩu thành công' });
    } catch (err) {
        console.error('Lỗi khi đổi mật khẩu:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 5. Lấy danh sách xe của user
const getUserVehicles = async (req, res) => {
    try {
        const userId = req.user.userId;
        const [vehicles] = await pool.query('SELECT * FROM Vehicles WHERE UserID = ? ORDER BY CreatedAt DESC', [userId]);
        res.json({ success: true, vehicles });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 6. Lấy chi tiết xe
const getVehicleById = async (req, res) => {
    try {
        const userId = req.user.userId;
        const vehicleId = req.params.id;
        const [vehicles] = await pool.query('SELECT * FROM Vehicles WHERE VehicleID = ?', [vehicleId]);
        
        if (vehicles.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy xe' });
        
        if (vehicles[0].UserID !== userId && req.user.role !== 1) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xem thông tin xe này' });
        }
        res.json({ success: true, vehicle: vehicles[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 7. Thêm xe mới
const createVehicle = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { licensePlate, brand, model, year } = req.body;
        
        if (!licensePlate || !brand || !model) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ thông tin' });
        }
        
        const [existingVehicles] = await pool.query('SELECT * FROM Vehicles WHERE LicensePlate = ?', [licensePlate]);
        if (existingVehicles.length > 0) return res.status(400).json({ success: false, message: 'Biển số xe đã tồn tại' });
        
        const [result] = await pool.query(
            'INSERT INTO Vehicles (UserID, LicensePlate, Brand, Model, Year) VALUES (?, ?, ?, ?, ?)',
            [userId, licensePlate, brand, model, year || null]
        );
        res.status(201).json({ success: true, message: 'Thêm xe mới thành công', vehicleId: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 8. Cập nhật xe
const updateVehicle = async (req, res) => {
    try {
        const userId = req.user.userId;
        const vehicleId = req.params.id;
        const { licensePlate, brand, model, year } = req.body;
        
        const [existingVehicles] = await pool.query('SELECT * FROM Vehicles WHERE VehicleID = ?', [vehicleId]);
        if (existingVehicles.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy xe' });
        
        if (existingVehicles[0].UserID !== userId) return res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật' });
        
        if (licensePlate !== existingVehicles[0].LicensePlate) {
            const [duplicateCheck] = await pool.query('SELECT * FROM Vehicles WHERE LicensePlate = ? AND VehicleID != ?', [licensePlate, vehicleId]);
            if (duplicateCheck.length > 0) return res.status(400).json({ success: false, message: 'Biển số xe đã tồn tại' });
        }
        
        await pool.query(
            'UPDATE Vehicles SET LicensePlate = ?, Brand = ?, Model = ?, Year = ? WHERE VehicleID = ?',
            [licensePlate, brand, model, year || null, vehicleId]
        );
        res.json({ success: true, message: 'Cập nhật thông tin xe thành công' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 9. Xóa xe
const deleteVehicle = async (req, res) => {
    try {
        const userId = req.user.userId;
        const vehicleId = req.params.id;
        
        const [existingVehicles] = await pool.query('SELECT * FROM Vehicles WHERE VehicleID = ?', [vehicleId]);
        if (existingVehicles.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy xe' });
        if (existingVehicles[0].UserID !== userId) return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa xe này' });
        
        const [appointments] = await pool.query('SELECT * FROM Appointments WHERE VehicleID = ? AND Status != "Canceled"', [vehicleId]);
        if (appointments.length > 0) return res.status(400).json({ success: false, message: 'Không thể xóa xe đang được sử dụng trong lịch hẹn' });
        
        await pool.query('DELETE FROM Vehicles WHERE VehicleID = ?', [vehicleId]);
        res.json({ success: true, message: 'Xóa xe thành công' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

module.exports = {
    uploadAvatar,
    getProfile,
    getMechanicStats,
    updateProfile,
    changePassword,
    getUserVehicles,
    getVehicleById,
    createVehicle,
    updateVehicle,
    deleteVehicle
};