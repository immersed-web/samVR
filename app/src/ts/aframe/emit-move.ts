import type { Transform } from "schemas";
export default () => {

  AFRAME.registerComponent('emit-move', {
    schema: {
      interval: {type: 'number', default: 100},
      relativeToCamera: {type: 'boolean', default: false},
    },
    position: '',
    orientation: '',
    interval: 0,
    // angle: 0,
    worldPos: undefined as unknown as THREE.Vector3,
    worldRot: undefined as unknown as THREE.Quaternion,
    relativeMatrix: undefined as unknown as THREE.Matrix4,
    throttledEmitMovement: undefined as unknown as (moveUpdate: Transform) => void,
    emitMovement: function (newTransform: Transform) {
      this.el.emit('move', newTransform);
      // if(this.data.relativeToCamera){
      //   console.log('angle',THREE.MathUtils.radToDeg(this.angle));
      // }
    },
    update: function(){
      // Create reusable instances
      this.worldPos = new THREE.Vector3();
      this.worldRot = new THREE.Quaternion();
      this.relativeMatrix = new THREE.Matrix4(); 

      this.interval = this.data.interval;
      const worldPos = this.el.object3D.getWorldPosition(new AFRAME.THREE.Vector3());
      this.position = AFRAME.utils.coordinates.stringify(worldPos);
      const worldRot = this.el.object3D.getWorldQuaternion(new AFRAME.THREE.Quaternion());
      this.orientation = AFRAME.utils.coordinates.stringify(worldRot);
      // @ts-ignore
      this.throttledEmitMovement = AFRAME.utils.throttleLeadingAndTrailing(this.emitMovement, this.interval, this);
    },
    tick: function () {
      const worldPos = this.el.object3D.getWorldPosition(this.worldPos);
      const worldRot = this.el.object3D.getWorldQuaternion(this.worldRot);

      if(this.data.relativeToCamera){
        const cameraWorldMatrixInverse = this.el.sceneEl?.camera.matrixWorldInverse!;
        // const relativeMatrix = new THREE.Matrix4();
        this.relativeMatrix.identity();
        this.relativeMatrix.multiply(cameraWorldMatrixInverse).multiply(this.el.object3D.matrixWorld);
        worldPos.setFromMatrixPosition(this.relativeMatrix);
        worldRot.setFromRotationMatrix(this.relativeMatrix);
        // this.angle = worldRot.angleTo(new THREE.Quaternion());
      }

      const newPosition = AFRAME.utils.coordinates.stringify(worldPos);
      const newOrientation = AFRAME.utils.coordinates.stringify(worldRot);

      const moved = newPosition !== this.position;
      const rotated = newOrientation !== this.orientation;

      if(moved || rotated) {
        // console.log('emit-move component: transform updated', newPosition, newOrientation);
        const position = worldPos.toArray();
        const rotation = worldRot.toArray() as [number, number, number, number];
        const transform = { active: true, position, rotation };
        this.throttledEmitMovement(transform);
      } 
      this.position = newPosition;
      this.orientation = newOrientation;
    },
  });

};
