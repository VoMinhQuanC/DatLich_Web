// File: app/controllers/core/imageController.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../../../config/db');

// --- CẤU HÌNH ĐƯỜNG DẪN THƯ MỤC ---
let webImagesDir, avatarsDir, servicesDir, vehiclesDir, tempDir;

if (process.env.NODE_ENV === 'production') {
    webImagesDir = '/tmp/images';
    avatarsDir = '/tmp/avatars';
    servicesDir = '/tmp/services';
    vehiclesDir = '/tmp/vehicles';
    tempDir = '/tmp/temp';
} else {
    // Lưu ý: Lùi thêm cấp bậc vì file này nằm trong controllers/core
    webImagesDir = path.join(__dirname, '../../../../Web/images');
    avatarsDir = path.join(webImagesDir, 'avatars');
    servicesDir = path.join(webImagesDir, 'services');
    vehiclesDir = path.join(webImagesDir, 'vehicles');
    tempDir = path.join(webImagesDir, 'temp');
}

// Khởi tạo thư mục
[webImagesDir, avatarsDir, servicesDir, vehiclesDir, tempDir].forEach(dir => {
    try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (error) { console.error(`Lỗi tạo thư mục ${dir}:`, error.message); }
});

// --- CÁC HÀM HELPER ---

const convertToSlug = (text) => {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+|-+$/g, '');
};

const removeOldAvatarImages = async (userId) => {
    try {
        const [users] = await pool.query('SELECT ProfilePicture, AvatarUrl FROM Users WHERE UserID = ?', [userId]);
        if (users.length > 0) {
            [users[0].ProfilePicture, users[0].AvatarUrl].forEach(imgPath => {
                if (imgPath) {
                    const fullPath = path.join(__dirname, '../../../../Web', imgPath);
                    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
                }
            });
        }
    } catch (e) { console.error('Lỗi xóa avatar cũ:', e); }
};

// --- CẤU HÌNH MULTER ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let target = tempDir;
        if (req.originalUrl.includes('/upload-avatar')) target = avatarsDir;
        else if (req.originalUrl.includes('/service')) target = servicesDir;
        else if (req.originalUrl.includes('/vehicle')) target = vehiclesDir;
        cb(null, target);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname) || '.jpg';
        if (req.originalUrl.includes('/upload-avatar')) cb(null, `avatar-${req.user.userId}-${timestamp}${ext}`);
        else if (req.serviceInfo) cb(null, `service-${req.serviceInfo.slug}-${req.serviceInfo.id}-${timestamp}${ext}`);
        else cb(null, `file-${timestamp}${ext}`);
    }
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// --- CÁC HÀM CONTROLLER ---

const uploadAvatar = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'Không tìm thấy file' });
        const userId = req.user.userId;
        const filename = req.file.filename;
        
        let imagePath = process.env.NODE_ENV === 'production' 
            ? req.file.path.split('/tmp/')[1] 
            : req.file.path.replace(/\\/g, '/').split('/Web/')[1];

        await removeOldAvatarImages(userId);
        await pool.query('UPDATE Users SET ProfilePicture = ?, AvatarUrl = ? WHERE UserID = ?', [imagePath, imagePath, userId]);

        res.json({ success: true, message: 'Cập nhật avatar thành công', avatarUrl: imagePath + '?t=' + Date.now() });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const checkServiceBeforeUpload = async (req, res, next) => {
    const serviceId = req.params.id;
    const [serviceCheck] = await pool.query('SELECT * FROM Services WHERE ServiceID = ?', [serviceId]);
    if (serviceCheck.length === 0) return res.status(404).json({ success: false, message: 'Không thấy dịch vụ' });
    
    req.serviceInfo = { id: serviceId, slug: convertToSlug(serviceCheck[0].ServiceName) };
    next();
};

const uploadServiceImage = async (req, res) => {
    try {
        let imagePath = process.env.NODE_ENV === 'production' 
            ? req.file.path.split('/tmp/')[1] 
            : req.file.path.replace(/\\/g, '/').split('/Web/')[1];
        
        await pool.query('UPDATE Services SET ServiceImage = ? WHERE ServiceID = ?', [imagePath, req.params.id]);
        res.json({ success: true, imagePath });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const initDirectories = (req, res) => {
    res.json({ success: true, message: 'Thư mục đã được kiểm tra' });
};

module.exports = {
    upload,
    uploadAvatar,
    checkServiceBeforeUpload,
    uploadServiceImage,
    initDirectories
};