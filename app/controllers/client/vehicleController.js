// File: app/controllers/vehicleController.js
const { pool } = require('../../../config/db'); // Lấy kết nối DB của bạn

// 1. Lấy tất cả xe của user
const getUserVehicles = async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // Kiểm tra quyền
        if (req.user.userId != userId && req.user.role !== 1) {
            return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
        }
        
        const [vehicles] = await pool.query(
            'SELECT * FROM Vehicles WHERE UserID = ? ORDER BY CreatedAt DESC',
            [userId]
        );
        
        res.json({ success: true, data: vehicles, vehicles: vehicles });
    } catch (error) {
        console.error('Error fetching user vehicles:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. Lấy thông tin xe theo ID
const getVehicleById = async (req, res) => {
    try {
        const vehicleId = req.params.id;
        
        const [vehicles] = await pool.query('SELECT * FROM Vehicles WHERE VehicleID = ?', [vehicleId]);
        
        if (vehicles.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy xe' });
        }
        
        const vehicle = vehicles[0];
        
        // Kiểm tra quyền
        if (req.user.userId != vehicle.UserID && req.user.role !== 1) {
            return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
        }
        
        res.json({ success: true, data: vehicle, vehicle: vehicle });
    } catch (error) {
        console.error('Error fetching vehicle:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. Tạo xe mới
const createVehicle = async (req, res) => {
    try {
        const { userId, licensePlate, brand, model, year } = req.body;
        
        if (!userId || !licensePlate) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc (userId, licensePlate)' });
        }
        
        if (req.user.userId != userId && req.user.role !== 1) {
            return res.status(403).json({ success: false, message: 'Không có quyền tạo xe cho user khác' });
        }
        
        const [existing] = await pool.query(
            'SELECT * FROM Vehicles WHERE UserID = ? AND LicensePlate = ?',
            [userId, licensePlate]
        );
        
        if (existing.length > 0) {
            return res.json({ success: true, message: 'Xe đã tồn tại', data: existing[0], id: existing[0].VehicleID });
        }
        
        const [result] = await pool.query(
            'INSERT INTO Vehicles (UserID, LicensePlate, Brand, Model, Year, CreatedAt) VALUES (?, ?, ?, ?, ?, NOW())',
            [userId, licensePlate, brand || null, model || null, year || null]
        );
        
        const [newVehicle] = await pool.query('SELECT * FROM Vehicles WHERE VehicleID = ?', [result.insertId]);
        
        res.status(201).json({ success: true, message: 'Tạo xe mới thành công', data: newVehicle[0], id: result.insertId });
    } catch (error) {
        console.error('Error creating vehicle:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// 4. Cập nhật thông tin xe
const updateVehicle = async (req, res) => {
    try {
        const vehicleId = req.params.id;
        const { licensePlate, brand, model, year } = req.body;
        
        const [existing] = await pool.query('SELECT * FROM Vehicles WHERE VehicleID = ?', [vehicleId]);
        
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy xe' });
        }
        
        const vehicle = existing[0];
        
        if (req.user.userId != vehicle.UserID && req.user.role !== 1) {
            return res.status(403).json({ success: false, message: 'Không có quyền cập nhật xe này' });
        }
        
        await pool.query(
            'UPDATE Vehicles SET LicensePlate = ?, Brand = ?, Model = ?, Year = ? WHERE VehicleID = ?',
            [licensePlate || vehicle.LicensePlate, brand || vehicle.Brand, model || vehicle.Model, year || vehicle.Year, vehicleId]
        );
        
        const [updated] = await pool.query('SELECT * FROM Vehicles WHERE VehicleID = ?', [vehicleId]);
        
        res.json({ success: true, message: 'Cập nhật xe thành công', data: updated[0] });
    } catch (error) {
        console.error('Error updating vehicle:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// 5. Xóa xe
const deleteVehicle = async (req, res) => {
    try {
        const vehicleId = req.params.id;
        
        const [existing] = await pool.query('SELECT * FROM Vehicles WHERE VehicleID = ?', [vehicleId]);
        
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy xe' });
        }
        
        const vehicle = existing[0];
        
        if (req.user.userId != vehicle.UserID && req.user.role !== 1) {
            return res.status(403).json({ success: false, message: 'Không có quyền xóa xe này' });
        }
        
        // Xịn: Kiểm tra xe có đang được dùng trong appointment không
        const [appointments] = await pool.query(
            'SELECT COUNT(*) as count FROM Appointments WHERE VehicleID = ?',
            [vehicleId]
        );
        
        if (appointments[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa xe đang có lịch hẹn. Vui lòng xóa các lịch hẹn trước.'
            });
        }
        
        await pool.query('DELETE FROM Vehicles WHERE VehicleID = ?', [vehicleId]);
        
        res.json({ success: true, message: 'Xóa xe thành công' });
    } catch (error) {
        console.error('Error deleting vehicle:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Xuất các hàm ra ngoài
module.exports = {
    getUserVehicles,
    getVehicleById,
    createVehicle,
    updateVehicle,
    deleteVehicle
};