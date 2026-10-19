<template>
  <PoContentArea>
    <!-- Handle non-existent item -->
    <div v-if="!item" class="text-center py-16 bg-white rounded-xl border border-slate-200">
      <ChartBarIcon class="w-16 h-16 text-slate-300 mx-auto mb-4" />
      <h2 class="text-xl font-bold text-slate-800">Analytics Data Not Found</h2>
      <p class="text-slate-500 mt-2">The resource you are looking for does not exist or has no recorded analytics.</p>
      <div class="mt-6">
        <NuxtLink to="/analytics">
          <PoButton label="Back to Analytics" action-type="ghost" />
        </NuxtLink>
      </div>
    </div>

    <div v-else class="space-y-6">
      <header class="lg:flex lg:items-end justify-between">
        <div class="space-y-1">
          <PoPageTitle
            :stand-alone="true"
            :label="item.title + ' Reports'"
            :description="'Granular performance report and visitor demographics for ' + item.id"
          />
        </div>
        <div class="mt-5 lg:mt-0 shrink-0 flex items-center gap-2">
          <PoButton
            label="Back"
            action-type="ghost"
            @button-click="goBack"
          />
        </div>
      </header>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white p-5 rounded-xl border border-slate-200 flex items-center space-x-4">
          <div class="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
            <ChartBarIcon class="w-6 h-6" />
          </div>
          <div>
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Engagements</span>
            <span class="text-2xl font-bold text-slate-800">{{ totalTraffic }}</span>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl border border-slate-200 flex items-center space-x-4">
          <div class="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <GlobeAltIcon class="w-6 h-6" />
          </div>
          <div>
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Top Country</span>
            <span class="text-xl font-bold text-slate-800">Maldives (62%)</span>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl border border-slate-200 flex items-center space-x-4">
          <div class="p-3 bg-sky-50 text-sky-700 rounded-xl">
            <DevicePhoneMobileIcon class="w-6 h-6" />
          </div>
          <div>
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Top Device</span>
            <span class="text-xl font-bold text-slate-800">Mobile (71%)</span>
          </div>
        </div>

        <div class="bg-white p-5 rounded-xl border border-slate-200 flex items-center space-x-4">
          <div class="p-3 bg-purple-50 text-purple-700 rounded-xl">
            <CursorArrowRaysIcon class="w-6 h-6" />
          </div>
          <div>
            <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Conversion Rate</span>
            <span class="text-xl font-bold text-slate-800">91.4%</span>
          </div>
        </div>
      </div>

      <!-- Chart and Details -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left Side: Over-Time Chart & Geographic/Device Breakdown -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Time-Series Chart Card -->
          <PoCard class="p-5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h4 class="text-sm font-semibold text-slate-800">Engagement History</h4>
                <p class="text-xs text-slate-500">Traffic trends over the last 7 days</p>
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
              :height="280"
              :colors="chartColors"
            />
          </PoCard>

          <!-- Geographic Distribution Card with Countries & Cities Tabs -->
          <PoCard class="p-5" title="Geographical Breakdown">
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
              <div class="p-5 pt-2">
                <!-- Countries Tab -->
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

                <!-- Cities Tab -->
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

          <!-- Referrers and Devices Row -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PoCard class="p-5" title="Referrers Breakdown">
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

            <PoCard class="p-5" title="Device Breakdown">
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
        </div>

        <!-- Right Side: Details list -->
        <PoCard class="p-6 h-fit" title="Resource Summary">
          <div class="space-y-4 text-sm">
            <div>
              <span class="text-xs text-slate-400 block font-semibold uppercase tracking-wider">Title</span>
              <span class="font-bold text-slate-800 block mt-1">{{ item.title }}</span>
            </div>

            <hr class="border-slate-100" >

            <div>
              <span class="text-xs text-slate-400 block font-semibold uppercase tracking-wider">Type</span>
              <span class="font-semibold text-indigo-600 block mt-1 capitalize">{{ itemType === 'qrcode' ? 'QR Code' : 'Shortened Link' }}</span>
            </div>

            <hr class="border-slate-100" >

            <div>
              <span class="text-xs text-slate-400 block font-semibold uppercase tracking-wider">Target Destination</span>
              <a :href="item.longUrl" target="_blank" class="text-slate-600 hover:text-indigo-600 hover:underline break-all block mt-1">
                {{ item.longUrl }}
              </a>
            </div>

            <template v-if="itemType === 'link'">
              <hr class="border-slate-100" >
              <div>
                <span class="text-xs text-slate-400 block font-semibold uppercase tracking-wider">Short URL</span>
                <a :href="'https://' + (item as any).shortUrl" target="_blank" class="font-semibold text-indigo-600 hover:underline block mt-1">
                  {{ (item as any).shortUrl }}
                </a>
              </div>

              <hr class="border-slate-100" >
              <div>
                <span class="text-xs text-slate-400 block font-semibold uppercase tracking-wider">Expiration</span>
                <span class="font-medium text-slate-700 block mt-1">
                  {{ (item as any).expiresAt || 'Never expires' }}
                </span>
              </div>
            </template>

            <template v-if="itemType === 'qrcode'">
              <hr class="border-slate-100" >
              <div>
                <span class="text-xs text-slate-400 block font-semibold uppercase tracking-wider">QR Style</span>
                <span class="font-medium text-slate-700 block mt-1 capitalize">
                  {{ (item as any).style }}
                </span>
              </div>
            </template>
          </div>
        </PoCard>
      </div>
    </div>
  </PoContentArea>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from '#imports';
import {
  PoCard,
  PoContentArea,
  PoPageTitle,
  PoButton,
  PoSelectField,
} from '@pension/ui-kit';
import {
  ChartBarIcon,
  GlobeAltIcon,
  CursorArrowRaysIcon,
  MapPinIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  DeviceTabletIcon,
} from '@heroicons/vue/24/outline';
import { useShortUrlStore, type AnalyticsData, type QRCodeItem } from '~/stores/shorturl';

definePageMeta({
  layout: 'main',
});

useHead({
  title: 'Item Analytics Details',
});

const route = useRoute();
const router = useRouter();
const store = useShortUrlStore();

const itemId = computed(() => route.params.id as string);

// Detect if it is a link or QR code
const link = computed(() => store.getLinkById(itemId.value));
const qr = computed(() => store.getQRCodeById(itemId.value));

const item = computed(() => link.value || qr.value);
const itemType = computed(() => (qr.value ? 'qrcode' : 'link'));

const totalTraffic = computed(() => {
  if (!item.value) return 0;
  return 'clicks' in item.value ? item.value.clicks : (item.value as QRCodeItem).scans;
});

// Metric Switcher Options
const metricOptions = [
  { id: 'engagements', name: 'Total Engagements' },
  { id: 'clicks', name: 'Link Clicks' },
  { id: 'scans', name: 'QR Code Scans' },
  { id: 'all', name: 'All Metrics Comparison' },
];
const selectedMetric = ref(metricOptions[0]);

// Geographic Tab
const geoTab = ref<'countries' | 'cities'>('countries');

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

onMounted(async () => {
  // itemId could be either a link or a QR code — try link first, fall back
  // to QR code, so itemType (derived from which lookup succeeded) resolves
  // before fetching the matching analytics.
  const foundLink = await store.fetchLink(itemId.value);
  if (!foundLink) {
    await store.fetchQRCode(itemId.value);
  }
  const data = await store.fetchAnalytics(itemId.value, itemType.value);
  if (data) analyticsData.value = data;
});

const chartSeries = computed(() => {
  const metric = selectedMetric.value?.id || 'engagements';
  if (metric === 'clicks') {
    return [{ name: 'Link Clicks', data: analyticsData.value.clicks }];
  } else if (metric === 'scans') {
    return [{ name: 'QR Scans', data: analyticsData.value.scans }];
  } else if (metric === 'all') {
    return [
      { name: 'Link Clicks', data: analyticsData.value.clicks },
      { name: 'QR Scans', data: analyticsData.value.scans },
      { name: 'Total Engagement', data: analyticsData.value.engagements },
    ];
  }
  return [
    {
      name: itemType.value === 'qrcode' ? 'QR Scans' : 'Link Clicks',
      data: itemType.value === 'qrcode' ? analyticsData.value.scans : analyticsData.value.clicks,
    },
  ];
});

const chartColors = computed(() => {
  const metric = selectedMetric.value?.id || 'engagements';
  if (metric === 'clicks') return ['#4f46e5'];
  if (metric === 'scans') return ['#0ea5e9'];
  if (metric === 'all') return ['#4f46e5', '#0ea5e9', '#8b5cf6'];
  return [itemType.value === 'qrcode' ? '#0f766e' : '#4f46e5'];
});

const goBack = () => {
  router.back();
};
</script>
