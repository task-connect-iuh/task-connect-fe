import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore.ts'

interface GuestGuardProps {
  children: ReactNode
}

/**
 * Nguoc voi RoleGuard: chan nguoi DA dang nhap khoi cac man chi danh cho khach (Dang nhap,
 * Dang ky, Quen mat khau) - ca khi ho tu sua URL lan tro thang toi, lan mo tab moi cung
 * trinh duyet (cookie refresh_token dung chung moi tab trong cung profile, AuthBootstrap se
 * tu phuc hoi Session o tab moi qua /auth/refresh). Dua ve /tong-quan - khu vuc that su cua
 * nguoi da dang nhap. Cho qua hydrated truoc de khong redirect nham trong luc con cho ket
 * qua refresh() luc app vua khoi dong - xem RoleGuard.tsx cho ly do tuong tu.
 *
 * "/" KHONG boc guard nay: la trang gioi thieu cong khai, nguoi da dang nhap van xem duoc
 * binh thuong (khong bi day ve /tong-quan).
 *
 * Khong boc /xac-minh, /dat-lai-mat-khau: /xac-minh can vao duoc ngay ca khi da co Session
 * vi luong dang ky that tu dong dang nhap truoc khi xac minh email (xem RegisterPage.tsx);
 * /dat-lai-mat-khau da tu kiem tra route state rieng, khong can chan them o day.
 */
export function GuestGuard({ children }: GuestGuardProps) {
  const hydrated = useAuthStore((state) => state.hydrated)
  const session = useAuthStore((state) => state.session)

  if (!hydrated) return null
  if (session) return <Navigate to="/tong-quan" replace />

  return children
}
