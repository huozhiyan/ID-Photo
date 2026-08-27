import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const useMirror = process.argv.includes('--mirror')
const endpoint =
  process.env.HF_ENDPOINT ||
  (useMirror ? 'https://hf-mirror.com' : 'https://huggingface.co')
const repo = 'briaai/RMBG-1.4'

const files = [
  { path: 'config.json', minSize: 100 },
  { path: 'preprocessor_config.json', minSize: 100 },
  { path: 'onnx/model_quantized.onnx', minSize: 40 * 1024 * 1024 },
]

const destDir = path.join(repoRoot, 'public', 'models', 'RMBG-1.4')

async function fetchWithRetry(url, retries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res
    } catch (err) {
      if (i >= retries) throw err
      console.warn(`  第 ${i} 次下载失败（${err.message}），重试...`)
      await new Promise((r) => setTimeout(r, 2000 * i))
    }
  }
}

async function download(relPath, minSize) {
  const url = `${endpoint}/${repo}/resolve/main/${relPath}`
  const dest = path.join(destDir, relPath)
  await mkdir(path.dirname(dest), { recursive: true })
  console.log(`下载 ${url}`)
  const res = await fetchWithRetry(url)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < minSize) {
    throw new Error(`文件过小（${buf.length} 字节），可能不是模型文件：${url}`)
  }
  const head = buf.subarray(0, 64).toString('latin1')
  if (head.includes('<!DOCTYPE') || head.includes('<html')) {
    throw new Error(`下载到的是 HTML 页面而非模型文件：${url}`)
  }
  await writeFile(dest, buf)
  console.log(`  已保存 ${path.relative(repoRoot, dest)}（${(buf.length / 1024 / 1024).toFixed(1)} MB）`)
}

console.log(`模型来源：${endpoint}/${repo}`)
for (const f of files) {
  await download(f.path, f.minSize)
}
console.log('模型下载完成。请把 public/models/ 一并提交进仓库。')
