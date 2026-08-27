import { stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const modelDir = path.join(repoRoot, 'public', 'models', 'RMBG-1.4')

const required = [
  { path: 'config.json', minSize: 100 },
  { path: 'preprocessor_config.json', minSize: 100 },
  { path: 'onnx/model_quantized.onnx', minSize: 40 * 1024 * 1024 },
]

const missing = []
for (const f of required) {
  try {
    const s = await stat(path.join(modelDir, f.path))
    if (s.size < f.minSize) missing.push(`${f.path}（文件过小）`)
  } catch {
    missing.push(f.path)
  }
}

if (missing.length > 0) {
  console.error('缺少模型文件：')
  for (const m of missing) console.error(`  - ${m}`)
  console.error('请先运行：npm run download-model（网络受限时加 --mirror）')
  process.exit(1)
}
console.log('模型文件校验通过。')
