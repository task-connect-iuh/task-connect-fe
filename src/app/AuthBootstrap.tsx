import { useEffect, useRef } from 'react'
import { refresh } from '../api/auth.ts'
// Import chi de dang ky listener dong bo Session giua cac tab (side effect luc module nap
// lan dau) - xem authBroadcast.ts. AuthBootstrap la noi chac chan mount o moi trang, hop
// ly nhat de dam bao listener luon san sang bat ke route nao dang mo.
import '../stores/authBroadcast.ts'
import { readPersistedActiveRole, sessionFromTokenResponse, useAuthStore } from '../stores/useAuthStore.ts'

/**
 * Chay dung mot lan luc app khoi dong: thu xoay vong phien bang cookie httpOnly
 * refresh_token (con hieu luc thi backend phat access token moi). Day la cach duy nhat
 * de Session song qua lan F5, vi accessToken chi nam trong bo nho Zustand (cam
 * localStorage cho du lieu nghiep vu, xem 21-react-frontend.md). Khong co cookie hop le
 * (chua tung dang nhap, cookie het han) la tinh huong binh thuong, khong phai loi.
 *
 * Dung ref-guard (startedRef) thay vi AbortController: da thu AbortController truoc do
 * nhung khong dang tin cay tren localhost - abort() chi dam bao client ngung xu ly
 * response, khong dam bao request chua kip roi trinh duyet. Vi round-trip localhost cuc
 * nhanh, request dau tien co the da toi va duoc backend xu ly xong (rotate that trong DB)
 * truoc khi chu ky mount-cleanup-mount dong bo cua StrictMode kip goi abort(). startedRef
 * chan hoan toan khac: no ngan khong cho fetch() lan 2 duoc goi tu dau, khong phu thuoc
 * toc do mang - gia tri ref giu nguyen xuyen suot chu ky gia lap cua StrictMode vi van la
 * cung mot instance component, khong thuc su unmount.
 */
export function AuthBootstrap() {
  const setSession = useAuthStore((state) => state.setSession)
  const setHydrated = useAuthStore((state) => state.setHydrated)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    refresh()
      .then((tokens) => {
        const session = sessionFromTokenResponse(tokens)
        // Khoi phuc dung vai tro dang xem truoc F5 (neu tai khoan van con giu vai tro do) -
        // khong thi setSession() tu roi ve mac dinh Poster, khien cac trang gioi han theo
        // vai tro Tasker (RoleGuard allow=['tasker']) da bat ra ngay sau khi phien duoc
        // khoi phuc, xem readPersistedActiveRole() trong useAuthStore.ts.
        const persistedRole = readPersistedActiveRole()
        const restoredRole = persistedRole && session.account.roles.includes(persistedRole) ? persistedRole : undefined
        setSession(session, restoredRole)
      })
      .catch(() => {
        // Khong co phien cu hop le - giu session null, khong bao loi cho nguoi dung.
      })
      .finally(() => {
        setHydrated()
      })
  }, [setSession, setHydrated])

  return null
}
