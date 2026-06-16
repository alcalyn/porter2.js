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

function version(name) {
  try {
    const pkg = name === '../dist/index.js'
      ? path.join(__dirname, '..', 'package.json')
      : path.join(__dirname, '..', 'node_modules', name, 'package.json')
    return JSON.parse(fs.readFileSync(pkg)).version
  } catch {
    return ''
  }
}

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
const slowerStr = ratio => (ratio < 10 ? ratio.toFixed(2) : ratio.toFixed(0)) + '×'

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

// another combined markdown table
const byName = new Map()
for (const rt of runtimes)
  for (const r of results[rt.name]) {
    if (!byName.has(r.name)) byName.set(r.name, {})
    byName.get(r.name)[rt.name] = r.kopsMax
  }

const entries = [...byName.entries()].sort((a, b) => (b[1].node ?? 0) - (a[1].node ?? 0))
if (entries.length) {
  const ref = Math.max(...entries.map(([, v]) => v.node ?? v.bun ?? 0))
  const thru = v => v == null ? '' : `${v.toFixed(0)} kops/s`
  const cols = [
    ['library', ([name]) => `${label(name)} ${version(name)}`.trim()],
    ['throughput (node)', ([, v]) => thru(v.node)],
    ['throughput (bun)', ([, v]) => thru(v.bun)],
    ['slower', ([, v]) => v.node || v.bun ? slowerStr(ref / (v.node ?? v.bun)) : '']
  ]
  const cells = entries.map(e => cols.map(([, f]) => f(e)))
  const widths = cols.map(([h], i) => Math.max(h.length, ...cells.map(row => row[i].length)))
  const line = arr => '| ' + arr.map((c, i) => c.padEnd(widths[i])).join(' | ') + ' |'
  console.log('')
  console.log(line(cols.map(([h]) => h)))
  console.log(line(widths.map(w => '-'.repeat(w))))
  for (const row of cells) console.log(line(row))
}
