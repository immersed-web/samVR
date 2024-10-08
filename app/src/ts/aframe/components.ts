import 'aframe';

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
import panoPortal from './pano-portal';
import outerGlow from './outer-glow';
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

let componentsAreRegistered = false;

export default async function () {
  if(componentsAreRegistered) {
    console.info('aframe components are already registered. skipping');
    return;
  }
  console.log('Registering a-frame components');
  emitMove();
  interpolatedTransform();
  navmesh();
  raycasterListen();
  rotationControl();
  hoverHighlight();
  mediastreamAudioSource();
  modelOpacity();
  grid();
  followPosition();
  lockRotationAxis();
  panoPortal();
  outerGlow();
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

  await import('aframe-atlas-uvs-component');


  await import('aframe-troika-text');

  // TODO: Find out why rig and camera seems to be a few decimeter of in horizontal position. Only in real VR though. Not in browser as it seems at least.
  await import('aframe-blink-controls');

  cameraControls();
  // // @ts-ignore
  // import('aframe-orbit-controls');
  // We had to tweak the orbit controls to avoid grab cursor leaking outside canvas element. Pull request is submitted to superframe.
  await import('./orbit-controls/orbit-controls');
  componentsAreRegistered = true;
};

