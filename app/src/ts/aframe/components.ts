import 'aframe';
import { THREE } from 'aframe';

// Add BVH threejs extension for more performant raycasting
import { acceleratedRaycast, computeBatchedBoundsTree, computeBoundsTree, disposeBatchedBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

THREE.BatchedMesh.prototype.computeBoundsTree = computeBatchedBoundsTree;
THREE.BatchedMesh.prototype.disposeBoundsTree = disposeBatchedBoundsTree;
THREE.BatchedMesh.prototype.raycast = acceleratedRaycast;

import emitMove from './emit-move';
import rotationControl from './rotation-control';
import interpolatedTransform from './interpolated-transform';
import navmesh from './simple-navmesh-constraint';
import raycasterListen from './raycaster-listen';
import hoverHighlight from './hover-highlight';
import mediastreamAudioSource from './mediastream-audio-source';
import modelOpacity from './model-opacity';
import grid from './grid';
import followPosition from './follow-position';
import lockRotationAxis from './lock-rotation-axis';
import panoPortal from './materials/pano-warp/pano-portal';
import outerGlow from './materials/outer-glow/outer-glow';
import portalMaterial from './materials/portal/portal';
import lootkAt from './lootk-at';
import meshUI from './mesh-ui';
import makeGltfSwappable from './make-gltf-swappable';
import modelColor from './model-color';
import raycasterUpdate from './raycaster-update';
import boxHelper from './box-helper';
import laserPointer from './laser-pointer';
import canvasMaterial from './canvas-material';
import cameraControls from './camera-controls';
import normalsHelper from './normals-helper';
import axesHelper from './axes-helper';
import tickCounter from './tick-counter';
import bvh from './bvh';
import positionalAudio from './positional-audio';
import sceneCleanup from './scene-cleanup';
import orbitControls from './orbit-controls/orbit-controls';

let componentsAreRegistered = false;

export default async function () {
  if(componentsAreRegistered) {
    console.info('aframe components are already registered. skipping');
    return;
  }
  // console.log('Registering a-frame components');
  emitMove();
  interpolatedTransform();
  navmesh();
  raycasterListen();
  rotationControl();
  hoverHighlight();
  mediastreamAudioSource();
  positionalAudio();
  modelOpacity();
  grid();
  followPosition();
  lockRotationAxis();
  // panoPortal();
  // outerGlow();
  portalMaterial();
  lootkAt();
  meshUI();
  modelColor();
  makeGltfSwappable();
  raycasterUpdate();
  boxHelper();
  normalsHelper();
  axesHelper();
  laserPointer();
  canvasMaterial();
  tickCounter();
  bvh();
  sceneCleanup();

  // import('aframe-orbit-controls');
  // We had to tweak the orbit controls to avoid grab cursor leaking outside canvas element. Pull request is submitted to superframe.
  orbitControls();
  cameraControls();

  await import('aframe-atlas-uvs-component');


  await import('aframe-troika-text');

  // TODO: Find out why rig and camera seems to be a few decimeter of in horizontal position. Only in real VR though. Not in browser as it seems at least.
  await import('aframe-blink-controls');
  // patchBlinkControls();
  await import('aframe-extras/controls/index.js');
  // console.log('registered and imported all aframe components!!! ------------------------');
  componentsAreRegistered = true;
};

// function patchBlinkControls() {
//   const globalBlinkControls = AFRAME.components['blink-controls'].Component;
//   function patchedParabolicCurveMaxRoot(p0, v0, a) {
//     console.log('patchedParabolicCurveMaxRoot triggered');
//     const root = (-v0.y - Math.sqrt(Math.abs(v0.y) ** 2 - 4 * (0.5 * Math.abs(a.y)) * Math.abs(p0.y))) / (2 * 0.5 * Math.abs(a.y))
//     return root
//   }
//   globalBlinkControls.prototype['parabolicCurveMaxRoot'] = patchedParabolicCurveMaxRoot;
// }