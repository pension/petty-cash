<template>
  <PoContentArea>
    <header class="lg:flex lg:items-end justify-between border-b border-slate-200 pb-5 mb-5">
      <div class="min-w-0 flex-1">
        <PoPageTitle
          :stand-alone="true"
          label="Requests"
          description="Request petty cash, collect it from Finance, and settle with your receipts."
        />
      </div>
    </header>

    <PageSkeleton v-if="!store.isPageReady('/')" :stats="4" />

    <div v-else class="space-y-6 pb-8">
      <PettyCashStats />

      <section class="space-y-3">
        <div
          class="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 sm:border-b border-slate-200/80"
        >
          <div class="flex items-center gap-2">
            <PoHeading type="h2" size="sm" class="text-slate-900">My Active Petty Cash</PoHeading>
            <PoStatusPill
              v-if="store.listTotal"
              :label="`${store.listTotal}`"
              color="blue"
            />
          </div>
          <PoButton
            v-if="store.currentUser.capabilities.createRequest"
            class="w-full sm:w-auto [&>span]:justify-center"
            label="Petty cash request"
            :icon="PlusIcon"
            @button-click="openNewRequestModal"
          />
        </div>

        <PoCard>
          <ListTable v-if="myActiveRequests.length > 0" :columns="columns">
            <ListRow
              v-for="item in myActiveRequests"
              :key="item.id"
              :to="`/requests/${item.id}`"
              :title="item.purpose"
              :meta="`${item.id} · ${formatDate(item.createdAt)}`"
              :amount="formatMoney(pettyCashAmount(item))"
              :status="pettyCashStatus(item.status)"
              :cells="cells(item)"
            >
              <template
                v-if="
                  item.allowedActions.some((a) =>
                    ['edit', 'confirmReceipt', 'addExpense'].includes(a),
                  )
                "
                #actions
              >
                <PoButton
                  v-if="item.allowedActions.includes('edit')"
                  size="sm"
                  action-type="ghost"
                  label="Edit"
                  :icon="PencilSquareIcon"
                  :disabled="store.busy"
                  @button-click="openEditModal(item)"
                />
                <PoButton
                  v-else-if="item.allowedActions.includes('confirmReceipt')"
                  size="sm"
                  label="Confirm receipt"
                  :icon="CheckIcon"
                  :disabled="store.busy"
                  @button-click="handleConfirmReceived(item)"
                />
                <PoButton
                  v-else
                  size="sm"
                  :label="
                    item.status === 'returned_for_correction' ? 'Correct receipts' : 'Add receipts'
                  "
                  :icon="ArrowRightIcon"
                  :disabled="store.busy"
                  @button-click="router.push(`/requests/${item.id}`)"
                />
              </template>
            </ListRow>
          </ListTable>

          <div v-else class="p-8">
            <PoEmpty
              label="No active petty cash"
              description="Use Petty cash request when you need cash for a purchase."
              :icon="BanknotesIcon"
              icon-color="fill-slate-400"
            />
          </div>
        </PoCard>
      </section>
    </div>

    <PettyCashRequestModal
      :show="showRequestModal"
      :request="editTarget"
      @close="showRequestModal = false"
    />
    <RequestPagination />
  </PoContentArea>
</template>

<script setup lang="ts">
import PageSkeleton from '~/components/petty-cash/PageSkeleton.vue';
import { formatDate, formatMoney } from '~/utils/pettyCashFormat';

import RequestPagination from '~/components/petty-cash/RequestPagination.vue';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  ArrowRightIcon,
  BanknotesIcon,
  CheckIcon,
  PencilSquareIcon,
  PlusIcon,
} from '@heroicons/vue/20/solid';
import {
  PoButton,
  PoCard,
  PoContentArea,
  PoEmpty,
  PoHeading,
  PoPageTitle,
  PoStatusPill,
  useToastify,
} from '@pension/ui-kit';
import PettyCashStats from '~/components/petty-cash/PettyCashStats.vue';
import ListRow, { type ListCell } from '~/components/petty-cash/ListRow.vue';
import ListTable, { type ListColumn } from '~/components/petty-cash/ListTable.vue';
import PettyCashRequestModal from '~/components/petty-cash/PettyCashRequestModal.vue';
import { usePettyCashStore } from '~/stores/usePettyCashStore';
import type { PettyCashSummary as PettyCashRequest, RequestStatus } from '~/types/pettyCash';
import { pettyCashAmount, pettyCashStatus } from '~/utils/pettyCashStatus';

definePageMeta({
  layout: 'main',
});

useHead({
  title: 'Petty Cash — Requests',
});

const router = useRouter();
const store = usePettyCashStore();
const { showToast } = useToastify();

const INACTIVE: RequestStatus[] = ['closed', 'rejected', 'cancelled'];

const myActiveRequests = computed(() =>
  store.allRequests.filter(
    (r) => r.requester.id === store.currentUser.id && !INACTIVE.includes(r.status),
  ),
);

async function handleConfirmReceived(req: PettyCashRequest) {
  try {
    await store.collectCash(req.id);
    showToast(`Receipt of MVR ${formatMoney(pettyCashAmount(req))} confirmed`, 'success');
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not complete this action.', 'error');
  }
}

// New / edit request
const showRequestModal = ref(false);
const editTarget = ref<PettyCashRequest | null>(null);

function openNewRequestModal() {
  editTarget.value = null;
  showRequestModal.value = true;
}

function openEditModal(req: PettyCashRequest) {
  editTarget.value = req;
  showRequestModal.value = true;
}

// Desktop columns
const columns: ListColumn[] = [
  { label: 'Date', width: '6rem' },
  { label: 'Voucher no', width: '7.5rem' },
  { label: 'Particulars' },
  { label: 'Petty cash (MVR)', width: '7rem', align: 'right' },
  { label: 'Status', width: '10rem' },
  { label: 'Action', width: '9.5rem', actions: true },
];

function cells(item: PettyCashRequest): ListCell[] {
  return [
    { text: formatDate(item.createdAt), class: 'tabular-nums' },
    { text: item.id, to: `/requests/${item.id}` },
    { text: item.purpose, wrap: true },
    {
      text: formatMoney(pettyCashAmount(item)),
      align: 'right',
      class: 'tabular-nums font-semibold text-slate-900',
    },
    { status: pettyCashStatus(item.status) },
  ];
}
</script>
