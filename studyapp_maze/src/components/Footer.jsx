// src/components/Footer.jsx
import React, { useState } from "react";
import "./Footer.css";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [idea, setIdea] = useState("");
  const [sending, setSending] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      // TODO: nếu có API thật thì gọi ở đây:
      // await api.post("/feedback/", { email, content: idea });
      await new Promise((r) => setTimeout(r, 700)); // mô phỏng gửi

      // Hiện toast cảm ơn
      setToastOpen(true);
      setEmail("");
      setIdea("");

      // Tự ẩn sau 2.2s
      setTimeout(() => setToastOpen(false), 2200);
    } finally {
      setSending(false);
    }
  };

  return (
    <footer className="footer">
      <div className="newsletter">
        <p className="newsletter-title">
          Mọi góp ý của các bạn về chúng tôi xin gửi về biểu mẫu dưới đây
        </p>
        <p className="newsletter-sub">Bạn có thể hủy đăng ký bất cứ lúc nào.</p>

        {/* đổi sang form + state để bắt sự kiện submit */}
        <form className="newsletter-form" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-label="Email"
          />
          <input
            type="text"
            placeholder="Ý kiến của bạn..."
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            required
            aria-label="Ý kiến đóng góp"
          />
          <button type="submit" disabled={sending}>
            {sending ? "⏳ Đang gửi…" : "Gửi"}
          </button>
        </form>
      </div>

      <div className="footer-columns">
        <div className="footer-column">
          <h4>Về chúng tôi</h4>
          <p>Nhà sáng tạo: Ngô Tuấn Kiệt</p>
          <p>Học sinh trường THPT Nguyễn An Ninh</p>
          <p>Địa chỉ: 93 Trần Nhân Tôn, Phường Vườn Lài, thành phố Hồ Chí Minh </p>
          <p>GVHD: Cô Nguyễn Ngọc Bảo Trân</p>
        </div>
        <div className="footer-column">
          <h4>Liên hệ với chúng tôi</h4>
          <p>Sđt: 0778001899</p>
          <p>Email: ntkiet5102008@gmail.com</p>
        </div>
        <div className="footer-column">
          <h4>Phương tiện truyền thông</h4>
          <p>
            <a
              href="https://www.instagram.com/kitvoi.kt/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Instagram
            </a>
          </p>
          <p>
            <a
              href="https://www.facebook.com/ngo.kiet.458042/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Facebook
            </a>
          </p>
        </div>
      </div>

      <div className="footer-bottom">
        <img src="/image/maze-delvin.png" alt="Logo" />
        <p>Maze Delvin © 2025</p>
      </div>

      {/* Toast cảm ơn */}
      {toastOpen && (
        <div className="toast toast-success" role="status" aria-live="polite">
          <span className="checkmark" aria-hidden>
            ✔
          </span>
          <span>Cảm ơn bạn vì lời góp ý quý báu! 💛</span>
        </div>
      )}
    </footer>
  );
}
