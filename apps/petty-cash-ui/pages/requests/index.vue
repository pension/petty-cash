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
              :model-value="searchQuery"
              placeholder="Search voucher no, particulars, requester or Dynamics ref..."
              @button-click="loadHistory(1)"
              @update:model-value="searchHistory"
            />
          </div>
          <div class="hidden sm:flex shrink-0 items-center gap-3">
            <span class="hidden lg:block border-l border-slate-300 h-4 w-px ml-1" />
            <PoPagination
              :total-pages="totalPages"
              :current-page="currentPage"
              @prev-click="changePage(currentPage - 1)"
              @next-click="changePage(currentPage + 1)"
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
            :amount="formatMoney(pettyCashAmount(item))"
          >
            <template #actions>
              <PoButton
                size="sm"
                action-type="ghost"
                label="PDF"
                :icon="ArrowDownTrayIcon"
                :disabled="store.busy || downloadingId !== null"
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
          @prev-click="changePage(currentPage - 1)"
          @next-click="changePage(currentPage + 1)"
        />
      </div>
    </div>
  </PoContentArea>
</template>

<script setup lang="ts">
import PageSkeleton from '~/components/petty-cash/PageSkeleton.vue';
import { formatDate, formatMoney } from '~/utils/pettyCashFormat';

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
  useToastify,
} from '@pension/ui-kit';
import ListRow, { type ListCell } from '~/components/petty-cash/ListRow.vue';
import ListTable, { type ListColumn } from '~/components/petty-cash/ListTable.vue';
import { usePettyCashStore } from '~/stores/usePettyCashStore';
import type { PettyCashSummary as PettyCashRequest } from '~/types/pettyCash';
import { downloadRequestPdf } from '~/utils/pettyCashPdf';
import { pettyCashAmount } from '~/utils/pettyCashStatus';

definePageMeta({
  layout: 'main',
});

useHead({
  title: 'Petty Cash — History',
});

const store = usePettyCashStore();
const { showToast } = useToastify();

const searchQuery = ref(String(store.requestQuery.q || ''));
const currentPage = computed(() => store.listPage);
const itemsPerPage = 10;

const closedRequests = computed(() => store.allRequests);
const filteredRequests = closedRequests;
const paginatedRequests = closedRequests;
const totalPages = computed(() => Math.ceil(store.listTotal / itemsPerPage) || 1);
async function loadHistory(page: number) {
  try {
    await store.fetchRequests(
      {
        status: 'closed',
        sort: 'closedAt',
        order: 'desc',
        q: searchQuery.value.trim(),
        page,
        pageSize: itemsPerPage,
      },
      '/requests/history',
    );
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not load history.', 'error');
  }
}
watch(
  () => store.requestQuery.q,
  (query) => {
    const value = String(query || '');
    if (searchQuery.value.trim() !== value) searchQuery.value = value;
  },
);
async function searchHistory(value: string) {
  searchQuery.value = value;
  await loadHistory(1);
}
async function changePage(page: number) {
  if (store.listLoading || store.busy || page < 1 || page > totalPages.value) return;
  await loadHistory(page);
}

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
      text: formatMoney(pettyCashAmount(item)),
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
  if (downloadingId.value) return;
  downloadingId.value = item.id;
  try {
    await downloadRequestPdf(await store.fetchRequest(item.id), store.receiptBlob);
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not generate the voucher.', 'error');
  } finally {
    downloadingId.value = null;
  }
}
</script>
