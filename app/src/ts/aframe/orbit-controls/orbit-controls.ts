import { THREE } from 'aframe'
// @ts-expect-error
import { OrbitControls } from './lib/OrbitControls.js';
// @ts-expect-error
THREE.OrbitControls = OrbitControls;

// @ts-expect-error
const bind = AFRAME.utils.bind;

export default () => {
  AFRAME.registerComponent('orbit-controls', {
    dependencies: ['camera'],
    schema: {
      autoRotate: { type: 'boolean' },
      autoRotateSpeed: { default: 2 },
      cursor: { type: 'vec3' },
      dampingFactor: { default: 0.1 },
      enabled: { default: true },
      enableDamping: { default: true },
      enablePan: { default: true },
      enableRotate: { default: true },
      enableZoom: { default: true },
      initialPosition: { type: 'vec3' },
      keyPanSpeed: { default: 7 },
      minAzimuthAngle: { type: 'number', default: - Infinity },
      maxAzimuthAngle: { type: 'number', default: Infinity },
      maxDistance: { default: 1000 },
      maxPolarAngle: { default: AFRAME.utils.device.isMobile() ? 90 : 120 },
      minDistance: { default: 1 },
      minPolarAngle: { default: 0 },
      minTargetRadius: { type: 'number', default: 0 },
      maxTargetRadius: { type: 'number', default: Infinity },
      minZoom: { default: 0 },
      maxZoom: { type: 'number', default: Infinity },
      panSpeed: { default: 1 },
      rotateSpeed: { default: 0.05 },
      screenSpacePanning: { default: false },
      target: { type: 'vec3' },
      zoomSpeed: { default: 0.5 },
      zoomToCursor: { default: false },
    },
    oldPosition: undefined as THREE.Vector3 | undefined,
    target: undefined as THREE.Vector3 | undefined,
    cursor: undefined as THREE.Vector3 | undefined,
    controls: undefined as unknown as OrbitControls,
    rotateTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    init: function () {
      console.log('orbit-controls:init');
      const el = this.el;
      this.oldPosition = new THREE.Vector3();

      this.bindMethods();
      el.sceneEl?.addEventListener('enter-vr', this.onEnterVR);
      el.sceneEl?.addEventListener('exit-vr', this.onExitVR);

      const canvasEl = el.sceneEl!.canvas;

      canvasEl.style.cursor = 'grab';
      canvasEl.addEventListener('mousedown', this.onMouseDown);
      canvasEl.addEventListener('mouseup', this.onMouseUp);

      this.target = new THREE.Vector3();
      this.cursor = new THREE.Vector3();
      // we need to reset the camera entity's position and rotation in order for the orbit-controls to not go crazy
      el.object3D.rotation.set(0, 0, 0);
      el.object3D.position.set(0, 0, 0);
      el.getObject3D('camera').position.copy(this.data.initialPosition);

      // el.object3D.position.copy(this.data.initialPosition);

      // @ts-expect-error
      this.controls = new THREE.OrbitControls(el.getObject3D('camera'), el.sceneEl.renderer.domElement);

      // this.controls = new THREE.OrbitControls(el.object3D, el.sceneEl.renderer.domElement);
      // const camera = el.getObject3D('camera');
      // if (camera) {
      //   camera.rotation.y = THREE.MathUtils.degToRad(180);
      // }
      // this.update(undefined);
      // this.controls.saveState();
    },

    pause: function () {
      this.controls.dispose();
    },

    play: function () {
      console.log('orbit-controls:play');
    // const el = this.el;
    // // @ts-expect-error
    // this.controls = new THREE.OrbitControls(el.getObject3D('camera'), el.sceneEl.renderer.domElement);

      // // this.controls = new THREE.OrbitControls(el.object3D, el.sceneEl.renderer.domElement);
      // // const camera = el.getObject3D('camera');
      // // if (camera) {
      // //   camera.rotation.y = THREE.MathUtils.degToRad(180);
      // // }
      // this.update(undefined);
      // this.controls.saveState();
    },

    onEnterVR: function () {
      const el = this.el;

      if (!AFRAME.utils.device.checkHeadsetConnected() &&
        !AFRAME.utils.device.isMobile()) { return; }
      this.controls.enabled = false;
      if (el.hasAttribute('look-controls')) {
        el.setAttribute('look-controls', 'enabled', true);
        this.oldPosition?.copy(el.getObject3D('camera').position);
        el.getObject3D('camera').position.set(0, 0, 0);

        // this.oldPosition!.copy(el.object3D.position);
        // el.object3D.position.set(0, 0, 0);
      }
    },

    onExitVR: function () {
      const el = this.el;

      if (!AFRAME.utils.device.checkHeadsetConnected() &&
        !AFRAME.utils.device.isMobile()) { return; }
      this.controls.enabled = true;
      el.getObject3D('camera').position.copy(this.oldPosition!);
      // el.object3D.position.copy(this.oldPosition!);
      if (el.hasAttribute('look-controls')) {
        el.setAttribute('look-controls', 'enabled', false);
      }
    },

    onMouseDown: function () {
      const canvasEl = this.el.sceneEl!.canvas;
      canvasEl.style.cursor = 'grabbing';
      if (this.rotateTimer) clearTimeout(this.rotateTimer);
      this.controls.autoRotate = false;
    },
    onMouseUp: function () {
      const canvasEl = this.el.sceneEl!.canvas;
      canvasEl.style.cursor = 'grab';
      this.rotateTimer = setTimeout(() => this.controls.autoRotate = this.data.autoRotate, 5000);
    },

    bindMethods: function () {
      this.onEnterVR = bind(this.onEnterVR, this);
      this.onExitVR = bind(this.onExitVR, this);
      this.onMouseDown = bind(this.onMouseDown, this);
      this.onMouseUp = bind(this.onMouseUp, this);
    },

    update: function (oldData) {
      const controls = this.controls;
      const data = this.data;

      if (!controls) { return; }
      console.log('orbit-controls:update');
      // avoid moving to startPosition if not explicitly updated
      if (!oldData || !AFRAME.utils.deepEqual(data.target, oldData.target)) {
        console.log('target was changed in component update');
        controls.target = this.target?.copy(data.target);
      } else {
        console.log('skipping to set orbit control target');
      }
      controls.cursor = this.cursor?.copy(data.cursor);
      controls.autoRotate = data.autoRotate;
      controls.autoRotateSpeed = data.autoRotateSpeed;
      controls.dampingFactor = data.dampingFactor;
      controls.enabled = data.enabled;
      controls.enableDamping = data.enableDamping;
      controls.enablePan = data.enablePan;
      controls.enableRotate = data.enableRotate;
      controls.enableZoom = data.enableZoom;
      controls.keyPanSpeed = data.keyPanSpeed;
      controls.maxPolarAngle = THREE.MathUtils.degToRad(data.maxPolarAngle);
      controls.maxAzimuthAngle = THREE.MathUtils.degToRad(data.maxAzimuthAngle);
      controls.maxDistance = data.maxDistance;
      controls.minDistance = data.minDistance;
      controls.minPolarAngle = THREE.MathUtils.degToRad(data.minPolarAngle);
      controls.minTargetRadius = data.minTargetRadius;
      controls.maxTargetRadius = data.maxTargetRadius;
      controls.minAzimuthAngle = THREE.MathUtils.degToRad(data.minAzimuthAngle);
      controls.minZoom = data.minZoom;
      controls.maxZoom = data.maxZoom;
      controls.panSpeed = data.panSpeed;
      controls.rotateSpeed = data.rotateSpeed;
      controls.screenSpacePanning = data.screenSpacePanning;
      controls.zoomSpeed = data.zoomSpeed;
      controls.zoomToCursor = data.zoomToCursor;

      controls.saveState();
    },

    tick: function (_, deltaTime) {
      const controls = this.controls;
      const data = this.data;
      if (!data.enabled) {
        return;
      }
      if (deltaTime > 600) {
        console.log('orbit controls is skipping tick because big deltaTime occured (ms):', deltaTime);
        console.log('this is to avoid the autorotate spinning like crazy. The reason for big deltaTime is probably changing browser tabs.');
        return;
      }
      if (controls.enabled && (controls.enableDamping || controls.autoRotate)) {
        const deltaTimeS = deltaTime * 0.001;
        this.controls.update(deltaTimeS);
      }
    },

    remove: function () {
      if (this.rotateTimer) clearTimeout(this.rotateTimer);
      this.controls.reset();
      this.controls.dispose();
      this.el.getObject3D('camera').position.set(0, 0, 0);
      this.el.getObject3D('camera').rotation.set(0, 0, 0);
    // this.el.object3D.position.set(0, 0, 0);
    // this.el.object3D.rotation.set(0, 0, 0);


      this.el.sceneEl?.removeEventListener('enter-vr', this.onEnterVR);
      this.el.sceneEl?.removeEventListener('exit-vr', this.onExitVR);
      const canvasEl = this.el.sceneEl!.canvas;
      canvasEl.removeEventListener('mousedown', this.onMouseDown);
      canvasEl.removeEventListener('mouseup', this.onMouseUp);
      canvasEl.style.cursor = 'auto';
    },
  });
}