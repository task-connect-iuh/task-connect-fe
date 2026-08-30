import { create } from 'zustand'
import type { AccountRole, AccountStatus, TokenResponse } from '../api/auth.ts'

// 3 vai tro theo dung tu vung nghiep vu, xem 01-domain-glossary.md.
export type Role = 'poster' | 'tasker' | 'admin'

export interface Session {
  accessToken: string
  account: {
    id: string
    status: AccountStatus
    roles: Role[]
  }
}

interface AuthState {
  session: Session | null
  activeRole: Role | null
  // true sau khi da thu xoay vong phien qua cookie refresh_token luc app khoi dong
  // (thanh cong hay that bai deu tinh la xong) - dung de RoleGuard khong redirect
  // nham ve /dang-nhap trong luc con dang kiem tra phien cu con hieu luc hay khong.
  hydrated: boolean
  // true khi apiFetch tu dong dang xuat vi access token het han va refresh token
  // (cookie) cung khong con hieu luc - RoleGuard doc co nay de bao cho user biet ly do
  // bi day ve /dang-nhap, thay vi im lang nhu logout thuong. Duoc reset ve false ngay khi
  // co session moi (setSession) hoac logout thu cong, xem apiFetch trong api/client.ts.
  sessionExpired: boolean
  setSession: (session: Session | null, activeRole?: Role) => void
  setActiveRole: (activeRole: Role) => void
  setHydrated: () => void
  // Cap nhat lac quan status sau khi verify-email thanh cong - endpoint do tra Void,
  // khong tra TokenResponse moi, nhung ta biet chac status backend da chuyen ACTIVE.
  setAccountStatus: (status: AccountStatus) => void
  logout: () => void
  expireSession: () => void
}

const ROLE_MAP: Record<AccountRole, Role> = {
  TASK_POSTER: 'poster',
  TASKER: 'tasker',
  ADMIN: 'admin',
}

/** Chuyen TokenResponse tu backend thanh Session dung trong store. */
export function sessionFromTokenResponse(tokens: TokenResponse): Session {
  return {
    accessToken: tokens.accessToken,
    account: {
      id: tokens.accountId,
      status: tokens.status,
      roles: tokens.roles.map((role) => ROLE_MAP[role]),
    },
  }
}

// Phien dang nhap va vai tro dang hoat dong, dung chung nhieu man hinh.
// Khong luu localStorage (cam theo 21-react-frontend.md) - chi giu accessToken trong bo
// nho. Refresh token song trong cookie httpOnly (xem api/auth.ts refresh()), AuthBootstrap
// goi lai khi app khoi dong de phuc hoi Session qua lan tai lai trang.
export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  activeRole: null,
  hydrated: false,
  sessionExpired: false,

  setSession: (session, activeRole) => set({
    session,
    // Mac dinh vao vai tro Poster sau dang nhap (quyet dinh da chot) - tai khoan tu dang ky
    // luon co ca 2 vai tro, chon vai tro dang hoat dong that su la viec cua man hinh khac,
    // lam sau. Chi roi ve roles[0] khi tai khoan khong co Poster (vd tai khoan Admin).
    activeRole: activeRole ?? (session?.account.roles.includes('poster') ? 'poster' : session?.account.roles[0]) ?? null,
    sessionExpired: false,
  }),

  setActiveRole: (activeRole) => set({ activeRole }),
  setHydrated: () => set({ hydrated: true }),

  setAccountStatus: (status) => set((state) => (
    state.session ? { session: { ...state.session, account: { ...state.session.account, status } } } : {}
  )),

  logout: () => set({ session: null, activeRole: null, sessionExpired: false }),

  expireSession: () => set({ session: null, activeRole: null, sessionExpired: true }),
}))
