<script setup lang="ts">
import { ref, type Ref, reactive, watch, onMounted } from 'vue';
import { type Entity } from 'aframe';
import { stringify, parse } from 'devalue';

import MaxWidth7xl from '@/components/layout/MaxWidth7xl.vue';
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
import { avatarAssets, type AvatarDesign, defaultAvatarDesign, type PartKeyWithColor, skinParts } from 'schemas';

import { useConnectionStore } from '@/stores/connectionStore';
import { useClientStore } from '@/stores/clientStore';
import { useAuthStore } from '@/stores/authStore';

const connectionStore = useConnectionStore();
const clientStore = useClientStore()
const authStore = useAuthStore();

const currentAvatarSettings = reactive<AvatarDesign>(defaultAvatarDesign);

onMounted(() => {
  const wasLoaded = loadAvatarFromClientState();
  if (!wasLoaded) {
    loadAvatarFromStorage();
  }
  // we only start watching after loading the (maybe) saved avatardesign
  watch(() => currentAvatarSettings, () => {
    if (authStore.role === 'guest') {
      saveAvatarSettingsToStorage();
    }
    connectionStore.client.user.updateAvatarDesign.mutate(currentAvatarSettings);
  }, { deep: true });
});

function saveAvatarSettingsToStorage() {
  // console.log('avatarSettings before save:', currentAvatarSettings);
  window.localStorage.setItem('avatarSettings', stringify(currentAvatarSettings));
}

function loadAvatarFromClientState() {
  const avatarDesign = clientStore.clientState?.avatarDesign;
  if (avatarDesign) {
    currentAvatarSettings.parts = avatarDesign.parts;
    currentAvatarSettings.skinColor = avatarDesign.skinColor;
    return true;
  }
  return false;
}

function loadAvatarFromStorage() {
  const loadedString = localStorage.getItem('avatarSettings');
  if (!loadedString) {
    console.error('no saved avatardesign in localstorage');
  } else {
    const parsedAvatarSettings = parse(loadedString);
    currentAvatarSettings.parts = parsedAvatarSettings.parts;
    currentAvatarSettings.skinColor = parsedAvatarSettings.skinColor;
    console.log("Loaded skin color", parsedAvatarSettings.skinColor);
    if (parsedAvatarSettings.skinColor) {
      skinColorIsActive.value = true
      currentSkinColor.value = parsedAvatarSettings.skinColor
    }
    console.log("Loaded parts", parsedAvatarSettings.parts)
  }

}

const customColorsIsActive = reactive(Object.fromEntries(Object.keys(avatarAssets).map(k => [k, [false, false]])));
const currentSkinColor = ref('');
const skinColorIsActive = ref(false);

function onColorPicked(part: PartKeyWithColor, colorIdx: number, color: string) {
  // console.log('color picked', part, colorIdx, color);
  if (customColorsIsActive[part][colorIdx]) {
    // console.log('setting color', part, colorIdx, color);
    currentAvatarSettings.parts[part].colors[colorIdx] = color;
  }
  // customColorsIsActive[part][colorIdx] = true;
}

watch([skinColorIsActive, currentSkinColor], ([active, newColor], [prevActive, prevColor]) => {
  console.log("Changed skin color", newColor)
  // currentAvatarSettings.skinColor = '';

  if (newColor !== prevColor && prevColor !== '') {
    skinColorIsActive.value = true
    currentAvatarSettings.skinColor = newColor;
  } else if (!active) {
    currentAvatarSettings.skinColor = '';
  } else if (active !== prevActive && active) {
    currentAvatarSettings.skinColor = newColor;
  }
});

function onCustomColorActiveChanged(part: PartKeyWithColor, colorIdx: number, active: boolean) {
  // console.log(avatarAssets);
  // console.log(active, currentAvatarSettings.parts[part].colors[colorIdx]);
  if (!active) {
    currentAvatarSettings.parts[part].colors[colorIdx] = '';
  } else {
    currentAvatarSettings.parts[part].colors[colorIdx] = currentColorPickerValue.value;
  }
}

const mouthFlipAssets = ref(['flip_a_e_i', 'flip_b_m_p', 'flip_c_d_n_s_t_x_y_z', 'flip_e', 'flip_f_v', 'flip_i_ch_sh', 'flip_l', 'flip_o', 'flip_r', 'flip_th', 'flip_u']);

const partsNrOfColors = reactive(Object.fromEntries(Object.keys(avatarAssets).map(k => [k, 0])));
function setNrOfCustomColors(part: string, evt: CustomEvent) {
  // console.log('setNrOfCustomColors', evt, part);
  const entity = evt.target as Entity;
  // @ts-ignore
  const nrOfColors = entity.components['model-color'].nrOfCustomColors as number;
  // console.log(part, nrOfColors, entity.components['model-color']);
  partsNrOfColors[part] = nrOfColors;
  for (const [key, value] of Object.entries(currentAvatarSettings.parts)) {
    const keyTyped = key as PartKeyWithColor;
    // console.log(keyTyped, value, partsNrOfColors[key]);
    for (let i = 0; i < partsNrOfColors[keyTyped]; i++) {
      // console.log(currentAvatarSettings.parts[keyTyped].colors[i])
      // currentColorSettings[key][i] = currentAvatarSettings.parts[key].colors[i];
      if (currentAvatarSettings.parts[keyTyped].colors[i]) {
        customColorsIsActive[keyTyped][i] = true;
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
  // console.log(idx);
  const newIdx = (idx + offset + l) % l;
  // console.log(newIdx);
  const newModelName = partList[newIdx];
  // console.log(newModelName);
  currentAvatarSettings.parts[partType].model = newModelName;
}

const popupSkin = ref<InstanceType<typeof PopUp> | null>(null);
const popupParts = ref<InstanceType<typeof PopUp> | null>(null);
const popupPartsKeys = ref<{ part: PartKeyWithColor, cIdx: number } | null>(null);
const currentColorPickerValue = ref('');

function openPopupParts(evt: Event, part: PartKeyWithColor, cIdx: number) {
  // console.log('open popup', part, cIdx);
  popupPartsKeys.value = { part, cIdx };
  const savedColor = currentAvatarSettings.parts[part].colors[cIdx]
  if (savedColor) {
    currentColorPickerValue.value = savedColor;
  }
  popupParts.value?.open(evt);
}

watch(currentColorPickerValue, (newColor, prevColor) => {
  if (prevColor == '') {
    // console.log('first change of colorPickerValue');
    return;
  }
  if (!popupPartsKeys.value) {
    return;
  }
  const { part, cIdx } = popupPartsKeys.value;
  currentAvatarSettings.parts[part].colors[popupPartsKeys.value.cIdx] = newColor;
  customColorsIsActive[part][cIdx] = true

  // console.log('currentColorPickerValue watcher triggered:', newColor, prevColor);
})
</script>

<template>
  <WaitForAframe>
    <MaxWidth7xl class="grid grid-cols-[5fr_7fr] gap-2">
      <!-- COLUMN 1 -->
      <div
        class="grid grid-cols-[minmax(min-content,1fr)_minmax(8rem,1.7fr)_auto] items-center gap-5 overflow-y-auto capitalize bg-slate-200 p-2 rounded-md">
        <span class="col-start-1 label-text font-semibold">Skin color</span>
        <div class="col-start-3">
          <button class="btn btn-xs btn-circle btn-outline material-icons text-lg leading-none"
            :style="{ 'background': skinColorIsActive ? currentSkinColor : 'transparent' }" @click="popupSkin.open">
            <template v-if="!skinColorIsActive">
              invert_colors_off
            </template>
          </button>
          <PopUp ref="popupSkin" class="bg-white rounded-xl">
            <Vue3ColorPicker v-model="currentSkinColor" :show-picker-mode="false" mode="solid" input-type="RGB"
              type="HEX" :show-color-list="false" :show-alpha="false" :show-eye-drop="false" :show-input-menu="false"
              :show-input-set="false" />
            <label class="label cursor-pointer">
              <span class="label-text">Color active</span>
              <input type="checkbox" class="toggle"
                :style="{ 'background-color': skinColorIsActive ? currentSkinColor : 'grey' }"
                v-model="skinColorIsActive">
            </label>
          </PopUp>
        </div>
        <template v-for="(partsList, key) in avatarAssets" :key="key">
          <template v-if="avatarAssets[key].length > 1">
            <!-- <div class="col-start-1 col-span-3 divider divider-horizontal divider-neutral mt-1" /> -->
            <span class="col-start-1 label-text font-semibold">{{ key }}</span>
            <div class=" flex max-w-56 bg-white join join-horizontal items-stretch justify-between gap-1">
              <button @click="changeClothingIdx(key, -1)"
                class="text-slate-700 material-icons hover:bg-slate-200 join-item px-1">
                west
              </button>
              <Listbox v-model="currentAvatarSettings.parts[key].model" class="">
                <div class="relative min-w-8 grow">
                  <ListboxButton
                    class="cursor-default min-w-0 w-full h-full py-2 bg-white text-left focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-300 sm:text-sm">
                    <span class="block truncate capitalize">{{
                      currentAvatarSettings.parts[key].model?.split("_").slice(1).join(" ") || "None" }}</span>
                    <!-- <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                      <ChevronUpDownIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </span> -->
                  </ListboxButton>

                  <Transition leave-active-class="transition duration-100 ease-in" leave-from-class="opacity-100"
                    leave-to-class="opacity-0">
                    <ListboxOptions
                      class="absolute -left-2 mt-1 p-2 w-44 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm z-10">
                      <ListboxOption v-slot="{ active, selected }" v-for="asset in avatarAssets[key]" :key="asset"
                        :value="asset" as="template">
                        <li :class="[
                          active ? 'bg-amber-100 text-amber-900' : 'text-gray-900',
  'relative cursor-default select-none',
]">
                          <span class="capitalize" :class="[
                            selected ? 'font-medium' : 'font-normal',
                            'block truncate',
                          ]">{{ asset?.split("_").slice(1).join(" ") || "None" }}</span>
                          <span v-if="selected" class="absolute inset-y-0 left-0 flex items-center pl-3 text-amber-600">
                            <!-- <CheckIcon class="h-5 w-5" aria-hidden="true" /> -->
                          </span>
                        </li>
                      </ListboxOption>
                    </ListboxOptions>
                  </Transition>
                </div>
              </Listbox>

              <button @click="changeClothingIdx(key, 1)" class="text-slate-700 px-1 material-icons hover:bg-slate-200">
                east
              </button>
            </div>

            <div class="flex gap-2">
              <template v-for="(_v, cIdx) in partsNrOfColors[key]" :key="cIdx">
                <button class="btn btn-xs btn-circle btn-outline material-icons text-lg leading-none"
                  :style="{ 'background': customColorsIsActive[key][cIdx] ? currentAvatarSettings.parts[key]['colors'][cIdx] : 'transparent' }"
                  @click="openPopupParts($event, key, cIdx)">
                  <template v-if="!customColorsIsActive[key][cIdx]">
                    invert_colors_off
                  </template>
                  <!-- <svg v-if="!customColorsIsActive[key][cIdx]" xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20" fill="currentColor" class="size-5">
                          <path fill-rule="evenodd"
                            d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z"
                            clip-rule="evenodd" />
                          <path
                            d="m10.748 13.93 2.523 2.523a9.987 9.987 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z" />
                        </svg> -->
                </button>
              </template>
            </div>
          </template>
        </template>
        <PopUp ref="popupParts" class="bg-white rounded-xl">
          <Vue3ColorPicker v-model="currentColorPickerValue" :show-picker-mode="false"
            @update:model-value="onColorPicked(popupPartsKeys!.part, popupPartsKeys!.cIdx, currentColorPickerValue)"
            mode="solid" input-type="RGB" type="HEX" :show-color-list="false" :show-alpha="false" :show-eye-drop="false"
            :show-input-menu="false" :show-input-set="false" />

          <label class="label cursor-pointer">
            <span class="label-text">Color active</span>
            <input type="checkbox" class="toggle"
              :style="{ 'background-color': customColorsIsActive[popupPartsKeys!.part][popupPartsKeys!.cIdx] ? currentColorPickerValue : 'grey' }"
              v-model="customColorsIsActive[popupPartsKeys!.part][popupPartsKeys!.cIdx]"
              @change="onCustomColorActiveChanged(popupPartsKeys!.part, popupPartsKeys!.cIdx, customColorsIsActive[popupPartsKeys!.part][popupPartsKeys!.cIdx])">
          </label>
        </PopUp>
      </div>


      <!-- RIGHT COLUMN -->
      <div class="rounded-md overflow-hidden">
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
        <!-- <div class="p-14">

          <Vue3ColorPicker v-model=testValue @update:model-value="" />
          <p>{{ testValue }}</p>
          <button @click="testValue = ''" class="btn btn-primary">test</button>
        </div> -->
      </div>
    </MaxWidth7xl>
  </WaitForAframe>
</template>

<style scoped>
.text-capitalize::first-letter {
  text-transform: capitalize;
}
</style>
