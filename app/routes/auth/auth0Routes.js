// File: app/routes/auth/auth0Routes.js
const express = require('express');
const router = express.Router();
const passport = require('passport');
const auth0Controller = require('../../controllers/auth/auth0Controller');

// Route bắt đầu đăng nhập
router.get('/login', (req, res, next) => {
    const connection = req.query.connection;
    const authOptions = { scope: 'openid email profile' };
    if (connection) authOptions.connection = connection;
    passport.authenticate('auth0', authOptions)(req, res, next);
});

// Route callback sau khi đăng nhập thành công
router.get('/callback', 
    passport.authenticate('auth0', { failureRedirect: '/login?error=auth0_failed' }), 
    auth0Controller.handleAuth0Callback
);

// Đăng xuất
router.get('/logout', auth0Controller.logout);

// Test profile
router.get('/profile', auth0Controller.getProfile);

module.exports = router;