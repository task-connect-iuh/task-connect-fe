import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import logoInverse from '@ds/assets/logo-lockup-inverse.svg'
import { Icon } from '@ds/components/core/Icon'

interface AuthLayoutProps {
  /** 'signup' dung cho man Dang ky va Nhap ma xac minh, 'login' cho cac man con lai -
   *  khop dung cach chia panel trong @ds/ui_kits/auth/AuthScreens.dc.html. */
  variant: 'login' | 'signup'
  /** Bam logo hoac nut goc-tren-ben-phai de ve trang chu (/) - CHI bat o Dang nhap va
   *  Dang ky theo yeu cau nguoi dung. Man Xac minh/Quen mat khau/Dat lai mat khau cung dung
   *  AuthLayout nhung KHONG bat: nhung man do dang giua chung mot luong nhieu buoc (OTP da
   *  gui, dang cho nhap), thoat ngang ve trang chu de mat du lieu/OTP hon la huu ich. */
  homeLink?: boolean
  children: ReactNode
}

const LOGIN_FEATURES = [
  { icon: 'lock', title: 'Tiền được tạm giữ', body: 'Tiền chỉ chuyển đi khi công việc được nghiệm thu.' },
  { icon: 'shield-check', title: 'Danh tính được xác minh', body: 'Tài khoản nhận việc đều qua bước đối chiếu CCCD.' },
  { icon: 'radar', title: 'Ghép việc theo khu vực', body: 'Gợi ý theo vị trí, kỹ năng, điểm uy tín — bạn chọn lại được.' },
]

const SIGNUP_STEPS = [
  'Tạo tài khoản bằng email hoặc số điện thoại',
  'Nhập mã 6 số chúng tôi gửi qua email',
  'Bắt đầu đăng việc hoặc tìm việc quanh bạn',
]

/** Khung hai cot dung chung cho toan bo man Auth: panel thuong hieu ben trai, form ben phai. */
export function AuthLayout({ variant, homeLink = false, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row items-stretch bg-paper">
      {homeLink && (
        <Link
          to="/"
          className="tc-home-link flex items-center gap-2"
          style={{
            position: 'fixed', top: 24, right: 24, zIndex: 40,
            padding: 'var(--sp-2) var(--sp-4)', borderRadius: 'var(--r-pill)',
            border: 'var(--bw) solid var(--border)',
            color: 'var(--text-body)', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)',
            boxShadow: 'var(--shadow-raise)',
          }}
        >
          <Icon name="house" size={16} />
          Về trang chủ
        </Link>
      )}
      <aside
        className="w-full md:w-1/2 flex flex-col justify-between gap-8 p-8 md:p-10"
        style={{ background: 'var(--teal-900)', color: 'var(--on-deep)', borderRadius: '0 var(--r-xl) var(--r-xl) 0' }}
      >
        {homeLink
          ? (
              <Link to="/" className="tc-auth-logo-link self-start">
                <img src={logoInverse} alt="TaskConnect" className="w-auto" style={{ height: 104 }} />
              </Link>
            )
          : (
              <img src={logoInverse} alt="TaskConnect" className="w-auto self-start" style={{ height: 104 }} />
            )}

        {variant === 'login'
          ? (
              <div className="flex flex-col gap-5 max-w-content">
                <h1 className="m-0" style={{ fontSize: 'var(--fs-h1)', lineHeight: 'var(--lh-h1)', fontWeight: 'var(--fw-black)', color: 'var(--white)' }}>
                  Kết nối đúng người, đúng việc.
                </h1>
                <p className="m-0" style={{ color: 'var(--on-deep-muted)' }}>
                  Đăng việc, ghép người, tạm giữ tiền và giải ngân sau khi bạn nghiệm thu — trong một tài khoản.
                </p>
                <div className="flex flex-col gap-4 mt-1">
                  {LOGIN_FEATURES.map((feature) => (
                    <div key={feature.title} className="flex gap-4 items-start">
                      <span
                        className="flex-none flex items-center justify-center"
                        style={{ width: 38, height: 38, borderRadius: 'var(--r-md)', border: 'var(--bw) solid var(--teal-700)', color: 'var(--teal-200)' }}
                      >
                        <Icon name={feature.icon} size={18} />
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <strong style={{ color: 'var(--white)' }}>{feature.title}</strong>
                        <span style={{ color: 'var(--on-deep-muted)', fontSize: 'var(--fs-sm)', lineHeight: 'var(--lh-sm)' }}>{feature.body}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          : (
              <div className="flex flex-col gap-5 max-w-content">
                <h1 className="m-0" style={{ fontSize: 'var(--fs-h1)', lineHeight: 'var(--lh-h1)', fontWeight: 'var(--fw-black)', color: 'var(--white)' }}>
                  Một tài khoản, hai vai trò.
                </h1>
                <p className="m-0" style={{ color: 'var(--on-deep-muted)' }}>
                  Đăng việc hay nhận việc đều dùng tài khoản này. Chỉ cần chọn vai trò ngay thanh trên sau khi đăng nhập.
                </p>
                <div className="flex flex-col gap-2 mt-1">
                  {SIGNUP_STEPS.map((step, index) => (
                    <div key={step} className="flex flex-col gap-2">
                      <div className="flex gap-4 items-center">
                        <span
                          className="flex-none flex items-center justify-center"
                          style={{ width: 30, height: 30, borderRadius: 'var(--r-pill)', border: 'var(--bw) solid var(--teal-700)', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--teal-200)' }}
                        >
                          {index + 1}
                        </span>
                        <span style={{ color: 'var(--white)' }}>{step}</span>
                      </div>
                      {index < SIGNUP_STEPS.length - 1 && (
                        <span className="flex justify-center" style={{ width: 30, color: 'var(--teal-600)' }}>
                          <Icon name="arrow-down" size={16} />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 items-start p-5" style={{ border: 'var(--bw) solid var(--teal-700)', borderRadius: 'var(--r-lg)' }}>
                  <span className="flex-none" style={{ color: 'var(--amber-300)' }}>
                    <Icon name="hand-coins" size={18} />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <strong style={{ color: 'var(--white)' }}>Điều bạn nên biết trước</strong>
                    <span style={{ color: 'var(--on-deep-muted)', fontSize: 'var(--fs-sm)', lineHeight: 'var(--lh-sm)' }}>
                      Tạo tài khoản miễn phí. Phí nền tảng 8% chỉ trừ khi giải ngân cho người nhận việc. Tiền của người đăng việc được tạm giữ đến khi công việc được nghiệm thu.
                    </span>
                  </div>
                </div>
              </div>
            )}

        <div className="flex items-center gap-3 flex-wrap pt-5" style={{ borderTop: 'var(--bw) solid var(--teal-700)', fontSize: 'var(--fs-sm)', color: 'var(--on-deep-muted)' }}>
          <span>1 · Đăng việc</span>
          <span className="w-6 h-0.5" style={{ background: 'var(--teal-700)' }} />
          <span>2 · Ghép Tasker</span>
          <span className="w-6 h-0.5" style={{ background: 'var(--teal-700)' }} />
          <span>3 · Nghiệm thu &amp; giải ngân</span>
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center p-8">
        {/* 520px khop dung AuthScreens.dc.html (ui_kits/auth) - max-w-content (680px, dung
            chung cho form khac) rong hon mock, lam cac o input (nhat la cap Email/So dien
            thoai, Mat khau/Xac nhan mat khau) trai dai hon thiet ke tham chieu. */}
        <div className="w-full max-w-[520px] flex flex-col gap-5">
          {children}
        </div>
      </main>
    </div>
  )
}
