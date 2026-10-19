// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  // @pension/ui-kit bundles browser-only code (e.g. lottie-web, which touches
  // `document` at import time) that breaks server-side rendering. The other
  // standalone apps in this org (payouts-ui, pcs-ui) render client-only for
  // the same reason.
  ssr: false,

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
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:4000/api/v1/shorturl',
      shortDomain: process.env.NUXT_PUBLIC_SHORT_DOMAIN || 'mpo.mv',
      // @pension/midgard-nuxt — reusing the shared local-dev bifrost client
      // that payouts-ui and pcs-ui also log in against.
      auth_url: process.env.AUTH_URL,
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      redirect_url: process.env.REDIRECT_URL,
      scopes: process.env.SCOPES,
    },
  },

  vite: {
    // @petty-cash/qr-render is a workspace-linked (symlinked) package. Vite's
    // default symlink resolution follows the link to its real path
    // (packages/qr-render/dist/index.js), which sits outside node_modules —
    // its CJS-interop heuristics then treat that as app source rather than
    // a dependency needing CJS→ESM conversion, so the named export isn't
    // found. Keeping the resolved path as the node_modules symlink path
    // instead (a known Vite + monorepo-linked-package fix) avoids that.
    resolve: {
      preserveSymlinks: true,
    },
    server: {
      fs: {
        allow: ['..'],
      },
    },
    ssr: {
      external: ['@pension/ui-kit'],
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('apexcharts')) return 'charts';
            if (id.includes('qrcode')) return 'qrcode-engine';
            if (id.includes('@pension/ui-kit')) return 'ui-kit';
            if (id.includes('@heroicons')) return 'heroicons';
          },
        },
      },
    },
  },

  app: {
    head: {
      title: 'petty-cash',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Enterprise URL Shortener, Custom QR Code Designer, and Engagement Analytics' },
      ],
      link: [
        { rel: 'stylesheet', href: '/ui-kit.css', key: 'pension-ui-kit' },
      ],
    },
  },

  nitro: {
    externals: {
      external: ['@pension/ui-kit'],
    },
  },

  compatibilityDate: '2024-07-04',
});
