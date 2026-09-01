import { sessionFromTokenResponse, useAuthStore } from '../stores/useAuthStore.ts'
import type { TokenResponse } from './auth.ts'

// Base URL backend Spring Boot, xem task-connect-be/README.md.
// TODO: chuyen sang bien moi truong (import.meta.env.VITE_API_BASE_URL) khi co nhieu moi truong.
const BASE_URL = 'http://localhost:8080/api/v1'

// Ma loi JwtAuthenticationEntryPoint tra ve khi access token thieu/sai/het han
// (security/JwtAuthenticationEntryPoint.java) - rieng biet voi AUTH-401-INVALID_CREDENTIALS
// (sai mat khau luc login) hay AUTH-401-INVALID_REFRESH_TOKEN (refresh token het han), nen
// dung de nhan dien dung tinh huong "can xoay vong access token", tranh goi refresh nham.
const ACCESS_TOKEN_EXPIRED_CODE = 'COMMON-401-UNAUTHENTICATED'
const REFRESH_PATH = '/auth/refresh'

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  message?: string
  errorCode?: string
  code?: string
  timestamp?: string
}

// Gop cac 401 xay ra cung luc (vd nhieu request song song) thanh 1 lan goi /auth/refresh
// duy nhat, tranh xoay vong kep lam invalidate lan nhau.
let refreshPromise: Promise<boolean> | null = null

/** Goi POST /auth/refresh bang cookie httpOnly, cap nhat session moi vao store neu thanh cong. */
function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(BASE_URL + REFRESH_PATH, { method: 'POST', credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) return false
        const payload: ApiEnvelope<TokenResponse> | null = await response.json().catch(() => null)
        if (!payload?.success || !payload.data) return false
        // Giu nguyen vai tro dang xem hien tai (Poster/Tasker) - day la xoay vong am tham
        // giua luc nguoi dung dang thao tac (access token het han giua chung), khac
        // AuthBootstrap luc khoi dong trang: khong truyen activeRole se khien setSession()
        // tu roi ve mac dinh Poster, dang thao tac o trang gioi han Tasker se bi RoleGuard
        // day di ngay lap tuc.
        const currentRole = useAuthStore.getState().activeRole
        useAuthStore.getState().setSession(sessionFromTokenResponse(payload.data), currentRole ?? undefined)
        return true
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

/**
 * Loi API chuan hoa tu ApiResponse cua backend (common/response/ApiResponse.java,
 * xem 16-api-contract.md): { success:false, message, data, errorCode, timestamp }.
 * Khong co field "details" rieng - chi tiet loi (vd loi validate tung truong) nam
 * chung trong "data", cung cho voi du lieu tra ve luc thanh cong.
 */
export class ApiError extends Error {
  code?: string
  details?: unknown

  constructor(message: string, code?: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }
}

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  method?: string
  body?: unknown
}

/**
 * Goi mot endpoint REST, tu dinh JWT va cookie refresh token, tra ve truong "data" da mo ApiResponse.
 * Neu access token het han giua chung (loi ACCESS_TOKEN_EXPIRED_CODE), tu xoay vong qua
 * refresh token roi thu lai request 1 lan - user khong bi van ra loi vo ly do dang lam viec.
 * _retried chi danh cho lan goi lai noi bo, khong dung tu ben ngoai.
 */
export async function apiFetch<T = unknown>(path: string, { method = 'GET', body, headers, ...rest }: ApiFetchOptions = {}, _retried = false): Promise<T> {
  const accessToken = useAuthStore.getState().session?.accessToken

  const response = await fetch(BASE_URL + path, {
    method,
    credentials: 'include', // gui cookie httpOnly chua refresh token
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  })

  // 204 No Content khong co body de parse.
  const payload: ApiEnvelope<T> | null = response.status === 204
    ? null
    : await response.json().catch(() => null)

  // Chi thu refresh khi dang co session (tuc la vua co access token nhung bi tu choi) -
  // goi cac endpoint bao ve luc chua dang nhap thi khong co gi de xoay vong, khong nen
  // dat sessionExpired=true oan (se lam LoginPage hien nham thong bao "het phien").
  if (response.status === 401 && !_retried && payload?.errorCode === ACCESS_TOKEN_EXPIRED_CODE && useAuthStore.getState().session) {
    const refreshed = await refreshSession()
    if (refreshed) {
      return apiFetch<T>(path, { method, body, headers, ...rest }, true)
    }
    useAuthStore.getState().expireSession()
  }

  if (!response.ok || payload?.success === false) {
    throw new ApiError(
      payload?.message || `Yeu cau that bai (HTTP ${response.status}).`,
      payload?.errorCode || payload?.code,
      payload?.data, // backend nhet chi tiet loi vao chinh field "data", khong co "details" rieng
    )
  }

  return (payload?.data ?? payload) as T
}
