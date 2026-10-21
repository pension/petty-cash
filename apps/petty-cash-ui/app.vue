<template>
  <Html class="app-wrapper" lang="en">
    <Body class="bg-slate-100">
      <NuxtLayout v-slot="layout">
        <NuxtPage v-slot="{ Component }">
          <component :is="Component" v-if="layout?.renderPage !== false" />
        </NuxtPage>
      </NuxtLayout>
    </Body>
  </Html>
</template>
