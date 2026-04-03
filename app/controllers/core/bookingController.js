// File: app/controllers/core/bookingController.js

class BookingController {
    constructor(bookingService) {
        this.bookingService = bookingService;
    }

    // Xử lý lỗi tập trung
    handleError(res, err) {
        console.error('Lỗi API booking:', err);
        const codeMap = {
            'FORBIDDEN': { status: 403, msg: 'Không có quyền truy cập' },
            'NOT_FOUND': { status: 404, msg: 'Không tìm thấy dữ liệu' },
            'MISSING_INFO': { status: 400, msg: 'Thiếu thông tin cần thiết' },
            'MISSING_VEHICLE': { status: 400, msg: 'Vui lòng cung cấp thông tin xe' },
            'MECHANIC_NO_SCHEDULE': { status: 400, msg: 'Kỹ thuật viên không có lịch làm việc trong ngày này' },
            'MECHANIC_BUSY': { status: 400, msg: 'Kỹ thuật viên đã có lịch hẹn trùng thời gian này' },
            'MISSING_DATE': { status: 400, msg: 'Vui lòng cung cấp ngày muốn đặt lịch' },
            'COMPLETED_APPOINTMENT': { status: 400, msg: 'Không thể hủy/đổi lịch hẹn đã hoàn thành' },
            'UPDATE_FAILED': { status: 400, msg: 'Cập nhật thất bại' }
        };
        const errorRes = codeMap[err.message];
        if (errorRes) {
            return res.status(errorRes.status).json({ success: false, message: errorRes.msg });
        }
        return res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }

    getAllAppointments = async (req, res) => {
        try {
            const data = await this.bookingService.getAllAppointments(req.user, req.query);
            res.json({ success: true, ...data });
        } catch (err) {
            this.handleError(res, err);
        }
    };

    getAppointmentById = async (req, res) => {
        try {
            const appointment = await this.bookingService.getAppointmentById(req.params.id, req.user);
            res.json({ success: true, appointment });
        } catch (err) {
            this.handleError(res, err);
        }
    };

    getMyAppointments = async (req, res) => {
        try {
            const appointments = await this.bookingService.getMyAppointments(req.user.userId);
            res.json({ success: true, appointments });
        } catch (err) {
            this.handleError(res, err);
        }
    };

    getDeletedAppointments = async (req, res) => {
        try {
            const data = await this.bookingService.getDeletedAppointments(req.user);
            res.json({ success: true, ...data });
        } catch (err) {
            this.handleError(res, err);
        }
    };

    restoreAppointment = async (req, res) => {
        try {
            await this.bookingService.restoreAppointment(req.params.id, req.user);
            res.json({ success: true, message: 'Khôi phục lịch hẹn thành công' });
        } catch (err) {
            this.handleError(res, err);
        }
    };

    getAdminDashboard = async (req, res) => {
        try {
            const data = await this.bookingService.getAdminDashboard(req.user);
            res.json({ success: true, ...data });
        } catch (err) {
            this.handleError(res, err);
        }
    };

    createAppointment = async (req, res) => {
        try {
            const result = await this.bookingService.createAppointment(req.user.userId, req.body);
            res.status(201).json({ success: true, message: 'Đặt lịch thành công', ...result });
        } catch (err) {
            this.handleError(res, err);
        }
    };

    getAvailableSlots = async (req, res) => {
        try {
            const availableSlots = await this.bookingService.getAvailableSlots(req.query);
            if (availableSlots.length === 0) {
                return res.json({ success: true, availableSlots: [], message: 'Không có kỹ thuật viên làm việc trong ngày này' });
            }
            res.json({ success: true, availableSlots });
        } catch (err) {
            this.handleError(res, err);
        }
    };

    createPayment = async (req, res) => {
        try {
            const result = await this.bookingService.createPayment(req.body);
            res.status(201).json({ success: true, message: 'Tạo thanh toán thành công', ...result });
        } catch (err) {
            this.handleError(res, err);
        }
    };

    deleteAppointmentSoft = async (req, res) => {
        try {
            await this.bookingService.deleteAppointmentSoft(req.params.id, req.user);
            res.json({ success: true, message: 'Xóa lịch hẹn thành công' });
        } catch (err) {
            this.handleError(res, err);
        }
    };

    createAppointmentPayment = async (req, res) => {
        try {
            const result = await this.bookingService.createAppointmentPayment(req.params.id, req.body);
            res.status(201).json({ success: true, message: 'Tạo thanh toán thành công', ...result });
        } catch (err) {
            this.handleError(res, err);
        }
    };

    cancelAppointment = async (req, res) => {
        try {
            await this.bookingService.cancelAppointment(req.params.id, req.user);
            res.json({ success: true, message: 'Hủy lịch hẹn thành công' });
        } catch (err) {
            this.handleError(res, err);
        }
    };

    getMechanics = async (req, res) => {
        try {
            const mechanics = await this.bookingService.getMechanics();
            res.json({ success: true, mechanics });
        } catch (err) {
            this.handleError(res, err);
        }
    };

    getMyVehicles = async (req, res) => {
        try {
            const vehicles = await this.bookingService.getMyVehicles(req.user.userId);
            res.json({ success: true, vehicles });
        } catch (err) {
            this.handleError(res, err);
        }
    };

    getServices = async (req, res) => {
        try {
            const services = await this.bookingService.getServices();
            res.json({ success: true, services });
        } catch (err) {
            this.handleError(res, err);
        }
    };

    updateAppointment = async (req, res) => {
        try {
            const appointment = await this.bookingService.updateAppointment(req.params.id, req.user, req.body);
            res.json({ success: true, message: 'Cập nhật lịch hẹn thành công', appointment });
        } catch (err) {
            this.handleError(res, err);
        }
    };

    createAppointmentUser = async (req, res) => {
        try {
            const appointment = await this.bookingService.createAppointmentUser(req.user, req.body);
            res.status(201).json({ success: true, message: 'Tạo lịch hẹn thành công', appointment });
        } catch (err) {
            this.handleError(res, err);
        }
    };
}

module.exports = BookingController;
