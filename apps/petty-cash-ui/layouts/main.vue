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
        ></template>
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
      <PoContentArea v-else-if="store.loading"
        ><PoTypography>Loading Petty Cash…</PoTypography></PoContentArea
      >
      <PoContentArea v-else-if="store.error"
        ><PoMessage :message="store.error" /><PoButton
          label="Retry"
          @button-click="store.initialize(route.path)"
      /></PoContentArea>
      <slot v-else-if="store.currentUser.id" />
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
  PoTypography,
} from '@pension/ui-kit';
import navigation from '~/config/navigation';
import { useFloatStore } from '~/stores/useFloatStore';
const route = useRoute(),
  router = useRouter(),
  identity = useIdentity(),
  store = useFloatStore();
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
  const key = `${user?.uuid}:${user?.transacting_as}`;
  if (key !== previousIdentity) {
    store.reset();
    previousIdentity = key;
  }
  if (user?.transacting_as) await store.initialize(route.path);
}
watch(() => [route.path, identity.user?.value?.uuid, identity.user?.value?.transacting_as], load);
let timer: ReturnType<typeof setInterval>;
onMounted(() => {
  void load();
  timer = setInterval(() => {
    if (document.visibilityState === 'visible' && store.currentUser.id && !store.accessError)
      void store.fetchNotifications().catch(() => undefined);
  }, 60000);
});
onBeforeUnmount(() => clearInterval(timer));
</script>
