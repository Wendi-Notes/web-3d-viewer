// DWG 読み込み・CAD 文字描画用の Web Worker を public/workers にコピーする
import { copyFileSync, mkdirSync } from 'node:fs'
const out = 'public/workers'
mkdirSync(out, { recursive: true })
const files = [
  ['node_modules/@mlightcad/libredwg-converter/dist/libredwg-parser-worker.js', 'libredwg-parser-worker.js'],
  ['node_modules/@mlightcad/libredwg-converter/dist/libredwg-web.wasm', 'libredwg-web.wasm'],
  ['node_modules/@mlightcad/cad-simple-viewer/dist/mtext-renderer-worker.js', 'mtext-renderer-worker.js']
]
for (const [src, name] of files) copyFileSync(src, `${out}/${name}`)
console.log('workers copied →', out)
