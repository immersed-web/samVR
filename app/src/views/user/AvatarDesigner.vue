<script setup lang="ts">
import { ref, type Ref, reactive, onBeforeMount, watch, onMounted } from 'vue';
import { type Entity } from 'aframe';
import { stringify, parse } from 'devalue';

import UIOverlay from '@/components/UIOverlay.vue';
import PopUp from '@/components/PopUp.vue';

import {
  Listbox,
  ListboxLabel,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from '@headlessui/vue';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';


import { Vue3ColorPicker } from '@cyhnkckali/vue3-color-picker';
import '@cyhnkckali/vue3-color-picker/dist/style.css';
import WaitForAframe from '@/components/WaitForAframe.vue';
import { avatarAssets, type AvatarDesign, defaultAvatarDesign } from 'schemas';

import { useConnectionStore } from '@/stores/connectionStore';

const connectionStore = useConnectionStore();

onMounted(() => {
  loadAvatarFromStorage();
});

// const avatarAssets = {
//   hands: ['hands_basic_left'],
//   heads: ['heads_basic'],
//   torsos: ['torsos_basic_male'],
//   eyes: ['eyes_huge', 'eyes_relaxed', 'eyes_cool', 'eyes_kind', 'eyes_round', 'eyes_npc'],
//   eyebrows: ['eyebrows_brookie', 'eyebrows_innocent', 'eyebrows_reynolds', 'eyebrows_tyler', 'eyebrows_npc', undefined],
//   mouths: ['mouth_polite_smile', 'mouth_prettypolite_smile', 'mouth_npc'],
//   hair: ['hair_ponytail', 'hair_multicolor', 'hair_thick_buzzcut', 'hair_cool', 'hair_kevin', 'hair_wolf', undefined],
//   facialhair: [undefined, 'facialhair_almond', 'facialhair_bigboi', 'facialhair_curled', 'facialhair_johnny', 'facialhair_laotzu'],
//   clothes: ['clothes_poloshirt', 'clothes_button_dress', 'clothes_casual_dress', 'clothes_fancy_dress', 'clothes_tshirt', 'clothes_turtleneck', 'clothes_vneck', undefined],
//   accessories: [undefined, 'accessories_cateye', 'accessories_round', 'accessories_square'],
//   jewelry: [undefined, 'jewelry_pearl', 'jewelry_diamond', 'jewelry_diamond2', 'jewelry_diamond3', 'jewelry_sparkling_hoopdrop_gold', 'jewelry_sparkling_hoopdrop_silver', 'jewelry_diamond_tripple', 'jewelry_hoopdroop_gold', 'jewelry_hoopdroop_silver', 'jewelry_pearl_tripple', 'jewelry_star_tripple_gold', 'jewelry_star_tripple_silver'],
//   layer: [undefined, 'layer_lowrider', 'layer_safari']
// } as const;

// console.log(avatarAssets);
// console.log(avatarAssetSchemaVersion);

const skinParts = ['hands', 'heads', 'torsos'];


// const currentAvatarSettings = reactive<AvatarDesign>({ skinColor: '', parts: Object.fromEntries(Object.entries(avatarAssets).map(([k, p]) => [k as keyof typeof avatarAssets, { model: p[0], colors: [] }])) })
const currentAvatarSettings = reactive<AvatarDesign>(defaultAvatarDesign);

watch(() => currentAvatarSettings, () => saveAvatarSettingsToStorage(), { deep: true });
function saveAvatarSettingsToStorage() {
  console.log('avatarSettings before save:', currentAvatarSettings);
  // window.localStorage.setItem('avatarSettings', JSON.stringify(currentAvatarSettings));
  window.localStorage.setItem('avatarSettings', stringify(currentAvatarSettings));
  connectionStore.client.user.updateAvatarDesign.mutate(currentAvatarSettings);
}

function loadAvatarFromStorage() {
  const loadedString = localStorage.getItem('avatarSettings');
  if (!loadedString) {
    console.error('failed to load from localstorage');
    return;
  }
  const parsedAvatarSettings = parse(loadedString);
  currentAvatarSettings.parts = parsedAvatarSettings.parts;
  currentAvatarSettings.skinColor = parsedAvatarSettings.skinColor;
  console.log("Loaded skin color", parsedAvatarSettings.skinColor);
  if (parsedAvatarSettings.skinColor) {
    skinColorIsActive.value = true
    currentSkinColor.value = parsedAvatarSettings.skinColor
  }
  console.log("Loaded parts", parsedAvatarSettings.parts)
  // parsedAvatarSettings.parts.forEach(part => {
  //   console.log(part, part.colors)
  // });
  // for (const [key, value] of Object.entries(parsedAvatarSettings.parts)) {
  //   console.log(key, value, partsNrOfColors[key]);
  // }

}

const currentColorSettings = reactive(Object.fromEntries(Object.keys(avatarAssets).map((k) => [k as keyof typeof avatarAssets, []])));
const customColorsIsActive = reactive(Object.fromEntries(Object.keys(avatarAssets).map(k => [k, [false, false]])));
const currentSkinColor = ref('');
const skinColorIsActive = ref(false);

// watch(customColorsIsActive, (newV, oldV) => {
//   console.log(newV);
// }, { deep: true });

function onColorPicked(part: string, colorIdx: number, color: string) {
  console.log('color picked', part, colorIdx, color);
  currentAvatarSettings.parts[part].colors[colorIdx] = color;
  customColorsIsActive[part][colorIdx] = true;
}

function setDefaultColors(part: string, colors) {
  if (!currentAvatarSettings.parts[part].colors.length) {

  }
}

watch([skinColorIsActive, currentSkinColor], ([active, newColor]) => {
  console.log("Changed skin color", newColor)
  if (!active || !currentSkinColor.value) {
    currentAvatarSettings.skinColor = '';
  } else {
    currentAvatarSettings.skinColor = newColor;
  }
});

function onCustomColorActiveChanged(part: string, colorIdx: number, active: boolean) {
  console.log(avatarAssets);
  console.log(active, currentAvatarSettings.parts[part].colors[colorIdx]);
  if (!active || !currentColorSettings[part][colorIdx]) {
    currentAvatarSettings.parts[part].colors[colorIdx] = '';
  } else {
    currentAvatarSettings.parts[part].colors[colorIdx] = currentColorSettings[part][colorIdx];
  }
}

const mouthFlipAssets = ref(['flip_a_e_i', 'flip_b_m_p', 'flip_c_d_n_s_t_x_y_z', 'flip_e', 'flip_f_v', 'flip_i_ch_sh', 'flip_l', 'flip_o', 'flip_r', 'flip_th', 'flip_u']);

const partsNrOfColors = reactive(Object.fromEntries(Object.keys(avatarAssets).map(k => [k, 0])));
function setNrOfCustomColors(part: string, evt: CustomEvent) {
  console.log('setNrOfCustomColors', evt, part);
  const entity = evt.target as Entity;
  const nrOfColors = entity.components['model-color'].nrOfCustomColors;
  console.log(part, nrOfColors, entity.components['model-color']);
  partsNrOfColors[part] = nrOfColors;
  for (const [key, value] of Object.entries(currentAvatarSettings.parts)) {
    console.log(key, value, partsNrOfColors[key]);
    for (let i = 0; i < partsNrOfColors[key]; i++) {
      console.log(currentAvatarSettings.parts[key].colors[i])
      currentColorSettings[key][i] = currentAvatarSettings.parts[key].colors[i]
      if (currentAvatarSettings.parts[key].colors[i]) {
        customColorsIsActive[key][i] = true;
      }
    }
  }
}

function changeClothingIdx(partType: keyof typeof avatarAssets, offset: number) {
  const partList = avatarAssets[partType];
  const l = avatarAssets[partType].length;
  const modelName = currentAvatarSettings.parts[partType].model;
  // @ts-ignore
  let idx = partList.indexOf(modelName);
  if (idx === -1) {
    console.warn('no idx for that modelName');
    idx = 0;
  }
  console.log(idx);
  const newIdx = (idx + offset + l) % l;
  console.log(newIdx);
  const newModelName = partList[newIdx];
  console.log(newModelName);
  currentAvatarSettings.parts[partType].model = newModelName;
}

const popupSkin = ref<InstanceType<typeof PopUp> | null>(null);
const popupParts = ref<InstanceType<typeof PopUp> | null>(null);
const popupPartsKeys = ref<{ part: string, cIdx: number } | null>(null);

function openPopupParts(evt: Event, part: string, cIdx: number) {
  popupParts.value?.open(evt);
  popupPartsKeys.value = { part, cIdx };
}

</script>

<template>
  <WaitForAframe>
    <div class="grid grid-cols-2 gap-2">
      <!-- COLUMN 1 -->
      <div>
        <div
          class="overflow-y-auto justify-center items-center pointer-events-auto join join-vertical bg-slate-200 p-2">
          <div class="join-item w-full">
            <div class="grid grid-cols-3 items-center gap-2">
              <span class="label-text text-capitalize font-semibold">Skin color</span>
              <div></div>
              <div>
                <button class="btn btn-xs btn-circle btn-outline"
                  :style="{ 'background': skinColorIsActive ? currentSkinColor : 'transparent' }"
                  @click="popupSkin.open">
                  <svg v-if="!skinColorIsActive" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"
                    fill="currentColor" class="size-5">
                    <path fill-rule="evenodd"
                      d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z"
                      clip-rule="evenodd" />
                    <path
                      d="m10.748 13.93 2.523 2.523a9.987 9.987 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z" />
                  </svg>
                </button>
                <PopUp ref="popupSkin" class="bg-white rounded-xl">
                  <Vue3ColorPicker v-model="currentSkinColor" :show-picker-mode="false"
                    @update:model-value="skinColorIsActive = true" mode="solid" input-type="RGB" type="HEX"
                    :show-color-list="false" :show-alpha="false" :show-eye-drop="false" :show-input-menu="false"
                    :show-input-set="false" />
                  <label class="label cursor-pointer">
                    <span class="label-text">Color active</span>
                    <input type="checkbox" class="toggle"
                      :style="{ 'background-color': skinColorIsActive ? currentSkinColor : 'grey' }"
                      v-model="skinColorIsActive">
                  </label>
                </PopUp>
              </div>
            </div>
            <div class="divider m-0" />
          </div>
          <template v-for="(partsList, key) in avatarAssets" :key="key">
            <template v-if="avatarAssets[key].length > 1">
              <div class="join-item w-full">
                <div class="grid grid-cols-3 items-center gap-2">
                  <span class="label-text text-capitalize font-semibold">{{ key }}</span>
                  <div class="flex bg-white join join-horizontal h-full items-stretch">
                    <button @click="changeClothingIdx(key, -1)"
                      class="text-slate-700 pl-2 pr-2  hover:bg-slate-200 m-0 join-item">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-5">
                        <path fill-rule="evenodd"
                          d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
                          clip-rule="evenodd" />
                      </svg>
                    </button>
                    <Listbox v-model="currentAvatarSettings.parts[key].model" class="w-36">
                      <div class="relative mt-1">
                        <ListboxButton
                          class="relative w-full cursor-default bg-white py-2 pl-3 pr-10 text-left focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-300 sm:text-sm">
                          <span class="block truncate capitalize">{{
                            currentAvatarSettings.parts[key].model?.split("_").slice(1).join(" ") || "None" }}</span>
                          <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                            <!-- <ChevronUpDownIcon class="h-5 w-5 text-gray-400" aria-hidden="true" /> -->
                          </span>
                        </ListboxButton>

                        <Transition leave-active-class="transition duration-100 ease-in" leave-from-class="opacity-100"
                          leave-to-class="opacity-0">
                          <ListboxOptions
                            class="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm z-10">
                            <ListboxOption v-slot="{ active, selected }" v-for="asset in avatarAssets[key]" :key="asset"
                              :value="asset" as="template">
                              <li :class="[
                                active ? 'bg-amber-100 text-amber-900' : 'text-gray-900',
                                'relative cursor-default select-none py-2 pl-10 pr-4',
                              ]">
                                <span class="capitalize" :class="[
                                  selected ? 'font-medium' : 'font-normal',
                                  'block truncate',
                                ]">{{ asset?.split("_").slice(1).join(" ") || "None" }}</span>
                                <span v-if="selected"
                                  class="absolute inset-y-0 left-0 flex items-center pl-3 text-amber-600">
                                  <!-- <CheckIcon class="h-5 w-5" aria-hidden="true" /> -->
                                </span>
                              </li>
                            </ListboxOption>
                          </ListboxOptions>
                        </Transition>
                      </div>
                    </Listbox>

                    <button @click="changeClothingIdx(key, 1)"
                      class="text-slate-700 pl-2 pr-2 hover:bg-slate-200 m-0 h-full join-item">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-5">
                        <path fill-rule="evenodd"
                          d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
                          clip-rule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  <div class="flex gap-2">
                    <template v-for="(_v, cIdx) in partsNrOfColors[key]" :key="cIdx">
                      <button class="btn btn-xs btn-circle btn-outline"
                        :style="{ 'background': customColorsIsActive[key][cIdx] ? currentColorSettings[key][cIdx] : 'transparent' }"
                        @click="openPopupParts($event, key, cIdx)">
                        <svg v-if="!customColorsIsActive[key][cIdx]" xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20" fill="currentColor" class="size-5">
                          <path fill-rule="evenodd"
                            d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z"
                            clip-rule="evenodd" />
                          <path
                            d="m10.748 13.93 2.523 2.523a9.987 9.987 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z" />
                        </svg>
                      </button>
                    </template>
                  </div>
                </div>
                <div class="divider m-0" />
              </div>
            </template>
          </template>
          <PopUp ref="popupParts" class="bg-white rounded-xl">
            <Vue3ColorPicker v-model="currentColorSettings[popupPartsKeys!.part][popupPartsKeys!.cIdx]"
              :show-picker-mode="false"
              @update:model-value="onColorPicked(popupPartsKeys!.part, popupPartsKeys!.cIdx, currentColorSettings[popupPartsKeys!.part][popupPartsKeys!.cIdx])"
              mode="solid" input-type="RGB" type="HEX" :show-color-list="false" :show-alpha="false"
              :show-eye-drop="false" :show-input-menu="false" :show-input-set="false" />

            <label class="label cursor-pointer">
              <span class="label-text">Color active</span>
              <input type="checkbox" class="toggle"
                :style="{ 'background-color': customColorsIsActive[popupPartsKeys!.part][popupPartsKeys!.cIdx] ? currentColorSettings[popupPartsKeys!.part][popupPartsKeys!.cIdx] : 'grey' }"
                v-model="customColorsIsActive[popupPartsKeys!.part][popupPartsKeys!.cIdx]"
                @change="onCustomColorActiveChanged(popupPartsKeys!.part, popupPartsKeys!.cIdx, customColorsIsActive[popupPartsKeys!.part][popupPartsKeys!.cIdx])">
            </label>
          </PopUp>
        </div>

        <!-- <div class="flex gap-4 mt-2">
          <button class="p-3 text-white rounded-xl bg-slate-800" @click="saveAvatarSettingsToStorage">save</button>
          <button class="p-3 text-white rounded-xl bg-slate-800" @click="loadAvatarFromStorage">load</button>
        </div> -->
      </div>

      <!-- <div class="absolute top-0 right-0 z-50 h-screen p-10 overflow-y-scroll">
      <pre class="text-xs">{{ currentColorSettings }}</pre>
      <pre class="text-xs">{{ currentAvatarSettings }}</pre>
    </div> -->

      <!-- RIGHT COLUMN -->
      <div>
        <a-scene embedded ref="sceneTag" cursor="fuse:false; rayOrigin:mouse;" raycaster="objects: .clickable"
          xr-mode-ui="enabled: false;">
          <a-assets v-once timeout="25000">
            <template v-for="(fileNames, prop) in avatarAssets" :key="prop">
              <a-asset-item :id="`${prop}-${idx}`" v-for="(fileName, idx) in fileNames" :key="fileName"
                :src="`/avatar/${prop}/${fileName}.glb`" />
            </template>
          </a-assets>
          <a-entity camera look-controls="enabled: false" camera-controls />
          <a-sky color="skyblue" />
          <a-entity laser-controls="hand: left" raycaster="objects: .clickable" />
          <a-entity laser-controls="hand: right" raycaster="objects: .clickable" />


          <a-entity position="0 0.2 0">
            <template v-for="(modelSetting, key) in currentAvatarSettings.parts" :key="key">
              <template v-if="modelSetting.model">
                <template v-if="skinParts.includes(key)">
                  <a-gltf-model make-gltf-swappable
                    :src="`#${key}-${avatarAssets[key as keyof typeof avatarAssets].indexOf(modelSetting.model)}`"
                    :model-color="`colors: ${currentAvatarSettings.skinColor ?? ''}; materialName: skin`" />
                  <a-gltf-model v-if="key === 'hands' && modelSetting.model" make-gltf-swappable
                    :src="`#${key}-${avatarAssets[key as keyof typeof avatarAssets].indexOf(modelSetting.model)}`"
                    :model-color="`colors: ${currentAvatarSettings.skinColor ?? ''}; materialName: skin`"
                    scale="-1 1 1" />
                </template>
                <a-gltf-model v-else make-gltf-swappable @nrOfCustomColors="setNrOfCustomColors(key, $event)"
                  :src="`#${key}-${avatarAssets[key as keyof typeof avatarAssets].indexOf(modelSetting.model)}`"
                  :model-color="`colors: ${modelSetting.colors ?? ''};`" />
              </template>
            </template>
          </a-entity>
        </a-scene>
      </div>
    </div>
  </WaitForAframe>
</template>

<style scoped>
.text-capitalize::first-letter {
  text-transform: capitalize;
}
</style>
