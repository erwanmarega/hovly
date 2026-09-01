<template>
  <span
    v-for="(spot, index) in spots"
    :key="index"
    class="logo-watermark animate-float pointer-events-none absolute"
    :style="{
      top: spot.top,
      left: spot.left,
      right: spot.right,
      bottom: spot.bottom,
      width: spot.size,
      height: spot.size,
      animationDelay: spot.delay,
    }"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
const spots = [
  { top: '-10%', right: '4%', size: '72px', delay: '0s' },
  { bottom: '8%', right: '22%', size: '48px', delay: '1.4s' },
  { top: '18%', right: '38%', size: '36px', delay: '2.8s' },
  { bottom: '-8%', left: '6%', size: '56px', delay: '0.9s' },
  { top: '10%', left: '20%', size: '32px', delay: '2.1s' },
  { bottom: '18%', left: '42%', size: '28px', delay: '3.6s' },
  { top: '30%', right: '58%', size: '30px', delay: '1.9s' },
  { bottom: '-6%', right: '48%', size: '44px', delay: '3.1s' },
]
</script>

<style scoped>
.logo-watermark {
  background-image: url('/Icon_HOVLY.jpg');
  background-repeat: no-repeat;
  background-size: contain;
  filter: grayscale(1);
  mix-blend-mode: multiply;
  opacity: 0.16;
}
</style>
