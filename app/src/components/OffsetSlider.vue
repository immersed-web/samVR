<template>
  <input class="accent-primary" type="range" :step="props.steps" :min="currentMin" :max="currentMax"
    :value="localModelValue" @input="onInput" @change="updateMinMax">
</template>
<script setup lang="ts">
import { ref, watch } from 'vue';


function onInput(event: Event) {
  // console.log(event);
  const target = event.target as HTMLInputElement;
  const value = target.valueAsNumber;
  localModelValue.value = value;
  emit('update:modelValue', value);
}


const props = withDefaults(defineProps<{
  modelValue: number
  steps?: number
  offset?: number
  // offsetType?: 'absolute' | 'relative'
}>(), {
  steps: 0.1,
  offset: 3.0,
  // offsetType: 'relative'
});

const localModelValue = ref(props.modelValue);

watch(() => props.modelValue, (newModelValue) => {
  // console.log('watcher trigger: ', newModelValue);
  if (newModelValue !== localModelValue.value) {
    // console.log('parent updated the v-model');
    updateMinMax();
  }
  localModelValue.value = newModelValue;

});
const emit = defineEmits<{
  'update:modelValue': [value: number]
}>();

const currentMin = ref(props.modelValue - props.offset);
const currentMax = ref(props.modelValue + props.offset);
function updateMinMax() {
  // if (props.offsetType === 'absolute') {
  const newMax = props.modelValue + props.offset;
  const newMin = props.modelValue - props.offset;
  // } 
  // else  {
  //   const newMax = modelValue.value + props.offset * modelValue.value;
  //   const newMin = modelValue.value - props.offset * modelValue.value;
  // }

  currentMin.value = newMin;
  currentMax.value = newMax;
}
</script>