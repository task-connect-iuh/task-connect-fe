import { Toast } from '@ds/components/feedback/Toast'
import { useToastStore } from '../stores/useToastStore.ts'

/**
 * Khoi thong bao toast toan cuc, co dinh o goc tren ben phai man hinh. Dat mot lan o
 * App.tsx (ngang hang AuthBootstrap) thay vi trong tung trang, de toast khong bi unmount
 * theo trang goc - vd toast "Dang nhap thanh cong" phai song sot qua navigate() sang
 * /tong-quan ngay sau khi dang nhap. Vi tri goc-tren-ben-phai va zIndex:50 theo dung quy
 * uoc da co san trong Design System (@ds/ui_kits/{poster,admin,tasker}App.jsx dung goc-duoi-
 * ben-phai cho cung mot pattern), chi doi tu bottom sang top theo yeu cau. Toast co the roi
 * dung vao thanh header teal-900 cua AppShell (top:32 nam trong vung header cao ~168px) -
 * KHONG day toast xuong de tranh, thay vao do Toast.jsx tu chon mau nen tuoi hon (--success)
 * cho tone success de van noi bat du dung tren header dam hay nen trang sang.
 */
export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts)
  const dismissToast = useToastStore((state) => state.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 32,
        right: 32,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-3)',
        maxWidth: 360,
      }}
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          tone={toast.tone}
          onClick={() => dismissToast(toast.id)}
          // Toast.jsx tu dat animation:'none' mac dinh, style truyen vao day duoc spread
          // sau nen ghi de duoc - keyframes tc-toast-slide-down dinh nghia trong index.css
          // (CSS thuan, khong lam duoc qua object style cua React).
          style={{ cursor: 'pointer', animation: 'tc-toast-slide-down var(--dur) var(--ease-out)' }}
        >
          {toast.message}
        </Toast>
      ))}
    </div>
  )
}
