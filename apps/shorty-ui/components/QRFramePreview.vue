<template>
  <div class="flex flex-col items-center justify-center">
    <!-- Main Frame Box -->
    <div
      class="relative transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-sm"
      :style="frameBoxStyle"
    >
      <!-- Custom Uploaded Background Image if any -->
      <img
        v-if="frameType === 'custom-upload' && customImageUrl"
        :src="customImageUrl"
        class="absolute inset-0 w-full h-full object-cover pointer-events-none"
        alt="Custom Frame Background"
      >

      <!-- Top Header Banner (if top-header) -->
      <div
        v-if="frameType === 'top-header'"
        class="w-full py-2.5 px-3 text-center font-extrabold text-xs tracking-wider uppercase truncate shrink-0 z-10"
        :style="{ backgroundColor: frameColor, color: textColor }"
      >
        {{ ctaText || 'SCAN TO OPEN' }}
      </div>

      <!-- QR Code Body Area -->
      <div
        class="flex-1 flex items-center justify-center p-3 relative z-10 w-full"
        :class="[
          qrPosition === 'top' ? 'items-start pt-4' : '',
          qrPosition === 'bottom' ? 'items-end pb-4' : '',
          qrPosition === 'center' ? 'items-center' : ''
        ]"
      >
        <div
          class="transition-all duration-200 flex items-center justify-center"
          :style="{ width: qrDimension, height: qrDimension }"
        >
          <QRCodePreview
            :value="qrValue || 'https://pension.gov.mv'"
            :fg-color="qrFgColor || '#0f172a'"
            :bg-color="qrBgColor || '#ffffff'"
            :qr-style="qrStyle || 'soft-pixel'"
            :corner="qrCorner || 'classic-square'"
            size="sm"
          />
        </div>
      </div>

      <!-- Bottom Label Banner (if bottom-label) -->
      <div
        v-if="frameType === 'bottom-label'"
        class="w-full py-2.5 px-3 text-center font-extrabold text-xs tracking-wider uppercase truncate shrink-0 z-10"
        :style="{ backgroundColor: frameColor, color: textColor }"
      >
        {{ ctaText || 'SCAN ME' }}
      </div>

      <!-- Card Box Subtitle / Label (if card-box) -->
      <div
        v-if="frameType === 'card-box' && ctaText"
        class="w-full pb-3 px-3 text-center font-semibold text-[0.7rem] truncate shrink-0 z-10"
        :style="{ color: textColor }"
      >
        {{ ctaText }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import QRCodePreview from './QRCodePreview.vue';

const props = withDefaults(
  defineProps<{
    frameType?: 'bottom-label' | 'border' | 'top-header' | 'card-box' | 'custom-upload' | string;
    frameColor?: string;
    textColor?: string;
    borderColor?: string;
    qrPosition?: 'center' | 'top' | 'bottom' | string;
    qrSizePercent?: number;
    ctaText?: string;
    customImageUrl?: string | null;
    qrValue?: string;
    qrFgColor?: string;
    qrBgColor?: string;
    qrStyle?: string;
    qrCorner?: string;
    width?: number | string;
    height?: number | string;
  }>(),
  {
    frameType: 'bottom-label',
    frameColor: '#0f172a',
    textColor: '#ffffff',
    borderColor: '#e2e8f0',
    qrPosition: 'center',
    qrSizePercent: 85,
    ctaText: 'SCAN ME',
    customImageUrl: null,
    qrValue: 'https://pension.gov.mv',
    qrFgColor: '#0f172a',
    qrBgColor: '#ffffff',
    qrStyle: 'soft-pixel',
    qrCorner: 'classic-square',
    width: 220,
    height: 270,
  }
);

const frameBoxStyle = computed(() => {
  const w = typeof props.width === 'number' ? props.width + 'px' : props.width;
  const h = typeof props.height === 'number' ? props.height + 'px' : props.height;

  const bg = props.frameType === 'card-box' ? props.frameColor : '#ffffff';
  let border = '1px solid ' + (props.borderColor || '#e2e8f0');

  if (props.frameType === 'border') {
    border = '6px solid ' + props.borderColor;
  }

  return {
    width: w,
    height: h,
    backgroundColor: bg,
    border: border,
    borderRadius: '16px',
  };
});

const qrDimension = computed(() => {
  const percent = props.qrSizePercent || 85;
  return percent + '%';
});
</script>
