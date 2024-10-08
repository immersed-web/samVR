import { THREE, utils, type Coordinate, type DetailEvent, type Entity } from 'aframe';
import InterpolationBuffer from 'buffered-interpolation';
import type { MaybeTransform as MaybeTransform } from 'schemas';
// import type { Vector3 } from 'three';

type Coordinate4D = Coordinate & { w: number };

type ActiveTransform = Extract<MaybeTransform, { active: true }>;
export default () => {

  AFRAME.registerComponent('interpolated-transform', {
    // dependencies: ['position', 'orientation'],
    schema: {
      interpolationTime: { type: 'number', default: 500 },
      nearRangeThreshold: { type: 'number', default: 7 },
      nearRangeHysteresis: { type: 'number', default: 4 },
      position: { type: 'vec3' },
      rotation: { type: 'vec4' },
    },
    interpolationBuffer: undefined as InterpolationBuffer | undefined,
    cameraPosition: new AFRAME.THREE.Vector3(),
    distance: 1000,
    isNearRange: false,
    utilQuat: undefined as unknown as THREE.Quaternion,
    utilVec: undefined as unknown as THREE.Vector3,
    utilVec2: undefined as unknown as THREE.Vector3,
    oldPosStr: undefined as unknown as string,
    oldRotStr: undefined as unknown as string,
    // distanceDebugEntity: undefined as Entity | undefined,
    init: function () {
      this.utilQuat = new AFRAME.THREE.Quaternion();
      this.utilVec = new AFRAME.THREE.Vector3();
      this.utilVec2 = new AFRAME.THREE.Vector3();
      this.oldPosStr = '';
      this.oldRotStr = '';
      // console.log('Remote avatar init', this.data.id);
      this.initInterpolationBuffer();
      const pos = this.el.object3D.position.clone();
      this.interpolationBuffer?.setPosition(pos);
      const rot = this.el.object3D.quaternion.clone();
      this.interpolationBuffer?.setQuaternion(rot);

      // const foundEl = this.el.querySelector('.distance-debug');
      // if(foundEl) {
      //   this.distanceDebugEntity = foundEl as Entity;
      // }

      // console.log('interpolated-transform initialized');
    },
    update() {
      const position = this.data.position as Coordinate;
      const newPositionStr = utils.coordinates.stringify(position);
      const rotation = this.data.rotation as Coordinate4D;
      const newRotationStr = utils.coordinates.stringify(rotation);
      if (newPositionStr !== this.oldPosStr || newRotationStr !== this.oldRotStr) {
        console.warn('setting interpolated transform through html attributes. Possibly less performant than doing by events');
        this.utilVec.set(position.x, position.y, position.z);
        this.utilQuat.set(rotation.x, rotation.y, rotation.z, rotation.w);
        this.interpolationBuffer?.setPosition(this.utilVec);
        this.interpolationBuffer?.setQuaternion(this.utilQuat);
      }
      this.oldPosStr = newPositionStr;
      this.oldRotStr = newRotationStr;
    },
    tick: function (time, timeDelta) {

      if (this.interpolationBuffer) {
        // update buffer position
        this.interpolationBuffer.update(timeDelta);
        this.el.object3D.position.copy(this.interpolationBuffer.getPosition());
        this.el.object3D.quaternion.copy(this.interpolationBuffer.getQuaternion());

      }
      this.distanceToCamera();
      // if(this.distanceDebugEntity){
      //   this.distanceDebugEntity.setAttribute('value', `${this.distance.toFixed(2)}`);
      // }
    },
    events: {
      setTransform: function (e: DetailEvent<ActiveTransform>) {
        // console.log('interpolated-transform: setTransform', e.detail);
        const trsfm = e.detail;
        const interpolationBuffer = this.interpolationBuffer!;
        interpolationBuffer.setPosition(new AFRAME.THREE.Vector3(...trsfm.position));
        interpolationBuffer.setQuaternion(new AFRAME.THREE.Quaternion(...trsfm.rotation));
        interpolationBuffer.jumpToMostRecentFrame();
        e.stopPropagation();
        // console.log(interpolationBuffer.buffer);
      },
      moveTo: function (e: DetailEvent<Pick<ActiveTransform, 'position'>>) {
        // // Interpolate with buffered-interpolation
        // const id = this.el.id;
        // console.log(`${id} moved to`, e.detail.position);
        const pos = e.detail.position;
        this.utilVec.set(pos[0], pos[1], pos[2]);
        this.interpolationBuffer!.setPosition(this.utilVec);
        // this.interpolationBuffer!.setPosition(new AFRAME.THREE.Vector3(pos[0], pos[1], pos[2]));
        e.stopPropagation();
      },

      rotateTo: function (e: DetailEvent<Pick<ActiveTransform, 'rotation'>>) {
        // // Interpolate with buffered-interpolation
        const rot = e.detail.rotation;
        this.utilQuat.set(rot[0], rot[1], rot[2], rot[3]);
        this.interpolationBuffer!.setQuaternion(this.utilQuat);
        // this.interpolationBuffer!.setQuaternion(new AFRAME.THREE.Quaternion(rot[0], rot[1], rot[2], rot[3]));
        e.stopPropagation();
      },
      setTargetTransform: function (e: DetailEvent<ActiveTransform>) {
        const trsfm = e.detail;
        const interpolationBuffer = this.interpolationBuffer!;
        interpolationBuffer.setPosition(new AFRAME.THREE.Vector3(...trsfm.position));
        interpolationBuffer.setQuaternion(new AFRAME.THREE.Quaternion(...trsfm.rotation));
        e.stopPropagation();
      }
    },

    // Component functions
    initInterpolationBuffer: function () {
      this.interpolationBuffer = new InterpolationBuffer(undefined, this.data.interpolationTime / 1000);
    },
    distanceToCamera: function () {
      const camera = this.el.sceneEl?.camera;
      if (!camera) return;
      const camWorldPos = camera.getWorldPosition(this.utilVec);
      const avatarWorldPos = this.el.object3D.getWorldPosition(this.utilVec2);
      this.distance = avatarWorldPos.distanceTo(camWorldPos);
      const threshold = this.data.nearRangeThreshold as number;
      const hysteresis = this.data.nearRangeHysteresis as number;
      if (!this.isNearRange && this.distance <= threshold) {
        this.isNearRange = true;
        // console.log('I am close', this.el);
        this.el.emit('near-range-entered', this.distance, false);
      }
      else if (this.isNearRange && this.distance > threshold + hysteresis) {
        this.isNearRange = false;
        // console.log('No longer close', this.el);
        this.el.emit('near-range-exited', this.distance, false);
      }
    },
  });

};
