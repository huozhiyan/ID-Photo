<script setup>
import { onMounted, ref } from 'vue'
import { isModelLoaded, loadModel, run } from '../lib/matting.js'
import { formatBytes } from '../lib/utils.js'

const props = defineProps({
  source: { type: Object, required: true },
})
const emit = defineEmits(['done', 'back'])

const phase = ref('download') // download | infer
const progress = ref(null)
const error = ref('')

async function start() {
  error.value = ''
  progress.value = null
  phase.value = isModelLoaded() ? 'infer' : 'download'
  try {
    await loadModel((p) => {
      phase.value = 'download'
      progress.value = p
    })
    phase.value = 'infer'
    const result = await run(props.source.canvas)
    emit('done', result)
  } catch (err) {
    error.value = describeError(err)
  }
}

function describeError(err) {
  const msg = String(err?.message || err)
  if (/fetch|network|failed to/i.test(msg)) {
    return `模型文件加载失败（${msg}）。请确认站点包含 models/ 与 ort/ 目录后重试。`
  }
  return `抠图失败：${msg}`
}

onMounted(start)
</script>

<template>
  <div class="matting-card">
    <template v-if="!error">
      <div class="spinner" aria-hidden="true"></div>
      <template v-if="phase === 'download'">
        <p class="matting-title">正在准备 AI 抠图模型</p>
        <p v-if="progress" class="matting-detail">
          已下载 {{ formatBytes(progress.loaded) }} / {{ formatBytes(progress.total) }}
        </p>
        <p v-else class="matting-detail">首次使用需下载约 42MB 模型，之后会自动缓存</p>
        <div v-if="progress" class="progress-bar">
          <div class="progress-fill" :style="{ width: (progress.loaded / progress.total) * 100 + '%' }"></div>
        </div>
      </template>
      <template v-else>
        <p class="matting-title">正在抠图…</p>
        <p class="matting-detail">AI 推理中，页面可能短暂无响应，请稍候</p>
      </template>
    </template>
    <template v-else>
      <p class="matting-error">{{ error }}</p>
      <div class="matting-actions">
        <button class="btn primary" @click="start">重试</button>
        <button class="btn" @click="emit('back')">返回</button>
      </div>
    </template>
  </div>
</template>
