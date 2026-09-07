import type { ReactNode } from 'react'

/**
 * Boc quanh <Dialog> cua @ds. Dialog goc dung position: absolute nen containing block cua no
 * la tai lieu (document) - khi trang da cuon xuong truoc luc mo dialog, lop overlay "inset: 0"
 * cua Dialog neo vao dinh TAI LIEU chu khong phai dinh KHUNG NHIN dang thay, nen dialog hien
 * lech len tren, ngoai vung nhin thay. Boc trong 1 the position: fixed; inset: 0 bien no thanh
 * containing block moi cho Dialog (con position: absolute o trong se bam theo the fixed nay),
 * ep Dialog luon phu dung khung nhin bat ke trang dang cuon toi dau. Dung chung voi
 * useLockBodyScroll de khoa luon ca scroll nen.
 */
export function DialogViewport({ children }: { children: ReactNode }) {
  return <div style={{ position: 'fixed', inset: 0, zIndex: 40 }}>{children}</div>
}
