// Biến toàn cục để theo dõi trạng thái chatbot
let isChatbotOpen = false;

// Hàm bật/tắt chatbot
function toggleChatbot() {
    const chatbotContainer = document.getElementById("chatbot-container");
    const chatbotIcon = document.getElementById("chatbot-icon");
    
    isChatbotOpen = !isChatbotOpen;
    
    if (isChatbotOpen) {
        chatbotContainer.style.display = "flex";
        chatbotIcon.innerHTML = '<i class="fa-solid fa-times fa-lg"></i>';
        chatbotIcon.style.backgroundColor = "#dc3545"; // Màu đỏ khi mở
    } else {
        chatbotContainer.style.display = "none";
        chatbotIcon.innerHTML = '<i class="fa-solid fa-comment fa-lg"></i>';
        chatbotIcon.style.backgroundColor = "#007bff"; // Màu xanh khi đóng
    }
}

// Các phản hồi của chatbot
const chatbotResponses = {
    "chào": "Xin chào! Tôi có thể giúp gì cho bạn hôm nay?",
    "hello": "Xin chào! Tôi có thể giúp gì cho bạn hôm nay?",
    "hi": "Xin chào! Tôi có thể giúp gì cho bạn hôm nay?",
    "giờ làm việc": "Chúng tôi làm việc từ 8:00 sáng đến 18:00 tối, từ thứ 2 đến thứ 7.",
    "thời gian làm việc": "Chúng tôi làm việc từ 8:00 sáng đến 18:00 tối, từ thứ 2 đến thứ 7.",
    "đặt lịch": "Bạn có thể đặt lịch sửa xe bằng cách nhấn vào nút 'Đặt lịch' trên website hoặc gọi số 0123.456.789.",
    "cảm ơn": "Không có gì! Nếu bạn cần thêm hỗ trợ, cứ hỏi tôi nhé!",
    "tạm biệt": "Cảm ơn bạn! Chúc bạn một ngày tốt lành!",
    "giá dịch vụ": "Chúng tôi có nhiều gói dịch vụ với giá cả khác nhau. Bạn có thể xem chi tiết tại trang 'Dịch vụ'.",
    "địa chỉ": "Cửa hàng chúng tôi ở số 123, đường ABC, quận XYZ, TP.HCM.",
    "default": "Xin lỗi, tôi chưa hiểu câu hỏi này. Bạn có thể hỏi về: giờ làm việc, đặt lịch, địa chỉ hoặc giá dịch vụ."
};

// Hàm xử lý phản hồi từ chatbot
function getChatbotResponse(userMessage) {
    userMessage = userMessage.toLowerCase().trim();
    
    // Kiểm tra từ khóa trong câu hỏi
    for (const keyword in chatbotResponses) {
        if (userMessage.includes(keyword)) {
            return chatbotResponses[keyword];
        }
    }
    
    return chatbotResponses["default"];
}

// Hàm gửi tin nhắn
function sendMessage() {
    const inputField = document.getElementById("chat-input");
    const message = inputField.value.trim();
    const chatBody = document.querySelector(".chatbot-body");

    if (message) {
        // Ẩn quick questions nếu có
        const quickQuestions = document.querySelector('.quick-questions');
        if (quickQuestions) {
            quickQuestions.style.display = 'none';
        }

        // Thêm tin nhắn người dùng
        addMessage(message, "user-message");
        
        // Xóa nội dung input và focus lại
        inputField.value = "";
        inputField.focus();
        
        // Giả lập chatbot "đang nhập"
        const typingIndicator = document.createElement("div");
        typingIndicator.className = "typing-indicator";
        typingIndicator.innerHTML = '<span></span><span></span><span></span>';
        chatBody.appendChild(typingIndicator);
        chatBody.scrollTop = chatBody.scrollHeight;
        
        // Xử lý phản hồi
        processBotResponse(message, chatBody, typingIndicator);
    }
}

function processBotResponse(message, chatBody, typingIndicator) {
    // Thời gian phản hồi ngẫu nhiên 0.8-1.5 giây
    const responseDelay = 800 + Math.random() * 700;
    
    setTimeout(() => {
        // Xóa indicator "đang nhập"
        if (typingIndicator && typingIndicator.parentNode === chatBody) {
            chatBody.removeChild(typingIndicator);
        }
        
        // Lấy phản hồi từ chatbot
        const response = getChatbotResponse(message);
        
        // Hiển thị phản hồi từng từ với hiệu ứng gõ chữ
        if (response) {
            displayTypingEffect(response, chatBody);
        }
        
        // Hiển thị lại quick questions nếu là lần đầu
        showQuickQuestionsAfterResponse();
    }, responseDelay);
}

function displayTypingEffect(text, chatBody) {
    const messageDiv = document.createElement("div");
    messageDiv.className = "chat-message bot-message";
    chatBody.appendChild(messageDiv);
    
    let i = 0;
    const typingSpeed = 20 + Math.random() * 30; // Tốc độ gõ ngẫu nhiên
    
    const typingInterval = setInterval(() => {
        if (i < text.length) {
            messageDiv.textContent = text.substring(0, i + 1);
            chatBody.scrollTop = chatBody.scrollHeight;
            i++;
        } else {
            clearInterval(typingInterval);
        }
    }, typingSpeed);
}

function showQuickQuestionsAfterResponse() {
    const quickQuestions = document.querySelector('.quick-questions');
    if (quickQuestions) {
        // Luôn hiển thị quick questions sau mỗi phản hồi
        quickQuestions.style.display = 'flex';
        
        // Cuộn xuống để người dùng thấy cả quick questions
        const chatBody = document.querySelector(".chatbot-body");
        chatBody.scrollTop = chatBody.scrollHeight;
        
        // Thêm hiệu ứng xuất hiện mượt mà
        quickQuestions.style.opacity = '0';
        quickQuestions.style.transition = 'opacity 0.3s ease';
        
        setTimeout(() => {
            quickQuestions.style.opacity = '1';
        }, 10);
    }
}

// Hàm thêm tin nhắn vào khung chat
function addMessage(text, className) {
    const chatBody = document.querySelector(".chatbot-body");
    const messageDiv = document.createElement("div");
    messageDiv.className = `chat-message ${className}`;
    messageDiv.textContent = text;
    chatBody.appendChild(messageDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
}

// Sự kiện nhấn Enter để gửi tin nhắn
document.getElementById("chat-input").addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
    }
});



function sendQuickQuestion(question) {
    document.getElementById('chat-input').value = question;
    sendMessage();
    
    // Tự động ẩn quick questions sau khi chọn
    const quickQuestions = document.querySelector('.quick-questions');
    if (quickQuestions) {
        quickQuestions.style.display = 'none';
    }
}