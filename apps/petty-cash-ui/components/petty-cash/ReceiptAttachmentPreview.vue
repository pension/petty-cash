<template>
  <div class="space-y-3">
    <div v-if="src" class="rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
      <iframe
        v-if="isPdf && !failed"
        :src="pdfSrc"
        :title="`PDF receipt: ${fileName || 'Attachment'}`"
        class="block w-full h-[65dvh] min-h-[360px] border-0 bg-white"
        @error="failed = true"
      />
      <div v-else-if="isImage && !failed" class="p-3">
        <PoTypography v-if="loading" size="sm" variant="dimmed" class="block p-4 text-center" role="status">Loading receipt image…</PoTypography>
        <img
          :src="src"
          :alt="description || fileName || 'Receipt attachment'"
          class="block w-full max-h-[75dvh] object-contain rounded-lg"
          @load="loading = false"
          @error="failed = true; loading = false"
        >
      </div>
      <div v-else class="p-5">
        <PoMessage msg-type="orange" title="Preview unavailable" message="This browser cannot display the attachment here. Open it to view or download the document." />
      </div>
    </div>
    <PoTypography v-else size="sm" variant="dimmed" class="block">No document was attached to this receipt.</PoTypography>
    <div v-if="src" class="flex flex-wrap items-center justify-between gap-3">
      <PoTypography v-if="isPdf" size="xs" variant="dimmed">If the PDF does not display, open the attachment.</PoTypography>
      <PoButton label="Open attachment" action-type="ghost" size="sm" @button-click="open" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { PoButton, PoMessage, PoTypography } from '@pension/ui-kit';
const props = defineProps<{ src?: string; contentType?: string; fileName?: string; description?: string }>();
const failed = ref(false);
const loading = ref(true);
const isPdf = computed(() => props.contentType ? props.contentType === 'application/pdf' : /\.pdf$/i.test(props.fileName || ''));
const isImage = computed(() => props.contentType ? props.contentType.startsWith('image/') : /\.(jpe?g|png|webp|heic|heif)$/i.test(props.fileName || ''));
const pdfSrc = computed(() => props.src ? `${props.src.split('#')[0]}#navpanes=0&view=FitH` : undefined);
watch(() => props.src, () => { failed.value = false; loading.value = true; });
function open() {
  if (props.src) window.open(props.src, '_blank', 'noopener,noreferrer');
}
</script>
