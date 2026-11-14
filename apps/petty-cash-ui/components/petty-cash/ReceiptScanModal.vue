<template>
  <PoModal
    :show="show"
    :modal-title="step === 'capture' ? 'Add receipt' : step === 'extracting' ? 'Reading receipt' : 'Receipt details'"
    modal-width="sm:max-w-lg"
    @modal-closed="close"
  >
    <template #content>
      <!-- STEP A: CAPTURE / ATTACH -->
      <div v-if="step === 'capture'" class="space-y-4">
        <div
          v-if="isScanning"
          class="bg-slate-900 rounded-xl aspect-4/3 flex flex-col items-center justify-center gap-2 p-6 text-center"
        >
          <SparklesIcon class="w-8 h-8 text-emerald-400 animate-spin" />
          <PoTypography size="sm" strong class="block text-emerald-300"
            >Uploading {{ fileName }}…</PoTypography
          >
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            class="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-sky-500 hover:bg-sky-50/50 focus-visible:outline-none focus-visible:border-sky-500 transition-colors"
            @click="cameraInput?.click()"
          >
            <CameraIcon class="w-8 h-8 text-slate-500" />
            <PoTypography size="sm" strong class="block text-slate-900">Take photo</PoTypography>
            <PoTypography size="xs" variant="dimmed" class="block"
              >Use your phone camera</PoTypography
            >
          </button>
          <button
            type="button"
            class="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-sky-500 hover:bg-sky-50/50 focus-visible:outline-none focus-visible:border-sky-500 transition-colors"
            @click="fileInput?.click()"
          >
            <PaperClipIcon class="w-8 h-8 text-slate-500" />
            <PoTypography size="sm" strong class="block text-slate-900">Attach file</PoTypography>
            <PoTypography size="xs" variant="dimmed" class="block"
              >Photo or PDF of the invoice</PoTypography
            >
          </button>
        </div>

        <input
          ref="cameraInput"
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden"
          @change="onFileChosen"
        >
        <input
          ref="fileInput"
          type="file"
          accept="image/*,application/pdf"
          class="hidden"
          @change="onFileChosen"
        >

        <div v-if="!isScanning" class="flex justify-center">
          <PoButton
            label="Enter details without a file"
            action-type="ghost"
            size="sm"
            :disabled="store.busy"
            @button-click="enterManually"
          />
        </div>
      </div>

      <div
        v-else-if="step === 'extracting'"
        class="space-y-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div class="bg-slate-900 rounded-xl aspect-4/3 flex flex-col items-center justify-center gap-2 p-6 text-center">
          <SparklesIcon class="w-8 h-8 text-emerald-400 animate-spin" aria-hidden="true" />
          <PoTypography size="sm" strong class="block text-emerald-300">Reading {{ fileName }}…</PoTypography>
          <PoTypography size="sm" class="block text-white">Checking the document and extracting receipt details.</PoTypography>
        </div>
        <PoMessage msg-type="blue" title="Extracting details" message="The form will appear when extraction finishes. If the document cannot be read, you can enter the details manually." />
      </div>

      <!-- STEP B: REVIEW DETAILS -->
      <div v-else class="space-y-4">
        <PoMessage
          v-if="fileName"
          msg-type="green"
          :title="`Attached: ${fileName}`"
          message="Check the vendor, date and total match the receipt before saving."
        />
        <PoMessage
          v-else
          msg-type="orange"
          title="No receipt attached"
          message="Finance may ask for the original invoice when you settle."
        />

        <PoMessage
          v-if="aiMessage"
          :msg-type="aiState === 'failed' ? 'orange' : 'blue'"
          :title="aiState === 'done' ? 'Review AI suggestions' : 'Enter details manually'"
          :message="aiMessage"
        />
        <PoButton
          v-if="fileId && aiState !== 'loading'"
          label="Retry AI extraction"
          action-type="ghost"
          size="sm"
          :disabled="store.busy"
          @button-click="extractDetails"
        />

        <div class="space-y-3">
          <PoInputField
            v-model="form.supplierName"
            label="Vendor"
            placeholder="e.g. Novelty Bookshop"
            required
          />
          <div class="grid grid-cols-2 gap-3">
            <PoInputField v-model="form.expenseDate" label="Date" type="date" required />
            <PoInputField
              v-model="form.amount"
              label="Total (MVR)"
              type="number"
              :min="0"
              placeholder="0.00"
              required
            />
          </div>
          <PoInputField
            v-model="form.invoiceNumber"
            label="Invoice no"
            placeholder="e.g. INV-2041"
          />
          <PoSelectField v-model="form.category" label="Category" :list="categoryOptions" />
          <PoInputField
            v-model="form.description"
            label="What was bought"
            placeholder="e.g. A4 papers, markers, file folders"
            required
          />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="p-4 flex items-center justify-between border-t border-slate-100">
        <PoButton
          v-if="step !== 'edit'"
          label="Cancel"
          action-type="ghost"
          size="sm"
          :disabled="store.busy"
          @button-click="close"
        />
        <PoButton
          v-else
          label="Back"
          action-type="ghost"
          size="sm"
          :icon="ArrowPathIcon"
          :disabled="store.busy"
          @button-click="back"
        />
        <PoButton
          v-if="step === 'edit'"
          label="Save receipt"
          size="sm"
          :disabled="store.busy || !canSave"
          @button-click="handleSave"
        />
      </div>
    </template>
  </PoModal>
</template>

<script setup lang="ts">
import { applyReceiptExtraction } from '~/utils/receiptExtraction';
import { computed, onScopeDispose, reactive, ref, watch } from 'vue';
import { ArrowPathIcon, CameraIcon, PaperClipIcon, SparklesIcon } from '@heroicons/vue/20/solid';
import {
  PoButton,
  PoInputField,
  PoMessage,
  PoModal,
  PoSelectField,
  PoTypography,
  useToastify,
} from '@pension/ui-kit';
import { usePettyCashStore } from '~/stores/usePettyCashStore';

const props = defineProps<{ show: boolean; requestId: string }>();
const emit = defineEmits<{ close: [] }>();

const store = usePettyCashStore();
const { showToast } = useToastify();

const categoryOptions = [
  { id: 'Office Supplies', name: 'Office Supplies' },
  { id: 'Hospitality & Food', name: 'Hospitality & Food' },
  { id: 'Hardware & Tools', name: 'Hardware & Tools' },
  { id: 'Transport & Delivery', name: 'Transport & Delivery' },
  { id: 'Maintenance & Repairs', name: 'Maintenance & Repairs' },
  { id: 'Printing & Stationery', name: 'Printing & Stationery' },
];

const cameraInput = ref<HTMLInputElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const step = ref<'capture' | 'extracting' | 'edit'>('capture');
const isScanning = ref(false);
const fileName = ref('');
const fileUrl = ref('');
const fileId = ref('');
let uploadGeneration = 0;
let extractionGeneration = 0;
const aiState = ref<'idle' | 'loading' | 'done' | 'failed'>('idle');
const aiMessage = ref('');
const editedFields = new Set<string>();
let applyingExtraction = false;

const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Indian/Maldives',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const form = reactive({
  supplierName: '',
  expenseDate: today(),
  amount: '',
  invoiceNumber: '',
  category: 'Office Supplies',
  description: '',
});

for (const field of ['supplierName', 'expenseDate', 'amount', 'invoiceNumber', 'description', 'category'] as const) {
  watch(() => form[field], () => {
    if (!applyingExtraction) editedFields.add(field);
  }, { flush: 'sync' });
}

function clearSuggestions() {
  const defaults = { supplierName: '', expenseDate: today(), amount: '', invoiceNumber: '', category: 'Office Supplies', description: '' };
  applyingExtraction = true;
  try {
    for (const field of Object.keys(defaults) as (keyof typeof defaults)[]) {
      if (!editedFields.has(field)) form[field] = defaults[field];
    }
  } finally { applyingExtraction = false; }
}

function stopExtraction() {
  extractionGeneration++;
  aiState.value = 'idle';
  aiMessage.value = '';
}
onScopeDispose(() => {
  stopExtraction();
  uploadGeneration++;
  if (fileUrl.value) URL.revokeObjectURL(fileUrl.value);
});
function back() {
  stopExtraction();
  step.value = 'capture';
}
async function extractDetails() {
  if (!fileId.value || aiState.value === 'loading') return;
  const run = ++extractionGeneration;
  const attachment = fileId.value;
  const before = { ...form };
  aiState.value = 'loading';
  step.value = 'extracting';
  aiMessage.value = '';
  try {
    const result = await store.extractReceipt(attachment);
    if (run !== extractionGeneration || attachment !== fileId.value) return;
    if (result.documentType === 'other' || result.documentType === 'unknown') {
      clearSuggestions();
      aiState.value = 'failed';
      aiMessage.value = result.documentType === 'other'
        ? 'This file does not appear to be a bill, receipt or invoice. Enter the details manually, or go back to choose another file.'
        : 'AI could not identify this file as a bill, receipt or invoice. Enter the details manually, or try a clearer file.';
      return;
    }
    applyingExtraction = true;
    try { applyReceiptExtraction(form, before, result, editedFields); }
    finally { applyingExtraction = false; }
    aiState.value = 'done';
    aiMessage.value = 'Check the extracted details against the receipt. You can edit every field before saving.';
  } catch {
    if (run !== extractionGeneration) return;
    aiState.value = 'failed';
    aiMessage.value = 'AI could not read this receipt. Your attachment is saved. Enter the details manually or retry.';
  } finally {
    if (run === extractionGeneration && attachment === fileId.value) step.value = 'edit';
  }
}

const canSave = computed(
  () =>
    form.supplierName.trim() !== '' &&
    !!form.expenseDate &&
    Number(form.amount) > 0 &&
    form.description.trim() !== '',
);

function reset() {
  stopExtraction();
  step.value = 'capture';
  isScanning.value = false;
  fileName.value = '';
  if (fileUrl.value) URL.revokeObjectURL(fileUrl.value);
  fileUrl.value = '';
  fileId.value = '';
  uploadGeneration++;
  Object.assign(form, {
    supplierName: '',
    expenseDate: today(),
    amount: '',
    invoiceNumber: '',
    category: 'Office Supplies',
    description: '',
  });
  editedFields.clear();
}

watch(
  () => props.show,
  (open) => {
    if (open) reset();
    else { stopExtraction(); uploadGeneration++; }
  },
);

function close() {
  stopExtraction();
  uploadGeneration++;
  if (fileUrl.value) URL.revokeObjectURL(fileUrl.value);
  emit('close');
}

function enterManually() {
  stopExtraction();
  fileName.value = '';
  if (fileUrl.value) URL.revokeObjectURL(fileUrl.value);
  fileUrl.value = '';
  fileId.value = '';
  uploadGeneration++;
  step.value = 'edit';
}

async function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    showToast('Maximum receipt size is 10 MB.', 'error');
    return;
  }
  stopExtraction();
  clearSuggestions();
  fileId.value = '';
  if (fileUrl.value) URL.revokeObjectURL(fileUrl.value);
  fileUrl.value = '';
  const generation = ++uploadGeneration;
  fileName.value = file.name;
  isScanning.value = true;
  try {
    const uploaded = await store.uploadReceipt(file);
    if (generation !== uploadGeneration) return;
    fileId.value = uploaded.fileId;
    fileUrl.value = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    void extractDetails();
  } catch (err) {
    if (generation === uploadGeneration) {
      fileName.value = '';
      showToast(err instanceof Error ? err.message : 'Could not upload receipt.', 'error');
    }
  } finally {
    if (generation === uploadGeneration) isScanning.value = false;
  }
}
async function handleSave() {
  if (!canSave.value || isScanning.value || step.value !== 'edit') return;
  stopExtraction();
  try {
    await store.addExpense(props.requestId, {
      description: form.description.trim(),
      supplierName: form.supplierName.trim(),
      category: form.category,
      invoiceNumber: form.invoiceNumber.trim() || undefined,
      expenseDate: form.expenseDate,
      amount: Number(form.amount),
      fileId: fileId.value || undefined,
    });
    showToast('Receipt saved', 'success');
    close();
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not save receipt.', 'error');
  }
}
</script>
