import React, { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api";
import "./Roadmap.css";

export default function Roadmap() {
  const [progressList, setProgressList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  // AI adaptive roadmap: preview first, save only after user confirmation.
  const [adaptiveOpen, setAdaptiveOpen] = useState(false);
  const [adaptiveSubject, setAdaptiveSubject] = useState("");
  const [adaptiveMinutes, setAdaptiveMinutes] = useState("60");
  const [adaptiveReason, setAdaptiveReason] = useState("");
  const [adaptiveLoading, setAdaptiveLoading] = useState(false);
  const [adaptiveApplying, setAdaptiveApplying] = useState(false);
  const [adaptiveError, setAdaptiveError] = useState("");
  const [adaptiveMessage, setAdaptiveMessage] = useState("");
  const [adaptivePreview, setAdaptivePreview] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const { data } = await api.get("/progress/", {
        params: subjectFilter ? { subject: subjectFilter } : {},
      });
      setProgressList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Lỗi tải lộ trình:", err);
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setMsg("Bạn chưa đăng nhập. Hãy đăng nhập để xem lộ trình.");
      } else {
        setMsg("Không thể tải dữ liệu lộ trình.");
      }
      setProgressList([]);
    } finally {
      setLoading(false);
    }
  }, [subjectFilter]);

  useEffect(() => {
    load();
    const onUpdated = () => load();
    window.addEventListener("plan-updated", onUpdated);
    return () => window.removeEventListener("plan-updated", onUpdated);
  }, [load]);

  const toggleStatus = async (item) => {
    const newStatus = item.status === "done" ? "pending" : "done";
    try {
      await api.post("/progress/update/", { id: item.id, status: newStatus });
      setProgressList((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, status: newStatus } : p))
      );
      setAdaptivePreview(null);
      setAdaptiveMessage("");
      window.dispatchEvent(new Event("plan-updated"));
    } catch (err) {
      console.error("Lỗi cập nhật trạng thái:", err);
      setMsg("Không cập nhật được trạng thái. Vui lòng thử lại.");
    }
  };

  const openAdaptivePanel = () => {
    setAdaptiveSubject(subjectFilter || orderedSubjects[0] || "");
    setAdaptivePreview(null);
    setAdaptiveError("");
    setAdaptiveMessage("");
    setAdaptiveOpen((current) => !current);
  };

  const requestAdaptivePreview = async () => {
    setAdaptiveLoading(true);
    setAdaptiveError("");
    setAdaptiveMessage("");
    setAdaptivePreview(null);
    try {
      const { data } = await api.post("/adapt-learning-path/", {
        subject: adaptiveSubject,
        available_minutes_per_day: Number(adaptiveMinutes),
        reason: adaptiveReason.trim(),
      });
      setAdaptivePreview(data);
    } catch (err) {
      console.error("Lỗi đề xuất lộ trình:", err);
      setAdaptiveError(
        err?.response?.data?.error || "Không thể tạo đề xuất. Hãy kiểm tra kết nối và thử lại."
      );
    } finally {
      setAdaptiveLoading(false);
    }
  };

  const applyAdaptivePreview = async () => {
    if (!adaptivePreview?.changes?.length) return;
    setAdaptiveApplying(true);
    setAdaptiveError("");
    try {
      const { data } = await api.post("/apply-adapted-learning-path/", {
        subject: adaptivePreview.subject,
        changes: adaptivePreview.changes.map(({ id, task_title }) => ({ id, task_title })),
      });
      const updatedById = new Map((data.items || []).map((item) => [item.id, item]));
      setProgressList((prev) => prev.map((item) => updatedById.get(item.id) || item));
      setAdaptivePreview(null);
      setAdaptiveMessage(data.message || "Đã cập nhật lộ trình.");
      window.dispatchEvent(new Event("plan-updated"));
    } catch (err) {
      console.error("Lỗi áp dụng lộ trình:", err);
      setAdaptiveError(
        err?.response?.data?.error || "Chưa thể áp dụng đề xuất. Vui lòng thử lại."
      );
    } finally {
      setAdaptiveApplying(false);
    }
  };

  const bySubject = useMemo(() => {
    const map = new Map();
    for (const item of progressList) {
      const subject = item.subject || "Khác";
      if (!map.has(subject)) map.set(subject, []);
      map.get(subject).push(item);
    }
    return map;
  }, [progressList]);

  const orderedSubjects = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const item of progressList) {
      const subject = item.subject || "Khác";
      if (!seen.has(subject)) {
        seen.add(subject);
        list.push(subject);
      }
    }
    return list;
  }, [progressList]);

  const renderSubjectColumn = (subjectName) => {
    const items = (bySubject.get(subjectName) || []).slice().sort((a, b) => {
      if (a.week !== b.week) return a.week - b.week;
      return a.day_number - b.day_number;
    });

    const total = items.length;
    const done = items.filter((item) => item.status === "done").length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    return (
      <div className="subject-column" key={subjectName}>
        <h2 className="subject-title">📚 Môn học: {subjectName}</h2>
        <p>💻 Hãy cập nhật tiến độ sau mỗi ngày học nhé!</p>
        <p className="subject-progress-text">Tiến độ hoàn thành: {percent}%</p>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>

        {items.map((item) => {
          const [desc, rawLink] = (item.task_title || "").split("Link tài liệu:");
          const description = (desc || "").replace(/\|\s*$/g, "").trim();
          const link = rawLink ? rawLink.trim() : "";
          return (
            <div key={item.id} className="plan-item">
              <h3 className="plan-day">🗓️ Tuần {item.week} · Ngày {item.day_number}</h3>
              <p className="plan-desc">{description || "—"}</p>
              {link && link !== "không có" && /^https?:\/\//i.test(link) && (
                <p className="plan-link">
                  📎 <a href={link} target="_blank" rel="noopener noreferrer">{link}</a>
                </p>
              )}
              <button
                className={`status-button ${item.status === "done" ? "done" : "pending"}`}
                onClick={() => toggleStatus(item)}
              >
                {item.status === "done" ? "✅ Đã hoàn thành" : "🕓 Chưa hoàn thành"}
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const subjectsToRender =
    subjectFilter && bySubject.has(subjectFilter) ? [subjectFilter] : orderedSubjects;

  return (
    <section className="roadmap-hero">
      <div className="after-image">
        <h2>📈 Lộ trình học tập của bạn</h2>

        <div className="filter-bar">
          <div className="filter-title">Môn học</div>
          <div className="filter-controls">
            <select
              className="select"
              value={subjectFilter}
              onChange={(event) => setSubjectFilter(event.target.value)}
            >
              <option value="">Tất cả</option>
              {orderedSubjects.map((subject) => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
            <button className="btn" onClick={load}>↻ Tải lại</button>
            <button className="btn adaptive-open-btn" onClick={openAdaptivePanel} disabled={!orderedSubjects.length}>
              ✨ AI điều chỉnh lộ trình
            </button>
          </div>
        </div>

        {adaptiveOpen && (
          <div className="adaptive-panel">
            <div className="adaptive-panel-heading">
              <div>
                <h3>✨ Điều chỉnh lộ trình bằng AI</h3>
                <p>AI sẽ đề xuất lại các nhiệm vụ chưa hoàn thành. Bạn xem trước rồi mới quyết định lưu.</p>
              </div>
              <button className="adaptive-close" onClick={() => setAdaptiveOpen(false)} aria-label="Đóng">×</button>
            </div>

            <div className="adaptive-form-grid">
              <label>
                Môn học cần điều chỉnh
                <select className="select adaptive-input" value={adaptiveSubject} onChange={(event) => setAdaptiveSubject(event.target.value)}>
                  {orderedSubjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                </select>
              </label>
              <label>
                Thời gian có thể học mỗi ngày (phút)
                <input
                  className="adaptive-input"
                  type="number"
                  min="15"
                  max="360"
                  step="5"
                  value={adaptiveMinutes}
                  onChange={(event) => setAdaptiveMinutes(event.target.value)}
                />
              </label>
              <label className="adaptive-reason-label">
                Khó khăn hiện tại (không bắt buộc)
                <textarea
                  className="adaptive-input adaptive-textarea"
                  rows="3"
                  maxLength="500"
                  value={adaptiveReason}
                  onChange={(event) => setAdaptiveReason(event.target.value)}
                  placeholder="Ví dụ: tuần này bận kiểm tra, bài tập quá khó, thường mất tập trung…"
                />
              </label>
            </div>
            <button
              className="btn adaptive-submit-btn"
              onClick={requestAdaptivePreview}
              disabled={adaptiveLoading || !adaptiveSubject || Number(adaptiveMinutes) < 15 || Number(adaptiveMinutes) > 360}
            >
              {adaptiveLoading ? "⏳ AI đang phân tích…" : "Tạo đề xuất điều chỉnh"}
            </button>

            {adaptiveError && <p className="adaptive-error" role="alert">{adaptiveError}</p>}
            {adaptiveMessage && <p className="adaptive-success" role="status">{adaptiveMessage}</p>}

            {adaptivePreview && (
              <div className="adaptive-preview">
                <h4>Đề xuất cho môn {adaptivePreview.subject}</h4>
                <p className="adaptive-summary">{adaptivePreview.summary}</p>
                <p className="adaptive-note">Các nhiệm vụ đã hoàn thành sẽ không bị thay đổi.</p>
                <div className="adaptive-change-list">
                  {adaptivePreview.changes.map((change) => (
                    <article className="adaptive-change" key={change.id}>
                      <div className="adaptive-change-meta">
                        <span>Trước: Tuần {change.old_week}, ngày {change.old_day_number}</span>
                        <span className="adaptive-arrow">→</span>
                        <strong>Sau: Tuần {change.week}, ngày {change.day_number}</strong>
                      </div>
                      <p className="adaptive-old-title">{change.old_task_title}</p>
                      <p className="adaptive-new-title">{change.task_title}</p>
                    </article>
                  ))}
                </div>
                <div className="adaptive-actions">
                  <button className="btn" onClick={() => setAdaptivePreview(null)} disabled={adaptiveApplying}>Bỏ đề xuất</button>
                  <button className="btn adaptive-confirm-btn" onClick={applyAdaptivePreview} disabled={adaptiveApplying}>
                    {adaptiveApplying ? "Đang lưu…" : "✓ Xác nhận và cập nhật lộ trình"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <p>⏳ Đang tải dữ liệu...</p>
        ) : msg ? (
          <p className="error">{msg}</p>
        ) : progressList.length === 0 ? (
          <p>📭 Chưa có lộ trình nào.</p>
        ) : (
          <div className="subjects-grid">
            {subjectsToRender.map((subject) => renderSubjectColumn(subject))}
          </div>
        )}
      </div>
    </section>
  );
}
