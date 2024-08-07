<template>
  <template v-if="vrSpaceStore.currentVrSpace">
    <a-entity id="vr-portals">
      <template v-for="placedObject in vrSpaceStore.currentVrSpace?.dbData.placedObjects"
        :key="placedObject.placedObjectId">
        <VrSpacePortal
          @click="router.push({ name: 'vrSpace', params: { vrSpaceId: placedObject.vrPortal?.vrSpaceId } })"
          v-if="placedObject.type === 'vrPortal'" :position="placedObject.position?.join(' ')" class="clickable"
          :label="placedObject.vrPortal?.name"
          :panoramic-preview-url="getAssetUrl(placedObject.vrPortal?.panoramicPreview?.generatedName)" />
      </template>
    </a-entity>

    <a-sky :color="skyColor" />
    <a-entity>
      <a-gltf-model @model-loaded="onModelLoaded" id="model" ref="modelTag" :src="vrSpaceStore.worldModelUrl" />
      <a-gltf-model v-if="vrSpaceStore.navMeshUrl" id="navmesh" :src="vrSpaceStore.navMeshUrl" :visible="showNavMesh"
        class="clickable" />
    </a-entity>
    <slot />
    <a-entity id="camera-rig" ref="playerOriginTag">
      <a-camera @loaded="onCameraLoaded" id="camera" ref="playerTag"
        look-controls="reverseMouseDrag: true; reverseTouchDrag: true;" wasd-controls="acceleration:65;"
        emit-move="interval: 20" position="0 1.65 0">
      </a-camera>
      <a-entity ref="leftHandTag" id="left-hand" @controllerconnected="leftControllerConnected = true"
        @controllerdisconnected="leftControllerConnected = false" laser-controls="hand:left"
        raycaster="objects: .clickable" emit-move="interval: 20; relativeToCamera: true">
        <a-entity :visible="leftControllerConnected" scale="0.05 0.05 0.05" rotation="20 90 -140"
          gltf-model="#avatar-hand-1" />
      </a-entity>
      <a-entity ref="rightHandTag" id="right-hand" @controllerconnected="rightControllerConnected= true"
        @controllerdisconnected="rightControllerConnected= false" oculus-touch-controls="hand:right"
        blink-controls="cameraRig: #camera-rig; teleportOrigin: #camera; collisionEntities: #navmesh;"
        emit-move="interval: 20; relativeToCamera: true">
        <a-entity :visible="rightControllerConnected" scale="0.05 0.05 -0.05" rotation="20 90 -140"
          gltf-model="#avatar-hand-1" />
      </a-entity>
    </a-entity>


    <!-- Avatars wrapper element -->
    <a-entity>
      <!-- The avatars -->
      <template v-for="(clientInfo, id) in clients" :key="id">
        <a-entity
          :interpolated-transform="`interpolationTime: 350; position: ${clientInfo.transform?.head?.position?.join(' ')}; rotation: ${clientInfo.transform?.head?.rotation?.join(' ')};`">
          <a-sphere v-if="clientInfo.transform?.head?.active" color="red" scale="0.8 1 0.4 ">
          </a-sphere>
          <a-troika-text look-at-camera :value="clientInfo.username" position="0 1.4 0" />
        </a-entity>
        <!-- <RemoteAvatar v-if="clientInfo.connectionId !== clientStore.clientState?.connectionId && clientInfo.transform"
          :id="'avatar-'+id" :client-info="clientInfo" /> -->
      </template>
    </a-entity>
  </template>
</template>

<script setup lang="ts">
import { type Entity, type DetailEvent, utils as aframeUtils, THREE } from 'aframe';
import { ref, onMounted, onBeforeMount, computed, onBeforeUnmount, inject } from 'vue';
import RemoteAvatar from './AvatarEntity.vue';
import type { ClientTransform } from 'schemas';
// import type { Unsubscribable } from '@trpc/server/observable';
import { useClientStore } from '@/stores/clientStore';
import { useRouter } from 'vue-router';
import { useStreamStore } from '@/stores/streamStore';
import { useXRState } from '@/composables/XRState';
import { throttle } from 'lodash-es';
// import type { SubscriptionValue, RouterOutputs } from '@/modules/trpcClient';
import { useSoupStore } from '@/stores/soupStore';
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import { aFrameSceneProvideKey } from '@/modules/injectionKeys';
import { getAssetUrl } from '@/modules/utils';
import VrSpacePortal from '../entities/VrSpacePortal.vue';

const router = useRouter();
// Stores
const vrSpaceStore = useVrSpaceStore();
const clientStore = useClientStore();
const soupStore = useSoupStore();

// Props & emits
const props = defineProps({
  // modelUrl: {type: String, required: true},
  // navmeshUrl: {type: String, default: ''},
  showNavMesh: {type: Boolean, default: false},
  // modelScale: {type: Number, default: 1},
});

type Point = [number, number, number];

// A-frame
// const sceneTag = ref<Scene>();
const { sceneTag } = inject(aFrameSceneProvideKey)!;
const { isImmersed } = useXRState(sceneTag);

const rightControllerConnected = ref(false);
const leftControllerConnected = ref(false);

const modelTag = ref<Entity>();
const playerTag = ref<Entity>();
const playerOriginTag = ref<Entity>();
const leftHandTag = ref<Entity>();
const rightHandTag = ref<Entity>();

// const avatarModelFileLoaded = ref(false);

// const modelUrl = computed(() => {
//   return props.modelUrl;
// });

const navmeshId = computed(() => {
  return vrSpaceStore.navMeshUrl !== undefined ? 'navmesh' : 'model';
});
// const navmeshId = computed(() => {
//   return vrSpaceStore.currentVrSpace?.dbData.navMeshAssetId !== undefined ? 'navmesh' : 'model';
// });

const clients = computed(() => vrSpaceStore.currentVrSpace?.clients);

const skyColor = computed(() => {
  return vrSpaceStore.currentVrSpace?.dbData.skyColor ?? 'lightskyblue';
})

onBeforeMount(async () => {
  // console.log('onBeforeMount');
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
  // console.log('onBeforeMount completed');
});

onMounted(async () => {
  // console.log('onMounted');
  // console.log('onMounted completed');
});

function onCameraLoaded() {
  console.log('camera loaded. attaching scene attributes');
  sceneTag.value!.setAttribute('cursor', { rayOrigin: 'mouse', fuse: false });
  // the  raycaster seem to keep a reference to the intersected object which leads to us missing "new" intersection after reattaching raycaster-listen.
  // This is a hacky work-around to "reset" the raycasting logic
  sceneTag.value!.setAttribute('raycaster', { objects: '.clickable' });
  playerTag.value!.setAttribute('simple-navmesh-constraint', `navmesh:#${navmeshId.value}; fall:0.5; height:1.65;`);
}

onBeforeUnmount(async () => {
  sceneTag.value?.removeAttribute('raycaster');
  sceneTag.value?.removeAttribute('cursor');
  await soupStore.closeAudioProducer();
  await vrSpaceStore.leaveVrSpace();
});

async function onModelLoaded() {
  if (modelTag.value && playerOriginTag.value) {
    // console.log(obj3D);
    let startPos = getRandomSpawnPosition();
    if (!startPos) {
      console.log('failed to calculate spawnpoint. centering player on model bbox as fallback');
      const obj3D = modelTag.value.getObject3D('mesh') as THREE.Object3D;
      const bbox = new THREE.Box3().setFromObject(obj3D);
      startPos = new THREE.Vector3();
      bbox.getCenter(startPos);
    }
    playerOriginTag.value.object3D.position.set(startPos.x, startPos.y, startPos.z);
    const worldPos = playerTag.value!.object3D.getWorldPosition(new THREE.Vector3());
    const worldRot = playerTag.value!.object3D.getWorldQuaternion(new THREE.Quaternion());
    await new Promise((res) => setTimeout(res, 200));

    // vrSpaceStore.updateTransform(trsfm);
    // placeRandomSpheres();

    // @ts-ignore
    playerTag.value?.addEventListener('move', onHeadMove);
    // @ts-ignore
    leftHandTag.value?.addEventListener('move', onLeftHandMove);
    // @ts-ignore
    rightHandTag.value?.addEventListener('move', onRightHandMove);
  }
}

// Test function used to make sure we distribute spawn points nicely in the spawn area
function placeRandomSpheres() {
  for (let i = 0; i < 500; i++) {
    const sphereEl = document.createElement('a-sphere');
    sphereEl.setAttribute('color', 'red');
    const pos = getRandomSpawnPosition();
    if (!pos) {
      console.error('failed to generate random spawn point');
      return;
    }
    const posString = AFRAME.utils.coordinates.stringify(pos);
    sphereEl.setAttribute('position', posString);
    sphereEl.setAttribute('scale', '0.05 0.05 0.05');
    sceneTag.value!.append(sphereEl);
  }
}

function getRandomSpawnPosition() {
  const spawnPosition = vrSpaceStore.currentVrSpace?.dbData.spawnPosition as Point | undefined;
  const spawnRadius = vrSpaceStore.currentVrSpace?.dbData.spawnRadius;
  if (!spawnPosition || !spawnRadius) return;
  const randomRadianAngle = 2 * Math.PI * Math.random(); // radian angle
  // Why sqrt? Check here: https://programming.guide/random-point-within-circle.html
  const randomDistance = Math.sqrt(Math.random()) * spawnRadius;
  const x = randomDistance * Math.cos(randomRadianAngle);
  const z = randomDistance * Math.sin(randomRadianAngle);
  const randomOffsetVector = new THREE.Vector3(x, 0, z);

  const spawnPointVector = new THREE.Vector3(...spawnPosition);
  spawnPointVector.add(randomOffsetVector);
  return spawnPointVector;
}

// function goToStream() {
//   // router.push({name: 'basicVR'});
//   // console.log('sphere clicked');
//   if (!streamStore.currentStream) return;
//   let mainCameraId = streamStore.currentStream.mainCameraId;
//   if(!mainCameraId){
//     console.warn('No maincamera set. Falling back to using any camera');
//     mainCameraId = Object.values(streamStore.currentStream.cameras)[0].cameraId;
//   }
//   router.push({
//     name: 'userCamera',
//     params: {
//       streamId: streamStore.currentStream.streamId,
//       cameraId: mainCameraId,
//     },
//   });
// }

// const currentTransform: ClientTransform = {
//   head: {
//     position: [0,0,0],
//     rotation: [0, 0, 0, 0],
//   },
// };
function onHeadMove(e: DetailEvent<ClientTransform['head']>) {
  vrSpaceStore.ownClientTransform.head = e.detail;
  // console.log('head moved');
  // console.log(e.detail.position);
  // currentTransform.head = e.detail;
  // throttledTransformMutation();
}
function onLeftHandMove(e: DetailEvent<ClientTransform['leftHand']>) {
  // console.log('left hand moved');
  // currentTransform.leftHand = e.detail;
  // throttledTransformMutation();
}
function onRightHandMove(e: DetailEvent<ClientTransform['rightHand']>) {
  // console.log('right hand moved');
  // console.log(e.detail?.orientation);
  // console.log(e.detail?.position);
  // currentTransform.rightHand = e.detail;
  // throttledTransformMutation();
}

// const throttledTransformMutation = throttle(async () => {
//   if(!sceneTag.value?.is('vr-mode')) {
//     delete currentTransform.leftHand;
//     delete currentTransform.rightHand;
//   }
//   await vrSpaceStore.updateTransform(currentTransform);
//   // Unset hands after theyre sent
// }, 100, { trailing: true });
</script>
