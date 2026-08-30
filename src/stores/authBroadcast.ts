import { useAuthStore, type Session } from './useAuthStore.ts'

/**
 * Dong bo Session giua cac tab cung trinh duyet, cung origin. Zustand chi song trong bo
 * nho rieng cua tung tab - dang nhap/dang xuat o 1 tab khong tu phan anh sang tab khac
 * (truoc day phai F5 de AuthBootstrap goi lai /auth/refresh bang cookie dung chung).
 *
 * Dung BroadcastChannel (API trinh duyet co san, khong phai thu vien them) thay vi ghi
 * mot key "danh dau" vao localStorage roi bat 'storage' event: localStorage bi cam cho du
 * lieu nghiep vu (21-react-frontend.md). BroadcastChannel khong luu tru gi ca, chi la kenh
 * pub/sub tam thoi giua cac browsing context cung origin - giu dung tinh than "chi o bo
 * nho" nhu accessToken hien tai, va khong bao gio vuot origin (khac postMessage).
 *
 * KHONG goi broadcastSession/broadcastLogout ben trong action cua useAuthStore: lam vay se
 * tao vong lap vo han (tab A phat -> tab B nhan roi tu phat lai -> tab A nhan lai...). Ham
 * o day CHI duoc goi tuong minh tai noi phat sinh that su (LoginPage sau khi dang nhap
 * thanh cong, AppShell sau khi dang xuat) - phia nhan (onmessage duoi day) chi cap nhat
 * state cuc bo, khong phat lai. RoleGuard/GuestGuard da subscribe Zustand nen tu dieu huong
 * lai khi session thay doi, khong can goi navigate() thu cong o day.
 */
type AuthBroadcastMessage =
  | { type: 'session'; session: Session }
  | { type: 'logout' }

// Trinh duyet cu (hiem, khong trong danh sach ho tro chinh thuc cua du an) khong co
// BroadcastChannel - coi nhu khong dong bo duoc, khong lam sap app.
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('taskconnect-auth') : null

channel?.addEventListener('message', (event: MessageEvent<AuthBroadcastMessage>) => {
  if (event.data.type === 'session') {
    useAuthStore.getState().setSession(event.data.session)
  } else {
    useAuthStore.getState().logout()
  }
})

/** Bao cac tab khac vua co Session moi (goi ngay sau setSession() luc dang nhap thanh cong). */
export function broadcastSession(session: Session) {
  channel?.postMessage({ type: 'session', session } satisfies AuthBroadcastMessage)
}

/** Bao cac tab khac vua dang xuat (goi ngay sau logout() thu cong cua nguoi dung). */
export function broadcastLogout() {
  channel?.postMessage({ type: 'logout' } satisfies AuthBroadcastMessage)
}
