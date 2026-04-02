<template>
  <div class="petpal-desk-empty">
    <p class="petpal-desk-empty__eyebrow">{{ eyebrow }}</p>
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
    <div v-if="$slots.actions" class="petpal-desk-empty__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  eyebrow?: string;
  title: string;
  description: string;
}>(), {
  eyebrow: '空状态',
});
</script>

<style scoped lang="scss">
.petpal-desk-empty {
  display: grid;
  gap: 8px;
  padding: 28px 0;
  text-align: left;
}

.petpal-desk-empty__eyebrow {
  margin: 0;
  color: #9b8167;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.petpal-desk-empty h3 {
  margin: 0;
  color: #2b241f;
  font-size: 22px;
  line-height: 1.08;
}

.petpal-desk-empty p {
  margin: 0;
  color: #665c54;
  line-height: 1.7;
}

.petpal-desk-empty__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 6px;
}
</style>
