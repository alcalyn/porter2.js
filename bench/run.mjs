// Benchmark runner.
//
//   node bench/run.mjs                     # benchmark ../dist/index.js
//   LIBRARY=stemr node bench/run.mjs       # benchmark another library
//   TRIALS=20 WARMUP=5 node bench/run.mjs  # tune trial/warmup counts
//   WORDS=200000 node bench/run.mjs        # use a smaller slice of the set

const LIBRARY_NAME = process.env.LIBRARY ?? '../dist/index.js'
const WARMUP = Number(process.env.WARMUP ?? 3)
const TRIALS = Number(process.env.TRIALS ?? 10)

console.error(`Importing ${LIBRARY_NAME}`)
let stem = await import(LIBRARY_NAME)
switch (LIBRARY_NAME) {
  case 'wink-porter2-stemmer':
  case '@stdlib/nlp-porter-stemmer':
    stem = stem.default
    break
  case 'porter-stemmer-js':
    stem = stem.PorterStemmer
    break
  case 'porter-stemmer':
  case 'stemmer':
    stem = stem.stemmer
    break
  default:
    stem = stem.stem
}

import { words } from './bench-set.js'

const n = Math.min(words.length, Number(process.env.WORDS ?? words.length))

let sink = 0

function pass() {
  let local = 0
  const start = performance.now()
  for (let i = 0; i < n; ++i) local += stem(words[i]).length
  const elapsed = performance.now() - start
  sink += local
  return elapsed
}

console.error(`Warming up (${WARMUP} passes of ${n} words)`)
for (let w = 0; w < WARMUP; ++w) pass()

console.error(`Benchmarking (${TRIALS} trials)`)
const times = []
for (let t = 0; t < TRIALS; ++t)
  times.push(pass())

times.sort((a, b) => a - b)
const min = times[0]
const max = times[times.length - 1]
const mid = times.length >> 1
const median = times.length % 2 ? times[mid] : (times[mid - 1] + times[mid]) / 2
const mean = times.reduce((a, b) => a + b, 0) / times.length
const stdev = Math.sqrt(times.reduce((a, b) => a + (b - mean) ** 2, 0) / times.length)

// thousand ops per second
const kops = ms => (n / ms).toFixed(2)

// "use" the sink
if (sink < 0) console.error('unreachable', sink)

console.error('')
console.error(`max    ${kops(min)}k ops/s  (${min.toFixed(3)}ms)`)
console.error(`median ${kops(median)}k ops/s  (${median.toFixed(3)}ms)`)
console.error(`min    ${kops(max)}k ops/s  (${max.toFixed(3)}ms)`)
console.error(`spread ±${(stdev / mean * 100).toFixed(1)}% over ${TRIALS} trials`)

// Machine-readable json output
if (process.env.JSON)
  console.log(JSON.stringify({
    name: LIBRARY_NAME,
    words: n,
    trials: TRIALS,
    minMs: min,
    medianMs: median,
    maxMs: max,
    kopsMax: n / min,
    kopsMedian: n / median,
    kopsMin: n / max,
    spreadPct: stdev / mean * 100
  }))
