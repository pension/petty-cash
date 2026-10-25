<template>
  <PoModal
    :show="show"
    modal-title="Bulk Receipts"
    :modal-width="stage === 'review' ? 'sm:max-w-7xl' : 'sm:max-w-lg'"
    :disable-close="saving"
    @modal-closed="close"
  >
    <template #content>
      <div class="bulk-receipts-content space-y-5">
        <PoTypography size="sm" variant="dimmed" class="block">
          Upload up to 20 receipt images or PDFs, review the details, then attach them together.
          Maximum 10 MB per file.
        </PoTypography>
        <PoMessage v-if="error" msg-type="red" title="Check your receipts" :message="error" />

        <template v-if="stage === 'select'">
          <button
            type="button"
            class="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center hover:border-sky-500 hover:bg-sky-50/50 focus-visible:outline-none focus-visible:border-sky-500 transition-colors"
            :class="dragging ? 'border-sky-500 bg-sky-50/50' : 'border-slate-300'"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="dropFiles"
            @click="fileInput?.click()"
          >
            <PaperClipIcon class="w-8 h-8 text-slate-500" aria-hidden="true" />
            <PoTypography size="sm" strong class="block text-slate-900">Choose receipt files</PoTypography>
            <PoTypography size="xs" variant="dimmed" class="block">Drop images or PDFs here, or click to browse</PoTypography>
          </button>
          <input
            ref="fileInput"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/heic,image/heif,image/webp,application/pdf,.heic,.heif"
            class="hidden"
            aria-label="Choose receipt images or PDFs"
            @change="chooseFiles"
          >
          <ul v-if="rows.length" class="divide-y divide-slate-100 border-y border-slate-200">
            <li
              v-for="row in rows"
              :key="row.id"
              class="flex items-center justify-between gap-4 py-3"
            >
              <div class="min-w-0">
                <PoTypography size="sm" strong class="block break-all">{{
                  row.file.name
                }}</PoTypography>
                <PoTypography size="xs" variant="dimmed"
                  >{{ (row.file.size / 1024).toFixed(0) }} KB</PoTypography
                >
              </div>
              <PoTableAction
                btn-type="delete"
                :title="`Remove ${row.file.name}`"
                @click="remove(row.id)"
              />
            </li>
          </ul>
        </template>

        <div
          v-else-if="stage === 'processing'"
          class="space-y-4"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div class="flex items-center gap-3">
            <SparklesIcon
              class="h-5 w-5 text-sky-700 animate-pulse motion-reduce:animate-none"
              aria-hidden="true"
            />
            <PoTypography size="sm" strong
              >Processing receipts · {{ completed }} of {{ rows.length }} finished</PoTypography
            >
          </div>
          <progress
            class="w-full h-2 accent-sky-700"
            :value="completed"
            :max="rows.length"
            aria-label="Receipts processed"
          />
          <PoTypography size="sm" variant="dimmed" class="block"
            >The review table will appear when processing finishes. Files AI cannot read can be
            completed manually.</PoTypography
          >
          <ul class="divide-y divide-slate-100">
            <li
              v-for="row in rows"
              :key="row.id"
              class="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <PoTypography size="sm" class="break-all">{{ row.file.name }}</PoTypography>
              <PoStatusPill
                :label="statusLabel(row.status)"
                :color="
                  row.status === 'upload_failed' || row.status === 'manual'
                    ? 'orange'
                    : row.status === 'ready'
                      ? 'green'
                      : 'blue'
                "
              />
            </li>
          </ul>
        </div>

        <template v-else>
          <PoMessage
            msg-type="blue"
            title="Review before attaching"
            message="Edit the fields below or remove any unwanted rows. All remaining receipts will be saved together when you confirm."
          />
          <PoTable :thead="columns" :tbody="rows" :break-at-lg="true" class="lg:[&_td:not(:last-child)]:pr-3">
            <template #td="{ item: row }">
              <td data-title="File" class="align-top">
                <PoTypography size="sm" strong class="block break-all">{{
                  row.file.name
                }}</PoTypography>
                <PoStatusPill
                  :label="statusLabel(row.status)"
                  :color="row.status === 'ready' ? 'green' : 'orange'"
                  class="mt-2"
                />
                <PoTypography size="xs" variant="dimmed" class="block mt-2">{{
                  row.message
                }}</PoTypography>
                <PoTypography v-if="rowError(row)" size="xs" class="block mt-2 text-red-700">{{
                  rowError(row)
                }}</PoTypography>
                <PoButton
                  v-if="row.status === 'upload_failed'"
                  label="Retry upload"
                  action-type="ghost"
                  size="sm"
                  :disabled="saving"
                  @button-click="process"
                />
              </td>
              <td data-title="Purchase" class="align-top space-y-2">
                <PoInputField
                  v-model="row.form.supplierName"
                  label="Vendor"
                  required
                  :disabled="saving"
                />
                <PoInputField
                  v-model="row.form.invoiceNumber"
                  label="Invoice no"
                  :disabled="saving"
                />
                <PoSelectField
                  v-model="row.form.category"
                  label="Category"
                  :list="categoryOptions"
                  :disabled="saving"
                />
              </td>
              <td data-title="Date" class="align-top">
                <PoInputField
                  v-model="row.form.expenseDate"
                  label="Date"
                  type="date"
                  required
                  :disabled="saving"
                />
              </td>
              <td data-title="What was bought" class="align-top">
                <PoTextarea
                  v-model="row.form.description"
                  label="What was bought"
                  :rows="3"
                  required
                  :disabled="saving"
                />
              </td>
              <td data-title="Total (MVR)" class="align-top">
                <PoInputField
                  v-model="row.form.amount"
                  label="Total (MVR)"
                  type="number"
                  :min="0"
                  step="0.01"
                  required
                  :disabled="saving"
                />
              </td>
              <td data-title="Remove" class="align-top">
                <PoTableAction
                  btn-type="delete"
                  :title="`Remove ${row.file.name}`"
                  :disabled="saving"
                  @click="remove(row.id)"
                />
              </td>
            </template>
          </PoTable>
          <div
            class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4"
          >
            <PoTypography size="sm">{{ rows.length }} receipts</PoTypography>
            <PoTypography size="sm" strong class="tabular-nums"
              >Total MVR {{ formatMoney(total) }}</PoTypography
            >
          </div>
        </template>
      </div>
    </template>
    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4">
        <PoButton
          label="Cancel"
          action-type="ghost"
          size="sm"
          :disabled="saving"
          @button-click="close"
        />
        <PoButton
          :label="primaryLabel"
          :disabled="stage === 'processing' || (stage === 'select' ? !rows.length : !canConfirm || store.busy || !canEdit)"
          @button-click="primaryAction"
        />
      </div>
    </template>
  </PoModal>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue';
import { PaperClipIcon, SparklesIcon } from '@heroicons/vue/20/solid';
import {
  PoButton,
  PoInputField,
  PoMessage,
  PoModal,
  PoSelectField,
  PoStatusPill,
  PoTable,
  PoTableAction,
  PoTextarea,
  PoTypography,
  useToastify,
} from '@pension/ui-kit';
import { useBulkReceipts, type BulkReceiptRow } from '~/composables/useBulkReceipts';
import { usePettyCashStore } from '~/stores/usePettyCashStore';
import { formatMoney } from '~/utils/pettyCashFormat';
const props = defineProps<{ show: boolean; requestId: string }>();
const emit = defineEmits<{ close: [] }>();
const store = usePettyCashStore();
const { showToast } = useToastify();
const {
  rows,
  stage,
  error,
  saving,
  completed,
  total,
  canConfirm,
  rowError,
  select,
  remove,
  process,
  confirm,
  reset,
  cancel,
} = useBulkReceipts(store);
const fileInput = ref<HTMLInputElement | null>(null);
const dragging = ref(false);
function dropFiles(event: DragEvent) {
  dragging.value = false;
  select(Array.from(event.dataTransfer?.files || []));
}
// Keep the primary button mounted across stages so the dialog retains keyboard focus.
const primaryLabel = computed(() => stage.value === 'select' ? `Upload & extract (${rows.value.length})`
  : stage.value === 'processing' ? 'Processing receipts…'
  : saving.value ? 'Attaching receipts…' : `Confirm & attach (${rows.value.length})`);
function primaryAction() {
  if (stage.value === 'select') void process();
  else if (stage.value === 'review') void confirmReceipts();
}
const canEdit = computed(
  () => !!store.getRequestById(props.requestId)?.allowedActions.includes('addExpense'),
);
const categoryOptions = [
  'Office Supplies',
  'Hospitality & Food',
  'Hardware & Tools',
  'Transport & Delivery',
  'Maintenance & Repairs',
  'Printing & Stationery',
].map((name) => ({ id: name, name }));
const columns = [
  { label: 'File', style: 'w-1/5' },
  { label: 'Purchase', style: 'w-1/5' },
  { label: 'Date' },
  { label: 'What was bought', style: 'w-1/5' },
  { label: 'Total (MVR)' },
  { label: 'Remove' },
];
const statusLabel = (status: BulkReceiptRow['status']) =>
  ({
    queued: 'Queued',
    uploading: 'Uploading',
    uploaded: 'Uploaded · waiting',
    extracting: 'Extracting',
    ready: 'Ready to review',
    manual: 'Enter manually',
    upload_failed: 'Upload failed',
  })[status];
function chooseFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  select(Array.from(input.files || []));
  input.value = '';
}
watch(
  () => props.show,
  (open) => {
    if (open) reset();
    else cancel();
  },
);
watch(
  () => props.requestId,
  () => {
    cancel();
    emit('close');
  },
);
onScopeDispose(cancel);
function close() {
  if (saving.value) return;
  cancel();
  emit('close');
}
async function confirmReceipts() {
  if (!canEdit.value || store.busy) return;
  const count = rows.value.length;
  if (await confirm(props.requestId)) {
    showToast(`${count} receipts attached`, 'success');
    close();
  }
}
</script>

<style scoped>
/* UI-kit 1.0.39's desktop centering spacer makes the outer wrapper scrollable
   when a control receives focus. Keep that wrapper fixed; the modal body
   already provides scrolling for long receipt tables. */
:global([role="dialog"]:has(.bulk-receipts-content) [class~="po:overflow-y-hidden"]) {
  overflow: clip;
}
</style>
