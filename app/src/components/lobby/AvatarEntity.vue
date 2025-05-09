<template>
  <a-entity @loaded="onAvatarEntityLoaded" ref="avatarRootTag">
    <Teleport v-if="overlayGUIRight" :to="overlayGUIRight">
      <div>{{ clientInfo.clientRealtimeData?.head }}</div>
    </Teleport>
    <!-- <a-entity :id="`head-${props.clientInfo.connectionId}`" ref="remoteAvatar"
      interpolated-transform="interpolationTime: 350;" mediastream-audio-source @near-range-entered="onNearRangeEntered"
      @near-range-exited="onNearRangeExited"> -->
    <a-entity :id="`head-${props.clientInfo.connectionId}`" ref="remoteAvatar"
      interpolated-transform="interpolationTime: 350;">
      <!-- <a-entity scale="1 1 1">
        <a-entity :id="`left-hand-${props.clientInfo.connectionId}`" visible="false"
          interpolated-transform="interpolationTime: 350;" ref="leftHandTag">
          <a-entity scale="0.05 0.05 0.05" rotation="-20 90 -140" gltf-model="#avatar-hand-1" />
        </a-entity>
      </a-entity>
      <a-entity scale="1 1 1">
        <a-entity :id="`right-hand-${props.clientInfo.connectionId}`" visible="false"
          interpolated-transform="interpolationTime: 350;" ref="rightHandTag">
          <a-entity scale="0.05 0.05 -0.05" rotation="20 90 -140" gltf-model="#avatar-hand-1" />
        </a-entity>
      </a-entity> -->

      <!-- <a-text
        class="distance-debug"
        value="unset"
        position="1 1 0"
        side="double"
      /> -->
      <a-entity rotation="0 180 0">
        <a-entity position="0 0 0">
          <a-entity :gltf-model="`url(/avatar/hair/${clientInfo.avatarDesign?.parts.heads.model}.glb)`" />
          <a-entity :gltf-model="`url(/avatar/heads/${clientInfo.avatarDesign?.parts.heads.model}.glb)`" />
          <!-- <a-entity :gltf-model="`url(/models/avatar/eyes/Eyes${Math.trunc(Math.random()+1.5)}.glb)`" /> -->
          <!-- <a-entity gltf-model="#avatar-eyes-5" /> -->
          <!-- <a-entity position="0 -0.05 0" class="audio-level">
            <a-entity position="0 0.05 0.002" gltf-model="#avatar-mouth-1" />
          </a-entity> -->
        </a-entity>
        <a-entity ref="lowerBodyTag">
          <a-entity @loaded="onBodyLoaded"
            :gltf-model="`url(/avatar/torsos/${clientInfo.avatarDesign?.parts.torsos.model}.glb)`" />
        </a-entity>
      </a-entity>
      <audio ref="dummyAudioTag" muted autoplay playsinline />
    </a-entity>
  </a-entity>
</template>

<script setup lang="ts">

import type { Entity, DetailEvent } from 'aframe';
import type { ConnectionId, MaybeTransform } from 'schemas';
import { ref, computed, watch, onMounted, onBeforeUnmount, shallowRef } from 'vue';
import type { useVrSpaceStore } from '@/stores/vrSpaceStore';
import type { ProducerId } from 'schemas/mediasoup';
import { useSoupStore } from '@/stores/soupStore';
import { overlayGUIRight } from '@/composables/teleportTargets';

// Props & emits
const props = defineProps<{
  clientInfo: NonNullable<ReturnType<typeof useVrSpaceStore>['currentVrSpace']>['clients'][ConnectionId]
}>();
const soupStore = useSoupStore();

// Distance to client camera callbacks
const distanceColor = ref('white');
async function onNearRangeEntered(e: CustomEvent<number>) {
  // console.log('onNearRangeEntered called', e.detail);
  distanceColor.value = 'green';
  if (stream.value) return;
  stream.value = await getStreamFromProducerId(producerId.value);
}

function onNearRangeExited(e: CustomEvent<number>) {
  distanceColor.value = 'white';
  if (producerId.value && soupStore.consumers.has(producerId.value)) {
    closeConsumer();
  }
  stream.value = undefined;
  // console.log('Went away', e.detail);
}
onMounted(async () => {
  console.log('remoteAvatar mounted');
  if (!remoteAvatar.value) {
    console.error('remoteAvatar entity ref undefined');
    return;
  }
});
onBeforeUnmount(async () => {
  console.log('remoteAvatar will unmount');
  const videoPId = props.clientInfo.producers.videoProducer?.producerId;
  if (videoPId && soupStore.consumers.has(videoPId)) {
    console.log('gonna close (video)consumer with producerId:', videoPId);
    await soupStore.closeConsumer(videoPId);
  }
  const audioPId = props.clientInfo.producers.audioProducer?.producerId;
  if (audioPId && soupStore.consumers.has(audioPId)) {
    console.log('gonna close (audio)consumer with producerId:', audioPId);
    await soupStore.closeConsumer(audioPId);
  }
});

const remoteAvatar = ref<Entity>();
const avatarRootTag = ref<Entity>();
const lowerBodyTag = ref<Entity>();
const leftHandTag = ref<Entity>();
const rightHandTag = ref<Entity>();
const dummyAudioTag = ref<HTMLAudioElement>();
watch(() => props.clientInfo, (n, o) => console.log('remoteAvatar prop updated. new:', n, ' old:', o));
watch(() => props.clientInfo.clientRealtimeData?.head, (newTransform) => {
  // console.log('head updated: ', newTransform?.position);
  // console.log('remote avatar transform updated!');
  if (!remoteAvatar.value) {
    console.error('couldnt update avatar transform cause entityRef was undefined');
    return;
  }
  if (!newTransform) {
    console.warn('clientInfo transform was undefined');
    return;
  }
  if (!newTransform.active) {
    console.error('received an inactive transform. bailing out');
    return;
  }
  // console.log('emitting received transform to avatar entity');
  remoteAvatar.value.emit('moveTo', { position: newTransform.position }, false);
  remoteAvatar.value.emit('rotateTo', { rotation: newTransform.rotation }, false);
});

function handleReceivedHandTransform(newTransform: MaybeTransform | undefined, oldTransform: MaybeTransform | undefined, handEntity: Entity) {
  // Hide hand if no transform is received
  if (!newTransform) {
    handEntity.setAttribute('visible', false);
    return;
  }
  handEntity.setAttribute('visible', true);
  // show hand and set transform directly if went from undefined to tansformdata
  if (!oldTransform) {
    handEntity.emit('setTransform', newTransform);
    return;
  }
  // tansform was updated. Lets move the hand
  handEntity.emit('moveTo', { position: newTransform.position }, false);
  handEntity.emit('rotateTo', { orientation: newTransform.orientation }, false);
}

// watch(() => props.clientInfo.transform?.leftHand, (newTrsfm, oldT) => {
//   // console.log(`${props.clientInfo.username}, left hand updated ${newTrsfm?.position}`);
//   if (!leftHandTag.value) {
//     console.error('no hand model tag found');
//     return;
//   };
//   handleReceivedHandTransform(newTrsfm, oldT, leftHandTag.value);
// });

// watch(() => props.clientInfo.transform?.rightHand, (newTrsfm, oldT) => {
//   // console.log(`${props.clientInfo.username}, right hand updated ${newTrsfm?.position}`);
//   if (!rightHandTag.value) {

//     console.error('no hand model tag found');
//     return;
//   }
//   handleReceivedHandTransform(newTrsfm, oldT, rightHandTag.value);
// });

let stream = shallowRef<MediaStream>();
watch(stream, () => {
  if (!stream.value) {
    console.error('stream became undefined');
    return;
  }
  if (!dummyAudioTag.value) {
    console.error('audio dummytag was undefined');
    return;
  }
  dummyAudioTag.value.srcObject = stream.value;
  if (!remoteAvatar.value?.hasLoaded) {
    console.warn('skipping to emit stream because aframe entity (and thus the components) was not yet ready or undefined');
    return;
  }
  console.log('emitting stream for avatar after stream was updated:', stream.value);
  remoteAvatar.value.emit('setMediaStream', { stream: stream.value });
});

const producerId = computed(() => props.clientInfo.producers.audioProducer?.producerId);

// watch(producerId, async (newAudioProducerId, oldAudioProducerId) => {
//   console.log('audioProducer was updated. new:', newAudioProducerId, ' old:', oldAudioProducerId);
//   if(!newAudioProducerId){
//     console.log('newProducer was undefined');
//     return;
//   }
//   stream.value = await getStreamFromProducerId(newAudioProducerId);
// }, {immediate: false});

async function onAvatarEntityLoaded(e: DetailEvent<any>) {
  // console.log('avatar a-entity loaded!');
  // NOTE: For some reason the event isnt received by the entity if we dont put it on the event queue.
  // I guess there is something that makes the entity trigger the loaded event before it is _actually_ fully ready.
  await new Promise(res => setTimeout(res, 0));
  if (!remoteAvatar.value) {
    console.error('remoteAvatar was undefined');
    return;
  }
  remoteAvatar.value.emit('setTransform', props.clientInfo.clientRealtimeData?.head);
  if (!stream.value) {
    console.log('stream is undefined. Will not emit');
    return;
  }
  console.log('emitting mediastream to entity after avatar entity loaded', stream.value);
  remoteAvatar.value.emit('setMediaStream', { stream: stream.value });
}

function onBodyLoaded() {
  // console.log('body entity was loaded!');
  // const lockRotationString = `#head-${props.clientInfo.connectionId}`
  lowerBodyTag.value?.setAttribute('lock-rotation-axis', true);
}

async function getStreamFromProducerId(producerId?: ProducerId) {
  // console.log('getStreamFromProducerId called');
  if (!producerId) return undefined;
  let consumerData = soupStore.consumers.get(producerId);
  if (!consumerData) {
    await soupStore.consume(producerId);
    consumerData = soupStore.consumers.get(producerId)!;
    // return new MediaStream([track]);
  }
  // rtpReceiver = consumerData.consumer.rtpReceiver;
  return new MediaStream([consumerData.consumer.track]);
}

async function closeConsumer() {
  if (!producerId.value) return;
  soupStore.closeConsumer(producerId.value);
}

</script>

<style scoped></style>
