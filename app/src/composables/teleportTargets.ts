import type { Entity, Scene } from 'aframe';
import { ref } from 'vue'

export const leftHandVRGui = ref<Entity>();
export const rightHandVRGui = ref<Entity>();
export const overlayGUILeft = ref<HTMLDivElement>();
export const overlayGUICenter = ref<HTMLDivElement>();
export const overlayGUIRight = ref<HTMLDivElement>();
export const aframeScene = ref<Scene>();
export const vrCursor = ref<Entity>();
export const cameraAttacher = ref<Entity>();

