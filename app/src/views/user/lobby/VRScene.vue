<script setup lang="ts">
import { type Ref, ref, onMounted, onUnmounted, onBeforeMount } from 'vue';
import { useEventBus } from '@vueuse/core';

import { type DetailEvent, THREE, type Entity, type Scene } from 'aframe';
import sponzaUrl from '@/assets/models/sponza.glb?url';
import { isVR, oculusButtons, oculusHandSimulator, simulateOculus, type RayIntersectionData, rayIntersectionData, clickKey } from '@/composables/vrSpaceUtils';
import { intersectionToTransform } from '@/modules/3DUtils';

import UIOverlay from '@/components/lobby/UIOverlay.vue';
import EmojiTeleport from '@/views/user/lobby/teleports/EmojiTeleport.vue';
import PlacablesTeleport from '@/views/user/lobby/teleports/PlacablesTeleport.vue';
import LaserTeleport from '@/views/user/lobby/teleports/LaserTeleport.vue';
// import EmojiPicker from '@/components/EmojiPicker.vue';
import EmojiOther from '@/components/lobby/EmojiOther.vue';

// import EmojiSelf from '@/components/EmojiSelf.vue';

import emojiSheetUrl from '@/assets/sprite-128.png';
import WaitForAframe from '@/components/WaitForAframe.vue';

type Tuple = [number, number]

const sceneTag = ref<Scene>();

const cursorEntity = ref<Entity>();
function placeCursor(evt: DetailEvent<RayIntersectionData>) {
  rayIntersectionData.value = evt.detail;
  const cursor = cursorEntity.value;
  if (!cursor) return;
  const transform = intersectionToTransform(evt.detail);
  if (!transform) return;
  cursor.object3D.position.set(...transform.position);
  const quat = new THREE.Quaternion().fromArray(transform.rotation);
  cursor.object3D.rotation.setFromQuaternion(quat);
}


const bus = useEventBus(clickKey);
function onClick(evt: DetailEvent<{ cursorEl: Entity, intersection: THREE.Intersection }>) {
  // const rayDirection = evt.detail.cursorEl.components.raycaster.raycaster.ray.direction;
  // console.log('click!', evt);

  bus.emit({ model: 'sponza', cursorObject: cursorEntity.value?.object3D });

  // placeMovedObject({ intersection: evt.detail.intersection, rayDirection });
  // return;
}

// #region Other avatars

const emojiCoordsOther = ref<Tuple | undefined>(undefined);
const emojiActiveOther = ref(false);

function setEmojiSelf(coords: Tuple, active: boolean) {
  // Send things to server
  console.log('Sending emoji stuff to server', coords, active);

  // Simulating receiving emoji data from other user. It just happens to be the same emoji you just picked yourself.
  emojiCoordsOther.value = coords;
  emojiActiveOther.value = active;
}

// #endregion

// Simulate Oculus hand controls
simulateOculus();

</script>

<template>
  <UIOverlay />
  <WaitForAframe>
    <!-- Components (prefereably in @/assets/views/teleports/) can render to here using the Teleport component -->
    <!-- Example: <Teleport to="tp-ui">...</Teleport> -->

    <!-- Components (prefereably in @/assets/views/teleports/) can render to here using the Teleport component -->
    <a-scene id="tp-aframe-scene" ref="sceneTag" style="width: 100vw; height: 100vh;"
      cursor="fuse:false; rayOrigin:mouse;" raycaster="objects: .clickable" raycaster-update
      @raycast-update="placeCursor" xr-mode-ui="enabled: true;" @enter-vr="isVR = true" @exit-vr="isVR = false" look
      renderer="sortTransparentObjects: true">
      <a-assets>
        <a-asset-item id="sponza" :src="sponzaUrl" />
        <a-asset-item id="hand-control-left-obj"
          src="https://cdn.aframe.io/controllers/oculus/oculus-touch-controller-left.obj" />
        <a-asset-item id="hand-control-left-mtl"
          src="https://cdn.aframe.io/controllers/oculus/oculus-touch-controller-left.mtl" />
        <a-asset-item id="hand-control-right-obj"
          src="https://cdn.aframe.io/controllers/oculus/oculus-touch-controller-right.obj" />
        <a-asset-item id="hand-control-right-mtl"
          src="https://cdn.aframe.io/controllers/oculus/oculus-touch-controller-right.mtl" />
      </a-assets>

      <!-- Components (prefereably in @/assets/views/teleports/) can render to here using the Teleport component -->
      <a-entity id="tp-aframe-camera" camera="active: true" look-controls wasd-controls position="9 1.6 0"
        rotation="90 190 90">
        <!-- Simulate hands, for dev purposes when no headset is available -->
        <template v-if="oculusHandSimulator.simulate">
          <template v-if="oculusHandSimulator['hands-active']">
            <a-entity id="tp-aframe-hand-left" position="-0.4 -0.2 -0.5">
              <!-- <a-box scale="0.05 0.05 0.1" opacity="0.25"></a-box> -->
              <a-entity obj-model="obj: #hand-control-left-obj; mtl: #hand-control-left-mtl" />
            </a-entity>
            <a-entity id="tp-aframe-hand-right" position="0.4 -0.2 -0.5">
              <!-- <a-box scale="0.05 0.05 0.1" opacity="0.25"></a-box> -->
              <a-entity obj-model="obj: #hand-control-right-obj; mtl: #hand-control-right-mtl" />
            </a-entity>
          </template>
        </template>
      </a-entity>

      <!-- Components (prefereably in @/assets/views/teleports/) can render to here using the Teleport component -->
      <template v-if="!oculusHandSimulator.simulate">
        <a-entity id="tp-aframe-hand-left" oculus-touch-controls="hand: left" @xbuttondown="oculusButtons['x'] = true"
          @xbuttonup="oculusButtons['x'] = false" @ybuttondown="oculusButtons['y'] = true"
          @ybuttonup="oculusButtons['y'] = false" />
        <a-entity id="tp-aframe-hand-right" oculus-touch-controls="hand: right" @abuttondown="oculusButtons['a'] = true"
          @abuttonup="oculusButtons['a'] = false" @bbuttondown="oculusButtons['b'] = true"
          @bbuttonup="oculusButtons['b'] = false" />
      </template>

      <a-entity ref="cursorEntity" id="tp-aframe-cursor" />

      <!-- #region Misc demo stuff -->

      <!-- Other user entity -->
      <a-entity position="10 0 -3">
        <!-- Other user's avatar -->
        <a-sphere position="0 0.9 0" scale="0.4 0.9 0.3" />
        <!-- Emoji entity -->
        <EmojiOther :sheet-url="emojiSheetUrl" :coords="emojiCoordsOther" :active="emojiActiveOther" />
      </a-entity>

      <!-- Another user entity -->
      <a-entity position="6 0 -4.5">
        <!-- Other user's avatar -->
        <a-sphere position="0 0.9 0" scale="0.4 0.9 0.3" />
        <!-- Emoji entity -->
        <EmojiOther :sheet-url="emojiSheetUrl" :coords="emojiCoordsOther" :active="emojiActiveOther" />
      </a-entity>

      <!-- endregion -->

      <a-gltf-model class="clickable" src="#sponza" @click="onClick" />
    </a-scene>

    <!-- #region Teleports -->
    <!-- Components that can render for both screen/UI and VR, keeping all logic within the same component -->

    <template>
      <EmojiTeleport :sheet-url="emojiSheetUrl" :uvs="[43, 43]"
        :coords="[[[35, 8], [36, 37], [36, 38], [15, 8], [36, 27]], [[34, 8], [2, 8], [36, 24], [36, 25], [21, 8],], [[28, 26], [28, 20], [28, 38], [3, 16], [2, 1]]]"
        @change="setEmojiSelf" :is-v-r="false" :columns="5" />
      <PlacablesTeleport />
      <LaserTeleport />
    </template>

    <!-- #endregion -->
  </WaitForAframe>
</template>
