import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { nativeQueueAuthFault } from './scripts/qa/local-english/native-auth-fault.mjs'
import { localEnglishCatalog } from './scripts/qa/local-english/catalog.mjs'

// 本地联调默认连本机后端；需连远程时用 VITE_SERVER_URL 覆盖，
// 例如：VITE_SERVER_URL=http://8.139.253.111:8080 npm run dev:h5
const SERVER_URL = process.env.VITE_SERVER_URL || 'http://localhost:8080'

export default defineConfig(({ command }) => ({
  plugins: [uni(), ...(command === 'serve' && process.env.MINDY_LOCAL_ENGLISH_DIR
    ? [nativeQueueAuthFault(), localEnglishCatalog(process.env.MINDY_LOCAL_ENGLISH_DIR, SERVER_URL, process.env.MINDY_LOCAL_ENGLISH_DB === '1')] : [])],
  server: {
    proxy: {
      // /ws is the phone realtime socket. The page and the API share this dev server.
      '^/(api|member|vip|ws)': {
        target: SERVER_URL,
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  }
}))
