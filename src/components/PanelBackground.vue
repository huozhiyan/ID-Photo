<script setup>
import { BG_PRESETS } from '../lib/presets.js'

defineProps({
  settings: { type: Object, required: true }, // { bgId, customColor }
  bg: { type: String, default: null },
})
</script>

<template>
  <section class="panel">
    <h3>背景色</h3>
    <div class="swatches">
      <button
        v-for="b in BG_PRESETS"
        :key="b.id"
        class="swatch"
        :class="{ active: settings.bgId === b.id }"
        :style="{ background: b.value }"
        :title="b.name"
        @click="settings.bgId = b.id"
      >
        <span class="swatch-name">{{ b.name }}</span>
      </button>
      <button
        class="swatch swatch-custom"
        :class="{ active: settings.bgId === 'custom' }"
        title="自定义颜色"
        @click="settings.bgId = 'custom'"
      >
        <span class="swatch-name">自定</span>
      </button>
      <button
        class="swatch swatch-transparent"
        :class="{ active: settings.bgId === 'transparent' }"
        title="透明底（仅 PNG）"
        @click="settings.bgId = 'transparent'"
      >
        <span class="swatch-name">透明</span>
      </button>
    </div>
    <div v-if="settings.bgId === 'custom'" class="custom-color">
      <input type="color" v-model="settings.customColor" />
      <span class="color-value">{{ settings.customColor }}</span>
    </div>
    <p v-if="bg === null" class="hint">透明底仅支持导出 PNG（JPEG 不支持透明）</p>
  </section>
</template>
