// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  // @pension/ui-kit bundles browser-only code (e.g. lottie-web, which touches
  // `document` at import time) that breaks server-side rendering. The other
  // standalone apps in this org (payouts-ui, pcs-ui) render client-only for
  // the same reason.
  ssr: false,

  // The local Nginx vhost forwards both Nuxt HTTP and HMR websocket traffic.
  vite: {
    server: {
      allowedHosts: ['petty.pension.test'],
      ...(process.env.HMR_HOST
        ? { hmr: { host: process.env.HMR_HOST, clientPort: 80, protocol: 'ws' as const } }
        : {}),
    },
  },

  modules: ['@pinia/nuxt', '@pension/midgard-nuxt', '@nuxt/eslint'],

  css: ['~/assets/css/main.css'],

  // @pension/ui-kit ships a pre-compiled Tailwind v4 stylesheet. It is copied to
  // public/ui-kit.css by the postinstall script and loaded as a plain <link> so it
  // is never re-processed by the app's own PostCSS/Tailwind pipeline.
  postcss: {
    plugins: {
      '@tailwindcss/postcss': {},
      autoprefixer: {},
    },
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:4000',
      // @pension/midgard-nuxt — reusing the shared local-dev bifrost client
      // that payouts-ui and pcs-ui also log in against.
      auth_url: process.env.AUTH_URL,
      client_id: process.env.CLIENT_ID,
      redirect_url: process.env.REDIRECT_URL,
      scopes: process.env.SCOPES,
    },
  },

  app: {
    head: {
      title: 'Petty Cash',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'MPAO General Services and Finance petty cash management' },
      ],
      link: [{ rel: 'stylesheet', href: '/ui-kit.css', key: 'pension-ui-kit' }],
    },
  },

  nitro: {
    externals: {
      external: ['@pension/ui-kit'],
    },
  },

  compatibilityDate: '2024-07-04',
});
