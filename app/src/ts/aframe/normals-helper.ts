import { THREE, type Entity } from "aframe";

import { VertexNormalsHelper } from "../VertexNormalsHelper";

export default function () {
  AFRAME.registerComponent('normals-helper', {
    normalsHelpers: [] as VertexNormalsHelper[],
    currentColor: undefined as unknown as THREE.Color,
    helperCreated: false as boolean,
    schema: {
      enabled: { type: 'boolean', default: true },
      color: { type: 'color', default: '#ffffff' }
    },
    // currentPosition: undefined as unknown as THREE.Vector3,
    // prevPosition: undefined as unknown as THREE.Vector3,
    // currentQuat: undefined as unknown as THREE.Quaternion,
    // prevQuat: undefined as unknown as THREE.Quaternion,
    // currentScale: undefined as unknown as THREE.Vector3,
    // prevScale: undefined as unknown as THREE.Vector3,
    init: function () {
      console.log('normals-helper init:', this);
      this.currentColor = new THREE.Color(this.data.color);
      this.helperCreated = false;
      this.tick = AFRAME.utils.throttleTick(this.tick!, 60, this);
      // this.currentPosition = new THREE.Vector3();
      // this.prevPosition = new THREE.Vector3();
      // this.currentQuat = new THREE.Quaternion();
      // this.prevQuat = new THREE.Quaternion();
      // this.currentScale = new THREE.Vector3();
      // this.prevScale = new THREE.Vector3();

      this.helperCreated = this.createHelper();
    },
    createHelper: function () {
      console.log('creating VertexNormalsHelper');
      let mesh = this.el.getObject3D('mesh') as THREE.Mesh
      if (!mesh) return false;
      if (mesh.isMesh) {
        this.addHelper(mesh);
      }
      mesh.traverse(node => {
        console.log('traversing mesh. current node:', node);
        const maybeMesh = node as THREE.Mesh
        if (maybeMesh.isMesh) {
          this.addHelper(maybeMesh);
        }
      })
      return true;
    },
    addHelper(mesh: THREE.Mesh) {
      const helper = new VertexNormalsHelper(mesh, 0.2, this.currentColor.getHex())
      this.normalsHelpers.push(helper);

      const scene = this.el.sceneEl?.object3D
      if (scene) {
        scene.add(helper);
      }
    },
    tick(t: number, dt: number) {
      if (!this.helperCreated) {
        this.helperCreated = this.createHelper();
        if (!this.helperCreated) return;
      }
      if (this.data.enabled === false) return;
      this.normalsHelpers.forEach(h => h.update());

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
      if (!this.helperCreated) return;
      this.normalsHelpers.forEach(h => h.visible = this.data.enabled);
      // if (this.data.color && this.normalsHelper) {
      //   const color = new THREE.Color(this.data.color);
      //   this.normalsHelper
      //   if(this.normalsHelper.material instanceof Array){

      //     this.normalsHelper.material.forEach(m => m.color = color);
      //   } else {
      //     this.normalsHelper.material.color = color
      //   }
      // }
    },
    remove: function () {
      // console.log('box-helper remove');
      // if (this.boxHelper) {
      this.el.sceneEl?.object3D.remove(...this.normalsHelpers);
      this.normalsHelpers.forEach(h => h.dispose());
      // }
    },
  })
}