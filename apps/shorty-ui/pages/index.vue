<template>
  <PoContentArea>
    <header class="lg:flex lg:items-end justify-between mb-4">
      <PoPageTitle
        class="grow"
        :stand-alone="true"
        label="Dashboard"
        description="Quickly shorten URLs, generate custom QR codes, and track engagement and clicks."
      />
      <div class="mt-5 lg:mt-0 shrink-0 flex items-center gap-2 flex-wrap">
        <PoButton
          label="Create Link"
          :icon="PlusIcon"
          @button-click="router.push('/links/create')"
        />
      </div>
    </header>

    <PoStatsBlock
      :items="statsBlockItems"
      number-of-cols="grid-cols-2 lg:grid-cols-4 gap-4"
      class="mb-6"
    />

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Quick Shorten Link Panel -->
      <div class="lg:col-span-2 space-y-6">
        <PoCard class="p-6" title="Shorten a long URL">
          <template v-if="!createdLink">
            <form class="space-y-4" @submit.prevent="handleShorten">
              <PoInputField
                v-model="form.longUrl"
                label="Destination URL"
                placeholder="https://example.com/very/long/path/to/resource"
                :error-message="errors.longUrl"
                info="Paste the long URL you want to shorten."
              />
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PoInputField
                  v-model="form.title"
                  label="Title (Optional)"
                  placeholder="e.g. My Website Link"
                />
                <PoInputField
                  v-model="form.customBackHalf"
                  label="Custom back-half (Optional)"
                  placeholder="e.g. my-promo"
                  info="The text that appears at the end of your short URL."
                />
              </div>
              <div class="flex justify-end pt-2">
                <PoButton
                  type="submit"
                  label="Shorten Link"
                  :disabled="isSubmitting"
                />
              </div>
            </form>
          </template>
          <template v-else>
            <div class="bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
              <div class="flex items-center space-x-2">
                <span class="p-2 bg-green-100 text-green-700 rounded-lg">
                  <LinkIcon class="w-5 h-5" />
                </span>
                <div>
                  <h4 class="text-sm font-semibold text-green-800">Your shortened link is ready!</h4>
                  <p class="text-xs text-green-600">You can now share it anywhere.</p>
                </div>
              </div>

              <div class="bg-white border border-slate-200 rounded-lg p-3 flex items-center justify-between">
                <div class="truncate mr-4">
                  <span class="text-xs text-slate-400 block">Short URL</span>
                  <a :href="'https://' + createdLink.shortUrl" target="_blank" class="text-sm font-semibold text-indigo-600 hover:underline">
                    {{ createdLink.shortUrl }}
                  </a>
                </div>
                <div class="flex items-center space-x-2">
                  <PoButton
                    label="Copy"
                    :icon="DocumentDuplicateIcon"
                    size="sm"
                    @click="copyShortUrl(createdLink.shortUrl)"
                  />
                  <PoButton
                    label="Shorten another"
                    size="sm"
                    color="slate"
                    @click="resetForm"
                  />
                </div>
              </div>

              <div class="text-xs text-slate-500">
                <span class="font-medium">Destination:</span>
                <span class="truncate block max-w-lg">{{ createdLink.longUrl }}</span>
              </div>
            </div>
          </template>
        </PoCard>

        <!-- Recent Links List -->
        <PoCard class="p-6" title="Recent Links">
          <div v-if="recentLinks.length === 0" class="text-center py-8">
            <LinkIcon class="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p class="text-sm text-slate-500">No links created yet. Shorten one above!</p>
          </div>
          <div v-else class="space-y-4">
            <div v-for="link in recentLinks" :key="link.id" class="flex flex-col md:flex-row md:items-center justify-between p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
              <div class="space-y-1 truncate max-w-md">
                <div class="flex items-center space-x-2">
                  <h4 class="text-sm font-semibold text-slate-800 truncate">{{ link.title }}</h4>
                  <span class="text-xs text-slate-400 font-normal">{{ link.created }}</span>
                </div>
                <a :href="'https://' + link.shortUrl" target="_blank" class="text-xs font-medium text-indigo-600 hover:underline block">
                  {{ link.shortUrl }}
                </a>
                <span class="text-[0.72rem] text-slate-400 truncate block max-w-sm">
                  {{ link.longUrl }}
                </span>
                <div class="flex items-center space-x-1.5 mt-1 flex-wrap gap-y-1">
                  <PoStatusPill
                    v-for="tag in link.tags"
                    :key="tag"
                    :label="tag"
                    custom-bg-color="bg-slate-100"
                    custom-text-color="text-slate-700"
                  />
                </div>
              </div>
              <div class="flex items-center justify-between md:justify-end gap-4 mt-3 md:mt-0">
                <div class="text-right">
                  <span class="text-sm font-semibold text-slate-700 block">{{ link.clicks }}</span>
                  <span class="text-[0.65rem] text-slate-400 uppercase tracking-wider block">clicks</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <PoTableAction
                    btn-type="icon"
                    :btn-icon="DocumentDuplicateIcon"
                    label="Copy Link"
                    icon-color="stroke-slate-500"
                    @click="copyShortUrl(link.shortUrl)"
                  />
                  <PoTableAction
                    btn-type="view"
                    @click="router.push(`/links/${link.id}`)"
                  />
                </div>
              </div>
            </div>
            <div class="text-center pt-2">
              <NuxtLink to="/links" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline">
                View all links &rarr;
              </NuxtLink>
            </div>
          </div>
        </PoCard>
      </div>

      <!-- Quick Clicks Chart Card -->
      <div class="space-y-6">
        <ClicksChart
          title="Overall Performance"
          subtitle="Clicks & scans over the last 7 days"
          :series="chartSeries"
          :categories="analyticsData.dates"
          type="line"
          :height="260"
        />

        <!-- Top Referrers Panel -->
        <PoCard class="p-6" title="Top Referrers">
          <div class="space-y-3">
            <div v-for="ref in analyticsData.referrers.slice(0, 4)" :key="ref.name" class="space-y-1">
              <div class="flex justify-between text-xs font-medium">
                <span class="text-slate-600">{{ ref.name }}</span>
                <span class="text-slate-700 font-semibold">{{ ref.count }} ({{ ref.percentage }}%)</span>
              </div>
              <div class="w-full bg-slate-100 rounded-full h-1.5">
                <div class="bg-indigo-600 h-1.5 rounded-full" :style="{ width: `${ref.percentage}%` }"/>
              </div>
            </div>
          </div>
        </PoCard>
      </div>
    </div>
  </PoContentArea>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from '#imports';
import {
  PoCard,
  PoContentArea,
  PoPageTitle,
  PoInputField,
  PoButton,
  PoStatsBlock,
  PoStatusPill,
  PoTableAction,
  useToastify,
} from '@pension/ui-kit';
import {
  PlusIcon,
  QrCodeIcon,
  LinkIcon,
  ChartBarIcon,
  DocumentDuplicateIcon,
} from '@heroicons/vue/24/outline';
import { useShortUrlStore, type AnalyticsData, type LinkItem } from '~/stores/shorturl';

definePageMeta({
  layout: 'main',
});

useHead({
  title: 'petty-cash Dashboard',
});

const store = useShortUrlStore();
const router = useRouter();
const { showToast } = useToastify();

// Form States
const form = ref({
  longUrl: '',
  title: '',
  customBackHalf: '',
});

const errors = ref({
  longUrl: '',
});

const isSubmitting = ref(false);
const createdLink = ref<LinkItem | null>(null);

// Getters & Computeds
const recentLinks = computed(() => store.links.slice(0, 3));
const totalClicks = computed(() => store.getTotalClicks);
const totalScans = computed(() => store.getTotalScans);

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
    label: 'Short Links',
    value: store.links.length.toString(),
    diff: '+ ' + store.links.length,
    bgColor: 'bg-emerald-50',
    iconColor: 'text-emerald-700',
    icon: LinkIcon,
  },
  {
    label: 'QR Scans',
    value: totalScans.value.toString(),
    diff: '↑ 22%',
    bgColor: 'bg-sky-50',
    iconColor: 'text-sky-700',
    icon: QrCodeIcon,
  },
  {
    label: 'Total Engagement',
    value: store.getTotalEngagements.toString(),
    diff: '↑ 18%',
    bgColor: 'bg-purple-50',
    iconColor: 'text-purple-700',
    icon: ChartBarIcon,
  },
]);

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
  await store.fetchLinks();
  await store.fetchQRCodes();
  const data = await store.fetchAnalytics('global', 'global');
  if (data) analyticsData.value = data;
});

const chartSeries = computed(() => [
  {
    name: 'Link Clicks',
    data: analyticsData.value.clicks,
  },
  {
    name: 'QR Scans',
    data: analyticsData.value.scans,
  },
]);

// Handlers
const handleShorten = async () => {
  errors.value.longUrl = '';

  if (!form.value.longUrl) {
    errors.value.longUrl = 'Destination URL is required';
    return;
  }

  // Validate URL shape
  try {
    if (!form.value.longUrl.startsWith('http://') && !form.value.longUrl.startsWith('https://')) {
      form.value.longUrl = 'https://' + form.value.longUrl;
    }
    new URL(form.value.longUrl);
  } catch {
    errors.value.longUrl = 'Please enter a valid URL';
    return;
  }

  isSubmitting.value = true;

  try {
    const link = await store.addLink(
      form.value.title,
      form.value.longUrl,
      form.value.customBackHalf || undefined
    );
    createdLink.value = link;
    showToast('Link shortened successfully!', 'success');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong shortening this link';
    errors.value.longUrl = message;
    showToast(message, 'error');
  } finally {
    isSubmitting.value = false;
  }
};

const copyShortUrl = (shortUrl: string) => {
  navigator.clipboard.writeText(shortUrl).then(() => {
    showToast('Short URL copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy to clipboard', 'error');
  });
};

const resetForm = () => {
  form.value = {
    longUrl: '',
    title: '',
    customBackHalf: '',
  };
  createdLink.value = null;
};
</script>
