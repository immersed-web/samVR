// import 'aframe';

import emitMove from './emit-move';
import rotationControl from './rotation-control';
import remoteAvatar from './remote-avatar';
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
// import 'aframe';
import modelColor from './model-color';
import raycasterUpdate from './raycaster-update';
import boxHelper from './box-helper';
import laserPointer from './laser-pointer';
import canvasMaterial from './canvas-material';

let componentsAreRegistered = false;

const registerComponents = async () => {
  if(componentsAreRegistered) {
    console.info('aframe components are already registered. skipping');
    return;
  }
  console.log('Registering a-frame components');
  emitMove();
  remoteAvatar();
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
  laserPointer();
  canvasMaterial();

  // @ts-ignore
  await import('aframe-atlas-uvs-component');
  import('aframe-look-at-component');
  import('aframe-troika-text');
  // import('aframe-orbit-controls');

  // @ts-ignore
  // import('aframe-environment-component');

  // @ts-ignore
  // import('aframe-extras');

  // TODO: Find out why rig and camera seems to be a few decimeter of in horizontal position. Only in real VR though. Not in browser as it seems at least.
  // @ts-ignore
  import('aframe-blink-controls');

  // @ts-ignore
  // import('aframe-look-at-component');

  // // @ts-ignore
  // import('aframe-orbit-controls');
  // We had to tweak the orbit controls to avoid grab cursor leaking outside canvas element. Pull request is submitted to superframe.
  import('./orbit-controls/orbit-controls');
  componentsAreRegistered = true;
  console.log('A-frame components are registered');
};

export default {
  registerAframeComponents: registerComponents,
};

