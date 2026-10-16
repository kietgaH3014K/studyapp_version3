import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import "./Chat.css";

// ⚠️ KHÔNG hard-code key thật trong code sản xuất.
// CRA: process.env.REACT_APP_DEEPINFRA_KEY
// Vite: import.meta.env.VITE_DEEPINFRA_KEY
const API_KEY =
  process.env.REACT_APP_DEEPINFRA_KEY ||
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_DEEPINFRA_KEY) ||
  "SrlxY18iY2rKmZnQ3dtkHZIzVW9tN4dH"; // <-- chỉ để dev

const ENDPOINT = "https://api.deepinfra.com/v1/openai/chat/completions";
const MODEL = "openchat/openchat_3.5";

// ====== Prompt kỷ luật để trả lời thông minh, gọn, đúng format ======
const SYSTEM_PROMPT = [
  "Bạn là gia sư thông minh của StudyApp, luôn trả lời 100% bằng tiếng Việt.",
  "Mục tiêu: chính xác, ngắn gọn, hữu ích, thân thiện; ưu tiên các bước hành động cụ thể.",
  "Nếu câu hỏi mơ hồ, hỏi 1 câu làm rõ ngắn gọn rồi trả lời theo giả định hợp lý.",
  "Với bài tập: đưa đáp án + cách làm TÓM TẮT (chỉ các bước chính). KHÔNG nêu suy luận chi tiết.",
  "Với lập kế hoạch: dùng mục/bullet ngắn, bảng khi phù hợp.",
  "Khi viết code: cung cấp đoạn mã HOÀN CHỈNH trong khối code có ngôn ngữ, kèm ví dụ chạy thử ngắn.",
  "Khi tính toán: tính cẩn thận từng bước, chỉ hiển thị kết quả và vài bước then chốt.",
  "Nếu không chắc chắn: nói 'mình chưa chắc' và đề xuất cách kiểm chứng.",
].join("\n");

const STYLE_PROMPT = [
  "Quy tắc trình bày:",
  "- Dùng Markdown: tiêu đề ngắn (##), bullet, bảng khi phù hợp.",
  "- Ưu tiên câu trả lời <= ~200–300 từ, trừ khi người dùng yêu cầu chi tiết.",
  "- Không rào đón dài dòng. Tránh lặp lại câu hỏi.",
  "- Đưa ví dụ ngắn/sơ đồ tóm tắt nếu hữu ích.",
].join("\n");

// Lấy 16 tin nhắn cuối để giữ ngữ cảnh vừa đủ (giảm lan man)
function lastNMessages(arr, n = 16) {
  return arr.length > n ? arr.slice(arr.length - n) : arr;
}

export default function Chat() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Xin chào 👋 Mình là trợ lý học tập của StudyApp. Bạn muốn mình giúp gì hôm nay?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatBoxRef = useRef(null);

  const scrollToBottom = () => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    // 1) Cập nhật UI ngay
    const nextMessages = [...messages, { role: "user", content: input }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    // 2) Xây messages gửi lên model (thêm system + style + lịch sử rút gọn)
    const payloadMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: STYLE_PROMPT },
      ...lastNMessages(nextMessages, 16),
    ];

    try {
      const response = await axios.post(
        ENDPOINT,
        {
          model: MODEL,
          messages: payloadMessages,
          temperature: 0.35,    // Giữ kỷ luật format & lập luận ổn
          top_p: 0.95,
          presence_penalty: 0.1,
          frequency_penalty: 0.2,
          max_tokens: 900,
        },
        {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      const reply = response?.data?.choices?.[0]?.message?.content?.trim();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply || "Mình đang gặp lỗi khi tạo trả lời." },
      ]);
    } catch (error) {
      const errMsg =
        error?.response?.data?.error?.message ||
        error?.message ||
        "❌ Lỗi gửi yêu cầu đến AI.";
      setMessages((prev) => [...prev, { role: "assistant", content: errMsg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        role: "assistant",
        content:
          "Mình đã xoá lịch sử hội thoại. Bạn muốn bắt đầu chủ đề gì mới? 🙂",
      },
    ]);
    setInput("");
  };

  const handleSave = () => {
    const content = messages
      .map((msg) => `${msg.role === "user" ? "Bạn" : "AI"}: ${msg.content}`)
      .join("\n\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "lich_su_chat.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="chat-container">
      <h2 className="chat-header">💬 Chat với AI</h2>

      <div className="chat-box" ref={chatBoxRef}>
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`chat-message ${
              msg.role === "user" ? "user-message" : "ai-message"
            }`}
          >
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        ))}
      </div>

      <div className="chat-input-container">
        <input
          type="text"
          placeholder={loading ? "Đang suy nghĩ, bạn chờ nhé!" : "Nhập câu hỏi..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="chat-input"
          disabled={loading}
        />
        <button className="chat-button" onClick={handleSend} disabled={loading}>
          📤
        </button>
        <button className="chat-button danger" onClick={handleClear} disabled={loading}>
          🗑
        </button>
        <button className="chat-button save" onClick={handleSave} disabled={loading}>
          💾
        </button>
      </div>
    </div>
  );
}
