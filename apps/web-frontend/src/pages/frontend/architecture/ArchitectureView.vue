<template>
  <div class="frontend-page">
    <section class="frontend-page__hero">
      <p class="frontend-page__eyebrow">产品结构</p>
      <h1>PetPal 已经按主人流和治理流拆开。</h1>
      <p>
        公开前台负责产品说明，主人服务台负责宠物和订单主流程，PetPal 后台负责投诉、审核和回调治理，后台入口已经改为根级直达。
      </p>
    </section>

    <ArchitectureCanvas :layers="layers" />
    <ArchitectureOperatingModel :principles="principles" />
  </div>
</template>

<script setup lang="ts">
import { architectureLayers, operatingPrinciples } from '../frontend-content';
import ArchitectureCanvas from './components/ArchitectureCanvas.vue';
import ArchitectureOperatingModel from './components/ArchitectureOperatingModel.vue';

const layers = architectureLayers.map((item) => ({ ...item, details: [...item.details] }));
const principles = [...operatingPrinciples];
</script>
