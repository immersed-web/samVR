<template>
  <div>
    <div role="tablist" class="tabs tabs-bordered">
      <button v-for="(tab, index) in tabs" :key="'button-' + index" role="tab" :id="'tab' + index"
        :aria-controls="'tabpanel' + index" :aria-selected="localModelValue === index" @click="selectTab(index)"
        class="tab whitespace-nowrap" :class="{ 'background-small': localModelValue === index }">
        <span v-if="tab.iconName" class="material-icons">{{ tab.iconName }}</span>
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>


    <div class="tab-content">
      <div v-for="(tab, index) in tabs" :key="'content-' + index" v-if="localModelValue === index" role="tabpanel"
        class="tab-content p-1" :id="'tabpanel' + index" :aria-labelledby="'tab' + index">

        {{ console.log('Rendering slot:', tab.slotName) }}
        <slot :name="tab.slotName"></slot>
        {{ console.log(`Innehållet för flik ${index} visas.`) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  name: string;
  tabs: { label: string; slotName: string; iconName: string }[];
  modelValue: number;
}>();

const localModelValue = ref(props.modelValue);
const emit = defineEmits(['update:modelValue']);

const selectTab = (index: number) => {
  localModelValue.value = index;
  emit('update:modelValue', index);
};

watch(() => props.modelValue, (newVal) => {
  localModelValue.value = newVal;
});
</script>

<style scoped>
.tab-active {
  background-color: #3b82f6;
  color: white;
}

.tab-content {
  margin-top: 1rem;
  padding: 1rem;
  background-color: #f3f4f6;
}

.tabs {
  display: flex;
  gap: 0.5rem;
}

.tab {
  padding: 0.5rem 1rem;
}

.material-icons {
  font-size: 1.5rem;
}
</style>
