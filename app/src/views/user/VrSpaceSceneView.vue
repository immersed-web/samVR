<template>
  <div>
    <div class="min-h-screen z-0">
      <div class="pointer-events-none *:pointer-events-auto absolute z-50" ref="domOutlet" id="aframe-dom-outlet">
      </div>
      <UIOverlay />
      <WaitForAframe>
        <a-scene renderer="logarithmicDepthBuffer: false" ref="sceneTag" cursor="fuse:false; rayOrigin:mouse;"
          raycaster="objects: .clickable" raycaster-update @raycast-update="setCursorIntersection($event.detail)">
          <a-assets>
            <a-asset-item id="icon-font"
              src="https://fonts.gstatic.com/s/materialicons/v70/flUhRq6tzZclQEJ-Vdg-IuiaDsNa.woff" />
          </a-assets>
          <VrAFrame v-if="vrSpaceStore.worldModelUrl" :show-nav-mesh="false">
            <a-entity id="teleport-target-aframe-scene" />
            <a-entity id="teleport-target-aframe-cursor" ref="cursorEntity" :visible="true">
              <a-ring :visible="isCursorOnNavmesh" radius-inner="0.1" radius-outer="0.2" material="shader: flat;"
                rotation="0 0 0" />
            </a-entity>
          </VrAFrame>
          <PlacablesTeleport />
        </a-scene>

        <!-- Components that render to multiple places in the DOM
         (for example both to UI and multiple places in the AFrame scene)
         while having all logic in one and the same component -->
        <template>
          <LaserTeleport />
          <EmojiTeleport :uvs="[43, 43]"
            :coords="[[[35, 8], [36, 37], [36, 38], [15, 8], [36, 27]], [[34, 8], [2, 8], [36, 24], [36, 25], [21, 8],], [[28, 26], [28, 20], [28, 38], [3, 16], [2, 1]]]"
            @change="setEmojiSelf" :is-v-r="false" :columns="5" />
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
import { onBeforeMount, provide, ref, watch, getCurrentInstance, onBeforeUnmount } from 'vue';
import type { Entity, Scene } from 'aframe';
import WaitForAframe from '@/components/WaitForAframe.vue';
import { useRouter } from 'vue-router';
import { useCurrentCursorIntersection, type Tuple } from '@/composables/vrSpaceComposables';
import { intersectionToTransform, type RayIntersectionData } from '@/modules/3DUtils';
import UIOverlay from '@/components/UIOverlay.vue';
import LaserTeleport from '@/components/lobby/LaserTeleport.vue';
import EmojiTeleport from '@/components/lobby/EmojiTeleport.vue';
import { useSoupStore } from '@/stores/soupStore';
import PlacablesTeleport from './lobby/teleports/PlacablesTeleport.vue';
const { setCursorIntersection, currentCursorIntersection, isCursorOnNavmesh, triggerCursorClick } = useCurrentCursorIntersection();

const router = useRouter();
const vrSpaceStore = useVrSpaceStore();
const soupStore = useSoupStore();

const props = defineProps<{
  vrSpaceId: VrSpaceId
}>();
const sceneTag = ref<Scene>();
const domOutlet = ref<HTMLDivElement>();
const cursorEntity = ref<Entity>();
provide(aFrameSceneProvideKey, { sceneTag, domOutlet });

watch(() => props.vrSpaceId, () => {
  console.log('vrSpaceId updated:', props.vrSpaceId);
  const url = router.resolve({ name: 'vrSpace', params: { vrSpaceId: props.vrSpaceId } }).href;
  window.location.href = url;
  // getCurrentInstance()!.proxy?.$forceUpdate();
});
watch(currentCursorIntersection, () => {
  // console.log('updating cursorEntity transform');
  const intersectionData = currentCursorIntersection.value;
  if (!intersectionData) return;
  if (!cursorEntity.value) return;
  const cursor = cursorEntity.value;
  if (!cursor) return;
  const transform = intersectionToTransform(intersectionData);
  if (!transform) return;
  cursor.object3D.position.set(...transform.position);
  const quat = new THREE.Quaternion().fromArray(transform.rotation);
  cursor.object3D.rotation.setFromQuaternion(quat);
})

// function onLaserPointerUpdate(laserInfo: { active: boolean, intersectionData?: RayIntersectionData }) {
//   console.log('event:', laserInfo);
// }

// Emoji stuff
function setEmojiSelf(coords: Tuple, active: boolean) {
  // Send things to server
  console.log('Sending emoji stuff to server', coords, active);
}

onBeforeMount(async () => {

  await vrSpaceStore.enterVrSpace(props.vrSpaceId);

  if (!soupStore.deviceLoaded) {
    await soupStore.loadDevice();
  }
  await soupStore.createReceiveTransport();
  try {
    await soupStore.createSendTransport();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    const [track] = stream.getAudioTracks();
    await soupStore.produce({
      track,
      producerInfo: {
        isPaused: false,
      },
    });
  } catch (e) {
    console.error('failed to setup the mediasoup stuff');
  }
});

onBeforeUnmount(async () => {
  await soupStore.closeAudioProducer();
});

</script>

