// File: app/controllers/userController.js
const bcrypt = require('bcrypt');
const { pool } = require('../../../config/db');

// Middleware kiểm tra quyền admin
const checkAdminAccess = (req, res, next) => {
    if (req.user.role !== 1) {
        return res.status(403).json({
            success: false,
            message: 'Không có quyền truy cập. Yêu cầu quyền admin.'
        });
    }
    next();
};

// 1. Thống kê người dùng
const getUserStats = async (req, res) => {
    try {
        const [totalUsersRow] = await pool.query('SELECT COUNT(*) as count FROM Users');
        const [totalCustomersRow] = await pool.query('SELECT COUNT(*) as count FROM Users WHERE RoleID = 2');
        const [totalMechanicsRow] = await pool.query('SELECT COUNT(*) as count FROM Users WHERE RoleID = 3');
        const [totalAdminsRow] = await pool.query('SELECT COUNT(*) as count FROM Users WHERE RoleID = 1');
        
        res.json({
            success: true,
            stats: {
                totalUsers: totalUsersRow[0].count,
                totalCustomers: totalCustomersRow[0].count,
                totalMechanics: totalMechanicsRow[0].count,
                totalAdmins: totalAdminsRow[0].count
            }
        });
    } catch (err) {
        console.error('Lỗi khi lấy thống kê người dùng:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 2. Lấy danh sách người dùng (có lọc và tìm kiếm)
const getAllUsers = async (req, res) => {
    try {
        const { role, status, search } = req.query;
        let query = 'SELECT UserID, FullName, Email, PhoneNumber, RoleID, Status, CreatedAt FROM Users';
        let queryParams = [];
        let conditions = [];
        
        if (role) {
            conditions.push('RoleID = ?');
            queryParams.push(role);
        }
        if (status) {
            conditions.push('Status = ?');
            queryParams.push(status);
        }
        if (search) {
            conditions.push('(FullName LIKE ? OR Email LIKE ? OR PhoneNumber LIKE ?)');
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
        }
        
        if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
        query += ' ORDER BY CreatedAt DESC';
        
        const [users] = await pool.query(query, queryParams);
        res.json({ success: true, users });
    } catch (err) {
        console.error('Lỗi khi lấy danh sách người dùng:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 3. Lấy thông tin chi tiết người dùng
const getUserById = async (req, res) => {
    try {
        const userId = req.params.id;
        if (req.user.role !== 1 && req.user.userId !== parseInt(userId)) {
            return res.status(403).json({ success: false, message: 'Không có quyền truy cập thông tin người dùng này' });
        }
        
        const [users] = await pool.query('SELECT UserID, FullName, Email, PhoneNumber, RoleID, Status, CreatedAt FROM Users WHERE UserID = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        
        const user = users[0];
        if (user.RoleID === 3) {
            const [mechanicInfo] = await pool.query('SELECT MechanicName FROM MechanicInfo WHERE UserID = ?', [userId]);
            if (mechanicInfo.length > 0) user.MechanicName = mechanicInfo[0].MechanicName || '';
        }
        
        res.json({ success: true, user });
    } catch (err) {
        console.error('Lỗi khi lấy thông tin người dùng:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 4. Thêm người dùng mới
const createUser = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { fullName, email, phone, password, role, status, adminKey } = req.body;
        
        if (!fullName || !email || !phone || !password || !role) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ thông tin' });
        }
        
        const [existingUsers] = await connection.query('SELECT * FROM Users WHERE Email = ?', [email]);
        if (existingUsers.length > 0) return res.status(400).json({ success: false, message: 'Email đã được sử dụng' });
        
        const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || "admin123456";
        if (role === 1 && (!adminKey || adminKey !== ADMIN_SECRET_KEY)) {
            return res.status(403).json({ success: false, message: 'Mã xác thực Admin không hợp lệ' });
        }
        
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        const [result] = await connection.query(
            'INSERT INTO Users (FullName, Email, PhoneNumber, PasswordHash, RoleID, Status) VALUES (?, ?, ?, ?, ?, ?)',
            [fullName, email, phone, hashedPassword, role, status || 1]
        );
        
        const userId = result.insertId;
        if (role === 3) {
            await connection.query('INSERT INTO MechanicInfo (UserID, MechanicName) VALUES (?, ?)', [userId, fullName]);
        }
        
        await connection.commit();
        res.status(201).json({ success: true, message: 'Thêm người dùng thành công', userId });
    } catch (err) {
        await connection.rollback();
        console.error('Lỗi khi thêm người dùng:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    } finally {
        connection.release();
    }
};

// 5. Cập nhật thông tin người dùng
const updateUser = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const userId = req.params.id;
        const { fullName, email, phone, password, role, status } = req.body;
        
        const [existingUser] = await connection.query('SELECT * FROM Users WHERE UserID = ?', [userId]);
        if (existingUser.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        
        if (email !== existingUser[0].Email) {
            const [emailCheck] = await connection.query('SELECT * FROM Users WHERE Email = ? AND UserID != ?', [email, userId]);
            if (emailCheck.length > 0) return res.status(400).json({ success: false, message: 'Email đã được sử dụng bởi người dùng khác' });
        }
        
        await connection.query(
            'UPDATE Users SET FullName = ?, Email = ?, PhoneNumber = ?, RoleID = ?, Status = ? WHERE UserID = ?',
            [fullName, email, phone, role, status || existingUser[0].Status, userId]
        );
        
        if (password) {
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            await connection.query('UPDATE Users SET PasswordHash = ? WHERE UserID = ?', [hashedPassword, userId]);
        }
        
        if (role === 3) {
            const [mechanicInfoCheck] = await connection.query('SELECT * FROM MechanicInfo WHERE UserID = ?', [userId]);
            if (mechanicInfoCheck.length > 0) {
                await connection.query('UPDATE MechanicInfo SET MechanicName = ? WHERE UserID = ?', [fullName, userId]);
            } else {
                await connection.query('INSERT INTO MechanicInfo (UserID, MechanicName) VALUES (?, ?)', [userId, fullName]);
            }
        }
        
        await connection.commit();
        res.json({ success: true, message: 'Cập nhật thông tin người dùng thành công' });
    } catch (err) {
        await connection.rollback();
        console.error('Lỗi khi cập nhật thông tin người dùng:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    } finally {
        connection.release();
    }
};

// 6. Đổi mật khẩu
const changePassword = async (req, res) => {
    try {
        const userId = req.params.id;
        const { newPassword } = req.body;
        if (!newPassword) return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mật khẩu mới' });
        
        const [existingUser] = await pool.query('SELECT * FROM Users WHERE UserID = ?', [userId]);
        if (existingUser.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        await pool.query('UPDATE Users SET PasswordHash = ? WHERE UserID = ?', [hashedPassword, userId]);
        
        res.json({ success: true, message: 'Đổi mật khẩu thành công' });
    } catch (err) {
        console.error('Lỗi khi đổi mật khẩu:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 6.5 Đổi mật khẩu của cá nhân trên Profile
const changeOwnPassword = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mật khẩu đang dùng và mật khẩu mới' });
        }
        
        const [users] = await pool.query('SELECT * FROM Users WHERE UserID = ?', [userId]);
        if (users.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin người dùng' });
        
        const passwordMatch = await bcrypt.compare(currentPassword, users[0].PasswordHash);
        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
        }
        
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        await pool.query('UPDATE Users SET PasswordHash = ? WHERE UserID = ?', [hashedPassword, userId]);
        
        res.json({ success: true, message: 'Đổi mật khẩu thành công' });
    } catch (err) {
        console.error('Lỗi khi đổi mật khẩu cá nhân:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
};

// 7. Xóa người dùng
const deleteUser = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const userId = req.params.id;
        
        const [existingUser] = await connection.query('SELECT * FROM Users WHERE UserID = ?', [userId]);
        if (existingUser.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        
        if (existingUser[0].RoleID === 1) {
            const [adminCount] = await connection.query('SELECT COUNT(*) as count FROM Users WHERE RoleID = 1');
            if (adminCount[0].count <= 1) return res.status(400).json({ success: false, message: 'Không thể xóa tài khoản admin cuối cùng trong hệ thống' });
        }
        
        if (existingUser[0].RoleID === 3) await connection.query('DELETE FROM MechanicInfo WHERE UserID = ?', [userId]);
        await connection.query('DELETE FROM Vehicles WHERE UserID = ?', [userId]);
        await connection.query('UPDATE Appointments SET Status = "Canceled" WHERE UserID = ?', [userId]);
        await connection.query('DELETE FROM Users WHERE UserID = ?', [userId]);
        
        await connection.commit();
        res.json({ success: true, message: 'Xóa người dùng thành công' });
    } catch (err) {
        await connection.rollback();
        console.error('Lỗi khi xóa người dùng:', err);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    } finally {
        connection.release();
    }
};

module.exports = {
    checkAdminAccess,
    getUserStats,
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    changePassword,
    changeOwnPassword,
    deleteUser
};