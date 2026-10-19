<template>
  <PoContentArea>
    <header class="mb-6">
      <PoPageTitle
        :stand-alone="true"
        label="Create Short Link"
        description="Enter a long URL to create a trackable, customizable short link with optional expiration."
      />
    </header>

    <div class="max-w-3xl">
      <PoCard class="p-6">
        <form class="space-y-6" @submit.prevent="handleCreateLink">
          <PoInputField
            v-model="form.longUrl"
            label="Destination URL"
            placeholder="https://example.com/very/long/path/to/resource"
            :error-message="errors.longUrl"
            info="Paste the long URL you want to shorten. Must include http:// or https://"
          />

          <PoInputField
            v-model="form.title"
            label="Title"
            placeholder="e.g. Annual Report 2026"
            info="Give your link a recognizable name to search and filter by later."
          />

          <PoInputField
            v-model="form.customBackHalf"
            label="Custom back-half (optional)"
            placeholder="e.g. annual-report-2026"
            info="Custom slug instead of randomly generated characters."
          />

          <PoMultiSelect
            v-model="form.tagsSelected"
            label="Tags"
            :items="availableTags"
            :allow-custom-values="true"
            info="Add searchable tag terms. Hit Enter to add a custom tag."
          />

          <!-- Link Expiration Settings -->
          <div class="border-t border-slate-100 pt-5 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Link Expiration
                </h4>
                <p class="text-xs text-slate-500">
                  Set an automatic expiration date for this short link.
                </p>
              </div>
              <PoToggle v-model="enableExpiration" label="Enable Expiration" />
            </div>

            <div
              v-if="enableExpiration"
              class="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 mt-3 transition-all"
            >
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label class="text-xs font-semibold text-slate-700 block mb-1"
                    >Expiration Date</label
                  >
                  <input
                    v-model="form.expiresAt"
                    type="date"
                    :min="minDate"
                    class="w-full text-xs font-medium px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-800"
                  >
                </div>
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-[0.68rem] text-slate-400 font-semibold uppercase block w-full"
                    >Quick Presets</span
                  >
                  <PoButton
                    v-for="preset in datePresets"
                    :key="preset.label"
                    :label="'+' + preset.label"
                    size="sm"
                    color="slate"
                    action-type="ghost"
                    @button-click="setPresetDate(preset.days)"
                  />
                </div>
              </div>
              <p class="text-[0.68rem] text-slate-400">
                Once the expiration date is reached, the link will show as inactive and visitors
                will be redirected to an expiration landing page.
              </p>
            </div>
          </div>

          <!-- QR Code Appearance -->
          <div v-if="templates.length" class="border-t border-slate-100 pt-5 space-y-3">
            <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider">
              QR Code Appearance
            </h4>
            <p class="text-xs text-slate-500">
              Every link gets an auto-generated QR code. Pick a saved template to style it, or
              leave it on the default look.
            </p>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div
                role="button"
                tabindex="0"
                aria-label="No template, use default appearance"
                class="p-3 border rounded-xl flex flex-col items-center justify-center space-y-1.5 transition-all text-center cursor-pointer"
                :class="[
                  selectedTemplateId === null ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-200',
                ]"
                @click="selectedTemplateId = null"
                @keydown.enter="selectedTemplateId = null"
              >
                <div
                  class="w-10 h-10 rounded border bg-white shrink-0 [&>svg]:w-full [&>svg]:h-full"
                  v-html="defaultPreviewSvg"
                />
                <span class="text-[0.68rem] font-semibold text-slate-700">No template</span>
              </div>
              <div
                v-for="tmpl in templates"
                :key="tmpl.id"
                role="button"
                tabindex="0"
                :aria-label="'Select template ' + tmpl.name"
                class="p-3 border rounded-xl flex flex-col items-center justify-center space-y-1.5 transition-all text-center cursor-pointer"
                :class="[
                  selectedTemplateId === tmpl.id ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-200',
                ]"
                @click="selectedTemplateId = tmpl.id"
                @keydown.enter="selectedTemplateId = tmpl.id"
              >
                <div
                  class="w-10 h-10 rounded border bg-white shrink-0 [&>svg]:w-full [&>svg]:h-full"
                  v-html="templatePreviewSvg(tmpl)"
                />
                <span class="text-[0.68rem] font-semibold text-slate-700 leading-tight">{{
                  tmpl.name
                }}</span>
              </div>
            </div>
          </div>

          <!-- QR Code Frame -->
          <div v-if="frames.length" class="border-t border-slate-100 pt-5 space-y-3">
            <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider">
              QR Code Frame
            </h4>
            <p class="text-xs text-slate-500">
              Optionally wrap the QR code in a saved frame (border, banner, or custom background).
            </p>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div
                role="button"
                tabindex="0"
                aria-label="No frame"
                class="p-2 border rounded-xl flex flex-col items-center justify-center space-y-1.5 transition-all text-center cursor-pointer"
                :class="[
                  selectedFrameId === null ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-200',
                ]"
                @click="selectedFrameId = null"
                @keydown.enter="selectedFrameId = null"
              >
                <div
                  class="w-16 h-16 rounded border bg-white shrink-0 [&>svg]:w-full [&>svg]:h-full"
                  v-html="defaultPreviewSvg"
                />
                <span class="text-[0.68rem] font-semibold text-slate-700">No frame</span>
              </div>
              <div
                v-for="frame in frames"
                :key="frame.id"
                role="button"
                tabindex="0"
                :aria-label="'Select frame ' + frame.name"
                class="p-2 border rounded-xl flex flex-col items-center justify-center space-y-1.5 transition-all text-center cursor-pointer"
                :class="[
                  selectedFrameId === frame.id ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-200',
                ]"
                @click="selectedFrameId = frame.id"
                @keydown.enter="selectedFrameId = frame.id"
              >
                <div
                  class="w-16 h-[78px] rounded border bg-white shrink-0 [&>svg]:w-full [&>svg]:h-full"
                  v-html="framePreviewSvg(frame)"
                />
                <span class="text-[0.68rem] font-semibold text-slate-700 leading-tight">{{
                  frame.name
                }}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end space-x-3 border-t border-slate-100 pt-4">
            <PoButton
              label="Cancel"
              action-type="ghost"
              @button-click="router.push('/links')"
            />
            <PoButton type="submit" label="Create Short Link" :disabled="isSubmitting" />
          </div>
        </form>
      </PoCard>
    </div>
  </PoContentArea>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from '#imports';
import { buildFramedQrSvg, buildQrSvg } from '@petty-cash/qr-render';
import {
  PoButton,
  PoCard,
  PoContentArea,
  PoInputField,
  PoMultiSelect,
  PoPageTitle,
  PoToggle,
  useToastify,
} from '@pension/ui-kit';
import { computed, onMounted, ref } from 'vue';
import { useShortUrlStore, type QRFrameItem, type QRTemplateItem } from '~/stores/shorturl';

const DEFAULT_DESIGN = {
  fgColor: '#000000',
  bgColor: '#ffffff',
  style: 'soft-pixel',
  corner: 'classic-square',
};

definePageMeta({
  layout: 'main',
});

useHead({
  title: 'Create Link - petty-cash',
});

const store = useShortUrlStore();
const route = useRoute();
const router = useRouter();
const { showToast } = useToastify();

const templates = computed(() => store.templates);
// Pre-selects a template when arriving via a "Use in QR" link from Settings.
const selectedTemplateId = ref<string | null>((route.query.templateId as string) || null);

const defaultPreviewSvg = buildQrSvg({
  value: 'https://preview',
  fgColor: '#000000',
  bgColor: '#ffffff',
  style: 'soft-pixel',
  corner: 'classic-square',
});

function templatePreviewSvg(tmpl: QRTemplateItem) {
  return buildQrSvg({
    value: 'https://preview',
    fgColor: tmpl.fgColor,
    bgColor: tmpl.bgColor,
    style: tmpl.style,
    corner: tmpl.corner,
    overlayType: tmpl.overlayType,
    overlayText: tmpl.overlayText,
    logo: tmpl.logo,
  });
}

const frames = computed(() => store.frames);
const selectedFrameId = ref<string | null>(null);

// The frame picker previews the currently-selected theme's colors/style,
// not a generic placeholder — frame is applied on top of theme.
const currentDesign = computed(() => {
  const tmpl = selectedTemplateId.value
    ? store.getTemplateById(selectedTemplateId.value)
    : null;
  return tmpl
    ? { fgColor: tmpl.fgColor, bgColor: tmpl.bgColor, style: tmpl.style, corner: tmpl.corner }
    : DEFAULT_DESIGN;
});

// buildFramedQrSvg (not the DOM/CSS <QRFramePreview> component) — its
// viewBox-based SVG scales cleanly to any container size via CSS.
// QRFramePreview can't: its inner QRCodePreview always renders at a fixed
// pixel size (e.g. 140px for size="sm") regardless of the parent box it's
// placed in, so shrinking it down for a small picker card just clips the
// QR instead of scaling it.
function framePreviewSvg(frame: QRFrameItem) {
  return buildFramedQrSvg({
    value: 'https://preview',
    fgColor: currentDesign.value.fgColor,
    bgColor: currentDesign.value.bgColor,
    style: currentDesign.value.style,
    corner: currentDesign.value.corner,
    frameType: frame.frameType,
    frameColor: frame.frameColor,
    textColor: frame.textColor,
    borderColor: frame.borderColor,
    qrPosition: frame.qrPosition,
    qrSizePercent: frame.qrSizePercent,
    ctaText: frame.ctaText,
    customImageUrl: frame.customImageUrl,
  });
}

onMounted(() => {
  store.fetchLinks();
  store.fetchTemplates();
  store.fetchFrames();
});

const enableExpiration = ref(false);

interface TagOption {
  id: string | number;
  name: string;
}

const form = ref({
  longUrl: '',
  title: '',
  customBackHalf: '',
  expiresAt: '',
  tagsSelected: [] as (TagOption | string)[],
});

const errors = ref({
  longUrl: '',
});

const isSubmitting = ref(false);

const minDate = computed(() => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
});

const datePresets = [
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
];

const setPresetDate = (days: number) => {
  const target = new Date();
  target.setDate(target.getDate() + days);
  form.value.expiresAt = target.toISOString().split('T')[0];
};

const availableTags = computed(() => {
  const tagsSet = new Set<string>();
  store.links.forEach((l) => l.tags.forEach((t) => tagsSet.add(t)));
  return Array.from(tagsSet).map((tag, idx) => ({ id: idx + 1, name: tag }));
});

const handleCreateLink = async () => {
  errors.value.longUrl = '';

  if (!form.value.longUrl) {
    errors.value.longUrl = 'Destination URL is required';
    return;
  }

  try {
    let url = form.value.longUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    new URL(url);
    form.value.longUrl = url;
  } catch {
    errors.value.longUrl = 'Please enter a valid URL';
    return;
  }

  isSubmitting.value = true;

  try {
    const tags = form.value.tagsSelected.map((t) => {
      if (typeof t === 'string') return t;
      return t.name;
    });

    const expiration =
      enableExpiration.value && form.value.expiresAt ? form.value.expiresAt : null;

    const newLink = await store.addLink(
      form.value.title,
      form.value.longUrl,
      form.value.customBackHalf || undefined,
      tags,
      expiration,
      selectedTemplateId.value,
      selectedFrameId.value
    );

    showToast('Short link created successfully!', 'success');
    router.push(`/links/${newLink.id}`);
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Failed to create short link', 'error');
  } finally {
    isSubmitting.value = false;
  }
};
</script>
