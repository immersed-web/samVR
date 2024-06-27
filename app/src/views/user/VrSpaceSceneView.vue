<template>
  <div>
    <div class="min-h-screen z-0">
      <h2>VrSpace main scene</h2>
      <div class="pointer-events-none *:pointer-events-auto" ref="domOutlet" id="aframe-dom-outlet" />
      <WaitForAframe>
        <a-scene ref="sceneTag" cursor="fuse:false; rayOrigin:mouse;" raycaster="objects: .clickable" raycaster-update
          @raycast-update="updateCursor($event.detail)">
          <VrAFrame v-if="vrSpaceStore.worldModelUrl" :show-nav-mesh="false">

            <a-entity id="tp-aframe-cursor" :position="currentCursor?.intersection.point.toArray().join(' ')"
              :visible="true">
              <a-ring color="yellow" radius-inner="0.1" radius-outer="0.2" material="shader: flat;"
                rotation="-90 0 0" />
              <LaserPointerSelf @update="onLaserPointerUpdate" />
            </a-entity>
          </VrAFrame>
        </a-scene>
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
import { useCurrentCursorIntersection } from '@/composables/vrSpaceComposables';
import LaserPointerSelf from '@/components/lobby/LaserPointerSelf.vue';
import type { RayIntersectionData } from '@/modules/3DUtils';
const { updateCursor, currentCursor } = useCurrentCursorIntersection()

const router = useRouter();
const vrSpaceStore = useVrSpaceStore();

const props = defineProps<{
  vrSpaceId: VrSpaceId
}>()
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

onBeforeMount(async () => {
  await vrSpaceStore.enterVrSpace(props.vrSpaceId);
});

</script>

