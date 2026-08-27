import { MAX_SOURCE_SIDE } from './constants.js'

const MAX_FILE_BYTES = 30 * 1024 * 1024

export async function normalizeUpload(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('不支持的文件类型，请选择 JPG / PNG / WebP 图片')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('图片超过 30MB，请先压缩后再上传')
  }

  const source = await decodeFile(file)
  const scale = Math.min(1, MAX_SOURCE_SIDE / Math.max(source.width, source.height))
  const width = Math.round(source.width * scale)
  const height = Math.round(source.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(source, 0, 0, width, height)
  if (source.close) source.close()

  return { canvas, width, height }
}

async function decodeFile(file) {
  try {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      return await createImageBitmap(file)
    }
  } catch {
    return decodeViaImageElement(file)
  }
}

function decodeViaImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      resolve(canvas)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      if (/heic|heif/i.test(file.type || file.name)) {
        reject(new Error('暂不支持 iPhone 的 HEIC 格式，请先转换为 JPG'))
      } else {
        reject(new Error('图片解码失败，可能已损坏或格式不受支持'))
      }
    }
    img.src = url
  })
}
