<template>
  <PoModal
    :show="show"
    :modal-title="request ? `Edit ${request.id}` : 'Petty cash request'"
    modal-width="sm:max-w-md"
    @modal-closed="close"
  >
    <template #content>
      <div class="space-y-4">
        <PoTextarea
          v-model="form.purpose"
          label="Particulars / description"
          placeholder="e.g. Office cleaning supplies"
          rows="3"
          required
        />
        <PoInputField
          v-model="form.requestedAmount"
          label="Requested petty cash (MVR)"
          placeholder="0.00"
          type="number"
          :min="0"
          required
        />
        <PoDatePicker v-model="form.neededBy" label="Needed by" :min-date="today" required />
        <PoTypography v-if="request" size="xs" variant="dimmed" class="block">
          You can edit this request until GS authorizes it.
        </PoTypography>
      </div>
    </template>
    <template #footer>
      <div class="p-4 flex justify-end gap-3">
        <PoButton label="Cancel" action-type="ghost" :disabled="store.busy" @button-click="close" />
        <PoButton
          :label="request ? 'Save changes' : 'Submit request'"
          :disabled="store.busy || !canSubmit"
          @button-click="handleSubmit"
        />
      </div>
    </template>
  </PoModal>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import {
  PoButton,
  PoDatePicker,
  PoInputField,
  PoModal,
  PoTextarea,
  PoTypography,
  useToastify,
} from '@pension/ui-kit';
import { useFloatStore } from '~/stores/useFloatStore';
import type { PettyCashSummary as PettyCashRequest } from '~/types/float';

// Pass `request` to edit an existing request; omit it to create a new one.
const props = defineProps<{ show: boolean; request?: PettyCashRequest | null }>();
const emit = defineEmits<{ close: [] }>();

const store = useFloatStore();
const { showToast } = useToastify();

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Indian/Maldives',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const form = reactive({ purpose: '', requestedAmount: '', neededBy: today as string | null });

watch(
  () => props.show,
  (open) => {
    if (!open) return;
    form.purpose = props.request?.purpose || '';
    form.requestedAmount = props.request ? String(props.request.requestedAmount) : '';
    form.neededBy = props.request?.effectiveClosingDate?.slice(0, 10) || today;
  },
);

const isChanged = computed(
  () =>
    !props.request ||
    form.purpose.trim() !== props.request.purpose ||
    Number(form.requestedAmount) !== props.request.requestedAmount ||
    form.neededBy !== props.request.effectiveClosingDate?.slice(0, 10),
);

const canSubmit = computed(
  () =>
    (props.request
      ? props.request.allowedActions.includes('edit') && store.staffEligibility.requester
      : store.currentUser.capabilities.createRequest) &&
    form.purpose.trim() !== '' &&
    Number(form.requestedAmount) > 0 &&
    !!form.neededBy &&
    isChanged.value,
);

function close() {
  emit('close');
}

async function handleSubmit() {
  try {
    if (!canSubmit.value) return;
    const payload = {
      purpose: form.purpose.trim(),
      requestedAmount: Number(form.requestedAmount),
      neededBy: form.neededBy as string,
    };

    if (props.request) {
      await store.updateRequest(props.request.id, payload);
      showToast(`${props.request.id} updated`, 'success');
    } else {
      await store.createRequest({
        purpose: payload.purpose,
        requestedAmount: payload.requestedAmount,
        estimatedClosingDate: payload.neededBy,
      });
      showToast('Request sent for GS approval', 'success');
    }
    close();
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not complete this action.', 'error');
  }
}
</script>
