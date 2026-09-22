import { useEffect, useRef, useState } from 'react'
import * as vietmapgl from '@vietmap/vietmap-gl-js/dist/vietmap-gl.js'
import '@vietmap/vietmap-gl-js/dist/vietmap-gl.css'
import { Alert } from '@ds/components/feedback/Alert'
import { VIETMAP_STYLE_URL } from '../utils/vietmapStyle.ts'

// So ms cho map bao "load" (tai xong style + tile trong khung nhin ban dau) truoc khi coi la
// khong kha dung - dung 1 nguong thoi gian duy nhat thay vi bat rieng tung loai loi (CORS,
// 401 key sai, mat mang...) vi tat ca deu dan den cung 1 trieu chung: map khong bao gio "load"
// duoc. Khong dung su kien 'error' rieng le - 1-2 tile o ria khung nhin loi la binh thuong
// (vd ngoai vung phu du lieu), khong nen bao "khong kha dung" chi vi vai tile le.
const MAP_LOAD_TIMEOUT_MS = 4000

// Ghim ve bang DOM element noi tuyen (vietmapgl.Marker({ element })), KHONG dung icon dong
// goi san - cung ly do da chot khi con dung Leaflet (tranh anh marker rieng bi "vo" do
// bundler/cache). Mau lay tu bien CSS cua DS (--teal-600/--paper-0) qua thuoc tinh style.
const PIN_SVG = `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
  <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.716 23.284 0 15 0z" style="fill: var(--teal-600)" />
  <circle cx="15" cy="15" r="5.5" style="fill: var(--paper-0)" />
</svg>`

function createPinElement(): HTMLDivElement {
  const el = document.createElement('div')
  el.innerHTML = PIN_SVG
  el.style.cursor = 'grab'
  return el
}

interface LocationPickerMapProps {
  lat: number | null
  lng: number | null
  onPick: (lat: number, lng: number) => void
  /** Tang gia tri nay de buoc ghim tro ve dung lat/lng hien tai (hoac DEFAULT_CENTER neu
   *  chua co) - dung khi ProfilePage tu choi 1 lan chon (vd ngoai Viet Nam) nen KHONG doi
   *  lat/lng, effect dong bo thuong (deps [lat, lng]) se khong tu chay lai vi gia tri khong
   *  doi, phai co tin hieu rieng de ep chay lai. */
  resetSignal?: number
}

// Trung tam mac dinh khi chua co toa do nao - TP. Ho Chi Minh. vietmapgl (nhu moi thu vien
// goc MapLibre/Mapbox) dung thu tu [lng, lat], NGUOC voi Leaflet [lat, lng] truoc day.
const DEFAULT_CENTER: [number, number] = [106.7009, 10.7769]
const DEFAULT_ZOOM = 13
const PICKED_ZOOM = 16

/**
 * Ban do chon vi tri - bam vao ban do hoac keo ghim de chon toa do, dung VietMap (vietmap-gl-js,
 * fork MapLibre GL JS) + style/tile chinh thuc cua VietMap (VITE_VIETMAP_TILEMAP_KEY). Thay
 * the Leaflet + tile Esri truoc day theo yeu cau nguoi dung (chuyen toan bo xu ly ban do sang
 * VietMap). Component dung chung, khong thuoc @ds vi DS chua co component ban do nao. Chi tu
 * khoi tao map 1 lan (effect rong deps) roi dieu khien qua imperative API cua vietmapgl o
 * effect thu hai - thu vien tu quan ly DOM cua no, khong hop voi kieu re-render khai bao cua
 * React neu tao lai map moi lan props doi.
 */
export function LocationPickerMap({ lat, lng, onPick, resetSignal }: LocationPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<InstanceType<typeof vietmapgl.Map> | null>(null)
  const markerRef = useRef<InstanceType<typeof vietmapgl.Marker> | null>(null)
  const onPickRef = useRef(onPick)
  // true khi VietMap khong "load" duoc trong MAP_LOAD_TIMEOUT_MS (het quota/sap he thong/key
  // tilemap sai...) - hien thong bao thay ban do trang khong ro nguyen nhan, huong nguoi dung
  // sang o "Địa chỉ" (AddressAutocomplete van chay binh thuong, khong phu thuoc tile ban do).
  const [mapUnavailable, setMapUnavailable] = useState(false)
  // Cap nhat ref trong effect (khong phai giua luc render) de tranh side-effect luc render -
  // callback "moi nhat" van luon dung du map chi khoi tao 1 lan duy nhat o effect ben duoi.
  useEffect(() => {
    onPickRef.current = onPick
  })

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const initialCenter: [number, number] = lat != null && lng != null ? [lng, lat] : DEFAULT_CENTER
    const map = new vietmapgl.Map({
      container: containerRef.current,
      style: VIETMAP_STYLE_URL,
      center: initialCenter,
      zoom: lat != null && lng != null ? PICKED_ZOOM : DEFAULT_ZOOM,
    })
    map.addControl(new vietmapgl.NavigationControl(), 'top-right')

    let loaded = false
    let hadTileError = false
    map.once('load', () => { loaded = true })
    // style.json (khung ban do) co the tai duoc binh thuong (nen 'load' van bat ra) trong khi
    // TUNG tile anh/vector bi tu choi rieng (key tilemap sai, quota het...) - da gap thuc te:
    // 'load' bat ra du toan bo tile deu loi CORS, vi MapLibre coi tile loi la "da xong" (khong
    // con cho), khong phai "thanh cong". Phai bat rieng 'error' lam tin hieu, khong chi dua vao
    // 'load' - 1 vai tile o ria khung nhin loi la binh thuong (ngoai vung phu du lieu), nhung
    // GHI NHAN loi va chi ket luan "khong kha dung" khi het thoi gian cho ma van co loi xay ra.
    map.on('error', () => { hadTileError = true })
    const unavailableTimer = setTimeout(() => {
      if (!loaded || hadTileError) setMapUnavailable(true)
    }, MAP_LOAD_TIMEOUT_MS)

    const marker = new vietmapgl.Marker({ element: createPinElement(), draggable: true, anchor: 'bottom' })
      .setLngLat(initialCenter)
      .addTo(map)
    marker.on('dragend', () => {
      const { lat: draggedLat, lng: draggedLng } = marker.getLngLat()
      onPickRef.current(draggedLat, draggedLng)
    })
    map.on('click', (event: { lngLat: { lat: number; lng: number } }) => {
      marker.setLngLat(event.lngLat)
      onPickRef.current(event.lngLat.lat, event.lngLat.lng)
    })

    mapRef.current = map
    markerRef.current = marker

    return () => {
      clearTimeout(unavailableTimer)
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // Chi khoi tao map 1 lan luc mount - lat/lng thay doi sau do duoc dong bo o effect rieng
    // ben duoi (setLngLat/jumpTo), khong tao lai map moi lan toa do doi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dong bo ghim/khung nhin khi lat/lng doi tu ben ngoai (vd nut "Dung vi tri hien tai"), va
  // KHI resetSignal doi (ProfilePage tu choi 1 lan chon, vd ngoai Viet Nam - ghim da bi
  // map.on('click')/marker.on('dragend') o effect tren di chuyen truoc khi biet bi tu choi,
  // phai chu dong keo lai). resetSignal trong deps de effect chay lai ke ca khi lat/lng
  // khong doi gia tri (tu choi nghia la KHONG cap nhat lat/lng, nen effect thuong se khong
  // tu chay). Chua co lat/lng hop le nao (lan dau tu choi) thi ve DEFAULT_CENTER.
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return
    const target: [number, number] = lat != null && lng != null ? [lng, lat] : DEFAULT_CENTER
    markerRef.current.setLngLat(target)
    mapRef.current.jumpTo({ center: target, zoom: lat != null && lng != null ? Math.max(mapRef.current.getZoom(), PICKED_ZOOM) : DEFAULT_ZOOM })
  }, [lat, lng, resetSignal])

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={containerRef}
        style={{ height: 380, width: '100%', borderRadius: 'var(--r-lg)', overflow: 'hidden', border: 'var(--bw) solid var(--border)' }}
      />
      {mapUnavailable && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-4)' }}>
          <Alert tone="warning" title="Bản đồ hiện không khả dụng">
            Vui lòng nhập địa chỉ ở ô "Địa chỉ" bên trên.
          </Alert>
        </div>
      )}
    </div>
  )
}
