// （任意）CAD 図面の文字用フォントを mlightcad/cad-data から public/fonts にダウンロードする。
// オフラインで DXF/DWG の文字を表示したいときに実行してください。
// フォントの中には再配布できないものが含まれるため、このリポジトリには同梱していません。
import { mkdirSync, writeFileSync } from 'node:fs'
const BASE = 'https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/fonts/'
const out = 'public/fonts'
mkdirSync(out, { recursive: true })
const list = await (await fetch(BASE + 'fonts.json')).json()
writeFileSync(`${out}/fonts.json`, JSON.stringify(list))
let n = 0
for (const f of list) {
  const r = await fetch(BASE + encodeURIComponent(f.file))
  if (!r.ok) { console.warn('skip', f.file); continue }
  writeFileSync(`${out}/${f.file}`, Buffer.from(await r.arrayBuffer())); n++
  process.stdout.write(`\r${n}/${list.length} ${f.file}            `)
}
console.log('\nfonts →', out)
