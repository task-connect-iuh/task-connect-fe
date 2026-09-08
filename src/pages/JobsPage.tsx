import { useAuthStore } from '../stores/useAuthStore.ts'
import { MyTasksPage } from './MyTasksPage.tsx'
import { TaskerJobsPage } from './TaskerJobsPage.tsx'

/**
 * Wrapper cho route "/viec-cua-toi" - dung chung 1 duong dan cho ca Poster va Tasker (khop
 * value "jobs" da gop chung tu truoc trong AppShell.tsx, xem POSTER_ONLY_NAV/TASKER_ONLY_NAV),
 * moi vai tro render man hinh rieng: Poster xem viec da dang (MyTasksPage), Tasker xem viec da
 * nhan (TaskerJobsPage). Cung pattern re nhanh theo activeRole nhu OverviewPage.tsx.
 */
export function JobsPage() {
  const activeRole = useAuthStore((state) => state.activeRole)
  return activeRole === 'tasker' ? <TaskerJobsPage /> : <MyTasksPage />
}
