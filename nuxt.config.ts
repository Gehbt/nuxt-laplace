// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@nuxt/test-utils', '@pinia/nuxt', '@vueuse/nuxt'],

  imports: {
    // no 'stores' dir
    scan: false,
  },

  devtools: {
    enabled: true,

    timeline: {
      enabled: true,
    },
  },

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'dark',
  },

  runtimeConfig: {
    databaseUrl: '',
    aiGatewayApiKey: '',
    deepseekApiKey: '',
    deepseekBaseUrl: '',
  },

  routeRules: {
    // '/': { prerender: true },
  },
  devServer: {
    port: 4331,
  },
  experimental: {
    typescriptPlugin: true,
  },

  compatibilityDate: '2026-05-15',
  nitro: {
    experimental: {
      websocket: true,
    },
    publicAssets: [{ dir: 'uploads', baseURL: '/uploads', maxAge: 60 * 60 * 24 * 365 }],
  },
  vite: {
    optimizeDeps: {
      include: ['@vue/devtools-core', '@vue/devtools-kit'],
    },
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs',
      },
    },
  },
})
