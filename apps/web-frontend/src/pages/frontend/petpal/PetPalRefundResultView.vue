<!--
UX Blueprint
User: 刚发起退款或回看退款进度的主人
Entry: 订单详情售后入口、售后中心、退款历史回流
First screen: 直接看到退款阶段、已退金额和下一步
Primary action: 回到售后继续跟进
Secondary actions: 返回订单、看沟通、订单列表
-->
<template>
  <PetPalOrderResultWorkbench mode="refund" />
</template>

<script setup lang="ts">
import PetPalOrderResultWorkbench from './PetPalOrderResultWorkbench.vue';

defineOptions({
  name: 'PetPalRefundResultView',
});
</script>
