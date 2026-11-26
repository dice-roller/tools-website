<script setup lang="ts">
defineProps<{ show: boolean }>();
const emit = defineEmits<{ afterEnter: [] }>();

function beforeLeave(element: Element) {
  element.setAttribute("inert", "");
}

function beforeEnter(element: Element) {
  element.removeAttribute("inert");
}
</script>

<template>
  <Transition
    name="feedback-expand"
    @before-enter="beforeEnter"
    @after-enter="emit('afterEnter')"
    @before-leave="beforeLeave"
  >
    <div v-if="show" class="feedback-expand">
      <div class="feedback-content min-h-0">
        <div class="pt-6">
          <slot />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.feedback-expand {
  display: grid;
  grid-template-rows: 1fr;
  opacity: 1;
  transition:
    grid-template-rows 180ms ease,
    opacity 180ms ease;
}

.feedback-expand-enter-active .feedback-content,
.feedback-expand-leave-active .feedback-content {
  overflow: hidden;
}

.feedback-expand-enter-from,
.feedback-expand-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .feedback-expand {
    transition: none;
  }
}
</style>
