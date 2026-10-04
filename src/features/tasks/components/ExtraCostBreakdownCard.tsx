import { Badge } from '@ds/components/core/Badge'
import { Button } from '@ds/components/core/Button'
import { DataRow } from '@ds/components/marketplace/DataRow'
import { MoneyAmount } from '@ds/components/marketplace/MoneyAmount'
import type { ExtraCostMoneySummaryResponse } from '../../../api/tasks.ts'
import { formatVnd } from '../../chat/chatFormat.ts'

interface ExtraCostBreakdownCardProps {
  summary: ExtraCostMoneySummaryResponse
  // 'POSTER' thay vi dua vao ca ChatInboxItemResponse.viewerRole (InboxPage) lan goc nhin co dinh
  // cua Poster (MyTasksPage) - chi can biet dung goc nhin nao de quyet dinh hien nut Dong y/Tu
  // choi (Poster) hay Thu hoi (Tasker).
  viewerRole: 'POSTER' | 'TASKER'
  topUpBusy: boolean
  actionBusyBatchId: string | null
  // false o InboxPage: khung chat da co rieng dong "Giá đã chốt"/"Chi phí chốt ban đầu" ngay
  // phia tren the nay roi (xem InboxPage.tsx), hien lai o day la trung lap thua (nguoi dung
  // bao cao 2026-10-03). MyTasksPage khong co dong tuong duong nao khac nen van can gia tri
  // mac dinh true o do.
  showFeeBaseRow?: boolean
  // Co khi goi tu TaskDetailDialog (MyTasksPage.tsx, ngoai ngu canh chat): thay vi lap lai
  // Dong y/Tu choi/Thu hoi ngay trong dialog tinh, chi hien 1 nut dieu huong sang /tin-nhan de
  // thao tac dung cho trong hoi thoai co anh/ghi chu di kem (nguoi dung bao cao 2026-10-03).
  // Khong truyen (InboxPage.tsx, da la chinh man chat) thi giu nguyen hanh vi Dong y/Tu choi/
  // Thu hoi day du nhu truoc.
  onViewPendingInChat?: () => void
  onTopUp: () => void
  onApprove: (batchId: string) => void
  onReject: (batchId: string) => void
  onWithdraw: (batchId: string) => void
}

/**
 * Phan "Chi phí chốt ban đầu + phát sinh đã đồng ý + tổng phải trả + cần nạp thêm + batch đang
 * chờ duyệt" cua 1 ExtraCostMoneySummaryResponse (quyet dinh nguoi dung 2026-10-02) - dung chung
 * giua InboxPage.tsx (khung chat) va MyTasksPage.tsx (TaskDetailDialog) de khong lap code 2 noi.
 * CHI co y nghia khi paymentMethod = FULL_ESCROW - caller tu quyet dinh co render component nay
 * hay khong (xem Javadoc BE ExtraCostMoneySummaryResponse).
 */
export function ExtraCostBreakdownCard({
  summary, viewerRole, topUpBusy, actionBusyBatchId, showFeeBaseRow = true, onViewPendingInChat,
  onTopUp, onApprove, onReject, onWithdraw,
}: ExtraCostBreakdownCardProps) {
  const pendingBatch = summary.pendingBatch
  const approvedItems = summary.approvedBatches.flatMap((batch) => batch.items)

  return (
    <div style={{ marginTop: 'var(--sp-4)' }}>
      {showFeeBaseRow && (
        <DataRow label="Chi phí chốt ban đầu · đã tạm giữ" value={formatVnd(summary.feeBaseAmount)} numeric strong />
      )}
      <div style={{ marginTop: 'var(--sp-3)' }}>
        <span className="tc-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>
          {approvedItems.length > 0 ? `Phát sinh đã đồng ý · ${approvedItems.length} khoản` : 'Chi phí phát sinh'}
        </span>
        {approvedItems.length > 0 ? (
          approvedItems.map((item) => (
            <DataRow key={item.id} label={item.name} value={`+${formatVnd(item.amount)}`} numeric />
          ))
        ) : (
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', margin: 0 }}>Không có</p>
        )}
      </div>
      <div style={{ marginTop: 'var(--sp-3)', paddingTop: 'var(--sp-3)', borderTop: 'var(--bw-hair) solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-4)', padding: 'var(--sp-3) 0' }}>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--amber-700)' }}>Tổng Poster phải trả</span>
          <MoneyAmount value={summary.requiredTotal} tone="money" size="md" />
        </div>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 'var(--sp-1)', marginBottom: 0 }}>
          {formatVnd(summary.feeBaseAmount)} ban đầu + {formatVnd(summary.approvedExtraTotal)} phát sinh
        </p>
        <DataRow label="Đã tạm giữ" value={`−${formatVnd(summary.heldAmount)}`} numeric />
        {/* Luon hien dong nay (ke ca khi = 0) de nguoi xem thay du ca chuoi Tong -> Da tam giu ->
            Can nap them, khong bi "cut cut" khi khong con no gi - nguoi dung bao cao 2026-10-03.
            Nut Nap chi hien khi thuc su con no VA nguoi xem la Poster (nguoi duoc phep nap). */}
        <DataRow label="Cần nạp thêm" value={formatVnd(summary.deltaNeeded)} numeric strong />
        {summary.deltaNeeded > 0 && viewerRole === 'POSTER' && (
          <Button block icon="wallet" style={{ marginTop: 'var(--sp-2)' }} disabled={topUpBusy} onClick={onTopUp}>
            {topUpBusy ? 'Đang nạp…' : `Nạp ${formatVnd(summary.deltaNeeded)}`}
          </Button>
        )}
      </div>
      {pendingBatch && (
        <div style={{ marginTop: 'var(--sp-3)', paddingTop: 'var(--sp-3)', borderTop: 'var(--bw-hair) solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between gap-2">
            <span className="tc-label">Chi phí phát sinh · chờ duyệt</span>
            <Badge tone="warning" icon="clock">Chờ người đăng duyệt</Badge>
          </div>
          {onViewPendingInChat ? (
            <>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)', margin: 'var(--sp-2) 0 0' }}>
                Tasker đề nghị cộng thêm +{formatVnd(pendingBatch.totalAmount)}. Xem chi tiết từng khoản và
                duyệt ngay trong đoạn chat.
              </p>
              <Button block icon="message-circle" style={{ marginTop: 'var(--sp-3)' }} onClick={onViewPendingInChat}>
                Xem trong đoạn chat
              </Button>
            </>
          ) : (
            <>
              {pendingBatch.items.map((item) => (
                <DataRow key={item.id} label={item.name} value={`+${formatVnd(item.amount)}`} numeric />
              ))}
              {pendingBatch.note && (
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)', margin: 'var(--sp-2) 0 0' }}>“{pendingBatch.note}”</p>
              )}
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', margin: 'var(--sp-2) 0 0' }}>
                Cộng phát sinh lần này +{formatVnd(pendingBatch.totalAmount)}. Nếu đồng ý, tổng tiền việc này
                thành {formatVnd(summary.requiredTotal + pendingBatch.totalAmount)}.
              </p>
              <div className="flex gap-2" style={{ marginTop: 'var(--sp-3)' }}>
                {viewerRole === 'POSTER' ? (
                  <>
                    <Button icon="check" disabled={actionBusyBatchId === pendingBatch.id} onClick={() => onApprove(pendingBatch.id)}>
                      Đồng ý
                    </Button>
                    <Button variant="danger" icon="x" disabled={actionBusyBatchId === pendingBatch.id} onClick={() => onReject(pendingBatch.id)}>
                      Từ chối
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" icon="undo-2" disabled={actionBusyBatchId === pendingBatch.id} onClick={() => onWithdraw(pendingBatch.id)}>
                    Thu hồi
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
