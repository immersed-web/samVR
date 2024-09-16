import { computed, ref, shallowReadonly, shallowRef } from 'vue';
import { THREE } from 'aframe';
import { type EventBusKey } from '@vueuse/core';
import { createEventHook } from '@vueuse/core';
import type { AframeClickeventData, RayIntersectionData } from '@/modules/3DUtils';

export type Tuple = [number, number]

// #region Raycast & intersection
const writableIntersection = shallowRef<RayIntersectionData>();
const rayIntersectionData = shallowReadonly(writableIntersection);
function setCursorIntersection(intersectionData: RayIntersectionData | undefined) {
  // intersectionData?.intersection.object.
  // console.log('currentCursor updated:', intersectionData);
  writableIntersection.value = intersectionData;
}
export type CursorMode = 'placeObject' | 'teleport' | undefined

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

// watch(rayIntersectionData, (n, o) => console.log('cursor watcher triggered:', n, ' old:', o));
export function useCurrentCursorIntersection() {
  return {
    currentCursorIntersection: rayIntersectionData,
    setCursorIntersection,
    setCursorMode,
    currentCursorMode,
    isCursorOnNavmesh,
    onCursorClick: clickHook.on,
    triggerCursorClick: clickHook.trigger
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
