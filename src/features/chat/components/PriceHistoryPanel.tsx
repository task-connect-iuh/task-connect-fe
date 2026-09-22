import { useEffect, useState } from 'react'
import { Alert } from '@ds/components/feedback/Alert'
import { Badge } from '@ds/components/core/Badge'
import { Card } from '@ds/components/core/Card'
import { EmptyState } from '@ds/components/feedback/EmptyState'
import { ApiError } from '../../../api/client.ts'
import { getPriceHistory } from '../../../api/tasks.ts'
import type { TaskPriceHistoryEntryResponse } from '../../../api/tasks.ts'
import { formatChatTime, formatVnd } from '../chatFormat.ts'

interface PriceHistoryPanelProps {
  applicationId: string
}

/**
 * Lich su gia day du (chi ghi them) cua 1 application - dung ca o man "Ung vien & chot gia"
 * (Poster) lan khung chat/chi tiet don (Tasker), dung GET /tasks/applications/{id}/price-history.
 * Sua 2026-09-21: truoc day chi suy "Da dong y"/"Chua duoc dong y" tu acceptedAt, khien 1 de xuat
 * DA BI TU CHOI (vd 123.000d) hien giong het 1 de xuat con THAT SU dang cho quyet dinh (vd
 * 150.000d) - gay hieu lam trung lap. Gio doc them field status (ProposalStatus tu
 * chat_messages.proposal_status, xem BE ChatFacade.findProposalStatusesByPriceHistoryIds) de
 * hien dung 3 trang thai: PROPOSED = con cho, ACCEPTED = da dong y, REJECTED = da bi Tu choi
 * HOAC chinh nguoi de xuat Thu hoi (backend dung chung 1 gia tri cho ca 2, khong tach duoc -
 * dat ten nhan chung "Đã từ chối" theo dung yeu cau nguoi dung, khac nhan "Khong con hieu luc"
 * cua ProposalStatusBadge.tsx dung trong khung chat truc tiep).
 */
export function PriceHistoryPanel({ applicationId }: PriceHistoryPanelProps) {
  const [entries, setEntries] = useState<TaskPriceHistoryEntryResponse[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setEntries(null)
    setError('')
    getPriceHistory(applicationId)
      .then(setEntries)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Không tải được lịch sử giá.'))
  }, [applicationId])

  if (error) return <Alert tone="danger" title="Không tải được dữ liệu">{error}</Alert>
  if (entries == null) return <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--text-muted)' }}>Đang tải…</p>
  if (entries.length === 0) {
    return <EmptyState icon="history" title="Chưa có lần đổi giá nào">Số tiền chỉ ghi vào đây khi có một đề xuất giá được gửi trong hội thoại.</EmptyState>
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry) => (
        <Card key={entry.id} padding="var(--sp-4)">
          <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 'var(--sp-2)' }}>
            <Badge tone="neutral">{entry.changeType === 'INITIAL_AGREEMENT' ? 'Thoả thuận ban đầu' : 'Phát sinh giữa chừng'}</Badge>
            {entry.status === 'ACCEPTED'
              ? <Badge tone="success" icon="check">Đã đồng ý</Badge>
              : entry.status === 'REJECTED'
                ? <Badge tone="danger" icon="x">Đã từ chối</Badge>
                : <Badge tone="neutral" icon="clock">Chưa được đồng ý</Badge>}
          </div>
          <span className="tc-num" style={{ fontSize: 'var(--fs-amount-sm)', fontWeight: 'var(--fw-black)' }}>
            {formatVnd(entry.amount)}
          </span>
          {entry.note && <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)', marginTop: 4, lineHeight: 1.55 }}>{entry.note}</p>}
          <p className="tc-num" style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 'var(--sp-2)' }}>
            {entry.createdByName ?? 'Người dùng'} đề xuất {formatChatTime(entry.createdAt)}
            {entry.acceptedAt && ` · ${entry.acceptedByName ?? 'Đối phương'} đồng ý ${formatChatTime(entry.acceptedAt)}`}
          </p>
        </Card>
      ))}
    </div>
  )
}
