import { Toast } from '@ds/components/feedback/Toast'
import { useToastStore } from '../stores/useToastStore.ts'

/**
 * Noi hien toan bo toast dang cho, co dinh goc tren-phai man hinh - mount DUY NHAT 1 lan o
 * App.tsx (khong mount trong AppShell.tsx vi Shell tu remount theo tung trang, xem comment
 * trong file do). zIndex 50 - cao hon overlay cua Dialog (40, xem Dialog.jsx cua DS), thap
 * hon gia tri cao nhat tung thay trong DS (60), du de toast luon noi len tren dialog dang mo.
 * Bam vao 1 toast de tat som, khong bat buoc cho het 4 giay.
 */
export function ToastHost() {
  const toasts = useToastStore((state) => state.toasts)
  const dismissToast = useToastStore((state) => state.dismissToast)

  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 'var(--sp-5)',
        right: 'var(--sp-5)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-3)',
        maxWidth: 360,
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} onClick={() => dismissToast(toast.id)} style={{ cursor: 'pointer' }}>
          <Toast tone={toast.tone}>{toast.message}</Toast>
        </div>
      ))}
    </div>
  )
}
