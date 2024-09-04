import type { MaybeTransform } from "schemas";
import { THREE } from "aframe";
export default () => {

  AFRAME.registerComponent('emit-move', {
    schema: {
      interval: {type: 'number', default: 100},
      relativeToCamera: {type: 'boolean', default: false},
    },
    position: '',
    orientation: '',
    interval: 0,
    worldPos: undefined as unknown as THREE.Vector3,
    worldRot: undefined as unknown as THREE.Quaternion,
    relativeMatrix: undefined as unknown as THREE.Matrix4,
    throttledEmitMovement: undefined as unknown as (moveUpdate: MaybeTransform) => void,
    init: function () {
    // Create reusable instances unique to each component instance
      this.worldPos = new THREE.Vector3();
      this.worldRot = new THREE.Quaternion();
      this.relativeMatrix = new THREE.Matrix4(); 
      // @ts-ignore
      this.throttledEmitMovement = AFRAME.utils.throttleLeadingAndTrailing((newTransform: MaybeTransform) => this.el.emit('move', newTransform, false), this.interval, this);
    },
    update: function () {

      this.interval = this.data.interval;
      this.el.object3D.getWorldPosition(this.worldPos);
      this.position = AFRAME.utils.coordinates.stringify(this.worldPos);
      this.el.object3D.getWorldQuaternion(this.worldRot);
      this.orientation = AFRAME.utils.coordinates.stringify(this.worldRot);
    },
    tick: function () {

      if(this.data.relativeToCamera){
        const cameraWorldMatrixInverse = this.el.sceneEl?.camera.matrixWorldInverse!;
        // const relativeMatrix = new THREE.Matrix4();
        this.relativeMatrix.identity();
        this.relativeMatrix.multiply(cameraWorldMatrixInverse).multiply(this.el.object3D.matrixWorld);
        this.worldPos.setFromMatrixPosition(this.relativeMatrix);
        this.worldRot.setFromRotationMatrix(this.relativeMatrix);
        // this.angle = worldRot.angleTo(new THREE.Quaternion());
      } else {
        this.el.object3D.getWorldPosition(this.worldPos);
        this.el.object3D.getWorldQuaternion(this.worldRot);
      }

      const newPosition = AFRAME.utils.coordinates.stringify(this.worldPos);
      const newOrientation = AFRAME.utils.coordinates.stringify(this.worldRot);

      const moved = newPosition !== this.position;
      const rotated = newOrientation !== this.orientation;

      if(moved || rotated) {
        // console.log('emit-move component: transform updated', newPosition, newOrientation);
        // console.log(this);
        const position = this.worldPos.toArray();
        const rotation = this.worldRot.toArray() as [number, number, number, number];
        const transform = { active: true, position, rotation };
        // if (this.el.id === 'camera') {
        //   console.log(this.el.id, this.worldPos);
        // }
        this.throttledEmitMovement(transform);
      } 
      this.position = newPosition;
      this.orientation = newOrientation;
    },
  });

};
