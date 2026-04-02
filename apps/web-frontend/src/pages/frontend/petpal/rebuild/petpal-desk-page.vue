<template>
  <div class="petpal-desk-page">
    <header class="petpal-desk-page__hero">
      <div class="petpal-desk-page__meta">
        <p class="petpal-desk-page__eyebrow">{{ eyebrow }}</p>
        <nav v-if="navItems.length" class="petpal-desk-page__nav" aria-label="PetPal 页面导航">
          <RouterLink
            v-for="item in navItems"
            :key="item.name"
            class="petpal-desk-page__nav-item"
            :class="{ 'is-active': item.name === activeName }"
            :to="{ name: item.name }"
          >
            {{ item.label }}
          </RouterLink>
        </nav>
      </div>

      <div class="petpal-desk-page__headline">
        <div class="petpal-desk-page__copy">
          <h1>{{ title }}</h1>
          <p v-if="summary">{{ summary }}</p>
        </div>

        <div class="petpal-desk-page__hero-actions">
          <slot name="actions">
            <RouterLink
              v-if="primaryAction"
              :to="primaryAction.to"
              :class="['petpal-desk-page__button', `is-${primaryAction.tone || 'primary'}`]"
            >
              {{ primaryAction.label }}
            </RouterLink>

            <RouterLink
              v-for="action in actions"
              :key="action.label"
              :to="action.to"
              :class="['petpal-desk-page__button', `is-${action.tone || 'secondary'}`]"
            >
              {{ action.label }}
            </RouterLink>
          </slot>
        </div>
      </div>

      <div v-if="stats.length" class="petpal-desk-page__stats">
        <div v-for="item in stats" :key="item.label" class="petpal-desk-page__stat">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <p v-if="item.hint">{{ item.hint }}</p>
        </div>
      </div>
    </header>

    <div class="petpal-desk-page__body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';
import { RouterLink } from 'vue-router';

type DeskAction = {
  label: string;
  to: RouteLocationRaw;
  tone?: 'primary' | 'secondary' | 'ghost';
};

withDefaults(defineProps<{
  eyebrow?: string;
  title: string;
  summary?: string;
  activeName?: string;
  navItems?: ReadonlyArray<{ label: string; name: string }>;
  primaryAction?: DeskAction | null;
  actions?: ReadonlyArray<DeskAction>;
  stats?: ReadonlyArray<{ label: string; value: string; hint?: string }>;
}>(), {
  eyebrow: 'PetPal',
  summary: '',
  activeName: '',
  navItems: () => [],
  primaryAction: null,
  actions: () => [],
  stats: () => [],
});
</script>

<style scoped lang="scss">
.petpal-desk-page {
  display: grid;
  gap: 20px;
}

.petpal-desk-page__hero {
  display: grid;
  gap: 18px;
  padding: 28px;
  border: 1px solid rgba(39, 55, 42, 0.12);
  background:
    radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 24%),
    radial-gradient(circle at bottom left, rgba(249, 115, 22, 0.08), transparent 22%),
    linear-gradient(180deg, rgba(255, 251, 247, 0.94) 0%, rgba(250, 244, 238, 0.98) 100%);
  box-shadow: 0 24px 60px rgba(38, 32, 24, 0.08);
}

.petpal-desk-page__meta,
.petpal-desk-page__headline {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
}

.petpal-desk-page__eyebrow {
  margin: 0;
  color: #8d6d4d;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.petpal-desk-page__copy {
  display: grid;
  gap: 10px;
  max-width: 760px;
}

.petpal-desk-page__copy h1 {
  margin: 0;
  color: #2b241f;
  font-size: clamp(34px, 5vw, 52px);
  line-height: 0.98;
}

.petpal-desk-page__copy p {
  margin: 0;
  color: #665c54;
  line-height: 1.75;
  font-size: 15px;
}

.petpal-desk-page__nav,
.petpal-desk-page__hero-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.petpal-desk-page__nav-item,
.petpal-desk-page__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 16px;
  border: 1px solid rgba(39, 55, 42, 0.12);
  background: rgba(255, 252, 248, 0.84);
  color: #43362d;
  font-size: 13px;
  font-weight: 700;
  transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.petpal-desk-page__nav-item:hover,
.petpal-desk-page__nav-item.is-active {
  background: rgba(255, 255, 255, 0.98);
  border-color: rgba(249, 115, 22, 0.24);
  color: #2b241f;
}

.petpal-desk-page__button.is-primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff9f3;
}

.petpal-desk-page__button.is-secondary {
  background: #fffdf9;
}

.petpal-desk-page__button.is-ghost {
  border-color: transparent;
  background: transparent;
}

.petpal-desk-page__stats {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.petpal-desk-page__stat {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border-top: 1px solid rgba(39, 55, 42, 0.08);
}

.petpal-desk-page__stat span {
  color: #8f7b69;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.petpal-desk-page__stat strong {
  color: #241f1a;
  font-size: 20px;
  line-height: 1.15;
}

.petpal-desk-page__stat p {
  margin: 0;
  color: #6b625a;
  font-size: 13px;
  line-height: 1.65;
}

.petpal-desk-page__body {
  display: grid;
  gap: 16px;
}

@media (max-width: 1080px) {
  .petpal-desk-page__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .petpal-desk-page__hero {
    padding: 20px;
  }

  .petpal-desk-page__stats {
    grid-template-columns: 1fr;
  }
}
</style>
