import { BoxGeometry, Color, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Object3D } from 'three';
import { createFloorMaterial, roomFinishes, type FloorMaterialBundle } from './finishes';
import { boardPose, boardTransition, createBoards, FLOOR, sampleStory } from './motion';

/** Six instanced floors share geometry. At most two finishes are visible in a transition. */
export class AnimatedFloor {
  readonly group = new Group();
  readonly boards = createBoards();
  readonly bundles: FloorMaterialBundle[] = [];
  private meshes: InstancedMesh[] = [];
  private geometry = new BoxGeometry(1, 1, 1);
  private dummy = new Object3D();
  private previous = Number.NaN;
  private previousReduced = false;
  private disposed = false;
  constructor() {
    this.group.name = 'scroll-floor-planks';
    const uv = new Float32Array(this.boards.length * 4);
    this.boards.forEach((board, index) => uv.set([board.seed * 0.81, board.seed * 0.16, board.seed > 0.5 ? -1 : 1, board.length / FLOOR.plankLength], index * 4));
    this.geometry.setAttribute('boardUv', new InstancedBufferAttribute(uv, 4));
  }
  addFinish(anisotropy: number) {
    if (this.disposed) throw new Error('Cannot add a finish to a disposed floor.');
    const index = this.bundles.length;
    const bundle = createFloorMaterial(roomFinishes[index], anisotropy);
    bundle.top.onBeforeCompile = shader => {
      shader.vertexShader = 'attribute vec4 boardUv;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
        vec2 plankUv = vec2(uv.x * boardUv.w * boardUv.z + boardUv.x, uv.y * 0.82 + boardUv.y);
        #ifdef USE_MAP
          vMapUv = plankUv;
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = plankUv;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = plankUv;
        #endif
      `);
    };
    bundle.top.customProgramCacheKey = () => 'room-plank-variation-v1';
    const edge = bundle.edge;
    const mesh = new InstancedMesh(this.geometry, [edge, edge, bundle.top, edge, edge, edge], this.boards.length);
    mesh.name = roomFinishes[index].id;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    this.boards.forEach((board, i) => {
      this.setPose(mesh, i, 0);
      const tint = 0.95 + board.seed * 0.09;
      mesh.setColorAt(i, new Color(tint, tint, tint));
    });
    mesh.visible = index === 0;
    this.bundles.push(bundle);
    this.meshes.push(mesh);
    this.group.add(mesh);
    return bundle.thumbnail;
  }
  private setPose(mesh: InstancedMesh, index: number, amount: number) {
    const board = this.boards[index];
    const pose = boardPose(board, amount);
    this.dummy.position.set(pose.x, pose.y, pose.z);
    this.dummy.rotation.set(pose.rx, pose.ry, pose.rz);
    this.dummy.scale.set(board.length - 0.00075, FLOOR.thickness, FLOOR.plankWidth - 0.00075);
    this.dummy.updateMatrix();
    mesh.setMatrixAt(index, this.dummy.matrix);
  }
  update(position: number, reducedMotion: boolean) {
    if (this.disposed) return false;
    const state = sampleStory(position, this.meshes.length);
    const sampled = reducedMotion ? Math.round(position) : position;
    if (sampled === this.previous && reducedMotion === this.previousReduced) return false;
    this.previous = sampled;
    this.previousReduced = reducedMotion;
    this.meshes.forEach((mesh, finish) => {
      mesh.visible = reducedMotion ? finish === Math.round(position) : (finish === state.from || (finish === state.to && state.phase > 0.50));
      if (!mesh.visible) return;
      this.boards.forEach((board, index) => this.setPose(mesh, index,
        reducedMotion || state.from === state.to ? 0 : boardTransition(board, state.phase, finish === state.to)));
      mesh.instanceMatrix.needsUpdate = true;
    });
    return true;
  }
  get diagnostics() { return {plankCount: this.boards.length, loadedFinishes: this.meshes.length, visibleFinishes: this.meshes.filter(m => m.visible).map(m => m.name)}; }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.meshes.forEach(mesh => mesh.dispose());
    this.geometry.dispose();
    this.bundles.forEach(bundle => bundle.dispose());
    this.group.removeFromParent();
    this.group.clear();
  }
}
