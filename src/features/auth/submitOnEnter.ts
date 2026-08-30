import type { KeyboardEvent } from 'react'

// Cac type input khong nen kich hoat submit bang Enter: checkbox/radio doi Space,
// button/submit/reset da tu co hanh vi rieng, file khong lien quan toi form auth.
const IGNORED_INPUT_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'file'])

/**
 * Cac trang Auth khong dung the <form> that (Button cua Design System luon render
 * type="button", xem Button.jsx - khong the sua vi thu muc DS chi doc) nen trinh duyet
 * khong tu submit khi nguoi dung nhan Enter trong o nhap. Ham nay tra ve mot onKeyDown
 * gan len div bao ngoai cua trang, bat Enter tu bat ky o text nao ben trong va goi lai
 * dung ham ma nut chinh dang goi, mo phong hanh vi "Enter = bam nut chinh" nhu form binh
 * thuong.
 */
export function submitOnEnter(onSubmit: () => void, disabled = false) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' || disabled) return
    const target = event.target as HTMLElement
    if (target.tagName !== 'INPUT') return
    if (IGNORED_INPUT_TYPES.has((target as HTMLInputElement).type)) return
    event.preventDefault()
    onSubmit()
  }
}
