<script setup lang="ts">
import logo from "~/assets/images/dice-roller-logo.png";
</script>

<template>
  <span
    class="inline-flex items-center gap-2 font-serif text-lg font-semibold text-highlighted sm:text-xl"
  >
    <img
      :src="logo"
      alt=""
      width="40"
      height="40"
      class="size-9 shrink-0 object-contain sm:size-10"
    />
    <span>Dice Roller Tools</span>
  </span>
</template>
