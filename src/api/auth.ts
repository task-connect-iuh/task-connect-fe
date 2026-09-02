import { apiFetch } from './client.ts'

// Khop dung enum that cua backend, xem vn.taskconnect.auth.api.AccountRole/AccountStatus.
export type AccountRole = 'TASK_POSTER' | 'TASKER' | 'ADMIN'
export type AccountStatus = 'UNVERIFIED' | 'ACTIVE' | 'LOCKED' | 'SUSPENDED'

/** Khop TokenResponse that - refreshToken khong nam trong body (JsonIgnore, chi qua cookie httpOnly). */
export interface TokenResponse {
  accessToken: string
  tokenType: string
  expiresInSeconds: number
  accountId: string
  status: AccountStatus
  roles: AccountRole[]
}

export interface RegisterPayload {
  fullName: string
  email: string
  phone?: string
  password: string
  confirmPassword: string
  roles: AccountRole[]
}

export interface LoginPayload {
  email: string
  password: string
}

/** register() khong con tra token - tai khoan moi tao la UNVERIFIED, phai xac minh OTP
 *  roi tu dang nhap that qua login() (backend chan hoan toan login khi UNVERIFIED). */
export function register(payload: RegisterPayload) {
  return apiFetch<void>('/auth/register', { method: 'POST', body: payload })
}

export function login(payload: LoginPayload) {
  return apiFetch<TokenResponse>('/auth/login', { method: 'POST', body: payload })
}

/** Xoay vong phien bang refresh token trong cookie httpOnly - khong can body. */
export function refresh() {
  return apiFetch<TokenResponse>('/auth/refresh', { method: 'POST' })
}

export function logout() {
  return apiFetch<void>('/auth/logout', { method: 'POST' })
}

export function verifyEmail(payload: { email: string, otp: string }) {
  return apiFetch<void>('/auth/verify-email', { method: 'POST', body: payload })
}

export function resendVerification(payload: { email: string }) {
  return apiFetch<{ retryAfterSeconds: number }>('/auth/resend-verification', { method: 'POST', body: payload })
}

export function forgotPassword(payload: { email: string }) {
  return apiFetch<{ retryAfterSeconds: number }>('/auth/forgot-password', { method: 'POST', body: payload })
}

export function resetPassword(payload: { email: string, otp: string, newPassword: string, confirmNewPassword: string }) {
  return apiFetch<void>('/auth/reset-password', { method: 'POST', body: payload })
}

/** Doi mat khau khi da dang nhap (can access token) - khac resetPassword, khong dung OTP. Thanh cong se thu hoi phien hien tai (refresh token cookie), FE phai tu logout/dieu huong ve dang nhap. */
export function changePassword(payload: { currentPassword: string, newPassword: string, confirmNewPassword: string }) {
  return apiFetch<void>('/auth/change-password', { method: 'POST', body: payload })
}
