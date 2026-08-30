import { useRef } from 'react'
import { Icon } from '@ds/components/core/Icon'

interface FileDropzoneProps {
  label: string
  hint?: string
  accept: string
  fileName?: string | null
  error?: string
  disabled?: boolean
  onSelect: (file: File) => void
}

/**
 * O chon file dang khung net dut, phong theo bo cuc trong @ds/ui_kits/tasker/KycScreen.jsx.
 * Component dung chung, khong thuoc @ds - DS chua co san khoi upload file nao (dung cho
 * avatar, anh CCCD, file chung chi Tasker deu qua presigned PUT S3 truc tiep tu client).
 */
export function FileDropzone({ label, hint, accept, fileName, error, disabled, onSelect }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-1.5"
        style={{
          height: 140,
          width: '100%',
          borderRadius: 'var(--r-md)',
          border: `var(--bw) dashed ${error ? 'var(--danger)' : fileName ? 'var(--teal-500)' : 'var(--teal-300)'}`,
          background: fileName ? 'var(--brand-tint)' : 'var(--bg-section)',
          color: 'var(--teal-700)',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Icon name={fileName ? 'check-circle-2' : 'plus'} size={22} />
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)' }}>{fileName || label}</span>
        {!fileName && hint && (
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', fontWeight: 'var(--fw-regular)' }}>{hint}</span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onSelect(file)
          e.target.value = ''
        }}
      />
      {error && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--danger)' }}>{error}</span>}
    </div>
  )
}
