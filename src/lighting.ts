import { AmbientLight, DirectionalLight, HemisphereLight, Mesh, PlaneGeometry, PMREMGenerator, Scene, ShadowMaterial, WebGLRenderer, Color } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createStudio(scene: Scene, renderer: WebGLRenderer) {
  scene.background = new Color('#ffffff');
  const environment = new RoomEnvironment();
  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromScene(environment, 0.04);
  scene.environment = target.texture;
  scene.environmentIntensity = 0.6;
  environment.dispose();
  pmrem.dispose();
  const key = new DirectionalLight(0xfff8ef, 2.0);
  key.position.set(-45, 105, 65);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -95;
  key.shadow.camera.right = 95;
  key.shadow.camera.top = 95;
  key.shadow.camera.bottom = -95;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 280;
  key.shadow.normalBias = 0.015;
  key.shadow.bias = -0.00005;
  key.shadow.radius = 5;
  const fill = new DirectionalLight(0xe8eefb, 0.45);
  fill.position.set(30, 25, -85);
  const rim = new DirectionalLight(0xffffff, 0.8);
  rim.position.set(40, 70, -35);
  const bottom = new HemisphereLight(0xffffff, 0xc2c0bc, 0.5);
  const ambient = new AmbientLight(0xffffff, 0.08);
  const undersideKey = new DirectionalLight(0xf4f6ff, 3.0);
  undersideKey.position.set(-35, -55, 85);
  undersideKey.visible = false;
  scene.add(key, fill, rim, bottom, ambient, undersideKey);
  const ground = new Mesh(new PlaneGeometry(800, 800), new ShadowMaterial({ opacity: 0.16, depthWrite: false }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.07;
  ground.receiveShadow = true;
  scene.add(ground);
  return {
    ground,
    undersideKey,
    dispose() {
      scene.environment = null;
      target.dispose();
      ground.geometry.dispose();
      ground.material.dispose();
      key.shadow.dispose();
      scene.remove(key, fill, rim, bottom, ambient, ground, undersideKey);
    },
  };
}
