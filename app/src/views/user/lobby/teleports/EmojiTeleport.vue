<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

import { oculusButtons } from '@/composables/lobbyUtils';

import EmojiSelf from '@/components/lobby/EmojiSelf.vue';
import SpriteRender from '@/components/lobby/SpriteRenderer.vue';

import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from '@headlessui/vue';

type Tuple = [number, number]

const props = defineProps<{
  sheetUrl: string,
  uvs: Tuple,
  coords: Array<Array<Tuple>>,
  columns: number
}>();

const emit = defineEmits<{
  change: [coords: Tuple, active: boolean]
}>();

const coordsFlat = computed(() => {
  return props.coords.flat(1);
});

const selectedCoords = ref<Tuple>(coordsFlat.value[0]);
const active = ref(false);

const timeout = ref(-1);
function onEmojiSelected() {
  active.value = true;
  emitChange();
  clearTimeout(timeout.value);
  timeout.value = window.setTimeout(() => {
    active.value = false;
    emitChange();
  }, 10000);
}

function selectEmoji(coords: Tuple) {
  console.log('Select emoji VR', coords);
  selectedCoords.value = coords;
  onEmojiSelected();
}

function emitChange() {
  emit('change', selectedCoords.value, active.value);
}

const leftHand = ref<HTMLElement | null>(null);
onMounted(() => {
  leftHand.value = document.getElementById('tp-aframe-hand-left');
  console.log(leftHand.value);
});

</script>

<template>
  <div>
    <!-- #region Emoji picker for monitor -->
    <!-- HeadlessUI Listbox -->
    <Teleport to="#tp-ui-left">
      <div>
        <Listbox v-model="selectedCoords" @update:model-value="onEmojiSelected">
          <div class="relative mt-1">
            <ListboxButton
              class="relative rounded-lg bg-white py-2 pl-4 pr-4 text-left shadow-md focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-300 sm:text-sm">
              <SpriteRender v-if="selectedCoords" class="sprite" :sheet-url="sheetUrl" :uvs="uvs"
                :coords="selectedCoords" :class="{ 'opacity-75': !active, 'transition': !active }" />
            </ListboxButton>


            <ListboxOptions
              class="absolute mt-1 max-h-60 overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm">
              <ListboxOption v-for="(coords, i) in coordsFlat" :key="i" :value="coords">
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
    </Teleport>
    <!-- #endregion -->

    <!-- #region Emoji picker for VR/hand controls -->
    <Teleport v-if="oculusButtons.x" to="#tp-aframe-hand-left">
      <a-entity position="0 0.1 0" mesh-ui-block="backgroundOpacity: 0.2; contentDirection: column; fontSize: 0.03;"
        class="">
        <a-entity v-for="(coordsGroup, iCg) in coords" :key="iCg"
          mesh-ui-block="backgroundOpacity: 0; contentDirection: row; textAlign: left;">
          <template v-for="(coords, iC) in coordsGroup" :key="iC">
            <a-entity mesh-ui-block="backgroundOpacity: 0; width: 0.05; height: 0.05; margin: 0.01;" class="clickable"
              @click="selectEmoji(coords)">
              <a-entity ref="emoji" position="0 0 0.01">
                <a-entity
                  :atlas-uvs="'totalRows: 43; totalColumns: 43; column: ' + coords[0] + '; row: ' + coords[1] + ';'"
                  :material="`src: ${sheetUrl}; transparent: true; shader: flat;`"
                  geometry="primitive: plane; width: 0.05; height: 0.05; buffer: true; skipCache: true" />
              </a-entity>
            </a-entity>
          </template>
        </a-entity>
      </a-entity>
    </Teleport>
    <!-- #endregion -->

    <Teleport to="#tp-aframe-camera">
      <EmojiSelf :sheet-url="sheetUrl" :coords="selectedCoords" :active="active" />
    </Teleport>
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
