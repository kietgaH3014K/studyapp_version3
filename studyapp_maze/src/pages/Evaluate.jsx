import React from "react";

export default function Evaluate() {
  return (
    <section>
      <h2>ĐÁNH GIÁ TRÌNH ĐỘ HỌC TẬP</h2>
      <form>
        <label>Bạn đang ở lớp mấy?</label>
        <select><option>--Chọn lớp--</option></select>

        <label>Bạn muốn cải thiện môn nào?</label>
        <input type="text" placeholder="Ví dụ: Toán, Lý..." />

        <label>Thời gian học mỗi ngày</label>
        <select><option>--Chọn thời gian--</option></select>

        <label>Mục tiêu học tập</label>
        <textarea placeholder="Ví dụ: Thi đại học, nâng cao kỹ năng..."></textarea>

        <button type="submit">Gửi đánh giá & Tạo lộ trình</button>
      </form>
    </section>
  );
}