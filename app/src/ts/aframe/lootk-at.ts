import { THREE } from "aframe";

// var coordinates = AFRAME.utils.coordinates;

// var isCoordinates = coordinates.isCoordinate;

// delete AFRAME.components['look-at'];

/**
 * Look-at component.
 *
 * Modifies rotation to either track another entity OR do a one-time turn towards a position
 * vector.
 *
 * If tracking an object via setting the component value via a selector, look-at will register
 * a behavior to the scene to update rotation on every tick.
 */
export default function () {
  AFRAME.registerComponent('look-at-camera', {
    schema: {
      // default: '0 0 0',

      // parse: function (value) {
      //   // A static position to look at.
      //   if (isCoordinates(value) || typeof value === 'object') {
      //     return coordinates.parse(value);
      //   }
      //   // A selector to a target entity.
      //   return value;
      // },

      // stringify: function (data) {
      //   if (typeof data === 'object') {
      //     return coordinates.stringify(data);
      //   }
      //   return data;
      // }
    },
    worldPosition: undefined as unknown as THREE.Vector3,

    init: function () {
      this.worldPosition = new THREE.Vector3();
      // this.target3D = null;
      // this.vector = new THREE.Vector3();
      // this.cameraListener = AFRAME.utils.bind(this.cameraListener, this);
      // this.el.addEventListener('componentinitialized', this.cameraListener);
      // this.el.addEventListener('componentremoved', this.cameraListener);
    },

    /**
     * If tracking an object, this will be called on every tick.
     * If looking at a position vector, this will only be called once (until further updates).
     */
    update: function () {
      // var self = this;
      // var target = self.data;
      // var targetEl;

      // // No longer looking at anything (i.e., look-at="").
      // if (!target || (typeof target === 'object' && !Object.keys(target).length)) {
      //   return self.remove();
      // }

      // // Look at a position.
      // if (typeof target === 'object') {
      //   this.lookAt(new THREE.Vector3(target.x, target.y, target.z));
      //   return this.endTracking();
      // }

      // // Assume target is a string.
      // // Query for the element, grab its object3D, then register a behavior on the scene to
      // // track the target on every tick.
      // targetEl = self.el.sceneEl.querySelector(target);
      // if (!targetEl) {
      //   warn('"' + target + '" does not point to a valid entity to look-at');
      //   return;
      // }
      // if (!targetEl.hasLoaded) {
      //   return targetEl.addEventListener('loaded', function () {
      //     self.beginTracking(targetEl);
      //   });
      // }
      // return self.beginTracking(targetEl);
    },

    tick() {
      const camera = this.el.sceneEl?.camera;
      if (!camera) {
        console.warn('No camera found');
        return;
      }
      this.el.object3D.lookAt(camera.getWorldPosition(this.worldPosition));
    },

    // remove: function () {
    //   this.el.removeEventListener('componentinitialized', this.cameraListener);
    //   this.el.removeEventListener('componentremoved', this.cameraListener);
    // },

    // beginTracking: function (targetEl) {
    //   this.target3D = targetEl.object3D;
    // },

    // endTracking: function () {
    //   this.target3D = null;
    // },

    // cameraListener: function (e) {
    //   if (e.detail && e.detail.name === 'camera') {
    //     this.update();
    //   }
    // },

    // lookAt: function (position) {
    //   var vector = this.vector;
    //   var object3D = this.el.object3D;

    //   if (this.el.getObject3D('camera')) {
    //     // Flip the vector to -z, looking away from target for camera entities. When using
    //     // lookat from THREE camera objects, this is applied for you, but since the camera is
    //     // nested into a Object3D, we need to apply this manually.
    //     vector.subVectors(object3D.position, position).add(object3D.position);
    //   } else {
    //     vector.copy(position);
    //   }

    //   object3D.lookAt(vector);
    // }
  });
}