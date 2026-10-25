<template>
  <!-- Pipeline counts. Hidden on phones, where screen space goes to the list. -->
  <div class="hidden sm:block">
    <PoStatsBlock :items="stats" number-of-cols="grid-cols-2 lg:grid-cols-4 gap-3" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BanknotesIcon, ClockIcon, ScaleIcon, WalletIcon } from '@heroicons/vue/20/solid';
import { PoStatsBlock } from '@pension/ui-kit';
import { usePettyCashStore } from '~/stores/usePettyCashStore';

const store = usePettyCashStore();

const stats = computed(() => [
  {
    label: 'Pending GS approval',
    value: store.stats.pendingApproval,
    icon: ClockIcon,
    bgColor: 'bg-yellow-50',
    iconColor: 'text-yellow-700',
  },
  {
    label: 'Pending disbursement',
    value: store.stats.pendingDisbursement,
    icon: BanknotesIcon,
    bgColor: 'bg-sky-50',
    iconColor: 'text-sky-700',
  },
  {
    label: 'Unsettled petty cash',
    value: store.stats.unsettled,
    icon: WalletIcon,
    bgColor: 'bg-orange-50',
    iconColor: 'text-orange-700',
  },
  {
    label: 'Awaiting closure',
    value: store.stats.awaitingClosure,
    icon: ScaleIcon,
    bgColor: 'bg-green-50',
    iconColor: 'text-green-700',
  },
]);
</script>
