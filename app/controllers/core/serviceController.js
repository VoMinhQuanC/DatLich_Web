// File: app/controllers/core/serviceController.js
const { pool } = require('../../../config/db');

// Middleware kiểm tra quyền admin
const checkAdminAccess = (req, res, next) => {
    if (req.user && req.user.role === 1) {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: 'Không có quyền truy cập. Yêu cầu quyền admin.'
    });
};

// 1. Lấy tất cả dịch vụ
const getAllServices = async (req, res) => {
    try {
        const [services] = await pool.query('SELECT * FROM Services ORDER BY ServiceID DESC');
        res.json({ success: true, services: services });
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// 2. Lấy dịch vụ theo ID
const getServiceById = async (req, res) => {
    try {
        const [services] = await pool.query('SELECT * FROM Services WHERE ServiceID = ?', [req.params.id]);
        if (services.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ' });
        }
        res.json({ success: true, service: services[0] });
    } catch (error) {
        console.error('Error fetching service:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// 3. Tạo dịch vụ mới (Admin)
const createService = async (req, res) => {
    try {
        const { ServiceName, Description, Price, EstimatedTime, ServiceImage } = req.body;
        
        if (!ServiceName || !Price) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
        }
        
        const [result] = await pool.query(
            'INSERT INTO Services (ServiceName, Description, Price, EstimatedTime, ServiceImage) VALUES (?, ?, ?, ?, ?)',
            [ServiceName, Description || null, Price, EstimatedTime || 0, ServiceImage || null]
        );
        
        res.json({ success: true, message: 'Tạo dịch vụ thành công', serviceId: result.insertId });
    } catch (error) {
        console.error('Error creating service:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// 4. Cập nhật dịch vụ (Admin)
const updateService = async (req, res) => {
    try {
        const serviceId = req.params.id;
        const { ServiceName, Description, Price, EstimatedTime, ServiceImage } = req.body;
        
        const [existing] = await pool.query('SELECT * FROM Services WHERE ServiceID = ?', [serviceId]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ' });
        }
        
        if (!ServiceName || !Price) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
        }
        
        await pool.query(
            'UPDATE Services SET ServiceName = ?, Description = ?, Price = ?, EstimatedTime = ?, ServiceImage = ? WHERE ServiceID = ?',
            [ServiceName, Description || null, Price, EstimatedTime || 0, ServiceImage || existing[0].ServiceImage, serviceId]
        );
        
        res.json({ success: true, message: 'Cập nhật dịch vụ thành công' });
    } catch (error) {
        console.error('Error updating service:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// 5. Xóa dịch vụ (Admin)
const deleteService = async (req, res) => {
    try {
        const serviceId = req.params.id;
        
        const [existing] = await pool.query('SELECT * FROM Services WHERE ServiceID = ?', [serviceId]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy dịch vụ' });
        }
        
        await pool.query('DELETE FROM Services WHERE ServiceID = ?', [serviceId]);
        res.json({ success: true, message: 'Xóa dịch vụ thành công' });
    } catch (error) {
        console.error('Error deleting service:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    checkAdminAccess,
    getAllServices,
    getServiceById,
    createService,
    updateService,
    deleteService
};