<template>
  <PoContentArea>
    <!-- Page Header -->
    <header class="lg:flex lg:items-end justify-between mb-4">
      <PoPageTitle
        class="grow"
        :stand-alone="true"
        label="Settings"
        description="Manage reusable QR code styling templates and custom frame layouts for your organization."
      />
      <div class="mt-5 lg:mt-0 shrink-0 flex items-center gap-2">
        <PoButton
          v-if="currentTab === 'QR Code Templates'"
          label="Create Template"
          :icon="PlusIcon"
          @button-click="openCreateTemplateModal"
        />
        <PoButton
          v-else
          label="Create Frame"
          :icon="PlusIcon"
          @button-click="openCreateFrameModal"
        />
      </div>
    </header>

    <!-- Tab Navigation with PoTabs -->
    <div class="mb-6">
      <PoTabs :tabs="tabs" :current-tab="currentTab" @button-click="handleTabClick" />
    </div>

    <!-- TAB 1: QR Code Templates Manager -->
    <div v-if="currentTab === 'QR Code Templates'" class="space-y-6">
      <!-- Templates Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          v-for="tmpl in store.templates"
          :key="tmpl.id"
          class="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between hover:shadow-md transition-shadow relative"
        >
          <!-- Preview & Badges -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <PoStatusPill
                :label="tmpl.isCustom ? 'Custom' : 'Built-in'"
                :color="tmpl.isCustom ? 'green' : undefined"
                :grayscale="!tmpl.isCustom"
              />
              <span class="text-[0.68rem] font-semibold text-slate-400 uppercase tracking-wider">
                {{ tmpl.style.replace('-', ' ') }}
              </span>
            </div>

            <!-- Mini Live Preview -->
            <div
              class="py-3 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100 mb-3 min-h-47.5"
            >
              <QRCodePreview
                value="https://pension.gov.mv"
                :title="tmpl.name"
                :fg-color="tmpl.fgColor"
                :bg-color="tmpl.bgColor"
                :qr-style="tmpl.style"
                :corner="tmpl.corner"
                :overlay-type="tmpl.overlayType"
                :overlay-text="tmpl.overlayText"
                :logo="tmpl.logo"
                size="sm"
              />
            </div>

            <div class="space-y-1">
              <h4 class="text-sm font-bold text-slate-800">{{ tmpl.name }}</h4>
              <p class="text-xs text-slate-500 line-clamp-2">{{ tmpl.desc }}</p>
            </div>

            <!-- Style Summary Tags -->
            <div class="flex items-center gap-1.5 flex-wrap mt-3 pt-3 border-t border-slate-100">
              <PoStatusPill
                :label="tmpl.corner.replace('-', ' ')"
                custom-bg-color="bg-slate-100"
                custom-text-color="text-slate-700"
              />
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100">
            <PoButton
              label="Use in QR"
              size="sm"
              color="slate"
              @button-click="router.push({ path: '/links/create', query: { templateId: tmpl.id } })"
            />
            <div class="flex items-center gap-1">
              <PoButton
                label="Edit"
                size="sm"
                color="slate"
                @button-click="openEditTemplateModal(tmpl)"
              />
              <PoTableAction
                v-if="tmpl.isCustom"
                btn-type="delete"
                @click="confirmDeleteTemplate(tmpl)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: QR Code Frames Manager -->
    <div v-if="currentTab === 'QR Code Frames'" class="space-y-6">
      <!-- Frames Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div
          v-for="frame in store.frames"
          :key="frame.id"
          class="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between hover:shadow-md transition-shadow relative"
        >
          <div>
            <div class="flex items-center justify-between mb-3">
              <PoStatusPill
                :label="frame.isCustom ? 'Custom' : 'Built-in'"
                :color="frame.isCustom ? 'green' : undefined"
                :grayscale="!frame.isCustom"
              />
              <span class="text-[0.68rem] font-semibold text-slate-400 tracking-wider capitalize">
                {{ frame.frameType.replace('-', ' ') }}
              </span>
            </div>

            <!-- Mini Live Frame Preview -->
            <div
              class="py-3 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100 mb-3 min-h-50"
            >
              <QRFramePreview
                :frame-type="frame.frameType"
                :frame-color="frame.frameColor"
                :text-color="frame.textColor"
                :border-color="frame.borderColor"
                :qr-position="frame.qrPosition"
                :qr-size-percent="frame.qrSizePercent"
                :cta-text="frame.ctaText"
                :custom-image-url="frame.customImageUrl"
                :width="160"
                :height="200"
              />
            </div>

            <div class="space-y-1">
              <h4 class="text-sm font-bold text-slate-800">{{ frame.name }}</h4>
              <p class="text-xs text-slate-500 line-clamp-2">{{ frame.desc }}</p>
            </div>

            <!-- Frame Specs -->
            <div class="flex items-center gap-1.5 flex-wrap mt-3 pt-3 border-t border-slate-100">
              <PoStatusPill
                :label="'Position: ' + frame.qrPosition"
                custom-bg-color="bg-slate-100"
                custom-text-color="text-slate-700"
              />
              <PoStatusPill
                :label="'Scale: ' + frame.qrSizePercent + '%'"
                custom-bg-color="bg-slate-100"
                custom-text-color="text-slate-700"
              />
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100">
            <PoButton
              label="Edit Frame"
              size="sm"
              color="slate"
              @button-click="openEditFrameModal(frame)"
            />
            <PoTableAction
              v-if="frame.isCustom"
              btn-type="delete"
              @click="confirmDeleteFrame(frame)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Create / Edit Template Modal -->
    <PoModal
      :show="showTemplateModal"
      :modal-title="editingTemplate ? 'Edit QR Code Template' : 'Create QR Code Template'"
      modal-width="sm:max-w-4xl"
      @modal-closed="closeTemplateModal"
    >
      <template #content>
        <div class="p-6">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <!-- Left: Live Preview (With chosen frame or standalone) -->
            <div
              class="lg:col-span-5 flex flex-col items-center justify-center p-5 bg-slate-50 rounded-2xl border border-slate-200 min-h-95"
            >
              <span class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4"
                >Live Template Preview</span
              >

              <QRCodePreview
                value="https://pension.gov.mv"
                :title="templateForm.name || 'Sample QR'"
                :fg-color="templateForm.fgColor"
                :bg-color="templateForm.bgColor"
                :qr-style="templateForm.style"
                :corner="templateForm.corner"
                :overlay-type="templateForm.overlayType"
                :overlay-text="templateForm.overlayText"
                :logo="templateForm.logo"
                size="lg"
                :show-caption="true"
              />

              <span class="text-[0.68rem] text-slate-400 mt-4 text-center"
                >Updates instantly as styling changes</span
              >
            </div>

            <!-- Right: Form Controls -->
            <div class="lg:col-span-7 space-y-4 max-h-130 overflow-y-auto pr-1">
              <PoInputField
                v-model="templateForm.name"
                label="Template Name"
                placeholder="e.g. Official Branded Navy"
                :error-message="templateErrors.name"
              />

              <PoInputField
                v-model="templateForm.desc"
                label="Description"
                placeholder="e.g. Clean high-contrast pattern for public flyers"
              />


              <!-- Pattern Style -->
              <div>
                <label class="text-xs font-semibold text-slate-700 block mb-1.5"
                  >Pattern Style</label
                >
                <div class="grid grid-cols-3 gap-2">
                  <PoButton
                    v-for="p in patternOptions"
                    :key="p.id"
                    :label="p.name"
                    size="sm"
                    :color="templateForm.style === p.id ? undefined : 'slate'"
                    :action-type="templateForm.style === p.id ? undefined : 'ghost'"
                    @button-click="templateForm.style = p.id"
                  />
                </div>
              </div>

              <!-- Corner Eye Style -->
              <div>
                <label class="text-xs font-semibold text-slate-700 block mb-1.5"
                  >Corner Eyes Style</label
                >
                <div class="grid grid-cols-3 gap-2">
                  <PoButton
                    v-for="c in cornerOptions"
                    :key="c.id"
                    :label="c.name"
                    size="sm"
                    :color="templateForm.corner === c.id ? undefined : 'slate'"
                    :action-type="templateForm.corner === c.id ? undefined : 'ghost'"
                    @button-click="templateForm.corner = c.id"
                  />
                </div>
              </div>

              <!-- Color Pickers -->
              <div class="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <label class="text-xs font-semibold text-slate-700 block mb-1.5"
                    >Foreground Color</label
                  >
                  <div class="flex items-center gap-2">
                    <input
                      v-model="templateForm.fgColor"
                      type="color"
                      class="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                    >
                    <PoInputField
                      v-model="templateForm.fgColor"
                      placeholder="#000000"
                      class="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label class="text-xs font-semibold text-slate-700 block mb-1.5"
                    >Background Color</label
                  >
                  <div class="flex items-center gap-2">
                    <input
                      v-model="templateForm.bgColor"
                      type="color"
                      class="w-9 h-9 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white"
                    >
                    <PoInputField
                      v-model="templateForm.bgColor"
                      placeholder="#ffffff"
                      class="flex-1"
                    />
                  </div>
                </div>
              </div>

              <!-- Center Overlay -->
              <div>
                <label class="text-xs font-semibold text-slate-700 block mb-1.5"
                  >Center Overlay</label
                >
                <div class="grid grid-cols-3 gap-2 mb-2">
                  <PoButton
                    v-for="ov in overlayOptions"
                    :key="ov.id"
                    :label="ov.name"
                    size="sm"
                    :color="templateForm.overlayType === ov.id ? undefined : 'slate'"
                    :action-type="templateForm.overlayType === ov.id ? undefined : 'ghost'"
                    @button-click="templateForm.overlayType = ov.id as 'text' | 'none' | 'logo'"
                  />
                </div>
                <PoInputField
                  v-if="templateForm.overlayType === 'text'"
                  v-model="templateForm.overlayText"
                  label="Overlay Text (Max 4 chars)"
                  placeholder="GO"
                  maxlength="4"
                />
                <div v-if="templateForm.overlayType === 'logo'" class="grid grid-cols-2 gap-2">
                  <div
                    v-for="opt in logoOptions"
                    :key="opt.id"
                    role="button"
                    tabindex="0"
                    :aria-label="'Select ' + opt.name + ' logo'"
                    class="p-2 border rounded-xl flex flex-col items-center justify-center space-y-1.5 transition-all text-center cursor-pointer"
                    :class="[
                      templateForm.logo === opt.id ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-200',
                    ]"
                    @click="templateForm.logo = opt.id"
                    @keydown.enter="templateForm.logo = opt.id"
                  >
                    <div
                      class="w-12 h-12 rounded border bg-white shrink-0 [&>svg]:w-full [&>svg]:h-full"
                      v-html="templateLogoPreviewSvg(opt.id)"
                    />
                    <span class="text-[0.68rem] font-semibold text-slate-700">{{ opt.name }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="px-5 py-4 bg-slate-50 flex justify-end gap-3 rounded-b-xl">
          <PoButton label="Cancel" color="slate" @click="closeTemplateModal" />
          <PoButton
            :label="editingTemplate ? 'Save Changes' : 'Create Template'"
            @click="handleSaveTemplate"
          />
        </div>
      </template>
    </PoModal>

    <!-- Create / Edit Frame Modal -->
    <PoModal
      :show="showFrameModal"
      :modal-title="editingFrame ? 'Edit QR Code Frame' : 'Create Custom QR Frame'"
      modal-width="sm:max-w-4xl"
      @modal-closed="closeFrameModal"
    >
      <template #content>
        <div class="p-6">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <!-- Left: Live Frame Preview -->
            <div
              class="lg:col-span-5 flex flex-col items-center justify-center p-5 bg-slate-50 rounded-2xl border border-slate-200 min-h-95"
            >
              <span class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4"
                >Live Frame Preview</span
              >
              <QRFramePreview
                :frame-type="frameForm.frameType"
                :frame-color="frameForm.frameColor"
                :text-color="frameForm.textColor"
                :border-color="frameForm.borderColor"
                :qr-position="frameForm.qrPosition"
                :qr-size-percent="frameForm.qrSizePercent"
                :cta-text="frameForm.ctaText"
                :custom-image-url="frameForm.customImageUrl"
                :width="210"
                :height="260"
              />
              <span class="text-[0.68rem] text-slate-400 mt-4 text-center"
                >Live frame positioning & scaling preview</span
              >
            </div>

            <!-- Right: Frame Form Controls -->
            <div class="lg:col-span-7 space-y-4 max-h-130 overflow-y-auto pr-1">
              <PoInputField
                v-model="frameForm.name"
                label="Frame Name"
                placeholder="e.g. Official Header Banner"
                :error-message="frameErrors.name"
              />

              <PoInputField
                v-model="frameForm.desc"
                label="Description"
                placeholder="e.g. Navy top banner with custom CTA"
              />

              <!-- Frame Layout Type -->
              <div>
                <label class="text-xs font-semibold text-slate-700 block mb-1.5"
                  >Frame Style / Type</label
                >
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <PoButton
                    v-for="ft in frameTypeOptions"
                    :key="ft.id"
                    :label="ft.name"
                    size="sm"
                    :color="frameForm.frameType === ft.id ? undefined : 'slate'"
                    :action-type="frameForm.frameType === ft.id ? undefined : 'ghost'"
                    @button-click="
                      frameForm.frameType = ft.id as
                        | 'bottom-label'
                        | 'border'
                        | 'top-header'
                        | 'card-box'
                        | 'custom-upload'
                    "
                  />
                </div>
              </div>

              <!-- Upload SVG/PNG option when custom-upload is chosen -->
              <div v-if="frameForm.frameType === 'custom-upload'" class="py-1">
                <PoInputFile
                  v-model="uploadedFrameFile"
                  label="Upload Frame Background (PNG / SVG)"
                  accept="image/png, image/svg+xml, image/jpeg"
                  message="Recommended: 500x600px PNG or SVG with transparent QR placement area."
                  drag-area-display="vertical"
                />
              </div>

              <!-- QR Code Position within Frame -->
              <div>
                <label class="text-xs font-semibold text-slate-700 block mb-1.5"
                  >QR Code Position in Frame</label
                >
                <div class="grid grid-cols-3 gap-2">
                  <PoButton
                    v-for="pos in positionOptions"
                    :key="pos.id"
                    :label="pos.name"
                    size="sm"
                    :color="frameForm.qrPosition === pos.id ? undefined : 'slate'"
                    :action-type="frameForm.qrPosition === pos.id ? undefined : 'ghost'"
                    @button-click="frameForm.qrPosition = pos.id as 'top' | 'center' | 'bottom'"
                  />
                </div>
              </div>

              <!-- QR Size / Scaling Slider -->
              <div>
                <div class="flex justify-between items-center mb-1">
                  <label class="text-xs font-semibold text-slate-700">QR Code Scale / Size</label>
                  <span class="text-xs font-bold text-indigo-600"
                    >{{ frameForm.qrSizePercent }}%</span
                  >
                </div>
                <input
                  v-model.number="frameForm.qrSizePercent"
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  class="w-full accent-slate-800 cursor-pointer"
                >
              </div>

              <!-- CTA / Frame Text -->
              <PoInputField
                v-model="frameForm.ctaText"
                label="Call to Action (CTA) Text"
                placeholder="e.g. SCAN WITH CAMERA"
                info="Text rendered on the frame header or footer banner."
              />

              <!-- Colors -->
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label class="text-xs font-semibold text-slate-700 block mb-1">Frame Color</label>
                  <div class="flex items-center gap-1.5">
                    <input
                      v-model="frameForm.frameColor"
                      type="color"
                      class="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0.5 bg-white"
                    >
                    <PoInputField
                      v-model="frameForm.frameColor"
                      placeholder="#0f172a"
                      class="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label class="text-xs font-semibold text-slate-700 block mb-1">Text Color</label>
                  <div class="flex items-center gap-1.5">
                    <input
                      v-model="frameForm.textColor"
                      type="color"
                      class="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0.5 bg-white"
                    >
                    <PoInputField
                      v-model="frameForm.textColor"
                      placeholder="#ffffff"
                      class="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label class="text-xs font-semibold text-slate-700 block mb-1"
                    >Border Color</label
                  >
                  <div class="flex items-center gap-1.5">
                    <input
                      v-model="frameForm.borderColor"
                      type="color"
                      class="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0.5 bg-white"
                    >
                    <PoInputField
                      v-model="frameForm.borderColor"
                      placeholder="#e2e8f0"
                      class="flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="px-5 py-4 bg-slate-50 flex justify-end gap-3 rounded-b-xl">
          <PoButton label="Cancel" color="slate" @click="closeFrameModal" />
          <PoButton
            :label="editingFrame ? 'Save Changes' : 'Create Frame'"
            @click="handleSaveFrame"
          />
        </div>
      </template>
    </PoModal>
  </PoContentArea>
</template>

<script setup lang="ts">
import { useRouter } from '#imports';
import { buildQrSvg, type QrLogoId } from '@petty-cash/qr-render';
import { PhotoIcon, PlusIcon, Squares2X2Icon } from '@heroicons/vue/24/outline';
import {
  PoButton,
  PoContentArea,
  PoInputField,
  PoInputFile,
  PoModal,
  PoPageTitle,
  PoStatusPill,
  PoTableAction,
  PoTabs,
  useToastify,
} from '@pension/ui-kit';
import { onMounted, ref, watch } from 'vue';
import { useShortUrlStore, type QRFrameItem, type QRTemplateItem } from '~/stores/shorturl';

definePageMeta({
  layout: 'main',
});

useHead({
  title: 'QR Code Templates & Frames - Settings',
});

const store = useShortUrlStore();
const router = useRouter();
const { showToast } = useToastify();

onMounted(() => {
  store.fetchTemplates();
  store.fetchFrames();
});

// Tabs Config
interface Tab {
  name: string;
  icon: typeof Squares2X2Icon;
  href: string;
  current: boolean;
}

const currentTab = ref('QR Code Templates');
const tabs: Tab[] = [
  {
    name: 'QR Code Templates',
    icon: Squares2X2Icon,
    href: '#',
    current: true,
  },
  {
    name: 'QR Code Frames',
    icon: PhotoIcon,
    href: '#',
    current: false,
  },
];

const handleTabClick = (tabObj: Tab) => {
  currentTab.value = tabObj.name;
};

// Option Selectors
const patternOptions = [
  { id: 'soft-pixel', name: 'Soft Pixel' },
  { id: 'rounded-pixel', name: 'Rounded' },
  { id: 'dot', name: 'Dot' },
  { id: 'rounded-dash', name: 'Dash' },
  { id: 'micro-square', name: 'Micro Square' },
  { id: 'vertical-pill', name: 'Pill' },
  { id: 'diamond', name: 'Diamond' },
  { id: 'star', name: 'Star' },
  { id: 'organic-blob', name: 'Organic' },
];

const cornerOptions = [
  { id: 'classic-square', name: 'Classic Square' },
  { id: 'bold-square', name: 'Bold Square' },
  { id: 'rounded-square', name: 'Rounded Square' },
  { id: 'rounded-corner', name: 'Rounded Corner' },
  { id: 'circle', name: 'Circle' },
  { id: 'soft-square', name: 'Soft Square' },
  { id: 'warped-square', name: 'Warped Square' },
];

const overlayOptions = [
  { id: 'none', name: 'None' },
  { id: 'logo', name: 'Center Logo' },
  { id: 'text', name: 'Custom Text' },
];

const logoOptions: { id: QrLogoId; name: string }[] = [
  { id: 'pension', name: 'Pension' },
  { id: 'forward', name: 'Forward' },
];

function templateLogoPreviewSvg(id: QrLogoId) {
  return buildQrSvg({
    value: 'https://preview',
    fgColor: templateForm.value.fgColor,
    bgColor: templateForm.value.bgColor,
    style: templateForm.value.style,
    corner: templateForm.value.corner,
    overlayType: 'logo',
    logo: id,
  });
}

const frameTypeOptions = [
  { id: 'bottom-label', name: 'Bottom Banner' },
  { id: 'top-header', name: 'Top Header' },
  { id: 'border', name: 'Border Card' },
  { id: 'card-box', name: 'Elevated Box' },
  { id: 'custom-upload', name: 'Custom Image' },
];

const positionOptions = [
  { id: 'center', name: 'Center' },
  { id: 'top', name: 'Top' },
  { id: 'bottom', name: 'Bottom' },
];

// Template State & Modal
const showTemplateModal = ref(false);
const editingTemplate = ref<QRTemplateItem | null>(null);
const templateForm = ref({
  name: '',
  desc: '',
  style: 'soft-pixel',
  corner: 'classic-square',
  fgColor: '#000000',
  bgColor: '#ffffff',
  overlayType: 'none' as string,
  overlayText: 'GO',
  logo: 'pension' as QrLogoId,
});

const templateErrors = ref({ name: '' });

const openCreateTemplateModal = () => {
  editingTemplate.value = null;
  templateForm.value = {
    name: '',
    desc: '',
    style: 'soft-pixel',
    corner: 'classic-square',
    fgColor: '#1e3a8a',
    bgColor: '#ffffff',
    overlayType: 'none',
    overlayText: 'GO',
    logo: 'pension',
  };
  templateErrors.value.name = '';
  showTemplateModal.value = true;
};

const openEditTemplateModal = (tmpl: QRTemplateItem) => {
  editingTemplate.value = tmpl;
  templateForm.value = {
    name: tmpl.name,
    desc: tmpl.desc,
    style: tmpl.style,
    corner: tmpl.corner,
    fgColor: tmpl.fgColor,
    bgColor: tmpl.bgColor,
    overlayType: tmpl.overlayType,
    overlayText: tmpl.overlayText || 'GO',
    logo: (tmpl.logo as QrLogoId) || 'pension',
  };
  templateErrors.value.name = '';
  showTemplateModal.value = true;
};

const closeTemplateModal = () => {
  showTemplateModal.value = false;
  editingTemplate.value = null;
};

const handleSaveTemplate = async () => {
  if (!templateForm.value.name) {
    templateErrors.value.name = 'Template name is required';
    return;
  }

  if (editingTemplate.value) {
    await store.updateTemplate(editingTemplate.value.id, {
      name: templateForm.value.name,
      desc: templateForm.value.desc,
      style: templateForm.value.style,
      corner: templateForm.value.corner,
      fgColor: templateForm.value.fgColor,
      bgColor: templateForm.value.bgColor,
      overlayType: templateForm.value.overlayType,
      overlayText: templateForm.value.overlayText,
      logo: templateForm.value.logo,
    });
    showToast('Template updated successfully!', 'success');
  } else {
    await store.addTemplate({
      name: templateForm.value.name,
      desc: templateForm.value.desc,
      style: templateForm.value.style,
      corner: templateForm.value.corner,
      fgColor: templateForm.value.fgColor,
      bgColor: templateForm.value.bgColor,
      overlayType: templateForm.value.overlayType,
      overlayText: templateForm.value.overlayText,
      logo: templateForm.value.logo,
    });
    showToast('New template created successfully!', 'success');
  }

  closeTemplateModal();
};

const confirmDeleteTemplate = async (tmpl: QRTemplateItem) => {
  await store.deleteTemplate(tmpl.id);
  showToast('Template deleted successfully!', 'success');
};

// Frame State & Modal
const showFrameModal = ref(false);
const editingFrame = ref<QRFrameItem | null>(null);
const frameForm = ref({
  name: '',
  desc: '',
  frameType: 'bottom-label' as
    | 'bottom-label'
    | 'border'
    | 'top-header'
    | 'card-box'
    | 'custom-upload',
  frameColor: '#0f172a',
  textColor: '#ffffff',
  borderColor: '#e2e8f0',
  qrPosition: 'center' as 'center' | 'top' | 'bottom',
  qrSizePercent: 85,
  ctaText: 'SCAN ME',
  customImageUrl: null as string | null,
});

const frameErrors = ref({ name: '' });
const uploadedFrameFile = ref<File | null>(null);

const handleFileUpload = (file: File | FileList | null | undefined) => {
  if (!file) {
    frameForm.value.customImageUrl = null;
    return;
  }
  const selectedFile = file instanceof FileList ? file[0] : file;
  if (selectedFile instanceof File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      frameForm.value.customImageUrl = e.target?.result as string;
      showToast('Frame background loaded successfully!', 'success');
    };
    reader.readAsDataURL(selectedFile);
  }
};

watch(uploadedFrameFile, (newFile) => {
  if (newFile) {
    handleFileUpload(newFile);
  }
});

const openCreateFrameModal = () => {
  editingFrame.value = null;
  uploadedFrameFile.value = null;
  frameForm.value = {
    name: '',
    desc: '',
    frameType: 'bottom-label',
    frameColor: '#0f172a',
    textColor: '#ffffff',
    borderColor: '#e2e8f0',
    qrPosition: 'center',
    qrSizePercent: 85,
    ctaText: 'SCAN TO VISIT',
    customImageUrl: null,
  };
  frameErrors.value.name = '';
  showFrameModal.value = true;
};

const openEditFrameModal = (frame: QRFrameItem) => {
  editingFrame.value = frame;
  uploadedFrameFile.value = null;
  frameForm.value = {
    name: frame.name,
    desc: frame.desc,
    frameType: frame.frameType,
    frameColor: frame.frameColor,
    textColor: frame.textColor,
    borderColor: frame.borderColor,
    qrPosition: frame.qrPosition,
    qrSizePercent: frame.qrSizePercent,
    ctaText: frame.ctaText,
    customImageUrl: frame.customImageUrl || null,
  };
  frameErrors.value.name = '';
  showFrameModal.value = true;
};

const closeFrameModal = () => {
  showFrameModal.value = false;
  editingFrame.value = null;
  uploadedFrameFile.value = null;
};

const handleSaveFrame = async () => {
  if (!frameForm.value.name) {
    frameErrors.value.name = 'Frame name is required';
    return;
  }

  if (editingFrame.value) {
    await store.updateFrame(editingFrame.value.id, {
      name: frameForm.value.name,
      desc: frameForm.value.desc,
      frameType: frameForm.value.frameType,
      frameColor: frameForm.value.frameColor,
      textColor: frameForm.value.textColor,
      borderColor: frameForm.value.borderColor,
      qrPosition: frameForm.value.qrPosition,
      qrSizePercent: frameForm.value.qrSizePercent,
      ctaText: frameForm.value.ctaText,
      customImageUrl: frameForm.value.customImageUrl,
    });
    showToast('Frame updated successfully!', 'success');
  } else {
    await store.addFrame({
      name: frameForm.value.name,
      desc: frameForm.value.desc,
      frameType: frameForm.value.frameType,
      frameColor: frameForm.value.frameColor,
      textColor: frameForm.value.textColor,
      borderColor: frameForm.value.borderColor,
      qrPosition: frameForm.value.qrPosition,
      qrSizePercent: frameForm.value.qrSizePercent,
      ctaText: frameForm.value.ctaText,
      customImageUrl: frameForm.value.customImageUrl,
    });
    showToast('New frame created successfully!', 'success');
  }

  closeFrameModal();
};

const confirmDeleteFrame = async (frame: QRFrameItem) => {
  await store.deleteFrame(frame.id);
  showToast('Frame deleted successfully!', 'success');
};
</script>
