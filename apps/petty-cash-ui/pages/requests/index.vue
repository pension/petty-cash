<template>
  <PoContentArea>
    <header class="lg:flex lg:items-end justify-between border-b border-slate-200 pb-5 mb-5">
      <div class="min-w-0 flex-1">
        <PoPageTitle
          :stand-alone="true"
          label="History"
          description="Closed petty cash requests. Download the voucher PDF for your records."
        />
      </div>
    </header>

    <PageSkeleton v-if="!store.isPageReady('/requests')" />

    <div v-else class="space-y-5 pb-8">
      <PoCard class="p-3 pl-4">
        <div class="flex flex-col lg:flex-row lg:items-center gap-3">
          <div class="grow">
            <PoSearch
              v-model="searchQuery"
              placeholder="Search voucher no, particulars, requester or Dynamics ref..."
            />
          </div>
          <div class="hidden sm:flex shrink-0 items-center gap-3">
            <span class="hidden lg:block border-l border-slate-300 h-4 w-px ml-1" />
            <PoPagination
              :total-pages="totalPages"
              :current-page="currentPage"
              @on-page-change="(p: number) => (currentPage = p)"
            />
          </div>
        </div>
      </PoCard>

      <PoCard>
        <ListTable v-if="filteredRequests.length > 0" :columns="columns">
          <ListRow
            v-for="item in paginatedRequests"
            :key="item.id"
            :cells="cells(item)"
            :to="`/requests/${item.id}`"
            :title="item.purpose"
            :meta="
              [
                item.id,
                `Closed ${formatDate(item.closedAt || item.updatedAt)}`,
                item.dynamicsReference,
              ]
                .filter(Boolean)
                .join(' · ')
            "
            :amount="formatMoney(floatAmount(item))"
          >
            <template #actions>
              <PoButton
                size="sm"
                action-type="ghost"
                label="PDF"
                :icon="ArrowDownTrayIcon"
                :disabled="store.busy || downloadingId === item.id"
                @button-click="handleDownload(item)"
              />
            </template>
          </ListRow>
        </ListTable>

        <PoEmpty
          v-else
          :label="searchQuery ? 'No matching requests' : 'No closed requests yet'"
          :description="
            searchQuery
              ? 'Try a different search.'
              : 'Requests appear here once Finance closes them.'
          "
        />
      </PoCard>

      <div v-if="totalPages > 1" class="flex justify-center sm:hidden">
        <PoPagination
          :total-pages="totalPages"
          :current-page="currentPage"
          @on-page-change="(p: number) => (currentPage = p)"
        />
      </div>
    </div>
  </PoContentArea>
</template>

<script setup lang="ts">
import PageSkeleton from '~/components/float/PageSkeleton.vue';
import { formatDate, formatMoney } from '~/utils/floatFormat';

import { computed, ref, watch } from 'vue';
import { ArrowDownTrayIcon } from '@heroicons/vue/20/solid';
import {
  PoButton,
  PoCard,
  PoContentArea,
  PoEmpty,
  PoPageTitle,
  PoPagination,
  PoSearch,
} from '@pension/ui-kit';
import ListRow, { type ListCell } from '~/components/float/ListRow.vue';
import ListTable, { type ListColumn } from '~/components/float/ListTable.vue';
import { useFloatStore } from '~/stores/useFloatStore';
import type { PettyCashSummary as PettyCashRequest } from '~/types/float';
import { downloadRequestPdf } from '~/utils/floatPdf';
import { floatAmount } from '~/utils/floatStatus';

definePageMeta({
  layout: 'main',
});

useHead({
  title: 'Petty Cash — History',
});

const store = useFloatStore();

const searchQuery = ref('');
const currentPage = ref(1);
const itemsPerPage = 10;

const closedRequests = computed(() => store.allRequests);
const filteredRequests = closedRequests;
const paginatedRequests = closedRequests;
const totalPages = computed(() => Math.ceil(store.listTotal / itemsPerPage) || 1);
watch([searchQuery, currentPage], async () => {
  try {
    await store.fetchRequests({
      status: 'closed',
      sort: 'closedAt',
      order: 'desc',
      q: searchQuery.value,
      page: currentPage.value,
      pageSize: itemsPerPage,
    });
  } catch (err) {
    store.error = err instanceof Error ? err.message : 'Could not load history.';
  }
});
watch(searchQuery, () => {
  currentPage.value = 1;
});

// Desktop columns
const columns: ListColumn[] = [
  { label: 'Closed', width: '6rem' },
  { label: 'Voucher no', width: '7.5rem' },
  { label: 'Particulars' },
  { label: 'Petty cash (MVR)', width: '7rem', align: 'right' },
  { label: 'Dynamics ref', width: '8rem' },
  { label: 'Download', width: '6rem', actions: true },
];

function cells(item: PettyCashRequest): ListCell[] {
  return [
    { text: formatDate(item.closedAt || item.updatedAt), class: 'tabular-nums' },
    { text: item.id, to: `/requests/${item.id}` },
    { text: item.purpose, wrap: true },
    {
      text: formatMoney(floatAmount(item)),
      align: 'right',
      class: 'tabular-nums font-semibold text-slate-900',
    },
    {
      text: item.dynamicsReference || '—',
      class: item.dynamicsReference ? 'font-mono text-xs' : 'text-slate-400',
    },
  ];
}

const downloadingId = ref<string | null>(null);

async function handleDownload(item: PettyCashRequest) {
  downloadingId.value = item.id;
  try {
    await downloadRequestPdf(await store.fetchRequest(item.id));
  } finally {
    downloadingId.value = null;
  }
}
</script>
