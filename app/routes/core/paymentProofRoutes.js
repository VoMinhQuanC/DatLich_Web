// File: app/routes/core/paymentproofRoutes.js
const express = require('express');
const router = express.Router();
const paymentProofController = require('../../controllers/core/paymentProofController');
const { authenticateToken } = require('../auth/authRoutes');

// --- CUSTOMER APIs ---
router.post('/create', authenticateToken, paymentProofController.createPaymentRequest);
router.post('/upload', authenticateToken, paymentProofController.upload.single('proofImage'), paymentProofController.uploadProof);

// --- ADMIN APIs ---
const checkAdmin = (req, res, next) => {
    if (req.user.role !== 1) return res.status(403).json({ success: false, message: 'Yêu cầu quyền admin' });
    next();
};

router.get('/admin/pending', authenticateToken, checkAdmin, paymentProofController.getPendingProofs);
router.get('/admin/stats', authenticateToken, checkAdmin, paymentProofController.getProofStats);
router.get('/admin/all', authenticateToken, checkAdmin, paymentProofController.getAllProofs);
router.post('/admin/approve/:proofId', authenticateToken, checkAdmin, paymentProofController.approveProof);
router.post('/admin/reject/:proofId', authenticateToken, checkAdmin, paymentProofController.rejectProof);

// --- SYSTEM/CRON APIs ---
router.post('/process-expired', paymentProofController.processExpired);

module.exports = router;