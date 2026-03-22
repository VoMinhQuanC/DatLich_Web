// File: socket-service.js
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');

let io;
const userSockets = new Map(); 

function initializeSocket(server) {
  io = socketIO(server, {
    cors: {
      // ✅ CẢI TIẾN 1: Cho phép tất cả các nguồn trong quá trình dev để test Real-time dễ hơn
      origin: "*", 
      methods: ["GET", "POST"],
      credentials: true
    },
    // ✅ CẢI TIẾN 2: Ép sử dụng websocket trước để nhanh và ổn định hơn
    transports: ['websocket', 'polling']
  });

  // Middleware xác thực
  io.use((socket, next) => {
    // Kiểm tra token từ nhiều nguồn khác nhau (auth object hoặc headers)
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    
    if (!token) {
      console.log('❌ [Socket] Từ chối: Không tìm thấy Token');
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sua_xe_secret_key_railway_2024');
      socket.userId = decoded.userId;
      socket.roleId = decoded.role || decoded.roleId;
      socket.userName = decoded.userName || decoded.email || 'User';
      next();
    } catch (err) {
      console.log('❌ [Socket] Xác thực thất bại:', err.message);
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🚀 [Socket] Người dùng Online: ${socket.userName} (ID: ${socket.userId})`);
    
    userSockets.set(String(socket.userId), socket.id);

    // Join room theo role
    const rooms = { 1: 'admin', 2: 'customer', 3: 'mechanic' };
    const roleRoom = rooms[socket.roleId] || 'customer';
    
    socket.join(roleRoom);
    socket.join(`user_${socket.userId}`); 
    
    console.log(`📍 [Socket] User ${socket.userId} đã vào phòng: ${roleRoom} và user_${socket.userId}`);

    socket.on('disconnect', () => {
      console.log(`\| [Socket] Người dùng Offline: ID ${socket.userId}`);
      userSockets.delete(String(socket.userId));
    });
  });

  return io;
}

// ✅ CẢI TIẾN 3: Đảm bảo ép kiểu String cho ID để khớp tên Room
function emitNewAppointment(appointmentData) {
  if (!io) return;
  
  // Gửi cho admin
  io.to('admin').emit('new_appointment', { data: appointmentData });

  // Gửi cho thợ (Dùng String để chắc chắn khớp room)
  if (appointmentData.MechanicID) {
    io.to(`user_${String(appointmentData.MechanicID)}`).emit('new_task', { data: appointmentData });
  }
}

function emitAppointmentUpdated(appointmentData, previousStatus) {
  if (!io) return;
  
  const event = { data: appointmentData, previousStatus, timestamp: new Date().toISOString() };

  // Gửi cho khách
  io.to(`user_${String(appointmentData.UserID)}`).emit('appointment_updated', event);

  // Gửi cho thợ
  if (appointmentData.MechanicID) {
    io.to(`user_${String(appointmentData.MechanicID)}`).emit('task_updated', event);
  }

  // Gửi cho admin
  io.to('admin').emit('appointment_updated', event);
}

// ... Giữ các hàm khác và nhớ dùng String(id) khi gọi io.to()

module.exports = {
  initializeSocket,
  emitNewAppointment,
  emitAppointmentUpdated,
  // ... export các hàm còn lại
};