import { THREE, type Entity, type Scene } from "aframe";
import type { Vector3, Vector3Tuple } from "env";

const utilMatrix4 = new THREE.Matrix4();
const utilVector3 = new THREE.Vector3();
const utilEuler = new THREE.Euler();
const utilQuaternion = new THREE.Quaternion();

export type RayIntersectionData = { intersection: THREE.Intersection, rayDirection: THREE.Vector3, worldSpaceNormal: Vector3Tuple };
export type AframeClickeventData = {
  // intersectedEl:
  cursorEl: Entity,
  mouseEvent?: MouseEvent,
  touchEvent?: TouchEvent,
  intersection: THREE.Intersection
}

const utilNormal = new THREE.Vector3();
const utilRotation = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
const origo = new THREE.Vector3(0, 0, 0);
const zAxis = new THREE.Vector3(0, 0, 1);
const flatGroundUtilEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const rayAlongFloor = new THREE.Vector3(0, 0, 0);
const position = new THREE.Vector3(0, 0, 0);
export function intersectionToTransform(intersectionData: RayIntersectionData, normalOffset: number = 0.03) {
  if (!intersectionData) { return; }
  const { intersection, rayDirection } = intersectionData;
  position.copy(intersection.point);

  // if (intersection.normal) {
  //   utilNormal.copy(intersection.normal);
  // } else if (intersection.face) {
  //   utilNormal.copy(intersection.face.normal);
  // } else {
  //     console.error('no normal vector found in intersection object'); return;
  //     return;
  //   }
  utilNormal.set(...intersectionData.worldSpaceNormal);

  // console.log('normal:', utilNormal.toArray());

  //Rotation part
  //Might seem weird to we look at origo from normal. But it works
  utilMatrix4.lookAt(utilNormal, origo, up);
  utilEuler.setFromRotationMatrix(utilMatrix4);
  // utilRotation.setFromRotationMatrix(utilMatrix4);

  // if flat placement, align with camera direction
  if (Math.abs(Math.abs(utilEuler.x) - (Math.PI / 2)) < 0.1) {// && euler.x > (-Math.PI / 4 - 0.01)) {
  // if (Math.abs(euler.x) < 0.1) {// && euler.x > (-Math.PI / 4 - 0.01)) {
    // const quat = new THREE.Quaternion();
    // const cameraRot = sceneTag.value!.camera.getWorldQuaternion(quat);
    // const eul = new THREE.Euler().reorder('YXZ').setFromQuaternion(cameraRot);

    // console.log('flat placement', utilEuler.x);

    rayAlongFloor.copy(rayDirection).negate()
    rayAlongFloor.y = 0
    rayAlongFloor.normalize();
    const quat = utilQuaternion.setFromUnitVectors(zAxis, rayAlongFloor);
    flatGroundUtilEuler.setFromQuaternion(quat);
    utilEuler.y = flatGroundUtilEuler.y;
  }
  utilRotation.setFromEuler(utilEuler);

  // Position part
  position.add(utilNormal.setLength(normalOffset));
  position.set(...position.toArray());
  return {
    position: position.toArray(),
    // rotation: quat.toArray() as THREE.Vector4Tuple,
    rotation: utilRotation.toArray() as THREE.Vector4Tuple,
  };
}


export function generateSpawnPosition(spawnPosition: THREE.Vector3Tuple, spawnRadius: number) {
  // const spawnPosition = vrSpaceStore.currentVrSpace?.dbData.spawnPosition as Point | undefined;
  // const spawnRadius = vrSpaceStore.currentVrSpace?.dbData.spawnRadius || 1;
  if (!spawnPosition || !spawnRadius) return;
  const randomRadianAngle = 2 * Math.PI * Math.random(); // radian angle
  // Why sqrt? Check here: https://programming.guide/random-point-within-circle.html
  const randomDistance = Math.sqrt(Math.random()) * spawnRadius;
  const x = randomDistance * Math.cos(randomRadianAngle);
  const z = randomDistance * Math.sin(randomRadianAngle);
  const randomOffsetVector = new THREE.Vector3(x, 0, z);

  const spawnPointVector = new THREE.Vector3(...spawnPosition);
  spawnPointVector.add(randomOffsetVector);
  return spawnPointVector;
}

export function isEntity(obj: object & { isEntity?: boolean }): obj is Entity {
  return obj.isEntity ?? false;
}

export function arrToCoordString(arr: Readonly<Array<unknown>>) {
  const constructedString = arr.join(' ');
  return constructedString;
}

export function radiansEulerTupleToDegreesEulerTuple(eulerTuple: THREE.Vector3Tuple): THREE.Vector3Tuple {
  return [
    THREE.MathUtils.radToDeg(eulerTuple[0]),
    THREE.MathUtils.radToDeg(eulerTuple[1]),
    THREE.MathUtils.radToDeg(eulerTuple[2]),
  ];
}

export function degreesEulerTupleToRadiansEulerTuple(eulerTuple: THREE.Vector3Tuple): THREE.Vector3Tuple {
  return [
    THREE.MathUtils.degToRad(eulerTuple[0]),
    THREE.MathUtils.degToRad(eulerTuple[1]),
    THREE.MathUtils.degToRad(eulerTuple[2]),
  ]
}

export function quaternionToAframeRotation(quaternion: THREE.Quaternion): THREE.Vector3Tuple {
  const euler = utilEuler.reorder('YXZ').setFromQuaternion(quaternion);
  const arr = euler.toArray() as THREE.Vector3Tuple;
  return radiansEulerTupleToDegreesEulerTuple(arr);
}

export function quaternionTupleToAframeRotation(quaternionTuple: Readonly<THREE.Vector4Tuple>): THREE.Vector3Tuple {
  return quaternionToAframeRotation(utilQuaternion.fromArray(quaternionTuple));
}

export function aFrameRotationTupleToQuaternionTuple(eulerTuple: Vector3Tuple) {
  utilEuler.reorder('YXZ');
  const euler = utilEuler.fromArray(degreesEulerTupleToRadiansEulerTuple(eulerTuple));
  const quaternion = utilQuaternion.setFromEuler(euler);
  return quaternion.toArray() as THREE.Vector4Tuple;
}


export function assertSceneHasAudioListener(scene: Scene) {
  const sceneEl: Scene & { audioListener?: THREE.AudioListener } = scene;

  if (!sceneEl.audioListener) {
    console.log('creating audioListener');
    sceneEl.audioListener = new THREE.AudioListener();
    sceneEl.camera && sceneEl.camera.add(sceneEl.audioListener);
    sceneEl.addEventListener('camera-set-active', function (evt: any) {
      evt.detail.cameraEl.getObject3D('camera').add(sceneEl.audioListener);
    });
  }
  return sceneEl as Scene & { audioListener: THREE.AudioListener };
}