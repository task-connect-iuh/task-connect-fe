import { useNavigate } from 'react-router-dom'
import { Badge } from '@ds/components/core/Badge'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { logout as logoutRequest } from '../api/auth.ts'
import { useAuthStore } from '../stores/useAuthStore.ts'

const STATUS_LABEL: Record<string, string> = {
  UNVERIFIED: 'Chưa xác minh email',
  ACTIVE: 'Đã kích hoạt',
  LOCKED: 'Đang tạm khoá',
  SUSPENDED: 'Đã đình chỉ',
}

const STATUS_TONE: Record<string, 'warning' | 'success' | 'danger'> = {
  UNVERIFIED: 'warning',
  ACTIVE: 'success',
  LOCKED: 'danger',
  SUSPENDED: 'danger',
}

/**
 * Trang chu tam thoi sau dang nhap - Tong quan that theo vai tro (Poster/Tasker/Admin)
 * chua duoc dung, xem docs/PROGRESS-FE.md phan "Buoc tiep theo". Man nay chi xac nhan
 * phien dang nhap hoat dong dung va cho dang xuat.
 */
export function HomePage() {
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const storeLogout = useAuthStore((state) => state.logout)

  const handleLogout = async () => {
    try {
      await logoutRequest()
    } catch {
      // Logout la thao tac dep don phia client - loi mang o day khong ngan nguoi dung thoat.
    }
    storeLogout()
    navigate('/dang-nhap', { replace: true })
  }

  if (!session) return null

  const status = session.account.status
  const roleLabel = { poster: 'Task Poster', tasker: 'Tasker', admin: 'Admin' }

  return (
    <div className="flex justify-center p-8">
      <div className="max-w-content w-full flex flex-col gap-4">
        <Card tone="brand">
          <h1>Chào mừng trở lại TaskConnect</h1>
          <p>Tổng quan theo vai trò (Poster/Tasker/Admin) đang được xây tiếp — đây là trang xác nhận phiên đăng nhập tạm thời.</p>
        </Card>
        <Card>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <span>Trạng thái tài khoản</span>
              <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Vai trò</span>
              <span>{session.account.roles.map((role) => roleLabel[role]).join(', ')}</span>
            </div>
          </div>
          <div className="flex gap-2" style={{ marginTop: 'var(--sp-4)' }}>
            <Button variant="secondary" onClick={handleLogout}>Đăng xuất</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
