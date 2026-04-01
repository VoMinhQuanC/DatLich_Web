// File: app/controllers/core/paymentController.js
const { pool } = require('../../../config/db');
const axios = require('axios');

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

module.exports = {
    generatePaymentQR
};