<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const emit = defineEmits(['select', 'error'])
const dragOver = ref(false)
const input = ref(null)

function handleFiles(files) {
  const file = [...files].find((f) => f.type.startsWith('image/'))
  if (!file) {
    emit('error', '请选择图片文件（JPG / PNG / WebP）')
    return
  }
  emit('select', file)
}

function onPaste(e) {
  const items = e.clipboardData?.items || []
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        e.preventDefault()
        emit('select', file)
        return
      }
    }
  }
}

onMounted(() => document.addEventListener('paste', onPaste))
onBeforeUnmount(() => document.removeEventListener('paste', onPaste))
</script>

<template>
  <div
    class="upload-card"
    :class="{ 'drag-over': dragOver }"
    role="button"
    tabindex="0"
    @click="input.click()"
    @keydown.enter="input.click()"
    @dragover.prevent="dragOver = true"
    @dragleave="dragOver = false"
    @drop.prevent="dragOver = false; handleFiles($event.dataTransfer.files)"
  >
    <input
      ref="input"
      type="file"
      accept="image/*"
      hidden
      @change="handleFiles($event.target.files); input.value = ''"
    />
    <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 16V4m0 0L7 9m5-5l5 5" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke-linecap="round" />
    </svg>
    <p class="upload-title">拖拽照片到这里，或点击选择</p>
    <p class="upload-hint">支持 JPG / PNG / WebP，也可以直接粘贴截图（{{ '⌘' }}/Ctrl + V）</p>
    <p class="upload-hint">建议：正面免冠、五官清晰、人物占画面一半以上</p>
  </div>
</template>
