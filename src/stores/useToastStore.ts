import { create } from 'zustand'

export type ToastTone = 'success' | 'danger' | 'money'

export interface ToastItem {
  id: number
  tone: ToastTone
  message: string
}

interface ToastState {
  toasts: ToastItem[]
  pushToast: (tone: ToastTone, message: string) => void
  dismissToast: (id: number) => void
}

// Thoi gian toast tu bien mat - khong phai nguong nghiep vu (khac voi cac hang so trong
// AuthService), chi la lua chon UX, khong can doc tu admin.system_parameters.
const TOAST_DURATION_MS = 4000

let nextToastId = 0

// Store toan cuc cho toast (thong bao thoang qua, goc man hinh) - tach khoi useAuthStore vi
// day la trang thai UI thuan tuy, khong phai du lieu phien dang nhap. Dat o day (khong phai
// component state cuc bo) de toast song sot qua navigate() sau khi dang nhap thanh cong -
// LoginPage unmount ngay sau khi dieu huong sang /tong-quan, ToastContainer mount rieng o
// App.tsx moi khong bi unmount theo.
export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  pushToast: (tone, message) => {
    const id = nextToastId++
    set((state) => ({ toasts: [...state.toasts, { id, tone, message }] }))
    setTimeout(() => get().dismissToast(id), TOAST_DURATION_MS)
  },

  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}))
