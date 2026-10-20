<template>
  <PoModal
    :show="show"
    modal-title="Notify for collection"
    modal-width="sm:max-w-md"
    @modal-closed="close"
  >
    <template #content>
      <div v-if="request" class="space-y-4">
        <PoDescriptionList
          density="compact"
          :items="[
            { title: 'Voucher no', description: request.id },
            { title: 'Requester', description: request.requester.name },
            { title: 'Particulars', description: request.purpose },
            { title: 'Requested', description: `MVR ${formatMoney(request.requestedAmount)}` },
          ]"
        />
        <PoInputField
          v-model="amount"
          label="Amount being given (MVR)"
          type="number"
          :min="0"
          placeholder="0.00"
          required
        />
        <PoMessage
          v-if="isDifferent"
          msg-type="orange"
          :title="`${amountValue < request.requestedAmount ? 'Less' : 'More'} than requested`"
          :message="`MVR ${formatMoney(Math.abs(amountValue - request.requestedAmount))} ${amountValue < request.requestedAmount ? 'below' : 'above'} the request. Tell ${request.requester.name} why.`"
        />
        <PoTextarea
          v-if="isDifferent"
          v-model="reason"
          label="Reason"
          placeholder="e.g. Only MVR 500 needed after confirming quote with vendor"
          :rows="2"
          required
        />
      </div>
    </template>
    <template #footer>
      <div class="p-4 flex justify-end gap-3">
        <PoButton label="Cancel" action-type="ghost" :disabled="store.busy" @button-click="close" />
        <PoButton
          :label="amountValue > 0 ? `Notify · MVR ${formatMoney(amountValue)}` : 'Notify requester'"
          :icon="BellAlertIcon"
          :disabled="store.busy || !canSubmit"
          @button-click="handleConfirm"
        />
      </div>
    </template>
  </PoModal>
</template>

<script setup lang="ts">
import { formatMoney } from '~/utils/floatFormat';

import { computed, ref, watch } from 'vue';
import { BellAlertIcon } from '@heroicons/vue/20/solid';
import {
  PoButton,
  PoDescriptionList,
  PoInputField,
  PoMessage,
  PoModal,
  PoTextarea,
  useToastify,
} from '@pension/ui-kit';
import { useFloatStore } from '~/stores/useFloatStore';
import type { PettyCashSummary as PettyCashRequest } from '~/types/float';

const props = defineProps<{ show: boolean; request: PettyCashRequest | null }>();
const emit = defineEmits<{ close: [] }>();

const store = useFloatStore();
const { showToast } = useToastify();

const amount = ref('');
const reason = ref('');

watch(
  () => props.show,
  (open) => {
    if (!open || !props.request) return;
    amount.value = String(props.request.approvedAmount || props.request.requestedAmount);
    reason.value = '';
  },
);

const amountValue = computed(() => Number(amount.value) || 0);
const isDifferent = computed(
  () =>
    !!props.request && amountValue.value > 0 && amountValue.value !== props.request.requestedAmount,
);
const canSubmit = computed(
  () => amountValue.value > 0 && (!isDifferent.value || reason.value.trim() !== ''),
);

function close() {
  emit('close');
}

async function handleConfirm() {
  try {
    if (!props.request || !canSubmit.value) return;
    await store.prepareCashByFinance(props.request.id, {
      approvedAmount: amountValue.value,
      notes: isDifferent.value ? reason.value.trim() : undefined,
    });
    showToast(
      `${props.request.requester.name} notified to collect MVR ${formatMoney(amountValue.value)}`,
      'success',
    );
    close();
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Could not complete this action.', 'error');
  }
}
</script>
