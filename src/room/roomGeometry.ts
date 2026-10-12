import {
  BoxGeometry, BufferGeometry, CanvasTexture, CatmullRomCurve3, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute,
  Group, InstancedMesh, LatheGeometry, Mesh, MeshBasicMaterial, MeshPhysicalMaterial,
  MeshStandardMaterial, Object3D, PlaneGeometry, RepeatWrapping,
  SRGBColorSpace, TubeGeometry, Vector2, Vector3,
  type Material, type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { noise2 } from '../textures/noise';

export interface RoomModel {
  group: Group;
  /** Releases only resources created by this room, including instanced buffers. */
  dispose(): void;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Real, metre-scaled furniture and architectural geometry; the host supplies the floor and lighting. */
export function createRoom(): RoomModel {
  const group = new Group();
  group.name = 'sunlit-scandinavian-room';
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const instances = new Set<InstancedMesh>();
  const random = seededRandom(746398);
  const ownGeometry = <T extends BufferGeometry>(geometry: T): T => { geometries.add(geometry); return geometry; };
  const ownMaterial = <T extends Material>(material: T): T => { materials.add(material); return material; };
  const ownTexture = <T extends Texture>(texture: T): T => { textures.add(texture); return texture; };

  function canvasMap(kind: 'linen' | 'wood' | 'plaster'): CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const context = canvas.getContext('2d')!;
    const data = context.createImageData(512, 512);
    const rng = seededRandom(kind === 'wood' ? 92377 : kind === 'linen' ? 18549 : 8713);
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4;
      if (kind === 'wood') {
        const drift = (noise2(x * 0.006, y * 0.005, 6251) - 0.5) * 18;
        const bands = (noise2((x + drift) * 0.072, y * 0.003, 3741) - 0.5) * 14;
        const fibers = noise2((x + drift) * 0.47, y * 0.018, 4837);
        const vessels = Math.max(0, fibers - 0.64) ** 1.4 * 45;
        const tone = bands - vessels + (rng() - 0.5) * 5;
        data.data[i] = 176 + tone; data.data[i + 1] = 143 + tone; data.data[i + 2] = 104 + tone * 0.8;
      } else {
        const weave = kind === 'linen' ? Math.sin(x * Math.PI / 2) * 3.8 + Math.sin(y * Math.PI / 2) * 2.9 : 0;
        const mottling = kind === 'linen' ? (noise2(x * 0.028, y * 0.034, 7149) - 0.5) * 10 : 0;
        const value = 238 + weave + mottling + (rng() - 0.5) * (kind === 'linen' ? 13 : 6);
        data.data[i] = value; data.data[i + 1] = value; data.data[i + 2] = value;
      }
      data.data[i + 3] = 255;
    }
    context.putImageData(data, 0, 0);
    const texture = ownTexture(new CanvasTexture(canvas));
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(kind === 'linen' ? 5 : kind === 'wood' ? 1.4 : 4, kind === 'linen' ? 5 : kind === 'wood' ? 1 : 4);
    texture.anisotropy = 4;
    return texture;
  }

  const linenMap = canvasMap('linen');
  const plasterMap = canvasMap('plaster');
  const oakMap = canvasMap('wood');
  const wall = ownMaterial(new MeshStandardMaterial({ color: '#ede9df', roughness: 0.94, bumpMap: plasterMap, bumpScale: 0.0006 }));
  const trim = ownMaterial(new MeshStandardMaterial({ color: '#f3efe4', roughness: 0.66 }));
  const fabric = ownMaterial(new MeshPhysicalMaterial({ color: '#cec3af', map: linenMap, bumpMap: linenMap, bumpScale: 0.0015, roughness: 0.98, sheen: 0.22, sheenColor: new Color('#e7ddc7'), sheenRoughness: 0.9 }));
  const pillowFabric = ownMaterial(new MeshPhysicalMaterial({ color: '#e9dfc9', map: linenMap, bumpMap: linenMap, bumpScale: 0.001, roughness: 0.99, sheen: 0.4, sheenRoughness: 0.85 }));
  const oliveFabric = ownMaterial(new MeshPhysicalMaterial({ color: '#424d2a', map: linenMap, bumpMap: linenMap, bumpScale: 0.0016, roughness: 0.96, sheen: 0.12, sheenColor: new Color('#647345'), sheenRoughness: 0.9 }));
  const seamMaterial = ownMaterial(new MeshStandardMaterial({ color: '#b9ac94', roughness: 1 }));
  const oak = ownMaterial(new MeshPhysicalMaterial({ color: '#ffffff', map: oakMap, bumpMap: oakMap, bumpScale: 0.00055, roughness: 0.52, clearcoat: 0.09, clearcoatRoughness: 0.52 }));
  const darkWood = ownMaterial(new MeshStandardMaterial({ color: '#4b3f2b', roughness: 0.67 }));
  const stoneware = ownMaterial(new MeshStandardMaterial({ color: '#b9ac91', roughness: 0.86, bumpMap: plasterMap, bumpScale: 0.0013 }));
  const creamCeramic = ownMaterial(new MeshPhysicalMaterial({ color: '#b8b09d', roughness: 0.5, clearcoat: 0.12, clearcoatRoughness: 0.46, bumpMap: plasterMap, bumpScale: 0.0004 }));
  const soil = ownMaterial(new MeshStandardMaterial({ color: '#302b20', roughness: 1 }));
  const bark = ownMaterial(new MeshStandardMaterial({ color: '#69533c', roughness: 0.92, bumpMap: plasterMap, bumpScale: 0.001 }));

  function addMesh(geometry: BufferGeometry, material: Material, position: [number, number, number], parent = group, castShadow = true): Mesh {
    const mesh = new Mesh(ownGeometry(geometry), material);
    mesh.position.set(...position);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function box(size: [number, number, number], position: [number, number, number], material: Material, parent = group, radius = 0): Mesh {
    return addMesh(radius > 0 ? new RoundedBoxGeometry(...size, 4, Math.min(radius, ...size.map(v => v * 0.49))) : new BoxGeometry(...size), material, position, parent);
  }
  function looseCushion(size: [number, number, number], position: [number, number, number], material: Material, parent: Group, phase: number): Group {
    const cushion = new Group();
    cushion.position.set(...position); parent.add(cushion);
    const [width, height, depth] = size;
    const radius = Math.min(height, depth) * 0.36;
    const geometry = new RoundedBoxGeometry(width, height, depth, 7, radius);
    const vertices = geometry.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
      const nx = x / (width / 2), ny = y / (height / 2), nz = z / (depth / 2);
      const centre = Math.max(0, 1 - nx * nx) * Math.max(0, 1 - ny * ny);
      const edgeFold = Math.sin(ny * 14 + phase + nx * 5) * Math.exp(-Math.abs(nx) * 0.3) * Math.abs(nx) ** 6;
      vertices.setX(i, x * (1 - Math.abs(ny) ** 4 * 0.027));
      vertices.setY(i, y - Math.max(0, ny) * Math.max(0, 1 - nx * nx) * 0.012 + edgeFold * 0.0025);
      vertices.setZ(i, z + Math.sign(nz) * (centre * 0.036 + edgeFold * 0.003) * Math.abs(nz));
    }
    geometry.computeVertexNormals();
    addMesh(geometry, material, [0, 0, 0], cushion);
    const points: Vector3[] = [];
    const seamWidth = width * 0.91, seamHeight = height * 0.91;
    const r = Math.min(width, height) * 0.09;
    const corners = [[seamWidth / 2 - r, seamHeight / 2 - r], [-seamWidth / 2 + r, seamHeight / 2 - r], [-seamWidth / 2 + r, -seamHeight / 2 + r], [seamWidth / 2 - r, -seamHeight / 2 + r]];
    for (let c = 0; c < 4; c++) for (let s = 0; s < 6; s++) {
      const angle = c * Math.PI / 2 + s / 5 * Math.PI / 2;
      points.push(new Vector3(corners[c][0] + Math.cos(angle) * r, corners[c][1] + Math.sin(angle) * r, depth / 2 - 0.016));
    }
    addMesh(new TubeGeometry(new CatmullRomCurve3(points, true, 'centripetal'), 76, 0.0018, 4, true), material, [0, 0, 0], cushion, false);
    return cushion;
  }
  function roundedSeam(width: number, depth: number, radius: number, y: number, parent: Group): void {
    const points: Vector3[] = [];
    const corners = [[width / 2 - radius, depth / 2 - radius], [-width / 2 + radius, depth / 2 - radius], [-width / 2 + radius, -depth / 2 + radius], [width / 2 - radius, -depth / 2 + radius]];
    for (let corner = 0; corner < 4; corner++) for (let segment = 0; segment < 7; segment++) {
      const angle = corner * Math.PI / 2 + segment / 6 * Math.PI / 2;
      points.push(new Vector3(corners[corner][0] + Math.cos(angle) * radius, y, corners[corner][1] + Math.sin(angle) * radius));
    }
    const curve = new CatmullRomCurve3(points, true, 'centripetal');
    addMesh(new TubeGeometry(curve, 100, 0.0028, 5, true), seamMaterial, [0, 0, 0], parent, false);
  }

  // Warm plaster wall on the left and a glazed opening across the right.
  box([2.81, 3.18, 0.16], [-2.255, 1.59, -2.78], wall);
  box([0.16, 3.18, 7.28], [-3.74, 1.59, 0.90], wall);
  // The ceiling's underside meets the 3.18 m wall top; the front edge now
  // accommodates the longer floor and a portrait camera inside the room.
  box([7.40, 0.16, 7.28], [0, 3.26, 0.90], wall);
  box([2.81, 0.105, 0.024], [-2.255, 0.0525, -2.682], trim);
  box([0.024, 0.105, 7.20], [-3.649, 0.0525, 0.90], trim);
  box([4.53, 0.25, 0.17], [1.405, 3.025, -2.78], wall);
  const frameZ = -2.735;
  box([4.53, 0.074, 0.16], [1.405, 0.047, frameZ], trim);
  box([4.53, 0.066, 0.16], [1.405, 2.878, frameZ], trim);
  for (const x of [-0.84, 0.625, 2.08, 3.64]) box([0.047, 2.81, 0.135], [x, 1.467, frameZ], trim);
  const glass = ownMaterial(new MeshPhysicalMaterial({ color: '#e8eef0', roughness: 0.08, transparent: true, opacity: 0.055, metalness: 0, depthWrite: false, side: DoubleSide }));
  addMesh(new PlaneGeometry(4.43, 2.76), glass, [1.40, 1.47, -2.795], group, false);

  const curtain = ownMaterial(new MeshPhysicalMaterial({ color: '#eee5d2', map: linenMap, bumpMap: linenMap, bumpScale: 0.00035, roughness: 0.98, transparent: true, opacity: 0.87, side: DoubleSide, depthWrite: false, sheen: 0.3, sheenRoughness: 1 }));
  function curtainPanel(x: number, width: number, phase: number): void {
    const height = 2.99;
    const geometry = new PlaneGeometry(width, height, 80, 24);
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const px = position.getX(i);
      const py = position.getY(i);
      const fold = px / width * Math.PI * 15 + phase;
      const flare = (height / 2 - py) / height;
      position.setX(i, px * (0.95 + flare * 0.08));
      position.setZ(i, Math.cos(fold) * (0.034 + flare * 0.012) + Math.sin(fold * 2.07 + py * 1.7) * 0.005);
      position.setY(i, py + Math.sin(fold + phase) * 0.004 * flare ** 8);
    }
    geometry.computeVertexNormals();
    addMesh(geometry, curtain, [x, 1.52, -2.52], group, false);
  }
  curtainPanel(-0.73, 0.46, 0.3);
  curtainPanel(-0.99, 0.18, 1.8);
  curtainPanel(3.36, 0.64, 1.1);
  addMesh(new CylinderGeometry(0.012, 0.012, 4.95, 10), trim, [1.34, 3.03, -2.48]).rotation.z = Math.PI / 2;

  // Deep, upholstered sofa: its low feet, loose cushions and piping break up the silhouette.
  const sofa = new Group();
  sofa.name = 'cream-linen-sofa';
  sofa.position.set(1.40, 0, -1.78);
  group.add(sofa);
  for (const x of [-1.32, 1.32]) for (const z of [-0.36, 0.32]) box([0.07, 0.075, 0.085], [x, 0.038, z], darkWood, sofa, 0.014);
  box([3.14, 0.34, 1.075], [0, 0.25, 0], fabric, sofa, 0.125);
  box([3.07, 0.59, 0.28], [0, 0.635, -0.40], fabric, sofa, 0.13);
  for (const x of [-1.435, 1.435]) box([0.30, 0.70, 1.10], [x, 0.43, 0.005], fabric, sofa, 0.145);
  for (const x of [-0.685, 0.685]) {
    const seat = new Group();
    seat.position.set(x, 0.438, 0.115);
    sofa.add(seat);
    box([1.365, 0.255, 0.80], [0, 0, 0], fabric, seat, 0.105);
    roundedSeam(1.325, 0.767, 0.11, 0.008, seat);
  }
  for (let i = 0; i < 3; i++) {
    const back = looseCushion([0.928, 0.55, 0.22], [-0.924 + i * 0.924, 0.767 - (i % 2) * 0.014, -0.331], fabric, sofa, i * 0.8);
    back.rotation.x = -0.16;
    back.rotation.z = (i - 1) * -0.021;
  }
  const ivoryPillow = looseCushion([0.53, 0.46, 0.14], [-1.00, 0.724, 0.015], pillowFabric, sofa, 1.3);
  ivoryPillow.rotation.set(-0.30, -0.16, 0.25);
  const olivePillow = looseCushion([0.63, 0.45, 0.15], [0.91, 0.752, -0.005], oliveFabric, sofa, 2.9);
  olivePillow.rotation.set(-0.26, 0.06, -0.12);

  // Broad oak table with a pair of offset curved supports, kept below the sofa seat line.
  const table = new Group();
  table.name = 'round-oak-coffee-table';
  table.position.set(2.10, 0, -0.30);
  group.add(table);
  const top = addMesh(new CylinderGeometry(0.765, 0.765, 0.055, 96), oak, [0, 0.4125, 0], table);
  top.name = 'solid-oak-tabletop';
  for (const [x, z, radius] of [[-0.31, -0.08, 0.31], [0.30, 0.055, 0.35]]) addMesh(new CylinderGeometry(radius, radius * 1.015, 0.385, 56), oak, [x, 0.1925, z], table);
  const pageMaterial = ownMaterial(new MeshStandardMaterial({ color: '#e7e1d2', roughness: 0.9 }));
  const coverMaterial = ownMaterial(new MeshStandardMaterial({ color: '#37362d', roughness: 0.8 }));
  const creamCover = ownMaterial(new MeshStandardMaterial({ color: '#cec8b7', roughness: 0.83 }));
  const books = new Group();
  books.position.set(-0.14, 0.447, -0.03);
  books.rotation.y = -0.09;
  table.add(books);
  box([0.49, 0.037, 0.31], [0, 0.0185, 0], coverMaterial, books, 0.004);
  box([0.479, 0.026, 0.301], [-0.003, 0.019, 0.006], pageMaterial, books, 0.001);
  const upperBook = new Group();
  upperBook.position.set(-0.025, 0.041, -0.013); upperBook.rotation.y = 0.07; books.add(upperBook);
  box([0.44, 0.025, 0.275], [0, 0.0125, 0], creamCover, upperBook, 0.003);
  box([0.43, 0.017, 0.269], [0.002, 0.0125, 0.005], pageMaterial, upperBook, 0.001);
  const dish = ownMaterial(new MeshPhysicalMaterial({ color: '#33362d', roughness: 0.46, clearcoat: 0.08 }));
  addMesh(new CylinderGeometry(0.105, 0.102, 0.026, 48), dish, [0.02, 0.526, -0.18], table);
  addMesh(new CylinderGeometry(0.086, 0.086, 0.004, 48), soil, [0.02, 0.54, -0.18], table);

  function vase(parent: Group, position: [number, number, number], scale: number, material: Material): void {
    const profile = [[0.058, 0], [0.077, 0.015], [0.096, 0.066], [0.093, 0.118], [0.072, 0.155], [0.039, 0.173], [0.039, 0.190], [0.030, 0.190], [0.030, 0.174], [0.062, 0.15]];
    const mesh = addMesh(new LatheGeometry(profile.map(p => new Vector2(p[0] * scale, p[1] * scale)), 48), material, position, parent);
    mesh.name = 'hand-thrown-ceramic';
  }
  vase(table, [0.40, 0.441, -0.17], 1.08, creamCeramic);

  // All tree stems share one cylinder and one draw call per foliage system.
  type Stem = { start: Vector3; end: Vector3; radius: number };
  type Leaf = { point: Vector3; rotation: Vector3; size: Vector3; tint: Color };
  const outdoorStems: Stem[] = [];
  const outdoorLeaves: Leaf[] = [];
  const leafColors = ['#344722', '#47582c', '#5c6b36', '#66753f', '#40572d', '#78844b'];
  function addBotanical(stems: Stem[], leaves: Leaf[], parent: Group, outside = false): void {
    const stemGeometry = ownGeometry(new CylinderGeometry(0.7, 1, 1, 7));
    const stemMesh = new InstancedMesh(stemGeometry, bark, stems.length);
    const dummy = new Object3D();
    const up = new Vector3(0, 1, 0);
    for (let i = 0; i < stems.length; i++) {
      const stem = stems[i];
      const direction = stem.end.clone().sub(stem.start);
      dummy.position.copy(stem.start).add(stem.end).multiplyScalar(0.5);
      dummy.quaternion.setFromUnitVectors(up, direction.clone().normalize());
      dummy.scale.set(stem.radius, direction.length(), stem.radius);
      dummy.updateMatrix(); stemMesh.setMatrixAt(i, dummy.matrix);
    }
    stemMesh.castShadow = !outside; stemMesh.receiveShadow = true;
    parent.add(stemMesh); instances.add(stemMesh);
    // A cupped lanceolate surface retains a convex highlight with eight triangles,
    // rather than spending eighty triangles on a nearly flat leaf ellipsoid.
    const leafGeometry = ownGeometry(new BufferGeometry());
    const outline = [[0, 1], [-0.50, 0.64], [-0.90, 0.14], [-0.64, -0.58], [0, -1], [0.64, -0.58], [0.90, 0.14], [0.50, 0.64]];
    const leafPositions = [0, 0, 0.17];
    for (const [x, y] of outline) leafPositions.push(x, y, 0.05 * y * y);
    const leafIndices: number[] = [];
    for (let i = 0; i < outline.length; i++) leafIndices.push(0, i + 1, (i + 1) % outline.length + 1);
    leafGeometry.setAttribute('position', new Float32BufferAttribute(leafPositions, 3));
    leafGeometry.setIndex(leafIndices); leafGeometry.computeVertexNormals();
    const leafMaterial = ownMaterial(new MeshStandardMaterial({ color: '#ffffff', roughness: 0.77, side: DoubleSide }));
    const leafMesh = new InstancedMesh(leafGeometry, leafMaterial, leaves.length);
    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i];
      dummy.position.copy(leaf.point);
      dummy.rotation.set(leaf.rotation.x, leaf.rotation.y, leaf.rotation.z);
      dummy.scale.copy(leaf.size); dummy.updateMatrix();
      leafMesh.setMatrixAt(i, dummy.matrix); leafMesh.setColorAt(i, leaf.tint);
    }
    leafMesh.castShadow = !outside; leafMesh.receiveShadow = true;
    parent.add(leafMesh); instances.add(leafMesh);
  }

  function tree(position: Vector3, height: number, crownWidth: number, outside: boolean, branchCount: number): void {
    const stems: Stem[] = [];
    const leaves: Leaf[] = [];
    if (outside) {
      // Asymmetric sprays overlap into a canopy. Branch origins, reach, height,
      // and leaf size vary independently, preventing a ladder or cloned silhouette.
      const trunkTop = position.clone().add(new Vector3((random() - 0.5) * 0.36, height * 0.86, (random() - 0.5) * 0.28));
      const trunkMid = position.clone().lerp(trunkTop, 0.54).add(new Vector3(0.10, 0, -0.045));
      stems.push({start: position, end: trunkMid, radius: 0.038}, {start: trunkMid, end: trunkTop, radius: 0.022});
      const majorBranches = 10 + Math.floor(random() * 4);
      for (let branch = 0; branch < majorBranches; branch++) {
        const fraction = 0.38 + random() * 0.47;
        const angle = random() * Math.PI * 2;
        const reach = crownWidth * (0.26 + random() * 0.27);
        const start = position.clone().lerp(trunkTop, fraction);
        const tip = start.clone().add(new Vector3(Math.cos(angle) * reach, height * (0.09 + random() * 0.16), Math.sin(angle) * reach * 0.72));
        const bend = start.clone().lerp(tip, 0.53).add(new Vector3(0, -0.04, 0));
        stems.push({start, end: bend, radius: 0.009}, {start: bend, end: tip, radius: 0.004});
        for (let spray = 0; spray < 11; spray++) {
          const centre = start.clone().lerp(tip, 0.55 + random() * 0.48).add(new Vector3((random() - 0.5) * crownWidth * 0.27, (random() - 0.5) * height * 0.20, (random() - 0.5) * crownWidth * 0.23));
          const sprayDirection = new Vector3((random() - 0.5) * 0.26, 0.08 + random() * 0.22, (random() - 0.5) * 0.23);
          for (let leaf = 0; leaf < 12; leaf++) {
            const along = (leaf + 0.4) / 12;
            const point = centre.clone().addScaledVector(sprayDirection, along).add(new Vector3((random() - 0.5) * 0.18, (random() - 0.5) * 0.09, (random() - 0.5) * 0.17));
            const scale = 0.065 + random() * 0.036;
            leaves.push({point, rotation: new Vector3(random() * Math.PI, random() * Math.PI * 2, random() * Math.PI), size: new Vector3(scale * (0.46 + random() * 0.22), scale, scale * 0.24), tint: new Color(leafColors[Math.floor(random() * leafColors.length)])});
          }
        }
      }
      outdoorStems.push(...stems); outdoorLeaves.push(...leaves);
      return;
    }
    const trunkBase = position.clone();
    const trunkTop = position.clone().add(new Vector3(0.05, height * 0.9, -0.04));
    const elbow = position.clone().add(new Vector3(-0.035, height * 0.46, 0.025));
    stems.push({start: trunkBase, end: elbow, radius: outside ? 0.065 : 0.018}, {start: elbow, end: trunkTop, radius: outside ? 0.034 : 0.011});
    for (let i = 0; i < branchCount; i++) {
      const fraction = 0.24 + i / branchCount * 0.65;
      const angle = i * 2.39996 + random() * 0.65;
      const reach = crownWidth * (0.25 + random() * 0.29) * (0.63 + Math.sin(fraction * Math.PI) * 0.45);
      const start = trunkBase.clone().lerp(trunkTop, fraction);
      const end = start.clone().add(new Vector3(Math.cos(angle) * reach, height * (0.07 + random() * 0.11), Math.sin(angle) * reach * 0.65));
      stems.push({start, end, radius: outside ? 0.009 + random() * 0.004 : 0.0028 + random() * 0.0015});
      for (let twig = 0; twig < 3; twig++) {
        const twigStart = start.clone().lerp(end, 0.45 + twig * 0.23);
        const twigEnd = twigStart.clone().add(new Vector3((random() - 0.5) * reach * 0.65, height * (0.04 + random() * 0.035), (random() - 0.5) * reach * 0.65));
        stems.push({start: twigStart, end: twigEnd, radius: outside ? 0.004 : 0.0013});
        const leafCount = outside ? 15 : 10;
        for (let leaf = 0; leaf < leafCount; leaf++) {
          const along = (leaf + 0.4) / leafCount;
          const point = twigStart.clone().lerp(twigEnd, along).add(new Vector3((random() - 0.5) * (outside ? 0.18 : 0.065), (random() - 0.5) * 0.06, (random() - 0.5) * (outside ? 0.17 : 0.062)));
          const leafScale = (outside ? 0.082 : 0.028) * (0.72 + random() * 0.55);
          leaves.push({point, rotation: new Vector3(random() * 2, angle + random(), random() * Math.PI), size: new Vector3(leafScale * 0.44, leafScale, leafScale * 0.22), tint: new Color().setHSL(0.19 + random() * 0.065, 0.36, 0.20 + random() * 0.12, SRGBColorSpace)});
        }
      }
    }
    addBotanical(stems, leaves, group, outside);
  }

  // Olive tree beside the window: a tapered stoneware planter and an open, asymmetric crown.
  const potPosition: [number, number, number] = [-0.60, 0, -2.00];
  const potProfile = [[0.12, 0.018], [0.164, 0.034], [0.177, 0.112], [0.175, 0.22], [0.151, 0.32], [0.135, 0.326], [0.132, 0.307], [0.157, 0.216], [0.157, 0.095]];
  addMesh(new LatheGeometry(potProfile.map(p => new Vector2(...p as [number, number])), 56), stoneware, potPosition);
  addMesh(new CylinderGeometry(0.133, 0.133, 0.016, 40), soil, [-0.60, 0.305, -2.00]);
  tree(new Vector3(-0.60, 0.306, -2.00), 1.55, 0.64, false, 25);

  // Small cut branches in the table vase use the same leaf vocabulary as the tree.
  const vaseStems: Stem[] = [];
  const vaseLeaves: Leaf[] = [];
  const vaseOrigin = new Vector3(2.5, 0.60, -0.47);
  for (let i = 0; i < 7; i++) {
    const end = vaseOrigin.clone().add(new Vector3((random() - 0.5) * 0.46, 0.20 + random() * 0.29, (random() - 0.5) * 0.27));
    vaseStems.push({start: vaseOrigin, end, radius: 0.0014});
    for (let j = 0; j < 7; j++) {
      const point = vaseOrigin.clone().lerp(end, 0.30 + j * 0.1);
      point.x += (j % 2 ? -1 : 1) * 0.018;
      vaseLeaves.push({point, rotation: new Vector3(0.5 + random(), random() * 5, random() * 2), size: new Vector3(0.008, 0.021, 0.005), tint: new Color('#536338')});
    }
  }
  addBotanical(vaseStems, vaseLeaves, group);

  // Layered outdoor trees are individual branching crowns, never solid green spheres.
  const sky = ownMaterial(new MeshBasicMaterial({ color: '#e3edf0', side: DoubleSide }));
  addMesh(new PlaneGeometry(24, 12), sky, [1, 3.8, -10], group, false).receiveShadow = false;
  const distantGreen = ownMaterial(new MeshBasicMaterial({ color: '#a9b88c', side: DoubleSide }));
  addMesh(new PlaneGeometry(24, 2.6), distantGreen, [1, -1.72, -9.85], group, false).receiveShadow = false;
  const outdoorTrees = [
    [-2.5, -5.9, 3.15, 2.35], [-0.5, -6.8, 3.55, 2.15], [1.55, -5.55, 2.85, 1.8],
    [3.50, -6.5, 3.70, 2.45], [5.45, -5.9, 3.05, 2.30], [0.65, -8.15, 4.10, 2.6],
  ];
  for (const [x, z, height, width] of outdoorTrees) tree(new Vector3(x, -0.7, z), height, width, true, 24);
  // Low shrubs soften the distant garden boundary without a straight green
  // silhouette. They share the outdoor foliage instance draw and material.
  for (let shrub = 0; shrub < 18; shrub++) {
    const centre = new Vector3(-3.8 + shrub * 0.62, -0.40 + random() * 0.10, -8.70 + random() * 0.40);
    for (let leaf = 0; leaf < 48; leaf++) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random());
      const point = centre.clone().add(new Vector3(Math.cos(angle) * radius * 0.57, random() * 0.63 * (1 - radius * 0.45), Math.sin(angle) * radius * 0.40));
      const size = 0.09 + random() * 0.055;
      outdoorLeaves.push({point, rotation: new Vector3(random() * Math.PI, random() * Math.PI * 2, random() * Math.PI), size: new Vector3(size * 0.62, size, size * 0.22), tint: new Color(leafColors[Math.floor(random() * leafColors.length)])});
    }
  }
  addBotanical(outdoorStems, outdoorLeaves, group, true);

  let disposed = false;
  return {
    group,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const mesh of instances) mesh.dispose();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      group.clear();
    },
  };
}
