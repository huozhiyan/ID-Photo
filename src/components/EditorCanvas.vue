<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { clamp } from '../lib/utils.js'

const props = defineProps({
  cutout: { type: Object, default: null }, // 透明底 canvas
  bg: { type: String, default: null }, // null = 透明（预览显示棋盘格）
  photoW: { type: Number, required: true },
  photoH: { type: Number, required: true },
  transform: { type: Object, required: true }, // { x, y, scale }，成品像素坐标系
  // ---- 修补工具 ----
  toolMode: { type: String, default: 'move' }, // move | brush | eyedropper
  paintCanvas: { type: Object, default: null }, // 修补层（照片像素坐标系）
  brushColor: { type: String, default: '#ffffff' },
  brushSize: { type: Number, default: 12 },
})
const emit = defineEmits(['update:transform', 'reset', 'color-picked', 'painted'])

const MIN_SCALE = 0.02
const MAX_SCALE = 10

const wrapper = ref(null)
const canvasEl = ref(null)
const box = reactive({ w: 0, h: 0 })
let resizeObserver = null
let raf = 0

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    measure()
    draw()
  })
  resizeObserver.observe(wrapper.value)
  // 标签页处于后台时 ResizeObserver 可能不投递首次回调，这里同步量一次兜底
  measure()
  draw()
  window.addEventListener('resize', requestDraw)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', requestDraw)
  if (raf) cancelAnimationFrame(raf)
})

const displayScale = computed(() => {
  if (!box.w || !box.h || !props.photoW || !props.photoH) return 0
  return Math.min(box.w / props.photoW, box.h / props.photoH)
})

const cssW = computed(() => Math.round(props.photoW * displayScale.value))
const cssH = computed(() => Math.round(props.photoH * displayScale.value))

function requestDraw() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    draw()
  })
}

function measure() {
  const el = wrapper.value
  if (!el) return
  box.w = el.clientWidth
  box.h = el.clientHeight
}

function draw() {
  const canvas = canvasEl.value
  if (!canvas) return
  if (!displayScale.value) {
    measure()
    if (!displayScale.value) return
  }
  const k = clamp((window.devicePixelRatio || 1) * displayScale.value, 1, 4)
  const W = Math.max(1, Math.round(props.photoW * k))
  const H = Math.max(1, Math.round(props.photoH * k))
  if (canvas.width !== W) canvas.width = W
  if (canvas.height !== H) canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.setTransform(k, 0, 0, k, 0, 0)
  ctx.clearRect(0, 0, props.photoW, props.photoH)

  if (props.bg) {
    ctx.fillStyle = props.bg
    ctx.fillRect(0, 0, props.photoW, props.photoH)
  } else {
    drawChecker(ctx)
  }

  if (props.cutout && props.transform) {
    ctx.drawImage(
      props.cutout,
      props.transform.x,
      props.transform.y,
      props.cutout.width * props.transform.scale,
      props.cutout.height * props.transform.scale,
    )
  }

  if (props.paintCanvas) {
    ctx.drawImage(props.paintCanvas, 0, 0)
  }
}

function drawChecker(ctx) {
  const s = 8
  ctx.fillStyle = '#E5E7EB'
  ctx.fillRect(0, 0, props.photoW, props.photoH)
  ctx.fillStyle = '#FFFFFF'
  for (let y = 0; y < props.photoH; y += s * 2) {
    const shift = (y / s) % 2 === 0 ? 0 : s
    for (let x = shift; x < props.photoW; x += s * 2) {
      ctx.fillRect(x, y, s, s)
    }
  }
}

watch(
  [() => props.cutout, () => props.bg, () => props.photoW, () => props.photoH, () => props.transform, () => props.paintCanvas, displayScale],
  requestDraw,
  { deep: true },
)

// ---- 修补工具：画笔 / 吸管 / 撤销 ----

let lastPaintPoint = null
const undoStack = []
const MAX_UNDO = 20

function paintAt(p) {
  const pc = props.paintCanvas
  if (!pc) return
  const pctx = pc.getContext('2d')
  pctx.fillStyle = props.brushColor
  pctx.strokeStyle = props.brushColor
  pctx.lineWidth = props.brushSize
  pctx.lineCap = 'round'
  pctx.lineJoin = 'round'
  if (lastPaintPoint) {
    pctx.beginPath()
    pctx.moveTo(lastPaintPoint.x, lastPaintPoint.y)
    pctx.lineTo(p.x, p.y)
    pctx.stroke()
  } else {
    pctx.beginPath()
    pctx.arc(p.x, p.y, props.brushSize / 2, 0, Math.PI * 2)
    pctx.fill()
  }
  lastPaintPoint = p
  requestDraw()
}

function pickColor(p) {
  const canvas = canvasEl.value
  if (!canvas) return
  const k = canvas.width / props.photoW
  const px = Math.round(clamp(p.x, 0, props.photoW - 1) * k)
  const py = Math.round(clamp(p.y, 0, props.photoH - 1) * k)
  const d = canvas.getContext('2d').getImageData(px, py, 1, 1).data
  const hex = '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')
  emit('color-picked', hex)
}

function pushUndo() {
  const pc = props.paintCanvas
  if (!pc) return
  undoStack.push(pc.getContext('2d').getImageData(0, 0, pc.width, pc.height))
  if (undoStack.length > MAX_UNDO) undoStack.shift()
}

function undo() {
  const pc = props.paintCanvas
  if (!pc || !undoStack.length) return
  const img = undoStack.pop()
  pc.getContext('2d').putImageData(img, 0, 0)
  emit('painted')
  requestDraw()
}

function clearPaint() {
  const pc = props.paintCanvas
  if (!pc) return
  pushUndo()
  pc.getContext('2d').clearRect(0, 0, pc.width, pc.height)
  emit('painted')
  requestDraw()
}

defineExpose({ undo, clearPaint })

// ---- 指针交互：拖拽 / 双指捏合 / 滚轮缩放 ----

const pointers = new Map()
let dragState = null
let pinchState = null

function toWorld(e) {
  const rect = canvasEl.value.getBoundingClientRect()
  const s = displayScale.value || 1
  return { x: (e.clientX - rect.left) / s, y: (e.clientY - rect.top) / s }
}

function distance(p1, p2) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y)
}

function zoomAt(anchorWorld, targetScale, origin = props.transform) {
  const scale = clamp(targetScale, MIN_SCALE, MAX_SCALE)
  const cx = (anchorWorld.x - origin.x) / origin.scale
  const cy = (anchorWorld.y - origin.y) / origin.scale
  emit('update:transform', {
    x: anchorWorld.x - cx * scale,
    y: anchorWorld.y - cy * scale,
    scale,
  })
}

function onPointerDown(e) {
  canvasEl.value.setPointerCapture(e.pointerId)
  pointers.set(e.pointerId, toWorld(e))

  if (props.toolMode === 'eyedropper') {
    pickColor(toWorld(e))
    return
  }
  if (props.toolMode === 'brush') {
    pushUndo()
    lastPaintPoint = null
    paintAt(toWorld(e))
    return
  }

  if (pointers.size === 1) {
    dragState = { start: toWorld(e), origin: { ...props.transform } }
  } else if (pointers.size === 2) {
    dragState = null
    const [p1, p2] = [...pointers.values()]
    pinchState = { dist0: distance(p1, p2), origin: { ...props.transform } }
  }
}

function onPointerMove(e) {
  if (!pointers.has(e.pointerId)) return
  pointers.set(e.pointerId, toWorld(e))

  if (props.toolMode === 'brush') {
    paintAt(toWorld(e))
    return
  }
  if (props.toolMode === 'eyedropper') return

  if (pointers.size === 1 && dragState) {
    const p = toWorld(e)
    emit('update:transform', {
      ...dragState.origin,
      x: dragState.origin.x + (p.x - dragState.start.x),
      y: dragState.origin.y + (p.y - dragState.start.y),
    })
  } else if (pointers.size === 2 && pinchState) {
    const [p1, p2] = [...pointers.values()]
    const anchor = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
    zoomAt(anchor, pinchState.origin.scale * (distance(p1, p2) / pinchState.dist0), pinchState.origin)
  }
}

function onPointerUp(e) {
  pointers.delete(e.pointerId)

  if (props.toolMode === 'brush') {
    lastPaintPoint = null
    emit('painted')
    return
  }
  if (props.toolMode === 'eyedropper') return

  if (pointers.size < 2) pinchState = null
  if (pointers.size === 1) {
    const [p] = [...pointers.values()]
    dragState = { start: p, origin: { ...props.transform } }
  } else if (pointers.size === 0) {
    dragState = null
  }
}

function onWheel(e) {
  const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
  zoomAt(toWorld(e), props.transform.scale * factor)
}

// ---- 滑杆（触屏兜底 + 精细调节） ----

const cutW = computed(() => (props.cutout ? props.cutout.width * props.transform.scale : 0))
const cutH = computed(() => (props.cutout ? props.cutout.height * props.transform.scale : 0))

function setX(v) {
  emit('update:transform', { ...props.transform, x: Number(v) })
}
function setY(v) {
  emit('update:transform', { ...props.transform, y: Number(v) })
}
function setScale(v) {
  const origin = props.transform
  const anchor = { x: props.photoW / 2, y: props.photoH / 2 }
  zoomAt(anchor, Number(v), origin)
}
</script>

<template>
  <div class="editor-canvas">
    <div ref="wrapper" class="canvas-wrap">
      <canvas
        ref="canvasEl"
        :style="{ width: cssW + 'px', height: cssH + 'px', cursor: toolMode === 'move' ? 'grab' : 'crosshair' }"
        @pointerdown.prevent="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @wheel.prevent="onWheel"
      ></canvas>
    </div>
    <div class="fine-tune">
      <label>
        水平
        <input type="range" :min="-cutW" :max="photoW" :value="transform.x" @input="setX($event.target.value)" />
      </label>
      <label>
        垂直
        <input type="range" :min="-cutH" :max="photoH" :value="transform.y" @input="setY($event.target.value)" />
      </label>
      <label>
        缩放
        <input
          type="range"
          :min="MIN_SCALE"
          :max="Math.min(MAX_SCALE, Math.max(0.5, transform.scale * 2))"
          step="0.005"
          :value="transform.scale"
          @input="setScale($event.target.value)"
        />
      </label>
      <button class="btn" @click="emit('reset')">重置位置</button>
    </div>
    <p class="canvas-hint">
      {{
        toolMode === 'brush'
          ? '画笔模式：在画布上涂抹以修补瑕疵区域'
          : toolMode === 'eyedropper'
            ? '吸管模式：点击画面任意位置吸取颜色'
            : '可直接在画布上拖拽移动、滚轮或双指缩放'
      }}
    </p>
  </div>
</template>
