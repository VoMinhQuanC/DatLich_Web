        const express = require('express');
        const router = express.Router();

        const {
            generatePaymentQR,
            createVNPayPayment,
            createMomoPayment,
            vnpayReturn,
            momoIPN,
            createMomoTestQR
        } = require('../../controllers/core/paymentController');

        // ✅ QR
        router.get('/qr/:appointmentId', generatePaymentQR);

        // ✅ VNPay
        router.post('/vnpay', createVNPayPayment);

        // ✅ VNPay return (redirect từ VNPay)
        router.get('/vnpay-return', vnpayReturn);

        // ✅ MoMo
        router.post('/momo', createMomoPayment);

        // ✅ MoMo IPN (server nhận callback)
        router.post('/momo-ipn', momoIPN);

        // (OPTIONAL test)
        router.get('/test', (req, res) => {
            res.json({ success: true, message: 'Payment route OK' });
        });

        router.post("/momo/test-qr", createMomoTestQR);

        module.exports = router;