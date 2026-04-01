// File: config/db.js
const mysql = require('mysql2/promise');
// const { rejectPaymentProof } = require('../app/controllers/admin/adminPaymentProofController');
// const { captureRejections } = require('nodemailer/lib/xoauth2');

// const config = {
//     host: process.env.MYSQLHOST || process.env.DB_HOST || 'crossover.proxy.rlwy.net',
//     user: process.env.MYSQLUSER || process.env.DB_USER || 'railway',
//     password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || 'CfFPDEQNMLrHgKpApouPxQkYuaiyWNZe',
//     database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'railway',
//     port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '35949'),
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
//     ssl: {
//         rejectUnauthorized: false,
//     },
//     // ✅ Thêm 2 dòng này để tránh treo server nếu DB chậm
//     connectTimeout: 10000, 
//     enableKeepAlive: true 
// };

const config = {
    host: process.env.DB_HOST, 
    user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, 
    port: process.env.DB_PORT, 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false,
    },
    connectTimeout: 10000, 
    enableKeepAlive: true 
};

// 👇 THÊM 2 DÒNG NÀY ĐỂ BẮT QUẢ TANG NÓ:
console.log("🔍 ĐANG TEST KẾT NỐI TỚI HOST:", config.host);
console.log("🔍 ĐANG TEST KẾT NỐI TỚI PORT:", config.port);

const pool = mysql.createPool(config);

async function connectDB() {
    try {
        const connection = await pool.getConnection();
        console.log("✅ MySQL Connected Successfully!");
        console.log(`   📍 DB: ${config.database} | Port: ${config.port}`);
        connection.release();
        return pool;
    } catch (err) {
        console.error("❌ MySQL Connection Failed:", err.message);
        // Không throw err ở đây để server không bị sập ngay lập tức, 
        // giúp bạn vẫn xem được log lỗi trên Railway console.
    }
}

async function executeQuery(query, params = []) {
    try {
        const [rows] = await pool.query(query, params);
        return rows;
    } catch (error) {
        console.error("❌ Query Error:", error.message);
        throw error;
    }
}

module.exports = { connectDB, pool, executeQuery };