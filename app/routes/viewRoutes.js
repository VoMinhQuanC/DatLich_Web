const express = require('express');
const router = express.Router();

// ---------------------------
// GIAO DIỆN KHÁCH HÀNG (CLIENT)
// ---------------------------
router.get('/', (req, res) => {
    res.render('client/index'); // Giả sử file chính nằm ở client/index.ejs
});

router.get('/dichvu', (req, res) => {
    res.render('client/dichvu');
});

router.get('/gioithieu', (req, res) => {
    res.render('client/gioithieu');
});

router.get('/lienhe', (req, res) => {
    res.render('client/lienhe');
});

router.get('/tintuc', (req, res) => {
    res.render('client/tintuc');
});

router.get('/suaxetainha', (req, res) => {
    res.render('client/suaxetainha');
});

router.get('/booking', (req, res) => {
    res.render('client/booking');
});

router.get('/booking-history', (req, res) => {
    res.render('client/booking-history');
});

router.get('/profile', (req, res) => {
    res.render('client/profile');
});

router.get('/payment', (req, res) => {
    res.render('client/payment');
});

router.get('/notification', (req, res) => {
    res.render('client/notification');
});

// Các bài viết tin tức
router.get('/tintuc1', (req, res) => res.render('client/tintuc1'));
router.get('/tintuc2', (req, res) => res.render('client/tintuc2'));
router.get('/tintuc3', (req, res) => res.render('client/tintuc3'));
router.get('/tintuc4', (req, res) => res.render('client/tintuc4'));
router.get('/tintuc5', (req, res) => res.render('client/tintuc5'));
router.get('/tintuc6', (req, res) => res.render('client/tintuc6'));

router.get('/qr-kiosk-display', (req, res) => res.render('client/qr-kiosk-display'));


// ---------------------------
// GIAO DIỆN AUTH
// ---------------------------
router.get('/login', (req, res) => {
    res.render('auth/login');
});

router.get('/forgot-password', (req, res) => {
    res.render('auth/forgot-password');
});

router.get('/register', (req, res) => {
    res.render('auth/register');
});

router.get('/auth-success', (req, res) => {
    res.render('auth/auth-success');
});


// ---------------------------
// GIAO DIỆN ADMIN
// ---------------------------
router.get('/admin', (req, res) => {
    res.render('admin/admin');
});

router.get('/admin-revenue', (req, res) => {
    res.render('admin/admin-revenue');
});

router.get('/admin-booking', (req, res) => {
    res.render('admin/admin-booking');
});

router.get('/admin-mechanics', (req, res) => {
    res.render('admin/admin-mechanics');
});

router.get('/admin-schedules', (req, res) => {
    res.render('admin/admin-schedules');
});

router.get('/admin-services', (req, res) => {
    res.render('admin/admin-services');
});

router.get('/admin-users', (req, res) => {
    res.render('admin/admin-users');
});

router.get('/admin-attendance', (req, res) => {
    res.render('admin/admin-attendance');
});

router.get('/admin-register', (req, res) => {
    res.render('admin/admin-register');
});


// ---------------------------
// GIAO DIỆN THỢ MÁY (MECHANIC)
// ---------------------------
router.get('/mechanic-dashboard', (req, res) => {
    res.render('mechanic/mechanic-dashboard');
});

router.get('/mechanic-schedule', (req, res) => {
    res.render('mechanic/mechanic-schedule');
});

router.get('/mechanic-appointments', (req, res) => {
    res.render('mechanic/mechanic-appointments');
});

module.exports = router;
