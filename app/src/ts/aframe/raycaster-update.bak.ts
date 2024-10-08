import { THREE, type DetailEvent, type Entity } from 'aframe';

export default function () {

  AFRAME.registerComponent('raycaster-update', {
    // raycaster: null as null | Entity,
    dependencies: ['raycaster'],
    fields: {
      prev: undefined as unknown as THREE.Vector3,
    },
    init: function () {
      console.log('INIT raycaster-update');
      this.fields.prev = new THREE.Vector3();
      this.tick = AFRAME.utils.throttleTick(this.tick!, 10, this);
    },
    events: {
      // 'raycaster-intersection': function (evt: DetailEvent<{ el: Entity }>) {
      //   console.log('intersect!');
      // },
      // 'raycaster-intersection-cleared': function (evt: DetailEvent<any>) {
      //   console.log('intersect cleared!');
      // },
    },
    tick: function (t, dt) {
      if (this.el.components.raycaster.intersectedEls.length > 0) {
        const intersectedEl = this.el.components.raycaster.intersectedEls[0] as Entity | undefined;
        if (intersectedEl) {
          const threeRaycaster = this.el.components.raycaster.raycaster as THREE.Raycaster;
          const intersection = this.el.components.raycaster.getIntersection(intersectedEl) as THREE.Intersection;
          const rayDirection = threeRaycaster.ray.direction;
          
          if (!intersection.point.equals(this.fields.prev)) {
            // console.log('raycast-update', intersection, rayDirection);
            this.el.emit('raycast-update', { intersection, rayDirection });
          }
          this.fields.prev = intersection.point
        }
      }
      // if (!this.raycaster) { return; }  // Not intersecting.

      // // @ts-ignore
      // const intersection = this.raycaster.components.raycaster.getIntersection(this.el);
      // if (!intersection.point) { return; }
      // if (AFRAME.utils.coordinates.stringify(intersection.point) !== AFRAME.utils.coordinates.stringify(this.prev)) {
      //   // console.log(intersection.point);
      //   this.el.emit('raycast-change', { intersection });
      // }
      // this.prev = intersection.point;
    },
  });
}
