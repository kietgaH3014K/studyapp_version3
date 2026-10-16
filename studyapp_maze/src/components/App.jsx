// src/api.js
import axios from "axios";

// Railway backend: dùng domain thật của bạn
// Ví dụ: https://backend-studyapp-production.up.railway.app/api
const BASE_URL = import.meta.env.VITE_API_BASE_URL
  || "https://backend-studyapp-production.up.railway.app/api";

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // QUAN TRỌNG: gửi/nhận cookie cross-site
});

// (tuỳ chọn) tự gắn X-CSRFToken nếu có cookie csrftoken
api.interceptors.request.use((config) => {
  const m = document.cookie.match(/(^| )csrftoken=([^;]+)/);
  if (m) {
    config.headers["X-CSRFToken"] = decodeURIComponent(m[2]);
  }
  return config;
});

export default api;
