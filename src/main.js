import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js'
import { ICONS } from './icons.js'

const $ = id => document.getElementById(id)
const params = new URLSearchParams(location.search)
const token = params.get('token')
const KIND = n => {
  const e = n.split('.').pop().toLowerCase()
  return e === 'stl' || e === '3mf' ? '3d' : e === 'dxf' || e === 'dwg' || e === 'svg' ? '2d' : null
}
const extOf = n => n.split('.').pop().toLowerCase()

// ---------- アイコン ----------
for (const el of document.querySelectorAll('i[data-ic]')) el.innerHTML = ICONS[el.dataset.ic] || ''

// ---------- ツールチップ ----------
const tipEl = $('tip')
let tipTimer = 0, tipTarget = null
function placeTip(target) {
  const r = target.getBoundingClientRect()
  tipEl.style.left = '0px'; tipEl.style.top = '0px'
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight
  let x = Math.min(Math.max(6, r.left + r.width / 2 - w / 2), innerWidth - w - 6)
  let y = r.bottom + 8
  if (y + h > innerHeight - 6) y = r.top - h - 8
  tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px'
}
document.addEventListener('mouseover', e => {
  const t = e.target.closest('[data-tip]')
  if (t === tipTarget) return
  tipTarget = t; clearTimeout(tipTimer); tipEl.classList.remove('show')
  if (!t) return
  tipTimer = setTimeout(() => { tipEl.textContent = t.dataset.tip; placeTip(t); tipEl.classList.add('show') }, 450)
})
document.addEventListener('mousedown', () => { clearTimeout(tipTimer); tipEl.classList.remove('show') })

// ---------- トースト ----------
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2800) }
const statusEl = $('status')
const setStatus = t => { statusEl.textContent = t }

// ---------- 表示設定（枠の色） ----------
const COLOR_KEYS = [
  ['--c-header', '上部バー', '#ffffff'],
  ['--c-tabs', 'タブ帯', '#e4ebf2'],
  ['--c-side', '右パネル', '#ffffff'],
  ['--c-accent', 'アクセント（ボタン・選択）', '#1769aa'],
  ['--c-text', '文字', '#202124']
]
const UI_KEY = 'w3v.ui.colors'
function loadColors() { try { return JSON.parse(localStorage.getItem(UI_KEY)) || {} } catch { return {} } }
function saveColors(c) { try { localStorage.setItem(UI_KEY, JSON.stringify(c)) } catch {} }
function applyColors(c) { for (const [k, , d] of COLOR_KEYS) document.documentElement.style.setProperty(k, c[k] || d) }
let colors = loadColors(); applyColors(colors)
function buildColorRows() {
  const box = $('colorRows'); box.innerHTML = ''
  for (const [k, label, d] of COLOR_KEYS) {
    const l = document.createElement('label'); l.textContent = label
    const inp = document.createElement('input'); inp.type = 'color'; inp.value = colors[k] || d
    inp.oninput = () => { colors[k] = inp.value; applyColors(colors); saveColors(colors) }
    box.append(l, inp)
  }
}
$('settingsBtn').onclick = () => { buildColorRows(); $('settings').showModal() }
$('resetColors').onclick = () => { colors = {}; saveColors(colors); applyColors(colors); buildColorRows() }

// ---------- 状態 ----------
let mode = '3d'
const tabs = { '3d': [], '2d': [] }
const active = { '3d': null, '2d': null }
let nextId = 1
let measuring = false
const stage = $('stage')

// =====================================================================
// 3D
// =====================================================================
const host3 = $('view3d')
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xeef3f8)
const camera = new THREE.PerspectiveCamera(42, 1, .01, 100000); camera.up.set(0, 0, 1)
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace
host3.appendChild(renderer.domElement)
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true
scene.add(new THREE.HemisphereLight(0xffffff, 0x78818a, 2))
const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(-80, -100, 150); scene.add(key)
const fill = new THREE.DirectionalLight(0xffffff, .8); fill.position.set(90, 60, 30); scene.add(fill)
const grid = new THREE.GridHelper(200, 20, 0xa5b2bf, 0xd0d9e2); grid.rotation.x = Math.PI / 2; scene.add(grid)
const COLORS = [0xb9c4cc, 0xe0a96d, 0x8fbf8f, 0x9fb4e0, 0xd99ab8, 0xc9c27a, 0x8ccfd0, 0xc4a3d9]
const layoutEl = $('layout')

function resize3() { const w = Math.max(1, host3.clientWidth), h = Math.max(1, host3.clientHeight); renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px'; camera.aspect = w / h; camera.updateProjectionMatrix() }
new ResizeObserver(resize3).observe(host3); resize3()

function dispose(o) { o.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material) for (const m of (Array.isArray(n.material) ? n.material : [n.material])) m.dispose() }) }
const shown3 = t => layoutEl.value === 'solo' ? t === active['3d'] : true
function layout3() {
  const list = tabs['3d']; for (const t of list) t.holder.visible = shown3(t)
  const vis = list.filter(shown3)
  if (layoutEl.value === 'row' && vis.length > 1) {
    const maxW = Math.max(...vis.map(t => t.size.x)), gap = Math.max(5, maxW * .15)
    let x = -(vis.reduce((s, t) => s + t.size.x, 0) + gap * (vis.length - 1)) / 2
    for (const t of vis) { t.holder.position.set(x + t.size.x / 2, 0, 0); x += t.size.x + gap }
  } else for (const t of vis) t.holder.position.set(0, 0, 0)
}
function fitBox(box) {
  if (box.isEmpty()) return
  const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3())
  const r = Math.max(s.x, s.y, s.z) * .5 || 1
  camera.near = Math.max(r / 10000, .001); camera.far = r * 200
  camera.position.copy(c).add(new THREE.Vector3(r * 2.4, -r * 3, r * 2.3)); camera.updateProjectionMatrix()
  controls.target.copy(c); controls.minDistance = r * .05; controls.maxDistance = r * 40; controls.update()
  grid.scale.setScalar(Math.max(1, r / 100))
}
function fit3() {
  const box = new THREE.Box3()
  for (const t of tabs['3d'].filter(shown3)) { t.holder.updateMatrixWorld(true); box.expandByObject(t.holder) }
  fitBox(box)
}
async function add3d(file, meta) {
  const ext = extOf(file.name)
  const data = await file.arrayBuffer()
  const color = COLORS[(nextId - 1) % COLORS.length]
  let obj, tris = 0
  if (ext === 'stl') {
    const g = new STLLoader().parse(data); g.computeVertexNormals()
    obj = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, metalness: .1, roughness: .62, side: THREE.DoubleSide }))
  } else {
    obj = new ThreeMFLoader().parse(data)
    obj.traverse(n => { if (n.isMesh) for (const m of (Array.isArray(n.material) ? n.material : [n.material])) m.side = THREE.DoubleSide })
  }
  obj.traverse(n => { if (n.isMesh) { const g = n.geometry; tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3 } })
  // 計測用：形の「角」と「辺」だけを抜き出す（平らな面の中の分割線は除く）
  obj.traverse(n => {
    if (!n.isMesh) return
    try { n.userData.edges = new THREE.EdgesGeometry(n.geometry, 15).attributes.position.array; findCircles(n) } catch (e) { console.error(e); n.userData.edges = null }
  })
  obj.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(obj); if (box.isEmpty()) throw Error('表示できる形状がありません')
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3())
  obj.position.x -= c.x; obj.position.y -= c.y; obj.position.z -= box.min.z
  const holder = new THREE.Group(); holder.add(obj); scene.add(holder)
  const t = { id: nextId++, kind: '3d', type: ext, name: file.name, file, srvId: meta?.id, path: meta?.path, holder, size, tris: Math.round(tris), color: ext === 'stl' ? '#' + color.toString(16).padStart(6, '0') : '#cfd6dd' }
  tabs['3d'].push(t); active['3d'] = t
  return t
}
function close3d(t) { scene.remove(t.holder); dispose(t.holder); clearMeasures3(t) }

// ---------- 円の検出（辺のつながった輪が円なら直径を出せる） ----------
function findCircles(mesh) {
  const e = mesh.userData.edges, nSeg = e.length / 6
  const keyOf = (i) => Math.round(e[i] * 1e3) + ',' + Math.round(e[i + 1] * 1e3) + ',' + Math.round(e[i + 2] * 1e3)
  const ids = new Map(), pts = [], segV = new Int32Array(nSeg * 2)
  for (let s = 0; s < nSeg; s++) for (let k = 0; k < 2; k++) {
    const off = s * 6 + k * 3, key = keyOf(off)
    let id = ids.get(key); if (id === undefined) { id = pts.length; ids.set(key, id); pts.push(new THREE.Vector3(e[off], e[off + 1], e[off + 2])) }
    segV[s * 2 + k] = id
  }
  // 点のつながりでグループ分け
  const parent = new Int32Array(pts.length).map((_, i) => i)
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
  const deg = new Int32Array(pts.length)
  for (let s = 0; s < nSeg; s++) { const a = segV[s * 2], b = segV[s * 2 + 1]; deg[a]++; deg[b]++; parent[find(a)] = find(b) }
  const groups = new Map()
  for (let s = 0; s < nSeg; s++) { const g = find(segV[s * 2]); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(s) }
  const segCircle = new Array(nSeg).fill(null)
  for (const segs of groups.values()) {
    if (segs.length < 8) continue
    const vs = [...new Set(segs.flatMap(s => [segV[s * 2], segV[s * 2 + 1]]))]
    if (vs.some(v => deg[v] !== 2)) continue          // 1周の輪だけ
    const P = vs.map(v => pts[v])
    const c = new THREE.Vector3(); for (const p of P) c.add(p); c.divideScalar(P.length)
    const rs = P.map(p => p.distanceTo(c)), r = rs.reduce((a, b) => a + b, 0) / rs.length
    if (r <= 0 || Math.max(...rs.map(x => Math.abs(x - r))) / r > .02) continue
    // 平面に乗っているか（Newell法の法線で確認）
    const a0 = new THREE.Vector3().subVectors(P[0], c), n2 = new THREE.Vector3(), tmp = new THREE.Vector3()
    for (const p of P) { tmp.subVectors(p, c).cross(a0); if (tmp.lengthSq() > n2.lengthSq()) n2.copy(tmp) }
    if (n2.lengthSq() < 1e-12) continue
    n2.normalize()
    if (P.some(p => Math.abs(p.clone().sub(c).dot(n2)) > r * .02)) continue
    const circle = { center: c, r, normal: n2, pts: P }
    for (const s of segs) segCircle[s] = circle
  }
  mesh.userData.segCircle = segCircle
}

// ---------- 3D 計測 ----------
const ray = new THREE.Raycaster()
const measures3 = []   // {tab, a, b, line, dots, label}
let pending3 = null    // {point, dot}
const hoverDot = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff5a1f, depthTest: false }))
hoverDot.renderOrder = 999; hoverDot.visible = false; scene.add(hoverDot)
const dotMat = new THREE.MeshBasicMaterial({ color: 0xd9480f, depthTest: false })
const lineMat = new THREE.LineBasicMaterial({ color: 0xd9480f, depthTest: false })
function pixelWorld(p) { // 画面1pxあたりのワールド長
  const d = camera.position.distanceTo(p)
  return 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1, host3.clientHeight)
}
function pick3(ev) {
  const r = renderer.domElement.getBoundingClientRect()
  const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
  ray.setFromCamera(ndc, camera)
  const targets = tabs['3d'].filter(t => t.holder.visible).map(t => t.holder)
  const hit = ray.intersectObjects(targets, true).find(h => h.object.isMesh)
  if (!hit) return null
  let p = hit.point.clone(), snap = 'face', circle = null
  const tol = pixelWorld(hit.point) * 14
  const e = hit.object.userData.edges
  if (e) {
    // 角（辺の端点）を最優先、次に辺の上の一番近い点
    const mw = hit.object.matrixWorld, a = new THREE.Vector3(), b = new THREE.Vector3(), q = new THREE.Vector3(), seg = new THREE.Line3()
    let bestV = tol, bestE = tol * .8, vtx = null, edg = null, segV = -1, segE = -1
    for (let i = 0; i < e.length; i += 6) {
      a.set(e[i], e[i + 1], e[i + 2]).applyMatrix4(mw)
      b.set(e[i + 3], e[i + 4], e[i + 5]).applyMatrix4(mw)
      const da = a.distanceTo(hit.point), db = b.distanceTo(hit.point)
      if (da < bestV) { bestV = da; vtx = a.clone(); segV = i / 6 }
      if (db < bestV) { bestV = db; vtx = b.clone(); segV = i / 6 }
      if (!vtx) {
        seg.set(a, b); seg.closestPointToPoint(hit.point, true, q)
        const dq = q.distanceTo(hit.point); if (dq < bestE) { bestE = dq; edg = q.clone(); segE = i / 6 }
      }
    }
    if (vtx) { p = vtx; snap = 'vertex' } else if (edg) { p = edg; snap = 'edge' }
    const sc = hit.object.userData.segCircle, si = vtx ? segV : edg ? segE : -1
    if (sc && si >= 0 && sc[si]) circle = worldCircle(sc[si], hit.object.matrixWorld)
  }
  const snapped = snap
  const tab = tabs['3d'].find(t => { let o = hit.object; while (o) { if (o === t.holder) return true; o = o.parent } return false })
  return { p, snapped, tab, circle }
}
function makeDot(p) { const d = new THREE.Mesh(hoverDot.geometry, dotMat); d.renderOrder = 998; d.position.copy(p); d.userData.measureDot = true; scene.add(d); return d }
function addLabel(text) { const el = document.createElement('div'); el.className = 'mlabel'; el.textContent = text; $('labels').append(el); return el }
const fmt = v => (Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(2))
function worldCircle(c, mw) {
  const center = c.center.clone().applyMatrix4(mw)
  const nm = new THREE.Matrix3().getNormalMatrix(mw)
  return { center, r: c.r, normal: c.normal.clone().applyMatrix3(nm).normalize() }
}
function circleFrom3(a, b, c) {
  const ab = b.clone().sub(a), ac = c.clone().sub(a), n = ab.clone().cross(ac)
  const n2 = n.lengthSq(); if (n2 < 1e-12) return null
  const center = a.clone().add(n.clone().cross(ab).multiplyScalar(ac.lengthSq()).add(ac.clone().cross(n).multiplyScalar(ab.lengthSq())).divideScalar(2 * n2))
  return { center, r: center.distanceTo(a), normal: n.normalize() }
}
const circleMat = new THREE.LineBasicMaterial({ color: 0x8e44ad, depthTest: false })
function ringGeometry(c) {
  const u = new THREE.Vector3(1, 0, 0); if (Math.abs(u.dot(c.normal)) > .9) u.set(0, 1, 0)
  u.sub(c.normal.clone().multiplyScalar(u.dot(c.normal))).normalize()
  const v = c.normal.clone().cross(u), pts = []
  for (let i = 0; i < 96; i++) { const t = i / 96 * Math.PI * 2; pts.push(c.center.clone().addScaledVector(u, Math.cos(t) * c.r).addScaledVector(v, Math.sin(t) * c.r)) }
  return new THREE.BufferGeometry().setFromPoints(pts)
}
const previewRing = new THREE.LineLoop(new THREE.BufferGeometry(), circleMat); previewRing.renderOrder = 999; previewRing.visible = false; scene.add(previewRing)
function showPreviewRing(c) {
  if (!c) { previewRing.visible = false; return }
  if (previewRing.userData.c !== c.center.toArray().join() + c.r) { previewRing.geometry.dispose(); previewRing.geometry = ringGeometry(c); previewRing.userData.c = c.center.toArray().join() + c.r }
  previewRing.visible = true
}
const circleText = c => `Φ${fmt(c.r * 2)} mm`
function pinCircle(c, tab, extraDots = []) {
  const line = new THREE.LineLoop(ringGeometry(c), circleMat); line.renderOrder = 997; scene.add(line)
  const label = addLabel(circleText(c)); label.style.background = '#5b2c83e6'
  measures3.push({ tab, a: c.center, b: c.center, line, dots: [makeDot(c.center), ...extraDots], label })
  showMeasureInfo(`直径 Φ${fmt(c.r * 2)} mm　（半径 R${fmt(c.r)} mm）`)
  setStatus('計測: ' + circleText(c))
}
let measureKind = 'dist'   // 'dist' | 'circle3'
let pend3pts = []
function onClick3(ev) {
  const r = pick3(ev); if (!r) return
  if (measureKind === 'circle3') {
    pend3pts.push({ p: r.p, dot: makeDot(r.p) })
    if (pend3pts.length < 3) { showMeasureInfo(`円のふちを3点クリック（あと${3 - pend3pts.length}点）　Escで終了`); return }
    const c = circleFrom3(pend3pts[0].p, pend3pts[1].p, pend3pts[2].p)
    const dots = pend3pts.map(x => x.dot); pend3pts = []
    if (!c) { for (const d of dots) scene.remove(d); showMeasureInfo('3点が一直線上にあります。別の点を選んでください'); return }
    pinCircle(c, r.tab, dots); return
  }
  // 円のふち（紫）で1点目なら、その円の直径を確定
  if (!pending3 && r.circle) { pinCircle(r.circle, r.tab); return }
  if (!pending3) { pending3 = { point: r.p, dot: makeDot(r.p), tab: r.tab }; showMeasureInfo('2点目をクリック　Shiftを押しながらで X / Y / Z 方向にまっすぐ　Escで中止'); updateCoords(r.p); return }
  const a = pending3.point, lk = targetOf(r, ev.shiftKey), b = lk.p
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]); const line = new THREE.Line(geo, lineMat); line.renderOrder = 997; scene.add(line)
  const dist = a.distanceTo(b)
  const label = addLabel(fmt(dist) + ' mm' + (lk.axis ? '（' + lk.axis + '方向）' : ''))
  const m = { tab: pending3.tab, a, b, line, dots: [pending3.dot, makeDot(b)], label }
  measures3.push(m); pending3 = null; rubber.visible = false
  showMeasureInfo(`距離 ${fmt(dist)} mm${lk.axis ? '（' + lk.axis + '方向）' : ''}　続けて1点目をクリック`)
  setStatus('計測: ' + fmt(dist) + ' mm')
  updateCoords(b)
}
// ---------- 水平・垂直ロック（Shift）と座標表示 ----------
const AXES = [['X', new THREE.Vector3(1, 0, 0), 0xe03131], ['Y', new THREE.Vector3(0, 1, 0), 0x2f9e44], ['Z', new THREE.Vector3(0, 0, 1), 0x1c7ed6]]
function targetOf(r, shift) {
  if (!pending3 || !shift) return { p: r.p, axis: null }
  const a = pending3.point, d = r.p.clone().sub(a)
  let best = AXES[0]; for (const ax of AXES) if (Math.abs(d.dot(ax[1])) > Math.abs(d.dot(best[1]))) best = ax
  return { p: a.clone().addScaledVector(best[1], d.dot(best[1])), axis: best[0], color: best[2] }
}
const rubberMat = new THREE.LineBasicMaterial({ color: 0xd9480f, depthTest: false })
const rubber = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), rubberMat)
rubber.renderOrder = 999; rubber.visible = false; scene.add(rubber)
const cfmt = v => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(2)
function coordHTML(title, p, cls = '') {
  return `<div class="cbox ${cls}"><b>${title}</b>` + (p ? `<span class="cx">X ${cfmt(p.x)}</span><span class="cy">Y ${cfmt(p.y)}</span><span class="cz">Z ${cfmt(p.z)}</span>` : '<span class="na">未選択</span>') + '</div>'
}
function updateCoords(cur, lock) {
  const el = $('coordPanel'); if (!measuring || mode !== '3d' || measureKind !== 'dist' || !pending3) { el.classList.add('hidden'); return }  // 1点目を選ぶまでは出さない
  let right = coordHTML('カーソル', cur, 'live')
  if (pending3 && cur) {
    const d = cur.clone().sub(pending3.point), same = v => Math.abs(v) < 0.005
    right = right.replace('</div>', `<i class="dl">Δ</i><span class="cx${same(d.x) ? ' eq' : ''}">${cfmt(d.x)}</span><span class="cy${same(d.y) ? ' eq' : ''}">${cfmt(d.y)}</span><span class="cz${same(d.z) ? ' eq' : ''}">${cfmt(d.z)}</span>` + (lock ? `<em>${lock}方向にロック中</em>` : '') + '</div>')
  }
  el.innerHTML = coordHTML('1点目', pending3?.point) + right
  el.classList.remove('hidden')
}
let lastMove = null
function onMove3(e) {
  lastMove = e
  if (!measuring || mode !== '3d') { hoverDot.visible = false; rubber.visible = false; return }
  const r = pick3(e); hoverDot.visible = !!r
  const showCircle = r && r.circle && measureKind === 'dist' && !pending3
  showPreviewRing(showCircle ? r.circle : null)
  if (!r) { rubber.visible = false; return }
  const t = targetOf(r, e.shiftKey)
  hoverDot.position.copy(t.p)
  hoverDot.material.color.set(t.axis ? t.color : showCircle ? 0x8e44ad : r.snapped === 'vertex' ? 0x12a150 : r.snapped === 'edge' ? 0x1c7ed6 : 0xff5a1f)
  if (pending3 && measureKind === 'dist') {
    rubber.geometry.setFromPoints([pending3.point, t.p]); rubber.material.color.set(t.axis ? t.color : 0xd9480f); rubber.visible = true
    showMeasureInfo(`距離 ${fmt(pending3.point.distanceTo(t.p))} mm　（Shiftで X / Y / Z 方向にロック）`)
  } else rubber.visible = false
  if (showCircle) showMeasureInfo(`${circleText(r.circle)}　（クリックで確定）`)
  updateCoords(t.p, t.axis)
}
addEventListener('keydown', e => { if (e.key === 'Shift' && lastMove) onMove3({ clientX: lastMove.clientX, clientY: lastMove.clientY, shiftKey: true }) })
addEventListener('keyup', e => { if (e.key === 'Shift' && lastMove) onMove3({ clientX: lastMove.clientX, clientY: lastMove.clientY, shiftKey: false }) })
function clearMeasures3(onlyTab) {
  for (const m of [...measures3]) {
    if (onlyTab && m.tab !== onlyTab) continue
    scene.remove(m.line); m.line.geometry.dispose(); for (const d of m.dots) scene.remove(d); m.label.remove()
    measures3.splice(measures3.indexOf(m), 1)
  }
  if (pending3 && (!onlyTab || pending3.tab === onlyTab)) { scene.remove(pending3.dot); pending3 = null; rubber.visible = false }
}
function update3Overlays() {
  const w = host3.clientWidth, h = host3.clientHeight
  const s = pixelWorld(controls.target) * 5
  hoverDot.scale.setScalar(s)
  for (const m of measures3) {
    const vis = mode === '3d' && m.tab?.holder.visible !== false
    m.line.visible = vis; for (const d of m.dots) { d.visible = vis; d.scale.setScalar(s) }
    const mid = m.a.clone().add(m.b).multiplyScalar(.5).project(camera)
    const on = vis && mid.z < 1
    m.label.style.display = on ? '' : 'none'
    if (on) { m.label.style.left = ((mid.x + 1) / 2 * w) + 'px'; m.label.style.top = ((1 - mid.y) / 2 * h) + 'px' }
  }
  if (pending3) pending3.dot.scale.setScalar(s)
  for (const x of pend3pts) x.dot.scale.setScalar(s)
}
let down3 = null
renderer.domElement.addEventListener('pointerdown', e => { down3 = { x: e.clientX, y: e.clientY } })
renderer.domElement.addEventListener('pointerup', e => {
  if (!measuring || mode !== '3d' || !down3 || e.button !== 0) return
  if (Math.hypot(e.clientX - down3.x, e.clientY - down3.y) < 4) onClick3(e)
})
renderer.domElement.addEventListener('pointermove', onMove3)
function animate() { requestAnimationFrame(animate); controls.update(); if (mode === '3d') { update3Overlays(); renderer.render(scene, camera) } }
animate()

// =====================================================================
// 2D（DXF / DWG：mlightcad、SVG：自前）
// =====================================================================
let cad = null, cadLib = null, cadInit = null
async function ensureCad() {
  if (cad) return cad
  if (cadInit) return cadInit
  cadInit = (async () => {
    const [sv, dm, lw] = await Promise.all([
      import('@mlightcad/cad-simple-viewer'),
      import('@mlightcad/data-model'),
      import('@mlightcad/libredwg-converter')
    ])
    cadLib = { sv, dm }
    sv.AcApSettingManager.configure({ storageKey: 'w3v.cad.settings' })
    sv.AcApSettingManager.instance.apply({
      isShowCommandLine: false, isShowRibbon: false, isShowToolbar: false, isShowShortCutToolbar: false,
      isShowLanguageSelector: false, isShowCoordinate: false, isShowEntityInfo: false, isShowStats: false,
      hideTouchPointTutorial: true
    }, { persist: false })
    const dwgWorker = './workers/libredwg-parser-worker.js'
    dm.AcDbDatabaseConverterManager.instance.register(dm.AcDbFileType.DWG,
      new lw.AcDbLibreDwgConverter({ convertByEntityType: false, useWorker: true, parserWorkerUrl: dwgWorker }))
    // フォント（CAD文字用）：同梱が無ければ mlightcad/cad-data の CDN から読む
    let baseUrl = './'
    try { const r = await fetch('./fonts/fonts.json', { method: 'HEAD' }); if (!r.ok) throw 0 } catch { baseUrl = 'https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/' }
    cad = sv.AcApDocManager.createInstance({
      container: $('cad'), autoResize: true, baseUrl, useMainThreadDraw: true, builtinOpenFileDialog: false,
      webworkerFileUrls: { mtextRender: './workers/mtext-renderer-worker.js', dwgParser: dwgWorker }
    })
    // 2D計測：1回測り終えたら、計測モード中は続けて次の計測を始める
    cad.editor.events.commandEnded.addEventListener(() => {
      if (measuring && mode === '2d' && active['2d']?.type !== 'svg') setTimeout(() => { if (measuring) try { cad.sendStringToExecute('measuredistance') } catch {} }, 50)
    })
    return cad
  })()
  return cadInit
}
function setCadBackground(doc) {
  const { dm } = cadLib
  for (const v of ['MODELBKCOLOR', 'PAPERBKCOLOR']) {
    try { const c = new dm.AcCmColor(dm.AcCmColorMethod.ByColor); c.setRGB(0xEE, 0xF3, 0xF8); dm.AcDbSysVarManager.instance().setVar(v, c, doc.database) } catch {}
  }
}
async function addCad(file, meta) {
  showView('2d-cad')
  const m = await ensureCad()
  const buf = await file.arrayBuffer()
  const ok = await m.openDocument(file.name, buf, {})
  if (!ok) throw Error('図面を開けませんでした')
  const doc = m.curDocument
  setCadBackground(doc)
  const t = { id: nextId++, kind: '2d', type: extOf(file.name), name: file.name, file, srvId: meta?.id, path: meta?.path, doc, color: '#5b7a99' }
  tabs['2d'].push(t); active['2d'] = t
  return t
}

// ---------- SVG ----------
const svgView = $('viewsvg'), svgPane = $('svgPane'), svgOv = $('svgOverlay')
const SVG_UNITS = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6, px: 25.4 / 96 }
async function addSvg(file, meta) {
  const text = await file.text()
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const root = doc.documentElement
  if (root.nodeName !== 'svg') throw Error('SVGとして読めません')
  const vb = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
  const len = s => { const m = /^([\d.]+)\s*([a-z]*)$/i.exec(s || ''); return m ? { v: +m[1], u: (m[2] || 'px').toLowerCase() } : null }
  const W = len(root.getAttribute('width')), H = len(root.getAttribute('height'))
  let vw, vh, vx = 0, vy = 0
  if (vb.length === 4 && vb.every(isFinite)) { [vx, vy, vw, vh] = vb } else { vw = W?.v || 300; vh = H?.v || 150 }
  // 1ユーザー単位あたりの mm
  let mmPerUnit = null, unitLabel = 'px'
  if (W && SVG_UNITS[W.u] && W.u !== 'px') { mmPerUnit = W.v * SVG_UNITS[W.u] / vw; unitLabel = 'mm' }
  else if (W && W.u === 'px') { mmPerUnit = null }
  const blob = new Blob([text], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const t = { id: nextId++, kind: '2d', type: 'svg', name: file.name, file, srvId: meta?.id, path: meta?.path, url, vw, vh, vx, vy, mmPerUnit, unitLabel, view: null, measures: [], color: '#9a6bb5' }
  tabs['2d'].push(t); active['2d'] = t
  return t
}
function svgFit(t) {
  const W = svgView.clientWidth, H = svgView.clientHeight
  const s = Math.min(W / t.vw, H / t.vh) * .9
  t.view = { s, x: (W - t.vw * s) / 2, y: (H - t.vh * s) / 2 }
  svgApply(t)
}
function svgApply(t) {
  if (!t.view) svgFit(t)
  const img = svgPane.firstChild
  if (img) { img.style.width = t.vw + 'px'; img.style.height = t.vh + 'px' }
  svgPane.style.transform = `translate(${t.view.x}px,${t.view.y}px) scale(${t.view.s})`
  drawSvgOverlay(t)
}
function svgShow(t) {
  svgPane.innerHTML = ''
  const img = new Image(); img.src = t.url; img.alt = t.name; svgPane.append(img)
  if (!t.view) svgFit(t); else svgApply(t)
}
const svgToScreen = (t, p) => ({ x: t.view.x + (p.x - t.vx) * t.view.s, y: t.view.y + (p.y - t.vy) * t.view.s })
const screenToSvg = (t, x, y) => ({ x: (x - t.view.x) / t.view.s + t.vx, y: (y - t.view.y) / t.view.s + t.vy })
let svgPending = null, svgHover = null
function svgDist(t, a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y)
  return t.mmPerUnit ? fmt(d * t.mmPerUnit) + ' mm' : fmt(d) + ' px'
}
function drawSvgOverlay(t) {
  const NS = 'http://www.w3.org/2000/svg'
  svgOv.innerHTML = ''
  const add = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); svgOv.append(e); return e }
  const seg = (a, b, txt) => {
    const A = svgToScreen(t, a), B = svgToScreen(t, b)
    add('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: '#d9480f', 'stroke-width': 2 })
    for (const P of [A, B]) add('circle', { cx: P.x, cy: P.y, r: 4, fill: '#d9480f' })
    if (txt) {
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 - 10
      const g = add('g', {}); const tx = document.createElementNS(NS, 'text')
      tx.setAttribute('x', mx); tx.setAttribute('y', my); tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('font-size', '12'); tx.setAttribute('font-weight', '600'); tx.setAttribute('fill', '#fff'); tx.textContent = txt
      g.append(tx); svgOv.append(g)
      const bb = tx.getBBox(); const rc = document.createElementNS(NS, 'rect')
      rc.setAttribute('x', bb.x - 6); rc.setAttribute('y', bb.y - 3); rc.setAttribute('width', bb.width + 12); rc.setAttribute('height', bb.height + 6); rc.setAttribute('rx', 5); rc.setAttribute('fill', '#1d2a36e6')
      g.insertBefore(rc, tx)
    }
  }
  for (const m of t.measures) seg(m.a, m.b, svgDist(t, m.a, m.b))
  if (svgPending && svgHover) seg(svgPending, svgHover, svgDist(t, svgPending, svgHover))
  else if (svgPending) { const P = svgToScreen(t, svgPending); add('circle', { cx: P.x, cy: P.y, r: 4, fill: '#d9480f' }) }
}
let svgDrag = null
svgView.addEventListener('pointerdown', e => { const t = active['2d']; if (!t || t.type !== 'svg') return; svgDrag = { x: e.clientX, y: e.clientY, vx: t.view.x, vy: t.view.y, moved: false }; svgView.setPointerCapture(e.pointerId) })
svgView.addEventListener('pointermove', e => {
  const t = active['2d']; if (!t || t.type !== 'svg') return
  const r = svgView.getBoundingClientRect()
  if (svgDrag) {
    const dx = e.clientX - svgDrag.x, dy = e.clientY - svgDrag.y
    if (Math.hypot(dx, dy) > 3) svgDrag.moved = true
    if (svgDrag.moved) { t.view.x = svgDrag.vx + dx; t.view.y = svgDrag.vy + dy; svgApply(t); svgView.style.cursor = 'grabbing' }
  } else if (measuring && svgPending) { svgHover = screenToSvg(t, e.clientX - r.left, e.clientY - r.top); drawSvgOverlay(t) }
})
svgView.addEventListener('pointerup', e => {
  const t = active['2d']; svgView.style.cursor = ''
  if (!t || t.type !== 'svg' || !svgDrag) return
  const moved = svgDrag.moved; svgDrag = null
  if (moved || !measuring || e.button !== 0) return
  const r = svgView.getBoundingClientRect(), p = screenToSvg(t, e.clientX - r.left, e.clientY - r.top)
  if (!svgPending) { svgPending = p; showMeasureInfo('2点目をクリック（Escで中止）') }
  else {
    t.measures.push({ a: svgPending, b: p }); const txt = svgDist(t, svgPending, p); svgPending = null; svgHover = null
    showMeasureInfo('距離 ' + txt + (t.mmPerUnit ? '' : '（この SVG は実寸の単位が書かれていないため px 表示）') + '　続けて1点目をクリック'); setStatus('計測: ' + txt)
  }
  drawSvgOverlay(t)
})
svgView.addEventListener('wheel', e => {
  const t = active['2d']; if (!t || t.type !== 'svg') return
  e.preventDefault()
  const r = svgView.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top
  const k = Math.exp(-e.deltaY * .0015), ns = Math.min(Math.max(t.view.s * k, 1e-4), 1e4)
  t.view.x = mx - (mx - t.view.x) * ns / t.view.s; t.view.y = my - (my - t.view.y) * ns / t.view.s; t.view.s = ns
  svgApply(t)
}, { passive: false })
new ResizeObserver(() => { const t = active['2d']; if (t?.type === 'svg' && mode === '2d') drawSvgOverlay(t) }).observe(svgView)

// =====================================================================
// 共通：タブ・表示切替
// =====================================================================
function showView(v) {
  $('view3d').classList.toggle('hidden', v !== '3d')
  $('view2d').classList.toggle('hidden', v !== '2d-cad')
  $('viewsvg').classList.toggle('hidden', v !== '2d-svg')
}
function currentTab() { return active[mode] }
async function setMode(m) {
  if (measuring) stopMeasure()
  mode = m
  for (const b of document.querySelectorAll('#modeSeg button')) b.classList.toggle('on', b.dataset.mode === m)
  for (const el of document.querySelectorAll('.only3d')) el.classList.toggle('hidden', m !== '3d')
  $('labels').style.display = m === '3d' ? '' : 'none'
  await activate(active[m])
}
async function activate(t) {
  if (t) active[t.kind] = t
  if (mode === '3d') { showView(t ? '3d' : 'none'); layout3(); if (t) focus3(t) }
  else if (!t) showView('none')   // 何も開いていない時は図面の画面も隠してホーム画面だけにする
  else if (t.type === 'svg') { showView('2d-svg'); svgShow(t) }
  else { showView('2d-cad'); if (cad && cad.curDocument !== t.doc) { try { await cad.activateDocument(t.doc) } catch (e) { console.error(e) } } }
  render()
}
function focus3(t) {
  if (layoutEl.value === 'solo') { fit3(); return }
  t.holder.updateMatrixWorld(true); fitBox(new THREE.Box3().setFromObject(t.holder))
}
async function closeTab(t) {
  const list = tabs[t.kind], i = list.indexOf(t); if (i < 0) return
  list.splice(i, 1)
  if (t.kind === '3d') close3d(t)
  else if (t.type === 'svg') URL.revokeObjectURL(t.url)
  else if (cad) { try { await cad.closeDocument(t.doc) } catch (e) { console.error(e) } }
  if (active[t.kind] === t) active[t.kind] = list[Math.min(i, list.length - 1)] || null
  await activate(active[t.kind])
}
function render() {
  // モード切替のカウント
  $('cnt3d').textContent = tabs['3d'].length ? tabs['3d'].length : ''
  $('cnt2d').textContent = tabs['2d'].length ? tabs['2d'].length : ''
  // タブ
  const bar = $('tabs'); bar.innerHTML = ''
  const list = tabs[mode]
  if (!list.length) { const s = document.createElement('span'); s.className = 'empty'; s.textContent = mode === '3d' ? '3Dモデルはまだ開いていません' : '2D図面はまだ開いていません'; bar.append(s) }
  for (const t of list) {
    const el = document.createElement('div'); el.className = 'tab' + (t === active[mode] ? ' on' : '')
    el.dataset.tip = (t.path || t.name)
    el.innerHTML = `<span class="sw"></span><span class="nm"></span><span class="ext"></span><button class="x" data-tip="このタブを閉じる">×</button>`
    el.querySelector('.sw').style.background = t.color
    el.querySelector('.nm').textContent = t.name.replace(/\.[^.]+$/, '')
    el.querySelector('.ext').textContent = t.type.toUpperCase()
    el.onclick = e => { if (e.target.closest('.x')) return; activate(t) }
    el.onauxclick = e => { if (e.button === 1) closeTab(t) }
    el.querySelector('.x').onclick = () => closeTab(t)
    bar.append(el)
  }
  bar.querySelector('.tab.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  // ウェルカム（3Dが空なら台座のグリッドも消す）
  const empty = !list.length
  grid.visible = tabs['3d'].length > 0
  $('welcome').style.display = empty ? '' : 'none'
  $('welcomeTitle').textContent = mode === '3d' ? 'STL / 3MF をここにドロップ' : 'DXF / DWG / SVG をここにドロップ'
  $('hint').textContent = mode === '3d' ? 'ドラッグ: 回転　右ドラッグ: 移動　ホイール: 拡大・縮小' : 'ドラッグ: 移動　ホイール: 拡大・縮小'
  $('hint').style.display = empty ? 'none' : ''
  $('layerSec').classList.toggle('hidden', !(mode === '2d' && active['2d'] && active['2d'].type !== 'svg'))
  $('deepBtn').disabled = !active[mode] || !token
  renderInfo(); renderLayers()
}
function renderInfo() {
  const t = active[mode], dl = $('info'); dl.innerHTML = ''
  const row = (k, v) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd) }
  if (!t) { row('ファイル', '—'); return }
  row('ファイル', t.name)
  row('種類', t.type.toUpperCase())
  row('サイズ', (t.file.size / 1024).toFixed(1) + ' KB')
  if (t.kind === '3d') {
    row('幅 X', fmt(t.size.x) + ' mm'); row('奥行 Y', fmt(t.size.y) + ' mm'); row('高さ Z', fmt(t.size.z) + ' mm')
    row('ポリゴン', t.tris.toLocaleString() + ' 面')
  } else if (t.type === 'svg') {
    row('大きさ', t.mmPerUnit ? `${fmt(t.vw * t.mmPerUnit)} × ${fmt(t.vh * t.mmPerUnit)} mm` : `${fmt(t.vw)} × ${fmt(t.vh)} px`)
  } else {
    try {
      const db = t.doc.database, ext = db.extmax && db.extmin ? { w: db.extmax.x - db.extmin.x, h: db.extmax.y - db.extmin.y } : null
      if (ext && isFinite(ext.w) && ext.w > 0) row('図面範囲', `${fmt(ext.w)} × ${fmt(ext.h)}`)
    } catch {}
  }
  if (t.path) row('場所', t.path)
}
function renderLayers() {
  const t = active['2d'], ul = $('layers'); ul.innerHTML = ''
  if (mode !== '2d' || !t || t.type === 'svg') return
  let layers = []
  try { layers = t.doc.layerStore.getLayers() } catch {}
  if (!layers.length) { ul.innerHTML = '<li class="empty">レイヤーがありません</li>'; return }
  for (const L of layers) {
    const li = document.createElement('li')
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = L.isOn && !L.isFrozen
    cb.onchange = () => { try { t.doc.layerStore.setLayerOn(L.name, cb.checked) } catch (e) { console.error(e) } }
    const sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = L.cssColor || '#888'
    const n = document.createElement('span'); n.className = 'n'; n.textContent = L.name; n.dataset.tip = L.name
    li.append(cb, sw, n); ul.append(li)
  }
}
$('layersAllOn').onclick = () => { const t = active['2d']; try { t.doc.layerStore.setAllLayersOn() } catch {} renderLayers() }
for (const b of document.querySelectorAll('#modeSeg button')) b.onclick = () => setMode(b.dataset.mode)
layoutEl.onchange = () => { layout3(); fit3(); render() }

// ---------- 全体表示 ----------
function fitCurrent() {
  const t = active[mode]; if (!t) return
  if (mode === '3d') fit3()
  else if (t.type === 'svg') svgFit(t)
  else try { cad.curView.zoomToFitDrawing() } catch (e) { console.error(e) }
}
$('fitBtn').onclick = fitCurrent

// ---------- 計測 ----------
function showMeasureInfo(t) { const el = $('measureInfo'); el.textContent = t; el.classList.remove('hidden') }
function startMeasure() {
  const t = active[mode]; if (!t) { toast('先にファイルを開いてください'); return }
  measuring = true; $('measureBtn').classList.add('on'); document.body.classList.add('measuring')
  if (mode === '3d') { controls.enabled = true; showMeasureInfo(measureKind === 'circle3' ? '円のふちを3点クリック　Escで終了' : '1点目をクリック（緑＝角、青＝辺、紫＝円のふち→クリックで直径）　Escで終了'); updateCoords(null) }
  else if (t.type === 'svg') { svgPending = null; showMeasureInfo('1点目をクリック　Escで終了') }
  else { showMeasureInfo('2点をクリックすると長さが出ます（線の端点・中点に吸着）　Escで終了'); try { cad.sendStringToExecute('measuredistance') } catch (e) { console.error(e) } }
}
function stopMeasure() {
  const was2dCad = mode === '2d' && active['2d'] && active['2d'].type !== 'svg'
  measuring = false
  if (was2dCad && cad) try { cad.editor.cancel?.() } catch {}
 ; $('measureBtn').classList.remove('on'); document.body.classList.remove('measuring')
  $('measureInfo').classList.add('hidden'); hoverDot.visible = false
  if (pending3) { scene.remove(pending3.dot); pending3 = null }
  for (const x of pend3pts) scene.remove(x.dot); pend3pts = []; previewRing.visible = false
  rubber.visible = false; $('coordPanel').classList.add('hidden')
  svgPending = null; svgHover = null
  const t = active['2d']; if (t?.type === 'svg') drawSvgOverlay(t)
}
$('measureBtn').onclick = () => { if (measuring && measureKind === 'dist') return stopMeasure(); if (measuring) stopMeasure(); measureKind = 'dist'; startMeasure() }
$('clearMeasureBtn').onclick = () => {
  const t = active[mode]; if (!t) return
  if (mode === '3d') clearMeasures3()
  else if (t.type === 'svg') { t.measures = []; drawSvgOverlay(t) }
  else try { cad.sendStringToExecute('clearmeasurements') } catch (e) { console.error(e) }
  setStatus('計測結果を消しました')
}

// =====================================================================
// ファイルの受け入れ
// =====================================================================
async function openFile(file, meta) {
  const kind = KIND(file.name)
  if (!kind) { setStatus('対応していない形式です: ' + file.name); return null }
  setStatus('読み込み中… ' + file.name)
  if (mode !== kind) await setMode(kind)
  const t0 = performance.now()
  try {
    let t
    if (kind === '3d') t = await add3d(file, meta)
    else if (extOf(file.name) === 'svg') t = await add2dSvg(file, meta)
    else t = await addCad(file, meta)
    await activate(t)
    if (kind === '3d') fit3()
    setStatus(`${t.name} を開きました（${Math.round(performance.now() - t0)} ms）`)
    return t
  } catch (e) {
    console.error(e); setStatus('読み込みに失敗しました: ' + file.name + ' – ' + (e.message || e)); toast('読み込みに失敗: ' + file.name)
    return null
  }
}
const add2dSvg = addSvg
let queue = Promise.resolve()
function openFiles(files) { for (const f of files) queue = queue.then(() => openFile(f)); return queue }

// フォルダ一覧
let folderFiles = []
function showFolder(files) {
  folderFiles = files.filter(f => KIND(f.name)).sort((a, b) => (a.webkitRelativePath || a._path || a.name).localeCompare(b.webkitRelativePath || b._path || b.name, 'ja'))
  const ul = $('folder'); ul.innerHTML = ''
  if (!folderFiles.length) { ul.innerHTML = '<li class="empty">対応ファイルが見つかりません</li>'; return }
  for (const f of folderFiles) {
    const li = document.createElement('li'); const p = f.webkitRelativePath || f._path || f.name
    li.innerHTML = `<span class="k">${KIND(f.name).toUpperCase()}</span>`; li.append(p.split('/').slice(1).join('/') || p)
    li.dataset.tip = p; li.onclick = () => { li.classList.add('on'); openFiles([f]) }; ul.append(li)
  }
  setStatus('フォルダ内に ' + folderFiles.length + ' 件（クリックで開く）')
}
$('file').addEventListener('change', e => { openFiles([...e.target.files]); e.target.value = '' })
$('dir').addEventListener('change', e => { showFolder([...e.target.files]); e.target.value = '' })
$('loadAll').onclick = () => openFiles(folderFiles)
const openMenu = $('openMenu')
$('openBtn').onclick = e => { e.stopPropagation(); openMenu.classList.toggle('open') }
openMenu.onclick = () => openMenu.classList.remove('open')
addEventListener('click', e => { if (!openMenu.contains(e.target)) openMenu.classList.remove('open') })
addEventListener('paste', e => { const fs = [...(e.clipboardData?.files || [])].filter(f => KIND(f.name)); if (fs.length) { e.preventDefault(); openFiles(fs) } })
addEventListener('keydown', e => {
  if (e.target.closest?.('input,select,textarea,dialog')) return
  if (e.key === 'Escape') { openMenu.classList.remove('open'); if (measuring) stopMeasure() }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); $('file').click() }
  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.key === 'f' || e.key === 'F') fitCurrent()
    if (e.key === 'm' || e.key === 'M') $('measureBtn').click()
  }
})

// ドラッグ＆ドロップ
let dragDepth = 0
addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; document.body.classList.add('dragging') })
addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging') } })
addEventListener('dragover', e => e.preventDefault())
function readEntry(entry, path = '') {
  return new Promise(res => {
    if (entry.isFile) entry.file(f => { f._path = path + f.name; res([f]) }, () => res([]))
    else if (entry.isDirectory) {
      const r = entry.createReader(), all = []
      const next = () => r.readEntries(async ents => { if (!ents.length) { const out = []; for (const en of all) out.push(...await readEntry(en, path + entry.name + '/')); res(out) } else { all.push(...ents); next() } }, () => res([]))
      next()
    } else res([])
  })
}
addEventListener('drop', async e => {
  e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging')
  const items = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry?.()).filter(Boolean)
  if (items.some(en => en.isDirectory)) {
    const files = []; for (const en of items) files.push(...await readEntry(en))
    if (items.length === 1) showFolder(files); else openFiles(files)
  } else openFiles([...e.dataTransfer.files])
})

// ---------- チャットに渡す（web3d:// リンク） ----------
async function copyText(t) { try { await navigator.clipboard.writeText(t) } catch { const a = document.createElement('textarea'); a.value = t; document.body.append(a); a.select(); document.execCommand('copy'); a.remove() } }
$('deepBtn').onclick = async () => {
  const t = active[mode]; if (!t || !token) return
  const q = encodeURIComponent(token)
  try {
    let r
    if (t.srvId) r = await fetch('/api/snapshot?token=' + q + '&id=' + t.srvId, { cache: 'no-store' })
    else r = await fetch('/api/import?token=' + q + '&name=' + encodeURIComponent(t.name), { method: 'POST', body: t.file, cache: 'no-store' })
    if (!r.ok) throw Error('控えを作成できません')
    const j = await r.json(); if (j.id) t.srvId = j.id
    await copyText(j.link); toast('リンクをコピーしました（控え: ' + j.name + '）')
  } catch (err) { toast('コピーに失敗: ' + err.message) }
}

// ---------- 起動役（launcher.pyw）から渡されたファイル ----------
if (token) {
  const q = encodeURIComponent(token), baseTitle = document.title
  let busy = false
  const poll = async () => {
    if (busy) return; busy = true
    try {
      const r = await fetch('/api/next?token=' + q, { cache: 'no-store' }); if (!r.ok) return
      const list = await r.json()
      for (const it of list) {
        const m = await fetch('/api/model?token=' + q + '&id=' + it.id, { cache: 'no-store' })
        if (!m.ok) { setStatus('読み込みに失敗しました: ' + it.name); continue }
        const f = new File([await m.arrayBuffer()], it.name)
        await (queue = queue.then(() => openFile(f, it)))
      }
      if (list.length && document.hidden) { document.title = '● 追加: ' + list.at(-1).name; window.focus() }
    } catch {} finally { busy = false }
  }
  poll(); setInterval(poll, 1000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) document.title = baseTitle })
}
// 開発・確認用: ?file=URL
for (const u of params.getAll('file')) {
  queue = queue.then(async () => {
    try { const r = await fetch(u); if (!r.ok) throw Error(r.status); await openFile(new File([await r.arrayBuffer()], decodeURIComponent(u.split('/').pop()))) }
    catch (e) { setStatus('URLから読み込めません: ' + u) }
  })
}
queue.then(() => { window.__ready = true })
render()
window.__app = { tabs, active, setMode, activate, get cad() { return cad }, startMeasure, stopMeasure }
