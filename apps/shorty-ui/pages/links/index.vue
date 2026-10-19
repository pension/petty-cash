<template>
  <PoContentArea>
    <!-- Page Header -->
    <header class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
      <PoPageTitle
        class="grow"
        :stand-alone="true"
        label="Links"
        description="View and manage your shortened links. Search, filter, edit, set expiration, or redirect."
      />
      <div class="shrink-0 w-full sm:w-auto">
        <PoButton
          label="Create Link"
          :icon="PlusIcon"
          class="w-full sm:w-auto"
          @button-click="router.push('/links/create')"
        />
      </div>
    </header>

    <!-- Filters Panel -->
    <PoCard class="p-4 mb-4">
      <div class="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        <!-- Search bar -->
        <div class="grow w-full">
          <PoSearch
            v-model="searchQuery"
            placeholder="Search by title, short URL, or destination URL..."
          />
        </div>

        <!-- Filter Options -->
        <div
          class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full lg:w-auto"
        >
          <div class="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span class="text-xs font-semibold text-slate-500 shrink-0">Status:</span>
            <div class="flex gap-1 shrink-0">
              <PoButton
                v-for="status in ['all', 'active', 'expired', 'archived']"
                :key="status"
                :label="status.charAt(0).toUpperCase() + status.slice(1)"
                size="sm"
                :color="statusFilter === status ? undefined : 'slate'"
                :action-type="statusFilter === status ? undefined : 'ghost'"
                @button-click="statusFilter = status"
              />
            </div>
          </div>

          <div class="flex items-center justify-end sm:border-l sm:border-slate-200 sm:pl-4">
            <PoPagination
              :total-pages="totalPages"
              :current-page="currentPage"
              @page-change="handlePageChange"
            />
          </div>
        </div>
      </div>
    </PoCard>

    <!-- Links Table -->
    <PoCard class="overflow-hidden">
      <template #content>
        <div v-if="filteredLinks.length === 0" class="text-center py-12">
          <LinkIcon class="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 class="text-sm font-semibold text-slate-700">No links found</h3>
          <p class="text-xs text-slate-400 mt-1">
            Try modifying your search or filters, or create a new link.
          </p>
        </div>

        <PoTable v-else :thead="tableHead" :tbody="paginatedLinks" :break-at-lg="true">
          <template #th="{ label }">
            <span v-if="'Action' !== label">{{ label }}</span>
            <span v-else class="sr-only">{{ label }}</span>
          </template>

          <template #td="{ item }">
            <!-- Link Detail Details -->
            <td data-title="Link Detail" class="min-w-0 max-w-full lg:max-w-md">
              <div class="flex flex-col space-y-1">
                <div class="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span class="font-semibold text-slate-800 text-sm truncate block max-w-full">
                    {{ item.title }}
                  </span>
                  <PoStatusPill v-if="store.isLinkExpired(item)" label="Expired" color="red" />
                  <PoStatusPill v-else-if="item.status === 'archived'" label="Archived" grayscale />
                  <PoStatusPill v-else label="Active" color="green" />
                </div>
                <a
                  :href="'https://' + item.shortUrl"
                  target="_blank"
                  class="text-xs font-semibold text-indigo-600 hover:underline block truncate"
                >
                  {{ item.shortUrl }}
                </a>
                <span class="text-xs text-slate-400 block truncate max-w-full" :title="item.longUrl">
                  {{ item.longUrl }}
                </span>
                <!-- Tags List -->
                <div
                  v-if="item.tags && item.tags.length > 0"
                  class="flex items-center space-x-1.5 flex-wrap gap-y-1 mt-1"
                >
                  <PoStatusPill
                    v-for="tag in item.tags"
                    :key="tag"
                    :label="tag"
                    custom-bg-color="bg-slate-100"
                    custom-text-color="text-slate-700"
                  />
                </div>
              </div>
            </td>

            <!-- Clicks Count -->
            <td data-title="Clicks" class="text-slate-600 font-semibold text-sm text-left lg:text-center">
              {{ item.clicks }}
            </td>

            <!-- Expiration Column -->
            <td data-title="Expires" class="text-xs text-left lg:text-center">
              <div v-if="item.expiresAt" class="space-y-0.5">
                <span
                  class="font-medium block"
                  :class="
                    store.isLinkExpired(item) ? 'text-red-600 font-semibold' : 'text-slate-600'
                  "
                >
                  {{ item.expiresAt }}
                </span>
                <span
                  v-if="store.isLinkExpired(item)"
                  class="text-[0.62rem] text-red-500 uppercase tracking-wider block font-bold"
                >
                  Expired
                </span>
              </div>
              <span v-else class="text-slate-400 italic"> Never </span>
            </td>

            <!-- Created Date -->
            <td data-title="Created" class="text-slate-500 text-xs text-left lg:text-center">
              {{ item.created }}
            </td>

            <!-- Action Buttons -->
            <td data-title="Action" class="w-full lg:w-36 text-left lg:text-right">
              <div class="flex items-center space-x-1.5 justify-start lg:justify-end flex-wrap">
                <PoTableAction
                  btn-type="icon"
                  :btn-icon="DocumentDuplicateIcon"
                  label="Copy"
                  icon-color="stroke-slate-500"
                  @click="copyShortUrl(item.shortUrl)"
                />
                <PoTableAction btn-type="view" @click="router.push(`/links/${item.id}`)" />
                <PoTableAction btn-type="edit" @click="openEditModal(item)" />
                <PoTableAction btn-type="delete" @click="confirmDelete(item)" />
              </div>
            </td>
          </template>
        </PoTable>
      </template>
    </PoCard>

    <!-- Edit Link Modal -->
    <PoModal
      :show="showEditModal"
      modal-title="Edit short link"
      modal-width="sm:max-w-xl"
      @modal-closed="closeEditModal"
    >
      <template #content>
        <div v-if="editingLink" class="p-4 sm:p-6 space-y-4">
          <PoInputField
            v-model="editForm.longUrl"
            label="Destination URL"
            placeholder="https://example.com/my-long-url"
            :error-message="editFormErrors.longUrl"
          />
          <PoInputField v-model="editForm.title" label="Title" placeholder="Link Title" />
          <PoInputField
            v-model="editForm.customBackHalf"
            label="Short URL back-half"
            placeholder="back-half"
            :disabled="true"
            info="Modifying the backhalf is not allowed after creation."
          />

          <!-- Expiration Setting in Edit Modal -->
          <div>
            <label class="text-xs font-semibold text-slate-700 block mb-1"
              >Link Expiration Date (Optional)</label
            >
            <div class="flex items-center gap-2">
              <input
                v-model="editForm.expiresAt"
                type="date"
                class="w-full text-xs font-medium px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-800"
              >
              <PoButton
                v-if="editForm.expiresAt"
                label="Clear"
                size="sm"
                color="slate"
                @button-click="editForm.expiresAt = ''"
              />
            </div>
            <span class="text-[0.68rem] text-slate-400 mt-1 block"
              >Leave blank for no expiration.</span
            >
          </div>

          <PoMultiSelect
            v-model="editForm.tagsSelected"
            label="Tags"
            :items="availableTags"
            :allow-custom-values="true"
          />

          <PoSelectField
            v-model="editForm.statusSelected"
            label="Status"
            object
            :list="[
              { id: 'active', name: 'Active' },
              { id: 'archived', name: 'Archived' },
            ]"
          />
        </div>
      </template>
      <template #footer>
        <div class="px-4 py-3 sm:px-5 sm:py-4 bg-slate-50 flex justify-end gap-3 rounded-b-xl">
          <PoButton label="Cancel" color="slate" @click="closeEditModal" />
          <PoButton label="Save Changes" @click="handleEditLink" />
        </div>
      </template>
    </PoModal>

    <!-- Delete Confirmation Modal -->
    <PoModal
      :show="showDeleteModal"
      modal-title="Delete short link"
      modal-width="sm:max-w-md"
      @modal-closed="() => (showDeleteModal = false)"
    >
      <template #content>
        <div v-if="linkToDelete" class="p-4 sm:p-6 text-center space-y-3">
          <div
            class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600"
          >
            <XMarkIcon class="w-6 h-6" />
          </div>
          <h3 class="text-sm font-semibold text-slate-800">
            Are you sure you want to delete this link?
          </h3>
          <p class="text-xs text-slate-500">
            This will permanently delete
            <span class="font-bold text-slate-700">{{ linkToDelete.shortUrl }}</span> and all
            historical metrics.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="px-4 py-3 sm:px-5 sm:py-4 bg-slate-50 flex justify-end gap-3 rounded-b-xl">
          <PoButton label="Cancel" color="slate" @click="() => (showDeleteModal = false)" />
          <PoButton label="Delete" action-type="danger" @click="handleDeleteLink" />
        </div>
      </template>
    </PoModal>
  </PoContentArea>
</template>

<script setup lang="ts">
import { useRouter } from '#imports';
import {
  DocumentDuplicateIcon,
  LinkIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import {
  PoButton,
  PoCard,
  PoContentArea,
  PoInputField,
  PoModal,
  PoMultiSelect,
  PoPageTitle,
  PoPagination,
  PoSearch,
  PoSelectField,
  PoStatusPill,
  PoTable,
  PoTableAction,
  useToastify,
} from '@pension/ui-kit';
import { computed, onMounted, ref } from 'vue';
import { useShortUrlStore, type LinkItem } from '~/stores/shorturl';

definePageMeta({
  layout: 'main',
});

useHead({
  title: 'Short URLs - petty-cash',
});

const store = useShortUrlStore();
const router = useRouter();
const { showToast } = useToastify();

onMounted(() => {
  store.fetchLinks();
});

// Search & Filter state
const searchQuery = ref('');
const statusFilter = ref('all');
const currentPage = ref(1);
const itemsPerPage = 4;

// Modals Trigger
const showDeleteModal = ref(false);
const linkToDelete = ref<LinkItem | null>(null);

const tableHead = [
  { label: 'Link Detail' },
  { label: 'Clicks' },
  { label: 'Expires' },
  { label: 'Created' },
  { label: 'Action' },
];

// Edit Modal State
const showEditModal = ref(false);
const editingLink = ref<LinkItem | null>(null);
interface TagOption {
  id: string | number;
  name: string;
}

interface StatusOption {
  id: 'active' | 'archived';
  name: string;
}

const editForm = ref({
  title: '',
  longUrl: '',
  customBackHalf: '',
  expiresAt: '',
  tagsSelected: [] as (TagOption | string)[],
  statusSelected: null as StatusOption | null,
});
const editFormErrors = ref({
  longUrl: '',
});

const availableTags = computed(() => {
  const tagsSet = new Set<string>();
  store.links.forEach((l) => l.tags.forEach((t) => tagsSet.add(t)));
  return Array.from(tagsSet).map((tag, idx) => ({ id: idx + 1, name: tag }));
});

// Computed list
const filteredLinks = computed(() => {
  return store.links.filter((link) => {
    // Status filter
    if (statusFilter.value === 'active') {
      if (link.status !== 'active' || store.isLinkExpired(link)) return false;
    } else if (statusFilter.value === 'expired') {
      if (!store.isLinkExpired(link)) return false;
    } else if (statusFilter.value === 'archived') {
      if (link.status !== 'archived') return false;
    }

    // Search query
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
      const matchTitle = link.title.toLowerCase().includes(q);
      const matchShort = link.shortUrl.toLowerCase().includes(q);
      const matchLong = link.longUrl.toLowerCase().includes(q);
      const matchTags = link.tags.some((t) => t.toLowerCase().includes(q));
      return matchTitle || matchShort || matchLong || matchTags;
    }

    return true;
  });
});

// Pagination
const totalPages = computed(() => Math.ceil(filteredLinks.value.length / itemsPerPage) || 1);

const paginatedLinks = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return filteredLinks.value.slice(start, start + itemsPerPage);
});

// Handlers
const handlePageChange = (page: number) => {
  currentPage.value = page;
};

const copyShortUrl = (shortUrl: string) => {
  navigator.clipboard
    .writeText(shortUrl)
    .then(() => {
      showToast('Short URL copied to clipboard!', 'success');
    })
    .catch(() => {
      showToast('Failed to copy to clipboard', 'error');
    });
};

// Edit handlers
const openEditModal = (link: LinkItem) => {
  editingLink.value = link;

  const linkTags = link.tags.map((t, index) => ({ id: `edit-tag-${index}`, name: t }));

  editForm.value = {
    title: link.title,
    longUrl: link.longUrl,
    customBackHalf: link.shortUrl.split('/')[1],
    expiresAt: link.expiresAt || '',
    tagsSelected: linkTags,
    statusSelected: { id: link.status, name: link.status === 'active' ? 'Active' : 'Archived' },
  };
  editFormErrors.value.longUrl = '';

  showEditModal.value = true;
};

const handleEditLink = async () => {
  if (!editingLink.value) return;

  if (!editForm.value.longUrl) {
    editFormErrors.value.longUrl = 'Destination URL is required';
    return;
  }
  if (
    !editForm.value.longUrl.startsWith('http://') &&
    !editForm.value.longUrl.startsWith('https://')
  ) {
    editFormErrors.value.longUrl = 'URL must start with http:// or https://';
    return;
  }
  editFormErrors.value.longUrl = '';

  const tags = editForm.value.tagsSelected.map((t) => {
    if (typeof t === 'string') return t;
    return t.name;
  });

  const status = editForm.value.statusSelected?.id || 'active';

  await store.updateLink(editingLink.value.id, {
    title: editForm.value.title,
    longUrl: editForm.value.longUrl,
    tags,
    expiresAt: editForm.value.expiresAt || null,
    status,
  });

  showToast('Short link updated successfully!', 'success');
  closeEditModal();
};

const closeEditModal = () => {
  showEditModal.value = false;
  editingLink.value = null;
};

// Delete handlers
const confirmDelete = (link: LinkItem) => {
  linkToDelete.value = link;
  showDeleteModal.value = true;
};

const handleDeleteLink = async () => {
  if (!linkToDelete.value) return;

  await store.deleteLink(linkToDelete.value.id);
  showToast('Short link deleted successfully!', 'success');
  showDeleteModal.value = false;
  linkToDelete.value = null;

  if (paginatedLinks.value.length === 0 && currentPage.value > 1) {
    currentPage.value--;
  }
};
</script>
