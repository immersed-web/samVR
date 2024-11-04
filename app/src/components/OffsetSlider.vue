<template>
  <!-- <div class="tooltip" :data-tip="modelValue"> -->
  <input class="accent-primary" type="range" :step="props.step" :min="currentMin" :max="currentMax"
    :value="localModelValue" @input="onInput" @change="onChange">
  <!-- </div> -->
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = withDefaults(defineProps<{
  modelValue: number
  step?: number
  offset?: number
  inverted?: boolean
}>(), {
  step: 0.01,
  offset: 3.0,
  inverted: false
});

function onInput(event: Event) {
  const target = event.target as HTMLInputElement;
  let value = target.valueAsNumber;
  // console.log('input callback:', value, event);
  localModelValue.value = value;

  if (props.inverted) {
    value = -value
  }
  emit('update:modelValue', value);
}

// let valueBeforeChange = ref(props.modelValue);
function onChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = target.valueAsNumber;
  // console.log('change callback:', value, event);
  // valueBeforeChange.value = value;
  updateMinMax();
}

const localModelValue = ref(props.inverted ? -props.modelValue : props.modelValue);

watch(() => props.modelValue, (newModelValue) => {
  // return;
  // console.log('watcher trigger: ', newModelValue);
  if (props.inverted) {
    newModelValue = -newModelValue;
  }
  if (newModelValue !== localModelValue.value) {
    localModelValue.value = newModelValue;
    console.log('parent updated the v-model');
    updateMinMax();
  } else {
    localModelValue.value = newModelValue;
  }

});
const emit = defineEmits<{
  'update:modelValue': [value: number]
}>();

const currentMin = ref(localModelValue.value - (props.offset));
const currentMax = ref(localModelValue.value + props.offset);
function updateMinMax() {
  const newMax = localModelValue.value + (props.offset);
  const newMin = localModelValue.value - (props.offset);
  currentMin.value = newMin;
  currentMax.value = newMax;
}
</script>
<style lang="css" scoped>
.inverted {
  direction: rtl;
}
</style>