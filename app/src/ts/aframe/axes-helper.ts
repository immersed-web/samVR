import { THREE, type Entity } from "aframe";

export default function () {
  AFRAME.registerComponent('axes-helper', {
    axesHelper: undefined as unknown as THREE.AxesHelper,
    // currentColor: undefined as undefined | THREE.Color,
    schema: {
      enabled: { type: 'boolean', default: true },
      // color: { type: 'color', default: '#ffffff' }
    },
    // currentPosition: undefined as unknown as THREE.Vector3,
    // prevPosition: undefined as unknown as THREE.Vector3,
    // currentQuat: undefined as unknown as THREE.Quaternion,
    // prevQuat: undefined as unknown as THREE.Quaternion,
    // currentScale: undefined as unknown as THREE.Vector3,
    // prevScale: undefined as unknown as THREE.Vector3,
    init: function () {
      // console.log('box-helper init');
      // this.currentPosition = new THREE.Vector3();
      // this.prevPosition = new THREE.Vector3();
      // this.currentQuat = new THREE.Quaternion();
      // this.prevQuat = new THREE.Quaternion();
      // this.currentScale = new THREE.Vector3();
      // this.prevScale = new THREE.Vector3();
      this.axesHelper = new THREE.AxesHelper(0.5)
      this.el.object3D.add(this.axesHelper);

      // const scene = this.el.sceneEl?.object3D
      // if (scene) {
      //   scene.add(this.boxHelper);
      // }
    },
    tick() {
      if (this.data.enabled === false) return;
      // this.el.object3D.matrixWorld.decompose(this.currentPosition, this.currentQuat, this.currentScale);
      // if (this.currentScale.distanceTo(this.prevScale) > 0.01 || this.currentQuat.angleTo(this.prevQuat) > 0.01 || this.currentPosition.distanceTo(this.prevPosition) > 0.01) {
      //   // console.log('UPDATING box helper');
      //   this.boxHelper.update();
      // }
      // this.prevPosition.copy(this.currentPosition);
      // this.prevQuat.copy(this.currentQuat);
      // this.prevScale.copy(this.currentScale);
    },
    update: function () {
      this.axesHelper.visible = this.data.enabled;
      // if (this.data.color && this.boxHelper) {
      //   const color = new THREE.Color(this.data.color);
      //   this.boxHelper.material.color = color;
      // }
    },

    remove: function () {
      // console.log('box-helper remove');
      // if (this.boxHelper) {
      this.el.object3D.remove(this.axesHelper);
      this.axesHelper.dispose();
      // }
    },
  })
}