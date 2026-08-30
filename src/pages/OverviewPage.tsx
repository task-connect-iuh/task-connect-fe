import { Alert } from '@ds/components/feedback/Alert'
import { EmptyState } from '@ds/components/feedback/EmptyState'
import { Avatar } from '@ds/components/core/Avatar'
import { Badge } from '@ds/components/core/Badge'
import { Button } from '@ds/components/core/Button'
import { Card } from '@ds/components/core/Card'
import { Icon } from '@ds/components/core/Icon'
import { DataRow } from '@ds/components/marketplace/DataRow'
import { LifecycleTracker } from '@ds/components/marketplace/LifecycleTracker'
import { MoneyAmount } from '@ds/components/marketplace/MoneyAmount'
import { StatusPill } from '@ds/components/marketplace/StatusPill'
import { TaskCard } from '@ds/components/marketplace/TaskCard'
import { TrustScore } from '@ds/components/marketplace/TrustScore'
import { AppShell } from '../components/AppShell.tsx'
import { useAuthStore } from '../stores/useAuthStore.ts'

// Du lieu minh hoa - module Task/Booking/Payment chua ton tai o backend (xem
// 00-architecture.md, chi co Auth). Bo cuc bam sat @ds/ui_kits/poster/OverviewScreen.jsx,
// se thay bang du lieu that khi cac module do duoc hien thuc. Khong goi API nao o day.
const NOTIFICATIONS = [
  { text: 'Tasker báo hoàn tất công việc', time: '16:02 · hôm nay', icon: 'badge-check', tone: 'money' as const },
  { text: '3 Tasker đã ứng tuyển', time: '10:13 · hôm nay', icon: 'users', tone: 'brand' as const },
  { text: 'Đã tạm giữ 450.000 ₫', time: '10:20 · hôm nay', icon: 'lock', tone: 'money' as const },
]

function PosterOverview() {
  return (
    <div className="grid gap-6 items-start" style={{ gridTemplateColumns: '1.55fr 1fr' }}>
      <div className="flex flex-col gap-5">
        <Card tone="money" padding="var(--sp-5)">
          <div className="flex items-center gap-5 flex-wrap">
            <MoneyAmount value={1430000} size="lg" tone="money" label="Tiền của bạn đang được tạm giữ" />
            <StatusPill status="HELD" />
            <div style={{ flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 240, borderLeft: 'var(--bw) solid var(--amber-200)', paddingLeft: 'var(--sp-5)' }}>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)', lineHeight: 1.55 }}>
                3 việc đang giữ tiền, mỗi việc một khoản riêng. Chỉ giải ngân khi bạn nghiệm thu từng việc. Phí nền tảng 8% trừ một lần khi giải ngân.
              </p>
            </div>
          </div>
        </Card>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 style={{ fontSize: 'var(--fs-h3)' }}>Việc cần bạn xử lý sớm nhất</h2>
            <Button variant="ghost" size="sm" iconAfter="arrow-right" disabled>Xem cả 5 việc đang chạy</Button>
          </div>
          <Card padding="var(--sp-5)">
            <div className="flex flex-col gap-4">
              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <Badge tone="brand">Sửa chữa</Badge>
                  <h3 style={{ marginTop: 8 }}>Sửa vòi nước bị rỉ ở bếp</h3>
                  <div className="flex gap-4 flex-wrap mt-1.5" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>
                    <span className="inline-flex items-center gap-1"><Icon name="map-pin" size={15} />128 Võ Văn Tần, Q.3</span>
                    <span className="inline-flex items-center gap-1"><Icon name="clock" size={15} />Thứ 5, 14:00</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>BK-2026-0AF31</span>
                  </div>
                </div>
                <MoneyAmount value={450000} size="md" style={{ alignItems: 'flex-end' }} />
              </div>
              <LifecycleTracker current={4} />
              <div className="flex items-center gap-3 pt-3" style={{ borderTop: 'var(--bw-hair) solid var(--border-subtle)' }}>
                <Avatar name="Trần Minh Quân" size={40} verified />
                <div className="flex-1">
                  <strong style={{ fontSize: 'var(--fs-body)' }}>Trần Minh Quân</strong>
                  <div><TrustScore score={4.8} reviews={126} /></div>
                </div>
                <Button variant="secondary" size="sm" icon="message-square" disabled>Nhắn tin</Button>
                <Button variant="money" size="sm" icon="hand-coins" disabled>Nghiệm thu &amp; giải ngân</Button>
              </div>
            </div>
          </Card>
        </div>

        <div>
          <h2 className="mb-3" style={{ fontSize: 'var(--fs-h3)' }}>Việc đã hoàn tất</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TaskCard title="Dọn nhà 3 phòng sau chuyển đến" category="Giúp việc theo giờ" budget={600000} when="02/08 · 08:00" status="RELEASED" />
            <TaskCard title="Bốc xếp chuyển nhà (2 người)" category="Chuyển nhà" budget={900000} when="28/07 · 07:00" status="REFUNDED" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <Card padding="var(--sp-5)">
          <div className="flex flex-col gap-3">
            <h3>Đăng việc mới</h3>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', lineHeight: 1.55 }}>
              Viết mô tả bằng lời của bạn. Không cần chọn danh mục trước — AI gợi ý, bạn sửa được.
            </p>
            <Button block icon="file-plus-2" disabled>Bắt đầu đăng việc</Button>
          </div>
        </Card>

        <Card padding="var(--sp-5)">
          <div className="tc-label mb-2">Tổng kết của bạn</div>
          <DataRow label="Việc đã đăng" value="14" numeric />
          <DataRow label="Đang giữ tiền" value="450.000 ₫" numeric />
          <DataRow label="Đã giải ngân (2026)" value="7.840.000 ₫" numeric />
          <DataRow label="Phí nền tảng đã trả" value="627.200 ₫" numeric />
          <DataRow label="Điểm uy tín của bạn" value={<TrustScore score={4.9} reviews={12} />} strong />
        </Card>

        <Card padding="var(--sp-5)">
          <div className="tc-label mb-3">Thông báo</div>
          {NOTIFICATIONS.map((item) => (
            <div key={item.text} className="flex gap-3 items-start py-3" style={{ borderBottom: 'var(--bw-hair) solid var(--border-subtle)' }}>
              <span
                className="flex items-center justify-center flex-none"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--r-sm)',
                  background: item.tone === 'money' ? 'var(--money-tint)' : 'var(--brand-tint)',
                  color: item.tone === 'money' ? 'var(--amber-700)' : 'var(--teal-700)',
                }}
              >
                <Icon name={item.icon} size={16} />
              </span>
              <div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' }}>{item.text}</div>
                <div className="tc-num" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{item.time}</div>
              </div>
            </div>
          ))}
        </Card>

        <Alert tone="info" title="Đang chạy nhiều việc cùng lúc">
          Trang này chỉ hiện việc gần nhất. Mở <strong>Việc của tôi</strong> để xem lịch cả tuần và toàn bộ số dư đang giữ.
        </Alert>

        <EmptyState icon="bell-off" title="Không có khiếu nại nào">
          Nếu có vấn đề với một việc, bạn mở khiếu nại từ trang việc đó và tiền vẫn được giữ.
        </EmptyState>
      </div>
    </div>
  )
}

function RoleNotReadyOverview() {
  return (
    <EmptyState icon="hammer" title="Tổng quan cho vai trò này đang được xây dựng">
      Màn hình Tổng quan cho Tasker sẽ có ở bản sau. Chuyển lại vai trò Đăng việc ở thanh trên để xem trước.
    </EmptyState>
  )
}

/**
 * Man Tong quan sau dang nhap - man tham chieu chuan nhat cua vai tro Poster theo
 * @ds/ui_kits/poster/OverviewScreen.jsx. Vai tro Tasker chua duoc dung (xem
 * docs/PROGRESS-FE.md "Buoc tiep theo").
 */
export function OverviewPage() {
  const activeRole = useAuthStore((state) => state.activeRole)

  return (
    <AppShell navValue="overview" title="Chào bạn, đây là tình hình việc của bạn" subtitle="Cập nhật theo thời gian thực">
      {activeRole === 'poster' ? <PosterOverview /> : <RoleNotReadyOverview />}
    </AppShell>
  )
}
