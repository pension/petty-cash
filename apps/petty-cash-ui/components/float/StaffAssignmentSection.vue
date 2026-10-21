<template>
  <PoCard>
    <div class="p-4 space-y-3 border-b border-slate-200">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <PoHeading type="h2" size="sm" class="text-slate-900">{{ title }}</PoHeading>
            <PoStatusPill :label="`${assignments.length}`" color="blue" />
          </div>
          <PoTypography size="xs" variant="dimmed" class="block mt-0.5">{{
            description
          }}</PoTypography>
        </div>
        <PoButton
          v-if="canAdd"
          class="shrink-0 whitespace-nowrap"
          label="Add staff"
          size="sm"
          :icon="PlusIcon"
          :disabled="store.busy"
          @button-click="openAdd"
        />
      </div>
      <PoTypography v-if="assignments.length === 1" size="xs" variant="dimmed" class="block">
        At least one {{ type }} must remain. Add another staff member before removing this person.
      </PoTypography>
    </div>
    <ListTable v-if="assignments.length" :columns="columns">
      <ListRow
        v-for="assignment in assignments"
        :key="assignment.id"
        :cells="cells(assignment)"
        :title="assignment.name"
        :meta="
          [
            assignment.rcn || assignment.identifier,
            assignment.email,
            assignment.designation,
            assignment.department,
            `Added ${formatDate(assignment.addedAt)} by ${assignment.addedByName}`,
          ]
            .filter(Boolean)
            .join(' · ')
        "
      >
        <template v-if="canRemove" #actions>
          <PoButton
            label="Remove"
            size="sm"
            action-type="ghost"
            :icon="XMarkIcon"
            :disabled="assignments.length <= 1 || store.busy"
            :title="assignments.length <= 1 ? `At least one ${type} must remain` : undefined"
            @button-click="
              removeTarget = assignment;
              removeError = '';
            "
          />
        </template>
      </ListRow>
    </ListTable>
    <div v-else class="p-8">
      <PoEmpty
        :label="emptyLabel"
        :description="
          canAdd
            ? 'Add the first staff member to set up this list.'
            : 'Ask a Settings administrator to add the first staff member.'
        "
        :icon="UserGroupIcon"
        icon-color="fill-slate-400"
      />
    </div>
    <PoModal
      :show="showAdd"
      modal-title="Add staff"
      modal-width="sm:max-w-lg"
      @modal-closed="closeAdd"
    >
      <template #content>
        <form class="space-y-4" @submit.prevent="fetchEmployee">
          <PoTypography size="sm" class="block"
            >Add a staff member who can
            {{
              type === 'requester'
                ? 'create requests, collect cash and settle with receipts'
                : 'approve or reject requests'
            }}.</PoTypography
          >
          <PoInputField
            v-model="email"
            label="Work email"
            type="email"
            placeholder="name@pension.gov.mv"
            :disabled="processing || store.busy"
            required
          />
          <PoTypography v-if="processing" size="sm" class="block" role="status"
            >Fetching employee…</PoTypography
          >
          <PoMessage v-if="addError" :message="addError" role="alert" />
          <div v-if="employee" class="space-y-3" aria-live="polite">
            <PoTypography size="sm" strong class="block">Confirm employee details</PoTypography>
            <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              <template v-for="field in employeeFields" :key="field.label">
                <dt class="text-slate-500">{{ field.label }}</dt>
                <dd class="min-w-0 break-words text-slate-900">{{ field.value || '—' }}</dd>
              </template>
            </dl>
            <PoMessage
              v-if="duplicate"
              :message="`This staff member is already an active ${type}.`"
            />
          </div>
          <button type="submit" class="sr-only" tabindex="-1" :disabled="processing || store.busy">
            Fetch employee
          </button>
        </form>
      </template>
      <template #footer>
        <div class="p-4 flex justify-end gap-3">
          <PoButton
            label="Cancel"
            action-type="ghost"
            :disabled="store.busy"
            @button-click="closeAdd"
          />
          <PoButton
            v-if="!employee"
            :label="processing ? 'Fetching…' : 'Fetch employee'"
            :disabled="!email.trim() || processing || store.busy"
            @button-click="fetchEmployee"
          />
          <PoButton
            v-else
            :label="store.busy ? 'Adding…' : 'Confirm add'"
            :disabled="duplicate || store.busy || !canAdd"
            @button-click="confirmAdd"
          />
        </div>
      </template>
    </PoModal>
    <PoModal
      :show="!!removeTarget"
      modal-title="Remove staff"
      modal-width="sm:max-w-md"
      @modal-closed="closeRemove"
    >
      <template #content>
        <PoTypography v-if="removeTarget" size="sm" class="block">
          {{ removeTarget.name }} will no longer be on the {{ type }} list. Their existing requests
          and history are retained. They can be added again later with a new added date.
        </PoTypography>
        <PoMessage v-if="removeError" :message="removeError" role="alert" />
      </template>
      <template #footer>
        <div class="p-4 flex justify-end gap-3">
          <PoButton
            label="Cancel"
            action-type="ghost"
            :disabled="store.busy"
            @button-click="closeRemove"
          />
          <PoButton
            :label="store.busy ? 'Removing…' : 'Remove staff'"
            action-type="danger"
            :disabled="store.busy || assignments.length <= 1 || !canRemove"
            @button-click="confirmRemove"
          />
        </div>
      </template>
    </PoModal>
  </PoCard>
</template>
<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { PlusIcon, UserGroupIcon, XMarkIcon } from '@heroicons/vue/20/solid';
import {
  PoButton,
  PoCard,
  PoEmpty,
  PoHeading,
  PoInputField,
  PoMessage,
  PoModal,
  PoStatusPill,
  PoTypography,
  useToastify,
} from '@pension/ui-kit';
import ListRow, { type ListCell } from './ListRow.vue';
import ListTable, { type ListColumn } from './ListTable.vue';
import { useFloatStore } from '~/stores/useFloatStore';
import type { StaffAssignment, StaffAssignmentType, StaffEmployee } from '~/types/staffAssignments';
import { formatDate } from '~/utils/floatFormat';
const props = defineProps<{
  type: StaffAssignmentType;
  title: string;
  description: string;
  emptyLabel: string;
}>();
const store = useFloatStore();
const { showToast } = useToastify();
const assignments = computed(() => store.staffAssignments.filter((row) => row.type === props.type));
const canAdd = computed(
  () => store.currentUser.capabilities.lookupStaff && store.currentUser.capabilities.addStaff,
);
const canRemove = computed(() => store.currentUser.capabilities.removeStaff);
const showAdd = ref(false),
  email = ref(''),
  processing = ref(false),
  addError = ref(''),
  removeError = ref('');
const employee = ref<StaffEmployee | null>(null),
  removeTarget = ref<StaffAssignment | null>(null);
let lookupGeneration = 0;
const duplicate = computed(
  () =>
    !!employee.value &&
    assignments.value.some((row) => row.employeeId === employee.value!.employeeId),
);
const employeeFields = computed(() =>
  employee.value
    ? [
        { label: 'RCN', value: employee.value.rcn },
        { label: 'Identifier / NID', value: employee.value.identifier },
        { label: 'Name', value: employee.value.name },
        { label: 'Email', value: employee.value.email },
        { label: 'Designation', value: employee.value.designation },
        { label: 'Department', value: employee.value.department },
      ]
    : [],
);
watch(email, () => {
  lookupGeneration++;
  employee.value = null;
  addError.value = '';
  processing.value = false;
});
onBeforeUnmount(() => {
  lookupGeneration++;
});
function openAdd() {
  email.value = '';
  employee.value = null;
  addError.value = '';
  showAdd.value = true;
}
function closeAdd() {
  if (store.busy) return;
  lookupGeneration++;
  showAdd.value = false;
  processing.value = false;
  employee.value = null;
}
async function fetchEmployee() {
  if (processing.value || store.busy || !canAdd.value) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    addError.value = 'Enter a valid work email.';
    return;
  }
  const run = ++lookupGeneration;
  processing.value = true;
  employee.value = null;
  addError.value = '';
  try {
    const result = await store.lookupStaff(email.value.trim());
    if (run === lookupGeneration && showAdd.value) employee.value = result;
  } catch (error) {
    if (run === lookupGeneration)
      addError.value = error instanceof Error ? error.message : 'Could not fetch the employee.';
  } finally {
    if (run === lookupGeneration) processing.value = false;
  }
}
async function confirmAdd() {
  if (!employee.value || duplicate.value || store.busy || !canAdd.value) return;
  addError.value = '';
  try {
    await store.addStaffAssignment(props.type, employee.value);
    showToast('Staff member added', 'success');
    closeAdd();
  } catch (error) {
    addError.value = error instanceof Error ? error.message : 'Could not add the staff member.';
  }
}
function closeRemove() {
  if (!store.busy) removeTarget.value = null;
}
async function confirmRemove() {
  if (!removeTarget.value || store.busy || assignments.value.length <= 1 || !canRemove.value)
    return;
  removeError.value = '';
  try {
    await store.removeStaffAssignment(removeTarget.value.id);
    showToast('Staff member removed', 'info');
    closeRemove();
  } catch (error) {
    removeError.value =
      error instanceof Error ? error.message : 'Could not remove the staff member.';
  }
}
const columns = computed<ListColumn[]>(() => [
  { label: 'Staff' },
  { label: 'Designation', width: '12rem' },
  { label: 'Department', width: '10rem' },
  { label: 'Added', width: '9rem' },
  ...(canRemove.value ? [{ label: 'Action', width: '7rem', actions: true }] : []),
]);
function cells(row: StaffAssignment): ListCell[] {
  return [
    {
      text: row.name,
      sub: [row.rcn || row.identifier, row.email].filter(Boolean).join(' · '),
      class: 'font-medium text-slate-900',
    },
    { text: row.designation || '—' },
    { text: row.department || '—' },
    { text: formatDate(row.addedAt), sub: `by ${row.addedByName}` },
  ];
}
</script>
