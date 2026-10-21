<template>
  <PoContentArea v-if="!store.isPageReady(route.path)">
    <header class="border-b border-slate-200 pb-5 mb-5">
      <PoPageTitle
        :stand-alone="true"
        label="Request details"
        description="Review request details, monitor the approval and disbursement timeline, and proceed with required actions."
      />
    </header>
    <PageSkeleton :sections="2" :rows="3" />
  </PoContentArea>
  <PoContentArea v-else-if="request">
    <!-- Header with PoPageTitle (Matching standardsportal/[id]) -->
    <header class="lg:flex lg:items-end justify-between border-b border-slate-200 pb-5 mb-5">
      <div class="min-w-0 flex-1">
        <PoPageTitle
          :stand-alone="true"
          label="Request details"
          description="Review request details, monitor the approval and disbursement timeline, and proceed with required actions."
        />
      </div>

      <div class="mt-4 lg:mt-0 shrink-0 flex flex-col items-start lg:items-end gap-2">
        <PoPageStatus
          class="hidden sm:flex"
          :icon="statusConfig.icon"
          :label="statusConfig.label"
          :color="statusConfig.color"
        />

        <div class="flex items-center flex-wrap gap-2">
          <!-- Staff: confirm collection -->
          <PoButton
            v-if="request.allowedActions.includes('confirmReceipt')"
            :label="`I received MVR ${formatMoney(request.approvedAmount || request.requestedAmount)}`"
            :icon="CheckBadgeIcon"
            :disabled="store.busy"
            @button-click="handleConfirmReceived"
          />

          <!-- Staff: add receipts, then settle -->
          <template v-else-if="canEditReceipts">
            <PoButton
              action-type="ghost"
              label="Add receipt"
              :icon="PlusIcon"
              :disabled="store.busy"
              @button-click="showReceiptModal = true"
            />
            <PoButton
              action-type="ghost"
              label="Bulk Receipts"
              :icon="PaperClipIcon"
              :disabled="store.busy"
              @button-click="showBulkReceiptsModal = true"
            />
            <PoButton
              label="Settle"
              :icon="CheckCircleIcon"
              :disabled="store.busy"
              @button-click="showSettleModal = true"
            />
          </template>

          <!-- Closed: voucher PDF -->
          <PoButton
            v-else-if="request.status === 'closed'"
            label="Download PDF"
            :icon="ArrowDownTrayIcon"
            :disabled="store.busy || isDownloading"
            @button-click="handleDownloadPdf"
          />

          <!-- Pending GS approval: requester can still edit; GS decides -->
          <template v-else-if="request.status === 'pending_approval'">
            <PoButton
              v-if="request.allowedActions.includes('edit')"
              action-type="ghost"
              label="Edit"
              :icon="PencilSquareIcon"
              :disabled="store.busy"
              @button-click="showEditModal = true"
            />
            <PoButton
              v-if="request.allowedActions.includes('reject')"
              action-type="ghost"
              label="Reject"
              :icon="XCircleIcon"
              :disabled="store.busy"
              @button-click="showRejectModal = true"
            />
            <PoButton
              v-if="request.allowedActions.includes('authorize')"
              label="Authorize"
              :icon="CheckCircleIcon"
              :disabled="store.busy"
              @button-click="handleApprove"
            />
          </template>

          <!-- Finance: prepare -->
          <PoButton
            v-else-if="request.allowedActions.includes('notifyCollection')"
            label="Notify for collection"
            :icon="BanknotesIcon"
            :disabled="store.busy"
            @button-click="showPrepareModal = true"
          />

          <BackButton class="hidden sm:inline-flex" />
        </div>
      </div>
    </header>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start pb-20 sm:pb-8">
      <!-- Main column -->
      <div class="lg:col-span-2 space-y-5">
        <!-- Status Notices / Banners -->
        <PoMessage
          v-if="request.allowedActions.includes('confirmReceipt')"
          msg-type="orange"
          title="Your cash is ready at the Finance counter"
          message="Collect it from Finance, count it, then confirm receipt here."
        />

        <PoMessage
          v-else-if="request.status === 'returned_for_correction'"
          msg-type="orange"
          title="Finance requested correction"
          :message="correctionNote"
        />

        <PoMessage
          v-else-if="request.status === 'rejected' && request.rejectionReason"
          msg-type="red"
          title="Request rejected"
          :message="request.rejectionReason"
        />

        <!-- Receipts & Invoices -->
        <PoCard
          v-if="canEditReceipts || request.expenses.length > 0"
          title="Receipts & Invoices"
          title-style="p-4 pb-3"
        >
          <template #content>
            <div class="border-t border-slate-200">
              <div v-if="request.expenses.length === 0" class="p-8">
                <PoEmpty
                  label="No receipts added yet"
                  description="Add a receipt for each purchase. Settle once you're done."
                  :icon="DocumentTextIcon"
                  icon-color="fill-slate-400"
                />
              </div>
              <ul v-else class="divide-y divide-slate-100">
                <li
                  v-for="item in request.expenses"
                  :key="item.id"
                  class="flex items-center justify-between gap-3 p-4 hover:bg-slate-50 transition-colors"
                >
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <PoTypography size="sm" strong class="text-slate-900 truncate">
                        {{ item.supplierName }}
                      </PoTypography>
                      <PoStatusPill v-if="item.category" :label="item.category" color="gray" />
                      <PoStatusPill
                        v-if="!item.receiptFileName"
                        label="No attachment"
                        color="orange"
                      />
                      <PoStatusPill
                        v-if="item.ocrExtracted"
                        label="OCR Verified"
                        color="green"
                        :icon="SparklesIcon"
                      />
                    </div>
                    <PoTypography size="xs" variant="dimmed" class="block mt-0.5 truncate">
                      {{ item.description }} · {{ formatDate(item.expenseDate) }}
                    </PoTypography>
                  </div>

                  <div class="flex items-center gap-3 shrink-0">
                    <PoTypography size="sm" strong class="tabular-nums">
                      {{ formatMoney(item.amount) }}
                    </PoTypography>
                    <PoTableAction
                      v-if="item.receiptFileName"
                      btn-type="view"
                      title="View attachment"
                      @click="openReceiptPreview(item)"
                    />
                    <PoTableAction
                      v-if="request.allowedActions.includes('removeExpense')"
                      :disabled="store.busy"
                      btn-type="delete"
                      title="Remove receipt"
                      @click="handleRemoveExpense(item.id)"
                    />
                  </div>
                </li>
              </ul>
              <dl
                v-if="request.expenses.length > 0"
                class="border-t border-slate-200 px-4 py-3 grid grid-cols-3 gap-3 text-xs"
              >
                <div>
                  <dt class="text-slate-500">Received</dt>
                  <dd class="mt-0.5 font-semibold text-slate-900 tabular-nums">
                    {{ formatMoney(cashReceived) }}
                  </dd>
                </div>
                <div>
                  <dt class="text-slate-500">Spent</dt>
                  <dd class="mt-0.5 font-semibold text-slate-900 tabular-nums">
                    {{ formatMoney(spentTotal) }}
                  </dd>
                </div>
                <div>
                  <dt class="text-slate-500">
                    {{ overspend > 0 ? 'Owed to requester' : 'Balance to return' }}
                  </dt>
                  <dd
                    class="mt-0.5 font-semibold tabular-nums"
                    :class="overspend > 0 ? 'text-orange-700' : 'text-slate-900'"
                  >
                    {{ formatMoney(overspend > 0 ? overspend : balanceToReturn) }}
                  </dd>
                </div>
              </dl>
            </div>
          </template>
        </PoCard>

        <!-- Request Details Card -->
        <PoCard class="p-5 space-y-4">
          <div class="pb-3 border-b border-slate-100">
            <PoTypography size="xs" variant="dimmed" class="block">{{
              request.status === 'pending_approval' || request.status === 'rejected'
                ? 'Requested amount'
                : 'Approved amount'
            }}</PoTypography>
            <div class="text-2xl font-bold text-slate-900 mt-0.5 tabular-nums">
              {{ formatMoney(request.approvedAmount || request.requestedAmount) }}
            </div>
            <PoTypography
              v-if="request.approvedAmount && request.approvedAmount !== request.requestedAmount"
              size="xs"
              variant="dimmed"
              class="block mt-0.5"
            >
              Requested: {{ formatMoney(request.requestedAmount) }}
            </PoTypography>
          </div>

          <PoDescriptionList variant="stacked" :items="detailItems" />

          <div v-if="request.notes">
            <PoTypography size="xs" variant="dimmed" class="block mb-1"
              >Notes / Remarks</PoTypography
            >
            <PoTypography
              size="xs"
              class="block p-3 rounded-lg bg-slate-50 border border-slate-100 text-slate-700 italic"
            >
              "{{ request.notes }}"
            </PoTypography>
          </div>
        </PoCard>
      </div>

      <!-- Side column: Settlement Audit & Activity Timeline -->
      <div class="space-y-5">
        <!-- Settlement Audit Card -->
        <PoCard
          v-if="request.status === 'pending_closure'"
          title="Settlement Audit"
          title-style="p-4 pb-3"
        >
          <template #content>
            <div class="p-4 border-t border-slate-200 space-y-4">
              <PoMessage
                msg-type="blue"
                title="Settlement submitted for audit"
                :message="settlementSummary"
              />
              <PoButton
                v-if="request.allowedActions.includes('finalize')"
                class="w-full justify-center"
                label="Finalize & close"
                :icon="ArchiveBoxIcon"
                :disabled="store.busy"
                @button-click="openFinalizeModal"
              />
              <PoButton
                v-if="request.allowedActions.includes('returnForCorrection')"
                class="w-full justify-center"
                action-type="ghost"
                label="Return for correction"
                :icon="ArrowUturnLeftIcon"
                :disabled="store.busy"
                @button-click="openCorrectionModal"
              />
            </div>
          </template>
        </PoCard>

        <!-- Activity Timeline -->
        <PoCard title="Activity Timeline" title-style="p-4 pb-3">
          <div class="border-t border-slate-200 p-4">
            <PoTimeline :timeline="timelineItems" />
          </div>
        </PoCard>
      </div>
    </div>

    <!-- Modals -->

    <!-- Edit request (before GS approval) -->
    <PettyCashRequestModal
      :show="showEditModal"
      :request="request"
      @close="showEditModal = false"
    />

    <!-- Notify for collection (Finance) -->
    <NotifyCollectionModal
      :show="showPrepareModal"
      :request="request"
      @close="showPrepareModal = false"
    />

    <!-- Reject Modal (Manager) -->
    <PoModal
      :show="showRejectModal"
      modal-title="Reject Petty Cash Request"
      modal-width="sm:max-w-md"
      @modal-closed="showRejectModal = false"
    >
      <template #content>
        <div class="space-y-3">
          <PoTextarea
            v-model="rejectionReason"
            label="Reason for Rejection"
            placeholder="Explain why this request is rejected..."
            :rows="3"
            required
          />
        </div>
      </template>
      <template #footer>
        <div class="p-4 flex justify-end gap-2 border-t border-slate-100">
          <PoButton
            label="Cancel"
            action-type="ghost"
            size="sm"
            :disabled="store.busy"
            @button-click="showRejectModal = false"
          />
          <PoButton
            label="Confirm Rejection"
            action-type="danger"
            size="sm"
            :disabled="store.busy || !rejectionReason"
            @button-click="handleConfirmReject"
          />
        </div>
      </template>
    </PoModal>

    <!-- Add receipt (Requester) -->
    <BulkReceiptsModal
      :show="showBulkReceiptsModal"
      :request-id="request.id"
      @close="showBulkReceiptsModal = false"
    />
    <ReceiptScanModal
      :show="showReceiptModal"
      :request-id="request.id"
      @close="showReceiptModal = false"
    />

    <!-- Settle confirmation (Requester) -->
    <PoModal
      :show="showSettleModal"
      modal-title="Settle petty cash"
      modal-width="sm:max-w-md"
      @modal-closed="showSettleModal = false"
    >
      <template #content>
        <div class="space-y-4">
          <PoDescriptionList
            variant="cards"
            :items="[
              { title: 'Received', description: formatMoney(cashReceived) },
              { title: 'Spent', description: formatMoney(spentTotal) },
              overspend > 0
                ? { title: 'Owed to you', description: formatMoney(overspend) }
                : { title: 'To return', description: formatMoney(balanceToReturn) },
            ]"
          />
          <PoMessage
            v-if="request.expenses.length === 0"
            msg-type="orange"
            title="No receipts added"
            message="You're settling without any receipts. The full amount must be returned to Finance."
          />
          <PoMessage
            v-else-if="overspend > 0"
            msg-type="blue"
            title="You spent more than you received"
            :message="`Finance will pay you MVR ${formatMoney(overspend)} when they close this request. Bring the original invoices.`"
          />
          <PoTypography v-else size="xs" variant="dimmed" class="block">
            Take the {{ request.expenses.length }} original invoice{{
              request.expenses.length === 1 ? '' : 's'
            }}
            <template v-if="balanceToReturn > 0">
              and MVR {{ formatMoney(balanceToReturn) }} in cash</template
            >
            to Finance.
          </PoTypography>
        </div>
      </template>
      <template #footer>
        <div class="p-4 flex justify-end gap-2 border-t border-slate-100">
          <PoButton
            label="Cancel"
            action-type="ghost"
            size="sm"
            :disabled="store.busy"
            @button-click="showSettleModal = false"
          />
          <PoButton
            label="Confirm settlement"
            size="sm"
            :disabled="store.busy"
            @button-click="handleConfirmSettle"
          />
        </div>
      </template>
    </PoModal>

    <!-- Finalize & close with cash count (Finance) -->
    <PoModal
      :show="showFinalizeModal"
      modal-title="Finalize & close"
      modal-width="sm:max-w-lg"
      @modal-closed="showFinalizeModal = false"
    >
      <template #content>
        <div class="space-y-4">
          <PoDescriptionList
            density="compact"
            :items="[
              { title: 'Cash received', description: formatMoney(cashReceived) },
              {
                title: 'Receipts',
                description: `${request.expenses.length} · ${formatMoney(spentTotal)}`,
              },
            ]"
          />

          <PoMessage
            v-if="overspend > 0"
            msg-type="blue"
            title="Reimburse the requester"
            :message="`${request.requester.name} spent MVR ${formatMoney(overspend)} more than received. Pay this from the vault; it will be recorded in the ledger.`"
          />
          <PoMessage
            v-else-if="balanceToReturn === 0"
            msg-type="green"
            title="Nothing to return"
            message="The receipts account for all the cash issued."
          />

          <div v-else class="space-y-1.5">
            <PoTypography size="xs" variant="dimmed" class="block">
              Count the MVR {{ formatMoney(balanceToReturn) }} handed back by
              {{ request.requester.name }}.
            </PoTypography>
            <BanknoteCounter v-model="returnCounts" :expected="balanceToReturn" />
          </div>
          <PoInputField
            v-model="closeDynamicsRef"
            label="Dynamics reference (optional)"
            placeholder="e.g. DYN-PC-0132"
          />
          <PoMessage
            v-if="balanceToReturn > 0 && returnDifference !== 0"
            msg-type="orange"
            title="Count doesn't match"
            :message="`The counted cash is ${returnDifference > 0 ? 'more' : 'less'} than expected by ${formatMoney(Math.abs(returnDifference))}. It will be recorded as a discrepancy.`"
          />
        </div>
      </template>
      <template #footer>
        <div class="p-4 flex justify-end gap-2 border-t border-slate-100">
          <PoButton
            label="Cancel"
            action-type="ghost"
            size="sm"
            :disabled="store.busy"
            @button-click="showFinalizeModal = false"
          />
          <PoButton
            :label="finalizeLabel"
            :action-type="hasReturnDiscrepancy ? 'orange' : 'default'"
            size="sm"
            :icon="ArchiveBoxIcon"
            :disabled="store.busy || (balanceToReturn > 0 && !hasReturnCount)"
            @button-click="handleConfirmFinalize"
          />
        </div>
      </template>
    </PoModal>

    <!-- Return for correction (Finance) -->
    <PoModal
      :show="showCorrectionModal"
      modal-title="Return for correction"
      modal-width="sm:max-w-md"
      @modal-closed="showCorrectionModal = false"
    >
      <template #content>
        <PoTextarea
          v-model="correctionText"
          label="What needs fixing?"
          placeholder="e.g. Invoice from Redwave is missing; total on Novelty receipt doesn't match"
          :rows="3"
          required
        />
      </template>
      <template #footer>
        <div class="p-4 flex justify-end gap-2 border-t border-slate-100">
          <PoButton
            label="Cancel"
            action-type="ghost"
            size="sm"
            :disabled="store.busy"
            @button-click="showCorrectionModal = false"
          />
          <PoButton
            label="Send back to requester"
            size="sm"
            :disabled="store.busy || !correctionText.trim()"
            @button-click="handleConfirmCorrection"
          />
        </div>
      </template>
    </PoModal>

    <!-- Receipt Attachment Slideover -->
    <PoSlideover
      :show="showReceiptSlideover"
      label="Receipt Attachment"
      :description="
        previewExpense
          ? `${previewExpense.supplierName} · ${previewExpense.invoiceNumber}`
          : 'Supporting receipt document'
      "
      max-width="max-w-xl"
      @slideover-closed="showReceiptSlideover = false"
    >
      <template #content>
        <div v-if="previewExpense" class="space-y-5">
          <PoDescriptionList
            variant="cards"
            :items="[
              { title: 'Amount', description: `MVR ${formatMoney(previewExpense.amount)}` },
              { title: 'Invoice #', description: previewExpense.invoiceNumber },
              { title: 'Date', description: formatDate(previewExpense.expenseDate) },
              { title: 'Supplier', description: previewExpense.supplierName },
            ]"
          />

          <PoCard class="p-4 space-y-3 bg-slate-50 border border-slate-200">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 min-w-0">
                <DocumentTextIcon class="w-5 h-5 text-slate-500 shrink-0" />
                <span class="text-xs font-semibold text-slate-800 truncate">
                  {{ previewExpense.receiptFileName || 'No attachment' }}
                </span>
              </div>
              <PoStatusPill
                v-if="previewExpense.ocrExtracted"
                label="OCR Verified"
                color="green"
                :icon="SparklesIcon"
              />
            </div>
            <PoTypography size="xs" variant="dimmed" class="block">
              {{ previewExpense.description }}
            </PoTypography>
          </PoCard>

          <ReceiptAttachmentPreview
            :src="previewExpense.receiptUrl"
            :content-type="previewExpense.receiptContentType"
            :file-name="previewExpense.receiptFileName"
            :description="previewExpense.description"
          />
        </div>
      </template>
    </PoSlideover>
  </PoContentArea>
</template>

<script setup lang="ts">
import PageSkeleton from '~/components/float/PageSkeleton.vue';
import { cashDifference, cashSum, denominationTotal, emptyDenominationCounts  } from '~/utils/floatStatus';
import { formatDate, formatMoney } from '~/utils/floatFormat';

import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import BackButton from '~/components/backButton.vue';
import BanknoteCounter from '~/components/float/BanknoteCounter.vue';
import NotifyCollectionModal from '~/components/float/NotifyCollectionModal.vue';
import PettyCashRequestModal from '~/components/float/PettyCashRequestModal.vue';
import BulkReceiptsModal from '~/components/float/BulkReceiptsModal.vue';
import ReceiptScanModal from '~/components/float/ReceiptScanModal.vue';
import ReceiptAttachmentPreview from '~/components/float/ReceiptAttachmentPreview.vue';
import {
  ArchiveBoxIcon,
  ArrowDownTrayIcon,
  ArrowUturnLeftIcon,
  BanknotesIcon,
  CheckBadgeIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentCheckIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  InboxStackIcon,
  PencilSquareIcon,
  PaperClipIcon,
  PlusIcon,
  SparklesIcon,
  XCircleIcon,
} from '@heroicons/vue/20/solid';
import {
  PoButton,
  PoCard,
  PoContentArea,
  PoDescriptionList,
  PoEmpty,
  PoInputField,
  PoMessage,
  PoModal,
  PoPageStatus,
  PoPageTitle,
  PoSlideover,
  PoStatusPill,
  PoTableAction,
  PoTextarea,
  PoTimeline,
  PoTypography,
  useToastify,
} from '@pension/ui-kit';
import { useFloatStore } from '~/stores/useFloatStore';
import type { ExpenseItem } from '~/types/float';
import { downloadRequestPdf } from '~/utils/floatPdf';

definePageMeta({
  layout: 'main',
});

const route = useRoute();
const store = useFloatStore();
const { showToast } = useToastify();

const requestId = computed(() => route.params.id as string);
const request = computed(() => store.getRequestById(requestId.value));

useHead({
  title: computed(() => `Request ${request.value?.id || ''}`),
});

const correctionNote = computed(() => {
  if (!request.value) return '';
  const returnedExp = request.value.expenses?.find(
    (e) => e.verificationStatus === 'returned_for_correction',
  );
  return (
    request.value.correctionNote ||
    returnedExp?.correctionNote ||
    'Please review and resubmit receipts requested for correction.'
  );
});

const spentTotal = computed(() => {
  if (!request.value) return 0;
  return request.value.expenseTotal ?? cashSum(request.value.expenses.map((e) => e.amount));
});

const cashReceived = computed(() => {
  if (!request.value) return 0;
  return (
    request.value.totalCashIssued || request.value.approvedAmount || request.value.requestedAmount
  );
});

const balanceToReturn = computed(() =>
  Math.max(0, cashDifference(cashReceived.value, spentTotal.value)),
);
const overspend = computed(() => Math.max(0, cashDifference(spentTotal.value, cashReceived.value)));

const settlementSummary = computed(() => {
  if (!request.value) return '';
  const n = request.value.expenses.length;
  const receipts = `${n} receipt${n === 1 ? '' : 's'} totalling ${formatMoney(spentTotal.value)}.`;
  if (overspend.value > 0) return `${receipts} Owed to requester: ${formatMoney(overspend.value)}.`;
  return `${receipts} Cash to collect: ${formatMoney(balanceToReturn.value)}.`;
});

const canEditReceipts = computed(() => !!request.value?.allowedActions.includes('addExpense'));

// Receipts & settlement (Requester)
const showReceiptModal = ref(false);
const showBulkReceiptsModal = ref(false);
const showSettleModal = ref(false);

async function handleRemoveExpense(expenseId: string) {
  try {
    if (!request.value || store.busy) return;
    await store.deleteExpense(request.value.id, expenseId);
    showToast('Receipt removed', 'info');
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not complete this action.', 'error');
  }
}

async function handleConfirmSettle() {
  try {
    if (!request.value) return;
    await store.submitForClosure(request.value.id);
    showSettleModal.value = false;
    showToast('Settlement sent to Finance', 'success');
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not complete this action.', 'error');
  }
}

const showReceiptSlideover = ref(false);
const previewExpense = ref<ExpenseItem | null>(null);

async function openReceiptPreview(item: ExpenseItem) {
  try {
    previewExpense.value = {
      ...item,
      receiptUrl: item.fileId ? await store.receiptUrl(item.fileId) : undefined,
    };
    showReceiptSlideover.value = true;
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not complete this action.', 'error');
  }
}

const detailItems = computed(() => {
  if (!request.value) return [];
  return [
    { title: 'Request #', description: request.value.id },
    { title: 'Description', description: request.value.purpose },
    {
      title: 'Requester',
      description: `${request.value.requester.name} (${request.value.department || 'General Services'})`,
    },
    { title: 'Submitted Date', description: formatDate(request.value.createdAt) },
    { title: 'Needed by', description: formatDate(request.value.effectiveClosingDate) },
    ...(request.value.dynamicsReference
      ? [{ title: 'Dynamics Voucher', description: request.value.dynamicsReference }]
      : []),
  ];
});

const statusConfig = computed(() => {
  if (!request.value) return { label: '', color: 'slate', icon: ClockIcon };
  switch (request.value.status) {
    case 'draft':
      return { label: 'Draft', color: 'slate', icon: DocumentTextIcon };
    case 'pending_approval':
      return { label: 'Pending GS approval', color: 'amber', icon: ClockIcon };
    case 'rejected':
      return { label: 'Rejected', color: 'red', icon: XCircleIcon };
    case 'pending_finance':
      return { label: 'Pending disbursement', color: 'blue', icon: ClockIcon };
    case 'ready_for_collection':
      return { label: 'Pending user collection', color: 'blue', icon: InboxStackIcon };
    case 'cash_issued':
      return { label: 'Disbursed', color: 'blue', icon: BanknotesIcon };
    case 'pending_closure':
      return { label: 'Settled', color: 'amber', icon: DocumentCheckIcon };
    case 'returned_for_correction':
      return { label: 'Correction Required', color: 'orange', icon: ExclamationTriangleIcon };
    case 'closed':
      return { label: 'Closed', color: 'green', icon: CheckCircleIcon };
    default:
      return { label: request.value.status, color: 'slate', icon: ClockIcon };
  }
});

const timelineItems = computed(() => {
  if (!request.value) return [];
  return request.value.timeline.map((item, idx) => ({
    label: item.title,
    date: formatDate(item.timestamp),
    description: item.description,
    current: idx === request.value!.timeline.length - 1,
  }));
});

// Confirmation: "I received MVR [amount]"
async function handleConfirmReceived() {
  try {
    if (!request.value) return;
    await store.collectCash(request.value.id);
    showToast('Cash receipt confirmed. Add receipts as you make purchases.', 'success');
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not complete this action.', 'error');
  }
}

const showEditModal = ref(false);

// Manager Actions
async function handleApprove() {
  try {
    if (!request.value) return;
    await store.approveRequestByManager(request.value.id);
    showToast('Request approved', 'success');
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not complete this action.', 'error');
  }
}

const showRejectModal = ref(false);
const rejectionReason = ref('');

async function handleConfirmReject() {
  try {
    if (!request.value || !rejectionReason.value) return;
    await store.rejectRequestByManager(request.value.id, rejectionReason.value);
    showRejectModal.value = false;
    showToast('Request rejected', 'info');
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not complete this action.', 'error');
  }
}

// Finance Actions
const showPrepareModal = ref(false);

// Finalize & close with cash count (Finance)
const showFinalizeModal = ref(false);
const returnCounts = ref(emptyDenominationCounts());
const hasReturnCount = computed(() => Object.values(returnCounts.value).some((v) => v !== ''));
const countedReturn = computed(() => denominationTotal(returnCounts.value));
const returnDifference = computed(() => cashDifference(countedReturn.value, balanceToReturn.value));
const hasReturnDiscrepancy = computed(
  () => balanceToReturn.value > 0 && returnDifference.value !== 0,
);

const finalizeLabel = computed(() => {
  if (overspend.value > 0) return `Pay ${formatMoney(overspend.value)} & close`;
  return hasReturnDiscrepancy.value ? 'Close with discrepancy' : 'Confirm & close';
});

const closeDynamicsRef = ref('');

function openFinalizeModal() {
  returnCounts.value = emptyDenominationCounts();
  closeDynamicsRef.value = request.value?.dynamicsReference || '';
  showFinalizeModal.value = true;
}

async function handleConfirmFinalize() {
  if (balanceToReturn.value > 0 && !hasReturnCount.value) return;
  try {
    if (!request.value) return;
    await store.finalizeRequest(request.value.id, {
      denominations: Object.fromEntries(
        Object.entries(returnCounts.value).map(([k, v]) => [k, Number(v) || 0]),
      ),
      dynamicsReference: closeDynamicsRef.value.trim() || undefined,
    });
    showFinalizeModal.value = false;
    showToast('Request closed', 'success');
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not complete this action.', 'error');
  }
}

// Return for correction (Finance)
const showCorrectionModal = ref(false);
const correctionText = ref('');

function openCorrectionModal() {
  correctionText.value = '';
  showCorrectionModal.value = true;
}

async function handleConfirmCorrection() {
  try {
    if (!request.value || !correctionText.value.trim()) return;
    await store.returnSettlementForCorrection(request.value.id, correctionText.value.trim());
    showCorrectionModal.value = false;
    showToast('Settlement sent back to the requester', 'info');
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not complete this action.', 'error');
  }
}

// Voucher PDF (closed requests)
const isDownloading = ref(false);

async function handleDownloadPdf() {
  if (!request.value) return;
  isDownloading.value = true;
  try {
    await downloadRequestPdf(request.value);
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not generate the voucher.', 'error');
  } finally {
    isDownloading.value = false;
  }
}
</script>
