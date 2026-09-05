import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Avatar } from '@ds/components/core/Avatar'
import { Badge } from '@ds/components/core/Badge'
import { Card } from '@ds/components/core/Card'
import { EmptyState } from '@ds/components/feedback/EmptyState'
import { AppShell } from '../components/AppShell.tsx'
import { getPublicProfile } from '../api/users.ts'
import type { PublicProfileResponse } from '../api/users.ts'
import { ApiError } from '../api/client.ts'
import { formatDate } from '../utils/formatDate.ts'
import { DAY_LABELS } from '../utils/dayOfWeek.ts'

/** Ho so cong khai toi thieu cua mot tai khoan bat ky - GET /users/{accountId}, chi can da dang nhap. */
export function PublicProfilePage() {
  const { accountId } = useParams<{ accountId: string }>()
  const [profile, setProfile] = useState<PublicProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    setLoading(true)
    getPublicProfile(accountId)
      .then((response) => {
        if (!cancelled) setProfile(response)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.code === 'USR-404-PROFILE_NOT_FOUND') {
          setNotFound(true)
        } else {
          setError(err instanceof ApiError ? err.message : 'Không tải được hồ sơ. Kiểm tra mạng rồi thử lại.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [accountId])

  return (
    <AppShell navValue="profile" title="Hồ sơ" subtitle="Thông tin công khai">
      {loading
        ? null
        : error
          ? <Alert tone="danger" title="Không tải được hồ sơ">{error}</Alert>
          : notFound
            ? <EmptyState icon="user-round-x" title="Chưa có hồ sơ">Tài khoản này chưa tạo hồ sơ cá nhân.</EmptyState>
            : profile && (
                <div className="flex flex-col gap-4" style={{ maxWidth: 'var(--content-max)' }}>
                  <Card padding="var(--sp-6)" style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'center' }}>
                    <Avatar name={profile.fullName || 'Chưa đặt tên'} src={profile.avatarUrl ?? undefined} size={80} />
                    <div>
                      <strong style={{ fontSize: 'var(--fs-h2)', display: 'block' }}>{profile.fullName || 'Chưa đặt tên'}</strong>
                      {profile.operatingArea && (
                        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>{profile.operatingArea}</span>
                      )}
                    </div>
                  </Card>
                  {(profile.email || profile.phone) && (
                    <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                      <div className="tc-label">Liên hệ</div>
                      {profile.email && <span style={{ color: 'var(--text-body)' }}>{profile.email}</span>}
                      {profile.phone && <span style={{ color: 'var(--text-body)' }}>{profile.phone}</span>}
                    </Card>
                  )}
                  {profile.bio && (
                    <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                      <div className="tc-label">Giới thiệu</div>
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-body)' }}>{profile.bio}</p>
                    </Card>
                  )}
                  {(profile.verifiedSkills ?? []).length > 0 && (
                    <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                      <div className="tc-label">Kỹ năng đã xác minh</div>
                      <div className="flex gap-2 flex-wrap">
                        {profile.verifiedSkills.map((skill) => (
                          <Badge key={skill.categoryId} tone="success" icon="badge-check" title={`Xác minh lúc ${formatDate(skill.verifiedAt)}`}>
                            {skill.categoryName}
                          </Badge>
                        ))}
                      </div>
                    </Card>
                  )}
                  {(profile.availability ?? []).length > 0 && (
                    <Card padding="var(--sp-6)" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                      <div className="tc-label">Lịch làm việc</div>
                      <div className="flex flex-col gap-2">
                        {profile.availability.map((slot) => (
                          <div key={slot.id} className="flex items-center gap-3">
                            <Badge tone="brand">{DAY_LABELS[slot.dayOfWeek]}</Badge>
                            <span className="tc-num">{slot.startTime.slice(0, 5)} – {slot.endTime.slice(0, 5)}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              )}
    </AppShell>
  )
}
