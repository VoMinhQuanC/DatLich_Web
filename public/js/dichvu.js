// dichvu.js - JavaScript cho trang dịch vụ

document.addEventListener('DOMContentLoaded', function() {
    // Sử dụng API_CONFIG từ config.js (được load trước)
    const API_BASE_URL = window.API_CONFIG ? window.API_CONFIG.BASE_URL : 'http://localhost:3001/api';
    
    // Tải dịch vụ ngay khi trang được tải
    loadServices();
    
    // Kiểm tra trạng thái đăng nhập
    // checkLoginStatus();
    
    // Thêm sự kiện tìm kiếm dịch vụ
    const searchInput = document.getElementById('searchService');
    const searchButton = document.getElementById('searchButton');
    
    if (searchInput && searchButton) {
        searchButton.addEventListener('click', filterServices);
        searchInput.addEventListener('input', filterServices);
    }
    
    /**
     * Tải danh sách dịch vụ từ API
     */
    async function loadServices() {
        const servicesContainer = document.getElementById('danhSachDichVu');
        if (!servicesContainer) return;
        
        try {
            // Hiển thị spinner khi đang tải
            servicesContainer.innerHTML = `
                <div class="col-12 text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Đang tải...</span>
                    </div>
                    <p class="mt-2">Đang tải dịch vụ...</p>
                </div>
            `;
            
            // Gọi API để lấy danh sách dịch vụ
            const response = await fetch(`${API_BASE_URL}/services`);
            
            if (!response.ok) {
                throw new Error(`Lỗi kết nối: ${response.status}`);
            }
            
            const data = await response.json();
            console.log("Data API trả về:", data); // Log để debug
            
            // Kiểm tra cấu trúc dữ liệu và lấy mảng dịch vụ
            const services = data.services || data;
            console.log("Services được trích xuất:", services); // Log để debug
            
            // Render danh sách dịch vụ
            renderServices(services);
            
        } catch (error) {
            console.error("Lỗi khi tải dịch vụ:", error);
            
            // Hiển thị thông báo lỗi
            servicesContainer.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-danger">
                        <p>Không thể tải dịch vụ: ${error.message}</p>
                        <button class="btn btn-outline-primary mt-2" onclick="loadServices()">Thử lại</button>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Lấy URL đầy đủ của hình ảnh
     * @param {string} imageSource - Đường dẫn nguồn hình ảnh
     * @returns {string} URL đầy đủ của hình ảnh
     */
    function getImageUrl(imageSource) {
        if (!imageSource) return 'images/service-placeholder.jpg';

        // Nếu link đầy đủ (đã có http)
        if (imageSource.startsWith('http')) {
            return imageSource;
        }

        // Tải ảnh từ thư mục public/images/services (đã được cấu hình express local)
        return `images/services/${imageSource}`;
    }

    /**
     * Render danh sách dịch vụ
     * @param {Array} services - Mảng các dịch vụ
     */
    function renderServices(services) {
        const servicesContainer = document.getElementById('danhSachDichVu');
        if (!servicesContainer) return;
        
        // Kiểm tra và xử lý nếu không có dịch vụ
        if (!services || services.length === 0) {
            servicesContainer.innerHTML = `
                <div class="col-12 text-center">
                    <div class="alert alert-info">
                        Hiện tại chưa có dịch vụ nào.
                    </div>
                </div>
            `;
            return;
        }

        // Tạo HTML cho các dịch vụ - THÊM data-service-id và onclick
        const servicesHTML = services.map(service => {
            const imageUrl = getImageUrl(service.ServiceImage);
            const serviceId = service.ServiceID || service.id;

            return `
                <div class="col-md-4 mb-4 service-item-wrapper" 
                     data-service-name="${service.ServiceName.toLowerCase()}"
                     data-service-id="${serviceId}">
                    <div class="service-item clickable-service" onclick="goToBooking(${serviceId})">
                        <div style="height: 200px; background-color: #f5f5f5; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 15px; overflow: hidden;">
                            <img src="${imageUrl}"
                                alt="${service.ServiceName}"
                                onerror="this.onerror=null; this.src='images/service-placeholder.jpg';"
                                style="width: 100%; height: 100%; object-fit: cover;"
                                class="service-image">
                        </div>
                        <div class="service-content">
                            <h3 class="service-title">${service.ServiceName}</h3>
                            <p class="service-desc">${service.Description || 'Không có mô tả chi tiết'}</p>
                            <div class="service-info">
                                <p class="service-price">
                                    Giá: <span class="price">${formatCurrency(service.Price)} VND</span>
                                </p>
                                <p class="service-time">
                                    Thời gian dự kiến: ${formatTime(service.EstimatedTime)} phút
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        servicesContainer.innerHTML = servicesHTML;
    }

    /**
     * Chuyển sang trang đặt lịch với serviceId
     * @param {number} serviceId - ID của dịch vụ được chọn
     */
    window.goToBooking = function(serviceId) {
        // Chuyển hướng sang trang booking với parameter serviceId
        window.location.href = `/booking?serviceId=${serviceId}`;
    }

    /**
     * Lọc dịch vụ theo từ khóa tìm kiếm
     */
    function filterServices() {
        const searchTerm = document.getElementById('searchService').value.toLowerCase().trim();
        const serviceItems = document.querySelectorAll('.service-item-wrapper');
        
        serviceItems.forEach(item => {
            const serviceName = item.getAttribute('data-service-name');
            
            // Hiển thị hoặc ẩn dịch vụ dựa trên từ khóa tìm kiếm
            if (serviceName.includes(searchTerm)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    /**
     * Định dạng tiền tệ
     * @param {number} amount - Số tiền
     * @returns {string} Số tiền đã được định dạng
     */
    function formatCurrency(amount) {
        return amount ? Number(amount).toLocaleString('vi-VN') : '0';
    }
    
    /**
     * Định dạng thời gian
     * @param {number} minutes - Số phút
     * @returns {string} Thời gian đã được định dạng
     */
    function formatTime(minutes) {
        return minutes || '?';
    }
    
    /**
     * Kiểm tra trạng thái đăng nhập
     */
    // function checkLoginStatus() {
    //     const token = localStorage.getItem('token');
    //     const userStr = localStorage.getItem('user');
        
    //     console.log('Token:', token ? 'Có' : 'Không');
    //     console.log('User data:', userStr);
        
    //     if (token && userStr) {
    //         try {
    //             const user = JSON.parse(userStr);
    //             console.log('Người dùng đã đăng nhập:', user.fullName);
                
    //             // Cập nhật UI trực tiếp
    //             if (authButtons) {
    //                 authButtons.style.cssText = 'display: none !important';
    //                 console.log('Đã ẩn nút đăng nhập');
    //             }
                
    //             if (userInfoHeader) {
    //                 userInfoHeader.style.cssText = 'display: block !important';
    //                 console.log('Đã hiện dropdown người dùng');
    //             }
                
    //             // Cập nhật thông tin người dùng
    //             if (userAvatarSmall) {
    //                 userAvatarSmall.textContent = getFirstLetter(user.fullName);
    //             }
    //             if (userNameSmall) {
    //                 userNameSmall.textContent = user.fullName || 'Người dùng';
    //             }
                
    //             // Gọi hàm cập nhật UI đầy đủ
    //             updateUIForLoggedInUser(user);
    //         } catch (error) {
    //             console.error('Lỗi phân tích cú pháp dữ liệu người dùng:', error);
    //             updateUIForLoggedOutUser();
    //         }
    //     } else {
    //         console.log('Người dùng chưa đăng nhập');
            
    //         // Cập nhật UI trực tiếp
    //         if (authButtons) {
    //             authButtons.style.cssText = 'display: flex !important';
    //             console.log('Đã hiện nút đăng nhập');
    //         }
            
    //         if (userInfoHeader) {
    //             userInfoHeader.style.cssText = 'display: none !important';
    //             console.log('Đã ẩn dropdown người dùng');
    //         }
            
    //         updateUIForLoggedOutUser();
    //     }
    // }
    
    /**
     * Reset trạng thái đăng nhập
     */
    function resetAuthState() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        const authButtons = document.getElementById('authButtons');
        const userInfoHeader = document.getElementById('userInfoHeader');
        
        if (authButtons) authButtons.style.display = 'block';
        if (userInfoHeader) userInfoHeader.style.display = 'none';
    }
    
    /**
     * Lấy chữ cái đầu tiên từ chuỗi
     * @param {string} fullName - Tên đầy đủ
     * @returns {string} Chữ cái đầu tiên
     */
    function getFirstLetter(fullName) {
        return fullName ? fullName.charAt(0).toUpperCase() : 'U';
    }

    // Xuất các hàm để có thể gọi từ bên ngoài nếu cần
    window.loadServices = loadServices;
});








/*
    const servicesHTML = services.map(service => {
        const imageUrl = service.ServiceImage && service.ServiceImage.startsWith('http')
            ? service.ServiceImage
            : 'images/service-placeholder.jpg';


        return `
            <div class="col-md-4 mb-4 service-item-wrapper" data-service-name="${service.ServiceName.toLowerCase()}">
                <div class="service-item">
                    <div style="height: 200px; background-color: #f5f5f5; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 15px; overflow: hidden;">
                        <img src="${imageUrl}"
                            alt="${service.ServiceName}"
                            onerror="this.onerror=null; this.src='images/service-placeholder.jpg';"
                            style="width: 100%; height: 100%; object-fit: cover;"
                            class="service-image">
                    </div>
                    <div class="service-content">
                        <h3 class="service-title">${service.ServiceName}</h3>
                        <p class="service-desc">${service.Description || 'Không có mô tả chi tiết'}</p>
                        <div class="service-info">
                            <p class="service-price">
                                Giá: <span class="price">${formatCurrency(service.Price)} VND</span>
                            </p>
                            <p class="service-time">
                                Thời gian dự kiến: ${formatTime(service.EstimatedTime)} phút
                            </p>
                        </div>
                    </div>
                </div>y
            </div>
        `;
    }).join('');
*/