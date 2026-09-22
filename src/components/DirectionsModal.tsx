import { useEffect, useRef, useState } from 'react'
import * as vietmapgl from '@vietmap/vietmap-gl-js/dist/vietmap-gl.js'
import '@vietmap/vietmap-gl-js/dist/vietmap-gl.css'
import { Alert } from '@ds/components/feedback/Alert'
import { Button } from '@ds/components/core/Button'
import { Dialog } from '@ds/components/feedback/Dialog'
import { Tabs } from '@ds/components/navigation/Tabs'
import { DialogViewport } from './DialogViewport.tsx'
import { getRouteApi } from '../api/map.ts'
import type { RouteResultApi, VietMapVehicle } from '../api/map.ts'
import { ApiError } from '../api/client.ts'
import { VIETMAP_STYLE_URL } from '../utils/vietmapStyle.ts'
import { useLockBodyScroll } from '../utils/useLockBodyScroll.ts'

// Cham xanh dac trung "vi tri cua toi" (khac ghim teal cua diem den, dung chung SVG voi
// LocationPickerMap.tsx) - kich thuoc/mau deu lay tu token DS (--sp-4, --bw, --info...) qua var().
const ORIGIN_DOT_SVG = `<div style="width:var(--sp-4);height:var(--sp-4);border-radius:50%;background:var(--info);border:var(--bw) solid var(--paper-0);box-shadow:0 0 0 var(--bw-hair) var(--border)"></div>`

/**
 * MapLibre paint spec (line-color) khong doc duoc CSS custom property truc tiep - phai resolve
 * gia tri thuc te bang getComputedStyle luc ve, thay vi hardcode hex trong code (vi pham
 * 20-design-system.md "Cam hardcode mau hex"). Fallback dung tu khoa mau CSS pho thong
 * ("teal"), KHONG phai hex trung lap gia tri token - chi de phong ngua truong hop bien chua
 * kip apply (SSR/test), khong dung de ghi de token.
 */
function resolveColorToken(token: string): string {
  if (typeof window === 'undefined') return 'teal'
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  return value || 'teal'
}
const DEST_PIN_SVG = `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
  <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.716 23.284 0 15 0z" style="fill: var(--teal-600)" />
  <circle cx="15" cy="15" r="5.5" style="fill: var(--paper-0)" />
</svg>`

function createMarkerElement(svg: string): HTMLDivElement {
  const el = document.createElement('div')
  el.innerHTML = svg
  return el
}

interface DirectionsModalProps {
  destination: { lat: number; lng: number; addressText: string }
  onClose: () => void
}

// Ma loi tra ve khi VietMap Route API khong kha dung sau khi backend da tu retry (het quota/
// sap he thong, xem MapService.route() Javadoc) - KHONG co provider dinh tuyen mien phi nao
// thay the dang tin cay, nen phuong an du phong la mo thang Google Maps ngoai (hanh vi cu
// truoc khi doi sang VietMap), thay vi chi hien loi bat luc.
const ROUTE_PROVIDER_DOWN_CODE = 'MAP-502-PROVIDER_ERROR'

/** Mo Google Maps o tab moi voi chi duong tu origin (neu co) den destination. */
function openGoogleMapsFallback(origin: { lat: number; lng: number } | null, destination: { lat: number; lng: number; addressText: string }) {
  const destinationParam = destination.addressText || `${destination.lat},${destination.lng}`
  const params = new URLSearchParams({ api: '1', destination: destinationParam })
  if (origin) params.set('origin', `${origin.lat},${origin.lng}`)
  window.open(`https://www.google.com/maps/dir/?${params.toString()}`, '_blank', 'noopener,noreferrer')
}

// Cung nguong/ly do voi LocationPickerMap.tsx - xem comment o do. Rieng o day, khoang cach/
// thoi gian van chinh xac du ban do trang, vi 2 thu lay tu Route API (khac tile hien thi).
const MAP_LOAD_TIMEOUT_MS = 4000

/** "5,2 km" - lam tron 1 chu so thap phan, dung dau phay theo dinh dang so Viet Nam. */
function formatDistance(meters: number): string {
  return `${(meters / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`
}

/** "23 phút" - lam tron len phut gan nhat, khong hien giay (khong co y nghia voi nguoi dung). */
function formatDuration(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} phút`
}

/**
 * Chi duong tu vi tri hien tai (trinh duyet, navigator.geolocation) den 1 diem (thuong la dia
 * chi cong viec) - dung VietMap Route API (qua backend, xem api/map.ts) de ve tuyen duong
 * thuc te tren ban do, thay cho hanh vi cu la mo Google Maps o tab moi (TaskerJobsPage.tsx).
 * Mac dinh xe may (phuong tien pho bien nhat cua Tasker tai Viet Nam), co the doi sang o to.
 */
export function DirectionsModal({ destination, onClose }: DirectionsModalProps) {
  useLockBodyScroll(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<InstanceType<typeof vietmapgl.Map> | null>(null)
  const [vehicle, setVehicle] = useState<VietMapVehicle>('motorcycle')
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null)
  const [route, setRoute] = useState<RouteResultApi | null>(null)
  const [error, setError] = useState('')
  // true khi loi la do VietMap Route API khong kha dung (khac loi khong xin duoc vi tri, vd
  // nguoi dung tu choi quyen) - chi truong hop nay moi hien nut mo Google Maps thay the.
  const [routeProviderDown, setRouteProviderDown] = useState(false)
  const [loading, setLoading] = useState(true)
  // true khi VietMap khong "load" duoc trong MAP_LOAD_TIMEOUT_MS - khoang cach/thoi gian phia
  // tren van dung (goi rieng qua Route API), chi phan hien thi truc quan bi anh huong.
  const [mapUnavailable, setMapUnavailable] = useState(false)

  // Xin vi tri hien tai 1 lan luc mo dialog - khong tu dong xin lai neu nguoi dung tu choi,
  // ho phai dong dialog va bam lai nut "Chỉ đường" (giu quyen kiem soat cho nguoi dung).
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Trình duyệt này không hỗ trợ lấy vị trí hiện tại.')
      setLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setOrigin({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => {
        setError('Không lấy được vị trí hiện tại. Hãy cho phép trình duyệt truy cập vị trí rồi thử lại.')
        setLoading(false)
      },
    )
  }, [])

  // Goi VietMap Route API moi khi co vi tri goc hoac doi phuong tien.
  useEffect(() => {
    if (!origin) return
    setLoading(true)
    setError('')
    setRouteProviderDown(false)
    getRouteApi(origin.lat, origin.lng, destination.lat, destination.lng, vehicle)
      .then(setRoute)
      .catch((err) => {
        if (err instanceof ApiError && err.code === ROUTE_PROVIDER_DOWN_CODE) {
          setRouteProviderDown(true)
          setError('Dịch vụ chỉ đường đang tạm gián đoạn.')
          return
        }
        setError(err instanceof ApiError ? err.message : 'Không tìm được tuyến đường, thử lại sau.')
      })
      .finally(() => setLoading(false))
  }, [origin, vehicle, destination.lat, destination.lng])

  // Khoi tao map 1 lan, ve lai tuyen duong (source/layer + marker + fitBounds) moi khi co
  // route moi - khac LocationPickerMap.tsx (chi co 1 ghim tinh), o day toan bo lop du lieu
  // doi theo route nen don gian hon khi go+ve lai thay vi cap nhat tung phan.
  useEffect(() => {
    if (!containerRef.current) return
    const map = new vietmapgl.Map({
      container: containerRef.current,
      style: VIETMAP_STYLE_URL,
      center: [destination.lng, destination.lat],
      zoom: 13,
    })
    mapRef.current = map

    let loaded = false
    let hadTileError = false
    map.once('load', () => { loaded = true })
    // Xem comment tuong ung trong LocationPickerMap.tsx - style.json co the tai duoc (bat
    // 'load') du tung tile bi tu choi rieng (key sai/quota het), phai bat them 'error' lam
    // tin hieu, khong chi dua vao 'load'.
    map.on('error', () => { hadTileError = true })
    const unavailableTimer = setTimeout(() => {
      if (!loaded || hadTileError) setMapUnavailable(true)
    }, MAP_LOAD_TIMEOUT_MS)

    return () => {
      clearTimeout(unavailableTimer)
      map.remove()
      mapRef.current = null
    }
  }, [destination.lat, destination.lng])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !route || route.path.length === 0) return

    const drawRoute = () => {
      const coordinates = route.path.map((p) => [p.lng, p.lat])
      const geojson = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates } }
      const existingSource = map.getSource('route') as { setData: (data: unknown) => void } | undefined
      if (existingSource) {
        existingSource.setData(geojson)
      } else {
        map.addSource('route', { type: 'geojson', data: geojson })
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': resolveColorToken('--teal-500'), 'line-width': 5 },
        })
      }

      new vietmapgl.Marker({ element: createMarkerElement(ORIGIN_DOT_SVG), anchor: 'center' })
        .setLngLat(coordinates[0] as [number, number])
        .addTo(map)
      new vietmapgl.Marker({ element: createMarkerElement(DEST_PIN_SVG), anchor: 'bottom' })
        .setLngLat(coordinates[coordinates.length - 1] as [number, number])
        .addTo(map)

      const bounds = coordinates.reduce(
        (b: InstanceType<typeof vietmapgl.LngLatBounds>, c) => b.extend(c as [number, number]),
        new vietmapgl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number]),
      )
      map.fitBounds(bounds, { padding: 48, maxZoom: 16 })
    }

    if (map.isStyleLoaded()) drawRoute()
    else map.once('load', drawRoute)
  }, [route])

  return (
    <DialogViewport>
      <Dialog
        title="Chỉ đường"
        subtitle={destination.addressText}
        onClose={onClose}
        style={{ maxWidth: 640 }}
        footer={<Button variant="secondary" onClick={onClose}>Đóng</Button>}
      >
        <div className="flex flex-col gap-3">
          <Tabs
            value={vehicle}
            onChange={(v) => setVehicle(v as VietMapVehicle)}
            tabs={[
              { value: 'motorcycle', label: 'Xe máy' },
              { value: 'car', label: 'Ô tô' },
            ]}
          />
          {error && (
            <Alert tone="danger" title="Không tính được đường đi">
              <div className="flex flex-col gap-2">
                <span>{error}</span>
                {routeProviderDown && (
                  <Button size="sm" icon="external-link" onClick={() => openGoogleMapsFallback(origin, destination)}>
                    Mở Google Maps
                  </Button>
                )}
              </div>
            </Alert>
          )}
          {loading && !error && (
            <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Đang tìm đường…</p>
          )}
          {route && !loading && (
            <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-body)' }}>
              Khoảng cách <strong>{formatDistance(route.distanceMeters)}</strong> — dự kiến{' '}
              <strong>{formatDuration(route.durationSeconds)}</strong>
            </p>
          )}
          <div style={{ position: 'relative' }}>
            <div
              ref={containerRef}
              style={{ height: 360, width: '100%', borderRadius: 'var(--r-lg)', overflow: 'hidden', border: 'var(--bw) solid var(--border)' }}
            />
            {mapUnavailable && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-4)' }}>
                <Alert tone="warning" title="Bản đồ hiện không khả dụng">
                  Khoảng cách và thời gian phía trên vẫn chính xác, chỉ phần bản đồ trực quan tạm gián đoạn.
                </Alert>
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </DialogViewport>
  )
}
