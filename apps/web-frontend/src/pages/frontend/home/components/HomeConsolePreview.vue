<template>
  <section class="frontend-page__section-grid">
    <article class="frontend-card console-preview console-preview--lead">
      <span class="frontend-card__eyebrow">PetPal Admin</span>
      <h2>后台聚焦投诉、审核和回调治理。</h2>
      <p>
        进入 PetPal 后台后，不再先过一层模板菜单，而是直接进入真实业务工作区。
      </p>
    </article>

    <article v-for="item in highlights" :key="item.title" class="frontend-card console-preview">
      <h3>{{ item.title }}</h3>
      <p>{{ item.description }}</p>
    </article>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  highlights: Array<{ title: string; description: string }>;
}>();
</script>

<style scoped lang="scss">
.console-preview--lead {
  grid-column: span 5;
  background: linear-gradient(145deg, rgba(23, 56, 74, 0.94) 0%, rgba(45, 98, 123, 0.9) 100%);
}

.console-preview--lead,
.console-preview--lead h2,
.console-preview--lead p {
  color: #f8f4ed;
}

.console-preview:not(.console-preview--lead) {
  grid-column: span 7;
}

@media (max-width: 900px) {
  .console-preview--lead,
  .console-preview:not(.console-preview--lead) {
    grid-column: auto;
  }
}
</style>
