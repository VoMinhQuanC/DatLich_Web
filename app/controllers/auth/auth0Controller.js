// File: app/controllers/auth/auth0Controller.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { pool } = require('../../../config/db');
const auth0Config = require('../../../config/auth0Config');

const JWT_SECRET = process.env.JWT_SECRET || 'sua_xe_secret_key';

// 1. Xử lý Callback sau khi Google/Auth0 xác thực thành công
const handleAuth0Callback = async (req, res) => {
    try {
        if (!req.user) return res.redirect('/login?error=no_user');

        const auth0Id = req.user.id;
        let email = null;
        
        if (req.user.emails && req.user.emails.length > 0) {
            email = req.user.emails[0].value;
        } else if (req.user._json && req.user._json.email) {
            email = req.user._json.email;
        }

        const name = req.user.displayName || 
                    (req.user.name ? `${req.user.name.givenName} ${req.user.name.familyName}` : 'Người dùng mới');
        
        let picture = null;
        if (req.user.photos && req.user.photos.length > 0) {
            picture = req.user.photos[0].value;
        } else if (req.user._json && req.user._json.picture) {
            picture = req.user._json.picture;
        }
        
        if (!email) return res.redirect('/login?error=no_email');

        const provider = req.user.provider || 
                        (req.user._json && req.user._json.sub && req.user._json.sub.includes('google') ? 'google' : 'auth0');

        // Kiểm tra user trong DB
        const [users] = await pool.query('SELECT * FROM Users WHERE Email = ?', [email]);
        let userId, userRole, userName, userPhone;

        if (users.length === 0) {
            const randomPassword = Math.random().toString(36).substring(2, 15);
            const hashedPassword = await bcrypt.hash(randomPassword, 10);
            
            const [result] = await pool.query(
                'INSERT INTO Users (FullName, Email, PhoneNumber, PasswordHash, RoleID, Auth0ID, AvatarUrl, Provider) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [name, email, '', hashedPassword, 2, auth0Id, picture, provider]
            );
            userId = result.insertId;
            userRole = 2;
            userName = name;
            userPhone = '';
        } else {
            userId = users[0].UserID;
            userRole = users[0].RoleID;
            userName = users[0].FullName;
            userPhone = users[0].PhoneNumber || '';
            
            if (!users[0].Auth0ID || !users[0].Provider) {
                await pool.query(
                    'UPDATE Users SET Auth0ID = ?, Provider = ?, AvatarUrl = ? WHERE UserID = ?',
                    [auth0Id, provider, picture || users[0].AvatarUrl, userId]
                );
            }
        }

        const token = jwt.sign({ userId, email, role: userRole }, JWT_SECRET, { expiresIn: '24h' });

        const userInfo = { id: userId, fullName: userName, email, phoneNumber: userPhone, role: userRole, avatarUrl: picture };

        res.redirect(`/auth-success?token=${token}&user=${encodeURIComponent(JSON.stringify(userInfo))}`);
    } catch (error) {
        console.error('Auth0 Callback Error:', error);
        res.redirect('/login?error=auth_error&message=' + encodeURIComponent(error.message));
    }
};

// 2. Đăng xuất
const logout = (req, res) => {
    req.logout(function(err) {
        if (err) return res.redirect('/'); 
        req.session.destroy();
        const baseURL = 'http://localhost:3001';
        const returnTo = encodeURIComponent(`${baseURL}/login`);
        const domain = process.env.AUTH0_DOMAIN || 'suaxenhanh.us.auth0.com';
        const clientId = process.env.AUTH0_CLIENT_ID || 'fuxcsqHDZ09CcqXWqPHy2SdLmqb0Qetv';
        res.redirect(`https://${domain}/v2/logout?client_id=${clientId}&returnTo=${returnTo}`);
    });
};

// 3. Lấy profile (Test)
const getProfile = (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ success: true, user: req.user });
    } else {
        res.status(401).json({ success: false, message: 'Không có thông tin xác thực' });
    }
};

module.exports = {
    handleAuth0Callback,
    logout,
    getProfile
};