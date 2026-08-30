import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Design System song hanh o repo rieng (task-connect-claude), can nam cung
// thu muc cha voi repo nay khi clone. Xem 21-react-frontend.md.
// Alias '@ds' phai khop voi "paths" trong tsconfig.app.json - mot ben lo bundler,
// mot ben lo type-check, lech nhau se ra hai ket qua resolve khac nhau.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ds': path.resolve(__dirname, '../task-connect-claude/.claude/skills/taskconnect-design'),
      // Component DS nam ngoai repo nay nen khong co node_modules rieng: ep 'react'
      // va 'react-dom' (ke ca subpath nhu react/jsx-runtime) ve dung mot ban duy nhat
      // trong node_modules cua task-connect-fe, tranh loi khong resolve duoc khi build.
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
})
