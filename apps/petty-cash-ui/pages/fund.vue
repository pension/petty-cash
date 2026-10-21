<template>
  <PoContentArea>
    <!-- Header with PoPageTitle (Matching standardsportal/[id]) -->
    <header class="lg:flex lg:items-end justify-between border-b border-slate-200 pb-5 mb-5">
      <div class="space-y-1 grow">
        <PoPageTitle
          :stand-alone="true"
          label="Fund Ledger"
          description="Maintain physical vault cash, review transactions, and record fund replenishment top-ups."
        />
      </div>
      <div class="mt-4 lg:mt-0 shrink-0 gap-2 flex items-center flex-wrap">
        <PoButton
          v-if="store.currentUser.capabilities.topUp"
          label="Top-Up Fund"
          :icon="PlusIcon"
          :disabled="!store.isPageReady('/fund') || store.busy"
          @button-click="showTopUpModal = true"
        />
      </div>
    </header>

    <PageSkeleton v-if="!store.isPageReady('/fund')" :stats="3" />

    <div v-else class="space-y-5 pb-16 sm:pb-0">
      <!-- Stats Blocks -->
      <div class="hidden sm:block">
        <PoStatsBlock :items="statsItems" number-of-cols="grid-cols-1 sm:grid-cols-3 gap-4" />
      </div>

      <!-- Compact balance line for phones, where the stats are hidden -->
      <div
        class="sm:hidden flex items-center justify-between rounded-lg bg-white border border-slate-200 px-4 py-3"
      >
        <div>
          <PoTypography size="xs" variant="dimmed" class="block">Cash in vault</PoTypography>
          <span class="text-lg font-semibold tabular-nums text-slate-900">{{
            formatMoney(store.fund.currentExpectedBalance)
          }}</span>
        </div>
        <div class="text-right">
          <PoTypography size="xs" variant="dimmed" class="block">Out with GS staff</PoTypography>
          <span class="text-sm font-semibold tabular-nums text-orange-700">{{
            formatMoney(cashWithStaff)
          }}</span>
        </div>
      </div>

      <!-- Transactions Ledger Table Card -->
      <PoCard title="Transaction History" title-style="px-4 py-4 border-b border-slate-200">
        <ListTable :columns="columns">
          <ListRow
            v-for="item in paginatedTransactions"
            :key="item.id"
            :cells="cells(item)"
            :to="item.requestId ? `/requests/${item.requestId}` : undefined"
            :title="item.notes || formatType(item.type)"
            :meta="
              [formatDate(item.date), formatType(item.type), item.reference, item.recordedBy].join(
                ' · ',
              )
            "
            :amount="`${item.amount > 0 ? '+' : ''}${formatMoney(item.amount)}`"
            :amount-class="item.amount > 0 ? 'text-green-700' : 'text-slate-900'"
            :sub-amount="`Bal ${formatMoney(item.runningBalance)}`"
          />
        </ListTable>
      </PoCard>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex justify-center sm:justify-end pt-2">
        <PoPagination
          :total-pages="totalPages"
          :current-page="currentPage"
          @on-page-change="handlePageChange"
        />
      </div>
    </div>

    <!-- Top-Up Modal -->
    <PoModal
      :show="showTopUpModal"
      modal-title="Record Fund Top-Up"
      modal-width="sm:max-w-md"
      @modal-closed="showTopUpModal = false"
    >
      <template #content>
        <div class="space-y-4">
          <PoTypography size="sm" class="block text-slate-600">
            Top-ups increase the expected physical vault cash held by Finance. Record the bank
            voucher or cheque reference.
          </PoTypography>

          <PoInputField
            v-model="topUpForm.amount"
            label="Top-Up Amount (MVR)"
            placeholder="0.00"
            type="number"
            required
          />

          <PoInputField
            v-model="topUpForm.reference"
            label="Funding Reference / Voucher #"
            placeholder="e.g. DYN-TOP-9912 / CHQ-1049"
            required
          />

          <PoTextarea
            v-model="topUpForm.notes"
            label="Notes"
            placeholder="e.g. Monthly replenishment from BML operating account..."
            rows="2"
          />
        </div>
      </template>
      <template #footer>
        <div class="p-4 flex justify-end space-x-3">
          <PoButton
            label="Cancel"
            action-type="ghost"
            :disabled="store.busy"
            @button-click="showTopUpModal = false"
          />
          <PoButton
            label="Confirm Top-Up"
            :disabled="store.busy || !topUpForm.amount || !topUpForm.reference"
            @button-click="handleConfirmTopUp"
          />
        </div>
      </template>
    </PoModal>
  </PoContentArea>
</template>

<script setup lang="ts">
import PageSkeleton from '~/components/float/PageSkeleton.vue';
import { formatDate, formatMoney } from '~/utils/floatFormat';

import { computed, reactive, ref } from 'vue';
import { BanknotesIcon, CalendarDaysIcon, PlusIcon, UserGroupIcon } from '@heroicons/vue/20/solid';
import {
  PoButton,
  PoCard,
  PoContentArea,
  PoInputField,
  PoModal,
  PoPageTitle,
  PoPagination,
  PoStatsBlock,
  PoTextarea,
  PoTypography,
  useToastify,
} from '@pension/ui-kit';
import ListRow, { type ListCell } from '~/components/float/ListRow.vue';
import ListTable, { type ListColumn } from '~/components/float/ListTable.vue';
import type { FundTransaction } from '~/types/float';
import { useFloatStore } from '~/stores/useFloatStore';

definePageMeta({
  layout: 'main',
});

useHead({
  title: 'Fund Ledger — Petty Cash',
});

const store = useFloatStore();
const { showToast } = useToastify();

const showTopUpModal = ref(false);
const topUpForm = reactive({
  amount: '',
  reference: '',
  notes: '',
});

const cashWithStaff = computed(() => store.cashWithStaff);

const statsItems = computed(() => [
  {
    label: 'Cash in vault',
    value: formatMoney(store.fund.currentExpectedBalance),
    bgColor: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    icon: BanknotesIcon,
  },
  {
    label: 'Out with GS staff',
    value: formatMoney(cashWithStaff.value),
    bgColor: 'bg-orange-50',
    iconColor: 'text-orange-600',
    icon: UserGroupIcon,
  },
  {
    label: `Opening balance · ${formatDate(store.fund.effectiveDate)}`,
    value: formatMoney(store.fund.openingBalance),
    bgColor: 'bg-slate-100',
    iconColor: 'text-slate-600',
    icon: CalendarDaysIcon,
  },
]);

const currentPage = ref(1);
const itemsPerPage = 5;

const totalPages = computed(() => Math.ceil(store.transactionTotal / itemsPerPage) || 1);

const paginatedTransactions = computed(() => store.transactions);
async function handlePageChange(page: number) {
  try {
    await store.fetchTransactions(page);
    currentPage.value = page;
  } catch (err) {
    store.error = err instanceof Error ? err.message : 'Could not load ledger.';
  }
}

function formatType(type: string): string {
  switch (type) {
    case 'cash_issued':
      return 'Cash Issued';
    case 'cash_returned':
      return 'Cash Returned';
    case 'reimbursement':
      return 'Reimbursement';
    case 'top_up':
      return 'Top-Up';
    case 'opening_balance':
      return 'Opening Balance';
    case 'adjustment':
      return 'Adjustment';
    default:
      return type;
  }
}

async function handleConfirmTopUp() {
  try {
    if (!topUpForm.amount || !topUpForm.reference) return;
    await store.addFundTopUp({
      amount: Number(topUpForm.amount),
      reference: topUpForm.reference,
      notes: topUpForm.notes,
    });
    topUpForm.reference = '';
    topUpForm.notes = '';
    currentPage.value = 1;
    showTopUpModal.value = false;
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not complete this action.', 'error');
  }
}

// Desktop columns
const columns: ListColumn[] = [
  { label: 'Date', width: '6rem' },
  { label: 'Type', width: '8rem' },
  { label: 'Description' },
  { label: 'Reference', width: '8.5rem' },
  { label: 'Amount', width: '7rem', align: 'right' },
  { label: 'Balance', width: '7rem', align: 'right' },
];

function cells(item: FundTransaction): ListCell[] {
  return [
    { text: formatDate(item.date), class: 'tabular-nums' },
    { status: { label: formatType(item.type), color: item.amount > 0 ? 'green' : 'blue' } },
    {
      text: item.notes || formatType(item.type),
      wrap: true,
      to: item.requestId ? `/requests/${item.requestId}` : undefined,
      sub: item.recordedBy,
    },
    { text: item.reference, class: 'font-mono text-xs' },
    {
      text: `${item.amount > 0 ? '+' : ''}${formatMoney(item.amount)}`,
      align: 'right',
      class: `tabular-nums font-semibold ${item.amount > 0 ? 'text-green-700' : 'text-slate-900'}`,
    },
    { text: formatMoney(item.runningBalance), align: 'right', class: 'tabular-nums' },
  ];
}
</script>
