import { create } from 'zustand'

// Thoi gian 1 toast tu bien mat neu khong ai bam tat som - du de doc 1 cau ngan, khong qua
// lau lam vuong man hinh o goc tren-phai.
const AUTO_DISMISS_MS = 4000

export interface ToastItem {
  id: string
  tone: 'success' | 'danger' | 'money'
  message: string
}

interface ToastState {
  toasts: ToastItem[]
  // Them 1 toast moi vao cuoi hang doi, tu len lich xoa sau AUTO_DISMISS_MS - goi
  // imperatively tu bat ky handler nao qua useToastStore.getState().pushToast(...), khong
  // can component dang goi phai subscribe store nay.
  pushToast: (tone: ToastItem['tone'], message: string) => void
  // Xoa 1 toast theo id - dung khi het gio tu dong AN, hoac nguoi dung tu bam tat som.
  dismissToast: (id: string) => void
}

// Hang doi toast hien o goc tren-phai (xem ToastHost.tsx) - thay cho cac Alert thanh cong
// nam im trong trang, khong tu an, de bi bo lo khi trang dai. Khong dung thu vien ngoai,
// tan dung dung component Toast co san cua Design System (feedback/Toast.jsx).
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  pushToast: (tone, message) => {
    const id = crypto.randomUUID()
    set((state) => ({ toasts: [...state.toasts, { id, tone, message }] }))
    setTimeout(() => get().dismissToast(id), AUTO_DISMISS_MS)
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}))
