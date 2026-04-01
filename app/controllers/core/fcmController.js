// File: app/controllers/core/fcmController.js
const { pool } = require('../../../config/db');
const admin = require('firebase-admin');

// ========================================
// ✅ KHỞI TẠO FIREBASE ADMIN SDK
// ========================================
let firebaseInitialized = false;
try {
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
    } else {
        const serviceAccount = require('../../../config/firebase-service-account.json');
        credential = admin.credential.cert(serviceAccount);
    }
    admin.initializeApp({ credential });
    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK initialized successfully');
} catch (err) {
    console.error('❌ Firebase Admin initialization failed:', err.message);
}

// 1. Lưu FCM token
const saveToken = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { fcmToken } = req.body;
        if (!fcmToken) return res.status(400).json({ success: false, message: 'FCM token is required' });

        await pool.query(
            `INSERT INTO FCMTokens (UserID, FCMToken, UpdatedAt) VALUES (?, ?, NOW()) 
             ON DUPLICATE KEY UPDATE FCMToken = ?, UpdatedAt = NOW()`,
            [userId, fcmToken, fcmToken]
        );
        res.json({ success: true, message: 'FCM token saved successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// 2. Helper: Gửi push notification (Dùng cho các Controller khác gọi)
const sendPushNotification = async (userId, notification) => {
    if (!firebaseInitialized) return { success: false, message: 'Firebase not initialized' };
    try {
        const [tokens] = await pool.query('SELECT FCMToken FROM FCMTokens WHERE UserID = ? AND IsActive = 1', [userId]);
        if (tokens.length === 0) return { success: false, message: 'No FCM token' };

        const message = {
            notification: { title: notification.title || 'VQT Bike Service', body: notification.body || '' },
            data: { 
                type: notification.type || 'general', 
                referenceId: notification.referenceId?.toString() || '',
                ...notification.data 
            },
            token: tokens[0].FCMToken,
        };

        const response = await admin.messaging().send(message);
        return { success: true, messageId: response };
    } catch (err) {
        if (err.code === 'messaging/invalid-registration-token' || err.code === 'messaging/registration-token-not-registered') {
            await pool.query('UPDATE FCMTokens SET IsActive = 0 WHERE UserID = ?', [userId]);
        }
        return { success: false, error: err.message };
    }
};

// 3. Test gửi push (Admin only)
const testPush = async (req, res) => {
    if (req.user.role !== 1) return res.status(403).json({ success: false, message: 'Không có quyền' });
    const { userId, title, body } = req.body;
    const result = await sendPushNotification(userId, { title, body, type: 'test' });
    res.json({ success: result.success, data: result });
};

// 4. Kiểm tra trạng thái Firebase
const getStatus = async (req, res) => {
    res.json({ success: true, firebaseInitialized });
};

module.exports = {
    saveToken,
    sendPushNotification,
    testPush,
    getStatus
};