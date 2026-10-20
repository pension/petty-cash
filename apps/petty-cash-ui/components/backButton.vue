<template>
  <PoButton label="Back" action-type="ghost" @button-click="handleBackButtonClick" />
</template>

<script setup>
import { PoButton } from '@pension/ui-kit';

const router = useRouter();
function handleBackButtonClick() {
  router.back();
}
</script>
