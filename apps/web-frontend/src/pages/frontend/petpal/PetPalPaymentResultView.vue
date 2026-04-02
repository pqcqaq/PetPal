<!--
UX Blueprint
User: 刚支付完成或回看支付结果的主人
Entry: 订单详情支付入口、支付回流链接、历史订单结果入口
First screen: 先确认付款是否到账、订单当前到了哪一步
Primary action: 继续当前订单下一步
Secondary actions: 返回订单、沟通、订单列表
-->
<template>
  <PetPalOrderResultWorkbench mode="payment" />
</template>

<script setup lang="ts">
import PetPalOrderResultWorkbench from './PetPalOrderResultWorkbench.vue';

defineOptions({
  name: 'PetPalPaymentResultView',
});
</script>
