<template>
  <div
    v-if="store.isPageReady(route.path) && store.listTotal > store.listPageSize"
    class="flex items-center justify-end gap-3 py-4"
  >
    <PoButton
      label="Previous"
      action-type="ghost"
      :disabled="store.busy || store.listPage <= 1 || store.listLoading"
      @button-click="change(store.listPage - 1)"
    /><PoTypography size="sm"
      >{{ store.listPage }} / {{ Math.ceil(store.listTotal / store.listPageSize) }}</PoTypography
    ><PoButton
      label="Next"
      action-type="ghost"
      :disabled="
        store.busy || store.listPage * store.listPageSize >= store.listTotal || store.listLoading
      "
      @button-click="change(store.listPage + 1)"
    />
  </div>
</template>
<script setup lang="ts">
import { PoButton, PoTypography, useToastify } from '@pension/ui-kit';
import { useFloatStore } from '~/stores/useFloatStore';
const store = useFloatStore();
const route = useRoute();
const { showToast } = useToastify();
async function change(page: number) {
  if (
    store.busy ||
    store.listLoading ||
    page < 1 ||
    page > Math.ceil(store.listTotal / store.listPageSize)
  )
    return;
  try {
    await store.nextPage(page);
  } catch (e) {
    showToast(e instanceof Error ? e.message : 'Could not load page', 'error');
  }
}
</script>
