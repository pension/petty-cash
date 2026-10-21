<template>
  <PoContentArea>
    <!-- Header with PoPageTitle (Matching standardsportal/[id]) -->
    <header class="lg:flex lg:items-end justify-between border-b border-slate-200 pb-5 mb-5">
      <div class="space-y-1 grow">
        <PoPageTitle
          :stand-alone="true"
          label="Vault Reconciliation"
          description="Count the cash in the vault and check it against the ledger balance. Do this at least weekly."
        />
      </div>
      <div class="mt-4 lg:mt-0 shrink-0 flex flex-wrap gap-2">
        <PoButton
          action-type="ghost"
          label="Generate report"
          :icon="ArrowDownTrayIcon"
          :disabled="!store.isPageReady('/reconciliation') || store.busy || isGenerating"
          @button-click="handleGenerateReport"
        />
        <PoButton
          v-if="store.currentUser.capabilities.recordCount"
          label="Record Physical Count"
          :icon="PlusIcon"
          :disabled="!store.isPageReady('/reconciliation') || store.busy"
          @button-click="showRecordCountModal = true"
        />
      </div>
    </header>

    <PageSkeleton v-if="!store.isPageReady('/reconciliation')" :stats="3" />

    <div v-else class="space-y-5 pb-16 sm:pb-0">
      <!-- Stats Blocks -->
      <div class="hidden sm:block">
        <PoStatsBlock :items="statsItems" number-of-cols="grid-cols-1 sm:grid-cols-3 gap-4" />
      </div>

      <!-- Compact status line for phones, where the stats are hidden -->
      <div
        class="sm:hidden flex items-center justify-between rounded-lg bg-white border border-slate-200 px-4 py-3"
      >
        <div>
          <PoTypography size="xs" variant="dimmed" class="block">Expected in vault</PoTypography>
          <span class="text-lg font-semibold tabular-nums text-slate-900">{{
            formatMoney(store.fund.currentExpectedBalance)
          }}</span>
        </div>
        <div class="text-right">
          <PoTypography size="xs" variant="dimmed" class="block">Last count</PoTypography>
          <span
            class="text-sm font-semibold"
            :class="countOverdue ? 'text-orange-700' : 'text-slate-900'"
            >{{ lastCountLabel }}</span
          >
        </div>
      </div>

      <!-- Count history -->
      <div>
        <PoCard title="Count history" title-style="p-4">
          <ListTable :columns="columns" class="border-t border-slate-200">
            <ListRow
              v-for="item in store.reconciliations"
              :key="item.id"
              :title="`Counted ${formatMoney(item.actualCashCount)}`"
              :meta="`${formatDate(item.countDate)} · ${item.countedBy} · Ledger ${formatMoney(item.expectedBalance)}`"
              :amount="
                item.difference === 0
                  ? 'Balanced'
                  : `${item.difference > 0 ? '+' : ''}${formatMoney(item.difference)}`
              "
              :amount-class="item.difference === 0 ? 'text-green-700' : 'text-orange-700'"
              :status="item.difference === 0 ? undefined : countStatus(item.status)"
              :cells="cells(item)"
            >
              <template v-if="item.status === 'discrepancy_pending'" #actions>
                <PoButton
                  v-if="store.currentUser.capabilities.resolveCount"
                  size="sm"
                  action-type="ghost"
                  label="Resolve"
                  :disabled="store.busy"
                  @button-click="openResolveModal(item)"
                />
              </template>
            </ListRow>
          </ListTable>
          <div v-if="store.countTotal > 10" class="p-4 flex justify-end border-t border-slate-200">
            <PoPagination
              :current-page="countPage"
              :total-pages="Math.ceil(store.countTotal / 10)"
              @page-change="changeCountPage"
            />
          </div>
        </PoCard>
      </div>
    </div>

    <!-- Record Physical Count Modal -->
    <PoModal
      :show="showRecordCountModal"
      modal-title="Record Physical Count"
      modal-width="sm:max-w-xl"
      @modal-closed="showRecordCountModal = false"
    >
      <template #content>
        <div class="space-y-4">
          <!-- Top Subtitle -->
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs pb-0.5"
          >
            <PoTypography size="xs" variant="dimmed">
              Enter piece count per denomination to verify against vault balance.
            </PoTypography>
            <div class="flex items-center gap-1.5 shrink-0">
              <PoTypography size="xs" variant="dimmed">Ledger:</PoTypography>
              <PoTypography size="xs" strong>{{
                formatMoney(store.fund.currentExpectedBalance)
              }}</PoTypography>
            </div>
          </div>

          <!-- Banknotes Section -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <PoHeading type="h4" size="xs" weight="bold" text="Banknotes (MVR)" />
              <PoTypography size="xs" variant="dimmed">
                Subtotal: {{ formatMoney(totalBanknotes) }}
              </PoTypography>
            </div>

            <div
              class="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white shadow-2xs"
            >
              <div
                v-for="item in banknoteDenominations"
                :key="item.key"
                class="px-2.5 sm:px-3.5 py-1.5 flex items-center justify-between gap-2 sm:gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <!-- Denomination Label -->
                <div class="w-20 sm:w-28 shrink-0">
                  <PoTypography size="xs" strong>{{ item.label }}</PoTypography>
                </div>

                <!-- Count Input -->
                <div class="w-24 sm:w-32 grow sm:grow-0">
                  <PoInputField
                    v-model="denomCounts[item.key]"
                    type="number"
                    :min="0"
                    placeholder="0"
                    label-sr-only
                    :label="`${item.label} count`"
                  />
                </div>

                <!-- Line Total on Right -->
                <div class="w-24 sm:w-32 shrink-0 text-right">
                  <PoHeading
                    type="h4"
                    size="xs"
                    weight="semibold"
                    :text="formatMoney((Number(denomCounts[item.key]) || 0) * item.value)"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Coins Section -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <PoHeading type="h4" size="xs" weight="bold" text="Coins (MVR)" />
              <PoTypography size="xs" variant="dimmed">
                Subtotal:
                {{ formatMoney(totalRegularCoins + (showRareCoins ? totalRareCoins : 0)) }}
              </PoTypography>
            </div>

            <div
              class="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white shadow-2xs"
            >
              <div
                v-for="item in coinDenominations"
                :key="item.key"
                class="px-2.5 sm:px-3.5 py-1.5 flex items-center justify-between gap-2 sm:gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div class="w-20 sm:w-28 shrink-0">
                  <PoTypography size="xs" strong>{{ item.label }}</PoTypography>
                </div>

                <div class="w-24 sm:w-32 grow sm:grow-0">
                  <PoInputField
                    v-model="denomCounts[item.key]"
                    type="number"
                    :min="0"
                    placeholder="0"
                    label-sr-only
                    :label="`${item.label} count`"
                  />
                </div>

                <div class="w-24 sm:w-32 shrink-0 text-right">
                  <PoHeading
                    type="h4"
                    size="xs"
                    weight="semibold"
                    :text="formatMoney((Number(denomCounts[item.key]) || 0) * item.value)"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Low-Circulation Coins Toggle & Section -->
          <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div class="flex items-center justify-between">
              <div>
                <PoTypography size="xs" strong> Low-Circulation Coins </PoTypography>
                <div>
                  <PoTypography size="xs" variant="dimmed">
                    Fractional coins (0.50, 0.25, 0.10, 0.01) rarely found in circulation
                  </PoTypography>
                </div>
              </div>
              <PoToggle v-model="showRareCoins" />
            </div>

            <!-- Rare Coins Rows -->
            <div
              v-if="showRareCoins"
              class="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white shadow-2xs"
            >
              <div
                v-for="item in rareCoinDenominations"
                :key="item.key"
                class="px-2.5 sm:px-3.5 py-1.5 flex items-center justify-between gap-2 sm:gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div class="w-20 sm:w-28 shrink-0">
                  <PoTypography size="xs" strong>{{ item.label }}</PoTypography>
                </div>

                <div class="w-24 sm:w-32 grow sm:grow-0">
                  <PoInputField
                    v-model="denomCounts[item.key]"
                    type="number"
                    :min="0"
                    placeholder="0"
                    label-sr-only
                    :label="`${item.label} count`"
                  />
                </div>

                <div class="w-24 sm:w-32 shrink-0 text-right">
                  <PoHeading
                    type="h4"
                    size="xs"
                    weight="semibold"
                    :text="formatMoney((Number(denomCounts[item.key]) || 0) * item.value)"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Reconciliation Summary (Count Subtotal, Ledger Balance, Difference) -->
          <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div class="flex items-center justify-between text-xs">
              <PoTypography size="xs" variant="dimmed" strong>
                Physical Count Subtotal
              </PoTypography>
              <PoHeading
                type="h4"
                size="sm"
                weight="bold"
                :text="formatMoney(totalCalculatedCount)"
              />
            </div>

            <div class="flex items-center justify-between text-xs">
              <PoTypography size="xs" variant="dimmed" strong>
                Expected Ledger Balance
              </PoTypography>
              <PoHeading
                type="h4"
                size="sm"
                weight="bold"
                :text="formatMoney(store.fund.currentExpectedBalance)"
              />
            </div>

            <div class="pt-2 border-t border-slate-200 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <PoTypography size="sm" strong>Difference</PoTypography>
                <PoStatusPill
                  v-if="variance === 0 && totalCalculatedCount > 0"
                  label="Balanced"
                  color="green"
                />
                <PoStatusPill
                  v-else-if="variance !== 0 && totalCalculatedCount > 0"
                  :label="variance < 0 ? 'Cash Shortage' : 'Cash Surplus'"
                  :color="variance < 0 ? 'red' : 'amber'"
                />
              </div>
              <PoHeading
                type="h3"
                size="md"
                weight="bold"
                :variant="variance === 0 ? 'success' : variance < 0 ? 'danger' : 'default'"
                :text="variance === 0 ? 'MVR 0.00' : formatMoney(variance)"
              />
            </div>
          </div>

          <!-- Notes -->
          <div>
            <PoTextarea
              v-model="notes"
              label="Observations & Safe Notes"
              placeholder="Add verification notes, envelope remarks, or safe audit details..."
              rows="2"
            />
          </div>
        </div>
      </template>

      <template #footer>
        <div
          class="px-6 py-3.5 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/60"
        >
          <PoButton
            label="Cancel"
            action-type="ghost"
            size="sm"
            :disabled="store.busy"
            @button-click="showRecordCountModal = false"
          />
          <PoButton
            label="Verify & Save Count"
            action-type="default"
            size="sm"
            :disabled="store.busy || !hasCountEntry"
            @button-click="handleSaveCount"
          />
        </div>
      </template>
    </PoModal>

    <!-- Resolve discrepancy -->
    <PoModal
      :show="showResolveModal"
      modal-title="Resolve discrepancy"
      modal-width="sm:max-w-md"
      @modal-closed="showResolveModal = false"
    >
      <template #content>
        <div v-if="resolveTarget" class="space-y-4">
          <PoDescriptionList
            variant="cards"
            :items="[
              { title: 'Ledger', description: formatMoney(resolveTarget.expectedBalance) },
              { title: 'Counted', description: formatMoney(resolveTarget.actualCashCount) },
              {
                title: resolveTarget.difference < 0 ? 'Short' : 'Over',
                description: formatMoney(Math.abs(resolveTarget.difference)),
              },
            ]"
          />
          <PoTextarea
            v-model="resolveNotes"
            label="What caused it?"
            placeholder="e.g. Unrecorded taxi fare paid on 12 Oct; receipt now filed"
            :rows="3"
            required
          />
          <div class="flex items-start justify-between gap-4">
            <div>
              <PoTypography size="sm" strong class="block"
                >Adjust ledger to the counted amount</PoTypography
              >
              <PoTypography size="xs" variant="dimmed" class="block">
                Records an adjustment of {{ formatMoney(resolveTarget.difference) }} so the ledger
                matches the vault.
              </PoTypography>
            </div>
            <PoToggle v-model="resolveAdjust" />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="p-4 flex justify-end gap-2 border-t border-slate-100">
          <PoButton
            label="Cancel"
            action-type="ghost"
            size="sm"
            :disabled="store.busy"
            @button-click="showResolveModal = false"
          />
          <PoButton
            label="Mark resolved"
            size="sm"
            :disabled="store.busy || !resolveNotes.trim()"
            @button-click="handleResolve"
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
import {
  ArrowDownTrayIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ClockIcon,
  PlusIcon,
} from '@heroicons/vue/20/solid';
import {
  PoButton,
  PoCard,
  PoContentArea,
  PoDescriptionList,
  PoHeading,
  PoInputField,
  PoModal,
  PoPageTitle,
  PoPagination,
  PoStatsBlock,
  PoStatusPill,
  PoTextarea,
  PoToggle,
  PoTypography,
  useToastify,
} from '@pension/ui-kit';
import ListRow, { type ListCell } from '~/components/float/ListRow.vue';
import ListTable, { type ListColumn } from '~/components/float/ListTable.vue';
import { useFloatStore } from '~/stores/useFloatStore';
import type { DailyReconciliation } from '~/types/float';
import {
  FLOAT_DENOMINATIONS,
  cashDifference,
  emptyDenominationCounts,
  denominationTotal,
} from '~/utils/floatStatus';
import { downloadReconciliationReport } from '~/utils/floatPdf';

definePageMeta({
  layout: 'main',
});

useHead({
  title: 'Vault Reconciliation — Petty Cash',
});

const store = useFloatStore();
const { showToast } = useToastify();

const countPage = ref(1);
async function changeCountPage(page: number) {
  try {
    await store.fetchCounts(page);
    countPage.value = page;
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not load counts.', 'error');
  }
}
const showRecordCountModal = ref(false);
const showRareCoins = ref(false);
const notes = ref('');

const denomCounts = reactive(emptyDenominationCounts());
const banknoteDenominations = FLOAT_DENOMINATIONS.filter((d) => d.key.startsWith('note'));
const coinDenominations = FLOAT_DENOMINATIONS.filter(
  (d) => d.key.startsWith('coin') && d.value >= 1,
);
const rareCoinDenominations = FLOAT_DENOMINATIONS.filter((d) => d.value < 1);

const totalBanknotes = computed(() => {
  return (
    banknoteDenominations.reduce((acc, curr) => {
      return acc + (Number(denomCounts[curr.key]) || 0) * Math.round(curr.value * 100);
    }, 0) / 100
  );
});

const totalRegularCoins = computed(() => {
  return (
    coinDenominations.reduce((acc, curr) => {
      return acc + (Number(denomCounts[curr.key]) || 0) * Math.round(curr.value * 100);
    }, 0) / 100
  );
});

const totalRareCoins = computed(() => {
  return (
    rareCoinDenominations.reduce((acc, curr) => {
      return acc + (Number(denomCounts[curr.key]) || 0) * Math.round(curr.value * 100);
    }, 0) / 100
  );
});

const submittedCounts = computed(() =>
  Object.fromEntries(
    FLOAT_DENOMINATIONS.map((d) => [
      d.key,
      d.value < 1 && !showRareCoins.value ? 0 : Number(denomCounts[d.key]) || 0,
    ]),
  ),
);
const hasCountEntry = computed(() =>
  FLOAT_DENOMINATIONS.some(
    (d) => (d.value >= 1 || showRareCoins.value) && denomCounts[d.key] !== '',
  ),
);
const totalCalculatedCount = computed(() => denominationTotal(submittedCounts.value));

const variance = computed(() => {
  return cashDifference(totalCalculatedCount.value, store.fund.currentExpectedBalance);
});

const statsItems = computed(() => [
  {
    label: 'Expected Vault Cash',
    value: formatMoney(store.fund.currentExpectedBalance),
    bgColor: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    icon: BanknotesIcon,
  },
  {
    label: 'Last count',
    value: lastCountLabel.value,
    bgColor: countOverdue.value ? 'bg-orange-50' : 'bg-blue-50',
    iconColor: countOverdue.value ? 'text-orange-600' : 'text-blue-600',
    icon: ClockIcon,
  },
  {
    label: 'Fund Status',
    value:
      store.fundOverview.unresolvedDiscrepanciesCount === 0 ? 'Balanced' : 'Discrepancy Pending',
    bgColor:
      store.fundOverview.unresolvedDiscrepanciesCount === 0 ? 'bg-emerald-50' : 'bg-amber-50',
    iconColor:
      store.fundOverview.unresolvedDiscrepanciesCount === 0 ? 'text-emerald-600' : 'text-amber-600',
    icon: CheckCircleIcon,
  },
]);

const daysSinceLastCount = computed(() => {
  const last = store.stats.lastCountAt;
  if (!last) return null;
  return Math.floor((Date.now() - new Date(last.replace(' ', 'T')).getTime()) / 86400000);
});

const countOverdue = computed(
  () => daysSinceLastCount.value === null || daysSinceLastCount.value >= 7,
);

const lastCountLabel = computed(() => {
  const days = daysSinceLastCount.value;
  if (days === null) return 'Never';
  if (days <= 0) return 'Today';
  return `${days} day${days === 1 ? '' : 's'} ago${days >= 7 ? ' · due' : ''}`;
});

function countStatus(status: DailyReconciliation['status']) {
  if (status === 'balanced') return { label: 'Balanced', color: 'green' };
  if (status === 'resolved') return { label: 'Resolved', color: 'blue' };
  return { label: 'Discrepancy', color: 'orange' };
}

// Resolve discrepancy
const showResolveModal = ref(false);
const resolveTarget = ref<DailyReconciliation | null>(null);
const resolveNotes = ref('');
const resolveAdjust = ref(true);

function openResolveModal(item: DailyReconciliation) {
  resolveTarget.value = item;
  resolveNotes.value = '';
  resolveAdjust.value = true;
  showResolveModal.value = true;
}

async function handleResolve() {
  try {
    if (!resolveTarget.value || !resolveNotes.value.trim()) return;
    await store.resolveDiscrepancy(resolveTarget.value.id, {
      resolutionNotes: resolveNotes.value.trim(),
      adjustLedger: resolveAdjust.value,
    });
    showResolveModal.value = false;
    showToast('Discrepancy resolved', 'success');
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not complete this action.', 'error');
  }
}

async function handleSaveCount() {
  if (!hasCountEntry.value) return;
  try {
    await store.recordDailyCount({
      denominations: submittedCounts.value,
      notes: notes.value,
    });

    countPage.value = 1;
    showToast('Physical cash count recorded successfully', 'success');

    // Reset form
    Object.keys(denomCounts).forEach((key) => {
      denomCounts[key] = '';
    });
    notes.value = '';
    showRecordCountModal.value = false;
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not complete this action.', 'error');
  }
}

// Desktop columns
const columns: ListColumn[] = [
  { label: 'Date', width: '6rem' },
  { label: 'Counted by' },
  { label: 'Ledger', width: '7rem', align: 'right' },
  { label: 'Counted', width: '7rem', align: 'right' },
  { label: 'Difference', width: '7rem', align: 'right' },
  { label: 'Status', width: '7.5rem' },
  { label: 'Action', width: '6rem', actions: true },
];

function cells(item: DailyReconciliation): ListCell[] {
  return [
    { text: formatDate(item.countDate), class: 'tabular-nums' },
    { text: item.countedBy, sub: item.notes },
    { text: formatMoney(item.expectedBalance), align: 'right', class: 'tabular-nums' },
    {
      text: formatMoney(item.actualCashCount),
      align: 'right',
      class: 'tabular-nums font-semibold text-slate-900',
    },
    {
      text:
        item.difference === 0
          ? 'Balanced'
          : `${item.difference > 0 ? '+' : ''}${formatMoney(item.difference)}`,
      align: 'right',
      class: `tabular-nums font-semibold ${item.difference === 0 ? 'text-green-700' : 'text-orange-700'}`,
    },
    { status: countStatus(item.status) },
  ];
}

// Report PDF: fund summary, latest count, count history and ledger
const isGenerating = ref(false);

async function handleGenerateReport() {
  isGenerating.value = true;
  try {
    const report = await store.report();
    await downloadReconciliationReport({ ...report, reconciliations: report.counts });
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not generate the report.', 'error');
  } finally {
    isGenerating.value = false;
  }
}
</script>
