import { mmToPx } from './presets.js'

/**
 * transform: { x, y, scale } —— 以成品像素为坐标系，
 * 抠图结果按 scale 缩放后左上角位于 (x, y)。
 * paintCanvas：可选的用户修补层（与成品同尺寸），叠在抠图结果之上。
 */
export function composeIdPhoto({ cutout, transform, bg, wPx, hPx, paintCanvas = null }) {
  const canvas = document.createElement('canvas')
  canvas.width = wPx
  canvas.height = hPx
  const ctx = canvas.getContext('2d')
  if (bg) {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, wPx, hPx)
  }
  ctx.drawImage(
    cutout,
    transform.x,
    transform.y,
    cutout.width * transform.scale,
    cutout.height * transform.scale,
  )
  if (paintCanvas) {
    ctx.drawImage(paintCanvas, 0, 0)
  }
  return canvas
}

/** 由人物包围盒计算初始构图：水平居中，头顶距上沿约 6% */
export function computeInitialTransform(bbox, cutW, cutH, photoW, photoH) {
  if (!bbox) {
    const scale = photoH / cutH
    return { x: (photoW - cutW * scale) / 2, y: 0, scale }
  }
  let scale = (photoH * 0.85) / bbox.h
  if (bbox.w * scale > photoW * 0.9) {
    scale = (photoW * 0.9) / bbox.w
  }
  const cx = bbox.x + bbox.w / 2
  return {
    x: photoW / 2 - cx * scale,
    y: photoH * 0.06 - bbox.y * scale,
    scale,
  }
}

/**
 * 计算排版网格。
 * @returns { cols, rows, count, startX, startY, paperWPx, paperHPx, photoWPx, photoHPx }
 */
export function calcGrid({ paperMm, photoMm, dpi, marginMm, gapMm, landscape }) {
  let paperWMm = paperMm.wMm
  let paperHMm = paperMm.hMm
  if (landscape) [paperWMm, paperHMm] = [paperHMm, paperWMm]

  const paperWPx = mmToPx(paperWMm, dpi)
  const paperHPx = mmToPx(paperHMm, dpi)
  const photoWPx = mmToPx(photoMm.wMm, dpi)
  const photoHPx = mmToPx(photoMm.hMm, dpi)
  const marginPx = mmToPx(marginMm, dpi)
  const gapPx = mmToPx(gapMm, dpi)

  const cols = Math.floor((paperWPx - 2 * marginPx + gapPx) / (photoWPx + gapPx))
  const rows = Math.floor((paperHPx - 2 * marginPx + gapPx) / (photoHPx + gapPx))
  if (cols <= 0 || rows <= 0) return null

  const contentW = cols * photoWPx + (cols - 1) * gapPx
  const contentH = rows * photoHPx + (rows - 1) * gapPx
  return {
    cols,
    rows,
    count: cols * rows,
    startX: Math.round((paperWPx - contentW) / 2),
    startY: Math.round((paperHPx - contentH) / 2),
    gapPx,
    paperWPx,
    paperHPx,
    photoWPx,
    photoHPx,
  }
}

export function renderLayout(photoCanvas, grid, { dpi, cutLines }) {
  const canvas = document.createElement('canvas')
  canvas.width = grid.paperWPx
  canvas.height = grid.paperHPx
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const x = grid.startX + c * (grid.photoWPx + grid.gapPx)
      const y = grid.startY + r * (grid.photoHPx + grid.gapPx)
      ctx.drawImage(photoCanvas, x, y, grid.photoWPx, grid.photoHPx)
      if (cutLines) {
        drawCutLines(ctx, x, y, grid.photoWPx, grid.photoHPx, dpi)
      }
    }
  }
  return canvas
}

function drawCutLines(ctx, x, y, w, h, dpi) {
  const len = Math.max(6, Math.round(dpi * 0.12))
  const offset = Math.max(2, Math.round(dpi * 0.02))
  ctx.strokeStyle = '#9CA3AF'
  ctx.lineWidth = Math.max(1, Math.round(dpi * 0.004))
  ctx.beginPath()
  const corners = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ]
  for (const [cx, cy] of corners) {
    const dx = cx === x ? -1 : 1
    const dy = cy === y ? -1 : 1
    ctx.moveTo(cx + dx * offset, cy)
    ctx.lineTo(cx + dx * (offset + len), cy)
    ctx.moveTo(cx, cy + dy * offset)
    ctx.lineTo(cx, cy + dy * (offset + len))
  }
  ctx.stroke()
}
