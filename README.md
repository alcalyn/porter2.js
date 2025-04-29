# porter2 &nbsp; [![npm](https://img.shields.io/npm/v/porter2.svg)](https://www.npmjs.com/package/porter2) [![CI](https://github.com/eilvelia/porter2.js/actions/workflows/ci.yml/badge.svg)](https://github.com/eilvelia/porter2.js/actions/workflows/ci.yml)

Fast JavaScript implementation of the [porter2] English [stemming] algorithm.

```console
$ npm install porter2
```

[porter2]: https://snowballstem.org/algorithms/english/stemmer.html
[stemming]: https://en.wikipedia.org/wiki/Stemming

## Usage

The package is simple: it has no dependencies and exports a single function
named `stem`.

Import using CommonJS:

```javascript
const { stem } = require('porter2')
```

Or, import using EcmaScript Modules (through interopability with CommonJS):

```javascript
import { stem } from 'porter2'
```

Use the stemmer:

```javascript
const word = stem('animadversion')
console.log(word) //=> animadvers
```

This stemmer expects a lowercase English word.

The code is compatible with ES5. TypeScript type declarations are included.

## Benchmarks

On my machine, the 29.4k test suite executes in ~5.25ms (~5.6M/s throughput) in
a hot loop (~31ms for the first run).

Here is a comparison with some other libraries (you probably should take it with
a little grain of salt):

| library                              | throughput (node) | throughput (bun) |
| ------------------------------------ | ----------------- | ---------------- |
| porter2 1.0.3                        | 5621 kops/s       | 6780 kops/s      |
| [stemr][] 1.0.0                      | 840 kops/s        | 920 kops/s       |
| [wink-porter2-stemmer][] [^1] 2.0.1  | 340 kops/s        | 420 kops/s       |

[stemr]: https://github.com/localvoid/stemr
[wink-porter2-stemmer]: https://github.com/winkjs/wink-porter2-stemmer

Here are libraries that implement older porter version 1 (note the behavior is
not identical):

| library                              | throughput (node) | throughput (bun) |
| ------------------------------------ | ----------------- | ---------------- |
| [porter-stemmer-js][] [^2] 1.1.2     | 3280 kops/s       | 3373 kops/s      |
| [stemmer][] [^3] 2.0.1               | 2100 kops/s       | 1549 kops/s      |
| [@stdlib/nlp-porter-stemmer][] 0.2.2 | 1712 kops/s       | 1604 kops/s      |
| [porter-stemmer][] 0.9.1             | 951 kops/s        | 1264 kops/s      |

[porter-stemmer-js]: https://github.com/evi1Husky/PorterStemmer
[stemmer]: https://github.com/words/stemmer
[@stdlib/nlp-porter-stemmer]: https://github.com/stdlib-js/nlp-porter-stemmer
[porter-stemmer]: https://github.com/jedp/porter-stemmer

The benchmark code is in `bench/run.mjs`. This is tested with Node.js v22.14.0
and bun v1.2.10 on Zen 3 (4.5 GHz boosted). The library versions are latest as
of 2025-04-29.

[^1]: `wink-porter2-stemmer` is 99.97% porter2 compliant (fails on `'` cases only)

[^2]: That one has similar goals and, surprisingly, was published just 3 days
before this package! (And after the author started working on porter2.js.)

[^3]: ESM only
