import fontFamilyUrl from '@/assets/Roboto-msdf.json?url'
import fontTextureUrl from '@/assets/Roboto-msdf.png'
import type { Block } from 'three-mesh-ui';
import type { Component, Entity, THREE, } from 'aframe';

const MESH_BLOCK_NAME = 'mesh-ui-block';
const MESH_TEXT_NAME = 'mesh-ui-text';
const MESH_BLOCK_STATE_NAME = 'mesh-ui-block-state';
const MESH_TEXT_STATE_NAME = 'mesh-ui-text-state';
export default async function () {
  const {default: ThreeMeshUI} = await import('three-mesh-ui');
  const blockLayoutSchema = {
    width: { type: "number", default: 1 },
    height: { type: "number", default: 0.6 },
    offset: { type: "number", default: 0 },
    margin: { type: "number", default: 0 },
    padding: { type: "number", default: 0 },
    fontSize: { type: "number", default: 0.03 },
    fontFamily: { type: "string", default: '' },
    fontTexture: { type: "string", default: '' },
    contentDirection: { type: "string", default: "column" },
    justifyContent: { type: "string", default: "center" },
    alignItems: { type: "string", default: "center" },
    // interLine: { type: 'number', default: undefined },
    // hiddenOverflow: { type: 'boolean', default: undefined },
  }

  const blockStyleSchema = {
    bestFit: { type: 'string', default: 'none' },
    backgroundColor: { type: 'color', default: '#000' },
    backgroundOpacity: { type: "number", default: 0.5 },
    // backGroundTexture,
    // backgroundSize,
    borderWidth: { type: 'number', default: 0.0 },
    borderRadius: { type: 'array', default: ['0.04'] },
    borderColor: { type: 'color', default: '#000' },
    borderOpacity: { type: 'number', default: 1 },
  }

  function whenComponentInitedAddToMeshUiBlock(child: Entity, parentBlock: Block) {
    const meshComponent = getMeshUIComponent(child);
    if (!meshComponent) return;
    if (meshComponent.initialized) {
      parentBlock.add(meshComponent.block);
    } else {
      console.log('waiting for child component to be ready');
      child.addEventListener('componentinitialized', function (evt) {
        const name = evt.detail.name
        if (name === MESH_BLOCK_NAME || name === MESH_TEXT_NAME) {
          console.log(`child mesh block ${name} was initialized. adding it as child`);
          const meshComponent = child.components[name]
          parentBlock.add(meshComponent.block);
        }
      })
    }
  }
  
  function parseBlockOptions(data: Record<string, unknown>) {
      return {
        ...data,
        backgroundColor: new THREE.Color(data.backgroundColor),
        borderRadius: data.borderRadius.length > 1 ? data.borderRadius : data.borderRadius[0],
        borderColor: new THREE.Color(data.borderColor),
        fontFamily: data.fontFamily === '' ? fontFamilyUrl : data.fontFamily,
        fontTexture: data.fontTexture === '' ? fontTextureUrl : data.fontTexture,
      }
  }
  
  function removeUnsetProperties(data: Record<string, unknown>, attrValue: Record<string, unknown>) {
    // console.log(data);
    // console.log(attrValue);
    const attrCopy = Object.assign({}, attrValue);
    for(const key in attrCopy){
      attrCopy[key] = data[key];
    }
    // console.log(attrCopy);
    return attrCopy;
  }

  AFRAME.registerComponent(MESH_BLOCK_NAME, {
    schema: {
      ...blockLayoutSchema,
      ...blockStyleSchema,
    },
    isUiRoot: false,
    block: undefined as unknown as Block,
    init: function () {
      // console.log('INIT MESH BLOCK');
      const receivedOptions = removeUnsetProperties(parseBlockOptions(this.data) , this.attrValue);
      this.block = new ThreeMeshUI.Block(receivedOptions);
      // @ts-ignore
      this.block['name'] = 'mesh-ui-block';
      this.block['el'] = this.el;

      const parent = this.el.parentElement as Entity
      if (!parent.components[MESH_BLOCK_NAME]) {
        // console.log('parent has no mesh ui block component. Attaching to entity');
        this.isUiRoot = true;
        this.el.object3D.add(this.block);
      }

      this.el.addEventListener('child-attached', (evt) => {
        evt.stopPropagation(); // We only care about direct children
        // console.log('child attached:',evt.detail);
        rebuildChildren();
      });

      this.el.addEventListener('child-detached', (evt) => {
        evt.stopPropagation(); // We only care about direct children
        console.log('child detached:',evt.detail);
        const childEntity = evt.detail.el as Entity
        // Dont know why we need to do this. Thought "normal" entities would also be removed by the .clear() in rebuildChildren
        if (!hasMeshUIComponent(childEntity)) {
          // console.log('child detached that isnt a mesh-ui component. Removing the entity\'s object3D from this components block');
          this.block.remove(childEntity.object3D)
        }
        rebuildChildren();
      });

      // NOTE: three-mesh-ui relies on the order of the children for calculating the layout.
      // Specifically it seems that what matters is the order of calls to .add()
      // I tried to change the children order manually but doesnt seem to have any impact.
      // Thus we take the brute force way and remove all the children and rebuild it.
      const rebuildChildren = () => {
        console.log('rebuilding childList');
        this.block.clear();
        const children = this.el.children;
        for (const child of children) {
          const childEntity = child as Entity;
          if (!hasMeshUIComponent(childEntity)) {
            // console.log('found child that isnt a mesh-ui component. Adding the entity\'s object3D to this components block');
            this.block.add(childEntity.object3D);
          } else {
            whenComponentInitedAddToMeshUiBlock(childEntity, this.block);
          }
        }
      }
      rebuildChildren();
    },
    update: function () {
      if (!this.block) return;
      const receivedOptions = removeUnsetProperties(parseBlockOptions(this.data), this.attrValue);
      if(this.isUiRoot){
        if(!('fontFamily' in receivedOptions)){
          receivedOptions.fontFamily = fontFamilyUrl;
          receivedOptions.fontTexture = fontTextureUrl;
          // this.block.set({fontFamily: fontFamilyUrl, fontTexture: fontTextureUrl});
        }
      }
      this.block.setupState({state:'default', attributes: receivedOptions});
      this.block.set(receivedOptions);
    },
    tick(_time, _timeDelta) {
      if (this.isUiRoot) {
        ThreeMeshUI.update();
      }
    },
    remove() {
      if (!this.block) return;
      this.block.clear();
      this.block.removeFromParent();
    },
  });

  const textLayoutSchema = {
    content: { type: 'string', default: 'Please provide text!' },
    // fontKerning,
    // letterSpacing,
    textAlign: { type: "string", default: "center" },
    whiteSpace: { type: "string", default: "normal" },
    // breakOn,
  }

  const textStyleSchema = {
    fontColor: { type: 'color', default: '#fff' },
    fontOpacity: { type: 'number', default: 1 },
    // fontSuperSampling,
  }

  AFRAME.registerComponent(MESH_BLOCK_STATE_NAME, {
    dependencies: [MESH_BLOCK_NAME],
    multiple: true,
    schema: {
      ...blockLayoutSchema,
      ...blockStyleSchema,
    },
    block: undefined as undefined | Block,
    events: {
      setState(evt) {
        // console.log('setState event!', evt);
        this.block.setState(evt.detail);
      }
    },
    init() {
      console.log("BLOCK STATE INIT");
      // console.log(this);
      // console.log('init data:');
      const meshComponent = this.el.components[MESH_BLOCK_NAME];
      this.block = meshComponent.block;
      if(!this.block) {
        console.error('no block on entity->component');
        return;
      }

      // const allOptions = parseBlockOptions(this.data);
      // const pickedOptions = removeUnsetProperties(allOptions, this.attrValue);
      // this.block.setupState({state: this.id, attributes: pickedOptions});

    },
    update(oldData) {
      if (!this.block) return;
      const allOptions = parseBlockOptions(this.data);
      const pickedOptions = removeUnsetProperties(allOptions, this.attrValue);
      // console.log(pickedOptions);
      this.block.setupState({state: this.id, attributes: pickedOptions});
    },
  })

  AFRAME.registerComponent(MESH_TEXT_NAME, {
    schema: {
      ...textLayoutSchema,
      ...textStyleSchema
    },
    block: undefined as unknown as Block,
    init: function () {
      // console.log('INIT MESH Text');
      // console.log(this);
      this.block = new ThreeMeshUI.Text(this.calculateOptionsObject())
      this.block['name'] = MESH_TEXT_NAME;
    },
    update: function () {
      this.block.set(this.calculateOptionsObject());
    },
    calculateOptionsObject() {
      return {
        ...this.data,
        fontColor: new THREE.Color(this.data.fontColor),
      }
    },
    tick(_time, _timeDelta) {
    },
    remove() {
      this.block.clear();
      this.block.removeFromParent();
    },
  })

  // Here we monkey patch aframes internal raycaster so it also intersects mesh-ui object3Ds
  const globalRaycasterComponent = AFRAME.components['raycaster'].Component;
  globalRaycasterComponent.prototype['checkIntersections'] = patchedCheckIntersection;
  globalRaycasterComponent.prototype['flattenObject3DMaps'] = patchedFlattenObject3DMaps;


  // AFRAME.registerComponent('raycast-me', {
  //   dependencies: [MESH_BLOCK_NAME],
  //   raycaster: undefined as THREE.Raycaster | undefined,
  //   rayCasterComponent: undefined as undefined | Component<{ raycaster: THREE.Raycaster }, any>,
  //   uiFrameMesh: undefined as undefined | Block,
  //   init() {
  //     console.log('RAYCAST ME INIT');
  //     this.el.sceneEl!.addEventListener('componentinitialized', (evt: CustomEvent) => {
  //       // console.log(evt.detail);
  //       if (evt.detail.name === 'raycaster') {
  //         this.rayCasterComponent = this.el.sceneEl?.components['raycaster'];
  //         this.raycaster = this.rayCasterComponent.raycaster as THREE.Raycaster
  //         // console.log(this.raycaster);
  //         // this.rayCasterComponent.test();
  //       }
  //     })
  //     this.uiFrameMesh = this.el.components[MESH_BLOCK_NAME].block.children[0];
  //     // console.log(this.uiFrameMesh);
  //     this.tock = AFRAME.utils.throttleTick(this.tock, 200, this);

  //     console.log(globalRaycasterComponent);
  //   },
  //   tock(time, timeDelta, camera) {
  //     if (!this.raycaster || !this.uiFrameMesh) {
  //       console.error('no raycaster or block available');
  //       return;
  //     }
  //     const intersections = this.raycaster.intersectObject(this.uiFrameMesh, false);
  //     if (intersections.length) {
  //       console.log(intersections);
  //       // this.rayCasterComponent.intersectedEls.
  //     }
  //   },

  // })
}


function hasMeshUIComponent(entity: Entity) {
  return entity.components["mesh-ui-block"] || entity.components["mesh-ui-text"];
}

function getMeshUIComponent(entity: Entity) {
  const meshblock = entity.components[MESH_BLOCK_NAME];
  const meshtext = entity.components[MESH_TEXT_NAME];
  if (meshblock && meshtext) console.warn('an entity should only have either a mesh-ui-block or mesh-ui-text');
  return meshblock ? meshblock : meshtext;
}


const EVENTS = {
  INTERSECT: 'raycaster-intersected',
  INTERSECTION: 'raycaster-intersection',
  INTERSECT_CLEAR: 'raycaster-intersected-cleared',
  INTERSECTION_CLEAR: 'raycaster-intersection-cleared',
  INTERSECTION_CLOSEST_ENTITY_CHANGED: 'raycaster-closest-entity-changed'
};
/**
* Raycast for intersections and emit events for current and cleared intersections.
*/
function patchedCheckIntersection() {
  const clearedIntersectedEls = this.clearedIntersectedEls;
  const el = this.el;
  const data = this.data;
  let i;
  const intersectedEls = this.intersectedEls;
  let intersection;
  const intersections = this.intersections;
  const newIntersectedEls = this.newIntersectedEls;
  const newIntersections = this.newIntersections;
  const prevIntersectedEls = this.prevIntersectedEls;
  const rawIntersections = this.rawIntersections;

  // Refresh the object whitelist if needed.
  if (this.dirty) { this.refreshObjects(); }

  // Store old previously intersected entities.
  copyArray(this.prevIntersectedEls, this.intersectedEls);

  // Raycast.
  this.updateOriginDirection();
  rawIntersections.length = 0;
  this.raycaster.intersectObjects(this.objects, true, rawIntersections);

  // Only keep intersections against objects that have a reference to an entity.
  intersections.length = 0;
  intersectedEls.length = 0;
  for (i = 0; i < rawIntersections.length; i++) {
    intersection = rawIntersections[i];
    // Don't intersect with own line.
    if (data.showLine && intersection.object === el.getObject3D('line')) {
      continue;
    }
    if (intersection.object.el) {
      intersections.push(intersection);
      intersectedEls.push(intersection.object.el);
    } else if(intersection.object.parent?.name === MESH_BLOCK_NAME) {
      // NOTE: THIS PART ADDED BY GUNNAR. THIS IS PART OF THE MONKEY PATCH
      // console.log('intersection with ui block:');
      // console.log(intersection);
      intersection.object = intersection.object.parent
      intersections.push(intersection);
      intersectedEls.push(intersection.object.el);
    }
  }

  // Get newly intersected entities.
  newIntersections.length = 0;
  newIntersectedEls.length = 0;
  for (i = 0; i < intersections.length; i++) {
    if (prevIntersectedEls.indexOf(intersections[i].object.el) === -1) {
      newIntersections.push(intersections[i]);
      newIntersectedEls.push(intersections[i].object.el);
    }
  }

  // Emit intersection cleared on both entities per formerly intersected entity.
  clearedIntersectedEls.length = 0;
  for (i = 0; i < prevIntersectedEls.length; i++) {
    if (intersectedEls.indexOf(prevIntersectedEls[i]) !== -1) { continue; }
    prevIntersectedEls[i].emit(EVENTS.INTERSECT_CLEAR,
      this.intersectedClearedDetail);
    clearedIntersectedEls.push(prevIntersectedEls[i]);
  }
  if (clearedIntersectedEls.length) {
    el.emit(EVENTS.INTERSECTION_CLEAR, this.intersectionClearedDetail);
  }

  // Emit intersected on intersected entity per intersected entity.
  for (i = 0; i < newIntersectedEls.length; i++) {
    newIntersectedEls[i].emit(EVENTS.INTERSECT, this.intersectedDetail);
  }

  // Emit all intersections at once on raycasting entity.
  if (newIntersections.length) {
    this.intersectionDetail.els = newIntersectedEls;
    this.intersectionDetail.intersections = newIntersections;
    el.emit(EVENTS.INTERSECTION, this.intersectionDetail);
    // console.log('INTERSECTION HELLO FROM PATCHED RAYCASTER');
  }

  // Emit event when the closest intersected entity has changed.
  if (prevIntersectedEls.length === 0 && intersections.length > 0 ||
    prevIntersectedEls.length > 0 && intersections.length === 0 ||
    (prevIntersectedEls.length && intersections.length &&
      prevIntersectedEls[0] !== intersections[0].object.el)) {
    this.intersectionDetail.els = this.intersectedEls;
    this.intersectionDetail.intersections = intersections;
    el.emit(EVENTS.INTERSECTION_CLOSEST_ENTITY_CHANGED, this.intersectionDetail);
  }

  // Update line length.
  if (data.showLine) { setTimeout(this.updateLine); }
}

function patchedFlattenObject3DMaps(els) {
  // console.log('HELLO FROM PATCHED FLATTENOBJECT3DMAPS');
  let key;
  let i;
  const objects = this.objects;
  const scene = this.el.sceneEl.object3D;

  function isAttachedToScene (object) {
    if (object.parent) {
      return isAttachedToScene(object.parent);
    } else {
      return (object === scene);
    }
  }

  // Push meshes and other attachments onto list of objects to intersect.
  objects.length = 0;
  for (i = 0; i < els.length; i++) {
    const el = els[i];
    if(el.components[MESH_BLOCK_NAME]){
      // console.log('found entity with mesh-ui-block. Will get special treatment', el);
      // NOTE: HERE'S SOME MORE MONKEY PATCHING!
      const meshBlockComponent = el.components[MESH_BLOCK_NAME];
      objects.push(meshBlockComponent.block);
    }
    if (el.isEntity && el.object3D && isAttachedToScene(el.object3D)) {
      for (key in el.object3DMap) {
        objects.push(el.getObject3D(key));
      }
    }
  }

  return objects;
}

/**
 * Copy contents of one array to another without allocating new array.
 */
function copyArray(a, b) {
  let i;
  a.length = b.length;
  for (i = 0; i < b.length; i++) {
    a[i] = b[i];
  }
}