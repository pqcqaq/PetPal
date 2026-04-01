<template>
  <div class="petpal-state-panel" :class="`is-${tone}`">
    <div class="petpal-state-panel__copy">
      <span class="frontend-card__eyebrow">{{ eyebrow }}</span>
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="petpal-state-panel__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  eyebrow?: string;
  title: string;
  description: string;
  tone?: 'info' | 'warning' | 'danger';
}>(), {
  eyebrow: '状态提示',
  tone: 'info',
});
</script>

<style scoped lang="scss">
.petpal-state-panel {
  display: grid;
  gap: 16px;
  padding: 18px 20px;
  border-radius: 20px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.76);
}

.petpal-state-panel.is-info {
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(239, 246, 255, 0.92) 0%, rgba(255, 255, 255, 0.82) 100%);
}

.petpal-state-panel.is-warning {
  background:
    radial-gradient(circle at top right, rgba(245, 158, 11, 0.15), transparent 34%),
    linear-gradient(180deg, rgba(255, 251, 235, 0.94) 0%, rgba(255, 255, 255, 0.82) 100%);
}

.petpal-state-panel.is-danger {
  background:
    radial-gradient(circle at top right, rgba(239, 68, 68, 0.16), transparent 34%),
    linear-gradient(180deg, rgba(254, 242, 242, 0.94) 0%, rgba(255, 255, 255, 0.82) 100%);
}

.petpal-state-panel__copy {
  display: grid;
  gap: 8px;
}

.petpal-state-panel__copy h3,
.petpal-state-panel__copy p {
  margin: 0;
}

.petpal-state-panel__copy p {
  color: var(--frontend-color-muted);
  line-height: 1.7;
}

.petpal-state-panel__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
