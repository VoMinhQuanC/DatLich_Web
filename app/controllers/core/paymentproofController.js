// File: app/controllers/core/paymentproofController.js
const { pool } = require('../../../config/db');
const notificationHelper = require('../../utils/notificationHelper');
const multer = require('multer');

// ============ CLOUDINARY CONFIG ============
let cloudinary;
try {
    cloudinary = require('../../../config/cloudinary');
} catch (e) {
    cloudinary = require('cloudinary').v2;
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
}

// Multer config memory
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) return cb(new Error('Chỉ chấp nhận file hình ảnh!'), false);
        cb(null, true);
    }
});

const PAYMENT_EXPIRY_MINUTES = 15;

// Helper Upload Cloudinary
async function uploadToCloudinary(buffer, folder, filename) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: `suaxe/${folder}`, public_id: filename, resource_type: 'image' },
            (error, result) => { if (error) reject(error); else resolve(result); }
        );
        uploadStream.end(buffer);
    });
}

// --- CONTROLLER FUNCTIONS ---

// 1. Tạo yêu cầu thanh toán
const createPaymentRequest = async (req, res) => {
    try {
        const { appointmentId, amount } = req.body;
        const userId = req.user.userId;

        const [appointments] = await pool.query('SELECT * FROM Appointments WHERE AppointmentID = ? AND UserID = ? AND IsDeleted = 0', [appointmentId, userId]);
        if (appointments.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });

        const [existing] = await pool.query('SELECT * FROM PaymentProofs WHERE AppointmentID = ? AND Status IN ("Pending", "WaitingReview")', [appointmentId]);
        if (existing.length > 0) {
            const remaining = Math.max(0, Math.floor((new Date(existing[0].ExpiresAt) - new Date()) / 1000));
            return res.json({ success: true, message: 'Đã có yêu cầu thanh toán', data: { proofId: existing[0].ProofID, status: existing[0].Status, remainingSeconds: remaining } });
        }

        const transferContent = `BK${appointmentId}`;
        const expiresAt = new Date(Date.now() + PAYMENT_EXPIRY_MINUTES * 60 * 1000);

        const [result] = await pool.query(
            'INSERT INTO PaymentProofs (AppointmentID, Amount, TransferContent, QRGeneratedAt, ExpiresAt, Status) VALUES (?, ?, ?, NOW(), ?, "Pending")',
            [appointmentId, amount, transferContent, expiresAt]
        );

        res.json({ success: true, data: { proofId: result.insertId, transferContent, expiresAt, remainingSeconds: PAYMENT_EXPIRY_MINUTES * 60 } });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// 2. Upload chứng từ (Customer)
const uploadProof = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { appointmentId } = req.body;
        const userId = req.user.userId;

        if (!req.file) return res.status(400).json({ success: false, message: 'Vui lòng chọn ảnh' });

        await connection.beginTransaction();
        const [appointments] = await connection.query('SELECT * FROM Appointments WHERE AppointmentID = ? AND UserID = ?', [appointmentId, userId]);
        if (appointments.length === 0) throw new Error('Không tìm thấy đơn hàng');

        const [existing] = await connection.query('SELECT * FROM PaymentProofs WHERE AppointmentID = ? ORDER BY CreatedAt DESC LIMIT 1', [appointmentId]);
        let proofId = existing.length > 0 ? existing[0].ProofID : null;

        const uploadResult = await uploadToCloudinary(req.file.buffer, 'payment-proofs', `proof_${appointmentId}_${Date.now()}`);

        if (proofId) {
            await connection.query('UPDATE PaymentProofs SET ImageUrl = ?, ImagePublicId = ?, Status = "WaitingReview", ProofUploadedAt = NOW() WHERE ProofID = ?', [uploadResult.secure_url, uploadResult.public_id, proofId]);
        }
        
        await connection.query('UPDATE Appointments SET Status = "PendingApproval" WHERE AppointmentID = ?', [appointmentId]);
        await connection.commit();

        // Notify
        try { notificationHelper.notifyPaymentProofUploaded({ userId, appointmentId, amount: 0 }); } catch (e) {}

        res.json({ success: true, message: 'Upload chứng từ thành công', proofId });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ success: false, message: error.message });
    } finally { connection.release(); }
};

// 3. Admin duyệt chứng từ
const approveProof = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { proofId } = req.params;
        const adminId = req.user.userId;
        await connection.beginTransaction();

        const [proofs] = await connection.query('SELECT * FROM PaymentProofs WHERE ProofID = ?', [proofId]);
        if (proofs.length === 0) throw new Error('Không tìm thấy chứng từ');

        await connection.query('UPDATE PaymentProofs SET Status = "Approved", ReviewedBy = ?, ReviewedAt = NOW() WHERE ProofID = ?', [adminId, proofId]);
        
        const [payment] = await connection.query(
            'INSERT INTO Payments (AppointmentID, UserID, Amount, PaymentMethod, Status, PaymentDate) SELECT AppointmentID, (SELECT UserID FROM Appointments WHERE AppointmentID = pp.AppointmentID), Amount, "Bank Transfer", "Completed", NOW() FROM PaymentProofs pp WHERE ProofID = ?',
            [proofId]
        );

        await connection.query('UPDATE Appointments SET Status = "Pending", PaymentMethod = "Chuyển khoản ngân hàng" WHERE AppointmentID = ?', [proofs[0].AppointmentID]);
        
        await connection.commit();
        res.json({ success: true, message: 'Duyệt thành công' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ success: false, message: error.message });
    } finally { connection.release(); }
};

// 4. Lấy danh sách chờ duyệt (Admin)
const getPendingProofs = async (req, res) => {
    try {
        const [proofs] = await pool.query(`
            SELECT pp.*, u.FullName as CustomerName, u.PhoneNumber as CustomerPhone
            FROM PaymentProofs pp
            JOIN Appointments a ON pp.AppointmentID = a.AppointmentID
            JOIN Users u ON a.UserID = u.UserID
            WHERE pp.Status = 'WaitingReview' ORDER BY pp.ProofUploadedAt ASC
        `);
        res.json({ success: true, data: proofs });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// 5. Xử lý hết hạn (Cron)
const processExpired = async (req, res) => {
    try {
        const [result] = await pool.query('UPDATE PaymentProofs SET Status = "Expired" WHERE Status = "Pending" AND ExpiresAt < NOW()');
        if (result.affectedRows > 0) {
            await pool.query('UPDATE Appointments a JOIN PaymentProofs pp ON a.AppointmentID = pp.AppointmentID SET a.Status = "Đã hủy" WHERE pp.Status = "Expired" AND a.Status = "Chờ thanh toán"');
        }
        res.json({ success: true, expiredCount: result.affectedRows });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

module.exports = {
    upload,
    createPaymentRequest,
    uploadProof,
    approveProof,
    getPendingProofs,
    processExpired
};