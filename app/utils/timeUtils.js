// File: app/utils/timeUtils.js

/**
 * Helper: Chuyển đổi bất kỳ input nào sang đối tượng Date chuẩn Việt Nam
 */
const getVNObject = (dateInput = new Date()) => {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return null;
    // Sử dụng Intl để lấy chuỗi thời gian chuẩn VN, sau đó convert ngược lại Date object
    return new Date(date.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
};

/**
 * Lấy thời gian hiện tại format: YYYY-MM-DD HH:mm:ss
 */
const formatVietnamDateTime = (date = new Date()) => {
    const vn = getVNObject(date);
    if (!vn) return null;
    return vn.getFullYear() + '-' +
        String(vn.getMonth() + 1).padStart(2, '0') + '-' +
        String(vn.getDate()).padStart(2, '0') + ' ' +
        String(vn.getHours()).padStart(2, '0') + ':' +
        String(vn.getMinutes()).padStart(2, '0') + ':' +
        String(vn.getSeconds()).padStart(2, '0');
};

/**
 * Lấy giờ HH:mm từ input (Hỗ trợ ISO string, Date object, HH:mm string)
 */
const parseVietnamTime = (timeInput) => {
    if (!timeInput) return null;
    if (typeof timeInput === 'string' && /^\d{2}:\d{2}/.test(timeInput)) return timeInput.substring(0, 5);

    const vn = getVNObject(timeInput);
    return vn ? `${String(vn.getHours()).padStart(2, '0')}:${String(vn.getMinutes()).padStart(2, '0')}` : null;
};

/**
 * Lấy ngày YYYY-MM-DD từ input
 */
const parseVietnamDate = (dateInput) => {
    if (!dateInput) return null;
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) return dateInput;

    const vn = getVNObject(dateInput);
    return vn ? `${vn.getFullYear()}-${String(vn.getMonth() + 1).padStart(2, '0')}-${String(vn.getDate()).padStart(2, '0')}` : null;
};

/**
 * Tính toán thời gian kết thúc: "08:00" + 60 phút = "09:00"
 */
const calculateEndTime = (startTimeStr, durationMinutes) => {
    const [hours, minutes] = startTimeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes + durationMinutes, 0);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

/**
 * Kiểm tra định dạng
 */
const isValidTimeFormat = (time) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
const isValidDateFormat = (date) => /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date);

module.exports = {
    parseVietnamTime,
    parseVietnamDate,
    formatVietnamDateTime,
    calculateEndTime,
    isValidTimeFormat,
    isValidDateFormat,
    getCurrentVietnamDate: () => parseVietnamDate(new Date()),
    getCurrentVietnamTime: () => parseVietnamTime(new Date())
};