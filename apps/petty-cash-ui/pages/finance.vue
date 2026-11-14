<template>
  <PoContentArea>
    <header class="lg:flex lg:items-end justify-between border-b border-slate-200 pb-5 mb-5">
      <div class="min-w-0 flex-1">
        <PoPageTitle
          :stand-alone="true"
          label="Finance Desk"
          description="Disburse authorized petty cash, follow up on settlements and close them."
        />
      </div>
    </header>

    <PageSkeleton v-if="!store.isPageReady('/finance')" :stats="4" />

    <div v-else class="space-y-5 pb-8">
      <PettyCashStats />

      <PoTabs :tabs="tabs" :current-tab="activeTab" @button-click="changeTab" />

      <PoCard>
        <ListTable v-if="activeList.length > 0" :columns="columns">
          <ListRow
            v-for="item in activeList"
            :key="item.id"
            :to="`/requests/${item.id}`"
            :title="item.purpose"
            :meta="`${item.id} · ${item.requester.name}`"
            :amount="formatMoney(rowAmount(item))"
            :status="showStatus(item) ? pettyCashStatus(item.status) : undefined"
            :cells="cells(item)"
          >
            <template
              v-if="activeTab === TAB_PENDING && item.status === 'pending_finance'"
              #actions
            >
              <PoButton
                v-if="item.allowedActions.includes('notifyCollection')"
                size="sm"
                label="Notify for collection"
                :icon="BellAlertIcon"
                :disabled="store.busy"
                @button-click="openNotifyModal(item)"
              />
            </template>
            <template v-else-if="activeTab === TAB_DISBURSED" #actions>
              <PoButton
                v-if="item.allowedActions.includes('sendReminder')"
                size="sm"
                action-type="ghost"
                label="Send reminder"
                :icon="EnvelopeIcon"
                :disabled="store.busy"
                @button-click="handleSendReminder(item)"
              />
            </template>
            <template v-else-if="activeTab === TAB_SETTLED" #actions>
              <PoButton
                v-if="item.allowedActions.includes('finalize')"
                size="sm"
                label="Finalize"
                :icon="ArchiveBoxIcon"
                :disabled="store.busy"
                @button-click="router.push(`/requests/${item.id}`)"
              />
            </template>
          </ListRow>
        </ListTable>

        <div v-else class="p-8">
          <PoEmpty
            :label="emptyState.label"
            :description="emptyState.description"
            :icon="InboxIcon"
            icon-color="fill-slate-400"
          />
        </div>
      </PoCard>
    </div>

    <NotifyCollectionModal
      :show="showNotifyModal"
      :request="notifyTarget"
      @close="showNotifyModal = false"
    />
    <RequestPagination />
  </PoContentArea>
</template>

<script setup lang="ts">
import PageSkeleton from '~/components/petty-cash/PageSkeleton.vue';
import { formatMoney } from '~/utils/pettyCashFormat';

import RequestPagination from '~/components/petty-cash/RequestPagination.vue';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  ArchiveBoxIcon,
  BanknotesIcon,
  BellAlertIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  EnvelopeIcon,
  InboxIcon,
} from '@heroicons/vue/20/solid';
import {
  PoButton,
  PoCard,
  PoContentArea,
  PoEmpty,
  PoPageTitle,
  PoTabs,
  type Tab,
  useToastify,
} from '@pension/ui-kit';
import PettyCashStats from '~/components/petty-cash/PettyCashStats.vue';
import ListRow, { type ListCell } from '~/components/petty-cash/ListRow.vue';
import ListTable, { type ListColumn } from '~/components/petty-cash/ListTable.vue';
import NotifyCollectionModal from '~/components/petty-cash/NotifyCollectionModal.vue';
import { usePettyCashStore } from '~/stores/usePettyCashStore';
import type { PettyCashSummary as PettyCashRequest, RequestStatus } from '~/types/pettyCash';
import { pettyCashAmount, pettyCashStatus } from '~/utils/pettyCashStatus';

definePageMeta({
  layout: 'main',
});

useHead({
  title: 'Petty Cash — Finance Desk',
});

const router = useRouter();
const store = usePettyCashStore();
const { showToast } = useToastify();

const TAB_HEADS_UP = 'Heads-up';
const TAB_PENDING = 'Pending Disbursement';
const TAB_DISBURSED = 'Disbursed';
const TAB_SETTLED = 'Settled';

const statuses: Record<string, string> = {
  'Heads-up': 'pending_approval',
  'Pending Disbursement': 'pending_finance,ready_for_collection',
  Disbursed: 'cash_issued,returned_for_correction',
  Settled: 'pending_closure',
};
const activeTab = computed(
  () =>
    Object.keys(statuses).find((name) => statuses[name] === store.requestQuery.status) ||
    TAB_PENDING,
);
async function changeTab(tab: Tab) {
  try {
    await store.fetchRequests({ status: statuses[tab.name], page: 1 }, '/finance');
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not load Finance desk.', 'error');
  }
}
const byStatus = (statuses: RequestStatus[]) =>
  computed(() => store.allRequests.filter((r) => statuses.includes(r.status)));

const pendingGsApproval = byStatus(['pending_approval']);
const pendingDisbursement = byStatus(['pending_finance', 'ready_for_collection']);
const disbursed = byStatus(['cash_issued', 'returned_for_correction']);
const settled = byStatus(['pending_closure']);

const tabs = computed<Tab[]>(() => [
  {
    name: TAB_HEADS_UP,
    icon: ExclamationTriangleIcon,
    iconColor: 'fill-amber-500',
    href: '#',
    count: store.stats.pendingApproval || undefined,
  },
  {
    name: TAB_PENDING,
    icon: ClockIcon,
    iconColor: 'fill-sky-500',
    href: '#',
    count: store.stats.pendingDisbursement || undefined,
  },
  {
    name: TAB_DISBURSED,
    icon: BanknotesIcon,
    iconColor: 'fill-orange-500',
    href: '#',
    count: store.stats.unsettled || undefined,
  },
  {
    name: TAB_SETTLED,
    icon: CheckCircleIcon,
    iconColor: 'fill-green-500',
    href: '#',
    count: store.stats.awaitingClosure || undefined,
  },
]);

const activeList = computed(() => {
  if (activeTab.value === TAB_HEADS_UP) return pendingGsApproval.value;
  if (activeTab.value === TAB_PENDING) return pendingDisbursement.value;
  if (activeTab.value === TAB_DISBURSED) return disbursed.value;
  return settled.value;
});

const emptyState = computed(() => {
  if (activeTab.value === TAB_HEADS_UP) {
    return {
      label: 'Nothing coming up',
      description: 'Requests pending GS approval will appear here.',
    };
  }
  if (activeTab.value === TAB_PENDING) {
    return { label: 'Nothing to disburse', description: 'Authorized requests will appear here.' };
  }
  if (activeTab.value === TAB_DISBURSED) {
    return { label: 'No cash out', description: 'All disbursed petty cash has been settled.' };
  }
  return { label: 'Nothing to finalize', description: 'Settled requests will appear here.' };
});

// Status is shown where it tells Finance something the tab doesn't already say.
function showStatus(req: PettyCashRequest): boolean {
  return (
    activeTab.value === TAB_HEADS_UP ||
    req.status === 'ready_for_collection' ||
    req.status === 'returned_for_correction'
  );
}

function rowAmount(req: PettyCashRequest): number {
  return req.totalCashIssued || pettyCashAmount(req);
}

// Notify for collection
const showNotifyModal = ref(false);
const notifyTarget = ref<PettyCashRequest | null>(null);

function openNotifyModal(req: PettyCashRequest) {
  notifyTarget.value = req;
  showNotifyModal.value = true;
}

async function handleSendReminder(req: PettyCashRequest) {
  try {
    await store.sendReminder(req.id);
    showToast(`Settlement reminder sent to ${req.requester.name}`, 'success');
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not send reminder.', 'error');
  }
}

// Desktop columns. Heads-up is read-only, so it has no action column.
const columns = computed<ListColumn[]>(() => [
  { label: 'Voucher no', width: '7.5rem' },
  { label: 'Requester', width: '8rem' },
  { label: 'Particulars' },
  { label: 'Petty cash (MVR)', width: '7rem', align: 'right' },
  { label: 'Status', width: '10rem' },
  ...(activeTab.value === TAB_HEADS_UP ? [] : [{ label: 'Action', width: '11rem', actions: true }]),
]);

function cells(item: PettyCashRequest): ListCell[] {
  return [
    { text: item.id, to: `/requests/${item.id}` },
    { text: item.requester.name },
    { text: item.purpose, wrap: true },
    {
      text: formatMoney(rowAmount(item)),
      align: 'right',
      class: 'tabular-nums font-semibold text-slate-900',
    },
    showStatus(item) ? { status: pettyCashStatus(item.status) } : {},
  ];
}
</script>
