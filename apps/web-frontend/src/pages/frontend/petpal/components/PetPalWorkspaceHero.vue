<template>
  <section class="frontend-page__hero petpal-workspace-hero">
    <div class="petpal-workspace-hero__top">
      <div class="petpal-workspace-hero__copy">
        <p class="frontend-page__eyebrow">{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
        <p class="petpal-workspace-hero__summary">{{ summary }}</p>
      </div>

      <div class="petpal-workspace-hero__actions">
        <RouterLink
          v-if="primaryAction"
          class="frontend-page__button is-primary"
          :to="primaryAction.to"
        >
          {{ primaryAction.label }}
        </RouterLink>
        <RouterLink
          v-for="action in actions"
          :key="action.label"
          class="frontend-page__button"
          :class="action.tone === 'primary' ? 'is-primary' : 'is-secondary'"
          :to="action.to"
        >
          {{ action.label }}
        </RouterLink>
      </div>
    </div>

    <nav class="petpal-workspace-hero__nav" aria-label="PetPal workspace navigation">
      <RouterLink
        v-for="item in navItems"
        :key="item.name"
        class="petpal-workspace-hero__nav-pill"
        :class="{ 'is-active': item.name === activeName }"
        :to="{ name: item.name }"
      >
        {{ item.label }}
      </RouterLink>
    </nav>

    <div v-if="stats.length" class="petpal-workspace-hero__stats">
      <article v-for="item in stats" :key="item.label" class="petpal-workspace-hero__stat">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
        <p>{{ item.hint }}</p>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';

type HeroAction = {
  label: string;
  to: RouteLocationRaw;
  tone?: 'primary' | 'secondary';
};

type HeroStat = {
  label: string;
  value: string;
  hint: string;
};

defineProps<{
  eyebrow: string;
  title: string;
  summary: string;
  navItems: ReadonlyArray<{ label: string; name: string }>;
  activeName: string;
  stats: HeroStat[];
  primaryAction?: HeroAction | null;
  actions?: HeroAction[];
}>();
</script>

<style scoped lang="scss">
.petpal-workspace-hero {
  gap: 18px;
}

.petpal-workspace-hero__top,
.petpal-workspace-hero__actions {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
}

.petpal-workspace-hero__copy {
  display: grid;
  gap: 8px;
  max-width: 720px;
}

.petpal-workspace-hero__summary {
  margin: 0;
  color: #5f7673;
  line-height: 1.7;
}

.petpal-workspace-hero__nav {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.petpal-workspace-hero__nav-pill {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(18, 53, 51, 0.08);
  background: rgba(255, 255, 255, 0.72);
  color: #33514d;
  text-decoration: none;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.petpal-workspace-hero__nav-pill.is-active {
  border-color: transparent;
  background: linear-gradient(135deg, #0f766e 0%, #0b5d57 100%);
  color: #f7fffd;
}

.petpal-workspace-hero__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.petpal-workspace-hero__stat {
  display: grid;
  gap: 8px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.petpal-workspace-hero__stat span {
  color: #6d8683;
  font-size: 13px;
}

.petpal-workspace-hero__stat strong {
  color: #143634;
  font-size: 30px;
  line-height: 1.08;
}

.petpal-workspace-hero__stat p {
  margin: 0;
  color: #5f7673;
  line-height: 1.6;
}

@media (max-width: 1080px) {
  .petpal-workspace-hero__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .petpal-workspace-hero__stats {
    grid-template-columns: 1fr;
  }
}
</style>
