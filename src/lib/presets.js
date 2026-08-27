export const MM_PER_INCH = 25.4

export function mmToPx(mm, dpi) {
  return Math.round((mm / MM_PER_INCH) * dpi)
}

export const DPI_OPTIONS = [150, 300, 600]
export const DEFAULT_DPI = 300

export const SIZE_PRESETS = [
  { id: 'one', name: '一寸', wMm: 25, hMm: 35 },
  { id: 'large-one', name: '大一寸', wMm: 33, hMm: 48 },
  { id: 'small-one', name: '小一寸', wMm: 22, hMm: 32 },
  { id: 'two', name: '二寸', wMm: 35, hMm: 49 },
  { id: 'small-two', name: '小二寸', wMm: 35, hMm: 45 },
  { id: 'large-two', name: '大二寸', wMm: 35, hMm: 53 },
  { id: 'passport', name: '护照/签证', wMm: 33, hMm: 48 },
]

export const CUSTOM_MM_MIN = 10
export const CUSTOM_MM_MAX = 100

export const BG_PRESETS = [
  { id: 'white', name: '白色', value: '#FFFFFF' },
  { id: 'red', name: '红色', value: '#FF0000' },
  { id: 'blue', name: '蓝色', value: '#438EDB' },
  { id: 'deep-blue', name: '深蓝', value: '#2E59A7' },
  { id: 'light-blue', name: '浅蓝', value: '#A9C9EA' },
  { id: 'gray', name: '灰色', value: '#CCCCCC' },
]

export const BG_TRANSPARENT = { id: 'transparent', name: '透明底', value: null }

export const PAPER_PRESETS = [
  { id: 'five', name: '5寸', wMm: 89, hMm: 127 },
  { id: 'six', name: '6寸', wMm: 102, hMm: 152 },
  { id: 'seven', name: '7寸', wMm: 127, hMm: 178 },
  { id: 'a4', name: 'A4', wMm: 210, hMm: 297 },
]

// iOS Safari canvas 面积上限约 16.7MP，留有余量
export const MAX_CANVAS_AREA = 16 * 1024 * 1024

export function withinCanvasLimit(wPx, hPx) {
  return wPx * hPx <= MAX_CANVAS_AREA
}

export function findSizePreset(id) {
  return SIZE_PRESETS.find((p) => p.id === id) || null
}

export function findPaperPreset(id) {
  return PAPER_PRESETS.find((p) => p.id === id) || null
}
