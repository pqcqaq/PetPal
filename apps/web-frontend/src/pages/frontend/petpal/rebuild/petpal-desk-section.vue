<template>
  <section class="petpal-desk-section" :class="toneClass">
    <header v-if="title || description || $slots.actions" class="petpal-desk-section__header">
      <div class="petpal-desk-section__copy">
        <p v-if="eyebrow" class="petpal-desk-section__eyebrow">{{ eyebrow }}</p>
        <h2 v-if="title">{{ title }}</h2>
        <p v-if="description">{{ description }}</p>
      </div>

      <div v-if="$slots.actions" class="petpal-desk-section__actions">
        <slot name="actions" />
      </div>
    </header>

    <div class="petpal-desk-section__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  eyebrow?: string;
  title?: string;
  description?: string;
  tone?: 'default' | 'warm' | 'accent' | 'danger';
}>(), {
  eyebrow: '',
  title: '',
  description: '',
  tone: 'default',
});

const toneClass = computed(() => `is-${props.tone}`);
</script>

<style scoped lang="scss">
.petpal-desk-section {
  display: grid;
  gap: 16px;
  padding: 22px;
  border: 1px solid rgba(39, 55, 42, 0.1);
  background: rgba(255, 252, 249, 0.9);
}

.petpal-desk-section.is-warm {
  background: rgba(255, 248, 241, 0.92);
}

.petpal-desk-section.is-accent {
  background: rgba(245, 248, 255, 0.92);
}

.petpal-desk-section.is-danger {
  background: rgba(255, 246, 245, 0.92);
}

.petpal-desk-section__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.petpal-desk-section__copy {
  display: grid;
  gap: 8px;
  max-width: 740px;
}

.petpal-desk-section__eyebrow {
  margin: 0;
  color: #8f7b69;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.petpal-desk-section__copy h2 {
  margin: 0;
  color: #2b241f;
  font-size: clamp(24px, 3vw, 34px);
  line-height: 1.02;
}

.petpal-desk-section__copy p {
  margin: 0;
  color: #665c54;
  line-height: 1.7;
}

.petpal-desk-section__actions,
.petpal-desk-section__body {
  display: grid;
  gap: 12px;
}

@media (max-width: 720px) {
  .petpal-desk-section {
    padding: 18px;
  }
}
</style>
