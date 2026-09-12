import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

// Khoi tao mot lan duy nhat luc module duoc import - khong can React provider bao ngoai
// (khac @react-oauth/google), Firebase JS SDK la mot singleton module-level don thuan.
// Config la gia tri public (khong phai secret), an toan trong FE build - xem .env.example.
const firebaseApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

export const firebaseAuth = getAuth(firebaseApp)
