import { Link } from 'react-router-dom'
import { Button } from '@ds/components/core/Button'
import { Icon } from '@ds/components/core/Icon'
import { useAuthStore } from '../stores/useAuthStore.ts'

/** Man 404 cho moi duong dan khong khop route nao (route "*" trong App.tsx). */
export function NotFoundPage() {
  const session = useAuthStore((state) => state.session)

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: 'var(--bg-app)' }}>
      <div className="max-w-content w-full flex flex-col items-center text-center gap-5">
        <span
          className="flex items-center justify-center"
          style={{ width: 72, height: 72, borderRadius: 'var(--r-pill)', background: 'var(--paper-2)', color: 'var(--text-faint)' }}
        >
          <Icon name="map-pinned-off" size={32} />
        </span>

        <div className="flex flex-col gap-2">
          <span style={{ fontSize: 'var(--fs-label)', textTransform: 'uppercase', fontWeight: 'var(--fw-bold)', color: 'var(--text-faint)' }}>
            Lỗi 404
          </span>
          <h1 className="m-0" style={{ fontSize: 'var(--fs-h1)', lineHeight: 'var(--lh-h1)', fontWeight: 'var(--fw-black)', color: 'var(--text-title)' }}>
            Không tìm thấy trang này
          </h1>
          <p className="m-0" style={{ color: 'var(--text-muted)' }}>
            Đường dẫn bạn vào không tồn tại, hoặc đã được đổi sang chỗ khác.
          </p>
        </div>

        <div className="flex gap-3 flex-wrap justify-center">
          {session
            ? (
                <Link to="/tong-quan"><Button variant="primary" icon="gauge">Về Tổng quan</Button></Link>
              )
            : (
                <>
                  <Link to="/"><Button variant="primary" icon="house">Về trang chủ</Button></Link>
                  <Link to="/dang-nhap"><Button variant="secondary">Đăng nhập</Button></Link>
                </>
              )}
        </div>
      </div>
    </div>
  )
}
