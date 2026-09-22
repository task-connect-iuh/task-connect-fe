import { Badge } from '@ds/components/core/Badge'
import type { ProposalStatus } from '../../../api/chat.ts'

interface ProposalStatusBadgeProps {
  status: ProposalStatus
  /** Nguoi dang xem co phai la nguoi tao de xuat nay khong. */
  mine: boolean
}

/**
 * Nhan trang thai dung chung cho the PRICE_PROPOSAL va RESCHEDULE_PROPOSAL. REJECTED gom ca 2
 * truong hop "bi tu choi" va "tu thu hoi" (backend dung chung 1 gia tri ProposalStatus.REJECTED
 * cho ca 2 hanh dong, xem ChatService.withdrawPriceProposal/rejectPriceProposal) - phan biet
 * that su nam o dong SYSTEM message rieng ngay sau de xuat trong khung chat, khong o badge nay.
 */
export function ProposalStatusBadge({ status, mine }: ProposalStatusBadgeProps) {
  if (status === 'ACCEPTED') return <Badge tone="success" icon="check">Đã đồng ý</Badge>
  if (status === 'REJECTED') return <Badge tone="neutral" icon="x">Không còn hiệu lực</Badge>
  return <Badge tone="warning" icon="clock">{mine ? 'Đang chờ đối phương' : 'Chờ bạn quyết định'}</Badge>
}
