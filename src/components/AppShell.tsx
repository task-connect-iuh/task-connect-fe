import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logoInverse from '@ds/assets/logo-lockup-inverse.svg'
import { Avatar } from '@ds/components/core/Avatar'
import { Icon } from '@ds/components/core/Icon'
import { IconButton } from '@ds/components/core/IconButton'
import { RoleSwitcher } from '@ds/components/navigation/RoleSwitcher'
import { logout as logoutRequest } from '../api/auth.ts'
import { broadcastLogout } from '../stores/authBroadcast.ts'
import { useAuthStore } from '../stores/useAuthStore.ts'
import { Tooltip } from './Tooltip.tsx'

interface NavItem {
  value: string
  label: string
  icon: string
  /** Co route that thi bam duoc; khong co nghia man do chua xay dung (hien mo, khong bam duoc). */
  to?: string
}

const NAV: NavItem[] = [
  { value: 'overview', label: 'Tổng quan', icon: 'gauge', to: '/tong-quan' },
  { value: 'post', label: 'Đăng việc', icon: 'file-plus-2' },
  { value: 'jobs', label: 'Việc của tôi', icon: 'clipboard-list' },
  { value: 'matches', label: 'Tasker gợi ý', icon: 'radar' },
  { value: 'chat', label: 'Tin nhắn', icon: 'message-square' },
]

interface AppShellProps {
  navValue: string
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}

/**
 * Khung ung dung dung chung cho man hinh sau dang nhap: thanh tren teal dam (logo, doi
 * vai tro, thong bao, tai khoan) + hang nav + page header + noi dung. Viet lai bang
 * component that cua @ds (khong import thang duoc @ds/ui_kits/shared/WebShell.jsx - file do
 * chi la tham khao bo cuc cho ban demo standalone, dung bien global window.*, khong phai
 * module ES that). Xem 20-design-system.md "Khung bo cuc chuan".
 */
export function AppShell({ navValue, title, subtitle, actions, children }: AppShellProps) {
  const navigate = useNavigate()
  const activeRole = useAuthStore((state) => state.activeRole)
  const setActiveRole = useAuthStore((state) => state.setActiveRole)
  const roleSwitcherValue = activeRole === 'tasker' ? 'tasker' : 'poster'

  const handleLogout = async () => {
    try {
      await logoutRequest()
    } catch {
      // Dang xuat la thao tac don phia client - loi mang o day khong ngan nguoi dung thoat.
    }
    useAuthStore.getState().logout()
    // Bao cac tab khac cung trinh duyet biet vua dang xuat - xem authBroadcast.ts.
    broadcastLogout()
    navigate('/dang-nhap', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-app)' }}>
      <div style={{ background: 'var(--teal-900)' }}>
        <div className="max-w-container mx-auto flex items-center gap-4 px-4 md:px-8" style={{ minHeight: 96 }}>
          <img src={logoInverse} alt="TaskConnect" style={{ height: 80 }} />
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <RoleSwitcher value={roleSwitcherValue} onChange={setActiveRole} compact />
            <Tooltip label="Thông báo">
              <IconButton icon="bell" label="Thông báo" size="sm" style={{ color: 'var(--on-deep)' }} />
            </Tooltip>
            <Avatar name="Tài khoản" size={36} />
            <Tooltip label="Đăng xuất">
              <IconButton icon="log-out" label="Đăng xuất" size="sm" style={{ color: 'var(--on-deep)' }} onClick={handleLogout} />
            </Tooltip>
          </div>
        </div>
        <div className="max-w-container mx-auto px-4 md:px-8 pb-2">
          <nav className="flex gap-1" style={{ overflowX: 'auto' }}>
            {NAV.map((item) => {
              const active = item.value === navValue
              const style = {
                display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)', minHeight: 44, padding: '0 var(--sp-4)',
                borderRadius: 'var(--r-md)', border: `var(--bw) solid ${active ? 'var(--teal-600)' : 'transparent'}`,
                background: active ? 'var(--teal-800)' : 'transparent',
                color: active ? 'var(--on-deep)' : 'var(--on-deep-muted)',
                fontSize: 'var(--fs-body)', fontWeight: active ? 'var(--fw-bold)' : 'var(--fw-medium)',
                whiteSpace: 'nowrap' as const, flex: '0 0 auto',
                opacity: item.to ? 1 : 0.5,
                cursor: item.to ? 'pointer' : 'default',
              }

              if (!item.to) {
                return (
                  <span key={item.value} style={style} title="Sắp ra mắt">
                    <Icon name={item.icon} size={17} />{item.label}
                  </span>
                )
              }

              return (
                <Link key={item.value} to={item.to} style={style}>
                  <Icon name={item.icon} size={17} />{item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      <header style={{ background: 'var(--surface-card)', borderBottom: 'var(--bw) solid var(--border)' }}>
        <div className="max-w-container mx-auto flex items-center gap-4 px-4 md:px-8 py-5">
          <div className="flex-1">
            <h1 style={{ fontSize: 'var(--fs-h2)' }}>{title}</h1>
            {subtitle && <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</p>}
          </div>
          {actions}
        </div>
      </header>

      <div className="max-w-container mx-auto w-full px-4 md:px-8 py-8" style={{ boxSizing: 'border-box' }}>
        {children}
      </div>
    </div>
  )
}
