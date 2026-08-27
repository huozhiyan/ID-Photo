<script setup>
import { computed, reactive, ref, watch } from 'vue'
import EditorCanvas from './EditorCanvas.vue'
import PanelSize from './PanelSize.vue'
import PanelBackground from './PanelBackground.vue'
import PanelExport from './PanelExport.vue'
import { refineMask, applyAlpha } from '../lib/matting.js'
import { computeInitialTransform } from '../lib/render.js'
import { BG_PRESETS, findSizePreset, mmToPx, withinCanvasLimit } from '../lib/presets.js'
import { loadSettings, saveSettings } from '../lib/utils.js'

const props = defineProps({
  source: { type: Object, required: true },
  mattingResult: { type: Object, required: true },
})
const emit = defineEmits(['restart', 'toast'])

const defaults = {
  sizeId: 'one',
  customW: 25,
  customH: 35,
  dpi: 300,
  bgId: 'white',
  customColor: '#FFFFFF',
  format: 'jpg',
  kbLimitEnabled: false,
  kbLimit: 50,
  paperId: 'six',
  landscape: false,
  marginMm: 3,
  gapMm: 1,
  cutLines: true,
}

const settings = reactive(loadSettings(defaults))

const edgeStrength = ref(0.15)

const sizeMm = computed(() => {
  if (settings.sizeId === 'custom') return { wMm: settings.customW, hMm: settings.customH }
  const p = findSizePreset(settings.sizeId)
  return { wMm: p.wMm, hMm: p.hMm }
})

const photoPx = computed(() => ({
  w: mmToPx(sizeMm.value.wMm, settings.dpi),
  h: mmToPx(sizeMm.value.hMm, settings.dpi),
}))

const sizeWarning = computed(() => {
  if (!withinCanvasLimit(photoPx.value.w, photoPx.value.h)) {
    return '当前 DPI 下像素过大，可能超出浏览器限制，建议降低 DPI'
  }
  return ''
})

const bg = computed(() => {
  if (settings.bgId === 'transparent') return null
  if (settings.bgId === 'custom') return settings.customColor
  return BG_PRESETS.find((b) => b.id === settings.bgId)?.value || '#FFFFFF'
})

const bgName = computed(() => {
  if (settings.bgId === 'transparent') return 'transparent'
  if (settings.bgId === 'custom') return 'custom'
  return settings.bgId
})

const refinedCutout = ref(null)

function recomputeRefined() {
  const { rawAlpha, cutout, width, height } = props.mattingResult
  if (edgeStrength.value <= 0) {
    refinedCutout.value = cutout
  } else {
    const alpha = refineMask(rawAlpha, width, height, edgeStrength.value)
    refinedCutout.value = applyAlpha(cutout, alpha)
  }
}

watch(edgeStrength, recomputeRefined)
watch(() => props.mattingResult, recomputeRefined, { immediate: true })

function makeInitialTransform() {
  return computeInitialTransform(
    props.mattingResult.bbox,
    props.mattingResult.width,
    props.mattingResult.height,
    photoPx.value.w,
    photoPx.value.h,
  )
}

const transform = ref(makeInitialTransform())

watch(photoPx, () => {
  transform.value = makeInitialTransform()
})

function resetTransform() {
  transform.value = makeInitialTransform()
}

watch(settings, () => saveSettings(settings), { deep: true })
</script>

<template>
  <div class="step-editor">
    <div class="editor-main">
      <EditorCanvas
        v-if="refinedCutout"
        :cutout="refinedCutout"
        :bg="bg"
        :photoW="photoPx.w"
        :photoH="photoPx.h"
        :transform="transform"
        @update:transform="transform = $event"
        @reset="resetTransform"
      />
      <div class="edge-opt">
        <label>
          边缘优化
          <input type="range" min="0" max="0.6" step="0.05" v-model.number="edgeStrength" />
          <span class="edge-value">{{ Math.round(edgeStrength * 100) }}%</span>
        </label>
        <p class="hint">去除边缘杂点与灰雾；已做防抠洞处理，不会损伤头发和衣服细节</p>
      </div>
    </div>
    <div class="editor-panels">
      <PanelSize :settings="settings" :photoPx="photoPx" :sizeWarning="sizeWarning" />
      <PanelBackground :settings="settings" :bg="bg" />
      <PanelExport
        v-if="refinedCutout"
        :cutout="refinedCutout"
        :transform="transform"
        :sizeMm="sizeMm"
        :dpi="settings.dpi"
        :bg="bg"
        :bgName="bgName"
        :settings="settings"
        @toast="emit('toast', $event)"
      />
      <button class="btn restart-btn" @click="emit('restart')">重新开始</button>
    </div>
  </div>
</template>
