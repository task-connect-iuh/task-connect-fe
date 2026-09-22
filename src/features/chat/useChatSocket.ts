import { useEffect, useRef } from 'react'
import { Client, type StompSubscription } from '@stomp/stompjs'
import { useAuthStore } from '../../stores/useAuthStore.ts'
import type { ChatMessageResponse, InboxPingEvent } from '../../api/chat.ts'

// Backend dang ky STOMP endpoint truc tiep tai "/ws" (khong co tien to "/api/v1", khong bat
// SockJS fallback - xem WebSocketConfig.java), khac BASE_URL cua REST trong api/client.ts.
// TODO: chuyen sang bien moi truong (import.meta.env.VITE_WS_BASE_URL) khi co nhieu moi truong,
// cung tinh than voi TODO cua BASE_URL trong api/client.ts.
const WS_URL = 'ws://localhost:8080/ws'

interface UseChatSocketOptions {
  /** Kenh dang mo tren man hinh (neu co) - null nghia la chua chon hoi thoai nao, chi nhan ping Inbox. */
  applicationId: string | null
  /** Goi khi co tin nhan/de xuat moi tren dung kenh dang mo (topic "/topic/chat/{applicationId}"). */
  onMessage: (message: ChatMessageResponse) => void
  /** Goi khi co bat ky thay doi nao lien quan Inbox cua chinh minh (queue rieng tai khoan). */
  onInboxPing: (event: InboxPingEvent) => void
}

/**
 * Ket noi STOMP that (khong polling) toi backend, song suot vong doi InboxPage - luon
 * subscribe "/user/queue/inbox" ngay khi ket noi/ket noi lai, va subscribe rieng
 * "/topic/chat/{applicationId}" cho kenh dang xem, tu dong doi subscribe khi nguoi dung chon
 * hoi thoai khac MA KHONG can dong/mo lai toan bo ket noi. Access token gui qua STOMP native
 * header Authorization o frame CONNECT (khong dung query param, tranh lo token vao log) -
 * khop dung StompAuthChannelInterceptor o backend.
 */
export function useChatSocket({ applicationId, onMessage, onInboxPing }: UseChatSocketOptions) {
  const onMessageRef = useRef(onMessage)
  const onInboxPingRef = useRef(onInboxPing)
  onMessageRef.current = onMessage
  onInboxPingRef.current = onInboxPing

  // Ref (khong phai bien closure thuong) de callback onConnect luon doc dung applicationId
  // MOI NHAT ke ca khi no chi duoc goi lai luc reconnect sau mang chap chon (onConnect duoc
  // gan 1 lan trong effect dau, khong re-run theo applicationId).
  const applicationIdRef = useRef(applicationId)
  applicationIdRef.current = applicationId

  const clientRef = useRef<Client | null>(null)
  const chatSubscriptionRef = useRef<StompSubscription | null>(null)
  const accessToken = useAuthStore((state) => state.session?.accessToken)

  const subscribeToChatTopic = (client: Client, id: string | null) => {
    chatSubscriptionRef.current?.unsubscribe()
    chatSubscriptionRef.current = id
      ? client.subscribe(`/topic/chat/${id}`, (frame) => onMessageRef.current(JSON.parse(frame.body)))
      : null
  }

  // Vong doi ket noi - tao dung 1 lan cho ca phien InboxPage (chi tao lai khi accessToken
  // doi, vi doi kenh dang xem khong can ket noi lai tu dau, xem effect thu hai ben duoi).
  useEffect(() => {
    if (!accessToken) return undefined

    const client = new Client({
      brokerURL: WS_URL,
      connectHeaders: { Authorization: `Bearer ${accessToken}` },
      reconnectDelay: 4000,
    })
    client.onConnect = () => {
      client.subscribe('/user/queue/inbox', (frame) => onInboxPingRef.current(JSON.parse(frame.body)))
      subscribeToChatTopic(client, applicationIdRef.current)
    }
    client.activate()
    clientRef.current = client

    return () => {
      client.deactivate()
      clientRef.current = null
      chatSubscriptionRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  // Doi kenh dang xem tren ket noi da co san - khong dong/mo lai client.
  useEffect(() => {
    const client = clientRef.current
    if (client?.connected) subscribeToChatTopic(client, applicationId)
  }, [applicationId])
}
