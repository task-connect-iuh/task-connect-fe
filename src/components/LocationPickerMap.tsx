import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Ghim ve bang SVG noi tuyen (L.divIcon), KHONG dung 3 file anh marker-icon(.png/2x)/shadow
// dong goi san cua Leaflet - anh do tung hien "vo" (khong ro nguyen nhan: co the do bundler,
// cache, hay tien trinh Vite cu con song lai chiem cong nhu da gap o phien truoc). SVG noi
// tuyen loai bo hoan toan buoc tai anh rieng, khong con phu thuoc nao co the "vo". Mau lay
// tu bien CSS cua DS (--teal-600/--paper-0) qua thuoc tinh style (fill attribute thuong
// KHONG doc duoc var(), phai dung style de trinh duyet resolve dung).
const PIN_ICON = L.divIcon({
  className: 'tc-map-pin',
  html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.716 23.284 0 15 0z" style="fill: var(--teal-600)" />
    <circle cx="15" cy="15" r="5.5" style="fill: var(--paper-0)" />
  </svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
})

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

// Trung tam mac dinh khi chua co toa do nao - TP. Ho Chi Minh, chi la diem bat dau de nguoi
// dung tu bam chon, khong anh huong du lieu luu.
const DEFAULT_CENTER: [number, number] = [10.7769, 106.7009]
const DEFAULT_ZOOM = 13
const PICKED_ZOOM = 16

/**
 * Ban do chon vi tri - bam vao ban do hoac keo ghim de chon toa do, dung Leaflet + tile Esri
 * World Street Map (mien phi, khong can dang ky/API key - da tai thu va xem bang mat tung
 * tile, ra dung ten duong tieng Viet, khong watermark). Phuong an ban do da hoi va duoc duyet
 * (xem docs/PROGRESS-FE-USER-MODULE.md) nhung da doi provider tile 2 lan: ban dau
 * tile.openstreetmap.org bi mang chan hoan toan, sau do CARTO tra ve tile watermark "API KEY
 * REQUIRED" (CARTO da doi chinh sach, khong con mien phi khong-dang-ky nhu luc kiem tra dau).
 * Component dung chung, khong thuoc @ds vi DS chua co component ban do nao. Chi tu khoi tao
 * map 1 lan (effect rong deps) roi dieu khien qua imperative API cua Leaflet o effect thu hai
 * - Leaflet tu quan ly DOM cua no, khong hop voi kieu re-render khai bao cua React neu tao
 * lai map moi lan props doi.
 */
export function LocationPickerMap({ lat, lng, onPick, resetSignal }: LocationPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onPickRef = useRef(onPick)
  // Cap nhat ref trong effect (khong phai giua luc render) de tranh side-effect luc render -
  // callback "moi nhat" van luon dung du map chi khoi tao 1 lan duy nhat o effect ben duoi.
  useEffect(() => {
    onPickRef.current = onPick
  })

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const initialCenter: [number, number] = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER
    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: lat != null && lng != null ? PICKED_ZOOM : DEFAULT_ZOOM,
    })
    // Esri World Street Map - CHU Y thu tu tham so la {z}/{y}/{x}, khac chuan {z}/{x}/{y} cua
    // hau het tile server khac (OSM, CARTO...). Da xac nhan tile that bang curl + xem anh,
    // khong watermark, khong can key. Xem docs/PROGRESS-FE-USER-MODULE.md.
    L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noreferrer">Esri</a> — Esri, HERE, Garmin, USGS, EPA, NPS, USDA',
      maxZoom: 19,
    }).addTo(map)

    const marker = L.marker(initialCenter, { draggable: true, icon: PIN_ICON }).addTo(map)
    marker.on('dragend', () => {
      const position = marker.getLatLng()
      onPickRef.current(position.lat, position.lng)
    })
    map.on('click', (event) => {
      marker.setLatLng(event.latlng)
      onPickRef.current(event.latlng.lat, event.latlng.lng)
    })

    mapRef.current = map
    markerRef.current = marker

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // Chi khoi tao map 1 lan luc mount - lat/lng thay doi sau do duoc dong bo o effect rieng
    // ben duoi (setView/setLatLng), khong tao lai map moi lan toa do doi.
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
    const target: [number, number] = lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER
    markerRef.current.setLatLng(target)
    mapRef.current.setView(target, lat != null && lng != null ? Math.max(mapRef.current.getZoom(), PICKED_ZOOM) : DEFAULT_ZOOM)
  }, [lat, lng, resetSignal])

  return (
    <div
      ref={containerRef}
      style={{ height: 380, width: '100%', borderRadius: 'var(--r-lg)', overflow: 'hidden', border: 'var(--bw) solid var(--border)' }}
    />
  )
}
