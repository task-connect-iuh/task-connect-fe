import { create } from 'zustand'
import type { ProfileResponse } from '../api/users.ts'

interface ProfileState {
  profile: ProfileResponse | null
  setProfile: (profile: ProfileResponse | null) => void
}

// Ho so cua chinh minh, dung chung giua ProfilePage (nguon cap nhat) va AppShell (chi doc,
// hien avatar/ten tren thanh tren) - tach store rieng vi AppShell duoc moi trang tu dung
// lai (khong phai layout route ben ngoai Routes trong App.tsx), can du lieu song qua cac
// lan remount ma khong phai goi lai GET /users/me moi lan chuyen trang.
export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
}))
