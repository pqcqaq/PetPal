<template>
  <section class="petpal-desk-notice" :class="toneClass">
    <div class="petpal-desk-notice__copy">
      <p v-if="eyebrow" class="petpal-desk-notice__eyebrow">{{ eyebrow }}</p>
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
    </div>

    <div v-if="$slots.actions" class="petpal-desk-notice__actions">
      <slot name="actions" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  eyebrow?: string;
  title: string;
  description: string;
  tone?: 'accent' | 'warning' | 'danger' | 'success';
}>(), {
  eyebrow: 'Notice',
  tone: 'accent',
});

const toneClass = computed(() => `is-${props.tone}`);
</script>

<style scoped lang="scss">
.petpal-desk-notice {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 18px;
  border: 1px solid rgba(37, 99, 235, 0.14);
  background: rgba(244, 248, 255, 0.92);
}

.petpal-desk-notice.is-warning {
  border-color: rgba(245, 158, 11, 0.18);
  background: rgba(255, 249, 240, 0.94);
}

.petpal-desk-notice.is-danger {
  border-color: rgba(239, 68, 68, 0.16);
  background: rgba(255, 244, 243, 0.94);
}

.petpal-desk-notice.is-success {
  border-color: rgba(34, 197, 94, 0.16);
  background: rgba(242, 252, 246, 0.94);
}

.petpal-desk-notice__copy,
.petpal-desk-notice__actions {
  display: grid;
  gap: 8px;
}

.petpal-desk-notice__copy {
  max-width: 760px;
}

.petpal-desk-notice__eyebrow {
  margin: 0;
  color: #8f7b69;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.petpal-desk-notice__copy h2 {
  margin: 0;
  color: #2b241f;
  font-size: 18px;
  line-height: 1.2;
}

.petpal-desk-notice__copy p {
  margin: 0;
  color: #665c54;
  line-height: 1.7;
  font-size: 14px;
}

.petpal-desk-notice__actions {
  justify-items: end;
  min-width: 180px;
}

.petpal-desk-notice__actions :deep(a),
.petpal-desk-notice__actions :deep(button) {
  color: #2563eb;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}

@media (max-width: 720px) {
  .petpal-desk-notice {
    flex-direction: column;
  }

  .petpal-desk-notice__actions {
    justify-items: start;
    min-width: 0;
  }
}
</style>
