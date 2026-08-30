import type { ChangeEvent } from 'react'
import { IconButton } from '@ds/components/core/IconButton'
import { Field } from '@ds/components/forms/Field'
import { Input } from '@ds/components/forms/Input'

interface PasswordInputProps {
  label: string
  placeholder?: string
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  error?: string
  disabled?: boolean
  show: boolean
  onToggleShow: () => void
}

/**
 * Field mat khau voi nut an/hien nam long trong o input. `Input` cua DS khong co prop
 * nhan ReactNode lam suffix (chi nhan string, xem Input.d.ts) nen khong the truyen thang
 * IconButton qua suffix - dat de tren bang overlay tuyet doi thay vi sua component DS goc
 * (kho chi doc, xem 20-design-system.md). `paddingRight` chua canh input de chu khong
 * chui xuong duoi nut.
 */
export function PasswordInput({ label, placeholder, value, onChange, error, disabled, show, onToggleShow }: PasswordInputProps) {
  return (
    <Field label={label} error={error}>
      <div className="relative">
        <Input
          icon="lock"
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          error={!!error}
          disabled={disabled}
          style={{ paddingRight: 44 }}
        />
        <div className="absolute" style={{ right: 4, top: '50%', transform: 'translateY(-50%)' }}>
          <IconButton
            type="button"
            icon={show ? 'eye-off' : 'eye'}
            label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            variant="ghost"
            size="sm"
            onClick={onToggleShow}
            disabled={disabled}
          />
        </div>
      </div>
    </Field>
  )
}
