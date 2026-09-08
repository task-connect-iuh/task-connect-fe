import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/useAuthStore.ts'

// Guong gia tri --dur-slow (tokens/motion.css) - khong doc truc tiep CSS custom property
// vao setTimeout duoc, nen giu hang so rieng o day. Doi token thi doi luon hang so nay.
const STEP_MS = 420

/**
 * Thanh tien trinh mong o mep tren, chi hien trong luc AuthBootstrap con xoay vong phien
 * qua cookie refresh_token luc tai trang lan dau (hydrated=false) - thay cho man hinh
 * trang tron hien tai cua RoleGuard/GuestGuard (ca hai deu "return null" khi chua
 * hydrated). 20-design-system.md cam animation lap vo han ("Khong lap vo han, khong troi
 * noi") nen day KHONG phai spinner xoay lien tuc: la mot chuoi buoc huu han, chi dung
 * dung token thoi luong san co (--dur-slow) - tien dan toi ~72% roi DUNG YEN (khong con
 * gi tu dong chay tiep) cho toi khi hydrated that su xong, luc do moi chay not 100% roi
 * mo dan bien mat. Toan bo la mot lan chuyen trang thai (dang khoi dong -> da hydrated),
 * dung tinh chat "motion chi danh cho thay doi trang thai" cua DS goc, khong phai ngoai le.
 */
export function TopLoadingBar() {
  const hydrated = useAuthStore((state) => state.hydrated)
  const [width, setWidth] = useState(0)
  const [fading, setFading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (hydrated) return undefined

    // rAF de trinh duyet ghi nhan width:0% o frame dau, roi moi doi gia tri ke tiep -
    // thieu buoc nay, React/trinh duyet co the gop chung lam mot va CSS transition se
    // khong chay (nhay thang tu 0% len gia tri cuoi, khong animate).
    const raf = requestAnimationFrame(() => setWidth(28))
    const step2 = setTimeout(() => setWidth(52), STEP_MS)
    const step3 = setTimeout(() => setWidth(72), STEP_MS * 2)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(step2)
      clearTimeout(step3)
    }
  }, [hydrated])

  useEffect(() => {
    if (!hydrated) return undefined

    setWidth(100)
    const fadeTimer = setTimeout(() => setFading(true), STEP_MS)
    const doneTimer = setTimeout(() => setDone(true), STEP_MS * 2)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [hydrated])

  if (done) return null

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: `${width}%`,
        height: 'var(--bw)',
        background: 'var(--brand)',
        zIndex: 70,
        opacity: fading ? 0 : 1,
        transition: `width var(--dur-slow) var(--ease-out), opacity var(--dur-slow) var(--ease-out)`,
      }}
    />
  )
}
