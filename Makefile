.PHONY: build test lint

build: dist/index.js

dist/index.js: src/index.js preprocess.js
	node preprocess.js

test: dist/index.js
	node test/run.mjs

lint:
	npx tsc
