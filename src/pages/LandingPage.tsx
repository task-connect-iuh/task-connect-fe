import { Link } from 'react-router-dom'
import logoInverse from '@ds/assets/logo-lockup-inverse.svg'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { Chip } from '@ds/components/core/Chip'
import { Icon } from '@ds/components/core/Icon'
import { RevealSection } from '../components/RevealSection.tsx'
import { useAuthStore } from '../stores/useAuthStore.ts'

const FEATURES = [
  { icon: 'lock', title: 'Tiền được tạm giữ an toàn', body: 'Tiền công việc được giữ ngay khi đặt việc, chỉ chuyển cho Tasker sau khi bạn nghiệm thu — không lo mất tiền trước khi việc xong.' },
  { icon: 'shield-check', title: 'Danh tính được xác minh', body: 'Tasker nhận việc đều qua bước đối chiếu CCCD trước khi được phép ứng tuyển, giúp bạn yên tâm hơn khi mời người vào nhà.' },
  { icon: 'radar', title: 'Ghép việc theo khu vực', body: 'Gợi ý Tasker phù hợp theo vị trí, kỹ năng và điểm uy tín — bạn luôn là người quyết định chọn ai cuối cùng.' },
]

const STEPS = [
  { icon: 'file-plus-2', title: 'Đăng việc hoặc tìm việc', body: 'Poster mô tả công việc cần làm, Tasker tìm việc phù hợp quanh khu vực của mình.' },
  { icon: 'handshake', title: 'Ghép đúng người, đúng việc', body: 'Xác nhận Tasker phù hợp, tiền công việc được tạm giữ ngay khi đặt việc.' },
  { icon: 'hand-coins', title: 'Nghiệm thu và giải ngân', body: 'Sau khi công việc hoàn tất và được nghiệm thu, tiền giải ngân cho Tasker, trừ 8% phí nền tảng.' },
]

const CATEGORIES = [
  { icon: 'zap', label: 'Điện dân dụng' },
  { icon: 'snowflake', label: 'Điện lạnh' },
  { icon: 'factory', label: 'Điện công nghiệp quy mô nhỏ' },
  { icon: 'droplets', label: 'Cấp thoát nước' },
  { icon: 'wrench', label: 'Lắp đặt và bảo trì thiết bị nước' },
]

/**
 * Trang chu cong khai tai "/" - gioi thieu he thong va dan nguoi dung moi toi dang ky.
 * Khong goi API, khong doc du lieu tai khoan ngoai session co san. Khong boc GuestGuard -
 * nguoi da dang nhap van xem duoc trang nay binh thuong (vd mo lai tab, bam logo tu
 * AppShell) nen CTA phai doi sang "Vao Tong quan" thay vi Dang nhap/Dang ky, tranh bam vao
 * lai bi GuestGuard cua /dang-nhap, /dang-ky day nguoc ve day.
 */
export function LandingPage() {
  const hasSession = useAuthStore((state) => state.session !== null)

  return (
    <div style={{ background: 'var(--bg-app)' }}>
      <div style={{ background: 'var(--teal-900)' }}>
        <div className="max-w-container mx-auto flex items-center gap-4 px-4 md:px-8 py-4">
          <img src={logoInverse} alt="TaskConnect" style={{ height: 72 }} />
          <div className="flex-1" />
          {hasSession ? (
            <Link to="/tong-quan"><Button variant="primary" size="sm">Vào Tổng quan</Button></Link>
          ) : (
            <>
              <Link to="/dang-nhap" style={{ color: 'var(--on-deep)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--fs-sm)' }}>Đăng nhập</Link>
              <Link to="/dang-ky"><Button variant="primary" size="sm">Đăng ký miễn phí</Button></Link>
            </>
          )}
        </div>

        <RevealSection className="max-w-container mx-auto px-4 md:px-8" style={{ paddingTop: 'var(--sp-16)', paddingBottom: 'var(--sp-16)' }}>
          <div className="flex flex-col items-center text-center gap-6" style={{ maxWidth: 720, margin: '0 auto' }}>
            <span
              className="inline-flex items-center gap-2 px-4 py-1"
              style={{ borderRadius: 'var(--r-pill)', border: 'var(--bw) solid var(--teal-700)', color: 'var(--teal-200)', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)' }}
            >
              <Icon name="sparkles" size={15} />Sửa chữa điện và nước, đúng người, đúng việc
            </span>
            <h1 className="m-0" style={{ fontSize: 'var(--fs-display)', lineHeight: 'var(--lh-display)', fontWeight: 'var(--fw-black)', color: 'var(--white)' }}>
              Kết nối đúng người, đúng việc.
            </h1>
            <p className="m-0" style={{ fontSize: 'var(--fs-body)', color: 'var(--on-deep-muted)', maxWidth: 560 }}>
              TaskConnect kết nối người cần sửa chữa điện, nước với thợ đã xác minh danh tính quanh khu vực của bạn — tiền được tạm giữ an toàn cho đến khi công việc hoàn tất.
            </p>
            <div className="flex gap-3 flex-wrap items-center justify-center">
              {hasSession ? (
                <Link to="/tong-quan"><Button variant="primary" size="lg" icon="gauge">Vào Tổng quan</Button></Link>
              ) : (
                <>
                  <Link to="/dang-ky"><Button variant="primary" size="lg" icon="user-plus">Tạo tài khoản miễn phí</Button></Link>
                  <Link to="/dang-nhap"><Button variant="secondary" size="lg">Tôi đã có tài khoản</Button></Link>
                </>
              )}
            </div>
          </div>
        </RevealSection>
      </div>

      <RevealSection className="max-w-container mx-auto px-4 md:px-8" style={{ paddingTop: 'var(--sp-16)', paddingBottom: 'var(--sp-12)' }}>
        <div className="flex flex-col gap-2 text-center" style={{ maxWidth: 640, margin: '0 auto var(--sp-8)' }}>
          <h2 className="m-0" style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-black)', color: 'var(--text-title)' }}>Vì sao chọn TaskConnect</h2>
          <p className="m-0" style={{ color: 'var(--text-muted)' }}>Ba điều làm nên sự khác biệt so với việc tự tìm thợ qua quen biết hay mạng xã hội.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FEATURES.map((feature) => (
            <Card key={feature.title} padding="var(--sp-6)">
              <div className="flex flex-col gap-3">
                <span
                  className="flex items-center justify-center"
                  style={{ width: 48, height: 48, borderRadius: 'var(--r-lg)', background: 'var(--brand-tint)', color: 'var(--teal-700)' }}
                >
                  <Icon name={feature.icon} size={22} />
                </span>
                <h3 className="m-0" style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-bold)', color: 'var(--text-title)' }}>{feature.title}</h3>
                <p className="m-0" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>{feature.body}</p>
              </div>
            </Card>
          ))}
        </div>
      </RevealSection>

      <RevealSection style={{ background: 'var(--surface-card-alt)', paddingTop: 'var(--sp-12)', paddingBottom: 'var(--sp-12)' }}>
        <div className="max-w-container mx-auto px-4 md:px-8">
          <div className="flex flex-col gap-2 text-center" style={{ maxWidth: 640, margin: '0 auto var(--sp-8)' }}>
            <h2 className="m-0" style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-black)', color: 'var(--text-title)' }}>5 nhóm dịch vụ</h2>
            <p className="m-0" style={{ color: 'var(--text-muted)' }}>Tập trung vào sửa chữa điện và nước — không dàn trải sang việc vặt khác.</p>
          </div>
          <div className="flex flex-wrap gap-3 justify-center">
            {CATEGORIES.map((category) => (
              <Chip key={category.label} icon={category.icon}>{category.label}</Chip>
            ))}
          </div>
        </div>
      </RevealSection>

      <RevealSection className="max-w-container mx-auto px-4 md:px-8" style={{ paddingTop: 'var(--sp-12)', paddingBottom: 'var(--sp-12)' }}>
        <div className="flex flex-col gap-2 text-center" style={{ maxWidth: 640, margin: '0 auto var(--sp-8)' }}>
          <h2 className="m-0" style={{ fontSize: 'var(--fs-h1)', fontWeight: 'var(--fw-black)', color: 'var(--text-title)' }}>Cách hoạt động</h2>
          <p className="m-0" style={{ color: 'var(--text-muted)' }}>Ba bước, từ lúc đăng việc đến lúc tiền về tay Tasker.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map((step, index) => (
            <div key={step.title} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="flex items-center justify-center flex-none"
                  style={{ width: 40, height: 40, borderRadius: 'var(--r-pill)', border: 'var(--bw) solid var(--border-strong)', fontWeight: 'var(--fw-black)', color: 'var(--text-title)' }}
                >
                  {index + 1}
                </span>
                <span style={{ color: 'var(--teal-600)' }}><Icon name={step.icon} size={20} /></span>
              </div>
              <h3 className="m-0" style={{ fontSize: 'var(--fs-body)', fontWeight: 'var(--fw-bold)', color: 'var(--text-title)' }}>{step.title}</h3>
              <p className="m-0" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>{step.body}</p>
            </div>
          ))}
        </div>
      </RevealSection>

      <RevealSection className="max-w-container mx-auto px-4 md:px-8" style={{ paddingBottom: 'var(--sp-16)' }}>
        <Card tone="brand" padding="var(--sp-8)">
          <div className="flex flex-col md:flex-row items-center gap-5 justify-between">
            <div className="flex flex-col gap-1 text-center md:text-left">
              <h2 className="m-0" style={{ fontSize: 'var(--fs-h2)', fontWeight: 'var(--fw-black)', color: 'var(--text-title)' }}>Sẵn sàng bắt đầu?</h2>
              <p className="m-0" style={{ color: 'var(--text-muted)' }}>Tạo tài khoản miễn phí, dùng được ngay cho cả đăng việc lẫn nhận việc.</p>
            </div>
            {hasSession ? (
              <Link to="/tong-quan"><Button variant="secondary" size="lg" icon="gauge">Vào Tổng quan</Button></Link>
            ) : (
              <Link to="/dang-ky"><Button variant="secondary" size="lg" icon="user-plus">Tạo tài khoản ngay</Button></Link>
            )}
          </div>
        </Card>
      </RevealSection>

      <footer style={{ borderTop: 'var(--bw) solid var(--border)' }}>
        <div className="max-w-container mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 px-4 md:px-8 py-6" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
          <span>© 2026 TaskConnect</span>
          <div className="flex gap-4">
            <Link to="/dieu-khoan" style={{ color: 'var(--text-muted)' }}>Điều khoản sử dụng</Link>
            <Link to="/chinh-sach-quyen-rieng-tu" style={{ color: 'var(--text-muted)' }}>Chính sách quyền riêng tư</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
