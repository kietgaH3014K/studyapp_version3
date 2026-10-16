// src/pages/Schedule.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api";
import "./Schedule.css";

export default function Schedule() {
  const [scheduleData, setScheduleData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // BE yêu cầu IsAuthenticated -> phải gửi cookie session (withCredentials đã bật trong api.js)
      const { data } = await api.get("/progress/");
      setScheduleData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Load schedule error:", err);
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setError("Bạn chưa đăng nhập. Hãy đăng nhập để xem lộ trình.");
      } else {
        setError("Không thể tải dữ liệu lịch học.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // tải lần đầu
    load();

    // reload khi trang khác vừa tạo/ cập nhật lộ trình
    const onUpdated = () => load();

    // reload khi quay lại tab (phòng trường hợp session/CSRF được refresh ở nơi khác)
    const onVisible = () => {
      if (!document.hidden) load();
    };

    window.addEventListener("plan-updated", onUpdated);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("plan-updated", onUpdated);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const daysOfWeek = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];

  // Nhóm dữ liệu: subject -> week -> [tasks...]
  const grouped = useMemo(() => {
    const g = {};
    for (const item of scheduleData) {
      const subject = item.subject || "Chưa xác định";
      if (!g[subject]) g[subject] = {};
      if (!g[subject][item.week]) g[subject][item.week] = [];
      g[subject][item.week].push(item);
    }
    for (const subject of Object.keys(g)) {
      for (const w of Object.keys(g[subject])) {
        g[subject][w].sort((a, b) => a.day_number - b.day_number);
      }
    }
    return g;
  }, [scheduleData]);

  const SubjectSection = ({ subject, weeks }) => {
    const maxWeek = Math.max(...Object.keys(weeks).map((n) => Number(n)), 0);

    const renderWeek = (weekNumber) => {
      const weekTasks = weeks[weekNumber] || [];
      return (
        <div className="week-block" key={`${subject}-week-${weekNumber}`}>
          <h3 className="week-title">📚 Tuần {weekNumber}</h3>
          <div className="day-grid">
            {daysOfWeek.map((dayName, idx) => {
              const task = weekTasks.find((t) => ((t.day_number - 1) % 7) === idx);

              let desc = "";
              let link = "";
              if (task && typeof task.task_title === "string") {
                if (task.task_title.includes(" | Link tài liệu:")) {
                  const [d, l] = task.task_title.split(" | Link tài liệu:");
                  desc = d.trim();
                  link = (l || "").trim();
                } else {
                  desc = task.task_title;
                }
              }

              const isDone = task?.status === "done";
              const statusClass = isDone ? "done" : "pending";
              const statusText = isDone ? "✅ Hoàn thành" : "🕒 Chưa hoàn thành";

              return (
                <div className={`day-card ${statusClass}`} key={`${subject}-${weekNumber}-${idx}`}>
                  <h4>{dayName}</h4>
                  {task ? (
                    <>
                      <p><strong>{task.subject}</strong></p>
                      <p>{desc}</p>
                      {link && (
                        <p>
                          📘 Tài liệu:{" "}
                          <a href={link} target="_blank" rel="noopener noreferrer" title={link}>
                            {link.length > 60 ? `${link.slice(0, 60)}…` : link}
                          </a>
                        </p>
                      )}
                      <span className={`status-tag ${statusClass}`}>{statusText}</span>
                    </>
                  ) : (
                    <p className="no-task">Không có nội dung</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <section className="subject-section" key={`subject-${subject}`}>
        <h2 className="schedule-title">📘 Môn học: {subject}</h2>
        {[...Array(maxWeek)].map((_, i) => renderWeek(i + 1))}
      </section>
    );
  };

  const subjects = Object.keys(grouped).sort();

  return (
    <section className="schedule-wrapper">
      <div className="schedule-container">
        <h2 className="schedule-title">📅 Lịch học tập theo tuần</h2>
        <p style={{ textAlign: "center", marginBottom: 24 }}>
          Mỗi môn học hiển thị theo tuần và ngày. Trạng thái đồng bộ tự động.
        </p>

        {loading ? (
          <p className="no-task" style={{ textAlign: "center" }}>Đang tải…</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : subjects.length === 0 ? (
          <p className="no-task" style={{ textAlign: "center" }}>
            Chưa có lộ trình. Hãy tạo lộ trình trước.
          </p>
        ) : (
          subjects.map((subj) => (
            <SubjectSection key={subj} subject={subj} weeks={grouped[subj]} />
          ))
        )}
      </div>
    </section>
  );
}
