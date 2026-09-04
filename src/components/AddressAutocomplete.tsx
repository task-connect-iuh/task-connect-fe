import { useEffect, useRef, useState } from 'react'
import { Textarea } from '@ds/components/forms/Textarea'
import { searchAddress } from '../utils/geocoding.ts'
import type { AddressSuggestion } from '../utils/geocoding.ts'

const MIN_QUERY_LENGTH = 3
const DEBOUNCE_MS = 350

interface AddressAutocompleteProps {
  /** Dia chi da chon/luu that su - component chi hien gia tri nay khi khong dang go, khong
   *  bao gio tu y ghi de bang van ban dang go dang o (xem "chi cho chon tu dropdown" duoi day). */
  value: string
  onSelectSuggestion: (suggestion: AddressSuggestion) => void
  /** Bao ra ngoai khi o dang o trang thai "khong the luu duoc" (tim khong ra goi y nao cho
   *  van ban dang go) - cha component (ProfilePage) dung de chan nut "Luu thay doi" va hien
   *  loi o Field, xem ly do trong Javadoc component ben duoi. */
  onValidityChange: (invalid: boolean) => void
  disabled?: boolean
}

/**
 * O "Dia chi" kem dropdown goi y kieu GrabFood - CHI cho phep chon tu dropdown, khong cho luu
 * van ban tu go tay: o nhap dung de go TIM KIEM (query cuc bo, khong bao gio duoc bao ra ngoai
 * qua onSelectSuggestion neu khong chon), chon 1 goi y moi thuc su cap nhat "value" that (qua
 * onSelectSuggestion, cha component tu set state). Du lieu OSM tieng Viet khong day du/khong
 * go dau du de dan den goi y sai lech hoan toan (vd "ho guom" khong dau bi khop nham sang quan
 * "Ho Guom" o Duc thay vi Ho Guom that o Ha Noi - da kiem chung bang API), nen khoa cung ve
 * dung 1 nguon that: chi tin ket qua tu server, khong tin van ban tu do.
 *
 * Hai truong hop "go ma khong dung" duoc xu ly khac nhau, co chu y:
 * 1. Tim ra goi y (co dropdown) nhung bam ra ngoai khong chon dong nao: coi la nguoi dung doi
 *    y, IM LANG tra lai gia tri cu (khong chan Luu) - chi hien 1 dong nhac nho ("reverted").
 * 2. Tim KHONG RA goi y nao cho van ban dang go (server tra ve rong): coi la loi ro rang can
 *    nguoi dung sua ngay - BAO DO VIEN o (Textarea error=true) NGAY khi server tra ve xong
 *    (khong doi den luc blur), va bao "invalid" ra ngoai de ProfilePage chan nut Luu + hien
 *    thong bao o Field, thay vi am tham luu lai dia chi cu nhu truoc (gay hieu nham "da luu
 *    thanh cong" trong khi dia chi that ra khong doi).
 *
 * Component dung chung, khong thuoc @ds - DS chua co widget autocomplete nao, cung ly do
 * LocationPickerMap.tsx dung ngoai @ds.
 */
export function AddressAutocomplete({ value, onSelectSuggestion, onValidityChange, disabled }: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  // Bat khi handleBlur vua bo van ban go tay (khong khop "value" da luu) vi CO goi y nhung
  // khong chon dong nao - hien 1 dong nhac nho nhe, khong chan Luu (khac "invalid" ben duoi).
  const [reverted, setReverted] = useState(false)
  // true khi lan tim gan nhat cho van ban dang go tra ve RONG (khong co goi y nao) - khac
  // "reverted": truong hop nay chan Luu va giu nguyen van ban loi de nguoi dung thay ro con
  // sai o dau, khong am tham tra lai gia tri cu.
  const [invalid, setInvalid] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Ref cho callback moi nhat, cap nhat khong qua deps cua effect ben duoi - tranh effect bao
  // invalid ra ngoai chay lai moi lan ProfilePage re-render (truyen ham moi moi lan), chi
  // chay dung 1 lan khi gia tri invalid THAT SU doi (giong pattern onPickRef cua
  // LocationPickerMap.tsx).
  const onValidityChangeRef = useRef(onValidityChange)
  useEffect(() => {
    onValidityChangeRef.current = onValidityChange
  })
  useEffect(() => {
    onValidityChangeRef.current(invalid)
  }, [invalid])

  // Dong bo query hien thi theo "value" that (vd sau khi ProfilePage tai ho so, hoac nguoi
  // dung vua chon vi tri qua ban do/vi tri hien tai) - CHI khi khong dang go do, tranh de gia
  // tri ben ngoai ghi de len ky tu nguoi dung dang nhap giua chung.
  useEffect(() => {
    if (!editing) setQuery(value)
  }, [value, editing])

  // Dong dropdown khi bam ra ngoai component.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Huy debounce dang cho + request dang bay khi unmount, tranh setState sau khi component
  // da go khoi cay (vd nguoi dung dong dialog/chuyen trang giua luc dang go).
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  const runSearch = (text: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError('')
    searchAddress(text, controller.signal)
      .then((result) => {
        setSuggestions(result)
        setOpen(true)
        // Bao loi NGAY khi server xac nhan khong co goi y nao - khong doi den luc blur.
        setInvalid(result.length === 0)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError('Không tìm được địa chỉ. Kiểm tra mạng rồi thử lại.')
        setSuggestions([])
      })
      .finally(() => setLoading(false))
  }

  const handleChange = (text: string) => {
    setReverted(false)
    setQuery(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    abortRef.current?.abort()

    const trimmed = text.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSuggestions([])
      setOpen(false)
      setError('')
      // Rong (da xoa het) la hop le - dia chi khong bat buoc. Khong rong nhung chua du dai
      // de tim (1-2 ky tu, vd "da") van la van ban CHUA duoc xac nhan tu server - phai coi
      // la invalid GIONG HET truong hop tim ra 0 ket qua, khong duoc bo qua: neu khong, go
      // vai ky tu ngan roi bam Luu se bao "da luu thanh cong" trong khi gia tri that (value)
      // khong doi, gay hieu nham y het bug da gap voi van ban dai hon nguong tim kiem.
      setInvalid(trimmed.length > 0)
      return
    }
    // Xoa trang thai loi khi nguoi dung go du dai de thu tim lai - se duoc danh gia lai khi
    // ket qua tim kiem moi ve (xem runSearch).
    setInvalid(false)
    debounceRef.current = setTimeout(() => runSearch(trimmed), DEBOUNCE_MS)
  }

  const handleSelect = (suggestion: AddressSuggestion) => {
    onSelectSuggestion(suggestion)
    setQuery(suggestion.addressText)
    setOpen(false)
    setSuggestions([])
    setEditing(false)
    setReverted(false)
    setInvalid(false)
  }

  const handleBlur = () => {
    setEditing(false)
    setOpen(false)
    // Dang loi (tim khong ra goi y nao) - GIU NGUYEN van ban loi + do vien do, khong tra lai
    // gia tri cu, de nguoi dung thay ro dang can sua gi (ProfilePage da chan nut Luu roi).
    if (invalid) return
    // Co goi y nhung khong chon dong nao ma bam ra ngoai - truong hop nhe hon, im lang tra
    // lai gia tri cu, chi nhac nho bang dong chu xam.
    if (query.trim() !== value.trim()) setReverted(true)
    setQuery(value)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <Textarea
        rows={2}
        value={query}
        error={invalid}
        onFocus={() => { setEditing(true); setReverted(false); if (suggestions.length > 0) setOpen(true) }}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder="Gõ để tìm địa chỉ…"
        disabled={disabled}
      />
      {invalid && (
        <span style={{ display: 'block', marginTop: 'var(--sp-1)', fontSize: 'var(--fs-xs)', color: 'var(--danger)' }}>
          Không tìm thấy địa chỉ này. Nhập địa chỉ khác hoặc chọn vị trí trên bản đồ.
        </span>
      )}
      {reverted && !editing && !invalid && (
        <span style={{ display: 'block', marginTop: 'var(--sp-1)', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
          Chưa chọn địa chỉ hợp lệ từ danh sách gợi ý, đã giữ nguyên địa chỉ cũ.
        </span>
      )}
      {loading && (
        <span style={{ display: 'block', marginTop: 'var(--sp-1)', fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
          Đang tìm địa chỉ…
        </span>
      )}
      {!loading && error && (
        <span style={{ display: 'block', marginTop: 'var(--sp-1)', fontSize: 'var(--fs-xs)', color: 'var(--danger)' }}>
          {error}
        </span>
      )}
      {open && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 20,
            marginTop: 'var(--sp-1)',
            background: 'var(--surface-card)',
            border: 'var(--bw) solid var(--border)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-overlay)',
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.lat}-${suggestion.lng}-${index}`}
              type="button"
              onClick={() => handleSelect(suggestion)}
              onMouseDown={(e) => e.preventDefault()}
              className="flex items-center gap-2"
              style={{
                width: '100%',
                textAlign: 'left',
                padding: 'var(--sp-3) var(--sp-4)',
                background: 'none',
                border: 'none',
                borderBottom: index < suggestions.length - 1 ? 'var(--bw-hair) solid var(--border-subtle)' : 'none',
                cursor: 'pointer',
                fontSize: 'var(--fs-sm)',
                color: 'var(--text-body)',
              }}
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
