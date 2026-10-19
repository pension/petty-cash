export default defineNuxtPlugin(() => {
  const router = useRouter();
  const apiBase = String(useRuntimeConfig().public.apiBase);
  const originalFetch = globalThis.fetch.bind(globalThis);

  // Midgard's useHttp uses native fetch and its bundled UI-kit event bus is a
  // different instance from the app's UI-kit event bus. Inspect the response
  // itself so every petty-cash API request gets the same reliable 403 handling.
  globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await originalFetch(...args);
    const input = args[0];
    const requestUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    if (
      response.status === 403 &&
      requestUrl.startsWith(apiBase) &&
      router.currentRoute.value.path !== '/forbidden'
    ) {
      void router.replace('/forbidden');
    }

    return response;
  };
});
