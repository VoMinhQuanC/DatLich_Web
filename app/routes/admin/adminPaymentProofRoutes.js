// File: app/routes/admin/adminPaymentProofRoutes.js
const express = require('express');
const router = express.Router();
const adminPaymentProofController = require('../../controllers/admin/adminPaymentProofController');
const { authenticateToken } = require('../auth/authRoutes');

// Middleware kiểm tra admin
const checkAdminRole = (req, res, next) => {
    // roleId 1: Super Admin, 2: Admin
    if (req.user.role !== 1 && req.user.role !== 2 && req.user.roleId !== 1) {
        return res.status(403).json({ success: false, message: 'Chỉ admin mới có quyền truy cập' });
    }
    next();
};

// Áp dụng bảo mật cho toàn bộ Route trong file này
router.use(authenticateToken);
router.use(checkAdminRole);

// Định tuyến
router.get('/payment-proofs', adminPaymentProofController.getPaymentProofs);
router.get('/payment-proofs/:proofId', adminPaymentProofController.getPaymentProofById);
router.post('/payment-proofs/:proofId/approve', adminPaymentProofController.approvePaymentProof);
router.post('/payment-proofs/:proofId/reject', adminPaymentProofController.rejectPaymentProof);
router.get('/stats', adminPaymentProofController.getStats);

module.exports = router;