// Run the benchmarks for all libraries
// Optional env variables: RUNTIMES, LIBRARIES.

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const runner = path.join(__dirname, 'run.mjs')

const DEFAULT_LIBS = [
  '../dist/index.js',
  'stemr',
  'wink-porter2-stemmer',
  '@stdlib/nlp-porter-stemmer',
  'porter-stemmer',
  'porter-stemmer-js',
  'stemmer'
]
const libs = process.env.LIBRARIES
  ? process.env.LIBRARIES.split(',').map(s => s.trim()).filter(Boolean)
  : DEFAULT_LIBS

const label = name => name === '../dist/index.js' ? 'porter2' : name

// node is this process's binary; bun is taken from PATH
const runtimeVersion = cmd => {
  try {
    const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' })
    return r.status === 0 ? r.stdout.trim() : null
  } catch { return null }
}
let runtimes = [
  { name: 'node', cmd: process.execPath, args: [] },
  { name: 'bun', cmd: 'bun', args: [] }
].map(rt => ({ ...rt, version: runtimeVersion(rt.cmd) }))
  .filter(rt => rt.name === 'node' || rt.version != null)
if (process.env.RUNTIMES) {
  const want = process.env.RUNTIMES.split(',').map(s => s.trim())
  runtimes = runtimes.filter(rt => want.includes(rt.name))
}
console.error(`Runtimes: ${runtimes.map(r => r.name).join(', ')}`)
console.error(`Versions: ${runtimes.map(r => `${r.name} ${r.version ?? '?'}`).join(', ')}`)

const results = {}
for (const rt of runtimes) {
  results[rt.name] = []
  for (const lib of libs) {
    console.error(`\n========== [${rt.name}] ${label(lib)} ==========`)
    const res = spawnSync(rt.cmd, [...rt.args, runner], {
      stdio: ['inherit', 'pipe', 'inherit'],
      encoding: 'utf8',
      env: { ...process.env, LIBRARY: lib, JSON: '1' }
    })
    if (res.status !== 0) {
      console.error(`  skipped: exited with code ${res.status}`)
      continue
    }
    const line = (res.stdout || '').trim().split('\n').filter(Boolean).pop()
    try { results[rt.name].push(JSON.parse(line)) } catch { console.error('  skipped: no parseable result') }
  }
}

const fmt = (x, w) => String(x).padStart(w)
const slowerStr = ratio => ratio.toFixed(3) + '×'

// one table per runtime
function printTable(name, rs) {
  if (!rs || rs.length === 0) { console.error(`\n=== ${name} ===\n(no results)`); return }
  const sorted = [...rs].sort((a, b) => b.kopsMax - a.kopsMax)
  const top = sorted[0].kopsMax
  const rows = sorted.map(r => ({
    lib: label(r.name),
    max: r.kopsMax.toFixed(0),
    median: r.kopsMedian.toFixed(0),
    spread: '±' + r.spreadPct.toFixed(1) + '%',
    slower: slowerStr(top / r.kopsMax)
  }))
  const wLib = Math.max(7, ...rows.map(r => r.lib.length))
  const wMax = Math.max(10, ...rows.map(r => r.max.length))
  const wMed = Math.max(13, ...rows.map(r => r.median.length))
  const wSlow = Math.max(6, ...rows.map(r => r.slower.length))
  console.error(`\n=== ${name} ===`)
  console.error(`${'library'.padEnd(wLib)}  ${fmt('max kops/s', wMax)}  ${fmt('median kops/s', wMed)}  spread   ${fmt('slower', wSlow)}`)
  console.error('-'.repeat(wLib + wMax + wMed + wSlow + 14))
  for (const r of rows)
    console.error(`${r.lib.padEnd(wLib)}  ${fmt(r.max, wMax)}  ${fmt(r.median, wMed)}  ${r.spread.padEnd(6)}  ${fmt(r.slower, wSlow)}`)
}
for (const rt of runtimes) printTable(rt.name, results[rt.name])

const byName = new Map()
for (const rt of runtimes)
  for (const r of results[rt.name]) {
    if (!byName.has(r.name)) byName.set(r.name, {})
    byName.get(r.name)[rt.name] = r.kopsMax
  }
const ref = Math.max(0, ...[...byName.values()].map(v => v.node ?? v.bun ?? 0))

if (process.argv.includes('--update-readme')) updateReadme()

// Match a README library cell to a benchmarked library: porter2 is plain text,
// the rest are link references `[name][]`
function matchLib(cell) {
  const t = cell.trim()
  for (const name of byName.keys()) {
    if (name === '../dist/index.js') { if (/^porter2\b/.test(t)) return name }
    else if (cell.includes(`[${name}]`)) return name
  }
  return null
}

// Update the values in the README's benchmark table
function updateReadme() {
  const readmePath = path.join(__dirname, '..', 'README.md')
  const lines = fs.readFileSync(readmePath, 'utf8').split('\n')
  const changes = []
  let i = 0
  while (i < lines.length) {
    if (!/^\s*\|/.test(lines[i])) { i++; continue }
    let j = i
    while (j < lines.length && /^\s*\|/.test(lines[j])) j++
    const rewritten = rewriteTable(lines.slice(i, j), changes)
    if (rewritten) lines.splice(i, j - i, ...rewritten)
    i = j
  }
  fs.writeFileSync(readmePath, lines.join('\n'))
  console.error(`\nUpdated ${path.relative(process.cwd(), readmePath)}`)
}

function rewriteTable(block, changes) {
  if (block.length < 3) return null
  const cellsOf = row => row.split('|').slice(1, -1).map(c => c.trim())
  const headers = cellsOf(block[0])
  const libIdx = headers.indexOf('library')
  const nodeIdx = headers.indexOf('throughput (node)')
  const bunIdx = headers.indexOf('throughput (bun)')
  const slowerIdx = headers.indexOf('slower')
  if (libIdx < 0 || (nodeIdx < 0 && bunIdx < 0)) return null // not a benchmark table

  const rows = block.slice(2).map(cellsOf) // skip header + separator
  for (const cells of rows) {
    const name = matchLib(cells[libIdx])
    if (!name) continue
    const v = byName.get(name)
    const parts = []
    if (v.node != null && nodeIdx >= 0) { cells[nodeIdx] = `${Math.round(v.node)} kops/s`; parts.push(`node ${Math.round(v.node)}`) }
    if (v.bun != null && bunIdx >= 0) { cells[bunIdx] = `${Math.round(v.bun)} kops/s`; parts.push(`bun ${Math.round(v.bun)}`) }
    if (slowerIdx >= 0 && (v.node != null || v.bun != null)) cells[slowerIdx] = slowerStr(ref / (v.node ?? v.bun))
    changes.push(`${label(name)}: ${parts.join(', ')}`)
  }

  const floor = cellsOf(block[1]).map(s => s.length)
  const widths = headers.map((h, c) => Math.max(floor[c] ?? 0, h.length, ...rows.map(r => (r[c] ?? '').length)))
  const render = cells => '| ' + widths.map((w, c) => (cells[c] ?? '').padEnd(w)).join(' | ') + ' |'
  return [render(headers), render(widths.map(w => '-'.repeat(w))), ...rows.map(render)]
}
