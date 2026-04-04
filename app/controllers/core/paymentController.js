// File: app/controllers/core/paymentController.js
const { pool } = require('../../../config/db');
const axios = require('axios');

const qs = require('qs');
const crypto = require('crypto');


// Helper: Lấy tên ngân hàng từ mã BIN
const getBankName = (bankId) => {
    const banks = {
        '970422': 'MB Bank (Quân Đội)',
        '970415': 'Vietinbank',
        '970436': 'Vietcombank',
        '970418': 'BIDV',
        '970405': 'Agribank',
        '970407': 'Techcombank',
        '970423': 'TPBank',
        '970403': 'Sacombank',
        '970416': 'ACB',
        '970432': 'VPBank',
        '970441': 'VIB',
        '970448': 'OCB',
        // ... giữ nguyên danh sách ngân hàng của bạn
    };
    return banks[bankId] || 'Ngân hàng';
};

// 1. Tạo QR Code thanh toán
const generatePaymentQR = async (req, res) => {
    try {
        const appointmentId = req.params.appointmentId;
        console.log(`📱 Generating QR for appointment: ${appointmentId}`);

        // BƯỚC 1: Lấy thông tin đơn hàng
        const [appointments] = await pool.query(`
            SELECT a.AppointmentID, a.UserID, a.Status, a.AppointmentDate, u.FullName as CustomerName
            FROM Appointments a JOIN Users u ON a.UserID = u.UserID
            WHERE a.AppointmentID = ? AND a.IsDeleted = 0
        `, [appointmentId]);

        if (appointments.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });

        const appointment = appointments[0];

        // BƯỚC 2: Tính tổng tiền
        const [services] = await pool.query(`
            SELECT SUM(s.Price * aps.Quantity) as TotalAmount, GROUP_CONCAT(s.ServiceName SEPARATOR ', ') as ServiceNames
            FROM AppointmentServices aps JOIN Services s ON aps.ServiceID = s.ServiceID
            WHERE aps.AppointmentID = ?
        `, [appointmentId]);

        const totalAmount = services[0]?.TotalAmount || 0;
        const serviceNames = services[0]?.ServiceNames || '';
        const bookingCode = `BK${appointmentId}`;

        // BƯỚC 3: Thông tin ngân hàng
        const bankInfo = {
            accountNo: process.env.BANK_ACCOUNT_NO || '0947084064',
            accountName: process.env.BANK_ACCOUNT_NAME || 'VO MINH QUAN',
            bankId: process.env.BANK_ID || '970422',
            bankName: getBankName(process.env.BANK_ID || '970422')
        };

        // BƯỚC 4: Gọi VietQR API
        let qrString = '';
        try {
            const vietqrResponse = await axios.post('https://api.vietqr.io/v2/generate', {
                accountNo: bankInfo.accountNo,
                accountName: bankInfo.accountName,
                acqId: bankInfo.bankId,
                amount: parseInt(totalAmount),
                addInfo: bookingCode,
                format: 'text',
                template: 'compact'
            });
            if (vietqrResponse.data?.data) qrString = vietqrResponse.data.data.qrDataURL;
        } catch (e) {
            qrString = `https://img.vietqr.io/image/${bankInfo.bankId}-${bankInfo.accountNo}-compact2.png?amount=${totalAmount}&addInfo=${encodeURIComponent(bookingCode)}`;
        }

        res.json({
            success: true,
            data: {
                appointmentId, bookingCode, totalAmount, 
                customerName: appointment.CustomerName, serviceNames, qrString,
                bankInfo: { ...bankInfo, transferContent: bookingCode }
            }
        });
    } catch (err) {
        console.error('❌ Error generating QR:', err);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};

const createVNPayPayment = async (req, res) => {
    try {
        const { appointmentId } = req.body;

        // 🔥 LẤY AMOUNT TỪ DATABASE
        const [services] = await pool.query(`
            SELECT SUM(s.Price * aps.Quantity) as TotalAmount
            FROM AppointmentServices aps 
            JOIN Services s ON aps.ServiceID = s.ServiceID
            WHERE aps.AppointmentID = ?
        `, [appointmentId]);

        const amount = services[0]?.TotalAmount || 0;
        
        if (amount === 0) {
            return res.status(400).json({ success: false, message: 'Số tiền không hợp lệ' });
        }    // 👉 TODO: lấy từ DB giống QR

        const vnp_TmnCode = process.env.VNP_TMN_CODE;
        const vnp_HashSecret = process.env.VNP_HASH_SECRET;

        const vnp_Url = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
        const vnp_ReturnUrl = "http://localhost:3001/api/payment/vnpay-return";

        const date = new Date();
        const createDate = date.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

        const orderId = appointmentId;
        const orderInfo = `Thanh toan don ${appointmentId}`;

        let vnp_Params = {
            vnp_Version: "2.1.0",
            vnp_Command: "pay",
            vnp_TmnCode,
            vnp_Amount: amount * 100,
            vnp_CurrCode: "VND",
            vnp_TxnRef: orderId,
            vnp_OrderInfo: orderInfo,
            vnp_OrderType: "billpayment",
            vnp_Locale: "vn",
            vnp_ReturnUrl,
            vnp_CreateDate: createDate,
            vnp_IpAddr: "127.0.0.1"
        };

        const sortedParams = qs.stringify(vnp_Params, { encode: false });

        const signData = crypto.createHmac("sha512", vnp_HashSecret)
            .update(Buffer.from(sortedParams, 'utf-8'))
            .digest("hex");

        vnp_Params['vnp_SecureHash'] = signData;

        const paymentUrl = vnp_Url + '?' + qs.stringify(vnp_Params, { encode: false });

        res.json({ success: true, paymentUrl });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const vnpayReturn = async (req, res) => {
    const appointmentId = req.query.vnp_TxnRef;
    const code = req.query.vnp_ResponseCode;
    const amount = req.query.vnp_Amount;

    try {
        // 🔥 VALIDATE appointmentId
        if (!appointmentId || isNaN(appointmentId)) {
            console.error('❌ Invalid appointmentId:', appointmentId);
            return res.redirect("http://localhost:3001/payment-fail?error=invalid_appointment");
        }

        // 🔥 CHECK appointment exists
        const [appointmentCheck] = await pool.query(
            `SELECT AppointmentID, Status, PaymentStatus FROM Appointments WHERE AppointmentID = ?`,
            [appointmentId]
        );

        if (appointmentCheck.length === 0) {
            console.error('❌ Appointment not found:', appointmentId);
            return res.redirect("http://localhost:3001/payment-fail?error=not_found");
        }

        const appointment = appointmentCheck[0];

        // 🔥 Nếu đã Confirmed, không cập nhật lại
        if (appointment.Status === 'Confirmed' && appointment.PaymentStatus === 'Paid') {
            console.log('⚠️  Appointment already confirmed:', appointmentId);
            return res.redirect("http://localhost:3001/payment-success");
        }

        // ✅ Thanh toán thành công (code = "00")
        if (code === "00") {
            // 🔥 UPDATE 1: Pending → Confirmed
            await pool.query(`
                UPDATE Appointments 
                SET PaymentStatus = 'Paid', Status = 'Confirmed', UpdatedAt = NOW()
                WHERE AppointmentID = ?
            `, [appointmentId]);

            // 🔥 UPDATE 2: Ghi nhận Payment record
            await pool.query(`
                INSERT INTO Payments (UserID, AppointmentID, Amount, PaymentMethod, Status, PaymentDate)
                SELECT 
                    a.UserID,
                    a.AppointmentID,
                    COALESCE(? / 100, SUM(s.Price * aps.Quantity), 0),
                    'VNPay',
                    'Completed',
                    NOW()
                FROM Appointments a
                LEFT JOIN AppointmentServices aps ON a.AppointmentID = aps.AppointmentID
                LEFT JOIN Services s ON aps.ServiceID = s.ServiceID
                WHERE a.AppointmentID = ?
            `, [amount, appointmentId]);

            console.log('✅ VNPay payment successful:', appointmentId, 'Amount:', amount);
            return res.redirect("http://localhost:3001/payment-success");

        } 
        // ❌ Thanh toán thất bại
        else {
            // 🔥 UPDATE: Pending → Cancelled (giải phóng lịch)
            await pool.query(`
                UPDATE Appointments 
                SET PaymentStatus = 'Failed', Status = 'Cancelled', UpdatedAt = NOW()
                WHERE AppointmentID = ?
            `, [appointmentId]);

            console.log('❌ VNPay payment failed:', appointmentId, 'Code:', code);
            return res.redirect("http://localhost:3001/payment-fail");
        }

    } catch (error) {
        console.error('❌ Error processing VNPay return:', error);
        return res.redirect("http://localhost:3001/payment-fail");
    }
};

const createMomoPayment = async (req, res) => {
    try {
        const { appointmentId } = req.body;

        // 🔥 VALIDATION: appointmentId
        if (!appointmentId || isNaN(appointmentId)) {
            return res.status(400).json({ 
                success: false, 
                message: 'AppointmentID không hợp lệ' 
            });
        }

        // 🔥 LẤY AMOUNT TỪ DATABASE
        const [services] = await pool.query(`
            SELECT SUM(s.Price * aps.Quantity) as TotalAmount
            FROM AppointmentServices aps
            JOIN Services s ON aps.ServiceID = s.ServiceID
            WHERE aps.AppointmentID = ?
        `, [appointmentId]);

        // 🔥 VALIDATION: services có dữ liệu không
        if (!services || services.length === 0 || !services[0]?.TotalAmount) {
            return res.status(400).json({ 
                success: false, 
                message: 'Không tìm thấy dữ liệu dịch vụ hoặc số tiền = 0' 
            });
        }

        const amount = parseInt(services[0].TotalAmount);
        
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Số tiền không hợp lệ' 
            });
        }

        const partnerCode = "MOMO";
        const accessKey = "F8BBA842ECF85";
        const secretKey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";

        const requestId = `REQ_${Date.now()}`;
        const orderId = `${appointmentId}_${Date.now()}`;
        const orderInfo = `Thanh toán lịch hẹn ${appointmentId}`;
        const redirectUrl = "http://localhost:3001/payment-success";
        const ipnUrl = process.env.MOMO_IPN_URL || "http://localhost:3001/api/payment/momo-ipn";
        const extraData = "";

        const rawSignature =
            `accessKey=${accessKey}` +
            `&amount=${amount}` +  // ✅ Đảm bảo là số
            `&extraData=${extraData}` +
            `&ipnUrl=${ipnUrl}` +
            `&orderId=${orderId}` +
            `&orderInfo=${orderInfo}` +
            `&partnerCode=${partnerCode}` +
            `&redirectUrl=${redirectUrl}` +
            `&requestId=${requestId}` +
            `&requestType=payWithMethod`;

        const signature = crypto
            .createHmac("sha256", secretKey)
            .update(rawSignature)
            .digest("hex");

        const requestBody = {
            partnerCode,
            accessKey,
            requestId,
            amount: amount.toString(),  // ✅ An toàn: amount là số, convert sang string
            orderId,
            orderInfo,
            redirectUrl,
            ipnUrl,
            extraData,
            requestType: "payWithMethod",
            autoCapture: true,
            orderGroupId: "",
            signature,
            lang: "vi"
        };

        console.log("📤 MoMo REQUEST:", requestBody);

        const momoRes = await axios.post(
            "https://test-payment.momo.vn/v2/gateway/api/create",
            requestBody
        );

        console.log("✅ MoMo RESPONSE:", momoRes.data);

        res.json({
            success: true,
            amount,
            qrCodeUrl: momoRes.data.qrCodeUrl || "",
            payUrl: momoRes.data.payUrl || ""
        });

    } catch (error) {
        console.error("❌ MoMo ERROR:", error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: error.response?.data?.message || error.message
        });
    }
};

const momoIPN = async (req, res) => {
    const { orderId, resultCode, amount, transId } = req.body;

    try {
        // 🔥 PARSE appointmentId đúng cách
        // orderId format: "123_timestamp"
        const appointmentId = orderId ? orderId.split("_")[0] : null;

        if (!appointmentId || isNaN(appointmentId)) {
            console.error('❌ Invalid appointmentId from MoMo:', appointmentId);
            return res.json({ message: "FAIL" });
        }

        console.log('📱 MoMo IPN received:', { appointmentId, resultCode, amount });

        // 🔥 CHECK appointment exists
        const [appointmentCheck] = await pool.query(
            `SELECT AppointmentID, Status, PaymentStatus FROM Appointments WHERE AppointmentID = ?`,
            [appointmentId]
        );

        if (appointmentCheck.length === 0) {
            console.error('❌ Appointment not found:', appointmentId);
            return res.json({ message: "FAIL" });
        }

        const appointment = appointmentCheck[0];

        // 🔥 Nếu đã Confirmed, không cập nhật lại
        if (appointment.Status === 'Confirmed' && appointment.PaymentStatus === 'Paid') {
            console.log('⚠️  Appointment already confirmed:', appointmentId);
            return res.json({ message: "OK" });
        }

        // ✅ Thanh toán thành công (resultCode = 0)
        if (resultCode === 0) {
            // 🔥 UPDATE 1: Pending → Confirmed
            await pool.query(`
                UPDATE Appointments 
                SET PaymentStatus = 'Paid', Status = 'Confirmed', UpdatedAt = NOW()
                WHERE AppointmentID = ?
            `, [appointmentId]);

            // 🔥 UPDATE 2: Ghi nhận Payment record
            await pool.query(`
                INSERT INTO Payments (UserID, AppointmentID, Amount, PaymentMethod, Status, TransactionID, PaymentDate)
                SELECT 
                    a.UserID,
                    a.AppointmentID,
                    COALESCE(? / 100, SUM(s.Price * aps.Quantity), 0),
                    'MoMo',
                    'Completed',
                    ?,
                    NOW()
                FROM Appointments a
                LEFT JOIN AppointmentServices aps ON a.AppointmentID = aps.AppointmentID
                LEFT JOIN Services s ON aps.ServiceID = s.ServiceID
                WHERE a.AppointmentID = ?
            `, [amount, transId, appointmentId]);

            console.log('✅ MoMo payment successful:', appointmentId, 'Amount:', amount);
        } 
        // ❌ Thanh toán thất bại
        else {
            // 🔥 UPDATE: Pending → Cancelled (giải phóng lịch)
            await pool.query(`
                UPDATE Appointments 
                SET PaymentStatus = 'Failed', Status = 'Cancelled', UpdatedAt = NOW()
                WHERE AppointmentID = ?
            `, [appointmentId]);

            console.log('❌ MoMo payment failed:', appointmentId, 'ResultCode:', resultCode);
        }

        res.json({ message: "OK" });

    } catch (error) {
        console.error('❌ Error processing MoMo IPN:', error);
        res.status(500).json({ message: "Error" });
    }
};

const createMomoTestQR = async (req, res) => {
    try {
        const { amount } = req.body;

        // 🔥 VALIDATION: amount
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Số tiền không hợp lệ' 
            });
        }

        const partnerCode = "MOMO";
        const accessKey = "F8BBA842ECF85";
        const secretKey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";

        const requestId = partnerCode + Date.now();
        const orderId = requestId;
        const orderInfo = "Thanh toán test VQTBIKE";
        const redirectUrl = "http://localhost:3001/payment-success";
        const ipnUrl = "https://webhook.site/test";
        const extraData = "";

        const rawSignature =
            `accessKey=${accessKey}` +
            `&amount=${amount}` +
            `&extraData=${extraData}` +
            `&ipnUrl=${ipnUrl}` +
            `&orderId=${orderId}` +
            `&orderInfo=${orderInfo}` +
            `&partnerCode=${partnerCode}` +
            `&redirectUrl=${redirectUrl}` +
            `&requestId=${requestId}` +
            `&requestType=payWithMethod`;

        const signature = crypto
            .createHmac("sha256", secretKey)
            .update(rawSignature)
            .digest("hex");

        const requestBody = {
            partnerCode,
            accessKey,
            partnerName: "Test",
            storeId: "VQTBIKE",
            requestId,
            amount: amount.toString(),  // ✅ An toàn: convert sang string
            orderId,
            orderInfo,
            redirectUrl,
            ipnUrl,
            lang: "vi",
            requestType: "payWithMethod",
            autoCapture: true,
            extraData,
            orderGroupId: "",
            items: [],
            signature
        };

        console.log("📤 MOMO TEST REQUEST:", requestBody);

        const momoRes = await axios.post(
            "https://test-payment.momo.vn/v2/gateway/api/create",
            requestBody,
            { headers: { "Content-Type": "application/json" } }
        );

        console.log("✅ MOMO TEST RESPONSE:", momoRes.data);

        res.json({
            success: true,
            qrCodeUrl: momoRes.data.qrCodeUrl || "",
            payUrl: momoRes.data.payUrl || ""
        });

    } catch (error) {
        console.error("❌ MOMO TEST ERROR:", error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: error.response?.data?.message || error.message
        });
    }
};


module.exports = {
    generatePaymentQR,
    createVNPayPayment,
    createMomoPayment,
    vnpayReturn,
    momoIPN,
    createMomoTestQR
};
