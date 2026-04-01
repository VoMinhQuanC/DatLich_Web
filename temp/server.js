// SERVER.JS - FILE CHÍNH CỦA SERVER

// IMPORT CÁC MODULE CẦN THIẾT
const express = require('express');
require('dotenv').config();
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const session = require('express-session'); // Thêm vào
const passport = require('passport'); // Thêm vào
const Auth0Strategy = require('passport-auth0'); // Thêm vào
const auth0Config = require('../config/auth0Config'); // Thêm vào
const profileRoutes = require('./routes/profileRoutes'); // Thêm vào

// IMPORT CÁC ROUTE
const { router: authRoutes, authenticateToken } = require('./routes/authRoutes');
const auth0Routes = require('./routes/auth0Routes'); // Thêm vào
const serviceRoutes = require('./routes/serviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const scheduleRoutes = require('./routes/schedulesRoutes');
const userRoutes = require('./routes/userRoutes');
const revenueRoutes = require('./routes/revenueRoutes');
const mechanicsRoutes = require('./routes/mechanicsRoutes'); // Thêm route cho kỹ thuật viên
const imageRoutes = require('./routes/imageRoutes'); // Thêm route cho upload hình ảnh

// Thêm vào đầu server.js sau phần khai báo biến
console.log('Environment:', process.env.NODE_ENV);
console.log('Current directory:', process.cwd());
console.log('__dirname:', __dirname);

// KHỞI TẠO EXPRESS APP
const app = express();
// const PORT = process.env.PORT || 3001;


// Middleware chi tiết để debug
app.use((req, res, next) => {
  const start = Date.now();
  
  // Log thông tin request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - START`);
  
  // Log thông tin headers nếu cần debug
  // console.log(`Headers: ${JSON.stringify(req.headers)}`);
  
  // Lưu function gốc để có thể ghi đè
  const originalEnd = res.end;
  
  // Ghi đè function end để log kết quả response
  res.end = function(chunk, encoding) {
    const responseTime = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - END - Status: ${res.statusCode} - ${responseTime}ms`);
    return originalEnd.call(this, chunk, encoding);
  };
  
  next();
});

// CẤU HÌNH MIDDLEWARE
// Middleware kiểm tra quyền admin
const checkAdminAccess = (req, res, next) => {
  if (req.user && req.user.role === 1) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền truy cập. Yêu cầu quyền admin.'
    });
  }
};

// Thêm middleware để xử lý URL hình ảnh từ Cloud Storage
   app.use((req, res, next) => {
     // Thêm biến cloudStorageUrl vào res.locals để sử dụng trong routes
     res.locals.cloudStorageUrl = process.env.STATIC_URL || 'https://storage.googleapis.com/suaxe-api-web';
     next();
   });

// Xử lý file tĩnh đúng cách - đảm bảo đường dẫn tuyệt đối
let webPath;
try {
  const possiblePaths = [
    path.join(__dirname, '../Web'),
    path.join(process.cwd(), 'Web'),
    '/workspace/Web'
  ];
  
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      webPath = p;
      console.log(`Đã tìm thấy thư mục Web tại: ${webPath}`);
      break;
    }
  }
  
  if (!webPath) {
    // Nếu không tìm thấy, tạo đường dẫn mặc định
    webPath = path.join(process.cwd(), 'Web');
    console.log(`Không tìm thấy thư mục Web, sử dụng đường dẫn mặc định: ${webPath}`);
  }
} catch (err) {
  console.error('Lỗi khi tìm thư mục Web:', err);
  webPath = path.join(process.cwd(), 'Web');
}
app.use(express.static(webPath));
app.use('/SuaXe', express.static(webPath));
app.use('/images', express.static(path.join(webPath, 'images')));

// Xử lý static files cho uploaded images trong production
if (process.env.NODE_ENV === 'production') {
    app.use('/avatars', express.static('/tmp/avatars'));
    app.use('/services', express.static('/tmp/services'));
    app.use('/vehicles', express.static('/tmp/vehicles'));
    app.use('/temp', express.static('/tmp/temp'));
} else {
    app.use('/avatars', express.static(path.join(webPath, 'images/avatars')));
    app.use('/services', express.static(path.join(webPath, 'images/services')));
    app.use('/vehicles', express.static(path.join(webPath, 'images/vehicles')));
    app.use('/temp', express.static(path.join(webPath, 'images/temp')));
}

// Đảm bảo luôn log ra đường dẫn web files để dễ debug
console.log(`Serving static files from: ${webPath}`);


// Cấu hình CORS - cho phép cả hai origin

const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://suaxe-web-73744.web.app', 'https://suaxe-web-73744.firebaseapp.com', '*'] 
    : ['http://localhost:3001', 'http://127.0.0.1:5501'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

/*
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['*'] // Cho phép tất cả nguồn truy cập API (hoặc chỉ định nguồn cụ thể)  // ['https://yourwebsite.com'] 
    : ['http://localhost:3001', 'http://127.0.0.1:5501', 'http://localhost:5501',
       'http://localhost:5500', 'http://127.0.0.1:5500',
       'https://yourwebsite.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Cho phép gửi cookies qua các domain khác nhau
};
app.use(cors(corsOptions));
*/

// Thêm cấu hình session và passport sau cấu hình cors
app.use(session({
  secret: auth0Config.secret,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', 
    maxAge: 24 * 60 * 60 * 1000 // 24 giờ
  }
}));

// Khởi tạo Passport
app.use(passport.initialize());
app.use(passport.session());

// Cấu hình Auth0 Strategy (sử dụng giá trị từ file .env)
passport.use(new Auth0Strategy(
  {
    domain: process.env.AUTH0_DOMAIN || 'suaxenhanh.us.auth0.com',
    clientID: process.env.AUTH0_CLIENT_ID || 'fuxcsqHDZ09CcqXWqPHy2SdLmqb0Qetv',
    clientSecret: process.env.AUTH0_CLIENT_SECRET || 'qnkXXVIe3ceWcU43jrbKNP3ymnEPR_s3IB37Kj-Mzry1fDMx-kGWgxFylRW8GDR7',
    // Thay đổi dòng này, đừng ghép nối đường dẫn
    callbackURL: 'http://localhost:3001/api/auth0/callback'
  },
  function(accessToken, refreshToken, extraParams, profile, done) {
    return done(null, profile);
  }
));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

// Cấu hình parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware log để debug
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// CẤU HÌNH KẾT NỐI DATABASE
const pool = mysql.createPool({
  // host: process.env.DB_HOST || 'localhost',
  host: process.env.DB_HOST || '34.124.218.251',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'websuaxe',
  port: process.env.DB_PORT || 3301,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Kiểm tra kết nối database
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Kết nối MySQL thành công!');
    connection.release();
  } catch (error) {
    console.error('❌ Lỗi kết nối MySQL:', error);
    console.error('Vui lòng kiểm tra thông tin kết nối database');
    // process.exit(1); // Thoát ứng dụng nếu không kết nối được database
  }
})();

// CẤU HÌNH API ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/mechanics', mechanicsRoutes); // Thêm routes cho kỹ thuật viên
app.use('/api/auth', authRoutes);
app.use('/api/auth0', auth0Routes); // Thêm route Auth0/Google
app.use('/api/services', serviceRoutes);
app.use('/api/users', profileRoutes); // Thêm route profile
app.use('/api/images', imageRoutes); // Thêm route upload hình ảnh
// API ENDPOINTS

// API TEST & PROTECTED
// API test
app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'API đang hoạt động!' });
});

app.get('/profile.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/profile.html'));
});

app.get('/thong-tin-ca-nhan.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/profile.html'));
});

// Nếu bạn cũng muốn trang profile có thể được truy cập qua /SuaXe, thêm route này
app.get('/SuaXe/profile.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/profile.html'));
});

app.get('/SuaXe/thong-tin-ca-nhan.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/profile.html'));
});

// Route cho trang quản lý doanh thu (admin)
app.get('/admin-revenue', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin-revenue.html'));
});

app.get('/admin-revenue.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin-revenue.html'));
});

app.get('/admin/revenue', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin-revenue.html'));
});

// Add this with your other HTML routes
app.get('/admin-schedules', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin-schedules.html'));
});

app.get('/admin-schedules.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin-schedules.html'));
});

app.get('/admin/schedules', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin-schedules.html'));
});

// API ví dụ yêu cầu xác thực
app.get('/api/protected-example', authenticateToken, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Bạn đã đăng nhập thành công', 
    user: req.user 
  });
});

// API DASHBOARD
app.get('/api/dashboard/data', authenticateToken, async (req, res) => {
  try {
    // Lấy dữ liệu từ database
    const dashboardData = {
      success: true,
      dashboard: {
        totalBookings: 10,  // Thay bằng dữ liệu thực từ database
        completedBookings: 5,
        cancelledBookings: 2
      }
    };
    res.json(dashboardData);
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu dashboard:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server: ' + error.message 
    });
  }
}); 

// API admin dashboard - thống kê đặt lịch
app.get('/api/booking/admin/dashboard', authenticateToken, checkAdminAccess, async (req, res) => {
  try {
    // Lấy tổng số lịch hẹn
    const [totalRows] = await pool.query(
      'SELECT COUNT(*) as count FROM Appointments'
    );
    
    // Lấy số lịch hẹn đang chờ xác nhận
    const [pendingRows] = await pool.query(
      'SELECT COUNT(*) as count FROM Appointments WHERE Status = "Pending"'
    );
    
    // Lấy số lịch hẹn đã xác nhận
    const [confirmedRows] = await pool.query(
      'SELECT COUNT(*) as count FROM Appointments WHERE Status = "Confirmed"'
    );
    
    // Lấy số lịch hẹn đã hoàn thành
    const [completedRows] = await pool.query(
      'SELECT COUNT(*) as count FROM Appointments WHERE Status = "Completed"'
    );
    
    // Log kết quả để debug
    console.log('Dashboard data:', {
      total: totalRows[0].count,
      pending: pendingRows[0].count,
      confirmed: confirmedRows[0].count,
      completed: completedRows[0].count
    });
    
    res.json({
      success: true,
      stats: {
        total: totalRows[0].count,
        pending: pendingRows[0].count,
        confirmed: confirmedRows[0].count,
        completed: completedRows[0].count
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy thống kê đặt lịch:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server: ' + error.message 
    });
  }
});

// API lịch hẹn gần đây cho dashboard
app.get('/api/admin/dashboard/recent-booking', authenticateToken, checkAdminAccess, async (req, res) => {
  try {
    // Lấy 5 lịch hẹn gần đây nhất
    const [bookings] = await pool.query(`
      SELECT a.*, u.FullName, u.PhoneNumber, 
             (SELECT GROUP_CONCAT(s.ServiceName SEPARATOR ', ') 
              FROM AppointmentServices ap 
              JOIN Services s ON ap.ServiceID = s.ServiceID 
              WHERE ap.AppointmentID = a.AppointmentID) AS Services
      FROM Appointments a
      LEFT JOIN Users u ON a.UserID = u.UserID
      ORDER BY a.AppointmentDate DESC
      LIMIT 5
    `);
    
    res.json({
      success: true,
      bookings: bookings
    });
  } catch (error) {
    console.error('Lỗi khi lấy lịch hẹn gần đây:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server: ' + error.message 
    });
  }
});

// API admin dashboard - tổng quan
app.get('/api/admin/dashboard/summary', authenticateToken, checkAdminAccess, async (req, res) => {
  try {
    // Lấy ngày và năm hiện tại
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    // Lấy thông tin lịch hẹn hôm nay
    const [todayAppointments] = await pool.query(
      'SELECT COUNT(*) as count FROM Appointments WHERE DATE(AppointmentDate) = ?',
      [today]
    );
    
    // Lấy tổng doanh thu tháng
    const [monthlyRevenue] = await pool.query(
      'SELECT SUM(Amount) as total FROM Payments WHERE MONTH(PaymentDate) = ? AND YEAR(PaymentDate) = ? AND Status = "Completed"',
      [currentMonth, currentYear]
    );
    
    // Lấy tổng số khách hàng
    const [customersCount] = await pool.query(
      'SELECT COUNT(*) as count FROM Users WHERE RoleID = 2'
    );
    
    // Lấy số lịch hẹn đang chờ xử lý
    const [pendingAppointments] = await pool.query(
      'SELECT COUNT(*) as count FROM Appointments WHERE Status = "Pending"'
    );
    
    // Lấy doanh thu theo tháng trong năm hiện tại
    const [revenueData] = await pool.query(`
      SELECT 
        MONTH(p.PaymentDate) as month,
        SUM(p.Amount) as revenue
      FROM Payments p
      WHERE p.Status = "Completed"
      AND YEAR(p.PaymentDate) = ?
      GROUP BY MONTH(p.PaymentDate)
      ORDER BY month
    `, [currentYear]);
    
    // Tạo mảng doanh thu theo tháng
    const monthlyRevenueData = Array(12).fill(0);
    revenueData.forEach(item => {
      if (item.month >= 1 && item.month <= 12) {
        monthlyRevenueData[item.month - 1] = parseFloat(item.revenue || 0);
      }
    });
    
    // Lấy dữ liệu dịch vụ phổ biến
    const [servicesData] = await pool.query(`
      SELECT 
        s.ServiceName,
        COUNT(aps.AppointmentServiceID) as serviceCount
      FROM Services s
      JOIN AppointmentServices aps ON s.ServiceID = aps.ServiceID
      JOIN Appointments a ON aps.AppointmentID = a.AppointmentID
      WHERE a.Status = 'Completed'
      GROUP BY s.ServiceID
      ORDER BY serviceCount DESC
      LIMIT 5
    `);
    
    // Tạo dữ liệu cho biểu đồ dịch vụ
    const serviceLabels = servicesData.map(item => item.ServiceName);
    const serviceValues = servicesData.map(item => item.serviceCount);
    
    res.json({
      success: true,
      data: {
        todayAppointments: todayAppointments[0].count,
        monthlyRevenue: monthlyRevenue[0].total || 0,
        totalCustomers: customersCount[0].count,
        pendingAppointments: pendingAppointments[0].count,
        revenueData: {
          values: monthlyRevenueData
        },
        serviceData: {
          labels: serviceLabels,
          values: serviceValues
        }
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu dashboard:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server: ' + error.message 
    });
  }
});

// API ADMIN BOOKING
// API lịch hẹn gần đây cho trang admin-booking
app.get('/api/booking/admin/recent-bookings', authenticateToken, checkAdminAccess, async (req, res) => {
  try {
    // Lấy số lượng lịch hẹn (mặc định 10)
    const limit = req.query.limit || 10;
    
    // Lấy lịch hẹn gần đây
    const [bookings] = await pool.query(`
      SELECT a.*, u.FullName, u.PhoneNumber, v.LicensePlate, v.Brand, v.Model,
             (SELECT GROUP_CONCAT(s.ServiceName SEPARATOR ', ') 
              FROM AppointmentServices ap 
              JOIN Services s ON ap.ServiceID = s.ServiceID 
              WHERE ap.AppointmentID = a.AppointmentID) AS Services
      FROM Appointments a
      LEFT JOIN Users u ON a.UserID = u.UserID
      LEFT JOIN Vehicles v ON a.VehicleID = v.VehicleID
      ORDER BY a.AppointmentDate DESC
      LIMIT ?
    `, [parseInt(limit)]);
    
    res.json({
      success: true,
      bookings: bookings
    });
  } catch (error) {
    console.error('Lỗi khi lấy lịch hẹn gần đây:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server: ' + error.message 
    });
  }
});

// API lấy danh sách kỹ thuật viên cho trang admin-booking
app.get('/api/admin/mechanics', authenticateToken, checkAdminAccess, async (req, res) => {
  try {
    // Lấy danh sách kỹ thuật viên (RoleID = 3)
    const [mechanics] = await pool.query(`
      SELECT UserID, FullName, Email, PhoneNumber, CreatedAt
      FROM Users
      WHERE RoleID = 3
      ORDER BY FullName
    `);
    
    res.json({
      success: true,
      mechanics: mechanics
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách kỹ thuật viên:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server: ' + error.message 
    });
  }
});

// API lấy danh sách lịch hẹn
app.get('/api/booking/appointments', authenticateToken, checkAdminAccess, async (req, res) => {
  try {
    // Xử lý tham số lọc
    const { dateFrom, dateTo, status } = req.query;
    let queryConditions = [];
    let queryParams = [];

    if (dateFrom) {
      queryConditions.push('DATE(a.AppointmentDate) >= ?');
      queryParams.push(dateFrom);
    }

    if (dateTo) {
      queryConditions.push('DATE(a.AppointmentDate) <= ?');
      queryParams.push(dateTo);
    }

    if (status) {
      queryConditions.push('a.Status = ?');
      queryParams.push(status);
    }

    // Xây dựng câu truy vấn
    let query = `
      SELECT a.*, u.FullName, u.PhoneNumber, v.LicensePlate, v.Brand, v.Model,
          (SELECT GROUP_CONCAT(s.ServiceName SEPARATOR ', ') 
          FROM AppointmentServices ap 
          JOIN Services s ON ap.ServiceID = s.ServiceID 
          WHERE ap.AppointmentID = a.AppointmentID) AS Services
      FROM Appointments a
      LEFT JOIN Users u ON a.UserID = u.UserID
      LEFT JOIN Vehicles v ON a.VehicleID = v.VehicleID
    `;

    // Thêm điều kiện lọc nếu có
    if (queryConditions.length > 0) {
      query += ' WHERE ' + queryConditions.join(' AND ');
    }

    // Thêm sắp xếp
    query += ' ORDER BY a.AppointmentDate DESC';

    // Thực hiện query
    const [appointments] = await pool.query(query, queryParams);

    res.json({
      success: true,
      appointments
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách lịch hẹn:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server: ' + error.message
    });
  }
});

// API lấy chi tiết lịch hẹn
app.get('/api/booking/appointments/:id', authenticateToken, async (req, res) => {
  try {
    const appointmentId = req.params.id;

    // Lấy thông tin lịch hẹn từ database
    const [appointments] = await pool.query(`
      SELECT a.*, u.FullName, u.PhoneNumber, u.Email, v.LicensePlate, v.Brand, v.Model
      FROM Appointments a
      LEFT JOIN Users u ON a.UserID = u.UserID
      LEFT JOIN Vehicles v ON a.VehicleID = v.VehicleID
      WHERE a.AppointmentID = ?
    `, [appointmentId]);

    if (appointments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    const appointment = appointments[0];

    // Kiểm tra quyền truy cập - chỉ admin hoặc chủ lịch hẹn mới được xem
    if (req.user.role !== 1 && req.user.userId !== appointment.UserID) {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền truy cập lịch hẹn này'
      });
    }

    // Lấy thông tin dịch vụ của lịch hẹn
    const [services] = await pool.query(`
      SELECT as2.*, s.ServiceName, s.Price, s.EstimatedTime 
      FROM AppointmentServices as2
      JOIN Services s ON as2.ServiceID = s.ServiceID
      WHERE as2.AppointmentID = ?
    `, [appointmentId]);

    appointment.services = services;

    res.json({
      success: true,
      appointment
    });
  } catch (error) {
    console.error('Lỗi khi lấy chi tiết lịch hẹn:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server: ' + error.message
    });
  }
});

// API cập nhật lịch hẹn
app.put('/api/booking/appointments/:id', authenticateToken, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const { status, notes, mechanicId, appointmentDate } = req.body;

    // Kiểm tra lịch hẹn có tồn tại không
    const [appointments] = await pool.query('SELECT * FROM Appointments WHERE AppointmentID = ?', [appointmentId]);
    
    if (appointments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    const appointment = appointments[0];

    // Kiểm tra quyền - chỉ admin hoặc chủ lịch hẹn mới được cập nhật
    if (req.user.role !== 1 && req.user.userId !== appointment.UserID) {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền cập nhật lịch hẹn này'
      });
    }

    // Cập nhật thông tin
    const updateFields = [];
    const updateParams = [];

    if (status) {
      updateFields.push('Status = ?');
      updateParams.push(status);
    }

    if (notes !== undefined) {
      updateFields.push('Notes = ?');
      updateParams.push(notes);
    }

    // Admin có thể cập nhật thêm
    if (req.user.role === 1) {
      if (mechanicId !== undefined) {
        updateFields.push('MechanicID = ?');
        updateParams.push(mechanicId || null);
      }

      if (appointmentDate) {
        updateFields.push('AppointmentDate = ?');
        updateParams.push(appointmentDate);
      }
    }

    // Thêm ID lịch hẹn vào danh sách tham số
    updateParams.push(appointmentId);

    // Thực hiện cập nhật
    if (updateFields.length > 0) {
      await pool.query(
        `UPDATE Appointments SET ${updateFields.join(', ')} WHERE AppointmentID = ?`,
        updateParams
      );
    }

    res.json({
      success: true,
      message: 'Cập nhật lịch hẹn thành công'
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật lịch hẹn:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server: ' + error.message
    });
  }
});

// API hủy lịch hẹn
app.post('/api/booking/appointments/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    
    // Kiểm tra lịch hẹn có tồn tại không
    const [appointments] = await pool.query('SELECT * FROM Appointments WHERE AppointmentID = ?', [appointmentId]);
    
    if (appointments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    const appointment = appointments[0];

    // Kiểm tra quyền - chỉ admin hoặc chủ lịch hẹn mới được hủy
    if (req.user.role !== 1 && req.user.userId !== appointment.UserID) {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền hủy lịch hẹn này'
      });
    }

    // Kiểm tra trạng thái hiện tại
    if (appointment.Status === 'Completed') {
      return res.status(400).json({
        success: false,
        message: 'Không thể hủy lịch hẹn đã hoàn thành'
      });
    }

    // Cập nhật trạng thái
    await pool.query('UPDATE Appointments SET Status = ? WHERE AppointmentID = ?', ['Canceled', appointmentId]);

    res.json({
      success: true,
      message: 'Hủy lịch hẹn thành công'
    });
  } catch (error) {
    console.error('Lỗi khi hủy lịch hẹn:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server: ' + error.message
    });
  }
});

// API SERVICES
// API lấy danh sách dịch vụ
app.get('/api/services', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Services');
    res.json({
      success: true,
      services: rows
    });
  } catch (error) {
    console.error('Lỗi khi lấy dịch vụ:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server: ' + error.message 
    });
  }
});

// API cập nhật thông tin dịch vụ
app.put('/api/services/:id', authenticateToken, checkAdminAccess, async (req, res) => {
  try {
    const serviceId = req.params.id;
    const { ServiceName, Description, Price, EstimatedTime, EstimatedTimeHours } = req.body;
    
    // Kiểm tra dữ liệu đầu vào
    if (!ServiceName) {
      return res.status(400).json({
        success: false,
        message: 'Tên dịch vụ không được để trống'
      });
    }
    
    if (Price === undefined || Price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Giá dịch vụ không hợp lệ'
      });
    }
    
    if (EstimatedTime === undefined || EstimatedTime <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian dự kiến không hợp lệ'
      });
    }
    
    await pool.query(
      'UPDATE Services SET ServiceName = ?, Description = ?, Price = ?, EstimatedTime = ?, EstimatedTimeHours = ? WHERE ServiceID = ?',
      [ServiceName, Description || null, Price, EstimatedTime, EstimatedTimeHours || null, serviceId]
    );
    
    res.json({ 
      success: true, 
      message: 'Cập nhật dịch vụ thành công' 
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật dịch vụ:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server: ' + error.message 
    });
  }
});

// API xóa dịch vụ
app.delete('/api/services/:id', authenticateToken, checkAdminAccess, async (req, res) => {
  try {
    const serviceId = req.params.id;
    
    // Kiểm tra xem dịch vụ có tồn tại không
    const [serviceCheck] = await pool.query('SELECT * FROM Services WHERE ServiceID = ?', [serviceId]);
    
    if (serviceCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy dịch vụ'
      });
    }
    
    // Kiểm tra xem dịch vụ có đang được sử dụng trong lịch hẹn không
    const [appointmentCheck] = await pool.query('SELECT COUNT(*) as count FROM AppointmentServices WHERE ServiceID = ?', [serviceId]);
    
    if (appointmentCheck[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa dịch vụ đã được sử dụng trong lịch hẹn'
      });
    }
    
    // Xóa dịch vụ từ database
    await pool.query('DELETE FROM Services WHERE ServiceID = ?', [serviceId]);
    
    res.json({ 
      success: true, 
      message: 'Xóa dịch vụ thành công' 
    });
  } catch (error) {
    console.error('Lỗi khi xóa dịch vụ:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server: ' + error.message 
    });
  }
});

// API tạo dịch vụ mới
app.post('/api/services', authenticateToken, checkAdminAccess, async (req, res) => {
  try {
    const { ServiceName, Description, Price, EstimatedTime, EstimatedTimeHours } = req.body;
    
    // Kiểm tra dữ liệu đầu vào
    if (!ServiceName) {
      return res.status(400).json({
        success: false,
        message: 'Tên dịch vụ không được để trống'
      });
    }
    
    if (Price === undefined || Price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Giá dịch vụ không hợp lệ'
      });
    }
    
    if (EstimatedTime === undefined || EstimatedTime <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian dự kiến không hợp lệ'
      });
    }
    
    const [result] = await pool.query(
      'INSERT INTO Services (ServiceName, Description, Price, EstimatedTime, EstimatedTimeHours) VALUES (?, ?, ?, ?, ?)',
      [ServiceName, Description || null, Price, EstimatedTime, EstimatedTimeHours || null]
    );
    
    res.status(201).json({
      success: true,
      message: 'Thêm dịch vụ thành công',
      ServiceID: result.insertId
    });
  } catch (error) {
    console.error('Lỗi khi thêm dịch vụ:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi server: ' + error.message 
    });
  }
});

// STATIC ROUTES - TRANG NGƯỜI DÙNG

// Routes cho trang kỹ thuật viên
app.get('/mechanic-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/mechanic-dashboard.html'));
});

app.get('/ky-thuat-vien.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/mechanic-dashboard.html'));
});

// Route cho trang lịch làm việc kỹ thuật viên
app.get('/mechanic-schedule.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/mechanic-schedule.html'));
});

app.get('/lich-lam-viec.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/mechanic-schedule.html'));
});

// Route cho trang lịch hẹn kỹ thuật viên
app.get('/mechanic-appointments.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/mechanic-appointments.html'));
});

app.get('/lich-hen.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/mechanic-appointments.html'));
});

// Route cho trang hồ sơ kỹ thuật viên
app.get('/mechanic-profile.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/mechanic-profile.html'));
});

// Phục vụ file tĩnh từ thư mục Web
app.use(express.static(path.join(__dirname, '../Web')));
app.use('/SuaXe', express.static(path.join(__dirname, '../Web')));
app.use('/images', express.static(path.join(__dirname, '../Web/images')));

// TRANG NGƯỜI DÙNG
// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/index.html'));
});

// Route cho trang đăng nhập/đăng ký
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/login.html'));
});

app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/register.html'));
});

// Route cho trang đặt lịch
app.get('/booking.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/booking.html'));
});

app.get('/dat-lich.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/booking.html'));
});

// Route cho trang lịch sử đặt lịch
app.get('/booking-history.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/booking-history.html'));
});

app.get('/lich-su-dat-lich.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/booking-history.html'));
});

// Route cho trang dịch vụ
app.get('/dichvu.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/dichvu.html'));
});

// Route cho trang tin tức
app.get('/tintuc.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/tintuc.html'));
});

// Route cho trang liên hệ
app.get('/lienhe.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/lienhe.html'));
});

// Route cho trang upload
app.get('/upload-frame.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/upload-frame.html'));
});

// TRANG ADMIN
// Route cho trang admin chính
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin.html'));
});

// Route cho trang quản lý dịch vụ (admin)
app.get('/admin-services', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin-services.html'));
});

app.get('/admin-services.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin-services.html'));
});

app.get('/admin/services', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin-services.html'));
});

// Route cho trang quản lý đặt lịch (admin)
app.get('/admin-booking', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin-booking.html'));
});

app.get('/admin-booking.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin-booking.html'));
});

app.get('/admin/booking', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin-booking.html'));
});

// Route cho trang quản lý lịch làm việc (admin)
app.get('/admin-schedules', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin-schedules.html'));
});

app.get('/admin-schedules.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin-schedules.html'));
});

app.get('/admin/schedules', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin-schedules.html'));
});

// Route cho trang quản lý người dùng (admin)
app.get('/admin-users', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin-users.html'));
});

app.get('/admin-users.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin-users.html'));
});

app.get('/admin/users', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin-users.html'));
});

// SUAXE ROUTES - ROUTES VỚI PREFIX /SUAXE
// Route cho /SuaXe
app.get('/SuaXe', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/index.html'));
});

app.get('/SuaXe/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/index.html'));
});

// Route cho /SuaXe/login.html
app.get('/SuaXe/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/login.html'));
});

// Route cho /SuaXe/admin
app.get('/SuaXe/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin.html'));
});

app.get('/SuaXe/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin.html'));
});

// Route cho /SuaXe/admin/services
app.get('/SuaXe/admin/services', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin-services.html'));
});

app.get('/SuaXe/admin-services.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Web/admin-services.html'));
});

// ERROR HANDLING
// Xử lý lỗi 404
app.use((req, res) => {
  console.log(`404 Not Found: ${req.url}`);
  res.status(404).json({
    success: false,
    message: 'Trang không tồn tại'
  });
});

// Xử lý lỗi chung
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Lỗi server: ' + (err.message || 'Unknown error')
  });
});

app.set('log level', 'error'); // Chỉ hiển thị lỗi nghiêm trọng

// Khởi động server app
// Thành đoạn này để làm việc với App Engine:
const PORT = process.env.PORT || 8080; // Google Cloud App Engine sử dụng cổng 8080
app.listen(PORT, () => {
  console.log(`
  ===============================================
  ✅ Server đang chạy tại port ${PORT}
  ✅ Kết nối DB đến ${process.env.DB_HOST}:${process.env.DB_PORT}
  📌 API endpoints:
  - API test: /api/test
  - Dịch vụ: /api/services
  ===============================================
  `);
});
// Khởi động server web
/*
app.listen(PORT, () => {
  console.log(`
  ===============================================
  ✅ Server đang chạy tại http://localhost:${PORT}
      Server chạy tại cổng ${PORT}
  
  📌 API endpoints:
  - API test: http://localhost:${PORT}/api/test
  - Dịch vụ: http://localhost:${PORT}/api/services
  - Xác thực: http://localhost:${PORT}/api/auth/login, /register
  - Đặt lịch: http://localhost:${PORT}/api/booking/...
  - Kỹ thuật viên: http://localhost:${PORT}/api/mechanics/...
  
  📄 Trang web:
  - Trang chủ: http://localhost:${PORT}
  - Đặt lịch: http://localhost:${PORT}/dat-lich.html
  - Lịch sử đặt lịch: http://localhost:${PORT}/lich-su-dat-lich.html
  - Admin: http://localhost:${PORT}/admin
  - Kỹ thuật viên: http://localhost:${PORT}/mechanic-dashboard.html
  ===============================================
  `);
});
*/

// Exports for testing
module.exports = app;