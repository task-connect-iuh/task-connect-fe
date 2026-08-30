import { Link } from 'react-router-dom'

const SECTIONS = [
  {
    title: '1. Giới thiệu',
    body: 'TaskConnect là nền tảng kết nối Task Poster (người đăng việc) và Tasker (người nhận việc) cho các dịch vụ sửa chữa điện và nước: điện dân dụng, điện lạnh, điện công nghiệp quy mô nhỏ, cấp thoát nước, lắp đặt và bảo trì thiết bị nước. Việc tạo tài khoản và sử dụng nền tảng đồng nghĩa bạn đồng ý với các điều khoản dưới đây.',
  },
  {
    title: '2. Tài khoản',
    body: 'Một tài khoản mang đồng thời hai vai trò Task Poster và Tasker, bạn có thể chuyển đổi vai trò hoạt động bất cứ lúc nào sau khi đăng nhập. Tài khoản mới ở trạng thái chưa xác minh cho đến khi bạn nhập đúng mã xác minh gửi qua email — trước đó bạn chưa thể đăng việc hoặc ứng tuyển. Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số. Nhập sai mật khẩu 5 lần liên tiếp sẽ tạm khoá tài khoản 15 phút.',
  },
  {
    title: '3. Đặt việc và thanh toán',
    body: 'Khi Task Poster xác nhận một Tasker, tiền công việc được tạm giữ (escrow) ngay tại thời điểm đặt việc. Số tiền tạm giữ chỉ được giải ngân cho Tasker sau khi Task Poster nghiệm thu, hoặc tự động sau 48 giờ kể từ khi công việc hoàn tất nếu không có khiếu nại. Nền tảng thu phí dịch vụ 8% trên khoản giải ngân cho Tasker.',
  },
  {
    title: '4. Huỷ việc, khiếu nại và hoàn tiền',
    body: 'Task Poster có thể huỷ công việc khi chưa được giao cho Tasker. Sau khi công việc hoàn tất, mỗi bên có 48 giờ để gửi khiếu nại trước khi tiền được giải ngân tự động. Quyết định hoàn tiền hoặc giải ngân theo kết quả xử lý khiếu nại của đội ngũ vận hành.',
  },
  {
    title: '5. Xác minh danh tính',
    body: 'Tasker cần xác minh danh tính bằng CCCD trước khi nhận việc hoặc rút tiền từ ví. Một số nhóm dịch vụ đặc thù (điện lạnh, điện công nghiệp quy mô nhỏ) có thể yêu cầu thêm chứng chỉ chuyên ngành.',
  },
  {
    title: '6. Đánh giá',
    body: 'Sau khi công việc hoàn tất, hai bên đánh giá lẫn nhau. Đánh giá được công khai khi cả hai bên đã gửi, hoặc tự động công khai sau 14 ngày kể từ lượt gửi đầu tiên.',
  },
  {
    title: '7. Hành vi bị cấm',
    body: 'Nghiêm cấm khai báo thông tin sai sự thật, giả mạo hồ sơ hoặc chứng chỉ, thoả thuận thanh toán ngoài nền tảng để né phí dịch vụ, quấy rối hoặc có hành vi không phù hợp với bên còn lại.',
  },
  {
    title: '8. Đình chỉ tài khoản',
    body: 'TaskConnect có quyền tạm khoá hoặc đình chỉ tài khoản vi phạm các điều khoản trên, sau khi xem xét khiếu nại hoặc báo cáo liên quan.',
  },
  {
    title: '9. Thay đổi điều khoản',
    body: 'Điều khoản có thể được cập nhật theo thời gian. Thay đổi quan trọng sẽ được thông báo trước khi áp dụng cho tài khoản đang hoạt động.',
  },
]

/** Trang tinh, khong goi API. Duoc lien ket tu Dang nhap / Dang ky (mo tab moi). */
export function TermsPage() {
  return (
    <div className="min-h-screen bg-paper" style={{ color: 'var(--text-body)' }}>
      <div className="max-w-content mx-auto flex flex-col gap-6 p-8">
        <Link to="/dang-nhap" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-link)', fontWeight: 'var(--fw-bold)' }}>
          ← Về trang đăng nhập
        </Link>

        <div className="flex flex-col gap-2">
          <h1 className="m-0" style={{ fontSize: 'var(--fs-h1)', lineHeight: 'var(--lh-h1)', fontWeight: 'var(--fw-black)', color: 'var(--text-title)' }}>
            Điều khoản sử dụng
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
