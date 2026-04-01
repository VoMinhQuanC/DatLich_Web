// suaxe.js - Các chức năng chung cho website sửa xe

document.addEventListener('DOMContentLoaded', function() {
    // Kiểm tra và hiển thị đúng thông tin đăng nhập nếu có
    checkLoginStatus();
    
    // Nếu trang hiện tại là trang dịch vụ (/dichvu), load dịch vụ
    if (window.location.pathname.includes('/dichvu')) {
        loadDichVu();
    }
    
    /**
     * Kiểm tra trạng thái đăng nhập
     */
    function checkLoginStatus() {
        const token = localStorage.getItem('token');
        const userInfo = localStorage.getItem('user');
        
        // Kiểm tra xem có phần tử authButtons trong trang không
        const authButtons = document.getElementById('authButtons');
        const userInfoHeader = document.getElementById('userInfoHeader');
        
        if (!authButtons || !userInfoHeader) {
            return; // Không có phần tử này trong trang
        }
        
        if (token && userInfo) {
            try {
                const user = JSON.parse(userInfo);
                
                // Hiển thị thông tin người dùng
                const userAvatarSmall = document.getElementById('userAvatarSmall');
                const userNameSmall = document.getElementById('userNameSmall');
                
                if (userAvatarSmall && userNameSmall) {
                    userAvatarSmall.textContent = user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U';
                    userNameSmall.textContent = user.fullName || 'Người dùng';
                }
                
                // Hiển thị/ẩn các phần giao diện
                authButtons.style.display = 'none';
                userInfoHeader.style.display = 'block';
                
                // Xử lý sự kiện đăng xuất nếu có nút đăng xuất
                const logoutBtn = document.getElementById('logoutBtn');
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', function() {
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        window.location.reload();
                    });
                }
            } catch (error) {
                console.error('Lỗi xử lý thông tin người dùng:', error);
                // Xóa dữ liệu không hợp lệ
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        } else {
            // Chưa đăng nhập
            if (authButtons && userInfoHeader) {
                authButtons.style.display = 'block';
                userInfoHeader.style.display = 'none';
            }
        }
    }
    
    /**
     * Load dịch vụ từ API
     */
    async function loadDichVu() {
        try {
            console.log("Đang tải dữ liệu dịch vụ...");
            // Đảm bảo URL API chính xác
            const response = await fetch("http://localhost:3000/api/services");
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            const dichVuList = await response.json();
            console.log("Dữ liệu dịch vụ:", dichVuList);
    
            const danhSachDichVu = document.getElementById("danhSachDichVu");
            if (!danhSachDichVu) {
                console.log("Không tìm thấy phần tử danhSachDichVu");
                return;
            }
            
            let content = "";
            if (dichVuList && dichVuList.length > 0) {
                dichVuList.forEach(dv => {
                    // Kiểm tra xem có hình ảnh không
                    const imageHtml = dv.ServiceImage 
                        ? `<img src="${dv.ServiceImage}" alt="${dv.ServiceName}" class="service-image">`
                        : `<div class="service-image-placeholder">Chưa có ảnh</div>`;
                    
                    content += `
                        <div class="col-md-4 service-item">
                            ${imageHtml}
                            <h3>${dv.ServiceName || 'Chưa có tên'}</h3>
                            <p>${dv.Description || 'Không có mô tả'}</p>
                            <p class="price">Giá: ${(dv.Price || 0).toLocaleString()} VND</p>
                            <p class="time">Thời gian dự kiến: ${dv.EstimatedTime || '?'} phút</p>
                        </div>
                    `;
                });
            } else {
                content = "<div class='col-12'><p>Không có dịch vụ nào.</p></div>";
            }
    
            danhSachDichVu.innerHTML = content;
    
        } catch (error) {
            console.error("Lỗi khi tải dịch vụ:", error);
            const danhSachDichVu = document.getElementById("danhSachDichVu");
            if (danhSachDichVu) {
                danhSachDichVu.innerHTML = 
                    "<div class='col-12'><p class='text-danger'>Lỗi khi tải dữ liệu: " + error.message + "</p></div>";
            }
        }
    }
});
