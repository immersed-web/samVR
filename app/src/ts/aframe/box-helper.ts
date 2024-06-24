import { THREE, type Entity } from "aframe";

export default function () {
  AFRAME.registerComponent('box-helper', {
    boxHelper: undefined as unknown as THREE.BoxHelper,
    currentColor: undefined as undefined | THREE.Color,
    schema: {
      enabled: { type: 'boolean', default: true },
      color: { type: 'color', default: '#ffffff' }
    },
    init: function () {
      // this.tick = AFRAME.utils.throttleTick(this.tick, 100, this);
      this.boxHelper = new THREE.BoxHelper(this.el.object3D)

      const scene = this.el.sceneEl?.object3D
      if (scene) {
        scene.add(this.boxHelper);
      }
    },
    tick: (function () {
      let prevScale = new THREE.Vector3();
      let prevQuat = new THREE.Quaternion();
      let currentQuat = new THREE.Quaternion();

      return function () {
        const el = this.el as Entity;
        const currentScale = el.object3D.scale.clone();
        currentQuat.setFromEuler(el.object3D.rotation);
        if (currentScale.distanceTo(prevScale) > 0.01 || currentQuat.angleTo(prevQuat) > 0.01) {
          // console.log('UPDATING');
          this.boxHelper.update();
        }

        prevScale.copy(currentScale);
        prevQuat.copy(currentQuat);
      };
    })(),
    update: function () {
      this.boxHelper.visible = this.data.enabled;
      if (this.data.color && this.boxHelper) {
        const color = new THREE.Color(this.data.color);
        this.boxHelper.material.color = color;
      }
    },

    remove: function () {
      // if (this.boxHelper) {
      this.el.sceneEl?.object3D.remove(this.boxHelper);
      this.boxHelper.dispose();
      // }
    },
  })
}