export default function Hero() {
  return (
    <section className="bg-gray-50 py-16 text-center">
      <div className="max-w-4xl mx-auto">
        <img src="/robot-illustration.png" alt="Study App Robot" className="mx-auto mb-6 w-48" />
        <h1 className="text-4xl font-bold text-brown-700">STUDY APP</h1>
        <p className="text-lg mt-2 text-brown-600">
          Hỗ trợ bạn xây dựng lộ trình học tập cá nhân hóa
        </p>
        <div className="mt-8 text-left px-4">
          <h2 className="font-bold text-lg">Daskboard - Tổng quan</h2>
          <p>Chào mừng bạn đến với ứng dụng StudyApp!</p>
        </div>
      </div>
    </section>
  );
}
