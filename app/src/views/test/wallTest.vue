<script setup lang="ts">
import { computed, ref, shallowReactive, shallowRef, watch } from 'vue';
import sponzaUrl from '@/assets/models/sponza.glb?url'
import { type DetailEvent, THREE, type Entity, type Scene } from 'aframe';
import PdfEntity from '@/components/lobby/PdfEntity.vue';

defineOptions({
  components: { PdfEntity },
})

function arrToCoordString(arr: Array<unknown>) {
  const constructedString = arr.join(' ');
  return constructedString;
}
const sceneTag = ref<Scene>();

// const testVector = shallowRef<THREE.Vector3>();
// const testRotation = computed(() => {
//   if (!testVector.value) return undefined;
//   const defaultVector = new THREE.Vector3(0, 0, 1);
//   const quat = new THREE.Quaternion().setFromUnitVectors(defaultVector, testVector.value);
//   const euler = new THREE.Euler().setFromQuaternion(quat);
//   const arr = euler.toArray() as THREE.Vector3Tuple;
//   console.log(arr);

//   const aframeRot = threeRotationToAframeRotation(arr);
//   return aframeRot;
// })

const cursorEntity = ref<Entity>();
function placeCursor(evt: DetailEvent<RayIntersectionData>) {
  const cursor = cursorEntity.value;
  if (!cursor) return;
  const transform = intersectionToTransform(evt.detail);
  if (!transform) return;
  cursor.object3D.position.set(...transform.position);
  const quat = new THREE.Quaternion().fromArray(transform.rotation);
  cursor.object3D.rotation.setFromQuaternion(quat);
}

function intersectionToTransform(intersectionData: RayIntersectionData, normalOffset: number = 0.05) {
  const { intersection, rayDirection } = intersectionData;
  const position = intersection.point.clone();
  const rotation = new THREE.Quaternion();
  const normal = intersection.normal;
  if (!normal) { console.error('no normal vector in intersection object'); return; }


  //Rotation part
  const fromVector = new THREE.Vector3(0, 0, 1);
  rotation.setFromUnitVectors(fromVector, normal);
  const euler = new THREE.Euler().reorder('YXZ').setFromQuaternion(rotation);
  euler.z = 0;
  // if flat placement, align with camera direction
  if (euler.x < (-Math.PI / 2 + 0.01)) {// && euler.x > (-Math.PI / 4 - 0.01)) {
    // const quat = new THREE.Quaternion();
    // const cameraRot = sceneTag.value!.camera.getWorldQuaternion(quat);
    // const eul = new THREE.Euler().reorder('YXZ').setFromQuaternion(cameraRot);

    const quat = new THREE.Quaternion().setFromUnitVectors(fromVector, rayDirection.clone().negate());
    const eul = new THREE.Euler().reorder('YXZ').setFromQuaternion(quat);
    euler.y = eul.y;
  }
  const quat = new THREE.Quaternion().setFromEuler(euler);

  // Position part
  position.add(normal.clone().setLength(normalOffset));
  position.set(...position.toArray());
  return {
    position: position.toArray(),
    rotation: quat.toArray() as THREE.Vector4Tuple,
  }
}

function threeRotationToAframeRotation(threeRotation: THREE.Vector3Tuple): THREE.Vector3Tuple {
  return [
    THREE.MathUtils.radToDeg(threeRotation[0]),
    THREE.MathUtils.radToDeg(threeRotation[1]),
    THREE.MathUtils.radToDeg(threeRotation[2]),
  ]
}

function quaternionToAframeRotation(quaternion: THREE.Quaternion): THREE.Vector3Tuple {
  const euler = new THREE.Euler().reorder('YXZ').setFromQuaternion(quaternion);
  const arr = euler.toArray() as THREE.Vector3Tuple;
  return threeRotationToAframeRotation(arr);
}


function onClick(evt: DetailEvent<{ cursorEl: Entity, intersection: THREE.Intersection }>) {
  const rayDirection = evt.detail.cursorEl.components.raycaster.raycaster.ray.direction;
  // console.log('click!', evt);

  placeMovedObject({ intersection: evt.detail.intersection, rayDirection });
  return;
}

type UUID = ReturnType<typeof crypto.randomUUID>
type RayIntersectionData = { intersection: THREE.Intersection, rayDirection: THREE.Vector3 };
type placeableAssetTypes = `a-${'image' | 'sphere'}` | 'PdfEntity'; // | typeof PdfEntity;
type PlaceableObject = { uuid: UUID, type: placeableAssetTypes, src: string };
type PlacedObjectList = Array<PlaceableObject & { position: THREE.Vector3Tuple, rotation: THREE.Vector3Tuple }>

const currentlyMovedObject = shallowRef<PlaceableObject | undefined>();
const currentlySelectedObjectId = ref<UUID | undefined>();
const currentlyMovedEntity = ref<Entity | null>(null);
const placedObjects = shallowReactive<PlacedObjectList>([
  // { type: 'PdfEntity', src: '/documents/smallpdf_sample.pdf', uuid: crypto.randomUUID(), position: [1, 1.8, -2], rotation: [0, 0, 0] },
  // { type: 'PdfEntity', src: '/documents/compressed.tracemonkey-pldi-09.pdf', uuid: crypto.randomUUID(), position: [-2, 1.8, -2], rotation: [0, 0, 0] },
]);
const editedObject = computed(() => {
  return placedObjects.find(obj => obj.uuid === currentlySelectedObjectId.value)
})


const placedObjectsEntity = ref<Entity>();
function placeMovedObject(intersectionData: RayIntersectionData) {
  if (!currentlyMovedObject.value) return;
  console.log(currentlyMovedObject.value);
  // const { intersection, rayDirection } = intersectionData;
  const transform = intersectionToTransform(intersectionData);
  if (!transform) return;
  const quat = new THREE.Quaternion(...transform.rotation)
  const rotation = quaternionToAframeRotation(quat);
  const position = transform.position;
  // Note: rotation and position last as they should override any preexisting pos and rot
  placedObjects.push({ ...currentlyMovedObject.value, rotation, position, });
  currentlyMovedObject.value = undefined;
}

function createPlaceableObject(type: placeableAssetTypes, src: string) {
  const uuid = crypto.randomUUID();
  const newPlaceableObject: PlaceableObject = {
    uuid,
    src,
    type
  }
  currentlyMovedObject.value = newPlaceableObject
}

function repositionSelectedObject() {
  const idx = placedObjects.findIndex(obj => obj.uuid === editedObject.value?.uuid);
  if (idx < 0) return;
  const [obj] = placedObjects.splice(idx, 1);
  currentlyMovedObject.value = obj;
}

function selectEntity(uuid: UUID, evt: DetailEvent<{ cursorEl: Entity, intersection: THREE.Intersection, mouseEvent: MouseEvent }>) {
  console.log(uuid);
  console.log(evt);
  currentlySelectedObjectId.value = uuid;
  const rot = editedObject.value?.rotation;
  if (!rot) {
    console.log(rot);
    return;
  };
  yaw.value = rot[1];
  pitch.value = rot[0];
  roll.value = rot[2];
}
const yaw = ref<number>(0);
const pitch = ref<number>(0);
const roll = ref<number>(0);

watch([yaw, pitch, roll], ([newYaw, newPitch, newRoll]) => {
  const obj = placedObjects.find(obj => obj.uuid === currentlySelectedObjectId.value)
  if (!obj) {
    return;
  };
  obj.rotation = [newPitch, newYaw, newRoll];
})

</script>

<template>
  <div id="ui-overlay" class="absolute z-50 left-5 top-5">
    <button class="p-3 text-white rounded-md cursor-pointer bg-zinc-800"
      @click="createPlaceableObject('a-image', '/photos/joey-chacon-edbYu4vxXww-unsplash.jpg')">place photo</button>
    <button class="p-3 text-white rounded-md cursor-pointer bg-zinc-800"
      @click="createPlaceableObject('PdfEntity', '/documents/smallpdf_sample.pdf')">Place pdf</button>
    <div v-if="currentlySelectedObjectId">
      <input type="range" min="-180" max="180" v-model.number="yaw">
      <input type="range" min="-90" max="90" v-model.number="pitch">
      <input type="range" min="-180" max="180" v-model.number="roll">
      <button @click="repositionSelectedObject">Place again</button>
    </div>
    <pre class="text-xs bg-white/40">{{ placedObjects }}</pre>
  </div>
  <a-scene ref="sceneTag" cursor="rayOrigin: mouse;" raycaster="objects: .raycastable" raycaster-update
    @raycast-update="placeCursor">
    <a-assets>
      <a-asset-item id="sponza" :src="sponzaUrl"></a-asset-item>
    </a-assets>

    <a-entity ref="placedObjectsEntity">
      <component v-for="placedObject in placedObjects" :key="placedObject.type"
        @click="selectEntity(placedObject.uuid, $event)" class="selectable raycastable"
        :box-helper="`enabled: ${currentlySelectedObjectId === placedObject.uuid}; color: #ff00ff;`"
        :is="placedObject.type" :src="placedObject.src" :position="arrToCoordString(placedObject.position)"
        :rotation="arrToCoordString(placedObject.rotation)" />
      <!-- <component v-for="placedObject in placedObjects" :key="placedObject.uuid" class="selectable raycastable"
        :is="placedObject.type" :src="placedObject.src" /> -->
    </a-entity>
    <a-entity ref="cursorEntity">
      <a-entity :visible="!currentlyMovedObject" rotation="0 0 0">
        <a-ring id="cursor-ring" color="teal" radius-outer="0.2" radius-inner="0.1" />
        <a-box id="cursor-box" color="blue" scale="0.04 0.1 0.01" />
        <a-cone id="cursor-box" position="0 0.1 0" color="blue" scale="0.1 0.1 0.1" radius-bottom="0.2" />
      </a-entity>
      <a-entity id="moved-object">
        <component ref="currentlyMovedEntity" v-if="currentlyMovedObject" :is="currentlyMovedObject.type"
          :src="currentlyMovedObject.src" />
      </a-entity>
    </a-entity>

    <a-gltf-model @click="onClick" class="raycastable" src="#sponza" />
    <a-torus-knot position="0 1.6 -4" color="red" class="raycastable"
      animation="property: rotation; from: 0 0 0; to: 400 300 500; dir: alternate; dur: 15000; easing: easeInOutQuad; loop: true;"></a-torus-knot>
  </a-scene>
</template>
