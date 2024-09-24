<template>
  <div v-if="options?.length">

    <Combobox v-model="selected" nullable>
      <div ref="comboBoxInputTag" class="input input-bordered input-sm flex gap-2 items-center">
        <ComboboxInput aria-autocomplete="none" autocomplete="one-time-code" class="grow"
          :displayValue="option => option ? option[displayKey] : undefined"
          @change="searchString = $event.target.value; updateDropdownPos()" />
        <button v-if="searchString !== '' || selected" @click="selected = null; searchString = '';"
          class="material-icons">close</button>
        <ComboboxButton @click="updateDropdownPos" popovertarget="options-list" class="material-icons">
          unfold_more
        </ComboboxButton>
      </div>
      <ComboboxOptions popover id="options-list" :style="{ left: left + 'px', top: bottom + 'px', width: width + 'px' }"
        class="menu z-50 rounded-box flex-nowrap max-h-32 bg-base-200">
        <ComboboxOption v-for="option in filteredOptions" as="template" :key="option[idKey]" :value="option"
          v-slot="{ selected, active }">
          <li class="select-none flex gap-2" :class="{
            'active': active,
          }">
            <a class="grow truncate" :class="{ 'active': selected, 'focus': active }">
              {{ option[displayKey] }}
            </a>
            <!-- <span v-if="selected" class="material-icons" :class="{ 'focus': active }">
                            check
                          </span> -->
          </li>
        </ComboboxOption>
      </ComboboxOptions>
    </Combobox>
    <!-- <pre>{{ searchString }}</pre> -->
    <!-- <pre>{{ selected }}</pre> -->
    <!-- <pre>{{ bottom }}</pre> -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  Combobox,
  ComboboxInput,
  ComboboxButton,
  ComboboxOptions,
  ComboboxOption,
} from '@headlessui/vue'
import { useElementBounding } from '@vueuse/core';

const comboBoxInputTag = ref<HTMLInputElement>();
const { bottom, left, width, update: updateElementBounding } = useElementBounding(comboBoxInputTag, {
});

function updateDropdownPos() {
  // console.log('updating dropdown pos');
  updateElementBounding();
}

// watch(bottom, newBottom => console.log(newBottom));

const selected = defineModel()

// type Option = {
//   id: string | number,
//   value: unknown
// }
// type Option<T extends {[typeof IdKey]: unknown, [typeof DisplayKey]: unknown}> = T;
const props = withDefaults(defineProps<{
  displayKey?: string,
  idKey?: string,
  options: unknown[],
}>(), {
  displayKey: 'value',
  idKey: 'id',
});

// const options = [
//   { id: 1, value: 'Wade Cooper' },
//   { id: 2, value: 'Arlene Mccoy' },
//   { id: 3, value: 'Devon Webb' },
//   { id: 4, value: 'Tom Cook' },
//   { id: 5, value: 'Tanya Fox' },
//   { id: 6, value: 'Hellen Schmidt' },
// ]

// const options = computed(() => {
//   return props.options
// })

// let selected = ref(props.options[0])
let searchString = ref('')

let filteredOptions = computed(() => {
  const options = props.options
  if (options.length === 0) return [];
  return searchString.value === ''
    ? options
    : options.filter((option) =>
      option[props.displayKey]
        .toLowerCase()
        .replace(/\s+/g, '')
        .includes(searchString.value.toLowerCase().replace(/\s+/g, ''))
    )
})
</script>
