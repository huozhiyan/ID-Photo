<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { composeIdPhoto, calcGrid, renderLayout } from '../lib/render.js'
import {
  buildFilename,
  buildLayoutFilename,
  exportCanvas,
  toJpegUnderKb,
} from '../lib/exporter.js'
import { findPaperPreset, mmToPx, MAX_CANVAS_AREA } from '../lib/presets.js'
import { createDownload, formatBytes } from '../lib/utils.js'

const props = defineProps({
  cutout: { type: Object, required: true },
  transform: { type: Object, required: true },
  sizeMm: { type: Object, required: true }, // { wMm, hMm }
  dpi: { type: Number, required: true },
  bg: { type: String, default: null },
  bgName: { type: String, default: '' },
  settings: { type: Object, required: true },
  paintCanvas: { type: Object, default: null }, // 用户修补层
  paintTick: { type: Number, default: 0 }, // 修补内容变化计数
})
const emit = defineEmits(['toast'])

const tab = ref('single')
const busy = ref(false)
const lastResult = ref('')

const photoPx = computed(() => ({
  w: mmToPx(props.sizeMm.wMm, props.dpi),
  h: mmToPx(props.sizeMm.hMm, props.dpi),
}))

function compose() {
  return composeIdPhoto({
    cutout: props.cutout,
    transform: props.transform,
    bg: props.bg,
    wPx: photoPx.value.w,
    hPx: photoPx.value.h,
    paintCanvas: props.paintCanvas,
  })
}

async function exportSingle() {
  if (busy.value) return
  busy.value = true
  lastResult.value = ''
  try {
    const canvas = compose()
    let format = props.settings.format
    if (props.bg === null && format === 'jpg') {
      format = 'png'
      emit('toast', '透明底不支持 JPEG，已按 PNG 导出')
    }

    if (format === 'jpg' && props.settings.kbLimitEnabled && props.settings.kbLimit > 0) {
      const r = await toJpegUnderKb(canvas, props.settings.kbLimit)
      createDownload(
        r.blob,
        buildFilename({ ...props.sizeMm, dpi: props.dpi, bgName: props.bgName, width: r.width, height: r.height, ext: 'jpg' }),
      )
      lastResult.value =
        `实际大小 ${formatBytes(r.blob.size)}（画质 ${Math.round(r.quality * 100)}%）` +
        (r.downscaled ? `，已降至 ${r.width}×${r.height}px` : '')
    } else {
      const blob = await exportCanvas(canvas, { format })
      createDownload(
        blob,
        buildFilename({ ...props.sizeMm, dpi: props.dpi, bgName: props.bgName, width: canvas.width, height: canvas.height, ext: format }),
      )
      lastResult.value = `实际大小 ${formatBytes(blob.size)}`
    }
  } catch (err) {
    emit('toast', `导出失败：${err.message}`)
  } finally {
    busy.value = false
  }
}

// ---- 排版 ----

const paper = computed(() => findPaperPreset(props.settings.paperId))

const grid = computed(() =>
  calcGrid({
    paperMm: paper.value,
    photoMm: props.sizeMm,
    dpi: props.dpi,
    marginMm: props.settings.marginMm,
    gapMm: props.settings.gapMm,
    landscape: props.settings.landscape,
  }),
)

const layoutTooLarge = computed(
  () => grid.value && grid.value.paperWPx * grid.value.paperHPx > MAX_CANVAS_AREA,
)

const layoutCanvas = ref(null)
const previewEl = ref(null)
let layoutTimer = 0

function rebuildLayout() {
  if (!grid.value || layoutTooLarge.value) {
    layoutCanvas.value = null
    return
  }
  layoutCanvas.value = renderLayout(compose(), grid.value, {
    dpi: props.dpi,
    cutLines: props.settings.cutLines,
  })
}

watch(
  [grid, layoutTooLarge, () => props.cutout, () => props.transform, () => props.bg, () => props.dpi, () => props.settings.cutLines, () => props.paintTick],
  () => {
    clearTimeout(layoutTimer)
    layoutTimer = setTimeout(rebuildLayout, 200)
  },
  { immediate: true, deep: true },
)

// 预览 canvas 仅在"排版打印"页签下存在，页签打开时需重绘，否则始终是空白
watch([layoutCanvas, tab], async ([c, t]) => {
  if (t !== 'layout' || !c) return
  await nextTick()
  const el = previewEl.value
  if (!el) return
  el.width = c.width
  el.height = c.height
  el.getContext('2d').drawImage(c, 0, 0)
}, { flush: 'post', immediate: true })

async function exportLayout() {
  if (busy.value || !layoutCanvas.value) return
  busy.value = true
  try {
    const blob = await exportCanvas(layoutCanvas.value, { format: 'jpg', jpegQuality: 0.92 })
    createDownload(
      blob,
      buildLayoutFilename({
        paperName: paper.value.id,
        count: grid.value.count,
        wMm: props.sizeMm.wMm,
        hMm: props.sizeMm.hMm,
        dpi: props.dpi,
      }),
    )
    emit('toast', `排版图已导出（${formatBytes(blob.size)}）`)
  } catch (err) {
    emit('toast', `导出失败：${err.message}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="panel">
    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'single' }" @click="tab = 'single'">单张导出</button>
      <button class="tab" :class="{ active: tab === 'layout' }" @click="tab = 'layout'">排版打印</button>
    </div>

    <div v-if="tab === 'single'" class="export-body">
      <div class="row">
        <span class="row-label">格式</span>
        <button class="chip" :class="{ active: settings.format === 'jpg' }" @click="settings.format = 'jpg'">JPG</button>
        <button class="chip" :class="{ active: settings.format === 'png' }" @click="settings.format = 'png'">PNG</button>
      </div>
      <div class="row">
        <label class="check">
          <input type="checkbox" v-model="settings.kbLimitEnabled" :disabled="settings.format !== 'jpg'" />
          限制文件大小
        </label>
        <template v-if="settings.kbLimitEnabled && settings.format === 'jpg'">
          ≤ <input type="number" class="kb-input" v-model.number="settings.kbLimit" min="1" max="10000" /> KB
        </template>
      </div>
      <p class="hint">输出像素 {{ photoPx.w }}×{{ photoPx.h }}（{{ dpi }} DPI）</p>
      <button class="btn primary block" :disabled="busy" @click="exportSingle">
        {{ busy ? '导出中…' : '导出证件照' }}
      </button>
      <p v-if="lastResult" class="result">{{ lastResult }}</p>
    </div>

    <div v-else class="export-body">
      <div class="row">
        <span class="row-label">相纸</span>
        <button
          v-for="p in [{ id: 'five', name: '5寸' }, { id: 'six', name: '6寸' }, { id: 'seven', name: '7寸' }, { id: 'a4', name: 'A4' }]"
          :key="p.id"
          class="chip"
          :class="{ active: settings.paperId === p.id }"
          @click="settings.paperId = p.id"
        >
          {{ p.name }}
        </button>
        <button class="chip" :class="{ active: settings.landscape }" @click="settings.landscape = !settings.landscape">
          横向
        </button>
      </div>
      <div class="row">
        <span class="row-label">边距 {{ settings.marginMm }}mm</span>
        <input type="range" min="0" max="10" step="0.5" v-model.number="settings.marginMm" />
      </div>
      <div class="row">
        <span class="row-label">间距 {{ settings.gapMm }}mm</span>
        <input type="range" min="0" max="5" step="0.5" v-model.number="settings.gapMm" />
      </div>
      <div class="row">
        <label class="check">
          <input type="checkbox" v-model="settings.cutLines" />
          裁切线
        </label>
        <span v-if="grid" class="hint">可排 {{ grid.cols }}×{{ grid.rows }} = {{ grid.count }} 张</span>
        <span v-else class="warn">相纸太小，排不下当前尺寸</span>
      </div>
      <p v-if="layoutTooLarge" class="warn">当前 DPI 下排版图过大，请降低 DPI 或换小相纸</p>
      <div v-if="layoutCanvas" class="layout-preview-wrap">
        <canvas ref="previewEl" class="layout-preview"></canvas>
      </div>
      <button class="btn primary block" :disabled="busy || !layoutCanvas" @click="exportLayout">
        导出排版图（{{ dpi }} DPI）
      </button>
    </div>
  </section>
</template>
