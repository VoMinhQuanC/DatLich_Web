// config/cloudinary.js
const { v2: cloudinary } = require('cloudinary');

// Kiểm tra xem các biến môi trường có tồn tại không
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('❌ Cloudinary Error: Thiếu biến môi trường cấu hình (Kiểm tra file .env)');
} else {
    // Chỉ thực hiện cấu hình khi đã đủ biến môi trường
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    console.log('✅ Cloudinary configured successfully');
}

module.exports = cloudinary;