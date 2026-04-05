const mysql = require('mysql2/promise');

function firstDefined(...values) {
    return values.find((value) => value !== undefined && value !== null && value !== '');
}

const host = firstDefined(process.env.MYSQLHOST, process.env.DB_HOST, '127.0.0.1');
const user = firstDefined(process.env.MYSQLUSER, process.env.DB_USER, 'root');
const password = firstDefined(process.env.MYSQLPASSWORD, process.env.DB_PASSWORD, '');
const database = firstDefined(process.env.MYSQLDATABASE, process.env.DB_NAME);
const port = Number(firstDefined(process.env.MYSQLPORT, process.env.DB_PORT, 3306));

const isRailwayMySQL = Boolean(process.env.MYSQLHOST);

const config = {
    host,
    user,
    password,
    database,
    port,
    timezone: '+07:00',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000,
    enableKeepAlive: true,
    ...(isRailwayMySQL ? { ssl: { rejectUnauthorized: false } } : {})
};

console.log('🔍 Database host:', config.host);
console.log('🔍 Database port:', config.port);
console.log('🔍 Database name:', config.database || '(missing)');

const pool = mysql.createPool(config);

// Dong bo session timezone cua MySQL theo gio Viet Nam cho moi ket noi trong pool.
pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+07:00'");
});

async function connectDB() {
    try {
        if (!config.database) {
            throw new Error('Missing database name. Set MYSQLDATABASE or DB_NAME.');
        }

        const connection = await pool.getConnection();
        console.log('✅ MySQL Connected Successfully!');
        console.log(`   📍 DB: ${config.database} | Port: ${config.port}`);
        connection.release();
        return pool;
    } catch (err) {
        console.error('❌ MySQL Connection Failed:', err.message);
        console.error('   ↳ Check MYSQL* or DB_* variables for the current environment.');
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
