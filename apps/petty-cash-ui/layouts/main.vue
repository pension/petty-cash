<template>
  <PoWrap>
    <PoSidebarDrawer
      :content="navigation"
      :curr-route="route.path"
      @button-click="router.push($event)"
    />
    <PoMain>
      <PoTopBar
        app-name="Petty Cash"
        :has-search="false"
        :user-object="identity.user?.value"
        :avatar="identity.user?.value?.avatar"
        :notifications="notificationItems"
        @logout="logout"
        @profile-switcher-click="switchProfile"
        @on-notification-click="openNotification"
        @on-show-notifications-click="router.push('/notifications')"
        @on-mark-as-read-click="markVisibleRead"
      >
        <template #appIcon
          ><img src="/images/appicons/float.svg" alt="Petty Cash" class="w-8 h-8"
        /></template>
      </PoTopBar>
      <PoOrgSelector
        v-if="identity.user?.value?.transacting_as == 0"
        :user-object="identity.user?.value"
        @on-profile-click="switchProfile"
      />
      <PoContentArea v-else-if="store.accessError"
        ><PoMessage :message="store.accessError" /><PoButton
          label="Sign out"
          @button-click="logout"
      /></PoContentArea>
      <PoContentArea v-else-if="store.loading && !store.currentUser.id">
        <PageSkeleton :stats="4" />
      </PoContentArea>
      <PoContentArea v-else-if="store.error"
        ><PoMessage :message="store.error" /><PoButton
          label="Retry"
          @button-click="store.initialize(route.path)"
      /></PoContentArea>
      <PoContentArea v-else-if="store.pageDenied">
        <PoMessage message="You do not have permission to view this page." />
        <PoButton
          v-if="store.firstAllowedPage"
          label="Go to an available page"
          @button-click="router.push(store.firstAllowedPage)"
        />
      </PoContentArea>
      <!-- Keep NuxtPage mounted while gating the actual page component. -->
      <slot :render-page="renderPage" :page-loading="store.loading" />
      <PoFooter />
    </PoMain>
  </PoWrap>
</template>
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, watch } from 'vue';
import {
  PoWrap,
  PoMain,
  PoTopBar,
  PoSidebarDrawer,
  PoFooter,
  PoOrgSelector,
  PoContentArea,
  PoMessage,
  PoButton,
} from '@pension/ui-kit';
import PageSkeleton from '~/components/float/PageSkeleton.vue';
import allNavigation from '~/config/navigation';
import { useFloatStore } from '~/stores/useFloatStore';
const route = useRoute(),
  router = useRouter(),
  identity = useIdentity(),
  store = useFloatStore();
const renderPage = computed(
  () =>
    !!identity.user?.value?.transacting_as &&
    !!store.currentUser.id &&
    !store.accessError &&
    store.canViewPage(route.path) &&
    !store.error &&
    !store.pageDenied,
);
const navigation = computed(() =>
  allNavigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => store.canViewPage(item.url)),
    }))
    .filter((group) => group.items.length),
);
const notificationItems = computed(() =>
  store.notifications.map((n) => ({
    ...n,
    name: n.title,
    time: new Date(n.createdAt).toLocaleString('en-GB', { timeZone: 'Indian/Maldives' }),
  })),
);
function logout() {
  store.reset();
  identity.logOut();
}
async function switchProfile(value: unknown) {
  if (value === 'logout') {
    logout();
    return;
  }
  if (typeof value === 'object' && value) {
    store.reset();
    if ('claimed' in value && value.claimed && 'id' in value && typeof value.id === 'string')
      identity.switchToDelegation(value.id);
    else if ('organisation_uuid' in value && typeof value.organisation_uuid === 'string')
      await (identity.changeTransactingAs as unknown as (organisation: string) => Promise<void>)(
        value.organisation_uuid,
      ); // Midgard's declaration incorrectly infers null from its JS default.
  }
}
async function openNotification(n: { id: string; url: string }) {
  try {
    await store.markRead(n.id);
    await router.push(n.url);
  } catch (e) {
    store.error = e instanceof Error ? e.message : 'Could not open notification.';
  }
}
async function markVisibleRead() {
  try {
    for (const n of store.notifications.filter((n) => !n.seen)) await store.markRead(n.id);
  } catch (e) {
    store.error = e instanceof Error ? e.message : 'Could not update notifications.';
  }
}
let previousIdentity = '';
async function load() {
  const user = identity.user?.value;
  const key = `${user?.uuid}:${user?.transacting_as}:${JSON.stringify(user?.permissions)}`;
  if (key !== previousIdentity) {
    store.reset();
    previousIdentity = key;
  }
  if (user?.transacting_as) {
    await store.initialize(route.path);
    if (route.path === '/' && store.pageDenied && store.firstAllowedPage)
      await router.replace(store.firstAllowedPage);
  }
}
watch(
  () => [
    route.path,
    identity.user?.value?.uuid,
    identity.user?.value?.transacting_as,
    JSON.stringify(identity.user?.value?.permissions),
  ],
  load,
  {
    immediate: true,
  },
);
let timer: ReturnType<typeof setInterval>;
onMounted(() => {
  timer = setInterval(() => {
    if (document.visibilityState === 'visible' && store.currentUser.id)
      void store.refreshAccess(true).catch(() => undefined);
    if (
      document.visibilityState === 'visible' &&
      store.currentUser.capabilities.viewNotifications &&
      !store.notificationLoading &&
      !store.accessError
    )
      void store.fetchNotifications(undefined, 60000).catch(() => undefined);
  }, 60000);
});
onBeforeUnmount(() => clearInterval(timer));
</script>
