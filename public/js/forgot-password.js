document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgotPasswordForm');
    const submitBtn = document.getElementById('submitButton');
    const spinner = document.getElementById('submitSpinner');
    const successAlert = document.getElementById('success-alert');
    const errorAlert = document.getElementById('error-alert');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        if (!email) {
            showError('Vui lòng nhập email');
            return;
        }

        // Hiện trạng thái loading
        submitBtn.disabled = true;
        spinner.style.display = 'inline-block';
        hideAlerts();

        try {
            const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (data.success) {
                showSuccess(data.message || 'Mật khẩu mới đã được gửi đến email của bạn.');
                form.reset();
            } else {
                showError(data.message || 'Có lỗi xảy ra, vui lòng thử lại.');
            }
        } catch (error) {
            console.error('Lỗi kết nối:', error);
            showError('Lỗi kết nối máy chủ, vui lòng thử lại sau.');
        } finally {
            // Khôi phục nút
            submitBtn.disabled = false;
            spinner.style.display = 'none';
        }
    });

    function showError(message) {
        errorAlert.textContent = message;
        errorAlert.style.display = 'block';
        successAlert.style.display = 'none';
    }

    function showSuccess(message) {
        successAlert.textContent = message;
        successAlert.style.display = 'block';
        errorAlert.style.display = 'none';
    }

    function hideAlerts() {
        errorAlert.style.display = 'none';
        successAlert.style.display = 'none';
    }
});
