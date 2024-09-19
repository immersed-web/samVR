import { computed, ref, readonly, shallowReadonly, shallowRef, type Ref, watch, type WatchStopHandle } from 'vue';
import { THREE, type Entity } from 'aframe';
import { type EventBusKey } from '@vueuse/core';
import { createEventHook } from '@vueuse/core';
import { intersectionToTransform, type AframeClickeventData, type RayIntersectionData } from '@/modules/3DUtils';
import type { PlacedObject } from 'schemas';

export type Tuple = [number, number]

// #region Raycast & intersection
const writableIntersection = shallowRef<RayIntersectionData>();
const rayIntersectionData = shallowReadonly(writableIntersection);
function setCursorIntersection(intersectionData: RayIntersectionData | undefined) {
  // intersectionData?.intersection.object.
  // console.log('currentCursor updated:', intersectionData);
  writableIntersection.value = intersectionData;
}
export type CursorMode = `place-${PlacedObject['type'] | 'spawnpoint'}` | 'teleport' | 'enterFirstPersonView' | 'hover' | undefined

const currentCursorMode = ref<CursorMode>();
function setCursorMode(mode: CursorMode) {
  currentCursorMode.value = mode;
}

const isCursorOnNavmesh = computed((): boolean => {
  if (!rayIntersectionData.value) { return false; }
  return rayIntersectionData.value.intersection.object.el.classList.contains('navmesh');
});

const clickHook = createEventHook<CustomEvent<AframeClickeventData>>();
// clickHook.on((rayIntersection) => {
//   console.log('cursorClicked target:', rayIntersection.target);
//   console.log('cursorClicked entity:', rayIntersection.detail.intersection.object.el);
// })

let cursorEntity = ref<Entity>();
let watchStopper: WatchStopHandle | undefined
function setCursorEntityRef(entity: typeof cursorEntity | undefined) {
  if (!entity) {
    watchStopper?.();
    return;
  }
  cursorEntity = entity;
  watchStopper = watch(rayIntersectionData, () => {
    if (!cursorEntity.value) {
      return;
    }
    // console.log('updating cursorEntity transform');
    const intersectionData = rayIntersectionData.value;
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
}
// watch(rayIntersectionData, (n, o) => console.log('cursor watcher triggered:', n, ' old:', o));

export function useCurrentCursorIntersection() {
  return {
    currentCursorIntersection: rayIntersectionData,
    setCursorIntersection,
    setCursorMode,
    currentCursorMode: readonly(currentCursorMode),
    isCursorOnNavmesh,
    onCursorClick: clickHook.on,
    triggerCursorClick: clickHook.trigger,
    setCursorEntityRef,
  };
}

export const clickKey: EventBusKey<{ model: string, cursorObject: THREE.Object3D | undefined }> = Symbol('symbol-key');
// #endregion

// #region Simulate VR & hand Oculus controls on desktop
export const oculusButtons = ref({ 'a': false, 'b': false, 'x': false, 'y': false });

export const oculusHandSimulator = ref({ 'simulate': false, 'hands-active': false });
export function simulateOculus() {
  oculusHandSimulator.value.simulate = true;
  oculusHandSimulator.value['hands-active'] = true;
  window.onkeydown = ((e: KeyboardEvent) => {
    if (e.key === 'h') {
      oculusHandSimulator.value['hands-active'] = !oculusHandSimulator.value['hands-active'];
    }
    if (oculusHandSimulator.value['hands-active']) {
      if (e.key === 'a') {
        oculusButtons.value.a = true;
      }
      if (e.key === 'b') {
        oculusButtons.value.b = true;
      }
      if (e.key === 'x') {
        oculusButtons.value.x = true;
      }
      if (e.key === 'y') {
        oculusButtons.value.y = true;
      }
    }
  });
  window.onkeyup = ((e: KeyboardEvent) => {
    if (oculusHandSimulator.value['hands-active']) {
      if (e.key === 'a') {
        oculusButtons.value.x = false;
      }
      if (e.key === 'b') {
        oculusButtons.value.x = false;
      }
      if (e.key === 'x') {
        oculusButtons.value.x = false;
      }
      if (e.key === 'y') {
        oculusButtons.value.x = false;
      }
    }
  });
}

// #endregion
