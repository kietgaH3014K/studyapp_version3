import React from "react";
import "./lichhoc.css"

const subjects = [
  { name: "môn", color: "#f7cdfa" },
  { name: "môn", color: "#f8c0b2" },
  { name: "môn", color: "#fff5a3" },
  { name: "môn", color: "#c9f7b3" },
  { name: "môn", color: "#b7f5f9" },
  { name: "môn", color: "#a5c6fa" },
];

const Schedule = () => {
  return (
    <div className="schedule-container">
      {/* Sidebar */}
      <div className="sidebar">
        <h3>Lịch trình</h3>
        <div className="subjects">
          {subjects.map((subject, index) => (
            <div
              key={index}
              className="subject-card"
              style={{ backgroundColor: subject.color }}
            >
              {subject.name}
            </div>
          ))}
        </div>
        <div className="scroll-arrow">➝</div>
      </div>

      {/* Main schedule area */}
      <div className="main">
        <button className="create-btn">Tạo lịch</button>
        <div className="calendar">
          {[...Array(6)].map((_, index) => (
            <div className="day-card" key={index}>
              <p>Ngày</p>
              <hr />
            </div>
          ))}
        </div>
        <button className="chat-ai-btn">chat với AI</button>
      </div>
    </div>
  );
};

export default Schedule;
