function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片编码失败'))),
      type,
      quality,
    )
  })
}

/**
 * 导出 JPEG 且不超过 maxKB。
 * 策略：quality 二分取满足上限的最大画质；最低画质仍超限时按 0.9× 逐步降像素。
 * 返回 { blob, quality, width, height, downscaled }。
 */
export async function toJpegUnderKb(canvas, maxKB) {
  let current = canvas
  let downscaled = false

  for (let round = 0; round < 8; round++) {
    let lo = 0.05
    let hi = 0.95
    let best = null

    for (let i = 0; i < 7; i++) {
      const q = (lo + hi) / 2
      const blob = await canvasToBlob(current, 'image/jpeg', q)
      if (blob.size <= maxKB * 1024) {
        best = { blob, quality: q }
        lo = q
      } else {
        hi = q
      }
    }

    if (best) {
      return { ...best, width: current.width, height: current.height, downscaled }
    }

    const w = Math.round(current.width * 0.9)
    const h = Math.round(current.height * 0.9)
    const next = document.createElement('canvas')
    next.width = w
    next.height = h
    next.getContext('2d').drawImage(current, 0, 0, w, h)
    current = next
    downscaled = true
  }

  const blob = await canvasToBlob(current, 'image/jpeg', 0.05)
  return { blob, quality: 0.05, width: current.width, height: current.height, downscaled: true }
}

export function exportCanvas(canvas, { format, jpegQuality = 0.92 }) {
  const type = format === 'png' ? 'image/png' : 'image/jpeg'
  return canvasToBlob(canvas, type, format === 'png' ? undefined : jpegQuality)
}

/** 纯 ASCII 文件名，规避部分网报系统对中文文件名的限制 */
export function buildFilename({ wMm, hMm, dpi, bgName, width, height, ext = 'jpg' }) {
  const bg = bgName ? `_${bgName}` : '_transparent'
  return `idphoto_${wMm}x${hMm}mm_${dpi}dpi${bg}_${width}x${height}.${ext}`
}

export function buildLayoutFilename({ paperName, count, wMm, hMm, dpi }) {
  return `layout_${paperName}_${count}x_idphoto_${wMm}x${hMm}mm_${dpi}dpi.jpg`
}
