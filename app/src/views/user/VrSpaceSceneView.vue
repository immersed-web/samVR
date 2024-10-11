<template>
  <div>
    <div class="min-h-screen z-0">
      <div class="pointer-events-none *:pointer-events-auto absolute z-50" ref="domOutlet" id="aframe-dom-outlet">
      </div>
      <UIOverlay />
      <WaitForAframe>
        <a-scene renderer="logarithmicDepthBuffer: false" ref="sceneTag" cursor="fuse:false; rayOrigin:mouse;"
          :raycaster="`objects: ${currentRaycastSelectorString}; mouseCursorStyleEnabled: ${pointerOnHover}`"
          raycaster-update @raycast-update="setCursorIntersection($event.detail)">
          <a-assets>
            <a-asset-item id="icon-font"
              src="https://fonts.gstatic.com/s/materialicons/v70/flUhRq6tzZclQEJ-Vdg-IuiaDsNa.woff" />
          </a-assets>
          <VrAFrame v-if="vrSpaceStore.worldModelUrl" :show-nav-mesh="false">
            <a-entity id="teleport-target-aframe-scene" />
            <a-entity id="teleport-target-aframe-cursor" ref="cursorEntity">
              <a-ring :visible="currentCursorMode === 'teleport'" transparent opacity="0.3" position="0 0 0.01"
                radius-inner="0.13" radius-outer="0.17" material="shader: flat;" rotation="0 0 0" color="white" />
            </a-entity>
            <a-entity>
              <a-entity v-for="(screenShare, producerId) in vrSpaceStore.currentVrSpace?.screenShares"
                :key="producerId">
                <a-entity geometry="primitive: plane; width: 1; height: 1" color="indigo"
                  :position="arrToCoordString(screenShare.position)"
                  :rotation="arrToCoordString(quaternionTupleToAframeRotation(screenShare.rotation))" />
              </a-entity>
            </a-entity>
            <!-- <a-entity ref="screenShareAnchorTag" /> -->
            <a-entity color="magenta" geometry="primitive: plane; width: 1; height: 1" ref="screenShareAVideoTag" />
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
          <Teleport to="#teleport-target-ui-left">

            <button v-if="screenshareStream" class="btn btn-error pointer-events-auto" @click="stopScreenShare"><span
                class="material-icons">stop_screen_share</span>Sluta dela</button>
            <button v-else class="btn btn-primary pointer-events-auto" @click="getScreenShare"><span
                class="material-icons">screen_share</span>Share screen</button>
            <pre class="text-xs whitespace-normal">{{ screenshareStream }}</pre>
            <video class="w-36 bg-pink-400" ref="screenVideoTag" id="screen-video-tag" autoplay playsinline
              webkit-playsinline crossorigin="anonymous" />
            <pre class="text-xs whitespace-normal max-w-24">screenShares: {{ vrSpaceStore.screenShares }}</pre>
          </Teleport>
          <!-- <Teleport to="#teleport-target-aframe-camera">
            <a-sphere position="0 0 -2" color="yellow" scale="0.1 0.1 0.1" />
          </Teleport> -->
        </template>
      </WaitForAframe>
    </div>
  </div>
</template>

<script setup lang="ts">
import { aFrameSceneProvideKey } from '@/modules/injectionKeys';
import VrAFrame from '../../components/lobby/VrAFrame.vue';
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import type { VrSpaceId } from 'schemas';
import { onBeforeMount, provide, ref, watch, getCurrentInstance, onBeforeUnmount, computed, nextTick, onMounted, onUpdated } from 'vue';
import { type Entity, type Scene, THREE } from 'aframe';
import WaitForAframe from '@/components/WaitForAframe.vue';
import { useRouter } from 'vue-router';
import { useCurrentCursorIntersection, type Tuple } from '@/composables/vrSpaceComposables';
import { arrToCoordString, intersectionToTransform, quaternionTupleToAframeRotation, type RayIntersectionData } from '@/modules/3DUtils';
import UIOverlay from '@/components/UIOverlay.vue';
import LaserTeleport from '@/components/lobby/LaserTeleport.vue';
import EmojiTeleport from '@/components/lobby/EmojiTeleport.vue';
import { useSoupStore } from '@/stores/soupStore';
import { useDisplayMedia } from '@vueuse/core';
import { omit } from 'lodash-es';
import type { ProducerId } from 'schemas/mediasoup';
const { setCursorIntersection, currentCursorMode, setCursorEntityRef, pointerOnHover, currentRaycastSelectorString } = useCurrentCursorIntersection();

const router = useRouter();
const vrSpaceStore = useVrSpaceStore();
const soupStore = useSoupStore();

const { stream: screenshareStream, start: startScreenshare, stop: stopDisplayMedia } = useDisplayMedia();

const props = defineProps<{
  vrSpaceId: VrSpaceId
}>();
const sceneTag = ref<Scene>();
const domOutlet = ref<HTMLDivElement>();
const screenVideoTag = ref<HTMLVideoElement>();
const screenShareAVideoTag = ref<Entity>();
const screenShareAnchorTag = ref<Entity>();
const cursorEntity = ref<Entity>();
setCursorEntityRef(cursorEntity);
provide(aFrameSceneProvideKey, { sceneTag, domOutlet });

watch(() => props.vrSpaceId, () => {
  console.log('vrSpaceId updated:', props.vrSpaceId);
  const url = router.resolve({ name: 'vrSpace', params: { vrSpaceId: props.vrSpaceId } }).href;
  window.location.href = url;
});

// Emoji stuff
function setEmojiSelf(coords: Tuple, active: boolean) {
  // Send things to server
  console.log('Sending emoji stuff to server', coords, active);
}

async function stopScreenShare() {
  if (!screenshareStream.value) {
    console.error('no screenshare stream');
    return;
  }
  const producerId = soupStore.videoProducer.producer?.id as ProducerId;
  if (!producerId) {
    console.error('no producer id');
    return;
  }
  await vrSpaceStore.removeScreenShare(producerId);
  await soupStore.closeVideoProducer();
  stopDisplayMedia();
}

async function getScreenShare() {
  const stream = await startScreenshare();
  if (!screenVideoTag.value) {
    console.error('no video tag');
    return;
  }
  if (!stream) {
    console.error('no stream');
    return;
  }
  screenVideoTag.value.srcObject = screenshareStream.value;
  if (!screenShareAVideoTag.value) {
    console.error('screenShare a-video tag was undefined');
    return;
  }
  screenShareAVideoTag.value.setAttribute('material', 'src: #screen-video-tag');

  const camPos = sceneTag.value!.camera.getWorldPosition(new THREE.Vector3());
  const aVideoPos = sceneTag.value!.camera.getWorldDirection(new THREE.Vector3());
  aVideoPos.y = 0;
  aVideoPos.setLength(1.5)
  aVideoPos.add(camPos);
  const aVideoObj3D = screenShareAVideoTag.value.object3D;
  aVideoObj3D.position.set(...aVideoPos.toArray());
  aVideoObj3D.lookAt(camPos)
  const aVideoQuaternion = aVideoObj3D.getWorldQuaternion(new THREE.Quaternion());
  const producerId = await soupStore.produce({
    track: stream.getVideoTracks()[0],
    producerInfo: {
      isPaused: false,
    }
  });

  await vrSpaceStore.placeScreenShare({
    producerId,
    transform: {
      position: aVideoPos.toArray(),
      rotation: aVideoQuaternion.toArray() as THREE.Vector4Tuple,
    }
  })
}

onMounted(() => {
  console.log('sceneView mounted');
})

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

onUpdated(() => {
  console.log('sceneView onUpdated');
})

</script>

