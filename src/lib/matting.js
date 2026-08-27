let tf = null
let model = null
let processor = null
let loadPromise = null

// 传给 from_pretrained 的名字（仓库 ID 形式），实际文件在 <站点>/models/RMBG-1.4/
const MODEL_REPO_ID = 'RMBG-1.4'

function localUrl(path) {
  return new URL(path, document.baseURI).href
}

export function isModelLoaded() {
  return Boolean(model && processor)
}

export async function loadModel(onProgress) {
  if (model && processor) return
  if (!loadPromise) {
    loadPromise = doLoad(onProgress).catch((err) => {
      loadPromise = null
      throw err
    })
  }
  return loadPromise
}

async function doLoad(onProgress) {
  tf = await import('@huggingface/transformers')
  const { env, AutoModel, AutoProcessor } = tf

  env.allowLocalModels = true
  // 禁止回退到 huggingface.co：本地模型缺失时立即报错，而不是无限等待外网
  env.allowRemoteModels = false
  env.useBrowserCache = true
  // 自托管 ORT WASM 运行时，避免回退到 jsdelivr CDN
  env.backends.onnx.wasm.wasmPaths = localUrl('ort/')

  // 模型寻址三个约束互相牵制，只能这样组合：
  // 1) 绝对 http URL 会被库判定为"远程模型"，与 allowRemoteModels=false 冲突 → 模型名必须用仓库 ID 形式
  // 2) 相对路径会拼成以 origin 根为基准的地址，子路径部署下取不到文件
  // 3) 因此把 localModelPath 设成部署基目录的绝对 URL（含 models/ 与结尾斜杠），
  //    库内部 pathJoin 后即为 <站点>/models/RMBG-1.4/...，根目录与子路径部署都正确
  env.localModelPath = new URL('.', document.baseURI).href + 'models/'
  const base = MODEL_REPO_ID
  const progressCallback = onProgress ? makeProgressReporter(onProgress) : undefined

  model = await AutoModel.from_pretrained(base, {
    config: { model_type: 'custom' },
    device: 'wasm',
    dtype: 'q8',
    progress_callback: progressCallback,
  })
  processor = await AutoProcessor.from_pretrained(base)
}

function makeProgressReporter(onProgress) {
  return (item) => {
    if (item.status === 'progress' && item.file && item.file.endsWith('.onnx') && item.total) {
      onProgress({ loaded: item.loaded, total: item.total })
    }
  }
}

/**
 * 对源图执行抠图。
 * 返回 { cutout, rawAlpha, width, height, bbox }：
 * - cutout：透明底 RGBA canvas（原始 mask 未经边缘优化）
 * - rawAlpha：原始 alpha 通道（供边缘优化滑杆反复重算）
 * - bbox：人物包围盒（供自动构图）
 */
export async function run(sourceCanvas) {
  await loadModel()
  const image = await tf.RawImage.fromCanvas(sourceCanvas)
  const { pixel_values } = await processor(image)
  const { output } = await model({ input: pixel_values })

  // RMBG 输出已是 0~1 概率图，无需 sigmoid
  const maskTensor = output[0].mul(255).to('uint8')
  const mask = await tf.RawImage.fromTensor(maskTensor).resize(image.width, image.height)
  image.putAlpha(mask)

  const cutout = image.toCanvas()
  const rawAlpha = extractAlpha(cutout)
  // 填回被主体完全包围的透明小洞——它们是抠图瑕疵而非真实背景（真实背景必然与图像边界连通）
  fillInteriorHoles(rawAlpha, cutout.width, cutout.height)
  // 去掉散落在背景里的孤立小亮斑（与主体不连通的微小不透明块）
  removeSmallIslands(rawAlpha, cutout.width, cutout.height)
  const bbox = getBBox(rawAlpha, cutout.width, cutout.height)
  return { cutout, rawAlpha, width: cutout.width, height: cutout.height, bbox }
}

/**
 * 去除背景中的孤立小亮斑：对不透明像素做连通域分析，凡面积小于阈值的连通块
 * （与主体不连通的微小碎片）置为透明。主体本身是最大的连通块，不受影响；
 * 足够长的发丝面积会超过阈值，也得以保留。
 */
function removeSmallIslands(alpha, width, height, minArea = 60) {
  const FG = 128
  const n = alpha.length
  const seen = new Uint8Array(n)
  const stack = []
  const region = []
  for (let i = 0; i < n; i++) {
    if (seen[i] || alpha[i] < FG) continue
    region.length = 0
    seen[i] = 1
    stack.push(i)
    region.push(i)
    while (stack.length) {
      const p = stack.pop()
      const x = p % width
      if (x > 0 && !seen[p - 1] && alpha[p - 1] >= FG) { seen[p - 1] = 1; stack.push(p - 1); region.push(p - 1) }
      if (x < width - 1 && !seen[p + 1] && alpha[p + 1] >= FG) { seen[p + 1] = 1; stack.push(p + 1); region.push(p + 1) }
      if (p >= width && !seen[p - width] && alpha[p - width] >= FG) { seen[p - width] = 1; stack.push(p - width); region.push(p - width) }
      if (p < n - width && !seen[p + width] && alpha[p + width] >= FG) { seen[p + width] = 1; stack.push(p + width); region.push(p + width) }
    }
    if (region.length < minArea) {
      for (const p of region) alpha[p] = 0
    }
  }
}

/**
 * 填充主体内部的误抠小洞。
 * 思路：从图像边界对"背景样"像素（alpha < BG）做洪水填充，得到与外界连通的真实背景；
 * 凡是与之不连通的背景样区域，都是被主体包围的内部洞，按面积上限填回不透明
 * （填回后显示的是原图该处的真实内容）。上限用于保留手臂与躯干间偶发的真实背景缝隙。
 */
function fillInteriorHoles(alpha, width, height) {
  const BG = 90
  const n = alpha.length
  const maxArea = Math.max(150, Math.min(2500, Math.round(width * height * 0.001)))

  const seen = new Uint8Array(n)
  const stack = []
  const seed = (i) => {
    if (!seen[i] && alpha[i] < BG) { seen[i] = 1; stack.push(i) }
  }
  for (let x = 0; x < width; x++) { seed(x); seed((height - 1) * width + x) }
  for (let y = 0; y < height; y++) { seed(y * width); seed(y * width + width - 1) }

  // 洪水填充出与边界连通的真实背景
  while (stack.length) {
    const i = stack.pop()
    const x = i % width
    if (x > 0 && !seen[i - 1] && alpha[i - 1] < BG) { seen[i - 1] = 1; stack.push(i - 1) }
    if (x < width - 1 && !seen[i + 1] && alpha[i + 1] < BG) { seen[i + 1] = 1; stack.push(i + 1) }
    if (i >= width && !seen[i - width] && alpha[i - width] < BG) { seen[i - width] = 1; stack.push(i - width) }
    if (i < n - width && !seen[i + width] && alpha[i + width] < BG) { seen[i + width] = 1; stack.push(i + width) }
  }

  // 遍历剩余未标记的背景样像素＝内部洞，测面积后决定是否填回
  const region = []
  for (let i = 0; i < n; i++) {
    if (seen[i] || alpha[i] >= BG) continue
    region.length = 0
    seen[i] = 1
    stack.push(i)
    region.push(i)
    while (stack.length) {
      const p = stack.pop()
      const x = p % width
      if (x > 0 && !seen[p - 1] && alpha[p - 1] < BG) { seen[p - 1] = 1; stack.push(p - 1); region.push(p - 1) }
      if (x < width - 1 && !seen[p + 1] && alpha[p + 1] < BG) { seen[p + 1] = 1; stack.push(p + 1); region.push(p + 1) }
      if (p >= width && !seen[p - width] && alpha[p - width] < BG) { seen[p - width] = 1; stack.push(p - width); region.push(p - width) }
      if (p < n - width && !seen[p + width] && alpha[p + width] < BG) { seen[p + width] = 1; stack.push(p + width); region.push(p + width) }
    }
    if (region.length <= maxArea) {
      for (const p of region) alpha[p] = 255
    }
  }
}

function extractAlpha(canvas) {
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
  const alpha = new Uint8ClampedArray(canvas.width * canvas.height)
  for (let i = 0, j = 3; i < alpha.length; i++, j += 4) {
    alpha[i] = data[j]
  }
  return alpha
}

/**
 * 边缘优化（绝不抠洞）。流程：
 * 1) 3x3 中值滤波去掉孤立噪点——主体内部的"小点点"多来自这里；
 * 2) 对比度收紧，只压掉背景过渡灰雾。下限封顶在 ~44：主体内部≈255、发丝核心>60
 *    都安全，不会被抠成洞；
 * 3) 轻微羽化去锯齿。
 * 特意不做腐蚀：腐蚀会啃掉发丝并在细窄处制造洞。去白边改由收紧+羽化温和完成。
 * strength ∈ [0, 0.6]，0 表示原样返回。
 */
export function refineMask(rawAlpha, width, height, strength) {
  if (strength <= 0) return new Uint8ClampedArray(rawAlpha)

  let alpha = median3(rawAlpha, width, height)

  const lo = 20 + strength * 40
  const hi = 240 - strength * 30
  const range = Math.max(1, hi - lo)
  for (let i = 0; i < alpha.length; i++) {
    const t = (alpha[i] - lo) / range
    alpha[i] = t <= 0 ? 0 : t >= 1 ? 255 : t * t * (3 - 2 * t) * 255
  }

  const blend = Math.min(0.5, strength)
  if (blend > 0) boxBlurBlend(alpha, width, height, blend)

  return alpha
}

// 3x3 中值滤波：去掉孤立噪点，保留真实边缘与宽度 >=2px 的发丝
function median3(src, width, height) {
  const out = new Uint8ClampedArray(src.length)
  const win = new Uint8Array(9)
  for (let y = 0; y < height; y++) {
    const ym = Math.max(0, y - 1) * width
    const y0 = y * width
    const yp = Math.min(height - 1, y + 1) * width
    for (let x = 0; x < width; x++) {
      const xm = Math.max(0, x - 1)
      const xp = Math.min(width - 1, x + 1)
      win[0] = src[ym + xm]; win[1] = src[ym + x]; win[2] = src[ym + xp]
      win[3] = src[y0 + xm]; win[4] = src[y0 + x]; win[5] = src[y0 + xp]
      win[6] = src[yp + xm]; win[7] = src[yp + x]; win[8] = src[yp + xp]
      for (let i = 1; i < 9; i++) {
        const v = win[i]
        let j = i - 1
        while (j >= 0 && win[j] > v) { win[j + 1] = win[j]; j-- }
        win[j + 1] = v
      }
      out[y0 + x] = win[4]
    }
  }
  return out
}

// 羽化：把 alpha 与邻域均值按比例混合，软化锯齿边缘
function boxBlurBlend(alpha, width, height, blend) {
  const tmp = new Float32Array(alpha.length)
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      const i = row + x
      let sum = alpha[i]
      let n = 1
      if (x > 0) { sum += alpha[i - 1]; n++ }
      if (x < width - 1) { sum += alpha[i + 1]; n++ }
      tmp[i] = sum / n
    }
  }
  for (let y = 0; y < height; y++) {
    const row = y * width
    const up = row - width
    const down = row + width
    for (let x = 0; x < width; x++) {
      const i = row + x
      let sum = tmp[i]
      let n = 1
      if (y > 0) { sum += tmp[up + x]; n++ }
      if (y < height - 1) { sum += tmp[down + x]; n++ }
      alpha[i] = alpha[i] * (1 - blend) + (sum / n) * blend
    }
  }
}

/** 把优化后的 alpha 套回抠图结果，生成新的透明底 canvas */
export function applyAlpha(cutout, alpha) {
  const canvas = document.createElement('canvas')
  canvas.width = cutout.width
  canvas.height = cutout.height
  const ctx = canvas.getContext('2d')
  const imageData = ctx.createImageData(canvas.width, canvas.height)
  const srcData = cutout.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
  const out = imageData.data
  for (let i = 0, j = 3; i < alpha.length; i++, j += 4) {
    out[j] = alpha[i]
  }
  // RGB 直接复制（预乘问题可忽略：canvas 内部同样按非预乘存储）
  for (let j = 0; j < srcData.length; j += 4) {
    out[j] = srcData[j]
    out[j + 1] = srcData[j + 1]
    out[j + 2] = srcData[j + 2]
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

/** alpha 包围盒，找不到人物时返回 null */
export function getBBox(alpha, width, height, threshold = 8) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      if (alpha[row + x] > threshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}
