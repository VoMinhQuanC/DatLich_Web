// /**
//  * SIMPLE Payment Page - CHI HIEN THI QR, KHONG GOI API
//  * Safe ASCII encoding version
//  */

// console.log('[Payment] Page loading...');

// // Wait for DOM
// document.addEventListener('DOMContentLoaded', function() {
//     console.log('[Payment] DOM loaded');
    
//     // Hide loading, show content
//     document.getElementById('loadingState').style.display = 'none';
//     document.getElementById('paymentContent').style.display = 'block';
    
//     // Get booking data
//     const bookingDataStr = sessionStorage.getItem('bookingData');
//     let bookingData = null;
    
//     if (bookingDataStr) {
//         try {
//             bookingData = JSON.parse(bookingDataStr);
//             console.log('[Payment] Booking data:', bookingData);
//         } catch (e) {
//             console.error('[Payment] Parse error:', e);
//         }
//     }
    
//     // Calculate total
//     let totalAmount = 350000;
//     if (bookingData && bookingData.services) {
//         totalAmount = bookingData.services.reduce((sum, s) => sum + (s.price || 0), 0);
//     }
    
//     console.log('[Payment] Total amount:', totalAmount);
    
//     // Display order info
//     displayOrderInfo(bookingData, totalAmount);
    
//     // Display QR code
//     displayQRCode(totalAmount);
    
//     console.log('[Payment] Ready!');
// });

// /**
//  * Display order info
//  */
// function displayOrderInfo(data, total) {
//     const orderInfo = document.getElementById('orderInfo');
//     if (!orderInfo) return;
    
//     let html = '<div class="mb-3">';
    
//     // Services
//     html += '<h6 class="text-primary mb-2">Dich vu:</h6>';
//     if (data && data.services) {
//         data.services.forEach(s => {
//             html += '<div class="d-flex justify-content-between mb-2">';
//             html += '<span>' + (s.serviceName || 'Dich vu') + '</span>';
//             html += '<span class="fw-bold">' + formatCurrency(s.price || 0) + '</span>';
//             html += '</div>';
//         });
//     } else {
//         html += '<p class="text-muted">Dich vu sua xe</p>';
//     }
//     html += '</div>';
    
//     // Vehicle
//     if (data && data.vehicle) {
//         html += '<div class="mb-3">';
//         html += '<h6 class="text-primary mb-2">Xe:</h6>';
//         html += '<p class="mb-0">' + (data.vehicle.brand || '') + ' ' + (data.vehicle.model || '') + '</p>';
//         html += '<p class="text-muted mb-0">' + (data.vehicle.licensePlate || '') + '</p>';
//         html += '</div>';
//     }
    
//     // DateTime
//     if (data && data.dateTime) {
//         html += '<div class="mb-3">';
//         html += '<h6 class="text-primary mb-2">Thoi gian:</h6>';
//         html += '<p class="mb-0">' + (data.dateTime.date || '') + ' - ' + (data.dateTime.time || '') + '</p>';
//         html += '</div>';
//     }
    
//     // Total
//     html += '<div class="total-section mt-3 p-3">';
//     html += '<div class="d-flex justify-content-between align-items-center">';
//     html += '<h5 class="mb-0 text-white">Tong cong:</h5>';
//     html += '<h4 class="mb-0 text-white fw-bold">' + formatCurrency(total) + '</h4>';
//     html += '</div></div>';
    
//     orderInfo.innerHTML = html;
// }

// /**
//  * Display QR code
//  */
// function displayQRCode(amount) {
//     const qrSection = document.getElementById('paymentQRSection');
//     if (!qrSection) return;
    
//     // Bank info
//     const BANK_CONFIG = {
//         bankId: '970422',
//         bankName: 'MB Bank',
//         accountNo: '0947084064',
//         accountName: 'VO MINH QUAN'
//     };
    
//     // Transfer content
//     const transferContent = 'BK' + Date.now();
    
//     // Generate QR URL (VietQR format)
//     const qrUrl = 'https://img.vietqr.io/image/' + BANK_CONFIG.bankId + '-' + BANK_CONFIG.accountNo + '-compact2.png?amount=' + amount + '&addInfo=' + encodeURIComponent(transferContent) + '&accountName=' + encodeURIComponent(BANK_CONFIG.accountName);
    
//     const html = '\
//         <div class="payment-card">\
//             <div class="payment-header text-center mb-4">\
//                 <h4>\
//                     <i class="bi bi-qr-code me-2"></i>\
//                     Quet ma QR de thanh toan\
//                 </h4>\
//                 <div class="countdown-badge mt-3">\
//                     <i class="bi bi-clock me-2"></i>\
//                     <span id="countdown">15:00</span>\
//                 </div>\
//             </div>\
//             \
//             <div class="row">\
//                 <div class="col-md-6 text-center mb-4">\
//                     <div class="qr-container">\
//                         <img src="' + qrUrl + '" alt="QR Code" class="qr-image" id="qrImage">\
//                     </div>\
//                 </div>\
//                 \
//                 <div class="col-md-6">\
//                     <div class="bank-info-card">\
//                         <h6>\
//                             <i class="bi bi-bank me-2"></i>\
//                             Thong tin chuyen khoan\
//                         </h6>\
//                         \
//                         <div class="info-row">\
//                             <span class="info-label">Ngan hang:</span>\
//                             <span class="info-value">' + BANK_CONFIG.bankName + '</span>\
//                         </div>\
//                         \
//                         <div class="info-row">\
//                             <span class="info-label">So tai khoan:</span>\
//                             <div class="info-value-group">\
//                                 <span class="info-value">' + BANK_CONFIG.accountNo + '</span>\
//                                 <button class="btn btn-sm btn-light" onclick="copyText(\'' + BANK_CONFIG.accountNo + '\')">\
//                                     <i class="bi bi-clipboard"></i>\
//                                 </button>\
//                             </div>\
//                         </div>\
//                         \
//                         <div class="info-row">\
//                             <span class="info-label">Chu tai khoan:</span>\
//                             <span class="info-value">' + BANK_CONFIG.accountName + '</span>\
//                         </div>\
//                         \
//                         <div class="info-row highlight">\
//                             <span class="info-label">So tien:</span>\
//                             <span class="info-value">' + formatCurrency(amount) + '</span>\
//                         </div>\
//                         \
//                         <div class="info-row highlight">\
//                             <span class="info-label">Noi dung CK:</span>\
//                             <div class="info-value-group">\
//                                 <span class="transfer-content">' + transferContent + '</span>\
//                                 <button class="btn btn-sm btn-warning" onclick="copyText(\'' + transferContent + '\')">\
//                                     <i class="bi bi-clipboard"></i>\
//                                 </button>\
//                             </div>\
//                         </div>\
//                     </div>\
//                 </div>\
//             </div>\
//             \
//             <div class="upload-section">\
//                 <h5 class="mb-3">\
//                     <i class="bi bi-cloud-upload me-2"></i>\
//                     Upload anh chung tu\
//                 </h5>\
//                 \
//                 <div class="upload-area" onclick="document.getElementById(\'proofImage\').click()">\
//                     <div class="upload-placeholder" id="uploadPlaceholder">\
//                         <i class="bi bi-image" style="font-size: 3rem; color: #ccc;"></i>\
//                         <p class="mt-3 mb-0">Click de chon anh chung tu</p>\
//                         <p class="text-muted small">Ho tro: JPG, PNG (max 5MB)</p>\
//                     </div>\
//                     <div id="imagePreview" style="display: none;"></div>\
//                 </div>\
//                 \
//                 <input type="file" id="proofImage" accept="image/*" style="display: none;" onchange="previewImage(this)">\
//                 \
//                 <button class="btn btn-primary w-100 mt-3" onclick="uploadProof()">\
//                     <i class="bi bi-send me-2"></i>\
//                     Gui xac nhan thanh toan\
//                 </button>\
//             </div>\
//         </div>\
//     ';
    
//     qrSection.innerHTML = html;
    
//     // Start countdown
//     startCountdown();
// }

// /**
//  * Format currency
//  */
// function formatCurrency(amount) {
//     return new Intl.NumberFormat('vi-VN', {
//         style: 'currency',
//         currency: 'VND'
//     }).format(amount);
// }

// /**
//  * Copy text to clipboard
//  */
// function copyText(text) {
//     navigator.clipboard.writeText(text).then(function() {
//         showToast('Da copy: ' + text, 'success');
//     }).catch(function(err) {
//         console.error('Copy failed:', err);
//         showToast('Khong the copy', 'error');
//     });
// }

// /**
//  * Preview image
//  */
// function previewImage(input) {
//     if (input.files && input.files[0]) {
//         const reader = new FileReader();
        
//         reader.onload = function(e) {
//             const preview = document.getElementById('imagePreview');
//             const placeholder = document.getElementById('uploadPlaceholder');
            
//             preview.innerHTML = '<img src="' + e.target.result + '" alt="Preview" style="max-width: 100%; border-radius: 8px;">';
//             preview.style.display = 'block';
//             placeholder.style.display = 'none';
//         };
        
//         reader.readAsDataURL(input.files[0]);
//     }
// }

// /**
//  * Upload proof (FAKE - chi hien thi success)
//  */
// function uploadProof() {
//     const fileInput = document.getElementById('proofImage');
    
//     if (!fileInput.files || !fileInput.files[0]) {
//         showToast('Vui long chon anh chung tu!', 'error');
//         return;
//     }
    
//     // Show success (FAKE - khong goi API)
//     showToast('Da gui chung tu thanh cong! (Demo)', 'success');
    
//     // Show waiting state after 2s
//     setTimeout(function() {
//         document.getElementById('paymentContent').style.display = 'none';
//         document.getElementById('waitingState').style.display = 'block';
//     }, 2000);
// }

// /**
//  * Show toast notification
//  */
// function showToast(message, type) {
//     type = type || 'success';
//     const toast = document.createElement('div');
//     toast.className = 'toast-notification toast-' + type + ' show';
    
//     const icon = type === 'success' ? 'check-circle' : 'exclamation-circle';
//     toast.innerHTML = '<i class="bi bi-' + icon + ' me-2"></i>' + message;
    
//     document.body.appendChild(toast);
    
//     setTimeout(function() {
//         toast.classList.remove('show');
//         setTimeout(function() { toast.remove(); }, 300);
//     }, 3000);
// }

// /**
//  * Start countdown timer
//  */
// function startCountdown() {
//     let timeLeft = 15 * 60; // 15 minutes
    
//     const countdownEl = document.getElementById('countdown');
//     const badge = document.querySelector('.countdown-badge');
    
//     const interval = setInterval(function() {
//         const minutes = Math.floor(timeLeft / 60);
//         const seconds = timeLeft % 60;
        
//         countdownEl.textContent = minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
        
//         // Warning at 5 minutes
//         if (timeLeft === 5 * 60) {
//             badge.classList.add('countdown-warning');
//         }
        
//         // Danger at 1 minute
//         if (timeLeft === 60) {
//             badge.classList.remove('countdown-warning');
//             badge.classList.add('countdown-danger');
//         }
        
//         if (timeLeft <= 0) {
//             clearInterval(interval);
//             showToast('Het thoi gian thanh toan!', 'error');
//         }
        
//         timeLeft--;
//     }, 1000);
// }

// console.log('[Payment] JS loaded - ASCII safe version');