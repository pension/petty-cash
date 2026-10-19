<template>
  <PoContentArea>
    <!-- Page Header -->
    <header class="lg:flex lg:items-end justify-between mb-4">
      <PoPageTitle
        class="grow"
        :stand-alone="true"
        label="Analytics Platform"
        description="Unified tracking analytics. Monitor click conversions, scan traffic, and geographical distributions."
      />
      <!-- Date Filter Selector -->
      <div class="mt-5 lg:mt-0 shrink-0 flex items-center gap-1">
        <PoButton
          v-for="range in ['7 Days', '30 Days', 'All Time']"
          :key="range"
          :label="range"
          size="sm"
          :color="selectedRange === range ? undefined : 'slate'"
          :action-type="selectedRange === range ? undefined : 'ghost'"
          @button-click="selectedRange = range"
        />
      </div>
    </header>

    <!-- Global Stats blocks -->
    <PoStatsBlock
      :items="statsBlockItems"
      number-of-cols="grid-cols-2 lg:grid-cols-4 gap-4"
      class="mb-6"
    />

    <!-- Main Chart Card with Metric Switcher -->
    <div class="mb-6 bg-white rounded-xl p-5 border border-slate-200">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
        <div>
          <h4 class="text-sm font-semibold text-slate-800">Clicks & Scans Performance</h4>
          <p class="text-xs text-slate-500">Global traffic comparison over time</p>
        </div>
        <!-- Metric Switcher Dropdown -->
        <div class="w-full sm:w-56">
          <PoSelectField
            v-model="selectedMetric"
            label=""
            object
            :list="metricOptions"
            class="text-xs"
          />
        </div>
      </div>

      <ClicksChart
        :title="''"
        :subtitle="''"
        :series="chartSeries"
        :categories="analyticsData.dates"
        :type="selectedMetric?.id === 'all' ? 'line' : 'area'"
        :height="300"
        :colors="chartColors"
      />
    </div>

    <!-- Breakdown Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Top Links Table Card -->
      <PoCard class="p-6" title="Top Performing Links">
        <div v-if="topLinks.length === 0" class="text-center py-8">
          <LinkIcon class="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p class="text-xs text-slate-400">No link activity recorded yet.</p>
        </div>
        <div v-else class="space-y-4">
          <div
            v-for="link in topLinks"
            :key="link.id"
            class="flex items-center justify-between p-3 border border-slate-50 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <div class="space-y-0.5 truncate max-w-xs md:max-w-sm">
              <h4 class="text-xs font-bold text-slate-800 truncate">{{ link.title }}</h4>
              <a :href="'https://' + link.shortUrl" target="_blank" class="text-[0.68rem] text-indigo-600 font-semibold hover:underline block">
                {{ link.shortUrl }}
              </a>
            </div>
            <div class="flex items-center space-x-3 shrink-0">
              <div class="text-right">
                <span class="text-xs font-extrabold text-slate-700 block">{{ link.clicks }}</span>
                <span class="text-[0.62rem] text-slate-400 uppercase tracking-wider block">clicks</span>
              </div>
              <PoButton
                label="View"
                size="sm"
                color="slate"
                @button-click="router.push(`/links/${link.id}`)"
              />
            </div>
          </div>
        </div>
      </PoCard>

      <!-- Geographical Distribution Card (Countries & Cities) -->
      <PoCard class="p-6" title="Geographic Distribution">
        <template #action>
          <div class="flex items-center gap-1">
            <PoButton
              label="Countries"
              size="xs"
              :color="geoTab === 'countries' ? undefined : 'slate'"
              :action-type="geoTab === 'countries' ? undefined : 'ghost'"
              @button-click="geoTab = 'countries'"
            />
            <PoButton
              label="Cities"
              size="xs"
              :color="geoTab === 'cities' ? undefined : 'slate'"
              :action-type="geoTab === 'cities' ? undefined : 'ghost'"
              @button-click="geoTab = 'cities'"
            />
          </div>
        </template>
        <template #content>
          <div class="p-6 pt-2">
            <!-- Countries List -->
            <div v-if="geoTab === 'countries'" class="space-y-3.5">
              <div v-for="country in analyticsData.countries" :key="country.name" class="space-y-1">
                <div class="flex justify-between text-xs font-semibold">
                  <span class="text-slate-700 flex items-center gap-1.5">
                    <GlobeAltIcon class="w-3.5 h-3.5 text-slate-400" />
                    {{ country.name }}
                  </span>
                  <span class="text-slate-600 font-bold">{{ country.count }} ({{ country.percentage }}%)</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-2">
                  <div class="bg-emerald-600 h-2 rounded-full transition-all duration-500" :style="{ width: `${country.percentage}%` }"/>
                </div>
              </div>
            </div>

            <!-- Cities List -->
            <div v-else class="space-y-3.5">
              <div v-for="city in analyticsData.cities" :key="city.name" class="space-y-1">
                <div class="flex justify-between text-xs font-semibold">
                  <span class="text-slate-700 flex items-center gap-1.5">
                    <MapPinIcon class="w-3.5 h-3.5 text-slate-400" />
                    {{ city.name }} <span class="text-[0.68rem] text-slate-400 font-normal">({{ city.country }})</span>
                  </span>
                  <span class="text-slate-600 font-bold">{{ city.count }} ({{ city.percentage }}%)</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-2">
                  <div class="bg-indigo-600 h-2 rounded-full transition-all duration-500" :style="{ width: `${city.percentage}%` }"/>
                </div>
              </div>
            </div>
          </div>
        </template>
      </PoCard>

      <!-- Referrers Channels Card -->
      <PoCard class="p-6" title="Referrer Channels">
        <div class="space-y-3.5">
          <div v-for="ref in analyticsData.referrers" :key="ref.name" class="space-y-1">
            <div class="flex justify-between text-xs font-semibold">
              <span class="text-slate-600">{{ ref.name }}</span>
              <span class="text-slate-700 font-bold">{{ ref.count }} clicks ({{ ref.percentage }}%)</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-2">
              <div class="bg-indigo-600 h-2 rounded-full" :style="{ width: `${ref.percentage}%` }"/>
            </div>
          </div>
        </div>
      </PoCard>

      <!-- Device Types Card -->
      <PoCard class="p-6" title="Device Distribution">
        <div class="space-y-3.5">
          <div v-for="dev in analyticsData.devices" :key="dev.name" class="space-y-1">
            <div class="flex justify-between text-xs font-semibold">
              <span class="text-slate-600 flex items-center gap-1.5">
                <DevicePhoneMobileIcon v-if="dev.name === 'Mobile'" class="w-3.5 h-3.5 text-slate-400" />
                <ComputerDesktopIcon v-else-if="dev.name === 'Desktop'" class="w-3.5 h-3.5 text-slate-400" />
                <DeviceTabletIcon v-else class="w-3.5 h-3.5 text-slate-400" />
                {{ dev.name }}
              </span>
              <span class="text-slate-700 font-bold">{{ dev.count }} visitors ({{ dev.percentage }}%)</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-2">
              <div class="bg-sky-500 h-2 rounded-full" :style="{ width: `${dev.percentage}%` }"/>
            </div>
          </div>
        </div>
      </PoCard>
    </div>
  </PoContentArea>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from '#imports';
import {
  PoCard,
  PoContentArea,
  PoPageTitle,
  PoStatsBlock,
  PoButton,
  PoSelectField,
} from '@pension/ui-kit';
import {
  ChartBarIcon,
  LinkIcon,
  QrCodeIcon,
  GlobeAltIcon,
  MapPinIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  DeviceTabletIcon,
} from '@heroicons/vue/24/outline';
import { useShortUrlStore, type AnalyticsData } from '~/stores/shorturl';

definePageMeta({
  layout: 'main',
});

useHead({
  title: 'Unified Analytics Dashboard',
});

const store = useShortUrlStore();
const router = useRouter();
const selectedRange = ref('7 Days');

// Metric Switcher Options
const metricOptions = [
  { id: 'all', name: 'All Metrics Comparison' },
  { id: 'engagements', name: 'Total Engagements' },
  { id: 'clicks', name: 'Short Link Clicks' },
  { id: 'scans', name: 'QR Code Scans' },
];
const selectedMetric = ref(metricOptions[0]);

// Geographic Tab
const geoTab = ref<'countries' | 'cities'>('countries');

// Compute summary metrics
const totalClicks = computed(() => store.getTotalClicks);
const totalScans = computed(() => store.getTotalScans);
const totalLinks = computed(() => store.links.length);
const totalEngagements = computed(() => store.getTotalEngagements);

const statsBlockItems = computed(() => [
  {
    label: 'Total Clicks',
    value: totalClicks.value.toString(),
    diff: '↑ 14%',
    bgColor: 'bg-indigo-50',
    iconColor: 'text-indigo-700',
    icon: ChartBarIcon,
  },
  {
    label: 'Total Scans',
    value: totalScans.value.toString(),
    diff: '↑ 22%',
    bgColor: 'bg-emerald-50',
    iconColor: 'text-emerald-700',
    icon: QrCodeIcon,
  },
  {
    label: 'Active Links',
    value: totalLinks.value.toString(),
    diff: '+ ' + totalLinks.value,
    bgColor: 'bg-sky-50',
    iconColor: 'text-sky-700',
    icon: LinkIcon,
  },
  {
    label: 'Total Engagements',
    value: totalEngagements.value.toString(),
    diff: '↑ 18%',
    bgColor: 'bg-purple-50',
    iconColor: 'text-purple-700',
    icon: ChartBarIcon,
  },
]);

// Top Links sorted by clicks
const topLinks = computed(() => {
  return [...store.links].sort((a, b) => b.clicks - a.clicks).slice(0, 4);
});

// Analytics
const analyticsData = ref<AnalyticsData>({
  totalEngagements: 0,
  totalClicks: 0,
  totalScans: 0,
  dates: [],
  clicks: [],
  scans: [],
  engagements: [],
  countries: [],
  cities: [],
  devices: [],
  referrers: [],
});

// Was previously a dead control — selectedRange changed but nothing read it.
const rangeMap: Record<string, '7d' | '30d' | 'all'> = {
  '7 Days': '7d',
  '30 Days': '30d',
  'All Time': 'all',
};

async function loadAnalytics() {
  const data = await store.fetchAnalytics('global', 'global', rangeMap[selectedRange.value] || '7d');
  if (data) analyticsData.value = data;
}

onMounted(async () => {
  await store.fetchLinks();
  await store.fetchQRCodes();
  await loadAnalytics();
});

watch(selectedRange, loadAnalytics);

const chartSeries = computed(() => {
  const metric = selectedMetric.value?.id || 'all';
  if (metric === 'clicks') {
    return [{ name: 'Short Link Clicks', data: analyticsData.value.clicks }];
  } else if (metric === 'scans') {
    return [{ name: 'QR Code Scans', data: analyticsData.value.scans }];
  } else if (metric === 'engagements') {
    return [{ name: 'Total Engagements', data: analyticsData.value.engagements }];
  }
  return [
    {
      name: 'Short Link Clicks',
      data: analyticsData.value.clicks,
    },
    {
      name: 'QR Code Scans',
      data: analyticsData.value.scans,
    },
  ];
});

const chartColors = computed(() => {
  const metric = selectedMetric.value?.id || 'all';
  if (metric === 'clicks') return ['#4f46e5'];
  if (metric === 'scans') return ['#0ea5e9'];
  if (metric === 'engagements') return ['#8b5cf6'];
  return ['#4f46e5', '#0ea5e9'];
});
</script>
