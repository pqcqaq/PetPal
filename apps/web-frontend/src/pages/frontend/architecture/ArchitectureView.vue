<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">产品边界</p>
      <h1>页面边界按真实任务拆开，不再回到超级工作台。</h1>
      <p>这个页面只说明入口结构和分工，真正的操作都已经下沉到独立业务页。</p>
    </section>

    <section class="frontend-page__section-grid">
      <article v-for="item in layers" :key="item.title" class="frontend-card architecture-grid-span-6">
        <span class="frontend-card__eyebrow">{{ item.title }}</span>
        <h2>{{ item.summary }}</h2>
        <ul class="architecture-list">
          <li v-for="detail in item.details" :key="detail">{{ detail }}</li>
        </ul>
      </article>
    </section>

    <section class="frontend-card">
      <span class="frontend-card__eyebrow">设计原则</span>
      <h2>这轮重构遵循的规则</h2>
      <ul class="architecture-list">
        <li v-for="item in principles" :key="item">{{ item }}</li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { architectureLayers, operatingPrinciples } from '../frontend-content';

const layers = architectureLayers.map((item) => ({ ...item, details: [...item.details] }));
const principles = [...operatingPrinciples];
</script>

<style scoped lang="scss">
.architecture-grid-span-6 {
  grid-column: span 6;
}

.architecture-list {
  margin: 0;
  padding-left: 18px;
  color: #62584f;
  line-height: 1.85;
}

@media (max-width: 1080px) {
  .architecture-grid-span-6 {
    grid-column: span 12;
  }
}
</style>
