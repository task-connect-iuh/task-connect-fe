import { useState } from 'react'
import { Alert } from '@ds/components/feedback/Alert'
import { Button } from '@ds/components/core/Button'
import { Dialog } from '@ds/components/feedback/Dialog'
import { PhoneVerificationFlow } from '../features/auth/PhoneVerificationFlow.tsx'
import { updatePhone } from '../api/auth.ts'
import { DialogViewport } from './DialogViewport.tsx'
import { useLockBodyScroll } from '../utils/useLockBodyScroll.ts'

interface PhoneChangeDialogProps {
  currentPhone: string | null
  onClose: () => void
  /** Goi sau khi doi/them so dien thoai thanh cong, kem so moi - ProfilePage tu cap nhat lai state hien thi. */
  onChanged: (newPhone: string) => void
}

type Step = 'verify-old' | 'enter-new' | 'success'

/**
 * Modal them/doi so dien thoai - bat buoc xac minh qua Firebase Phone Auth (PhoneVerificationFlow)
 * truoc khi luu, cung tinh than voi EmailChangeDialog (xac minh quyen so huu truoc khi doi
 * mot truong dinh danh). Khi DOI so (currentPhone khac null - tai khoan da co so cu duoc xac
 * minh), them buoc "verify-old" bat buoc xac minh lai chinh so HIEN TAI (PhoneVerificationFlow
 * o che do lockPhone, khong cho go tay so khac) truoc khi cho nhap so MOI - chan truong hop
 * mot phien dang nhap bi chiem doat tu doi thang so ma khong chung minh gi voi so cu. Day
 * KHONG chi la rao UI: AuthService.updatePhone() o backend cung bat buoc kem oldFirebaseIdToken
 * tuong ung va tu verify lai qua Firebase Admin SDK, tu choi neu thieu/sai (AUTH-409-OLD_PHONE_NOT_VERIFIED).
 * Neu la lan dau them so (currentPhone null, chua co gi de chung minh quyen so huu so cu) thi
 * bo qua buoc nay, vao thang "enter-new" nhu truoc.
 *
 * Khong tu bat loi tu updatePhone() o day - de nguyen cho PhoneVerificationFlow bat va hien
 * qua otpError cua chinh no (component do da uu tien ApiError.message khi co), tranh 2 lop
 * hien loi chong nhau cho cung mot that bai.
 */
export function PhoneChangeDialog({ currentPhone, onClose, onChanged }: PhoneChangeDialogProps) {
  useLockBodyScroll(true)
  const [step, setStep] = useState<Step>(currentPhone ? 'verify-old' : 'enter-new')
  const [oldIdToken, setOldIdToken] = useState('')
  const [savedPhone, setSavedPhone] = useState('')

  const handleOldVerified = (_phoneLocal: string, firebaseIdToken: string) => {
    setOldIdToken(firebaseIdToken)
    setStep('enter-new')
  }

  const handleNewVerified = async (phoneLocal: string, firebaseIdToken: string) => {
    await updatePhone(phoneLocal, firebaseIdToken, currentPhone ? oldIdToken : undefined)
    setSavedPhone(phoneLocal)
    setStep('success')
    onChanged(phoneLocal)
  }

  return (
    <DialogViewport>
      <Dialog
        title={currentPhone ? 'Đổi số điện thoại' : 'Xác minh số điện thoại'}
        subtitle={
          step === 'success'
            ? undefined
            : step === 'verify-old'
              ? 'Xác minh quyền sở hữu số điện thoại hiện tại trước khi đổi sang số mới'
              : 'Nhận mã xác minh qua SMS để chứng minh bạn sở hữu số điện thoại này'
        }
        onClose={onClose}
      >
        <div className="flex flex-col gap-4">
          {step === 'verify-old' && currentPhone && (
            <PhoneVerificationFlow initialPhone={currentPhone} lockPhone onVerified={handleOldVerified} />
          )}
          {step === 'enter-new' && <PhoneVerificationFlow onVerified={handleNewVerified} />}
          {step === 'success' && (
            <>
              <Alert tone="success" title="Xác minh thành công">
                Số điện thoại của bạn đã được đổi sang {savedPhone} và xác minh thành công.
              </Alert>
              <Button variant="primary" size="md" onClick={onClose} style={{ alignSelf: 'flex-end' }}>Đóng</Button>
            </>
          )}
        </div>
      </Dialog>
    </DialogViewport>
  )
}
