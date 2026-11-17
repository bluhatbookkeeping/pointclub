// Reads screenshots entirely in the browser. The image is never uploaded, and the reader's own files are
// served by Point Club itself (public/ocr), so it also works on networks that block outside CDNs.
import type { Worker } from 'tesseract.js'

let workerPromise: Promise<Worker> | null = null
let progressCb: ((p: number) => void) | undefined

function getWorker() {
  workerPromise ??= (async () => {
    const { createWorker, PSM } = await import('tesseract.js')
    const w = await createWorker('eng', 1, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr/',
      langPath: '/ocr',
      logger: (m: { status: string; progress: number }) => { if (m.status === 'recognizing text') progressCb?.(m.progress) },
    })
    // Treat the screenshot as one block of text lines (a table of rows).
    await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1' })
    return w
  })().catch((e) => { workerPromise = null; throw e })
  return workerPromise
}

/** Small UI text reads much better at 2-3x size, in grayscale, with stronger contrast. */
async function prepare(file: Blob): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file)
  const scale = bmp.width < 1600 ? 3 : 2
  const c = document.createElement('canvas')
  c.width = bmp.width * scale; c.height = bmp.height * scale
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.filter = 'grayscale(1) contrast(1.4)'
  ctx.drawImage(bmp, 0, 0, c.width, c.height)
  return c
}

export async function readImage(file: File | Blob, onProgress?: (p: number) => void): Promise<string> {
  progressCb = onProgress
  const [w, canvas] = await Promise.all([getWorker(), prepare(file)])
  const { data } = await w.recognize(canvas)
  return data.text
}
