<template>
  <div class="flex items-center gap-1">
    <button 
      class="btn btn-xs btn-circle btn-outline"
      @click="showNumberInput = !showNumberInput"
      :title="showNumberInput ? 'Use slider' : 'Edit number'"
    >
      <span class="material-icons text-xs" :aria-label="showNumberInput ? 'slider' : 'number input'">
        {{ showNumberInput ? 'tune' : 'edit' }}
      </span>
    </button>

    <input
      v-if="showNumberInput"
      v-model.number="internalValue"
      type="number"
      :min="min"
      :max="max"
      :step="step"
      class="input input-xs input-bordered w-20 font-mono"
      @blur="hideInput"
      @keyup.enter="hideInput"
      @keyup.esc="hideInput"
    />

    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: number
  min?: number
  max?: number
  step?: number
}>(), {
  min: -Infinity,
  max: Infinity,
  step: 0.01
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const showNumberInput = ref(false)
const internalValue = ref(props.modelValue)

const computedValue = computed({
  get: () => props.modelValue,
  set: (value: number) => emit('update:modelValue', value)
})

watch(() => props.modelValue, (newVal) => {
  internalValue.value = newVal
})

watch(internalValue, (newVal) => {
  emit('update:modelValue', newVal)
})

const hideInput = () => {
  showNumberInput.value = false
}
</script>

<style scoped>
.btn-xs {
  padding: 0.125rem;
  height: 1.5rem;
  min-height: 1.5rem;
}
</style>