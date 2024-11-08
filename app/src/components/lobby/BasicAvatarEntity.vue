<template>

  <a-entity>

    <a-video ref="screenShareAVideoTag" v-if="screenshareStream" src="#incoming-screen-video" side="double"
      :position="arrToCoordString(clientInfo.screenShare?.transform.position ?? [0, 0, 0])"
      :rotation="arrToCoordString(quaternionTupleToAframeRotation(clientInfo.screenShare?.transform.rotation ?? [0, 0, 0, 1]))"
      :width="screenShareDimensions.width" :height="screenShareDimensions.height" />
    <video @resize="onVideoResize" ref="screenVideoTag" id="incoming-screen-video" autoplay playsinline
      webkit-playsinline crossorigin="anonymous" />
    <a-entity interpolated-transform="interpolationTime: 350;" @near-range-entered="onNearRangeEntered"
      @near-range-exited="onNearRangeExited" ref="avatarEntity" mediastream-audio-source @loaded="onAvatarEntityLoaded">
      <Teleport v-if="overlayGUIRight" :to="overlayGUIRight">
        <pre class="text-xs whitespace-normal">videoStream: {{ screenshareStream }}</pre>
        <pre class="text-xs whitespace-normal">videoProducerId: {{ videoProducerId }}</pre>
      </Teleport>
      <a-entity scale="1 1 1">
        <a-entity :id="`left-hand-${props.clientInfo.connectionId}`"
          :visible="clientInfo.clientRealtimeData?.leftHand?.active" interpolated-transform="interpolationTime: 350;"
          ref="leftHandTag">
          <AvatarHand />
        </a-entity>
      </a-entity>
      <a-entity scale="1 1 1">
        <a-entity :id="`right-hand-${props.clientInfo.connectionId}`"
          :visible="clientInfo.clientRealtimeData?.rightHand?.active" interpolated-transform="interpolationTime: 350;"
          ref="rightHandTag">
          <AvatarHand side="right" />
        </a-entity>
      </a-entity>
      <slot />
      <a-troika-text :color="distanceColor" look-at-camera :value="clientInfo.username" position="0 0.5 0" />
      <a-entity rotation="0 180 0">
        <a-entity position="0 0 0">
          <AvatarPart v-for="(part, key) in headGroupedParts" :key="key" :part-name="key" :part="part" />
          <AvatarSkinPart skin-part-name="heads" :part="avatarDesign.parts.heads"
            :skin-color="avatarDesign.skinColor" />
          <a-entity position="0 0 0" class="audio-level">
            <AvatarPart part-name="mouths" :part="avatarDesign.parts.mouths" />
          </a-entity>
        </a-entity>
        <a-entity ref="lowerBodyTag" lock-rotation-axis>
          <AvatarSkinPart skin-part-name="torsos" :part="avatarDesign.parts.torsos"
            :skin-color="avatarDesign.skinColor" />
          <AvatarPart part-name="clothes" :part="avatarDesign.parts.clothes" />
          <AvatarPart part-name="layer" :part="avatarDesign.parts.layer" />
        </a-entity>
      </a-entity>
      <audio ref="dummyAudioTag" muted autoplay playsinline />
    </a-entity>
  </a-entity>
</template>

<script setup lang="ts">

import type { useVrSpaceStore } from '@/stores/vrSpaceStore';
import type { Entity } from 'aframe';
import type { ProducerId } from 'schemas/mediasoup';
import { defaultAvatarDesign, skinParts as skinPartArray, type ConnectionId } from 'schemas'
import { computed, onBeforeMount, onMounted, reactive, ref, shallowRef, toRefs, watch } from 'vue';
import AvatarPart from './AvatarPart.vue';
import AvatarSkinPart from './AvatarSkinPart.vue';
import { omit, pick } from 'lodash-es';
import { useSoupStore } from '@/stores/soupStore';
// import { asyncComputed } from '@vueuse/core';
import { arrToCoordString, quaternionTupleToAframeRotation } from '@/modules/3DUtils';
import { overlayGUIRight } from '@/composables/teleportTargets';
import AvatarHand from '@/components/entities/AvatarHand.vue';

const soupStore = useSoupStore();

type _ClientInfo = NonNullable<ReturnType<typeof useVrSpaceStore>['currentVrSpace']>['clients'][ConnectionId]

const props = defineProps<{
  clientInfo: _ClientInfo,
  // username: _ClientInfo['username']
  // producers: _ClientInfo['producers']
  // avatarDesign: NonNullable<_ClientInfo['avatarDesign']>
  // realTimeData: NonNullable<_ClientInfo['clientRealtimeData']>
}>();

const audioProducerId = computed(() => props.clientInfo.producers.audioProducer?.producerId);
const videoProducerId = computed(() => {
  console.log('videoProducerId computed evaluated');
  // const producers = props.producers;
  // const videoProducer = producers.videoProducer;
  const videoProducer = props.clientInfo.producers.videoProducer;
  if (!videoProducer) return undefined
  return videoProducer.producerId
});

const screenVideoTag = ref<HTMLVideoElement>();
const screenShareAVideoTag = ref<Entity>();
const screenShareDimensions = reactive({
  width: 3,
  height: 1.75,
});
function onVideoResize(e: Event) {
// console.log('video resize', e);
  const vTag = e.target as HTMLVideoElement;
  const { videoWidth, videoHeight } = vTag;
  const ratio = videoWidth / videoHeight;
  const scale = props.clientInfo.screenShare?.transform.scale ?? 1;
  screenShareDimensions.width = scale * ratio;
  screenShareDimensions.height = scale;
}

const screenshareStream = shallowRef<MediaStream>();

watch(() => props.clientInfo.screenShare, async (newScreenShare, prevScreenShare) => {
  console.log('clientinfo screenshare watcher triggered:', stream);
  if (!newScreenShare) {
    if (!prevScreenShare) {
      console.warn('watcher triggered but both newScreenShare and prevScreenShare was undefined. Should not be possible?');
      return
    }
    await soupStore.closeConsumer(prevScreenShare.producerId)
    screenshareStream.value = undefined;
    return;
  };
  screenshareStream.value = await getStreamFromProducerId(newScreenShare.producerId);
  if (!screenshareStream.value) {
    console.error('failed to get videostream from producer id:', newScreenShare.producerId);
    return;
  }
  // const aVideoTag = screenShareAVideoTag.value;
  // if (!aVideoTag) return;
  // aVideoTag.object3D.position.set(...newScreenShare.transform.position)
  // aVideoTag.object3D.rotation.setFromQuaternion(new THREE.Quaternion().fromArray(newScreenShare.transform.rotation))
  const videoTag = screenVideoTag.value;
  if (!videoTag) return;
  videoTag.srcObject = screenshareStream.value;
  videoTag.play();
})

const avatarDesign = computed(() => {
  if (props.clientInfo.avatarDesign) return props.clientInfo.avatarDesign;
  console.warn('No avatardesign provided. Using the default one!!!');
  return defaultAvatarDesign;
})

const headGroupedParts = computed(() => {
  const omittedParts = ['layer', 'clothes', 'mouths', ...skinPartArray] as const;
  return omit(avatarDesign.value.parts, omittedParts);
})

const avatarEntity = ref<Entity>();
const leftHandTag = ref<Entity>();
const rightHandTag = ref<Entity>();
const dummyAudioTag = ref<HTMLAudioElement>();

async function onAvatarEntityLoaded() {
  console.log('avatar a-entity loaded!');
  if (!avatarEntity.value) {
    console.error('avatarEntity was undefined');
    return;
  }
  if (props.clientInfo.clientRealtimeData?.head.active) {
    // NOTE: For some reason the event isnt received by interpolated-transform if we dont put it on the event queue.
    // I guess there is something that makes the entity trigger the loaded event before it is _actually_ fully ready.
    await new Promise(res => setTimeout(res, 0));
    console.log('avatarentity: setting head transform', props.clientInfo.clientRealtimeData.head);
    avatarEntity.value.emit('setTransform', props.clientInfo.clientRealtimeData.head);
  }
  if (!stream.value) {
    console.log('stream is undefined. Will not emit');
    return;
  }
  console.log('emitting mediastream to entity after avatar entity loaded', stream.value);
  avatarEntity.value.emit('setMediaStream', { stream: stream.value });
}

// Distance to client camera callbacks
const distanceColor = ref('white');
async function onNearRangeEntered(e: CustomEvent<number>) {
  // console.log('onNearRangeEntered called', e.detail);
  distanceColor.value = 'green';
  if (stream.value) return;
  stream.value = await getStreamFromProducerId(audioProducerId.value);
}

function onNearRangeExited(e: CustomEvent<number>) {
  // console.log('onNearRangeExited called', e.detail);
  distanceColor.value = 'white';
  if (audioProducerId.value && soupStore.consumers.has(audioProducerId.value)) {
    closeConsumer();
  }
  stream.value = undefined;
}

let stream = shallowRef<MediaStream>();
watch(stream, () => {
  if (!stream.value) {
    // console.error('stream became undefined');
    return;
  }
  if (!dummyAudioTag.value) {
    console.error('audio dummytag was undefined');
    return;
  }
  dummyAudioTag.value.srcObject = stream.value;
  if (!avatarEntity.value?.hasLoaded) {
    console.warn('skipping to emit stream because aframe entity (and thus the components) was not yet ready or undefined');
    return;
  }
  console.log('emitting stream for avatar after stream was updated:', stream.value);
  avatarEntity.value.emit('setMediaStream', { stream: stream.value });
});


async function getStreamFromProducerId(producerId?: ProducerId) {
  // console.log('getStreamFromProducerId called');
  // if (!producerId) return undefined;
  // let consumerData = soupStore.consumers.get(producerId);
  // if (!consumerData) {
  //   await soupStore.consume(producerId);
  //   consumerData = soupStore.consumers.get(producerId)!;
  // }
  const consumerData = await soupStore.getOrCreateConsumerFromProducerId(producerId);
  if (!consumerData) return undefined;
  return new MediaStream([consumerData.consumer.track]);
}

async function closeConsumer() {
  if (!audioProducerId.value) return;
  soupStore.closeConsumer(audioProducerId.value);
}

watch(() => props.clientInfo.clientRealtimeData?.head, (headTransform) => {
  if (!headTransform?.active) return;
  // console.log('updating head', headTransform.position);
  avatarEntity.value?.emit('moveTo', { position: headTransform.position }, false);
  avatarEntity.value?.emit('rotateTo', { rotation: headTransform.rotation }, false);
}, { immediate: true });
watch(() => props.clientInfo.clientRealtimeData?.leftHand, (leftHandTransform) => {
  console.log('leftHand updated:', leftHandTransform);
  if (!leftHandTransform?.active) return;
  leftHandTag.value?.emit('moveTo', { position: leftHandTransform.position }, false);
  leftHandTag.value?.emit('rotateTo', { rotation: leftHandTransform.rotation }, false);
}, { immediate: true });
watch(() => props.clientInfo.clientRealtimeData?.rightHand, (rightHandTransform) => {
  console.log('rightHand updated:', rightHandTransform);
  if (!rightHandTransform?.active) return;
  rightHandTag.value?.emit('moveTo', { position: rightHandTransform.position }, false);
  rightHandTag.value?.emit('rotateTo', { rotation: rightHandTransform.rotation }, false);
}, { immediate: true });

</script>