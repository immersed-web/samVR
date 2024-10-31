<template>
  <template v-if="vrSpaceStore.currentVrSpace">
    <a-entity id="vr-portals">
      <a-entity v-for="placedObject in vrSpaceStore.currentVrSpace?.dbData.placedObjects"
        :key="`${placedObject.placedObjectId}_${placedObject.updatedAt}`"
        :rotation="arrToCoordString(quaternionTupleToAframeRotation(placedObject.orientation ?? [0, 0, 0, 1]))"
        :position="arrToCoordString(placedObject.position)">
        <VrSpacePortal v-if="placedObject.type === 'vrPortal'" :vr-portal="placedObject.vrPortal"
          @click.stop="router.replace({ name: 'vrSpace', params: { vrSpaceId: placedObject.vrPortal?.vrSpaceId } })"
          :label="placedObject.vrPortal?.name" />
        <PlacedAsset class="raycastable-surface" v-else-if="placedObject.type === 'asset' && placedObject.asset"
          :scale="placedObject.scale ? arrToCoordString(placedObject.scale) : ''" :asset="placedObject.asset" />
      </a-entity>
    </a-entity>

    <a-sky :color="skyColor" />
    <a-entity :scale="vrSpaceStore.worldModelScaleString">
      <a-gltf-model bvh @model-loaded="onModelLoaded" id="model" ref="modelTag" :src="vrSpaceStore.worldModelUrl"
        class="raycastable-surface" :class="{ 'navmesh': !vrSpaceStore.navMeshUrl }" @click.stop="triggerCursorClick" />
      <a-gltf-model v-if="vrSpaceStore.navMeshUrl" id="navmesh" :src="vrSpaceStore.navMeshUrl" :visible="showNavMesh"
        class="navmesh" @mousedown="teleportMouseDown" @click.stop="triggerCursorClick" />
    </a-entity>

    <a-entity v-if="vrSpaceStore.currentVrSpace.dbData.spawnPosition" ref="spawnPoint"
      :position="arrToCoordString(vrSpaceStore.currentVrSpace.dbData.spawnPosition)">
      <!-- <a-sphere color="yellow" radius="0.2" /> -->
      <!-- <a-entity :position="`0 ${defaultHeightOverGround} 0`"
        mesh-ui-block="backgroundOpacity: 0.2; justifyContent: space-evenly; fontSize: 0.03; padding: 0.004" class="">
        <a-entity mesh-ui-block="margin: 0.01; justifyContent: space-evenly;">
          <a-entity
            mesh-ui-block="width: 0.1; height: 0.1; backgroundColor: #0ff; justifyContent: center; bestFit: auto;">
            <a-entity mesh-ui-text="content: Gunnar är bäst!;"></a-entity>
          </a-entity>
          <a-entity
            mesh-ui-block="width: 0.1; height: 0.1; backgroundColor: #0ff; justifyContent: center; bestFit: auto;">
            <a-entity :mesh-ui-text="`content: vrState=${isImmersed};`"></a-entity>
          </a-entity>
        </a-entity>
      </a-entity> -->

    </a-entity>

    <slot />

    <!-- <a-sphere :position="vrSpaceStore.currentVrSpace.dbData.spawnPosition?.join(' ')" color="yellow"
      scale="0.1 0.1 0.1" /> -->

    <a-entity id="camera-rig" ref="camerarigTag">
      <a-entity camera id="camera" ref="cameraTag"
        look-controls="reverseMouseDrag: false; reverseTouchDrag: true; pointerLockEnabled: true;"
        wasd-controls="acceleration:35;"
        :simple-navmesh-constraint="`navmesh: #navmesh; fall: 1; height: ${defaultHeightOverGround};`"
        emit-move="interval: 20;" :position="`0 ${defaultHeightOverGround} 0`">
        <a-entity ref="cameraAttacher" :position="cameraAttacherPosString">
          <!-- <a-sphere position="0 0 0" color="red" scale="0.1 0.1 0.1" /> -->
        </a-entity>
        <!-- <a-entity ref="debugConeTag" position="0.5 -0.5 -1">
        <a-cone color="orange" scale="0.1 0.1 0.1" rotation="90 0 0" />
      </a-entity>
      <a-entity ref="debugConeTag2" position="0.9 -0.5 -1">
        <a-cone color="pink" scale="0.1 0.1 0.1" rotation="90 0 0" />
      </a-entity> -->

      </a-entity>
      <a-entity ref="leftHandTag" @controllerconnected="leftControllerConnected = true"
        @controllerdisconnected="leftControllerConnected = false" laser-controls="hand:left"
        :raycaster="`objects: ${currentRaycastSelectorString}; mouseCursorStyleEnabled: ${pointerOnHover}`"
        @xbuttondown="oculusButtons['x'] = true" @xbuttonup="oculusButtons['x'] = false"
        @ybuttondown="oculusButtons['y'] = true" @ybuttonup="oculusButtons['y'] = false"
        emit-move="interval: 20; relativeToCamera: true">
        <a-entity ref="leftHandVRGui" position="0 0 -0.06" rotation="-90 0 0"></a-entity>
        <!-- <a-entity :visible="leftControllerConnected" scale="0.05 0.05 0.05" rotation="20 90 -140"
        gltf-model="#avatar-hand-1" /> -->
      </a-entity>
      <a-entity ref="rightHandTag" @controllerconnected="rightControllerConnected = true"
        @controllerdisconnected="rightControllerConnected = false" laser-controls="hand:right"
        :raycaster="`objects: ${currentRaycastSelectorString}; mouseCursorStyleEnabled: ${pointerOnHover}`"
        @abuttondown="oculusButtons['a'] = true" @abuttonup="oculusButtons['a'] = false"
        @bbuttondown="oculusButtons['b'] = true" @bbuttonup="oculusButtons['b'] = false"
        emit-move="interval: 20; relativeToCamera: true">
        <!-- <a-entity :visible="rightControllerConnected" scale="0.05 0.05 -0.05" rotation="20 90 -140"
        gltf-model="#avatar-hand-1" /> -->
        <a-entity ref="rightHandVRGui" position="0 0 -0.06" rotation="-90 0 0"></a-entity>
      </a-entity>

    </a-entity>


    <Teleport v-if="overlayGUIRight" :to="overlayGUIRight">
      <div class="card bg-base-200 text-base-content p-4 text-xs pointer-events-auto">
        <!-- <div>
          <pre>normal:{{ currentCursorIntersection?.intersection.normal }}</pre>
          <pre>faceNormal:{{ currentCursorIntersection?.intersection.face?.normal }}</pre>
        </div> -->
        <p class="label-text font-bold">Personer i rummet</p>
        <p v-if="clientStore.clientState">
          {{ clientStore.clientState.username }}
          (du)
          <span
            v-if="vrSpaceStore.currentVrSpace.dbData.allowedUsers.some(u => u.user.userId === clientStore.clientState?.userId && hasAtLeastPermissionLevel(u.permissionLevel, 'admin'))">(admin)</span>
          <span v-if="vrSpaceStore.currentVrSpace.dbData.ownerUserId === clientStore.clientState.userId">(ägare)</span>
        </p>
        <p v-for="(clientInfo, id, idx) in otherClients" :key="id">
          {{ clientInfo.username }}
          <span
            v-if="vrSpaceStore.currentVrSpace.dbData.allowedUsers.some(u => u.user.userId === clientInfo.userId && hasAtLeastPermissionLevel(u.permissionLevel, 'admin'))">(admin)</span>
          <span v-if="vrSpaceStore.currentVrSpace.dbData.ownerUserId === clientInfo.userId">(ägare)</span>
        </p>
      </div>
    </Teleport>
    <!-- <Teleport v-if="overlayGUILeft" :to="overlayGUILeft">
      <button class="btn btn-primary pointer-events-auto" @click="positionCameraAttacher">place camera attacher</button>
      <div class="font-bold">isPresenting:{{ isImmersed }}</div>
    </Teleport> -->
    <Teleport v-if="rightHandVRGui" :to="rightHandVRGui">
      <!-- <a-entity position="0 0.1 0"
        mesh-ui-block="width: 0.3; height: 0.1; fontSize: 0.03; bestFit: auto; justifyContent: center" class="">
        <a-entity :mesh-ui-text="`fontColor: #0ff; content: i vr= ${isImmersed}`" />
      </a-entity> -->
    </Teleport>

    <!-- Avatars wrapper element -->
    <a-entity>
      <!-- The avatars -->
      <template v-for="(clientInfo, id) in otherClients" :key="id">
        <!-- <a-entity
          interpolated-transform="interpolationTime: 350;" ref="remoteAvatarHead">
          <a-sphere v-if="clientInfo.transform?.head?.active" color="red" scale="0.2 0.3 0.3 " />
          <a-troika-text look-at-camera :value="clientInfo.username" position="0 1.4 0" />
        </a-entity> -->
        <LaserPointerOther
          v-if="clientInfo.clientRealtimeData?.head?.active && clientInfo.clientRealtimeData?.laserPointer?.active"
          :position="clientInfo.clientRealtimeData.laserPointer.position"
          :position-source="clientInfo.clientRealtimeData?.head?.position" />
        <BasicAvatarEntity :client-info="clientInfo" v-if="clientInfo.clientRealtimeData?.head?.active"
          :username="clientInfo.username" :producers="clientInfo.producers"
          :real-time-data="clientInfo.clientRealtimeData"
          :avatar-design="clientInfo.avatarDesign ? clientInfo.avatarDesign : defaultAvatarDesign">

          <EmojiOther :active="clientInfo.clientRealtimeData?.emoji?.active"
            :coords="clientInfo.clientRealtimeData?.emoji?.active ? clientInfo.clientRealtimeData?.emoji?.coords : undefined" />
        </BasicAvatarEntity>

        <!-- <Avatar v-if="clientInfo.connectionId !== clientStore.clientState?.connectionId && clientInfo.transform"
          :id="'avatar-' + id" :client-info="clientInfo" /> -->
      </template>
    </a-entity>
  </template>
</template>

<script setup lang="ts">
import { type Entity, type DetailEvent, utils as aframeUtils, THREE } from 'aframe';
import { ref, onMounted, onBeforeMount, computed, onBeforeUnmount, inject, watch, onUpdated, shallowRef } from 'vue';
import Avatar from './AvatarEntity.vue';
import { defaultAvatarDesign, defaultHeightOverGround, hasAtLeastPermissionLevel, type ClientRealtimeData } from 'schemas';
// import type { Unsubscribable } from '@trpc/server/observable';
import { useClientStore } from '@/stores/clientStore';
import { useRouter } from 'vue-router';
import { useStreamStore } from '@/stores/streamStore';
import { useXRState } from '@/composables/XRState';
import { throttle, omit } from 'lodash-es';
// import type { SubscriptionValue, RouterOutputs } from '@/modules/trpcClient';
import emojiSheet from '@/assets/sprite-128.png';
import { useSoupStore } from '@/stores/soupStore';
import { useVrSpaceStore } from '@/stores/vrSpaceStore';
import { aFrameSceneProvideKey } from '@/modules/injectionKeys';
import { getAssetUrl } from '@/modules/utils';
import VrSpacePortal from '../entities/VrSpacePortal.vue';
import EmojiOther from './EmojiOther.vue';
import LaserPointerOther from './LaserPointerOther.vue';
import { useCurrentCursorIntersection, oculusButtons } from '@/composables/vrSpaceComposables';
import BasicAvatarEntity from './BasicAvatarEntity.vue';
import { generateSpawnPosition, arrToCoordString, quaternionTupleToAframeRotation } from '@/modules/3DUtils';
import PlacedAsset from './PlacedAsset.vue';
import { usePointerLock } from '@vueuse/core';
import { overlayGUILeft, overlayGUIRight, leftHandVRGui, rightHandVRGui, cameraAttacher } from '@/composables/teleportTargets';
const { currentCursorIntersection, triggerCursorClick, isCursorOnNavmesh, currentRaycastSelectorString, pointerOnHover } = useCurrentCursorIntersection();
const { lock, unlock, element } = usePointerLock();

const utilMatrix = new THREE.Matrix4();
const utilVector2 = new THREE.Vector2();
const utilVector3 = new THREE.Vector3();
watch(currentCursorIntersection, (intersection) => {
  // if (!intersection || !debugConeTag.value || !debugConeTag2) return;
  // let normal = intersection.intersection.normal;
  // let faceNormal = intersection.intersection.face?.normal
  // if (normal) {
  //   normal = utilVector.copy(normal);
  //   utilVector.multiplyScalar(2000);
  //   debugConeTag.value?.object3D.lookAt(utilVector);
  // }
  // if (faceNormal) {
  //   faceNormal = utilVector.copy(faceNormal);
  //   utilVector.multiplyScalar(2000);
  //   debugConeTag2.value?.object3D.lookAt(utilVector);
  // }

})

const router = useRouter();
// Stores
const vrSpaceStore = useVrSpaceStore();
const clientStore = useClientStore();
// const soupStore = useSoupStore();

// Props & emits
const props = defineProps({
  // modelUrl: {type: String, required: true},
  // navmeshUrl: {type: String, default: ''},
  showNavMesh: { type: Boolean, default: false },
  // modelScale: {type: Number, default: 1},
});

// A-frame
const { sceneTag } = inject(aFrameSceneProvideKey)!;
const { isImmersed } = useXRState(sceneTag);

const rightControllerConnected = ref(false);
const leftControllerConnected = ref(false);

const modelTag = ref<Entity>();
const cameraTag = ref<Entity>();
const threeCamera = shallowRef<THREE.PerspectiveCamera>();
const camerarigTag = ref<Entity>();
const leftHandTag = ref<Entity>();
const rightHandTag = ref<Entity>();

const navmeshId = computed(() => {
  return vrSpaceStore.navMeshUrl !== undefined ? 'navmesh' : 'model';
});

const otherClients = computed(() => {
  if (!vrSpaceStore.currentVrSpace) {
    console.warn('no current space, cant derived computed otherClients');
    return undefined;
  }
  if (!clientStore.clientState) {
    console.warn('no clientState, cant derived computed otherClients');
    return undefined;
  }
  return omit(vrSpaceStore.currentVrSpace.clients, [clientStore.clientState.connectionId]) as typeof vrSpaceStore.currentVrSpace.clients;
});

const skyColor = computed(() => {
  return vrSpaceStore.currentVrSpace?.dbData.skyColor ?? 'lightskyblue';
});

onBeforeMount(async () => {
  console.log('VrAframe onBeforeMount');
  // console.log('onBeforeMount completed');
});

onMounted(async () => {
  console.log('vrAframe onMounted');
  if (sceneTag.value) {
    sceneTag.value.addEventListener('loaded', onSceneLoaded);
    sceneTag.value.addEventListener('renderstart', onRenderStart);
    const sceneEl = sceneTag.value;
    sceneEl.camera && onCameraSetActive(sceneEl.camera as THREE.PerspectiveCamera);
    sceneEl.addEventListener('camera-set-active', function (evt: Event) {
      const detailEvt = evt as DetailEvent<{ cameraEl: Entity }>;
      const camera = detailEvt.detail.cameraEl.getObject3D('camera') as THREE.PerspectiveCamera;
      onCameraSetActive(camera);
    });
  }
  // console.log('onMounted completed');
});

onUpdated(() => {
  console.log('vrAframe onUpdated');
})

function onCameraSetActive(camera: THREE.PerspectiveCamera) {
  threeCamera.value = camera;
  console.log('camera loaded. attaching scene attributes', navmeshId.value);

  if (!sceneTag.value) {
    console.error('no sceneTag provided in onCameraLoaded');
    return;
  }
  sceneTag.value.sceneEl?.canvas.addEventListener('mousedown', () => {
    lock(sceneTag.value!.canvas);
  });
  window.addEventListener('mouseup', unlock)
}

onBeforeUnmount(async () => {
  // sceneTag.value?.removeAttribute('raycaster');
  // sceneTag.value?.removeAttribute('cursor');
  await vrSpaceStore.leaveVrSpace();
});

const cameraAttacherPosString = computed(() => {
  if (threeCamera.value) {
    const camera = threeCamera.value;
    console.log('computing the cameraAttacher position');
    const overCamera = new THREE.Vector3(0, 0.6, 0);
    console.log('camera:', camera);
    // return '0 0.2 -0.2';
    camera.getViewSize(1, utilVector2);
    overCamera.set(0, utilVector2.y * 0.5, -1);
    overCamera.setLength(0.3);
    if (isImmersed.value) {
      overCamera.y -= 0.05;
    }
    console.log(overCamera);
    return arrToCoordString(overCamera.toArray());
  }
  return '0 0.2 -0.2';
})

async function onModelLoaded() {
  if (modelTag.value) {
    let startPos = getRandomSpawnPosition();
    if (!startPos) {
      console.log('failed to calculate spawnpoint. centering player on model bbox as fallback');
      const obj3D = modelTag.value.getObject3D('mesh') as THREE.Object3D;
      const bbox = new THREE.Box3().setFromObject(obj3D);
      startPos = new THREE.Vector3();
      bbox.getCenter(startPos);
    }
    // startPos.y += defaultHeightOverGround + 0.05;
    console.log('placing cameraRig at start position', startPos);
    // headTag.value.object3D.position.set(startPos.x, startPos.y, startPos.z);
    camerarigTag.value?.object3D.position.set(...startPos.toArray());

    // const worldPos = headTag.value!.object3D.getWorldPosition(new THREE.Vector3());
    // const worldRot = headTag.value!.object3D.getWorldQuaternion(new THREE.Quaternion());
    // await new Promise((res) => setTimeout(res, 200));
    // vrSpaceStore.ownClientTransform.head = {
    //   active: true,
    //   position: startPos.toArray(),
    //   rotation: worldRot.toArray() as THREE.Vector4Tuple,
    // }

    // vrSpaceStore.updateTransform(trsfm);
    // placeRandomSpheres();

    // @ts-ignore
    cameraTag.value?.addEventListener('move', onHeadMove);
    // @ts-ignore
    leftHandTag.value?.addEventListener('move', onLeftHandMove);
    // @ts-ignore
    rightHandTag.value?.addEventListener('move', onRightHandMove);
  }
}

function onSceneLoaded(evt: Event) {
  console.log('scene loaded:', evt);
  const scene = sceneTag.value
  if (!scene) {
    console.error("scene loaded event, but scenetag was undefined");
    return;
  };
  rightHandTag.value?.setAttribute('blink-controls', {
    cameraRig: '#camera-rig',
    teleportOrigin: '#camera',
    collisionEntities: '#navmesh',
  })
  // blink-controls="cameraRig: #camera-rig; teleportOrigin: #camera; collisionEntities: #navmesh;"
}
function onRenderStart(evt: Event) {
  console.log('render started:', evt);
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
  const spawnPosition = vrSpaceStore.currentVrSpace?.dbData.spawnPosition;
  if (!spawnPosition) {
    console.error('spawnPosition in vrSpace is not set. failing to generate random spawn point');
    return;
  }
  let spawnRadius = vrSpaceStore.currentVrSpace?.dbData.spawnRadius;
  if (!spawnRadius) {
    console.warn('spawnRadius not set. Using 1 as fallback');
    spawnRadius = 1;
  }
  return generateSpawnPosition(spawnPosition, spawnRadius);
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
function onHeadMove(e: DetailEvent<ClientRealtimeData['head']>) {
  vrSpaceStore.ownRealtimeData.head = e.detail;
  // console.log('head moved', e.detail.position!);
  // console.log(e.detail.position);
  // currentTransform.head = e.detail;
}
function onLeftHandMove(e: DetailEvent<ClientRealtimeData['leftHand']>) {
  vrSpaceStore.ownRealtimeData.leftHand = e.detail;
  // console.log('left hand moved');
  // currentTransform.leftHand = e.detail;
}
function onRightHandMove(e: DetailEvent<ClientRealtimeData['rightHand']>) {
  vrSpaceStore.ownRealtimeData.rightHand = e.detail;
  // console.log('right hand moved');
  // console.log(e.detail?.orientation);
  // console.log(e.detail?.position);
  // currentTransform.rightHand = e.detail;
}

function onNavmeshClicked(e: Event) {
  // console.log('navmesh clicked', e);
  // triggerClick(e)
  // bus.emit({ model: 'navmesh', cursorObject: cursorEntity.value?.object3D });
}

const timeMouseDown = ref(0);
function teleportMouseDown(e: Event) {
  timeMouseDown.value = e.timeStamp;
}

function teleportSelf(e: Event) {
  if (!cameraTag.value || !currentCursorIntersection.value) { return; }
  if (e.timeStamp - timeMouseDown.value > 150) { return; }
  let posArray = currentCursorIntersection.value?.intersection.point.toArray();
  posArray[1] += defaultHeightOverGround;
  console.log('Click model', e, 'cursor', currentCursorIntersection.value, 'position array', posArray);
  cameraTag.value.object3D.position.set(posArray[0], posArray[1], posArray[2]);
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
