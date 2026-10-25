<template>
  <PoContentArea>
    <header class="lg:flex lg:items-end justify-between border-b border-slate-200 pb-5 mb-5">
      <div class="min-w-0 flex-1">
        <PoPageTitle
          :stand-alone="true"
          label="GS Approvals"
          description="Authorize or reject petty cash requests before they go to Finance."
        />
      </div>
    </header>

    <PageSkeleton v-if="!store.isPageReady('/approvals')" :stats="4" />

    <div v-else class="space-y-5 pb-8">
      <PettyCashStats />

      <PoCard>
        <ListTable v-if="pendingRequests.length > 0" :columns="columns">
          <ListRow
            v-for="item in pendingRequests"
            :key="item.id"
            :to="`/requests/${item.id}`"
            :title="item.purpose"
            :meta="`${item.id} · ${item.requester.name} · ${formatDate(item.createdAt)}`"
            :amount="formatMoney(item.requestedAmount)"
            :cells="cells(item)"
          >
            <template #actions>
              <PoButton
                v-if="item.allowedActions.includes('reject')"
                size="sm"
                action-type="ghost"
                label="Reject"
                :icon="XMarkIcon"
                :disabled="store.busy"
                @button-click="openRejectModal(item)"
              />
              <PoButton
                v-if="item.allowedActions.includes('authorize')"
                size="sm"
                label="Authorize"
                :icon="CheckIcon"
                :disabled="store.busy"
                @button-click="handleAuthorize(item)"
              />
            </template>
          </ListRow>
        </ListTable>

        <div v-else class="p-8">
          <PoEmpty
            label="You're all caught up"
            description="No petty cash requests are waiting for GS approval."
            :icon="CheckCircleIcon"
            icon-color="fill-slate-400"
          />
        </div>
      </PoCard>
    </div>

    <PoModal
      :show="showRejectModal"
      modal-title="Reject request"
      modal-width="sm:max-w-md"
      @modal-closed="showRejectModal = false"
    >
      <template #content>
        <div v-if="rejectTarget" class="space-y-4">
          <PoDescriptionList
            density="compact"
            :items="[
              { title: 'Voucher no', description: rejectTarget.id },
              { title: 'Requester', description: rejectTarget.requester.name },
              { title: 'Particulars', description: rejectTarget.purpose },
              {
                title: 'Petty cash',
                description: `MVR ${formatMoney(rejectTarget.requestedAmount)}`,
              },
            ]"
          />
          <PoTextarea
            v-model="rejectReason"
            label="Reason"
            placeholder="Why is this request rejected?"
            rows="3"
          />
        </div>
      </template>
      <template #footer>
        <div class="p-4 flex justify-end gap-3">
          <PoButton
            label="Cancel"
            action-type="ghost"
            :disabled="store.busy"
            @button-click="showRejectModal = false"
          />
          <PoButton
            label="Reject request"
            action-type="danger"
            :disabled="store.busy"
            @button-click="handleConfirmReject"
          />
        </div>
      </template>
    </PoModal>
    <RequestPagination />
  </PoContentArea>
</template>

<script setup lang="ts">
import PageSkeleton from '~/components/petty-cash/PageSkeleton.vue';
import { formatDate, formatMoney } from '~/utils/pettyCashFormat';

import RequestPagination from '~/components/petty-cash/RequestPagination.vue';
import { computed, ref } from 'vue';
import { CheckCircleIcon, CheckIcon, XMarkIcon } from '@heroicons/vue/20/solid';
import {
  PoButton,
  PoCard,
  PoContentArea,
  PoDescriptionList,
  PoEmpty,
  PoModal,
  PoPageTitle,
  PoTextarea,
  useToastify,
} from '@pension/ui-kit';
import PettyCashStats from '~/components/petty-cash/PettyCashStats.vue';
import ListRow, { type ListCell } from '~/components/petty-cash/ListRow.vue';
import ListTable, { type ListColumn } from '~/components/petty-cash/ListTable.vue';
import { usePettyCashStore } from '~/stores/usePettyCashStore';
import type { PettyCashSummary as PettyCashRequest } from '~/types/pettyCash';

definePageMeta({
  layout: 'main',
});

useHead({
  title: 'Petty Cash — GS Approvals',
});

const store = usePettyCashStore();
const { showToast } = useToastify();

const pendingRequests = computed(() =>
  store.allRequests.filter((r) => r.status === 'pending_approval'),
);

async function handleAuthorize(req: PettyCashRequest) {
  try {
    await store.approveRequestByManager(req.id);
    showToast(`${req.id} authorized and sent to Finance`, 'success');
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not complete this action.', 'error');
  }
}

const showRejectModal = ref(false);
const rejectTarget = ref<PettyCashRequest | null>(null);
const rejectReason = ref('');

function openRejectModal(req: PettyCashRequest) {
  rejectTarget.value = req;
  rejectReason.value = '';
  showRejectModal.value = true;
}

async function handleConfirmReject() {
  try {
    if (!rejectTarget.value) return;
    await store.rejectRequestByManager(
      rejectTarget.value.id,
      rejectReason.value.trim() || 'Rejected by GS.',
    );
    showToast(`${rejectTarget.value.id} rejected`, 'info');
    showRejectModal.value = false;
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not complete this action.', 'error');
  }
}

// Desktop columns
const columns: ListColumn[] = [
  { label: 'Voucher no', width: '7.5rem' },
  { label: 'Requester', width: '8rem' },
  { label: 'Particulars' },
  { label: 'Petty cash (MVR)', width: '7rem', align: 'right' },
  { label: 'Decision', width: '12.5rem', actions: true },
];

function cells(item: PettyCashRequest): ListCell[] {
  return [
    { text: item.id, to: `/requests/${item.id}` },
    { text: item.requester.name },
    { text: item.purpose, sub: formatDate(item.createdAt), wrap: true },
    {
      text: formatMoney(item.requestedAmount),
      align: 'right',
      class: 'tabular-nums font-semibold text-slate-900',
    },
  ];
}
</script>
