import { defineConfig } from 'vite'
// npm run build → ./app に出力（launcher.pyw が app/index.html を配信する）
export default defineConfig({
  base: './',
  build: { outDir: 'app', emptyOutDir: true, modulePreload: false, chunkSizeWarningLimit: 8000 }
})
