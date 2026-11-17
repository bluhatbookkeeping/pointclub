// Copies the screenshot reader (Tesseract) into public/ocr so it works without any outside CDN,
// e.g. on a company network or VPN. Runs before dev and build; the files are not committed.
import { copyFileSync, mkdirSync } from 'node:fs'
const out = 'public/ocr'
mkdirSync(out, { recursive: true })
const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
]
for (const [from, to] of files) copyFileSync(from, `${out}/${to}`)
console.log(`OCR files copied to ${out}`)
