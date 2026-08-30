import { useEffect, useRef } from 'react'
import { refresh } from '../api/auth.ts'
import { sessionFromTokenResponse, useAuthStore } from '../stores/useAuthStore.ts'

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
        setSession(sessionFromTokenResponse(tokens))
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
