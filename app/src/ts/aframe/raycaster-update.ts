import { intersectionToTransform, type RayIntersectionData } from '@/modules/3DUtils';
import { THREE, type Component, type ComponentDefinition, type DetailEvent, type Entity } from 'aframe';

export default function () {

  AFRAME.registerComponent('raycaster-update', {
    // raycaster: null as null | Entity,
    dependencies: ['raycaster'],
    // fields: {
    // },
    prev: undefined as THREE.Vector3 | undefined,
    stashedCursorStyle: undefined as string | undefined,
    outsideCanvas: false,
    utilVector: undefined as unknown as THREE.Vector3,
    onMouseEnter(e: MouseEvent) {
      if (e instanceof MouseEvent) {
        // console.log('cursor entered the canvas', e);
        this.outsideCanvas = false;
      }
    },
    onMouseLeave(e: MouseEvent) {
      if (e instanceof MouseEvent) {
        // this.el.components.raycaster.data.enabled = false;
        // console.log(this.el.components.raycaster);
        // console.log('cursor left the canvas', e);
        this.outsideCanvas = true;
      }
    },
    init: function () {
      this.utilVector = new THREE.Vector3();
      this.onMouseEnter = this.onMouseEnter.bind(this);
      this.onMouseLeave = this.onMouseLeave.bind(this);
      console.log('INIT raycaster-update');
      this.prev = new THREE.Vector3();
      this.tick = AFRAME.utils.throttleTick(this.tick, 10, this);
      const canvas = this.el.sceneEl!.canvas;

      canvas.addEventListener('mouseenter', this.onMouseEnter)
      canvas.addEventListener('mouseleave', this.onMouseLeave)

    },
    remove() {
      const canvas = this.el.sceneEl!.canvas;
      canvas.removeEventListener('mouseenter', this.onMouseEnter)
      canvas.removeEventListener('mouseleave', this.onMouseLeave)
    },
    pause() {
      const canvas = this.el.sceneEl!.canvas;
      canvas.removeEventListener('mouseenter', this.onMouseEnter)
      canvas.removeEventListener('mouseleave', this.onMouseLeave)
    },
    events: {
      'raycaster-intersection': function (evt: DetailEvent<unknown>) {
        // console.log('intersection', JSON.stringify(evt.detail.intersections[0].normal));
        const canvas = this.el.sceneEl!.canvas;
        const canvasCursor = canvas.style.cursor;
        if (canvasCursor !== '') {
          // console.log('stashing canvasCursor:', canvasCursor);
          this.stashedCursorStyle = canvasCursor;
          canvas.style.cursor = 'pointer';
        }
      },
      'raycaster-intersection-cleared': function (evt: DetailEvent<any>) {
        // console.log('intersection cleared!');
        const canvas = this.el.sceneEl!.canvas;
        if (this.stashedCursorStyle) {
          canvas.style.cursor = this.stashedCursorStyle;
        }
      },
    },
    tick: function (t, dt) {
      if (this.outsideCanvas) {
        if (this.prev) {
          // console.log('emitting raycast with undefined when exited window');
          this.el.emit('raycast-update', undefined);
        }
        this.prev = undefined;
        return;
      }
      const raycasterComponent = this.el.components.raycaster as ComponentDefinition<{
        intersectedEls: Entity[];
        raycaster: THREE.Raycaster;
        getIntersection: (el: Entity) => THREE.Intersection;
      }>;
      if (raycasterComponent.intersectedEls.length > 0) {
        const intersectedEl = raycasterComponent.intersectedEls[0] as Entity | undefined;
        if (intersectedEl) {
          const threeRaycaster = raycasterComponent.raycaster;
          const intersection = raycasterComponent.getIntersection(intersectedEl);

          const rayDirection = threeRaycaster.ray.direction;
          let normal = intersection.normal;
          if (!normal) normal = intersection.face?.normal
          this.utilVector.copy(normal!)
          this.utilVector.transformDirection(intersection.object.matrixWorld)
          // intersection.object.localToWorld(this.utilVector);
          const worldSpaceNormal = this.utilVector.toArray();
          const intersectionData: RayIntersectionData = { intersection, rayDirection, worldSpaceNormal };
          
          if (!this.prev || !intersection.point.equals(this.prev)) {
            // console.log('emitting raycast: ', intersectionData);
            // const transform = intersectionToTransform(intersectionData);
            // console.log('raycast update', transform);
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