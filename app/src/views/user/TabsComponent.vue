<template>
  <div class="m-10 resize overflow-hidden join join-vertical">
    <TabGroup>
      <TabList class="tabs join-item tabs-boxed collapsible-button-group justify-start">
        <Tab v-for="tab in tabs" as="div" :key="tab.id" class="tab gap-2 min-w-0 flex-nowrap collapsible-button">
          <span class="material-icons">{{ tab.iconName }}</span>
          <span class="collapsible-text">{{ tab.label }}</span>
        </Tab>
      </TabList>
      <TabPanels class="join-item p-4 border border-t-0 grow rounded-bl-lg rounded-br-lg">
        <slot />
      </TabPanels>
    </TabGroup>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/vue';

const props = defineProps<{
  tabs: { label: string; id: string; iconName: string }[];
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
.collapsible-button-group {
  container-type: inline-size;
}

.collapsible-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@container (width < 37rem) {
  .collapsible-text {
    display: none;

  }
}
</style>
