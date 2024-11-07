<template>
  <div class="overflow-hidden tabs-wrapper">
    <!-- <div class="debug-box"></div>
    <div class="flex text-sm">
      <div class="bg-blue-400 w-3"></div>
      <div class="bg-blue-800 size-6"></div>
      <div class="bg-blue-300 w-1"></div>
      <div class="bg-blue-800 w-[11ch]">Information</div>
      <div class="bg-blue-200 w-3"></div>
    </div> -->
    <TabGroup :selected-index="currentTab" @change="changeTab">
      <TabList class="tabs tabs-lifted collapsible-button-group">
        <Tab v-for="tab in tabs" as="div" :key="tab.label"
          class="tab [--tab-padding:0.4rem] gap-0.5 min-w-0 flex-nowrap collapsible-button">
          <span class="material-icons">{{ tab.iconName }}</span>
          <span class="collapsible-text">{{ tab.label }}</span>
        </Tab>
        <div class="tab min-w-0 [--tab-padding:0]"></div>
      </TabList>
      <TabPanels class="p-4 border border-t-0 grow rounded-b-lg">
        <slot />
      </TabPanels>
    </TabGroup>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from '@headlessui/vue';
import { useStyleTag } from '@vueuse/core';


const currentTab = defineModel<number>();

const { tabs, breakpointAdjustment = 1.0 } = defineProps<{
  tabs: { label: string; iconName: string }[],
  breakpointAdjustment?: number,
}>();

const containerQueryCss = computed(() => {
  const nrOfChars = tabs.reduce((sum, tab) => {
    return sum + tab.label.length;
  }, 0)
  const nrOfLabels = tabs.length;
  const breakpoint = `calc(${breakpointAdjustment}*(0.75*${nrOfChars}ch + ${nrOfLabels}*(2*0.4rem + 0.25rem + 1.5rem)))`
  return `
    @container (width < ${breakpoint}) {
      .collapsible-text {
        display: none;
      }
  `;
})
const { id, css, load, unload, isLoaded } = useStyleTag(containerQueryCss);

function changeTab(index: number) {
  currentTab.value = index;
};

</script>

<style scoped>
.debug-box {
  --count: 4;
  --chars: 55ch;
  height: 1rem;
  background-color: aqua;
  width: calc(0.75*var(--chars) + var(--count)*(2*0.8rem + 0.25rem + 1.5rem))
}

.tabs-wrapper {
  --breakpoint-width: 37rem;
}
.collapsible-button-group {
  container-type: inline-size;
}

.collapsible-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

</style>
