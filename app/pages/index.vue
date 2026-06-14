<script setup lang="ts">
import type { Room } from '~/types/chat'

definePageMeta({ layout: 'blank' })

const colorMode = useColorMode()
const { data: rooms } = await useFetch<Room[]>('/api/rooms', { key: 'landing-rooms' })

const heroVisible = ref(false)
const featuresVisible = ref(false)
const roomsVisible = ref(false)

const featuresRef = ref<HTMLElement>()
const roomsRef = ref<HTMLElement>()

onMounted(() => {
  window.setTimeout(() => (heroVisible.value = true), 100)

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        if (entry.target === featuresRef.value) featuresVisible.value = true
        if (entry.target === roomsRef.value) roomsVisible.value = true
      }
    },
    { threshold: 0.15 },
  )

  if (featuresRef.value) observer.observe(featuresRef.value)
  if (roomsRef.value) observer.observe(roomsRef.value)

  onUnmounted(() => observer.disconnect())
})

const features = [
  {
    icon: 'i-lucide-zap',
    title: 'Real-time Rooms',
    desc: 'WebSocket-powered conversations with instant message delivery and live presence indicators.',
  },
  {
    icon: 'i-lucide-brain',
    title: 'AI Integration',
    desc: 'DeepSeek-powered assistant with configurable reasoning effort and adaptive thinking modes.',
  },
  {
    icon: 'i-lucide-shield-check',
    title: 'Ephemeral & Secure',
    desc: 'Messages stay in transit, not in the cloud. IndexedDB caching for offline resilience.',
  },
]

const floatingOrbs = Array.from({ length: 5 }, (_, i) => ({
  id: i,
  size: 200 + Math.random() * 400,
  x: Math.random() * 100,
  y: Math.random() * 100,
  duration: 20 + Math.random() * 30,
  delay: Math.random() * -20,
}))
</script>

<template>
  <div class="landing-page" :class="colorMode.value">
    <!-- ===== HERO ===== -->
    <section class="hero">
      <!-- Animated background orbs (client-only to avoid hydration mismatch) -->
      <ClientOnly>
        <div class="hero__orbs" aria-hidden="true">
          <div
            v-for="orb in floatingOrbs"
            :key="orb.id"
            class="hero__orb"
            :style="{
              width: `${orb.size}px`,
              height: `${orb.size}px`,
              left: `${orb.x}%`,
              top: `${orb.y}%`,
              animationDuration: `${orb.duration}s`,
              animationDelay: `${orb.delay}s`,
            }"
          />
        </div>
      </ClientOnly>

      <!-- Subtle grid pattern -->
      <div class="hero__grid" aria-hidden="true" />

      <!-- Probability wave SVG -->
      <div class="hero__wave" aria-hidden="true">
        <svg viewBox="0 0 1440 200" preserveAspectRatio="none">
          <path
            class="wave-path wave-path--1"
            d="M0 100 C240 20, 480 180, 720 100 C960 20, 1200 180, 1440 100"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
          />
          <path
            class="wave-path wave-path--2"
            d="M0 100 C240 160, 480 40, 720 100 C960 160, 1200 40, 1440 100"
            fill="none"
            stroke="currentColor"
            stroke-width="0.5"
          />
          <path
            class="wave-path wave-path--3"
            d="M0 100 C360 30, 720 170, 1080 100 C1260 65, 1350 135, 1440 100"
            fill="none"
            stroke="currentColor"
            stroke-width="0.3"
          />
        </svg>
      </div>

      <!-- Content -->
      <div class="hero__content" :class="{ 'is-visible': heroVisible }">
        <div class="hero__badge">
          <UIcon name="i-lucide-radio" class="size-3.5" />
          <span>Open-source chat infrastructure</span>
        </div>

        <h1 class="hero__title">
          <span class="hero__title-line">Where probability</span>
          <span class="hero__title-line hero__title-line--accent">meets conversation</span>
        </h1>

        <p class="hero__subtitle">
          Laplace is a real-time chat platform with integrated AI. Named after the mathematician who
          believed the universe could be predicted — we believe conversations should flow just as
          naturally.
        </p>

        <div class="hero__actions">
          <UButton to="/chat/general" size="xl" class="hero__cta">
            Enter a room
            <UIcon name="i-lucide-arrow-right" class="size-5" />
          </UButton>
          <UButton to="/chat/deepseek" variant="ghost" color="neutral" size="xl">
            Talk to AI
            <UIcon name="i-lucide-sparkles" class="size-4" />
          </UButton>
        </div>

        <!-- Live indicator -->
        <div class="hero__live">
          <span class="hero__live-dot" />
          <span>Systems operational</span>
        </div>
      </div>
    </section>

    <!-- ===== FEATURES ===== -->
    <section ref="featuresRef" class="features" :class="{ 'is-visible': featuresVisible }">
      <div class="features__inner">
        <div
          v-for="(feature, i) in features"
          :key="feature.title"
          class="feature-card"
          :style="{ transitionDelay: `${i * 120}ms` }"
        >
          <div class="feature-card__icon">
            <UIcon :name="feature.icon" class="size-6" />
          </div>
          <h3 class="feature-card__title">{{ feature.title }}</h3>
          <p class="feature-card__desc">{{ feature.desc }}</p>
        </div>
      </div>
    </section>

    <!-- ===== ROOMS ===== -->
    <section
      v-if="rooms?.length"
      ref="roomsRef"
      class="rooms"
      :class="{ 'is-visible': roomsVisible }"
    >
      <h2 class="rooms__heading">Active rooms</h2>
      <div class="rooms__grid">
        <NuxtLink v-for="room in rooms" :key="room.id" :to="`/chat/${room.id}`" class="room-card">
          <span class="room-card__hash">#</span>
          <span class="room-card__name">{{ room.name || room.id }}</span>
          <UIcon name="i-lucide-chevron-right" class="size-4 room-card__arrow" />
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ======== THEME TOKENS ======== */
.landing-page {
  --lp-bg: #fafafa;
  --lp-bg-sub: #ffffff;
  --lp-bg-hover: #f4f4f5;
  --lp-text: #18181b;
  --lp-text-heading: #09090b;
  --lp-text-muted: #71717a;
  --lp-text-dim: #a1a1aa;
  --lp-text-faint: #d4d4d8;
  --lp-border: rgba(0, 0, 0, 0.08);
  --lp-card: rgba(244, 244, 245, 0.8);
  --lp-card-hover: rgba(228, 228, 231, 0.8);
  --lp-grid-color: rgba(0, 180, 110, 0.06);
  --lp-orb-color: rgba(0, 180, 110, 0.05);
}

.landing-page.dark {
  --lp-bg: #09090b;
  --lp-bg-sub: #18181b;
  --lp-bg-hover: #27272a;
  --lp-text: #e4e4e7;
  --lp-text-heading: #fafafa;
  --lp-text-muted: #71717a;
  --lp-text-dim: #52525b;
  --lp-text-faint: #3f3f46;
  --lp-border: rgba(63, 63, 70, 0.3);
  --lp-card: rgba(24, 24, 27, 0.8);
  --lp-card-hover: rgba(39, 39, 42, 0.8);
  --lp-grid-color: rgba(0, 220, 130, 0.03);
  --lp-orb-color: rgba(0, 220, 130, 0.06);
}

/* ======== BASE ======== */
.landing-page {
  min-height: 100dvh;
  background: var(--lp-bg);
  color: var(--lp-text);
  overflow-x: hidden;
  font-family: 'Public Sans', system-ui, sans-serif;
}

/* ======== HERO ======== */
.hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 2rem;
  overflow: hidden;
}

.hero::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120px;
  background: linear-gradient(to top, var(--lp-bg), transparent);
  pointer-events: none;
}

/* Background orbs — soft green glows */
.hero__orbs {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.hero__orb {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, var(--lp-orb-color) 0%, transparent 70%);
  animation: orb-drift linear infinite;
  will-change: transform;
}

@keyframes orb-drift {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  25% {
    transform: translate(30px, -40px) scale(1.05);
  }
  50% {
    transform: translate(-20px, 20px) scale(0.95);
  }
  75% {
    transform: translate(15px, 35px) scale(1.02);
  }
}

/* Grid pattern */
.hero__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--lp-grid-color) 1px, transparent 1px),
    linear-gradient(90deg, var(--lp-grid-color) 1px, transparent 1px);
  background-size: 80px 80px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
}

/* Wave animation */
.hero__wave {
  position: absolute;
  bottom: 15%;
  left: 0;
  right: 0;
  opacity: 0.25;
  pointer-events: none;
}

.hero__wave svg {
  width: 100%;
  height: 120px;
  color: #00dc82;
}

.wave-path {
  stroke-dasharray: 2000;
  stroke-dashoffset: 2000;
  animation: wave-draw 4s ease-out forwards;
}

.wave-path--2 {
  animation-delay: 0.6s;
  opacity: 0.5;
}

.wave-path--3 {
  animation-delay: 1.2s;
  opacity: 0.3;
}

@keyframes wave-draw {
  to {
    stroke-dashoffset: 0;
  }
}

/* Hero content */
.hero__content {
  position: relative;
  z-index: 1;
  max-width: 720px;
  text-align: center;
  opacity: 0;
  transform: translateY(32px);
  transition:
    opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
}

.hero__content.is-visible {
  opacity: 1;
  transform: translateY(0);
}

.hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  margin-bottom: 2rem;
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #00dc82;
  background: rgba(0, 220, 130, 0.08);
  border: 1px solid rgba(0, 220, 130, 0.15);
  border-radius: 100px;
}

.hero__title {
  margin: 0 0 1.5rem;
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: clamp(2.8rem, 7vw, 5.2rem);
  font-weight: 400;
  line-height: 1.05;
  letter-spacing: -0.025em;
  color: var(--lp-text-heading);
}

.hero__title-line {
  display: block;
}

.hero__title-line--accent {
  color: #00dc82;
  font-style: italic;
}

.hero__subtitle {
  margin: 0 auto 2.5rem;
  max-width: 520px;
  font-size: 1.05rem;
  line-height: 1.7;
  color: var(--lp-text-muted);
}

.hero__actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.hero__cta {
  background: #00dc82 !important;
  color: #09090b !important;
  font-weight: 600;
}

.hero__live {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 3rem;
  font-size: 0.78rem;
  letter-spacing: 0.03em;
  color: var(--lp-text-dim);
}

.hero__live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00dc82;
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(0, 220, 130, 0.4);
  }
  50% {
    opacity: 0.7;
    box-shadow: 0 0 0 6px rgba(0, 220, 130, 0);
  }
}

/* ======== FEATURES ======== */
.features {
  padding: 2rem 4rem;
  opacity: 0;
  transform: translateY(24px);
  transition:
    opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

.features.is-visible {
  opacity: 1;
  transform: translateY(0);
}

.features__inner {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1px;
  max-width: 960px;
  margin: 0 auto;
  background: var(--lp-border);
  border-radius: 16px;
  overflow: hidden;
}

.feature-card {
  padding: 2.5rem 2rem;
  background: var(--lp-card);
  transition:
    background 0.3s ease,
    transform 0.3s ease;
}

.feature-card:hover {
  background: var(--lp-card-hover);
  transform: translateY(-2px);
}

.feature-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-bottom: 1.25rem;
  color: #00dc82;
  background: rgba(0, 220, 130, 0.08);
  border: 1px solid rgba(0, 220, 130, 0.12);
  border-radius: 12px;
}

.feature-card__title {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--lp-text-heading);
}

.feature-card__desc {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.6;
  color: var(--lp-text-muted);
}

/* ======== ROOMS ======== */
.rooms {
  padding: 2rem 2rem 4rem;
  max-width: 960px;
  margin: 0 auto;
  opacity: 0;
  transform: translateY(24px);
  transition:
    opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s,
    transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s;
}

.rooms.is-visible {
  opacity: 1;
  transform: translateY(0);
}

.rooms__heading {
  margin: 0 0 1.25rem;
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--lp-text-dim);
}

.rooms__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
}

.room-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: var(--lp-card);
  border: 1px solid var(--lp-border);
  border-radius: 12px;
  text-decoration: none;
  color: var(--lp-text);
  transition:
    background 0.25s ease,
    border-color 0.25s ease,
    transform 0.25s ease;
}

.room-card:hover {
  background: var(--lp-card-hover);
  border-color: rgba(0, 220, 130, 0.2);
  transform: translateX(4px);
}

.room-card__hash {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 1.3rem;
  color: #00dc82;
  opacity: 0.6;
}

.room-card__name {
  flex: 1;
  font-weight: 500;
  font-size: 0.95rem;
}

.room-card__arrow {
  color: var(--lp-text-dim);
  transition:
    color 0.25s ease,
    transform 0.25s ease;
}

.room-card:hover .room-card__arrow {
  color: #00dc82;
  transform: translateX(2px);
}
</style>
