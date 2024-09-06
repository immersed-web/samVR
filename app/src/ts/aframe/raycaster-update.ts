import type { RayIntersectionData } from '@/modules/3DUtils';
import { THREE, type DetailEvent, type Entity } from 'aframe';

export default function () {

  AFRAME.registerComponent('raycaster-update', {
    // raycaster: null as null | Entity,
    dependencies: ['raycaster'],
    // fields: {
    // },
    prev: undefined as THREE.Vector3 | undefined,
    init: function () {
      console.log('INIT raycaster-update');
      this.prev = new THREE.Vector3();
      this.tick = AFRAME.utils.throttleTick(this.tick, 10, this);
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
          const intersectionData: RayIntersectionData = { intersection, rayDirection }
          
          if (!this.prev || !intersection.point.equals(this.prev)) {
            // console.log('emitting raycast with data');
            this.el.emit('raycast-update', intersectionData);
          }
          this.prev = intersection.point
        }
      } else {
        // No entity intersected
        if (this.prev) {
          // console.log('emitting raycast with undefined');
          this.el.emit('raycast-update', undefined);
        }
        this.prev = undefined
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