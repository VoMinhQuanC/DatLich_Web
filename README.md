<div align="center">
  <h1>🏍️ VQTBIKE - Motorbike Repair Service Backend</h1>
  <p>A comprehensive API backend for managing motorbike repair bookings, schedules, payments, and real-time notifications.</p>

  <!-- Badges -->
  <img src="https://img.shields.io/badge/Node.js-18.x-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-4.22.1-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
  <img src="https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL" />
  <img src="https://img.shields.io/badge/Socket.io-4.8.3-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io" />
</div>

<br />

## 📖 Overview

**VQTBIKE Backend** is a robust, scalable, MVC-structured RESTful API designed to power a modern motorbike repair service platform. It provides endpoints for customer booking management, mechanic scheduling, administrative dashboards, and secure authentication. 

The application uses **MySQL** as its primary database, **Firebase Cloud Messaging (FCM)** and **Socket.io** for real-time notifications, and **Cloudinary** for scalable media storage.

---

## 🚀 Key Features

### 🔐 Authentication & Authorization
- **JWT & Passport.js:** Secure login/registration with Bcrypt password hashing.
- **OAuth 2.0:** Google Sign-In integration via **Auth0**.
- **Role-Based Access Control (RBAC):** Distinct privileges for `Admin`, `Customer`, `Receptionist`, and `Mechanic`.
- **Password Recovery:** Forgot/Reset password flows via securely generated OTPs/Links using **Nodemailer**.

### 📅 Booking & Services
- Full CRUD operations for vehicle repair bookings.
- Dynamic service management and pricing.
- Booking status tracking pipeline (`Pending` → `Confirmed` → `In Progress` → `Completed`).

### 👨‍🔧 Mechanic Management
- Work schedule generation and tracking.
- Daily attendance logging.
- Assignment of mechanics to specific repair tasks.

### 💳 Payments & Analytics
- Payment proof uploads stored securely on **Cloudinary**.
- Comprehensive Admin dashboards and APIs for tracking revenue and business metrics.

### 🔔 Real-Time Capabilities
- Live status updates to connected clients using **Socket.io**.
- Mobile/Web push notifications delivered via **Firebase Admin SDK**.

---

## 🛠️ Technology Stack

| Category          | Technology |
|-------------------|------------|
| **Runtime**       | Node.js (v18+) |
| **Framework**     | Express.js |
| **Database**      | MySQL (via `mysql2/promise` pool) |
| **Authentication**| JSON Web Tokens (JWT), Passport.js, Auth0 |
| **Real-Time**     | Socket.io, Firebase Cloud Messaging (FCM) |
| **File Storage**  | Cloudinary, Multer |
| **Email Service** | Nodemailer |
| **Views System**  | EJS (Embedded JavaScript) |

---

## 📁 Architecture & Project Structure

The codebase strictly follows the **MVC (Model-View-Controller)** pattern combined with a **Service Layer** to decouple complex business logic from HTTP request handling.

```text
suaxe-backend/
├── app/
│   ├── controllers/    # Express route handlers (Admin, Auth, Client, Core, Mechanic)
│   ├── services/       # Core business logic and database interactions
│   ├── models/         # Data schemas and database query abstractions
│   ├── routes/         # API endpoint definitions mapped to controllers
│   └── views/          # EJS templates for server-rendered UI and Email templates
├── config/             # DB connections, Auth0 config, and Cloudinary setups
├── public/             # Static assets (CSS, JS, frontend images)
├── api-server.js       # Main application entry point & middleware bindings
├── socket-service.js   # WebSocket initialization and native event handling
└── package.json        # Project metadata, scripts, and dependencies
```

---

## 🚦 Getting Started

### Prerequisites
- Node.js `v18.x` or higher
- MySQL Server (`v8.x` recommended)

### 1. Clone the Repository
```bash
git clone <your_github_repo_url>
cd suaxe-backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory and populate it with your environment credentials:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=vqtbike
DB_PORT=3306

# Authentication Secrets
JWT_SECRET=your_super_secret_jwt_key
SESSION_SECRET=your_express_session_secret
ADMIN_SECRET_KEY=admin_registration_bypass_key

# Email Configuration (Nodemailer)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Auth0 (Google Login)
AUTH0_DOMAIN=your_auth0_domain
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_CALLBACK_URL=http://localhost:5000/api/auth0/callback

# Cloudinary (Image Uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_secret

# Server Port
PORT=5000
```
*(Note: You will also need to place your `firebase-service-account.json` in the `config/` directory to enable FCM Push Notifications).*

### 4. Run the Server

**For Development (Auto-reloads server upon file changes):**
```bash
npm run dev
```

**For Production:**
```bash
npm start
```

If successful, the console will display:
```text
🚀 ============================================
🔥 SERVER ĐANG CHẠY TẠI PORT: 5000
🔗 URL: http://localhost:5000
============================================ 🚀
```

---

## 🌐 Main API Route Summary

- **Authentication:**  `/api/auth/...`, `/api/auth0/...`
- **Clients & Vehicles:** `/api/users/...`, `/api/users/vehicles/...`
- **Bookings & Services:** `/api/bookings/...`, `/api/services/...`
- **Mechanics:** `/api/mechanic/...`, `/api/schedules/...`, `/api/attendance/...`
- **Payments:** `/api/payments/...`, `/api/payment-proof/...`
- **Admin Metrics:** `/api/admin/dashboard/...`, `/api/revenue/...`
- **Uploads:** `/api/upload/...`
- **Socket.io:** Connect via WS connection to `ws://localhost:5000`

---

<div align="center">
  <i>Developed and Maintained by Vo Minh Quan</i>
</div>
