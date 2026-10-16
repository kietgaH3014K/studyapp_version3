import React from "react";
import { Link } from "react-router-dom";
import "./Dashboard.css";

export default function Dashboard() {
  const username = localStorage.getItem("username") || "bạn";

  const cards = [
    { 
      image: "/image/chatAI.png", 
      title: "Chat với AI", 
      to: "/chat", 
      cta: "Trò chuyện",
      description: "Trò chuyện với AI, lưu thành file dạng .txt hoặc xoá cuộc trò chuyện khi cần."
    },
    { 
      image: "/image/danhgia.png", 
      title: "Phiếu đánh giá mục tiêu học tập", 
      to: "/review", 
      cta: "Bắt đầu",
      description: "Thực hiện đánh giá mục tiêu học tập bạn muốn hoàn thành trong 28 ngày sắp tới."
    },
    { 
      image: "/image/lichhoc.jpg", 
      title: "Theo dõi lộ trình học tập", 
      to: "/roadmap", 
      cta: "Theo dõi lộ trình",
      description: "AI sẽ tự động tạo sinh lộ trình 28 ngày dựa trên phiếu đánh giá và bạn có thể cập nhật trạng thái hoàn thành từng ngày."
    },
    { 
      image: "/image/plan.jpg", 
      title: "Lịch học", 
      to: "/schedule", 
      cta: "Xem lịch",
      description: "Dựa trên lộ trình đã xây dựng, hệ thống sẽ phân bổ thành các ngày trong tuần để bạn tiện theo dõi tiến trình."
    },
  ];

  return (
    <section className="dashboard">
      {/* Banner chào */}
      <div className="dash-hero">
        <div className="dash-hero__text">
          <h2>
            Xin chào, <span className="username">{username}</span> ˙✧˖°🎓 ༘⋆｡ ˚ 
          </h2>
          <p>
            <strong>"Học, học nữa, học mãi" - Lênin.</strong> Mỗi người nên chủ động tìm kiếm và kiên trì học tập tiếp thu kiến thức mới để tạo nên những cơ hội mới cho tương lai của mình. 
            Chúc bạn có một ngày học tập vô cùng hiệu quả. Hãy bắt đầu với các công cụ của Study App bên dưới nhé!
          </p>
        </div>
      </div>

      {/* Lưới card tính năng */}
      <div className="card-grid">
        {cards.map((card, idx) => (
          <Link to={card.to} className="card" key={idx} aria-label={card.title}>
            <div className="card__image">
              <img src={card.image} alt={card.title} />
            </div>
            <div className="card__body">
              <h3 className="card__title">{card.title}</h3>
              <p className="card__description">{card.description}</p>
              <span className="card__cta">{card.cta}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}