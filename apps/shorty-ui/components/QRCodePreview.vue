<template>
  <div class="flex flex-col items-center">
    <div
      class="rounded-2xl transition-all duration-300 flex flex-col items-center justify-center p-4 relative"
      :class="[
        qrFrame === 'border' ? 'border-4 border-slate-900 bg-white' : '',
        qrFrame === 'bottom-label'
          ? 'bg-slate-900 shadow-md'
          : 'bg-white border border-slate-200 shadow-sm',
      ]"
      :style="{ width: containerSize, minHeight: containerSize }"
    >
      <!-- QR SVG Canvas -->
      <div
        class="flex items-center justify-center relative overflow-hidden rounded-lg bg-white [&>svg]:w-full [&>svg]:h-full"
        :style="{ width: innerSize, height: innerSize }"
        v-html="qrSvg"
      />

      <!-- Frame Bottom Label -->
      <div
        v-if="qrFrame === 'bottom-label'"
        class="w-full pt-2.5 text-center text-white font-black text-[0.68rem] tracking-widest uppercase truncate px-2"
      >
        {{ qrFrameText || 'SCAN ME' }}
      </div>
    </div>

    <!-- Title Caption (Optional) -->
    <div v-if="showCaption && title" class="mt-2 text-center max-w-50 truncate">
      <span class="text-xs font-semibold text-slate-700 block truncate">{{ title }}</span>
      <span class="text-[0.65rem] text-slate-400 block truncate">{{ displayUrl }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { buildQrSvg } from '@petty-cash/qr-render';

const props = withDefaults(
  defineProps<{
    value?: string;
    title?: string;
    fgColor?: string;
    bgColor?: string;
    qrStyle?: string;
    corner?: string;
    overlayType?: 'none' | 'logo' | 'text' | string;
    overlayText?: string;
    logo?: string | null;
    qrFrame?: 'none' | 'border' | 'bottom-label' | string;
    qrFrameText?: string;
    size?: 'sm' | 'md' | 'lg' | number;
    showCaption?: boolean;
  }>(),
  {
    value: 'https://pension.gov.mv',
    title: '',
    fgColor: '#000000',
    bgColor: '#ffffff',
    qrStyle: 'soft-pixel',
    corner: 'classic-square',
    overlayType: 'none',
    overlayText: 'GO',
    logo: null,
    qrFrame: 'none',
    qrFrameText: 'SCAN ME',
    size: 'md',
    showCaption: false,
  }
);

const displayUrl = computed(() => props.value || 'https://pension.gov.mv');

const containerSize = computed(() => {
  if (typeof props.size === 'number') return `${props.size}px`;
  if (props.size === 'sm') return '140px';
  if (props.size === 'lg') return '260px';
  return '190px';
});

const innerSize = computed(() => {
  if (typeof props.size === 'number') return `${props.size - 24}px`;
  if (props.size === 'sm') return '110px';
  if (props.size === 'lg') return '210px';
  return '150px';
});

// Full-fidelity 9-pattern/9-corner renderer shared with the customizer
// (pages/links/[id].vue) and the backend's download endpoint — this used
// to be a smaller, separately-maintained subset that silently fell back to
// generic shapes for star/organic-blob/warped-square/etc.
const qrSvg = computed(() =>
  buildQrSvg({
    value: displayUrl.value,
    fgColor: props.fgColor,
    bgColor: props.bgColor,
    style: props.qrStyle,
    corner: props.corner,
    overlayType: props.overlayType,
    overlayText: props.overlayText,
    logo: props.logo,
  })
);
</script>
