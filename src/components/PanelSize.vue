<script setup>
import { DPI_OPTIONS, SIZE_PRESETS, mmToPx } from '../lib/presets.js'

defineProps({
  settings: { type: Object, required: true }, // { sizeId, customW, customH, dpi }
  photoPx: { type: Object, required: true }, // { w, h }
  sizeWarning: { type: String, default: '' },
})

const CUSTOM_MM_MIN = 10
const CUSTOM_MM_MAX = 100
</script>

<template>
  <section class="panel">
    <h3>尺寸</h3>
    <div class="preset-grid">
      <button
        v-for="p in SIZE_PRESETS"
        :key="p.id"
        class="preset-btn"
        :class="{ active: settings.sizeId === p.id }"
        @click="settings.sizeId = p.id"
      >
        <span class="preset-name">{{ p.name }}</span>
        <span class="preset-spec">{{ p.wMm }}×{{ p.hMm }}mm</span>
        <span class="preset-spec">{{ mmToPx(p.wMm, settings.dpi) }}×{{ mmToPx(p.hMm, settings.dpi) }}px</span>
      </button>
      <button
        class="preset-btn"
        :class="{ active: settings.sizeId === 'custom' }"
        @click="settings.sizeId = 'custom'"
      >
        <span class="preset-name">自定义</span>
        <span class="preset-spec">输入毫米规格</span>
      </button>
    </div>

    <div v-if="settings.sizeId === 'custom'" class="custom-size">
      <label>
        宽 (mm)
        <input type="number" v-model.number="settings.customW" :min="CUSTOM_MM_MIN" :max="CUSTOM_MM_MAX" />
      </label>
      <label>
        高 (mm)
        <input type="number" v-model.number="settings.customH" :min="CUSTOM_MM_MIN" :max="CUSTOM_MM_MAX" />
      </label>
    </div>

    <div class="dpi-row">
      <span class="dpi-label">DPI</span>
      <button
        v-for="d in DPI_OPTIONS"
        :key="d"
        class="chip"
        :class="{ active: settings.dpi === d }"
        @click="settings.dpi = d"
      >
        {{ d }}
      </button>
      <span class="dpi-note">输出 {{ photoPx.w }}×{{ photoPx.h }}px</span>
    </div>
    <p v-if="sizeWarning" class="warn">{{ sizeWarning }}</p>
  </section>
</template>
