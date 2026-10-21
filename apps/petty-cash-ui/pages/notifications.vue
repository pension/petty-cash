<template>
  <PoContentArea
    ><PoPageTitle
      :stand-alone="true"
      label="Notifications"
      description="Updates about petty cash requests and the vault." />
    <PageSkeleton v-if="!store.isPageReady('/notifications')" />
    <PoCard v-else
      ><div v-for="n in store.notifications" :key="n.id" class="p-4 border-b border-slate-200">
        <PoTypography strong>{{ n.title }}</PoTypography
        ><PoTypography>{{ n.text }}</PoTypography
        ><PoButton
          :label="n.seen ? 'Open' : 'Read update'"
          action-type="ghost"
          :disabled="store.busy"
          @button-click="open(n)"
        />
      </div>
      <PoEmpty
        v-if="!store.notifications.length"
        label="No notifications"
        description="Workflow updates will appear here."
    /></PoCard>
    <div v-if="store.isPageReady('/notifications')" class="flex justify-end gap-3 py-4">
      <PoButton
        label="Previous"
        :disabled="store.busy || page === 1"
        @button-click="change(page - 1)"
      /><PoButton
        label="Next"
        :disabled="page * 20 >= store.notificationTotal"
        @button-click="change(page + 1)"
      /></div
  ></PoContentArea>
</template>
<script setup lang="ts">
import PageSkeleton from '~/components/float/PageSkeleton.vue';
import {
  PoContentArea,
  PoPageTitle,
  PoCard,
  PoTypography,
  PoButton,
  PoEmpty,
  useToastify,
} from '@pension/ui-kit';
import { useFloatStore } from '~/stores/useFloatStore';
definePageMeta({ layout: 'main' });
const store = useFloatStore(),
  router = useRouter(),
  page = ref(1);
const { showToast } = useToastify();
async function change(p: number) {
  try {
    await store.fetchNotifications(p);
    page.value = p;
  } catch (e) {
    showToast(e instanceof Error ? e.message : 'Could not load notifications', 'error');
  }
}
async function open(n: { id: string; url: string }) {
  try {
    await store.markRead(n.id);
    await router.push(n.url);
  } catch (e) {
    showToast(e instanceof Error ? e.message : 'Could not open notification', 'error');
  }
}
</script>
