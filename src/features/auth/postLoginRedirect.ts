import type { NavigateFunction } from 'react-router-dom'
import type { TokenResponse } from '../../api/auth.ts'
import { broadcastSession } from '../../stores/authBroadcast.ts'
import { sessionFromTokenResponse, useAuthStore } from '../../stores/useAuthStore.ts'
import { useToastStore } from '../../stores/useToastStore.ts'

const PHONE_GATE_PATH = '/xac-minh-so-dien-thoai'

/**
 * Dung chung cho MOI luong cap token lan dau tien cua mot phien (dang nhap mat khau, dang
 * nhap Google, dang ky Google tu dong dang nhap) - set session, broadcast sang tab khac,
 * toast, roi dieu huong: sang cong xac minh so dien thoai neu day la lan dang nhap thanh cong
 * DAU TIEN cua tai khoan (tokens.firstLogin, xem TokenResponse), nguoc lai ve dich thuong
 * (deep-link "from" neu co, khong thi /tong-quan). Cong xac minh uu tien hon deep-link - day
 * la su kien mot-lan-duy-nhat cho moi tai khoan, khong nen bi bo qua chi vi nguoi dung vao tu
 * mot duong dan sau.
 *
 * Truoc khi co ham nay, LoginPage.finishLogin() va RegisterPage.handleGoogleSuccess() la 2
 * ban sao doc lap cua chinh logic nay - gop lai de tranh lech logic khi them nhanh firstLogin.
 */
export function finishLoginAndRedirect(tokens: TokenResponse, navigate: NavigateFunction, opts?: { from?: string }) {
  const session = sessionFromTokenResponse(tokens)
  // Truyen tokens.firstLogin thang vao setSession() (khong doi cho toi lenh navigate() ben
  // duoi) - setSession() tu kich GuestGuard re-render ngay (dang bao boc /dang-nhap luc
  // nay), can needsPhoneVerification co gia tri dung TRUOC do de GuestGuard tu redirect
  // dung cong xac minh thay vi /tong-quan, xem GuestGuard.tsx.
  useAuthStore.getState().setSession(session, undefined, tokens.firstLogin)
  broadcastSession(session)
  useToastStore.getState().pushToast('success', 'Đăng nhập thành công.')

  if (tokens.firstLogin) {
    navigate(PHONE_GATE_PATH, { replace: true })
    return
  }
  const from = opts?.from
  navigate(from && from !== '/dang-nhap' ? from : '/tong-quan', { replace: true })
}
