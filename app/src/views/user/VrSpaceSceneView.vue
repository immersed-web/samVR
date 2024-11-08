<template>
  <div>
    <div class="min-h-screen z-0">
      <div class="pointer-events-none *:pointer-events-auto absolute z-50" ref="domOutlet" id="aframe-dom-outlet">
      </div>
      <UIOverlay />
      <WaitForAframe>
        <a-scene renderer="logarithmicDepthBuffer: false" scene-cleanup ref="aframeScene"
          cursor="fuse:false; rayOrigin:mouse;"
          :raycaster="`objects: ${currentRaycastSelectorString}; mouseCursorStyleEnabled: ${pointerOnHover}`"
          raycaster-update @raycast-update="setCursorIntersection($event.detail)">
          <a-assets>
            <a-asset-item id="icon-font"
              src="https://fonts.gstatic.com/s/materialicons/v70/flUhRq6tzZclQEJ-Vdg-IuiaDsNa.woff" />
          </a-assets>
          <VrAFrame v-if="vrSpaceStore.worldModelUrl" :show-nav-mesh="false">
            <a-entity ref="vrCursor">
              <a-ring :visible="currentCursorMode === 'teleport'" transparent opacity="0.3" position="0 0 0.01"
                radius-inner="0.13" radius-outer="0.17" material="shader: flat;" rotation="0 0 0" color="white" />
            </a-entity>
            <a-video v-if="screenshareStream" :width="screenShareDimensions.width"
              :height="screenShareDimensions.height" ref="screenShareAVideoTag" />
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
          <Teleport v-if="overlayGUILeft" :to="overlayGUILeft">
            <!-- <p>is VR Headset: {{ deviceIsVRHeadset }}</p> -->
            <div v-if="!deviceIsVRHeadset">

              <button v-if="screenshareStream" class="btn btn-error pointer-events-auto" @click="stopScreenShare"><span
                  class="material-icons">stop_screen_share</span>Sluta dela</button>
              <button v-else class="btn btn-primary pointer-events-auto" @click="getScreenShare"><span
                  class="material-icons">screen_share</span>Share screen</button>
              <pre class="text-xs whitespace-normal">{{ screenshareStream }}</pre>
              <video @resize="onVideoResize" :class="{ 'hidden': !screenshareStream }" class="w-36 bg-pink-400"
                ref="screenVideoTag" id="screen-video-tag" autoplay playsinline webkit-playsinline
                crossorigin="anonymous" />
              <!-- <pre class="text-xs whitespace-normal max-w-24">screenShares: {{ vrSpaceStore.screenShares }}</pre> -->
            </div>
          </Teleport>
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
import { onBeforeMount, provide, ref, watch, getCurrentInstance, onBeforeUnmount, computed, nextTick, onMounted, onUpdated, reactive } from 'vue';
import { type Entity, type Scene, THREE } from 'aframe';
import WaitForAframe from '@/components/WaitForAframe.vue';
import { useRouter } from 'vue-router';
import { useCurrentCursorIntersection, type Tuple } from '@/composables/vrSpaceComposables';
import { deviceIsVRHeadset } from '@/composables/XRState';
import UIOverlay from '@/components/UIOverlay.vue';
import LaserTeleport from '@/components/lobby/LaserTeleport.vue';
import EmojiTeleport from '@/components/lobby/EmojiTeleport.vue';
import { useSoupStore } from '@/stores/soupStore';
import { useDisplayMedia } from '@vueuse/core';
import type { ProducerId } from 'schemas/mediasoup';
import { aframeScene, overlayGUILeft, vrCursor } from '@/composables/teleportTargets';
const { setCursorIntersection, currentCursorMode, setCursorEntityRef, pointerOnHover, currentRaycastSelectorString } = useCurrentCursorIntersection();

const router = useRouter();
const vrSpaceStore = useVrSpaceStore();
const soupStore = useSoupStore();

const { stream: screenshareStream, start: startScreenshare, stop: stopDisplayMedia } = useDisplayMedia();

const props = defineProps<{
  vrSpaceId: VrSpaceId
}>();
const domOutlet = ref<HTMLDivElement>();
const screenVideoTag = ref<HTMLVideoElement>();
const screenShareAVideoTag = ref<Entity>();
setCursorEntityRef(vrCursor);
provide(aFrameSceneProvideKey, { sceneTag: aframeScene, domOutlet });

watch(() => props.vrSpaceId, () => {
  console.log('vrSpaceId updated:', props.vrSpaceId);
  const url = router.resolve({ name: 'vrSpace', params: { vrSpaceId: props.vrSpaceId } }).href;
  window.location.href = url;
});

watch(() => vrSpaceStore.screenShares, (newScreenShares) => {
  console.log('screenshares changed', newScreenShares);
})

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
  await vrSpaceStore.removeScreenShare();
  await soupStore.closeVideoProducer();
  stopDisplayMedia();
}

const screenShareDimensions = reactive({
  width: 3,
  height: 1.75,
});
const screenShareScale = ref(3)
function onVideoResize(e: Event) {
  console.log('video resize', e);
  const vTag = e.target as HTMLVideoElement;
  const { videoWidth, videoHeight } = vTag;
  const ratio = videoWidth / videoHeight;
  const scale = screenShareScale.value;
  screenShareDimensions.width = scale * ratio;
  screenShareDimensions.height = scale;
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
  screenShareAVideoTag.value.setAttribute('src', '#screen-video-tag');
  // screenShareAVideoTag.value.setAttribute('material', 'src: #screen-video-tag');

  const camPos = aframeScene.value!.camera.getWorldPosition(new THREE.Vector3());
  const aVideoPos = aframeScene.value!.camera.getWorldDirection(new THREE.Vector3());
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
      scale: screenShareScale.value,
    }
  })
}

onMounted(() => {
  console.log('sceneView mounted');
  // console.log('IS VR Headset:', deviceIsVRHeadset);
  // const isSessionSupported = navigator.xr?.isSessionSupported('immersive-vr');
  // console.log('session support:', isSessionSupported);
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

