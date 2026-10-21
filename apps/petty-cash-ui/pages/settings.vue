<template>
  <PoContentArea>
    <header class="lg:flex lg:items-end justify-between border-b border-slate-200 pb-5 mb-5">
      <div class="min-w-0 flex-1">
        <PoPageTitle
          :stand-alone="true"
          label="Settings"
          description="Choose who on the GS side can create petty cash requests and who can approve them."
        />
      </div>
    </header>

    <PageSkeleton v-if="!store.isPageReady('/settings')" :sections="2" :rows="3" />

    <div v-else class="space-y-6 pb-8">
      <StaffAssignmentSection
        type="requester"
        title="Can create requests"
        description="These staff can request petty cash, collect it and settle with receipts. Keep at least one."
        empty-label="No one can create requests yet"
      />
      <StaffAssignmentSection
        type="approver"
        title="Can approve requests"
        description="These staff authorize or reject requests on GS Approvals before they go to Finance. Keep at least one."
        empty-label="No one can approve requests"
      />
    </div>
  </PoContentArea>
</template>

<script setup lang="ts">
import PageSkeleton from '~/components/float/PageSkeleton.vue';
import { PoContentArea, PoPageTitle } from '@pension/ui-kit';
import { useFloatStore } from '~/stores/useFloatStore';
import StaffAssignmentSection from '~/components/float/StaffAssignmentSection.vue';

const store = useFloatStore();

definePageMeta({
  layout: 'main',
});

useHead({
  title: 'Petty Cash — Settings',
});
</script>
