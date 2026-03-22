// File: app/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../../../config/db');
// Khóa bí mật
const JWT_SECRET = process.env.JWT_SECRET || 'sua_xe_secret_key';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || "admin123456"; 

// 1. Hàm Đăng ký
const register = async (req, res) => {
    try {
        const { fullName, email, phone, password, role, adminKey } = req.body;

        if (!fullName || !email || !password || !phone) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin' });
        }

        const [existingUsers] = await pool.query('SELECT * FROM Users WHERE Email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ success: false, message: 'Email đã được sử dụng' });
        }

        let userRole = 2; // Mặc định khách hàng
        
        if (role === 1) {
            if (!adminKey || adminKey !== ADMIN_SECRET_KEY) {
                return res.status(403).json({ success: false, message: 'Mã xác thực Admin không hợp lệ' });
            }
            userRole = 1;
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const [result] = await pool.query(
            'INSERT INTO Users (FullName, Email, PhoneNumber, PasswordHash, RoleID) VALUES (?, ?, ?, ?, ?)',
            [fullName, email, phone, hashedPassword, userRole]
        );

        res.status(201).json({ 
            success: true, 
            message: userRole === 1 ? 'Đăng ký tài khoản Admin thành công' : 'Đăng ký thành công' 
        });
    } catch (error) {
        console.error('Lỗi khi đăng ký:', error);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    }
};

// 2. Hàm Đăng nhập
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập email và mật khẩu' });
        }

        const [users] = await pool.query('SELECT * FROM Users WHERE Email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
        }

        const user = users[0];

        const passwordMatch = await bcrypt.compare(password, user.PasswordHash);
        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng' });
        }
        
        const token = jwt.sign(
            { userId: user.UserID, email: user.Email, role: user.RoleID }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );

        const userResponse = {
            id: user.UserID,
            fullName: user.FullName,
            name: user.FullName,
            FullName: user.FullName,
            email: user.Email,
            phone: user.PhoneNumber,
            role: user.RoleID,
            avatarUrl: user.AvatarUrl || user.ProfilePicture
        };

        if (user.RoleID === 3) {
            try {
                const [mechanicInfoRows] = await pool.query('SELECT * FROM MechanicInfo WHERE UserID = ?', [user.UserID]);
                if (mechanicInfoRows.length > 0) {
                    userResponse.mechanicInfo = {
                        mechanicId: mechanicInfoRows[0].MechanicID,
                        specialization: mechanicInfoRows[0].Specialization,
                        experience: mechanicInfoRows[0].Experience
                    };
                }
                
                const [reviewStats] = await pool.query('SELECT AVG(Rating) as averageRating, COUNT(*) as reviewCount FROM MechanicReviews WHERE MechanicID = ?', [user.UserID]);
                const [appointmentStats] = await pool.query('SELECT COUNT(*) as total, SUM(CASE WHEN Status = "Completed" THEN 1 ELSE 0 END) as completed FROM Appointments WHERE MechanicID = ?', [user.UserID]);
                
                userResponse.stats = {
                    averageRating: reviewStats[0].averageRating || 0,
                    reviewCount: reviewStats[0].reviewCount || 0,
                    totalAppointments: appointmentStats[0].total || 0,
                    completedAppointments: appointmentStats[0].completed || 0
                };
            } catch (error) {
                console.error('Lỗi khi lấy thông tin kỹ thuật viên:', error);
            }
        }

        res.json({ success: true, message: 'Đăng nhập thành công', token: token, user: userResponse });
    } catch (error) {
        console.error('Lỗi khi đăng nhập:', error);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    }
};

// 3. Middleware xác thực Token (CỰC KỲ QUAN TRỌNG)
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ success: false, message: 'Không có token xác thực' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
        req.user = user;
        next();
    });
};

// 4. Hàm kiểm tra xác thực
const checkAuth = (req, res) => {
    try {
        res.json({
            success: true,
            user: { userId: req.user.userId, email: req.user.email, role: req.user.role }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    }
};

// 5. Hàm lấy thông tin cá nhân
const getMe = async (req, res) => {
    try {
        const [users] = await pool.query(
            'SELECT UserID, FullName, Email, PhoneNumber, RoleID, ProfilePicture, AvatarUrl, Status, CreatedAt FROM Users WHERE UserID = ?', 
            [req.user.userId]
        );
        
        if (users.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin người dùng' });

        const userData = users[0];

        if (userData.RoleID === 3) {
            try {
                const [mechanicInfoRows] = await pool.query('SELECT * FROM MechanicInfo WHERE UserID = ?', [userData.UserID]);
                if (mechanicInfoRows.length > 0) {
                    userData.mechanicInfo = {
                        mechanicId: mechanicInfoRows[0].MechanicID,
                        specialization: mechanicInfoRows[0].Specialization,
                        experience: mechanicInfoRows[0].Experience
                    };
                }
                
                const [reviewStats] = await pool.query('SELECT AVG(Rating) as averageRating, COUNT(*) as reviewCount FROM MechanicReviews WHERE MechanicID = ?', [userData.UserID]);
                const [appointmentStats] = await pool.query('SELECT COUNT(*) as total, SUM(CASE WHEN Status = "Completed" THEN 1 ELSE 0 END) as completed FROM Appointments WHERE MechanicID = ?', [userData.UserID]);
                
                userData.stats = {
                    averageRating: reviewStats[0].averageRating || 0,
                    reviewCount: reviewStats[0].reviewCount || 0,
                    totalAppointments: appointmentStats[0].total || 0,
                    completedAppointments: appointmentStats[0].completed || 0
                };
            } catch (error) {
                console.error('Lỗi khi lấy thông tin kỹ thuật viên:', error);
            }
        }

        res.json({ success: true, user: userData });
    } catch (error) {
        console.error('Lỗi khi lấy thông tin người dùng:', error);
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    }
};

// Xuất các hàm
module.exports = {
    register,
    login,
    authenticateToken,
    checkAuth,
    getMe
};