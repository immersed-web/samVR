<template>
  <div>
    <div role="tablist" class="tabs tabs-boxed">
      <button v-for="(tab, index) in tabs" :key="'button-' + index" role="tab" :id="'tab-' + index"
        :aria-controls="'tabpanel-' + index" :aria-selected="localModelValue === index" @click="selectTab(index)"
        class="tab whitespace-nowrap" :class="{ 'background-small': localModelValue === index }">
        <span v-if="tab.iconName" class="material-icons">{{ tab.iconName }}</span>
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>


    <div class="">
      <div v-for="(tab, index) in tabs" :key="'content-' + index" role="tabpanel" class="" :id="'tabpanel-' + index"
        :aria-labelledby="'tab-' + index">

        {{ console.log('Rendering slot:', tab.slotName) }}
        <slot :name="tab.slotName"></slot>
        {{ console.log(`Innehållet för flik ${index} visas.`) }}
      </div>
    </div>

    <div>
      <TabGroup>
        <Tablist class="tabs tabs-boxed">
          <Tab v-for="(tab, index) in tabs" :key="tab.label" class="tab">{{ tab.label }}</Tab>
        </Tablist>
        <TabPanels>
          <TabPanel v-for="(tab, index) in tabs" :key="tab.label">{{ tab.slotName }}</TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/vue';

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

<style scoped></style>
