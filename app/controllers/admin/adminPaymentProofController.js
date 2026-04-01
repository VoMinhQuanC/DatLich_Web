// File: app/controllers/admin/adminPaymentProofController.js
const { pool } = require('../../../config/db');

// 1. Lấy danh sách payment proofs (hỗ trợ phân trang và filter)
const getPaymentProofs = async (req, res) => {
    try {
        const { status, limit = 50, offset = 0 } = req.query;
        let query = 'SELECT * FROM vw_PendingPaymentProofs WHERE 1=1';
        const params = [];

        if (status) {
            query += ' AND ProofStatus = ?';
            params.push(status);
        }

        query += ' ORDER BY UploadedAt DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [proofs] = await pool.query(query, params);

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM vw_PendingPaymentProofs WHERE 1=1 ${status ? 'AND ProofStatus = ?' : ''}`,
            status ? [status] : []
        );

        const total = countResult[0].total;

        res.json({
            success: true,
            data: proofs,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + proofs.length) < total
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    }
};

// 2. Lấy chi tiết một chứng từ
const getPaymentProofById = async (req, res) => {
    try {
        const { proofId } = req.params;
        const [proofs] = await pool.query('SELECT * FROM vw_PendingPaymentProofs WHERE ProofID = ?', [proofId]);

        if (proofs.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy' });

        res.json({ success: true, data: proofs[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
    }
};

// 3. Duyệt chứng từ (Approve)
const approvePaymentProof = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { proofId } = req.params;
        const adminId = req.user.id || req.user.userId;

        await connection.beginTransaction();

        const [proofs] = await connection.query('SELECT * FROM PaymentProofs WHERE ProofID = ?', [proofId]);
        if (proofs.length === 0) throw new Error('Không tìm thấy chứng từ');
        if (proofs[0].Status !== 'Pending') throw new Error('Chứng từ đã được xử lý');

        // Cập nhật Proof
        await connection.query(
            "UPDATE PaymentProofs SET Status = 'Approved', ReviewedBy = ?, ReviewedAt = NOW() WHERE ProofID = ?",
            [adminId, proofId]
        );

        // Cập nhật Lịch hẹn
        await connection.query(
            "UPDATE Appointments SET Status = 'Confirmed' WHERE AppointmentID = ?",
            [proofs[0].AppointmentID]
        );

        // Cập nhật Thanh toán
        await connection.query(
            "UPDATE Payments SET Status = 'Paid', PaymentDate = NOW() WHERE AppointmentID = ?",
            [proofs[0].AppointmentID]
        );

        await connection.commit();
        res.json({ success: true, message: 'Đã duyệt thanh toán thành công' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
};

// 4. Từ chối chứng từ (Reject)
const rejectPaymentProof = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { proofId } = req.params;
        const { notes } = req.body;
        const adminId = req.user.id || req.user.userId;

        if (!notes) return res.status(400).json({ success: false, message: 'Vui lòng nhập lý do' });

        await connection.beginTransaction();

        const [proofs] = await connection.query('SELECT * FROM PaymentProofs WHERE ProofID = ?', [proofId]);
        if (proofs.length === 0) throw new Error('Không tìm thấy');

        await connection.query(
            "UPDATE PaymentProofs SET Status = 'Rejected', AdminNotes = ?, ReviewedBy = ?, ReviewedAt = NOW() WHERE ProofID = ?",
            [notes, adminId, proofId]
        );

        await connection.query("UPDATE Appointments SET Status = 'Canceled' WHERE AppointmentID = ?", [proofs[0].AppointmentID]);
        await connection.query("UPDATE Payments SET Status = 'Cancelled' WHERE AppointmentID = ?", [proofs[0].AppointmentID]);

        await connection.commit();
        res.json({ success: true, message: 'Đã từ chối thanh toán' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
};

// 5. Thống kê nhanh
const getStats = async (req, res) => {
    try {
        const [stats] = await pool.query(`
            SELECT 
                COUNT(CASE WHEN ProofStatus = 'Pending' THEN 1 END) as pending,
                COUNT(CASE WHEN ProofStatus = 'Approved' THEN 1 END) as approved,
                COUNT(*) as total
            FROM vw_PendingPaymentProofs WHERE DATE(UploadedAt) = CURDATE()
        `);
        res.json({ success: true, data: stats[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getPaymentProofs,
    getPaymentProofById,
    approvePaymentProof,
    rejectPaymentProof,
    getStats
};