<template>
  <div>
    <div class="min-h-screen z-0">
      <h2>VrSpace main scene</h2>
      <div class="pointer-events-none *:pointer-events-auto" ref="domOutlet" id="aframe-dom-outlet" />
      <UIOverlay />
      <WaitForAframe>
        <a-scene ref="sceneTag" cursor="fuse:false; rayOrigin:mouse;" raycaster="objects: .clickable" raycaster-update
          @raycast-update="updateCursor($event.detail)">
          <VrAFrame v-if="vrSpaceStore.worldModelUrl" :show-nav-mesh="false">
            <a-entity id="teleport-target-aframe-scene" />
            <a-entity id="teleport-target-aframe-cursor"
              :position="currentCursor?.intersection.point.toArray().join(' ')" :visible="true">
              <a-ring :color="isCursorOnNavmesh ? 'yellow' : 'red'" :opacity="isCursorOnNavmesh ? 1 : 0.5"
                radius-inner="0.1" radius-outer="0.2" material="shader: flat;" rotation="-90 0 0" />
              <!-- <LaserPointerSelf @update="onLaserPointerUpdate" /> -->
            </a-entity>
          </VrAFrame>
        </a-scene>

        <!-- Components that render to multiple places in the DOM
         (for example both to UI and multiple places in the AFrame scene)
         while having all logic in one and the same component -->
        <template>
          <LaserTeleport />
          <EmojiTeleport :uvs="[43, 43]"
            :coords="[[[35, 8], [36, 37], [36, 38], [15, 8], [36, 27]], [[34, 8], [2, 8], [36, 24], [36, 25], [21, 8],], [[28, 26], [28, 20], [28, 38], [3, 16], [2, 1]]]"
            @change="setEmojiSelf" :is-v-r="false" :columns="5" />
          <!-- <PlacablesTeleport />
          <LaserTeleport /> -->
        </template>
      </WaitForAframe>
    </div>
  </div>
</template>

<script setup lang="ts">
// import { onMounted } from 'vue';
import { aFrameSceneProvideKey } from '@/modules/injectionKeys';
import VrAFrame from '../../components/lobby/VrAFrame.vue';
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import type { VrSpaceId } from 'schemas';
import { onBeforeMount, provide, ref, watch, getCurrentInstance } from 'vue';
import type { Scene } from 'aframe';
import WaitForAframe from '@/components/WaitForAframe.vue';
import { useRouter } from 'vue-router';
import { useCurrentCursorIntersection, type Tuple, isCursorOnNavmesh } from '@/composables/vrSpaceComposables';
// import LaserPointerSelf from '@/components/lobby/LaserPointerSelf.vue';
import type { RayIntersectionData } from '@/modules/3DUtils';
import UIOverlay from '@/components/UIOverlay.vue';
import LaserTeleport from '@/components/lobby/LaserTeleport.vue';
import EmojiTeleport from '@/components/lobby/EmojiTeleport.vue';
const { updateCursor, currentCursor } = useCurrentCursorIntersection();

const router = useRouter();
const vrSpaceStore = useVrSpaceStore();

const props = defineProps<{
  vrSpaceId: VrSpaceId
}>();
const sceneTag = ref<Scene>();
const domOutlet = ref<HTMLDivElement>();
provide(aFrameSceneProvideKey, { sceneTag, domOutlet });

watch(() => props.vrSpaceId, () => {
  console.log('vrSpaceId updated:', props.vrSpaceId);
  const url = router.resolve({ name: 'vrSpace', params: { vrSpaceId: props.vrSpaceId } }).href;
  window.location.href = url;
  // getCurrentInstance()!.proxy?.$forceUpdate();
});

function onLaserPointerUpdate(laserInfo: { active: boolean, intersectionData?: RayIntersectionData }) {
  console.log('event:', laserInfo);
}

// Emoji stuff
function setEmojiSelf(coords: Tuple, active: boolean) {
  // Send things to server
  console.log('Sending emoji stuff to server', coords, active);
}

onBeforeMount(async () => {
  await vrSpaceStore.enterVrSpace(props.vrSpaceId);
});

</script>

