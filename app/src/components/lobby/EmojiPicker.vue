<script setup lang="ts">
import { type Ref, ref } from 'vue';

import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'

import SpriteRender from '@/components/SpriteRenderer.vue'

import {
  Listbox,
  ListboxLabel,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from '@headlessui/vue'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/vue/20/solid'

type Tuple = [number, number]

const props = defineProps<{
  sheetUrl: string,
  uvs: Tuple,
  coords: Array<Tuple>,
}>()

const emit = defineEmits<{
  change: [coords: Tuple, active: boolean]
}>()

const selectedCoords = ref<Tuple>(props.coords[0])
const active = ref(false)

const timeout = ref(-1)
function onEmojiSelected() {
  active.value = true
  emitChange()
  clearTimeout(timeout.value)
  timeout.value = window.setTimeout(() => {
    active.value = false
    emitChange()
  }, 10000)
}

function emitChange() {
  emit('change', selectedCoords.value, active.value)
}

</script>

<template>
  <div>

    <!-- #region UI monitor -->
    <!-- HeadlessUI Listbox -->
    <div class="w-auto">
      <Listbox v-model="selectedCoords" @update:model-value="onEmojiSelected">
        <div class="relative mt-1">
          <ListboxButton
            class="relative w-full cursor-default rounded-lg bg-white py-2 pl-4 pr-4 text-left shadow-md focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-300 sm:text-sm">
            <SpriteRender v-if="selectedCoords" class="sprite" :sheet-url="sheetUrl" :uvs="uvs" :coords="selectedCoords"
              :class="{ 'opacity-75': !active, 'transition': !active }" />
          </ListboxButton>


          <ListboxOptions
            class="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm">
            <ListboxOption v-for="(coords, i) in props.coords" :key="i" :value="coords">
              <li :class="[
                coords.toString() === selectedCoords.toString() ? 'bg-slate-300' : 'bg-white',
  'relative cursor-pointer select-none py-2 pl-4 pr-4']">
                <SpriteRender class="sprite" :sheet-url="sheetUrl" :uvs="uvs" :coords="coords" />
              </li>
            </ListboxOption>
          </ListboxOptions>
        </div>
      </Listbox>
    </div>
    <!-- #endregion -->

  </div>
</template>

<style scoped>
.sprite {
  width: 50px;
  height: 50px;
}

.transition {
  transition: 1s linear;
}
</style>