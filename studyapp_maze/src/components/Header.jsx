import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../api";
import "./Header.css";

export default function Header() {
  const [username, setUsername] = useState(localStorage.getItem("username") || "");
  const location = useLocation();
  

  useEffect(() => {
    // Đồng bộ giữa các tab & khi code nơi khác bắn sự kiện
    const onStorage = (e) => {
      if (e.key === "username") setUsername(e.newValue || "");
    };
    const onAuthChanged = () => setUsername(localStorage.getItem("username") || "");

    window.addEventListener("storage", onStorage);
    window.addEventListener("auth-changed", onAuthChanged);

    // Đồng bộ ngay khi load lần đầu theo session hiện tại
    (async () => {
      try {
        const { data } = await api.get("/me/");
        if (data?.username) {
          localStorage.setItem("username", data.username);
        } else {
          localStorage.removeItem("username");
        }
        setUsername(localStorage.getItem("username") || "");
      } catch {
        // ignore
      }
    })();

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("auth-changed", onAuthChanged);
    };
  }, []);

  return (
    <header className="header-wrapper">
      <div className="header">
        <div className="header-container">
          <img src="/image/maze-delvin.png" alt="Logo" className="logo" />

          <nav className="nav-links">
            <Link to="/" className={location.pathname === "/" ? "active" : ""}>Trang chủ</Link>
            <Link to="/roadmap" className={location.pathname === "/roadmap" ? "active" : ""}>Lộ trình</Link>
            <Link to="/schedule" className={location.pathname === "/schedule" ? "active" : ""}>Lịch học</Link>
            <Link to="/review" className={location.pathname === "/review" ? "active" : ""}>Đánh giá</Link>
            <Link to="/about" className={location.pathname === "/about" ? "active" : ""}>Giới thiệu</Link>
            <Link to="/chat" className={location.pathname === "/chat" ? "active" : ""}>Chat</Link>
          </nav>

          {/* BỎ nút Đăng xuất ở header */}
          <div className="user-section">
            {username ? (
              <nav className="nav-links">
                <Link to="/account" className={location.pathname === "/account" ? "active" : ""}>
                  Xin chào, {username}
                </Link>
              </nav>
            ) : (
              <nav className="nav-links">
                <Link to="/account" className={location.pathname === "/account" ? "active" : ""}>
                  Tài khoản
                </Link>
              </nav>
            )}
          </div>
        </div>
      </div>

      <div className="hero-section">
        <img src="/image/nen.jpg" alt="Background" className="hero-background" />
        <div className="hero-content">
          <h1 style={{ fontSize: "64px", margin: 0 }}>STUDY APP</h1>
          <p style={{ fontSize: "24px", marginTop: "10px" }}>
            Hỗ trợ bạn xây dựng lộ trình học tập cá nhân hóa
          </p>
        </div>
      </div>
    </header>
  );
}
