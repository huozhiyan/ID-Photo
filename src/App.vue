<script setup>
import { ref, shallowRef } from 'vue'
import UploadCard from './components/UploadCard.vue'
import StepMatting from './components/StepMatting.vue'
import StepEditor from './components/StepEditor.vue'
import { normalizeUpload } from './lib/imageio.js'

const step = ref('upload')
const source = shallowRef(null)
const mattingResult = shallowRef(null)
const toast = ref('')
let toastTimer = 0

async function onSelectFile(file) {
  try {
    source.value = await normalizeUpload(file)
    step.value = 'matting'
  } catch (err) {
    showToast(err.message)
  }
}

function onMattingDone(result) {
  mattingResult.value = result
  step.value = 'edit'
}

function onRestart() {
  source.value = null
  mattingResult.value = null
  step.value = 'upload'
}

function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 4000)
}
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1>证件照制作</h1>
      <p class="app-subtitle">纯浏览器端处理，照片不上传服务器</p>
    </header>
    <main class="app-main">
      <UploadCard v-if="step === 'upload'" @select="onSelectFile" @error="showToast" />
      <StepMatting v-else-if="step === 'matting'" :source="source" @done="onMattingDone" @back="step = 'upload'" />
      <StepEditor v-else :source="source" :matting-result="mattingResult" @restart="onRestart" @toast="showToast" />
    </main>
    <Transition name="toast">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </Transition>
  </div>
</template>
