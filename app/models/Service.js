// File: app/models/Service.js
const { pool } = require('../../config/db');

class Service {
    // 1. Lấy danh sách tất cả dịch vụ
    static async getAllServices() {
        try {
            const [rows] = await pool.query('SELECT * FROM Services ORDER BY ServiceID DESC');
            return rows;
        } catch (err) {
            throw err;
        }
    }

    // 2. Lấy dịch vụ theo ID
    static async getServiceById(serviceId) {
        try {
            const [rows] = await pool.query('SELECT * FROM Services WHERE ServiceID = ?', [serviceId]);
            return rows[0];
        } catch (err) {
            throw err;
        }
    }

    // 3. Thêm dịch vụ mới (Cập nhật đầy đủ các trường)
    static async addService(data) {
        try {
            const { ServiceName, Description, Price, EstimatedTime, ServiceImage } = data;
            const [result] = await pool.query(
                'INSERT INTO Services (ServiceName, Description, Price, EstimatedTime, ServiceImage) VALUES (?, ?, ?, ?, ?)', 
                [ServiceName, Description, Price, EstimatedTime, ServiceImage]
            );
            return result;
        } catch (err) {
            throw err;
        }
    }

    // 4. Cập nhật dịch vụ
    static async updateService(id, data) {
        try {
            const { ServiceName, Description, Price, EstimatedTime, ServiceImage } = data;
            const [result] = await pool.query(
                'UPDATE Services SET ServiceName = ?, Description = ?, Price = ?, EstimatedTime = ?, ServiceImage = ? WHERE ServiceID = ?', 
                [ServiceName, Description, Price, EstimatedTime, ServiceImage, id]
            );
            return result;
        } catch (err) {
            throw err;
        }
    }

    // 5. Xóa dịch vụ
    static async deleteService(id) {
        try {
            const [result] = await pool.query('DELETE FROM Services WHERE ServiceID = ?', [id]);
            return result;
        } catch (err) {
            throw err;
        }
    }
}

module.exports = Service;