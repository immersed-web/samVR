<template>
  <div class="relative w-full h-full min-h-[20rem] select-none touch-none bg-neutral text-neutral-content" @pointerdown="onDown" @pointermove="onMove"
    @pointerup="onUp" @pointercancel="onUp" @wheel.prevent="onWheel">
    <WaitForAframe>
      <a-scene embedded class="absolute inset-0" background="color: #1c2030" vr-mode-ui="enabled: false"
        renderer="antialias: true" ref="sceneTag">
        <a-entity light="type: ambient; intensity: 0.55" />
        <a-entity light="type: directional; intensity: 0.9" position="1.5 3 2" />
        <a-entity light="type: directional; intensity: 0.35" position="-2 1 -2" />
        <a-entity ref="pivot">
          <a-entity ref="modelTag" :gltf-model="`url(${src})`" />
        </a-entity>
        <a-entity ref="cameraTag" camera position="0 0 3.4" look-controls="enabled: false" wasd-controls="enabled: false" />
      </a-scene>
    </WaitForAframe>
    <div v-if="status !== 'ready'" class="absolute inset-0 grid place-content-center text-neutral-content/80 pointer-events-none">
      <span v-if="status === 'error'" class="text-center px-6">Modellen kunde inte visas. Du kan ladda ned filen i stället.</span>
      <span v-else class="loading loading-infinity loading-lg"></span>
    </div>
    <div class="absolute bottom-2 left-3 text-xs text-neutral-content/60 pointer-events-none">Dra för att rotera · rulla för att zooma</div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { THREE, type Entity } from 'aframe';
import WaitForAframe from '@/components/WaitForAframe.vue';

/** A simple viewer for a .glb model: fits it into view, drag to rotate, wheel to zoom. Read-only, nothing is saved. */
const props = defineProps<{ src: string }>();

const pivot = ref<Entity>();
const modelTag = ref<Entity>();
const cameraTag = ref<Entity>();
const sceneTag = ref<HTMLElement>();
const status = ref<'loading' | 'ready' | 'error'>('loading');

function fit() {
  const model = modelTag.value;
  const mesh = model?.getObject3D('mesh');
  if (!model || !mesh) return;
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z) || 1;
  const scale = 2 / largest; // the longest side becomes 2 units
  model.object3D.scale.setScalar(scale);
  model.object3D.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  status.value = 'ready';
}

let listenersOn: { model: Entity, loaded: () => void, failed: () => void } | undefined;
function attach() {
  const model = modelTag.value;
  if (!model) return;
  const loaded = () => fit();
  const failed = () => { status.value = 'error'; };
  model.addEventListener('model-loaded', loaded);
  model.addEventListener('model-error', failed);
  listenersOn = { model, loaded, failed };
  if (model.getObject3D('mesh')) fit(); // already loaded
}
onMounted(() => {
  // A-Frame registers its components asynchronously, so wait for the elements to exist
  const timer = setInterval(() => { if (modelTag.value) { clearInterval(timer); attach(); } }, 100);
  setTimeout(() => clearInterval(timer), 10_000);
});
onBeforeUnmount(() => {
  listenersOn?.model.removeEventListener('model-loaded', listenersOn.loaded);
  listenersOn?.model.removeEventListener('model-error', listenersOn.failed);
});
watch(() => props.src, () => { status.value = 'loading'; });

// ---- drag to rotate, wheel to zoom ----
let dragging = false;
let last = { x: 0, y: 0 };
const onDown = (e: PointerEvent) => { dragging = true; last = { x: e.clientX, y: e.clientY }; try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* not all pointers can be captured */ } };
const onUp = () => { dragging = false; };
function onMove(e: PointerEvent) {
  if (!dragging || !pivot.value) return;
  const rotation = pivot.value.object3D.rotation;
  rotation.y += (e.clientX - last.x) * 0.01;
  rotation.x = Math.max(-1.4, Math.min(1.4, rotation.x + (e.clientY - last.y) * 0.01));
  last = { x: e.clientX, y: e.clientY };
}
function onWheel(e: WheelEvent) {
  const camera = cameraTag.value?.object3D;
  if (!camera) return;
  camera.position.z = Math.max(1.2, Math.min(8, camera.position.z + e.deltaY * 0.002));
}
</script>
