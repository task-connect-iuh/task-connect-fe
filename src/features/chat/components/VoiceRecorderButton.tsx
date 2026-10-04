import { useEffect, useRef, useState } from 'react'
import { Icon } from '@ds/components/core/Icon'
import { IconButton } from '@ds/components/core/IconButton'
import { useToastStore } from '../../../stores/useToastStore.ts'

interface VoiceRecorderButtonProps {
  disabled: boolean
  /** Ngan tu dong dung ghi am (giay) - doc tu admin_system_parameters "chat_voice_max_duration_seconds". */
  maxDurationSeconds: number
  /** Goi voi 1 File da dong goi tu Blob ghi am duoc, san sang truyen thang vao uploadChatAttachments/sendAttachmentMessage(kind='VOICE'). */
  onRecorded: (file: File) => void
}

/** "1:05" tu tong so giay - dung cho dong ho dem luc dang ghi am. */
function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Nut ghi am tin nhan thoai (them 2026-09-26) - dung MediaRecorder API co san cua trinh duyet,
 * KHONG them thu vien ghi am ngoai. Bam icon mic: xin quyen microphone (neu chua cap), bat dau
 * ghi va doi giao dien sang trang thai dang ghi (cham do nhap nhay + dong ho dem + nut Huy/Gui).
 * Tu dong dung khi cham nguong maxDurationSeconds (khop dac ta 5 phut da chot voi nguoi dung).
 * Khong luu duoc thoi luong that vao DB (chat_message_attachments khong co cot rieng cho no) -
 * the <audio controls> tu doc duoc thoi luong tu chinh file khi phat, khong can luu them.
 */
export function VoiceRecorderButton({ disabled, maxDurationSeconds, onRecorded }: VoiceRecorderButtonProps) {
  const [recording, setRecording] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const cancelledRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Dung stream/timer dang chay - goi sau khi ghi xong (thanh cong, huy, hay unmount giua chung). */
  const cleanup = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
    chunksRef.current = []
    setRecording(false)
    setElapsedSeconds(0)
  }

  // Dep rong: chi don dep 1 lan luc InboxPage roi khoi trang giua chung dang ghi am, tranh ro ri
  // microphone (den ghi am con sang tren trinh duyet neu khong goi getTracks().stop()).
  useEffect(() => () => cleanup(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const stopRecording = (cancelled: boolean) => {
    cancelledRef.current = cancelled
    recorderRef.current?.stop()
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      cancelledRef.current = false

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const wasCancelled = cancelledRef.current
        // recorder.mimeType tra ve dang co codec (vd "audio/webm;codecs=opus"), PHAI cat bo phan
        // ";codecs=..." truoc khi dung lam Content-Type: presigned PUT URL cua S3 ky ca header
        // Content-Type (X-Amz-SignedHeaders co "content-type"), va BE chi ky voi ban da chuan hoa
        // (ImageContentTypes.normalize() cat bo tu dau ";") - neu FE gui header PUT khac byte voi
        // luc ky, S3 tra 403 (phat hien qua Playwright thu that, khong xay ra voi anh/video vi
        // input[type=file] khong bao gio co tham so codec kem theo file.type).
        const cleanMimeType = (recorder.mimeType || 'audio/webm').split(';')[0].trim()
        const blob = new Blob(chunksRef.current, { type: cleanMimeType })
        cleanup()
        if (!wasCancelled && blob.size > 0) {
          const extension = cleanMimeType.includes('mp4') ? 'm4a' : 'webm'
          onRecorded(new File([blob], `voice-message.${extension}`, { type: cleanMimeType }))
        }
      }

      recorder.start()
      setRecording(true)
      setElapsedSeconds(0)
      intervalRef.current = setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000)
      timeoutRef.current = setTimeout(() => stopRecording(false), maxDurationSeconds * 1000)
    } catch {
      useToastStore.getState().pushToast('danger', 'Không truy cập được microphone — kiểm tra quyền truy cập của trình duyệt.')
    }
  }

  if (!recording) {
    return (
      <IconButton
        icon="mic" label="Ghi âm tin nhắn thoại" title="Ghi âm tin nhắn thoại" size="sm" variant="ghost"
        disabled={disabled} onClick={startRecording}
      />
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Icon name="circle" size={10} style={{ color: 'var(--danger)' }} />
      <span className="tc-num" style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)' }}>
        {formatDuration(elapsedSeconds)}
      </span>
      <IconButton icon="x" label="Huỷ ghi âm" title="Huỷ ghi âm" size="sm" variant="ghost" onClick={() => stopRecording(true)} />
      <IconButton icon="send" label="Gửi tin nhắn thoại" title="Gửi tin nhắn thoại" size="sm" variant="brand" onClick={() => stopRecording(false)} />
    </div>
  )
}
