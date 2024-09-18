<template>
  <div class="collapse">
    <input type="radio" name="my-accordion-1" checked="checked" />
    <div class="collapse-title text-xl font-medium">Click to open this one and close others</div>
    <div class="relative collapse-content">
      <pre>{{ left }}, {{ bottom }}, {{ width }}</pre>
      <Combobox v-model="selected">
        <div ref="comboBoxInputTag" class="input input-bordered input-sm flex gap-2 items-center">
          <ComboboxInput class="grow" :displayValue="(person) => person.name" @change="query = $event.target.value" />
          <ComboboxButton popovertarget="options-list" class="material-icons">
            unfold_more
          </ComboboxButton>
        </div>
        <ComboboxOptions popover id="options-list"
          :style="{ left: left + 'px', top: bottom + 'px', width: width + 'px' }"
          class="menu z-50 rounded-box flex-nowrap max-h-32 bg-base-200">
          <!-- <div v-if="filteredPeople.length === 0 && query !== ''"
            class="cursor-default select-none px-4 py-2 text-gray-700">
            Nothing found.
          </div> -->

          <ComboboxOption v-for="person in filteredPeople" as="template" :key="person.id" :value="person"
            v-slot="{ selected, active }">
            <li class="select-none flex gap-2" :class="{
              'active': active,
            }">
              <a class="grow truncate" :class="{ 'active': selected, 'focus': active }">
                {{ person.name }}
              </a>
              <!-- <span v-if="selected" class="material-icons" :class="{ 'focus': active }">
                            check
                          </span> -->
            </li>
          </ComboboxOption>
        </ComboboxOptions>
      </Combobox>
    </div>
  </div>
  <div class="bg-blue-600 h-12"></div>
  <div class="collapse">
    <input class="bg-red-600" type="radio" name="my-accordion-1" />
    <div class="collapse-title text-xl font-medium">Click to open this one and close others</div>
    <div class="collapse-content overflow-visible z-50">
      <ul class="menu max-h-32 overflow-auto flex-nowrap bg-base-200 rounded-box">
        <li class="" v-for="person in people" :key="person.id"><a>
            {{ person.name }}
          </a>
        </li>
      </ul>
    </div>
  </div>
  <div class="collapse">
    <input type="radio" name="my-accordion-1" />
    <div class="collapse-title text-xl font-medium">Click to open this one and close others</div>
    <div class="collapse-content">
      <p>hello</p>
    </div>
  </div>
  <div class="h-screen bg-slate-600"></div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Combobox,
  ComboboxInput,
  ComboboxButton,
  ComboboxOptions,
  ComboboxOption,
} from '@headlessui/vue'
import { useElementBounding } from '@vueuse/core';

const comboBoxInputTag = ref(null);
const { bottom, left, width } = useElementBounding(comboBoxInputTag);

const people = [
  { id: 1, name: 'Wade Cooper' },
  { id: 2, name: 'Arlene Mccoy' },
  { id: 3, name: 'Devon Webb' },
  { id: 4, name: 'Tom Cook' },
  { id: 5, name: 'Tanya Fox' },
  { id: 6, name: 'Hellen Schmidt' },
]

let selected = ref(people[0])
let query = ref('')

let filteredPeople = computed(() =>
  query.value === ''
    ? people
    : people.filter((person) =>
      person.name
        .toLowerCase()
        .replace(/\s+/g, '')
        .includes(query.value.toLowerCase().replace(/\s+/g, ''))
    )
)
</script>
