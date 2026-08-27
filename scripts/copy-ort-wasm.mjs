import { copyFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(repoRoot, 'node_modules', 'onnxruntime-web', 'dist')
const destDir = path.join(repoRoot, 'public', 'ort')

const files = ['ort-wasm-simd-threaded.jsep.wasm', 'ort-wasm-simd-threaded.jsep.mjs']

await mkdir(destDir, { recursive: true })
for (const f of files) {
  await copyFile(path.join(srcDir, f), path.join(destDir, f))
  console.log(`已复制 ${f} 到 public/ort/`)
}
