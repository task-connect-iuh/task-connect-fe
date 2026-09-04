import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logoInverse from '@ds/assets/logo-lockup-inverse.svg'
import { Avatar } from '@ds/components/core/Avatar'
import { Icon } from '@ds/components/core/Icon'
import { IconButton } from '@ds/components/core/IconButton'
import { RoleSwitcher } from '@ds/components/navigation/RoleSwitcher'
import { logout as logoutRequest } from '../api/auth.ts'
import { getMyProfile } from '../api/users.ts'
import { broadcastLogout } from '../stores/authBroadcast.ts'
import { useAuthStore } from '../stores/useAuthStore.ts'
import { useProfileStore } from '../stores/useProfileStore.ts'
import { useToastStore } from '../stores/useToastStore.ts'
import { Tooltip } from './Tooltip.tsx'

interface NavItem {
  value: string
  label: string
  icon: string
  /** Co route that thi bam duoc; khong co nghia man do chua xay dung (hien mo, khong bam duoc). */
  to?: string
}

const BASE_NAV: NavItem[] = [
  { value: 'overview', label: 'Tổng quan', icon: 'gauge', to: '/tong-quan' },
  { value: 'post', label: 'Đăng việc', icon: 'file-plus-2' },
  { value: 'jobs', label: 'Việc của tôi', icon: 'clipboard-list' },
  { value: 'matches', label: 'Tasker gợi ý', icon: 'radar' },
  { value: 'chat', label: 'Tin nhắn', icon: 'message-square' },
  { value: 'profile', label: 'Hồ sơ', icon: 'user-round', to: '/ho-so' },
]

// Chi Tasker moi can xac thuc danh tinh va khai bao ky nang (xem docs/PROGRESS-FE-USER-MODULE.md
// "KYC Tasker-only") - Task Poster khong thay muc nay. Xac thuc danh tinh (KYC) va Ho so
// nang luc gop chung mot trang/mot muc nav duy nhat (TaskerSkillsPage) - CCCD chi xac thuc
// mot lan roi thoi nen tach rieng mot tab la thua, xem TaskerSkillsPage.tsx.
const TASKER_ONLY_NAV: NavItem[] = [
  { value: 'skills', label: 'Hồ sơ kỹ năng', icon: 'hard-hat', to: '/ho-so-nang-luc' },
]

// Nut mui ten cuon nav - dung teal dam (--teal-800 nen, --teal-600 vien), CUNG tong voi pill
// tab dang active ben duoi, khong dung amber: theo guardrail 5 cua CLAUDE.md, amber chi danh
// cho tien (escrow/giai ngan/vi), dat len nut thuong la sai du la yeu cau tu nguoi dung.
const NAV_ARROW_STYLE = { background: 'var(--teal-800)', border: 'var(--bw) solid var(--teal-600)', color: 'var(--on-deep)' }

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
  const nav = activeRole === 'tasker' ? [...BASE_NAV, ...TASKER_ONLY_NAV] : BASE_NAV

  const profile = useProfileStore((state) => state.profile)

  // AppShell duoc moi trang tu dung lai (khong phai layout route ben ngoai <Routes>), nen
  // remount moi lan chuyen trang - chi goi GET /users/me MOT LAN cho ca phien nho vao guard
  // "if (profile)" (store la singleton, song qua cac lan remount). Loi (vd chua co ho so,
  // USR-404-PROFILE_NOT_FOUND) bo qua trong im lang - avatar rieng ve "Tai khoan" mac dinh.
  useEffect(() => {
    if (profile) return
    getMyProfile().then((response) => useProfileStore.getState().setProfile(response)).catch(() => {})
  }, [profile])

  const navRef = useRef<HTMLElement>(null)
  const [navScroll, setNavScroll] = useState({ left: false, right: false })

  const updateNavScroll = () => {
    const el = navRef.current
    if (!el) return
    setNavScroll({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    })
  }

  useEffect(() => {
    updateNavScroll()
    window.addEventListener('resize', updateNavScroll)
    return () => window.removeEventListener('resize', updateNavScroll)
  }, [nav.length])

  const scrollNav = (direction: 1 | -1) => {
    navRef.current?.scrollBy({ left: direction * 220, behavior: 'smooth' })
  }

  const handleLogout = async () => {
    try {
      await logoutRequest()
    } catch {
      // Dang xuat la thao tac don phia client - loi mang o day khong ngan nguoi dung thoat.
    }
    useAuthStore.getState().logout()
    useProfileStore.getState().setProfile(null)
    // Bao cac tab khac cung trinh duyet biet vua dang xuat - xem authBroadcast.ts.
    broadcastLogout()
    useToastStore.getState().pushToast('success', 'Đã đăng xuất.')
    navigate('/dang-nhap', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-app)' }}>
      <div style={{ background: 'var(--teal-900)' }}>
        <div className="max-w-container mx-auto flex items-center gap-4 px-4 md:px-8" style={{ minHeight: 96 }}>
          <Link to="/tong-quan" className="tc-logo-link">
            <img src={logoInverse} alt="TaskConnect" style={{ height: 80 }} />
          </Link>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <RoleSwitcher value={roleSwitcherValue} onChange={setActiveRole} compact />
            <Tooltip label="Thông báo">
              <IconButton icon="bell" label="Thông báo" size="sm" style={{ color: 'var(--on-deep)' }} />
            </Tooltip>
            <Avatar name={profile?.fullName || 'Tài khoản'} src={profile?.avatarUrl ?? undefined} size={36} />
            <Tooltip label="Đăng xuất">
              <IconButton icon="log-out" label="Đăng xuất" size="sm" style={{ color: 'var(--on-deep)' }} onClick={handleLogout} />
            </Tooltip>
          </div>
        </div>
        <div className="max-w-container mx-auto px-4 md:px-8 pb-2">
          <div className="relative flex items-center gap-1">
            {navScroll.left && (
              <IconButton
                icon="chevron-left"
                label="Cuộn menu sang trái"
                size="sm"
                variant="ghost"
                className="flex-none"
                style={NAV_ARROW_STYLE}
                onClick={() => scrollNav(-1)}
              />
            )}
            <nav
              ref={navRef}
              className="flex gap-1 tc-scroll-hidden"
              style={{ overflowX: 'auto', scrollbarWidth: 'none' }}
              onScroll={updateNavScroll}
            >
              {nav.map((item) => {
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
            {navScroll.right && (
              <>
                <span
                  className="absolute pointer-events-none"
                  style={{ right: 44, top: 0, bottom: 0, width: 32, background: 'linear-gradient(to right, transparent, var(--teal-900))' }}
                />
                <IconButton
                  icon="chevron-right"
                  label="Cuộn menu sang phải"
                  size="sm"
                  variant="ghost"
                  className="flex-none"
                  style={NAV_ARROW_STYLE}
                  onClick={() => scrollNav(1)}
                />
              </>
            )}
          </div>
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
