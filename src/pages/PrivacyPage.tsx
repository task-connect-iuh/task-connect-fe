import { Link } from 'react-router-dom'

const SECTIONS = [
  {
    title: '1. Dữ liệu chúng tôi thu thập',
    body: 'Thông tin tài khoản (họ tên, email, số điện thoại, mật khẩu đã mã hoá), thông tin xác minh danh tính (CCCD) đối với Tasker, địa điểm công việc, lịch sử đặt việc và giao dịch, tin nhắn trao đổi giữa Task Poster và Tasker trong phạm vi một booking.',
  },
  {
    title: '2. Mục đích sử dụng',
    body: 'Ghép Tasker phù hợp theo vị trí, kỹ năng và điểm uy tín; xử lý thanh toán, tạm giữ và giải ngân; xác minh danh tính; gửi thông báo về trạng thái công việc và booking; cải thiện gợi ý phân loại công việc.',
  },
  {
    title: '3. Chia sẻ dữ liệu',
    body: 'TaskConnect không bán dữ liệu cá nhân cho bên thứ ba. Dữ liệu thanh toán được chia sẻ ở mức tối thiểu cần thiết với đối tác xử lý thanh toán để hoàn tất giao dịch. Hồ sơ công khai (tên hiển thị, điểm uy tín, đánh giá) hiển thị cho bên còn lại trong một công việc hoặc booking.',
  },
  {
    title: '4. Bảo mật',
    body: 'Mật khẩu được lưu dưới dạng đã mã hoá, không thể đọc ngược. Phiên đăng nhập dùng access token ngắn hạn và refresh token lưu trong cookie httpOnly, không thể truy cập bằng JavaScript phía trình duyệt. Đăng nhập sai nhiều lần liên tiếp sẽ tạm khoá tài khoản.',
  },
  {
    title: '5. Lưu trữ dữ liệu',
    body: 'Dữ liệu được lưu trong suốt thời gian tài khoản còn hoạt động, phục vụ lịch sử giao dịch và giải quyết khiếu nại nếu phát sinh.',
  },
  {
    title: '6. Quyền của bạn',
    body: 'Bạn có thể xem và cập nhật thông tin cá nhân trong mục Hồ sơ, hoặc yêu cầu xoá tài khoản và dữ liệu liên quan khi không còn giao dịch nào đang xử lý.',
  },
  {
    title: '7. Cookie',
    body: 'TaskConnect chỉ dùng cookie httpOnly cần thiết để duy trì phiên đăng nhập, không dùng cookie theo dõi hành vi hay quảng cáo bên thứ ba.',
  },
]

/** Trang tinh, khong goi API. Duoc lien ket tu Dang nhap / Dang ky (mo tab moi). */
export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper" style={{ color: 'var(--text-body)' }}>
      <div className="max-w-content mx-auto flex flex-col gap-6 p-8">
        <Link to="/dang-nhap" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-link)', fontWeight: 'var(--fw-bold)' }}>
          ← Về trang đăng nhập
        </Link>

        <div className="flex flex-col gap-2">
          <h1 className="m-0" style={{ fontSize: 'var(--fs-h1)', lineHeight: 'var(--lh-h1)', fontWeight: 'var(--fw-black)', color: 'var(--text-title)' }}>
            Chính sách quyền riêng tư
          </h1>
          <p className="m-0" style={{ color: 'var(--text-muted)' }}>Áp dụng cho mọi tài khoản Task Poster và Tasker trên TaskConnect.</p>
        </div>

        <div className="flex flex-col gap-5">
          {SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-1.5">
              <h2 className="m-0" style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-bold)', color: 'var(--text-title)' }}>
                {section.title}
              </h2>
              <p className="m-0" style={{ color: 'var(--text-body)', lineHeight: 'var(--lh-body)' }}>{section.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
