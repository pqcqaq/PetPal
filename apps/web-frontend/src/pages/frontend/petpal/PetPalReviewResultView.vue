<!--
UX Blueprint
User: 刚完成评价或回看评价结果的主人
Entry: 订单详情评价入口、订单完成后回流、结果页串联
First screen: 评分、评价内容、订单当前还要不要继续处理别的事
Primary action: 继续订单的最相关下一步
Secondary actions: 返回订单、看沟通、订单列表
-->
<template>
  <PetPalOrderResultWorkbench mode="review" />
</template>

<script setup lang="ts">
import PetPalOrderResultWorkbench from './PetPalOrderResultWorkbench.vue';

defineOptions({
  name: 'PetPalReviewResultView',
});
</script>
