// src/pages/Review.jsx
import React, { useEffect, useState } from "react";
import api, { initCsrf } from "../api";
import "./Review.css";

export default function Review() {
  const [formData, setFormData] = useState({
    class_level: "",
    subject: "",
    study_time: "",
    goal: "",
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [csrfReady, setCsrfReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [username, setUsername] = useState("");
  
  // Kiểm tra authentication status
  useEffect(() => {
    checkAuthStatus();
  }, []);
  
  const checkAuthStatus = async () => {
    try {
      const response = await api.get("/me/");
      if (response.data.username) {
        setIsAuthenticated(true);
        setUsername(response.data.username);
        console.log("✅ User authenticated:", response.data.username);
      } else {
        setIsAuthenticated(false);
        console.log("❌ User not authenticated");
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      setIsAuthenticated(false);
    } finally {
      setCheckingAuth(false);
    }
  };
  
  // Lấy CSRF token ngay khi mount
  useEffect(() => {
    (async () => {
      try {
        await initCsrf();
        setCsrfReady(true);
        console.log("✅ CSRF token initialized");
      } catch (e) {
        console.error("❌ CSRF init failed:", e);
        setCsrfReady(false);
      }
    })();
  }, []);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((s) => ({ ...s, [name]: value }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    
    // Check authentication lần nữa
    if (!isAuthenticated) {
      // Re-check authentication
      await checkAuthStatus();
      if (!isAuthenticated) {
        setMsg("❌ Bạn cần đăng nhập để sử dụng tính năng này. Vui lòng đăng nhập ở trang Đăng nhập.");
        return;
      }
    }
    
    const { class_level, subject, study_time, goal } = formData;
    
    // Validate input
    if (!class_level || !subject || !study_time || !goal) {
      setMsg("⚠️ Vui lòng điền đầy đủ thông tin.");
      return;
    }
    
    setLoading(true);
    
    try {
      console.log("📤 Sending request with data:", formData);
      console.log("👤 Current user:", username);
      
      const res = await api.post("/generate-learning-path/", {
        class_level,
        subject,
        study_time,
        goal,
      });
      
      console.log("✅ Success response:", res.data);
      setMsg("✅ Đã tạo lộ trình học thành công!");
      
      // Reset form
      setFormData({ 
        class_level: "", 
        subject: "", 
        study_time: "", 
        goal: "" 
      });
      
      // Notify other components
      window.dispatchEvent(new Event("plan-updated"));
      
      // Hiển thị một phần kết quả nếu có
      if (res.data.items && res.data.items.length > 0) {
        console.log(`📚 Đã tạo ${res.data.items.length} mục trong lộ trình`);
      }
      
    } catch (error) {
      console.error("❌ Full error object:", error);
      console.error("Response data:", error?.response?.data);
      console.error("Response status:", error?.response?.status);
      console.error("Response headers:", error?.response?.headers);
      
      // Handle different error scenarios
      if (!error.response) {
        // Network error
        setMsg("❌ Lỗi kết nối. Kiểm tra kết nối mạng và thử lại.");
        
      } else if (error.response.status === 401) {
        // Not authenticated - session might have expired
        setMsg("❌ Phiên đăng nhập đã hết hạn. Vui lòng tải lại trang và đăng nhập lại.");
        setIsAuthenticated(false);
        setUsername("");
        // Re-check auth status
        checkAuthStatus();
        
      } else if (error.response.status === 403) {
        // CSRF token issue
        console.log("🔄 CSRF error, attempting to refresh token...");
        
        try {
          await initCsrf();
          console.log("🔄 CSRF refreshed, retrying request...");
          
          const retry = await api.post("/generate-learning-path/", {
            class_level,
            subject,
            study_time,
            goal,
          });
          
          console.log("✅ Retry successful:", retry.data);
          setMsg("✅ Đã tạo lộ trình học thành công!");
          setFormData({ 
            class_level: "", 
            subject: "", 
            study_time: "", 
            goal: "" 
          });
          window.dispatchEvent(new Event("plan-updated"));
          return;
          
        } catch (retryError) {
          console.error("❌ Retry failed:", retryError);
          setMsg("❌ Lỗi xác thực. Vui lòng tải lại trang.");
        }
        
      } else if (error.response.status === 429) {
        // Rate limit
        setMsg("⚠️ Quá nhiều yêu cầu. Vui lòng đợi một chút và thử lại.");
        
      } else if (error.response.status === 500) {
        // Server error
        const errorMsg = error.response.data?.error || "Lỗi server";
        const errorDetails = error.response.data?.details || "";
        
        console.error("🔴 Server error message:", errorMsg);
        console.error("🔴 Server error details:", errorDetails);
        
        if (errorMsg.includes("API key") || errorMsg.includes("xác thực")) {
          setMsg("❌ Lỗi cấu hình server (API key). Vui lòng liên hệ admin.");
        } else if (errorMsg.includes("GPT") || errorMsg.includes("AI")) {
          setMsg("❌ Không thể kết nối với AI service. Vui lòng thử lại sau.");
        } else if (errorMsg.includes("DEEPINFRA_API_KEY")) {
          setMsg("❌ Lỗi API key chưa được cấu hình. Vui lòng liên hệ admin.");
        } else {
          setMsg(`❌ ${errorMsg}${errorDetails ? ` - ${errorDetails.substring(0, 100)}` : ''}`);
        }
        
      } else {
        // Other errors
        const serverMsg = 
          error.response.data?.error ||
          error.response.data?.detail ||
          error.response.data?.message ||
          `Lỗi ${error.response.status}`;
          
        setMsg(`❌ ${serverMsg}`);
      }
      
    } finally {
      setLoading(false);
    }
  };
  
  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="review-container">
        <p>⏳ Đang kiểm tra trạng thái đăng nhập...</p>
      </div>
    );
  }
  
  // Main render
  return (
    <div className="review-container">
      <h2>ĐÁNH GIÁ TRÌNH ĐỘ HỌC TẬP</h2>
      
      {/* Show authentication status */}
      {isAuthenticated ? (
        <div className="auth-status success">
          ✅ Xin chào, {username}!
        </div>
      ) : (
        <div className="auth-status warning">
          ⚠️ Bạn cần đăng nhập để sử dụng tính năng này.
          <p style={{ fontSize: '14px', marginTop: '10px' }}>
            Vui lòng sử dụng menu "Đăng nhập" để đăng nhập vào hệ thống.
          </p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="review-form">
        <label>Bạn đang ở lớp mấy?</label>
        <select
          name="class_level"
          value={formData.class_level}
          onChange={handleChange}
          disabled={loading || !isAuthenticated}
          required
        >
          <option value="">--Chọn lớp--</option>
          <option value="10">Lớp 10</option>
          <option value="11">Lớp 11</option>
          <option value="12">Lớp 12</option>
        </select>
        
        <label>Bạn muốn cải thiện môn nào?</label>
        <input
          type="text"
          name="subject"
          placeholder="Ví dụ: Tin học, Toán, Tiếng Anh…"
          value={formData.subject}
          onChange={handleChange}
          disabled={loading || !isAuthenticated}
          required
        />
        
        <label>Thời gian học mỗi ngày</label>
        <select
          name="study_time"
          value={formData.study_time}
          onChange={handleChange}
          disabled={loading || !isAuthenticated}
          required
        >
          <option value="">--Chọn thời gian--</option>
          <option value="30 phút">30 phút</option>
          <option value="1 giờ">1 giờ</option>
          <option value="2 giờ">2 giờ</option>
          <option value="3 giờ">3 giờ</option>
        </select>
        
        <label>Mô tả mục tiêu học tập</label>
        <textarea
          name="goal"
          placeholder="Ví dụ: Nắm vững Python cơ bản, đạt 8.0 môn Toán…"
          value={formData.goal}
          onChange={handleChange}
          rows={4}
          disabled={loading || !isAuthenticated}
          required
        />
        
        <button 
          type="submit" 
          disabled={loading || !csrfReady || !isAuthenticated}
        >
          {loading 
            ? "⏳ Đang tạo lộ trình…" 
            : !isAuthenticated 
              ? "🔐 Vui lòng đăng nhập trước"
              : "🚀 Gửi đánh giá & Tạo lộ trình"
          }
        </button>
      </form>
      
      {msg && (
        <div className={`status-msg ${msg.includes('❌') ? 'error' : msg.includes('⚠️') ? 'warning' : 'success'}`}>
          {msg}
        </div>
      )}
      
      {/* Debug info - chỉ hiển thị trong development */}
      {process.env.NODE_ENV === 'development' && (
        <details style={{ marginTop: 20, fontSize: 12 }}>
          <summary>Debug Info</summary>
          <pre>{JSON.stringify({ 
            isAuthenticated, 
            username,
            csrfReady, 
            loading, 
            formData 
          }, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}