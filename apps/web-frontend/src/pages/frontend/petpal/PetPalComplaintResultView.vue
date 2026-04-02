<!--
UX Blueprint
User: 刚提交投诉或回看投诉处理进度的主人
Entry: 订单详情投诉入口、售后中心、异常订单回流
First screen: 投诉是否已受理、当前是否有人跟进、下一步去哪
Primary action: 查看售后进度或继续补充投诉
Secondary actions: 返回订单、看沟通、订单列表
-->
<template>
  <PetPalOrderResultWorkbench mode="complaint" />
</template>

<script setup lang="ts">
import PetPalOrderResultWorkbench from './PetPalOrderResultWorkbench.vue';

defineOptions({
  name: 'PetPalComplaintResultView',
});
</script>
