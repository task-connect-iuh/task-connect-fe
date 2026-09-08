import { useEffect, useState } from 'react'
import { getMyProfile, getMySkills, listServiceCategories } from '../../api/users.ts'
import type { KycStatus, ServiceCategoryResponse, TaskerSkillResponse } from '../../api/users.ts'
import { ApiError } from '../../api/client.ts'

/** Giong het toKycStatusState o KycPage.tsx (khong export tu do) - anh xa 5 trang thai KYC that sang 4 trang thai cua component KycStatus (@ds). */
export function toKycStatusState(status: KycStatus | null): 'unverified' | 'pending' | 'approved' | 'rejected' {
  switch (status) {
    case 'VERIFYING': return 'pending'
    case 'VERIFIED': return 'approved'
    case 'REJECTED': return 'rejected'
    default: return 'unverified'
  }
}

/**
 * Du lieu dung chung cho man Tim viec va Chi tiet viec: danh muc dich vu THAT (5 nhom
 * dien-nuoc, tu listServiceCategories), trang thai KYC THAT (tu ho so), va ky nang/chung
 * chi THAT cua chinh Tasker dang dang nhap (tu getMySkills) - dung de biet Tasker da co
 * chung chi VERIFIED cho nhom dich vu nao thi moi duoc ung tuyen viec thuoc nhom do (yeu cau
 * nguoi dung: "job nao ma user do da co chung chi tuong ung moi duoc nhan"). Day la DU LIEU
 * THAT, dung chung cho TaskerFeedPage/TaskerJobDetailPage/TaskerJobsPage - ca 3 trang nay gio
 * da goi API that cua module Task cho danh sach/chi tiet viec va don ung tuyen (UC10/UC11, xem
 * api/tasks.ts va docs/TASK-MODULE-SPLIT.md).
 */
export function useTaskerEligibility() {
  const [categories, setCategories] = useState<ServiceCategoryResponse[] | null>(null)
  const [skills, setSkills] = useState<TaskerSkillResponse[] | null>(null)
  const [kycStatus, setKycStatus] = useState<KycStatus | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    Promise.all([listServiceCategories(), getMySkills(), getMyProfile()])
      .then(([categoryList, skillList, profile]) => {
        setCategories(categoryList)
        setSkills(skillList)
        setKycStatus(profile.kycStatus)
      })
      .catch((error) => setLoadError(error instanceof ApiError ? error.message : 'Không tải được dữ liệu hồ sơ.'))
  }, [])

  const categoryByCode = new Map(categories?.map((c) => [c.code, c]) ?? [])
  const kycVerified = kycStatus === 'VERIFIED'

  /** Tasker duoc coi la du dieu kien nhan viec thuoc 1 danh muc khi da co ky nang VERIFIED cho danh muc do. */
  function isEligibleForCategory(categoryId: string): boolean {
    return skills?.some((skill) => skill.categoryId === categoryId && skill.verificationStatus === 'VERIFIED') ?? false
  }

  return {
    ready: categories != null && skills != null && kycStatus != null,
    loadError,
    categories,
    categoryByCode,
    skills,
    kycStatus,
    kycVerified,
    isEligibleForCategory,
  }
}
