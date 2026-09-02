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

// Luu lai vai tro dang xem (Poster/Tasker) qua lan F5 trong CUNG mot tab. Day khong phai
// du lieu nghiep vu (token, so du...) - chi la mot tuy chon giao dien giong theme, thuoc
// dung ngoai le cho phep cua 21-react-frontend.md ("Cam localStorage luu du lieu nghiep
// vu. Chi dung cho lua chon giao dien nhu theme"). Dung sessionStorage (khong phai
// localStorage): tu xoa khi dong tab/trinh duyet, khong ton tai vinh vien.
const ACTIVE_ROLE_STORAGE_KEY = 'tc-active-role'

function persistActiveRole(role: Role | null) {
  try {
    if (role) sessionStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, role)
    else sessionStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY)
  } catch {
    // sessionStorage co the bi chan (che do rieng tu nghiem ngat) - bo qua, khong lam gian
    // doan luong dang nhap chi vi mot tuy chon UI khong luu duoc.
  }
}

/** Doc lai vai tro da luu tu lan truoc (neu co) - AuthBootstrap dung de khoi phuc dung vai tro dang xem sau F5, thay vi luon roi ve Poster mac dinh. */
export function readPersistedActiveRole(): Role | null {
  try {
    const stored = sessionStorage.getItem(ACTIVE_ROLE_STORAGE_KEY)
    return stored === 'poster' || stored === 'tasker' || stored === 'admin' ? stored : null
  } catch {
    return null
  }
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

  setSession: (session, activeRole) => {
    // Mac dinh vao vai tro Poster sau dang nhap (quyet dinh da chot) - tai khoan tu dang ky
    // luon co ca 2 vai tro, chon vai tro dang hoat dong that su la viec cua man hinh khac,
    // lam sau. Chi roi ve roles[0] khi tai khoan khong co Poster (vd tai khoan Admin).
    // activeRole truyen vao tu ben ngoai (AuthBootstrap khoi phuc tu sessionStorage luc F5,
    // hoac refreshSession trong api/client.ts giu nguyen vai tro dang co giua phien) duoc
    // uu tien truoc, chi roi ve mac dinh Poster khi khong co gia tri nao duoc truyen.
    const resolvedRole = activeRole
      ?? (session?.account.roles.includes('poster') ? 'poster' : session?.account.roles[0])
      ?? null
    persistActiveRole(resolvedRole)
    set({ session, activeRole: resolvedRole, sessionExpired: false })
  },

  setActiveRole: (activeRole) => {
    persistActiveRole(activeRole)
    set({ activeRole })
  },
  setHydrated: () => set({ hydrated: true }),

  setAccountStatus: (status) => set((state) => (
    state.session ? { session: { ...state.session, account: { ...state.session.account, status } } } : {}
  )),

  logout: () => {
    persistActiveRole(null)
    set({ session: null, activeRole: null, sessionExpired: false })
  },

  expireSession: () => {
    persistActiveRole(null)
    set({ session: null, activeRole: null, sessionExpired: true })
  },
}))
