import { type Entity, THREE } from 'aframe';

export default () => {

  AFRAME.registerComponent('follow-position', {
    schema: {type: 'selector'},
    followedEntity: null as Entity | null,
    followedWorldPos: undefined as unknown as THREE.Vector3,
    init: function () {
      this.followedWorldPos = new THREE.Vector3();
    },
    update: function () {
      if(!this.data) {
        console.error('copy-position component didnt get an element to read position from');
        // console.log('following camera because no element was provided');
        return;
      }
      this.followedEntity = this.data;
      // console.log('followed entity:', this.followedEntity);
      
    },
    tick: function(time, timeDelta) {
      // let readPosition = camera.position;
      if(this.followedEntity) {
        this.followedEntity.object3D.getWorldPosition(this.followedWorldPos);
        // this.worldToLocal.copy(this.el.object3D.matrixWorld);
        // this.worldToLocal.invert();
        
        // this.el.object3D.worldToLocal(this.followedWorldPos);
        // this.el.object3D.position.copy(this.followedWorldPos);
        // console.log('copied position. new position:',  this.el.object3D.getWorldPosition(new THREE.Vector3()));
        this.el.object3D.matrixWorld.setPosition(...this.followedWorldPos.toArray());
      } else {
        console.error('no entity to follow!');
      }
    },
  });
};