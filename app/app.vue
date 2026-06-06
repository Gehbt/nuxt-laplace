<script setup lang="ts">
useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [
    { rel: 'icon', href: '/favicon.ico' },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap',
    },
  ],
  htmlAttrs: {
    lang: 'en',
  },
})

const title = 'Laplace — Real-time Chat with AI'
const description =
  'A real-time chat platform with integrated AI. WebSocket-powered rooms, DeepSeek assistant, and ephemeral messaging.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage: 'https://ui.nuxt.com/assets/templates/nuxt/starter-light.png',
  twitterImage: 'https://ui.nuxt.com/assets/templates/nuxt/starter-light.png',
  twitterCard: 'summary_large_image',
})
</script>

<template>
  <UApp>
    <UHeader :ui="{ root: 'bg-transparent backdrop-blur-md' }">
      <template #left>
        <NuxtLink to="/" class="flex items-center gap-2.5">
          <span class="header-logo">Laplace</span>
        </NuxtLink>

        <UNavigationMenu
          :items="[
            { label: 'Home', to: '/', icon: 'i-lucide-home' },
            { label: 'Chat', to: '/chat/general', icon: 'i-lucide-message-circle' },
            { label: 'Chat With AI', to: '/chat/deepseek', icon: 'i-lucide-sparkles' },
          ]"
          variant="link"
          :ui="{ link: 'text-xs', linkLeadingIcon: 'size-3.5' }"
        />
      </template>

      <template #right>
        <UColorModeButton />
      </template>
    </UHeader>

    <UMain>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UMain>

    <USeparator icon="i-simple-icons-nuxtdotjs" />

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          Laplace © {{ new Date().getFullYear() }} — Built with Nuxt, Drizzle, and the Vercel AI SDK
        </p>
      </template>

      <template #right>
        <UButton
          to="https://github.com/nuxt-ui-templates/starter"
          target="_blank"
          icon="i-simple-icons-github"
          aria-label="GitHub"
          color="neutral"
          variant="ghost"
        />
      </template>
    </UFooter>
  </UApp>
</template>

<style>
.header-logo {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 1.25rem;
  font-weight: 400;
  letter-spacing: -0.02em;
}
</style>
