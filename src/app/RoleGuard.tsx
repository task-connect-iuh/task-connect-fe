import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore, type Role } from '../stores/useAuthStore.ts'

interface RoleGuardProps {
  allow?: Role[]
  children: ReactNode
}

/**
 * Guard theo vai tro that. Chua "hydrated" (AuthBootstrap con dang thu xoay vong phien
 * qua cookie refresh_token) thi khong render gi va khong redirect - tranh nhap nhay ve
 * /dang-nhap roi bat lai vao trang cu khi phien cookie van con hieu luc.
 */
export function RoleGuard({ allow = [], children }: RoleGuardProps) {
  const hydrated = useAuthStore((state) => state.hydrated)
  const session = useAuthStore((state) => state.session)
  const activeRole = useAuthStore((state) => state.activeRole)
  const sessionExpired = useAuthStore((state) => state.sessionExpired)
  const location = useLocation()

  if (!hydrated) return null

  if (!session) {
    return <Navigate to="/dang-nhap" replace state={{ from: location.pathname, expired: sessionExpired }} />
  }

  const isAllowed = allow.length === 0 || (activeRole !== null && allow.includes(activeRole))
  if (!isAllowed) {
    return <Navigate to="/dang-nhap" replace />
  }

  return children
}
