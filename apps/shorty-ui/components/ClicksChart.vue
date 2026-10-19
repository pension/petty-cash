<template>
  <div class="w-full bg-white rounded-xl p-4 border border-slate-200">
    <div v-if="title || subtitle" class="mb-4">
      <h4 v-if="title" class="text-sm font-semibold text-slate-800">{{ title }}</h4>
      <p v-if="subtitle" class="text-xs text-slate-500">{{ subtitle }}</p>
    </div>
    <div class="relative min-h-62.5 flex items-center justify-center">
      <div v-if="loading" class="absolute flex flex-col items-center justify-center space-y-2">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"/>
        <span class="text-xs text-slate-400">Loading chart data...</span>
      </div>
      <div ref="chartContainer" class="w-full"/>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type ApexCharts from 'apexcharts';
import { loadApexCharts } from '~/composables/useApexCharts';

interface SeriesItem {
  name: string;
  data: number[];
}

const props = withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    series: SeriesItem[];
    categories: string[];
    type?: 'line' | 'bar' | 'area';
    height?: number;
    colors?: string[];
  }>(),
  {
    title: '',
    subtitle: '',
    type: 'line',
    height: 300,
    colors: () => ['#4f46e5', '#0ea5e9'],
  }
);

const chartContainer = ref<HTMLDivElement | null>(null);
const loading = ref(true);
let chartInstance: InstanceType<typeof ApexCharts> | null = null;
// initChart has an async gap (`await loadApexCharts()`) before it touches
// the DOM/creates the chart instance. Navigating away (this component is
// used on both the dashboard and the link-detail page, so going from one
// to the other unmounts one instance and mounts another) can unmount this
// component mid-await — without this flag, the resumed call would still
// call `new ApexCharts(chartContainer.value, ...)` against a container
// Vue has already torn down, and/or create an instance that never gets
// destroyed because onBeforeUnmount already ran before it existed. Both
// race outcomes were observed as an "Unhandled error during execution of
// component update" / "Cannot destructure property 'type' of vnode as it
// is null" crash when navigating link detail -> dashboard quickly.
let isUnmounted = false;

const initChart = async () => {
  if (import.meta.server) return;

  const ApexCharts = await loadApexCharts();
  if (isUnmounted || !ApexCharts || !chartContainer.value) return;

  loading.value = false;

  // Cleanup existing chart if any
  if (chartInstance) {
    chartInstance.destroy();
  }

  const options = {
    chart: {
      type: props.type,
      height: props.height,
      toolbar: {
        show: false,
      },
      fontFamily: 'inherit',
    },
    series: props.series,
    xaxis: {
      categories: props.categories,
      labels: {
        style: {
          colors: '#64748b',
          fontSize: '11px',
        },
      },
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: '#64748b',
          fontSize: '11px',
        },
      },
    },
    stroke: {
      curve: 'smooth',
      width: props.type === 'line' || props.type === 'area' ? 3 : 0,
    },
    colors: props.colors,
    grid: {
      borderColor: '#f1f5f9',
      strokeDashArray: 4,
      xaxis: {
        lines: {
          show: false,
        },
      },
    },
    dataLabels: {
      enabled: false,
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      fontSize: '12px',
      markers: {
        radius: 12,
      },
    },
    tooltip: {
      theme: 'light',
    },
    fill: {
      type: props.type === 'area' ? 'gradient' : 'solid',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [0, 100],
      },
    },
  };

  chartInstance = new ApexCharts(chartContainer.value, options);
  chartInstance.render();
};

onMounted(() => {
  initChart();
});

onBeforeUnmount(() => {
  isUnmounted = true;
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
});

watch(
  () => [props.series, props.categories, props.type, props.colors],
  () => {
    initChart();
  },
  { deep: true }
);
</script>
