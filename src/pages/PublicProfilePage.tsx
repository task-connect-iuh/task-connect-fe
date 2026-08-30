import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert } from '@ds/components/feedback/Alert'
import { Avatar } from '@ds/components/core/Avatar'
import { Card } from '@ds/components/core/Card'
import { EmptyState } from '@ds/components/feedback/EmptyState'
import { AppShell } from '../components/AppShell.tsx'
import { getPublicProfile } from '../api/users.ts'
import type { PublicProfileResponse } from '../api/users.ts'
import { ApiError } from '../api/client.ts'

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
                <Card padding="var(--sp-6)" style={{ display: 'flex', gap: 'var(--sp-5)', alignItems: 'center', maxWidth: 'var(--content-max)' }}>
                  <Avatar name={profile.fullName || 'Chưa đặt tên'} src={profile.avatarUrl ?? undefined} size={80} />
                  <div>
                    <strong style={{ fontSize: 'var(--fs-h2)', display: 'block' }}>{profile.fullName || 'Chưa đặt tên'}</strong>
                    {profile.operatingArea && (
                      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-sm)' }}>{profile.operatingArea}</span>
                    )}
                  </div>
                </Card>
              )}
    </AppShell>
  )
}
