import { THREE, type Entity } from "aframe";
import type { Vector3Tuple } from "env";

export type RayIntersectionData = { intersection: THREE.Intersection, rayDirection: THREE.Vector3 };
export type AframeClickeventData = {
  // intersectedEl:
  cursorEl: Entity,
  mouseEvent?: MouseEvent,
  touchEvent?: TouchEvent,
  intersection: THREE.Intersection
}
export function intersectionToTransform(intersectionData: RayIntersectionData, normalOffset: number = 0.09) {
  if (!intersectionData) { return; }
  const { intersection, rayDirection } = intersectionData;
  const position = intersection.point.clone();
  const rotation = new THREE.Quaternion();
  let normal = intersection.normal;
  if (!normal) {
    normal = intersection.face?.normal.normalize();
    if (!normal) {
      console.error('no normal vector found in intersection object'); return;
      return;
    }
  }

  //Rotation part
  const fromVector = new THREE.Vector3(0, 0, 1);
  rotation.setFromUnitVectors(fromVector, normal);
  const euler = new THREE.Euler().reorder('YXZ').setFromQuaternion(rotation);
  euler.z = 0;
  // if flat placement, align with camera direction
  if (euler.x < (-Math.PI / 2 + 0.1)) {// && euler.x > (-Math.PI / 4 - 0.01)) {
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

export function arrToCoordString(arr: Readonly<Array<unknown>>) {
  const constructedString = arr.join(' ');
  return constructedString;
}

export function threeRotationToAframeRotation(threeRotation: THREE.Vector3Tuple): THREE.Vector3Tuple {
  return [
    THREE.MathUtils.radToDeg(threeRotation[0]),
    THREE.MathUtils.radToDeg(threeRotation[1]),
    THREE.MathUtils.radToDeg(threeRotation[2]),
  ];
}

export function quaternionToAframeRotation(quaternion: THREE.Quaternion): THREE.Vector3Tuple {
  const euler = new THREE.Euler().reorder('YXZ').setFromQuaternion(quaternion);
  const arr = euler.toArray() as THREE.Vector3Tuple;
  return threeRotationToAframeRotation(arr);
}

export function quaternionTupleToAframeRotation(quaternionTuple: Readonly<THREE.Vector4Tuple>): THREE.Vector3Tuple {
  return quaternionToAframeRotation(new THREE.Quaternion(...quaternionTuple));
}

export function eulerTupleToQuaternionTuple(eulerTuple: Vector3Tuple) {
  const euler = new THREE.Euler().fromArray(eulerTuple);
  const quaternion = new THREE.Quaternion().setFromEuler(euler);
  return quaternion.toArray() as THREE.Vector4Tuple;
}