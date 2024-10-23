<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

import { oculusButtons } from '@/composables/vrSpaceComposables';

import { useVrSpaceStore } from '@/stores/vrSpaceStore';

import EmojiSelf from '@/components/lobby/EmojiSelf.vue';
import SpriteRender from '@/components/lobby/SpriteRenderer.vue';

import emojiSheet from '@/assets/sprite-128.png';

import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from '@headlessui/vue';
import { cameraAttacher, leftHandVRGui, overlayGUILeft } from '@/composables/teleportTargets';

const vrSpaceStore = useVrSpaceStore();

type Coords2D = [number, number]

const props = defineProps<{
  uvs: Coords2D,
  coords: Array<Array<[number, number]>>,
  columns: number
}>();

const emit = defineEmits<{
  change: [coords: Coords2D, active: boolean]
}>();

const coordsFlat = computed(() => {
  return props.coords.flat(1);
});

const selectedCoords = ref<Coords2D>(coordsFlat.value[0]);
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

function selectEmojiVR(coords: Coords2D) {
  console.log('Select emoji VR', coords);
  selectedCoords.value = coords;
  onEmojiSelected();
}

function emitChange() {
  if (active.value) {
    vrSpaceStore.ownRealtimeData.emoji = { active: true, coords: selectedCoords.value };
  }
  else {
    vrSpaceStore.ownRealtimeData.emoji = { active: false };

  }
  // emit('change', selectedCoords.value, active.value);
}

const leftHand = ref<HTMLElement | null>(null);
onMounted(() => {
  leftHand.value = document.getElementById('teleport-target-aframe-hand-left');
  console.log(leftHand.value);
});

</script>

<template>
  <div>
    <!-- #region Emoji picker for monitor -->
    <!-- HeadlessUI Listbox -->
    <Teleport v-if="overlayGUILeft" :to="overlayGUILeft">
      <div class="pointer-events-auto">
        <Listbox v-model="selectedCoords" @update:model-value="onEmojiSelected" class="tooltip tooltip-right"
          data-tip="Pick an emoji to display for other users">
          <div class="relative mt-1">
            <ListboxButton
              class="relative rounded-lg bg-white py-2 pl-4 pr-4 text-left shadow-md focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-300 sm:text-sm">
              <SpriteRender v-if="selectedCoords" class="sprite" :sheet-url="emojiSheet" :uvs="uvs"
                :coords="selectedCoords" :class="{ 'opacity-75': !active, 'transition': !active }" />
            </ListboxButton>


            <ListboxOptions
              class="absolute mt-1 max-h-60 overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm">
              <ListboxOption v-for="(coords, i) in coordsFlat" :key="i" :value="coords">
                <li :class="[
                  coords.toString() === selectedCoords.toString() ? 'bg-slate-300' : 'bg-white',
                  'relative cursor-pointer select-none py-2 pl-4 pr-4']">
                  <SpriteRender class="sprite" :sheet-url="emojiSheet" :uvs="uvs" :coords="coords" />
                </li>
              </ListboxOption>
            </ListboxOptions>
          </div>
        </Listbox>
      </div>
    </Teleport>
    <!-- #endregion -->

    <!-- #region Emoji picker for VR/hand controls -->
    <Teleport v-if="leftHandVRGui" :to="leftHandVRGui">
      <a-entity :visible="oculusButtons.x" position="0 0.1 0"
        mesh-ui-block="backgroundOpacity: 0.2; contentDirection: column; fontSize: 0.03;" class="">
        <a-entity v-for="(coordsGroup, iCg) in coords" :key="iCg"
          mesh-ui-block="backgroundOpacity: 0; contentDirection: row; textAlign: left;">
          <template v-for="(coords, iC) in coordsGroup" :key="iC">
            <a-entity mesh-ui-block="backgroundOpacity: 0; width: 0.05; height: 0.05; margin: 0.01;" class="clickable"
              @click="selectEmojiVR(coords)">
              <a-entity ref="emoji" position="0 0 0.01">
                <a-entity
                  :atlas-uvs="'totalRows: 43; totalColumns: 43; column: ' + coords[0] + '; row: ' + coords[1] + ';'"
                  :material="`src: ${emojiSheet}; transparent: true; shader: flat;`"
                  geometry="primitive: plane; width: 0.05; height: 0.05; buffer: true; skipCache: true" />
              </a-entity>
            </a-entity>
          </template>
        </a-entity>
      </a-entity>
    </Teleport>
    <!-- #endregion -->

    <Teleport v-if="cameraAttacher" :to="cameraAttacher">
      <EmojiSelf :sheet-url="emojiSheet" :coords="selectedCoords" :active="active" />
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
