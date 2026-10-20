<template>
  <div v-if="store.listTotal > store.listPageSize" class="flex items-center justify-end gap-3 py-4">
    <PoButton
      label="Previous"
      action-type="ghost"
      :disabled="store.busy || store.listPage <= 1 || busy"
      @button-click="change(store.listPage - 1)"
    /><PoTypography size="sm"
      >{{ store.listPage }} / {{ Math.ceil(store.listTotal / store.listPageSize) }}</PoTypography
    ><PoButton
      label="Next"
      action-type="ghost"
      :disabled="store.listPage * store.listPageSize >= store.listTotal || busy"
      @button-click="change(store.listPage + 1)"
    />
  </div>
</template>
<script setup lang="ts">
import { PoButton, PoTypography, useToastify } from '@pension/ui-kit';
import { useFloatStore } from '~/stores/useFloatStore';
const store = useFloatStore(),
  busy = ref(false);
const { showToast } = useToastify();
async function change(page: number) {
  busy.value = true;
  try {
    await store.nextPage(page);
  } catch (e) {
    showToast(e instanceof Error ? e.message : 'Could not load page', 'error');
  } finally {
    busy.value = false;
  }
}
</script>
