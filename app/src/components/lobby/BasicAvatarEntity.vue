<template>

  <a-entity interpolated-transform="interpolationTime: 350;" @near-range-entered="onNearRangeEntered"
    @near-range-exited="onNearRangeExited" ref="avatarEntity" mediastream-audio-source @loaded="onAvatarEntityLoaded">
    <Teleport to="#teleport-target-ui-right">
      <pre>{{ username }} {{ distanceColor }} {{ stream }} {{ producers }}</pre>
    </Teleport>
    <slot />
    <a-troika-text :color="distanceColor" look-at-camera :value="username" position="0 0.5 0" />
    <a-entity rotation="0 180 0">
      <a-entity position="0 0 0">
        <AvatarPart v-for="(part, key) in headGroupedParts" :key="key" :part-name="key" :part="part" />
        <AvatarSkinPart skin-part-name="heads" :part="avatarDesign.parts.heads" :skin-color="avatarDesign.skinColor" />
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
</template>

<script setup lang="ts">

import type { useVrSpaceStore } from '@/stores/vrSpaceStore';
import type { Entity } from 'aframe';
import type { ProducerId } from 'schemas/mediasoup';
import { skinParts as skinPartArray, type ConnectionId } from 'schemas'
import { computed, onBeforeMount, onMounted, ref, shallowRef, watch } from 'vue';
import AvatarPart from './AvatarPart.vue';
import AvatarSkinPart from './AvatarSkinPart.vue';
import { omit, pick } from 'lodash-es';
import { useSoupStore } from '@/stores/soupStore';

const soupStore = useSoupStore();

const producerId = computed(() => props.producers.audioProducer?.producerId);

type _ClientInfo = NonNullable<ReturnType<typeof useVrSpaceStore>['currentVrSpace']>['clients'][ConnectionId]

const props = defineProps<{
  username: _ClientInfo['username']
  producers: _ClientInfo['producers']
  avatarDesign: NonNullable<_ClientInfo['avatarDesign']>
  realTimeData: NonNullable<_ClientInfo['clientRealtimeData']>
}>();

const headGroupedParts = computed(() => {
  const omittedParts = ['layer', 'clothes', 'mouths', ...skinPartArray] as const;
  return omit(props.avatarDesign.parts, omittedParts);
})

const avatarEntity = ref<Entity>();
const dummyAudioTag = ref<HTMLAudioElement>();

async function onAvatarEntityLoaded() {
  console.log('avatar a-entity loaded!');
  if (!avatarEntity.value) {
    console.error('avatarEntity was undefined');
    return;
  }
  if (props.realTimeData.head.active) {
    // NOTE: For some reason the event isnt received by interpolated-transform if we dont put it on the event queue.
    // I guess there is something that makes the entity trigger the loaded event before it is _actually_ fully ready.
    await new Promise(res => setTimeout(res, 0));
    console.log('avatarentity: setting head transform', props.realTimeData.head);
    avatarEntity.value.emit('setTransform', props.realTimeData.head);
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
  stream.value = await getStreamFromProducerId(producerId.value);
}

function onNearRangeExited(e: CustomEvent<number>) {
  // console.log('onNearRangeExited called', e.detail);
  distanceColor.value = 'white';
  if (producerId.value && soupStore.consumers.has(producerId.value)) {
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
  console.log('getStreamFromProducerId called');
  if (!producerId) return undefined;
  let consumerData = soupStore.consumers.get(producerId);
  if (!consumerData) {
    await soupStore.consume(producerId);
    consumerData = soupStore.consumers.get(producerId)!;
  }
  return new MediaStream([consumerData.consumer.track]);
}

async function closeConsumer() {
  if (!producerId.value) return;
  soupStore.closeConsumer(producerId.value);
}

watch(() => props.realTimeData.head, (headTransform) => {
  if (!headTransform.active) return;
  // console.log('updating head', headTransform.position);
  avatarEntity.value?.emit('moveTo', { position: headTransform.position }, false);
  avatarEntity.value?.emit('rotateTo', { rotation: headTransform.rotation }, false);
}, { immediate: true });

</script>