<template>
  <div class="petpal-export-toolbar">
    <slot name="presets" />
    <slot name="template-actions" />
    <div class="petpal-export-toolbar__filters">
      <slot name="filters" />
    </div>
    <slot name="summary" />
    <p v-if="hint" class="petpal-export-toolbar__hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  hint?: string;
}>();
</script>

<style scoped lang="scss">
.petpal-export-toolbar {
  display: grid;
  gap: 12px;
}

.petpal-export-toolbar__filters {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.petpal-export-toolbar__hint {
  margin: 0;
  color: #6b625a;
  font-size: 13px;
  line-height: 1.6;
}

@media (max-width: 720px) {
  .petpal-export-toolbar__filters {
    align-items: stretch;
  }
}
</style>
