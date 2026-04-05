require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const Auth0Strategy = require('passport-auth0');
const { connectDB } = require('./config/db');
const { initializeSocket } = require('./socket-service');

const app = express();
const server = http.createServer(app);

// ==========================================
// 1. KHỞI TẠO KẾT NỐI (DATABASE & SOCKET)
// ==========================================
connectDB();
const io = initializeSocket(server);
app.set('io', io); // Để các Controller có thể gọi: req.app.get('io')

// ==========================================
// 2. MIDDLEWARES CẤU HÌNH GIAO DIỆN (VIEW ENGINE)
// ==========================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'app/views'));

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cấu hình Authentication (Session & Passport)
app.use(session({
  secret: process.env.SESSION_SECRET || 'suaxe_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', 
    maxAge: 24 * 60 * 60 * 1000 // 24 giờ
  }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new Auth0Strategy({
    domain: process.env.AUTH0_DOMAIN || 'suaxenhanh.us.auth0.com',
    clientID: process.env.AUTH0_CLIENT_ID || 'fuxcsqHDZ09CcqXWqPHy2SdLmqb0Qetv',
    clientSecret: process.env.AUTH0_CLIENT_SECRET || 'qnkXXVIe3ceWcU43jrbKNP3ymnEPR_s3IB37Kj-Mzry1fDMx-kGWgxFylRW8GDR7',
    callbackURL: process.env.AUTH0_CALLBACK_URL || 'http://localhost:3001/api/auth0/callback'
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

// Phục vụ file tĩnh từ thư mục public để tránh lệch đường dẫn/casing trên Linux.
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use(express.static(path.join(__dirname, 'public')));


// ==========================================
// 3. KHAI BÁO CÁC ROUTES (HỆ THỐNG MVC)
// ==========================================

// Nhóm 1: Xác thực & Người dùng (Auth)
app.use('/api/auth', require('./app/routes/auth/authRoutes'));
app.use('/api/auth0', require('./app/routes/auth/auth0Routes'));

// Nhóm 2: Chức năng lõi (Core - Khách hàng)
app.use('/api/bookings', require('./app/routes/core/bookingRoutes'));  // alias cũ
app.use('/api/booking', require('./app/routes/core/bookingRoutes'));   // alias mới (admin dùng)
app.use('/api/services', require('./app/routes/core/serviceRoutes'));
const paymentRoutes = require('./app/routes/core/paymentRoutes');
console.log("✅ Payment routes loaded");

app.use('/api/payment', paymentRoutes);
app.use('/api/payment-proof', require('./app/routes/core/paymentProofRoutes'));
app.use('/api/upload', require('./app/routes/core/uploadRoutes'));
app.use('/api/notifications', require('./app/routes/core/notificationRoutes'));
app.use('/api/fcm', require('./app/routes/core/fcmRoutes'));
app.use('/api/images', require('./app/routes/core/imageRoutes'));

// Nhóm 2.5: Quản lý Người dùng (Users)
app.use('/api/users', require('./app/routes/client/userRoutes'));
app.use('/api/users/vehicles', require('./app/routes/client/vehicleRoutes'));

// Nhóm 3: Dành cho Thợ máy (Mechanic)
app.use('/api/mechanic', require('./app/routes/mechanic/mechanicsRoutes'));
app.use('/api/attendance', require('./app/routes/mechanic/attendanceRoutes'));
app.use('/api/schedule', require('./app/routes/mechanic/schedulesRoutes'));   // alias cũ
app.use('/api/schedules', require('./app/routes/mechanic/schedulesRoutes'));  // alias mới (admin dùng)

// Nhóm 4: Dành cho Quản trị (Admin)
app.use('/api/admin/dashboard', require('./app/routes/admin/dashboardRoutes'));
app.use('/api/admin/revenue', require('./app/routes/admin/revenueRoutes'));    // alias cũ
app.use('/api/revenue', require('./app/routes/admin/revenueRoutes'));           // alias mới (admin dùng)
app.use('/api/admin/payment-proofs', require('./app/routes/admin/adminPaymentProofRoutes'));

// Nhóm 5: Router phục vụ Giao diện frontend (EJS Views)
app.use('/', require('./app/routes/viewRoutes'));

// ==========================================
// 4. XỬ LÝ LỖI & KHỞI ĐỘNG SERVER
// ==========================================

// Lỗi 404 cho API
app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, message: 'API Endpoint không tồn tại' });
});

// Lỗi 404 cho Giao diện
app.use((req, res) => {
    res.status(404).render('404');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`
    🚀 ============================================
    🔥 SERVER ĐANG CHẠY TẠI PORT: ${PORT}
    🔗 URL: http://localhost:${PORT}
    📅 THỜI GIAN: ${new Date().toLocaleString()}
    ============================================ 🚀
    `);
});
