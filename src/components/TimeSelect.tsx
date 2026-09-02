import { Select } from '@ds/components/forms/Select'

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const BASE_MINUTES = ['00', '15', '30', '45']

interface TimeSelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

/**
 * Chon gio dang HH:MM bang hai <Select> (gio + phut theo moc 15 phut), thay cho
 * <input type="time"> - trinh duyet ve popup gio rieng, khong theo duoc mau/font cua DS va
 * xau tren nhieu he dieu hanh. Neu gia tri hien tai co phut le (khong roi vao moc 15), van
 * tu them vao danh sach de khong lam mat du lieu cu.
 */
export function TimeSelect({ value, onChange, disabled }: TimeSelectProps) {
  const [hour, minute] = value.split(':')
  const minuteOptions = BASE_MINUTES.includes(minute) ? BASE_MINUTES : [minute, ...BASE_MINUTES].sort()

  return (
    <div className="flex items-center gap-1">
      <Select
        aria-label="Giờ"
        style={{ width: 96 }}
        value={hour}
        disabled={disabled}
        onChange={(e) => onChange(`${e.target.value}:${minute}`)}
        options={HOURS.map((h) => ({ value: h, label: h }))}
      />
      <span style={{ color: 'var(--text-muted)', fontWeight: 'var(--fw-bold)' }}>:</span>
      <Select
        aria-label="Phút"
        style={{ width: 96 }}
        value={minute}
        disabled={disabled}
        onChange={(e) => onChange(`${hour}:${e.target.value}`)}
        options={minuteOptions.map((m) => ({ value: m, label: m }))}
      />
    </div>
  )
}
