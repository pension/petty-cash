<template>
  <PoWrap>
    <PoSidebarDrawer :content="sidebarContent" :curr-route="currRoute" @button-click="handleSidebarClick" />
    <PoMain>
      <PoTopBar
        app-name="petty-cash"
        :has-search="false"
        :user-object="identity.user?.value"
        :avatar="identity.user?.value?.avatar"
        @logout="identity.logOut()"
        @profile-switcher-click="handleProfileSwitcherClick"
        @go-to-profile="() => {}"
      >
        <template #appIcon>
          <LinkIcon class="w-6 h-6 text-mpao-orange" />
        </template>
      </PoTopBar>

      <!-- Users must transact as an organisation before using the app.
           Which organisations are actually allowed (e.g. Pension Office
           only) is enforced via permissions, not filtered here. -->
      <PoOrgSelector
        v-if="identity.user?.value?.transacting_as == 0"
        :user-object="identity.user?.value"
        @on-profile-click="handleProfileSwitcherClick"
      />
      <slot v-else/>

      <PoFooter />
    </PoMain>
  </PoWrap>
</template>

<script setup>
import { onMounted, onUpdated, ref } from 'vue';
import { useRouter } from '#imports';
import { PoWrap, PoMain, PoTopBar, PoSidebarDrawer, PoFooter, PoOrgSelector } from '@pension/ui-kit';
import {
  HomeIcon,
  LinkIcon,
  ChartBarIcon,
  Cog6ToothIcon,
} from '@heroicons/vue/24/outline';

const router = useRouter();
const identity = useIdentity();
const currRoute = ref('');

const sidebarContent = [
  {
    groupName: '',
    items: [
      { label: 'Dashboard', url: '/', icon: HomeIcon },
      { label: 'Links', url: '/links', icon: LinkIcon },
      { label: 'Analytics', url: '/analytics', icon: ChartBarIcon },
      { label: 'Settings', url: '/settings', icon: Cog6ToothIcon },
    ],
  },
];

function handleSidebarClick(url) {
  router.push(url);
}

// Matches payouts-ui/pcs-ui's layouts/main.vue dispatch: same handler serves
// both the forced org-selection gate and the top bar's profile switcher
// dropdown (which also lists claimed delegations, hence the `claimed` check).
async function handleProfileSwitcherClick(value) {
  if (value === 'logout') {
    identity.logOut();
    return;
  }
  if (typeof value === 'object' && value) {
    if (value.claimed) {
      identity.switchToDelegation(value.id);
    } else if (!value.id) {
      await identity.changeTransactingAs(value.organisation_uuid);
    }
  }
}

async function updateCurrRoute() {
  await router.isReady();
  currRoute.value = router.currentRoute.value.path;
}

onMounted(updateCurrRoute);
onUpdated(updateCurrRoute);
</script>
