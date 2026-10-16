// src/api.js
import axios from "axios";

const BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  "https://backend-studyapp-production.up.railway.app/api";

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
  xsrfCookieName: "csrftoken",
  xsrfHeaderName: "X-CSRFToken",
});


export async function initCsrf() {
  const { data } = await api.get("/csrf/"); 
  if (data && data.csrfToken) {
    api.defaults.headers.common["X-CSRFToken"] = data.csrfToken;
  } else {
    delete api.defaults.headers.common["X-CSRFToken"];
  }
  return data?.csrfToken;
}

export default api;
