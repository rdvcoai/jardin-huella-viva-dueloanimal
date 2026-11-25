import * as THREE from 'three';
import { Memorial, PlantType } from '../types/memorial';
import { drawCountryFlagOnCanvas } from '../utils/countryFlag';

export type TimeMode = 'auto' | 'day' | 'night';

interface MemorialObject {
  memorial: Memorial;
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  bookHitMesh?: THREE.Mesh;
  flameMesh: THREE.Mesh;
  flameLight: THREE.PointLight;
  leftDoorPivot: THREE.Group;
  rightDoorPivot: THREE.Group;
  doorOpenProgress: number;
}

export interface SanctuaryCallbacks {
  onSelectMemorial: (memorial: Memorial) => void;
  onSelectBook: (memorial: Memorial) => void;
  onHoverMemorial: (memorial: Memorial | null) => void;
  onHoverBook: (memorial: Memorial | null) => void;
  onHoverPodcast: (hovered: boolean) => void;
  onSelectPodcast: () => void;
  onHoverRainbow: (hovered: boolean) => void;
  onSelectRainbow: () => void;
  onEnterComplete: () => void;
}

export class SanctuaryScene {
  private container: HTMLElement;
  private callbacks: SanctuaryCallbacks;

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock = new THREE.Clock();
  private animFrameId = 0;
  private reducedMotion = false;

  // Time of day (0 = day, 1 = night)
  private timeMode: TimeMode = 'auto';
  private nightFactor = 0;
  private targetNightFactor = 0;

  // Sky, lighting, celestial bodies
  private skyMat!: THREE.ShaderMaterial;
  private rainbowMat!: THREE.ShaderMaterial;
  private rainbowMesh!: THREE.Mesh;
  private rainbowSignMesh!: THREE.Mesh;
  private rainbowHitMesh!: THREE.Mesh;
  private isRainbowHovered = false;
  private starsPoints!: THREE.Points;
  private starsMat!: THREE.PointsMaterial;
  private constellationLines!: THREE.LineSegments;
  private constellationMat!: THREE.LineBasicMaterial;
  private moonMesh!: THREE.Mesh;
  private moonMat!: THREE.MeshBasicMaterial;
  private hemiLight!: THREE.HemisphereLight;
  private dirLight!: THREE.DirectionalLight;
  private fieldLanternLights: { mesh: THREE.Mesh; light: THREE.PointLight; baseY: number }[] = [];

  // Gate animation
  private leftGatePivot = new THREE.Group();
  private rightGatePivot = new THREE.Group();
  private isEntered = false;
  private isEntering = false;
  private enterProgress = 0;

  // Camera navigation state
  private camPos = new THREE.Vector3(0, 1.85, 9.2);
  private targetCamPos = new THREE.Vector3(0, 1.85, 9.2);
  private yaw = 0;
  private pitch = 0.04;
  private targetYaw = 0;
  private targetPitch = 0.04;

  // Pointer & keyboard state
  private isDragging = false;
  private pointerDownPos = { x: 0, y: 0 };
  private lastPointerPos = { x: 0, y: 0 };
  private keysPressed = new Set<string>();
  private raycaster = new THREE.Raycaster();
  private pointerNDC = new THREE.Vector2();

  // Interactive world elements
  private terrainMesh!: THREE.Mesh;
  private pavilionFloorMesh!: THREE.Mesh;
  private grassUniforms = { uTime: { value: 0 }, uNight: { value: 0 } };
  private motesGeometry!: THREE.BufferGeometry;
  private motesMat!: THREE.PointsMaterial;
  private walkRipple!: THREE.Mesh;
  private walkRippleLife = 0;

  private memorialObjects: MemorialObject[] = [];
  private hoveredMemorialId: string | null = null;
  private podcastHitMesh!: THREE.Mesh;
  private isPodcastHovered = false;
  private moonHaloMesh!: THREE.Mesh;
  private moonHaloMat!: THREE.MeshBasicMaterial;
  private fountainDroplets: {
    mesh: THREE.Mesh;
    angle: number;
    phase: number;
    baseX: number;
    baseY: number;
    baseZ: number;
  }[] = [];
  private waterRipples: { mesh: THREE.Mesh; phase: number }[] = [];
  private shootingStars: { line: THREE.Line; vel: THREE.Vector3; life: number; maxLife: number }[] = [];
  private vintageBulbLights: THREE.PointLight[] = [];
  private floatingLanterns: { group: THREE.Group; baseY: number; phase: number }[] = [];
  private dayBirds: { group: THREE.Group; leftWing: THREE.Mesh; rightWing: THREE.Mesh; center: THREE.Vector3; radius: number; speed: number; angle: number }[] = [];
  private whiteButterflies: { group: THREE.Group; leftWing: THREE.Group; rightWing: THREE.Group; center: THREE.Vector3; radiusX: number; radiusZ: number; speed: number; phase: number }[] = [];
  private floatingSpotifyBadge?: THREE.Group;
  private nextShootingStarAt = 300; // 5 minutos (300 segundos) conectado

  constructor(container: HTMLElement, memorials: Memorial[], callbacks: SanctuaryCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    this.nightFactor = this.computeTargetNight();
    this.targetNightFactor = this.nightFactor;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(this.nightFactor > 0.5 ? '#182232' : '#efe2d1', 0.0095);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const aspect = width / Math.max(1, height);
    const isNarrowOrTouch = width < 1024 || 'ontouchstart' in window;
    const initialFov = aspect < 0.85 ? 70 : aspect < 1.15 ? 60 : 52;

    this.camera = new THREE.PerspectiveCamera(initialFov, aspect, 0.1, 340);
    this.camera.position.copy(this.camPos);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isNarrowOrTouch ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.buildSkyAndCelestial();
    this.buildRainbow();
    this.buildLighting();
    this.buildTerrainAndPath();
    this.buildGrassAndWildflowers();
    this.buildFieldNightLights();
    this.buildVineGates();
    this.buildMemorialPavilion();
    this.buildCentralContemplationCircle();
    this.buildWaterFeatures();
    this.buildPodcastBench();
    this.buildMemorialQuotesSigns();
    this.buildFloatingLanterns();
    this.buildDaytimeBirds();
    this.buildWhiteButterflies();
    this.buildSunMotes();
    this.buildWalkRipple();

    this.syncMemorials(memorials);
    this.applyAtmosphere(this.nightFactor);
    this.bindEvents();
    this.animate();
  }

  public setTimeMode(mode: TimeMode): void {
    this.timeMode = mode;
    this.targetNightFactor = this.computeTargetNight();
  }

  public setNavigationKey(
    key: 'arrowup' | 'arrowdown' | 'arrowleft' | 'arrowright',
    active: boolean
  ): void {
    if (active) {
      this.keysPressed.add(key);
    } else {
      this.keysPressed.delete(key);
    }
  }

  public isCurrentlyNight(): boolean {
    return this.targetNightFactor > 0.5;
  }

  private computeTargetNight(): number {
    if (this.timeMode === 'day') return 0;
    if (this.timeMode === 'night') return 1;
    const hour = new Date().getHours();
    return hour >= 18 || hour < 6 ? 1 : 0;
  }

  public enterSanctuary(): void {
    if (this.isEntered || this.isEntering) return;
    if (this.reducedMotion) {
      this.leftGatePivot.rotation.y = -Math.PI * 0.48;
      this.rightGatePivot.rotation.y = Math.PI * 0.48;
      this.camPos.set(0, 1.75, 0.6);
      this.targetCamPos.copy(this.camPos);
      this.isEntered = true;
      this.callbacks.onEnterComplete();
      return;
    }
    this.isEntering = true;
    this.enterProgress = 0;
  }

  public focusMemorial(memorial: Memorial): void {
    if (!this.isEntered) {
      this.isEntered = true;
      this.isEntering = false;
      this.leftGatePivot.rotation.y = -Math.PI * 0.48;
      this.rightGatePivot.rotation.y = Math.PI * 0.48;
    }

    const foundObj = this.memorialObjects.find((m) => m.memorial.id === memorial.id);
    const placed = foundObj ? foundObj.memorial : memorial;
    const pos = new THREE.Vector3(...placed.position);
    const forward = new THREE.Vector3(Math.sin(placed.rotationY), 0, Math.cos(placed.rotationY));
    const viewPos = pos.clone().add(forward.multiplyScalar(3.05));
    viewPos.y = Math.max(0.13, this.getTerrainHeight(viewPos.x, viewPos.z)) + 1.58;

    this.targetCamPos.copy(viewPos);
    if (this.reducedMotion) {
      this.camPos.copy(viewPos);
    }

    const dx = pos.x - viewPos.x;
    const dz = pos.z - viewPos.z;
    this.targetYaw = Math.atan2(-dx, -dz);
    this.targetPitch = -0.08;
  }

  public resetView(): void {
    if (!this.isEntered) return;
    this.targetCamPos.set(0, this.getTerrainHeight(0, 0.6) + 1.75, 0.6);
    this.targetYaw = 0;
    this.targetPitch = 0.02;
  }

  private getAltarPlacement(indexInSanctuary: number): { pos: [number, number, number]; rotY: number } {
    const side = indexInSanctuary % 2 === 0 ? -1 : 1;
    const row = Math.floor(indexInSanctuary / 2); // 0..14 (15 rows * 2 sides = 30 altars)
    const x = side * 3.95;
    const z = -3.6 - row * 2.85;
    const rotY = side === -1 ? Math.PI * 0.36 : -Math.PI * 0.36;
    return { pos: [x, 0.13, z], rotY };
  }

  public syncMemorials(memorials: Memorial[]): void {
    for (const obj of this.memorialObjects) {
      this.scene.remove(obj.group);
    }
    this.memorialObjects = [];

    memorials.slice(0, 30).forEach((m, idx) => {
      const slot = this.getAltarPlacement(idx);
      const placedMemorial: Memorial = {
        ...m,
        position: slot.pos,
        rotationY: slot.rotY,
      };
      const obj = this.createMemorialObject(placedMemorial);
      this.memorialObjects.push(obj);
      this.scene.add(obj.group);
    });
  }

  public dispose(): void {
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);

    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }

  private getTerrainHeight(x: number, z: number): number {
    const distFromPath = Math.abs(x);
    const pathFlatten = THREE.MathUtils.smoothstep(distFromPath, 2.5, 11.5);

    const gentleRoll =
      Math.sin(x * 0.055) * Math.cos(z * 0.05) * 1.4 +
      Math.sin(x * 0.025 + 1.2) * Math.sin(z * 0.03) * 2.0;

    const distantRise = z < -38 ? Math.pow((-38 - z) * 0.045, 1.45) * 2.2 : 0;
    return gentleRoll * pathFlatten + distantRise;
  }

  private buildSkyAndCelestial(): void {
    const skyGeo = new THREE.SphereGeometry(230, 48, 32);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uSunDir: { value: new THREE.Vector3(0.22, 0.22, -0.95).normalize() },
        uNight: { value: this.nightFactor },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        uniform vec3 uSunDir;
        uniform float uNight;
        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = clamp(dir.y, 0.0, 1.0);

          // Day sky (bright, serene blue)
          vec3 dayHorizon = vec3(0.84, 0.92, 0.96);
          vec3 dayMid     = vec3(0.54, 0.78, 0.94);
          vec3 dayZenith  = vec3(0.26, 0.54, 0.86);
          vec3 daySky = mix(dayHorizon, dayMid, smoothstep(0.0, 0.25, h));
          daySky = mix(daySky, dayZenith, smoothstep(0.22, 0.85, h));

          float sunDot = max(dot(dir, uSunDir), 0.0);
          float sunGlow = pow(sunDot, 12.0) * 0.36 + pow(sunDot, 180.0) * 0.85;
          float sunDisc = smoothstep(0.9985, 0.9996, sunDot);
          daySky += vec3(1.0, 0.91, 0.72) * sunGlow;
          daySky += vec3(1.0, 0.97, 0.88) * sunDisc;

          // Brighter, clearer planetarium night sky with soft Milky Way glow
          vec3 nightHorizon = vec3(0.20, 0.30, 0.46);
          vec3 nightMid     = vec3(0.12, 0.21, 0.37);
          vec3 nightZenith  = vec3(0.07, 0.13, 0.26);
          vec3 nightSky = mix(nightHorizon, nightMid, smoothstep(0.0, 0.3, h));
          nightSky = mix(nightSky, nightZenith, smoothstep(0.25, 0.85, h));

          float band = exp(-pow((dir.x * 0.6 + dir.y * 0.55 - 0.32) * 3.4, 2.0));
          nightSky += vec3(0.12, 0.18, 0.28) * band * smoothstep(0.05, 0.35, h);

          vec3 finalSky = mix(daySky, nightSky, uNight);
          gl_FragColor = vec4(finalSky, 1.0);
        }
      `,
    });
    this.scene.add(new THREE.Mesh(skyGeo, this.skyMat));

    // Realistic Textured Moon + soft atmospheric halo for nighttime
    const moonGeo = new THREE.SphereGeometry(6.2, 32, 32);
    const moonTex = this.createMoonTexture();
    this.moonMat = new THREE.MeshBasicMaterial({
      map: moonTex,
      transparent: true,
      opacity: this.nightFactor,
    });
    this.moonMesh = new THREE.Mesh(moonGeo, this.moonMat);
    this.moonMesh.position.set(-28, 42, -135);
    this.scene.add(this.moonMesh);

    const haloGeo = new THREE.RingGeometry(6.4, 12.5, 48);
    this.moonHaloMat = new THREE.MeshBasicMaterial({
      color: '#dce8f7',
      transparent: true,
      opacity: this.nightFactor * 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.moonHaloMesh = new THREE.Mesh(haloGeo, this.moonHaloMat);
    this.moonHaloMesh.position.copy(this.moonMesh.position);
    this.moonHaloMesh.lookAt(0, 2, 0);
    this.scene.add(this.moonHaloMesh);

    // Cozy, rich Starfield
    const starCount = 2800;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(0.08 + Math.random() * 0.92); // full upper hemisphere
      const r = 185 + Math.random() * 18;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starsMat = new THREE.PointsMaterial({
      color: '#fff9ec',
      size: 1.25,
      transparent: true,
      opacity: this.nightFactor * 0.96,
      depthWrite: false,
    });
    this.starsPoints = new THREE.Points(starGeo, this.starsMat);
    this.scene.add(this.starsPoints);

    // Delicate planetarium constellation lines across the night dome
    const constPts: number[] = [];
    const anchors = [
      [0.3, 0.55, -0.78], [0.42, 0.62, -0.66], [0.55, 0.54, -0.63], [0.48, 0.44, -0.75],
      [-0.45, 0.62, -0.64], [-0.32, 0.7, -0.63], [-0.2, 0.64, -0.74], [-0.28, 0.52, -0.8],
      [0.05, 0.72, -0.69], [0.14, 0.78, -0.6], [0.24, 0.73, -0.63],
      [-0.65, 0.46, -0.6], [-0.58, 0.56, -0.59], [-0.48, 0.5, -0.72],
    ];
    for (let i = 0; i < anchors.length - 1; i++) {
      if (i === 3 || i === 7 || i === 10) continue;
      const a = new THREE.Vector3(...anchors[i]).normalize().multiplyScalar(182);
      const b = new THREE.Vector3(...anchors[i + 1]).normalize().multiplyScalar(182);
      constPts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const constGeo = new THREE.BufferGeometry();
    constGeo.setAttribute('position', new THREE.Float32BufferAttribute(constPts, 3));
    this.constellationMat = new THREE.LineBasicMaterial({
      color: '#9ec8f0',
      transparent: true,
      opacity: this.nightFactor * 0.26,
      depthWrite: false,
    });
    this.constellationLines = new THREE.LineSegments(constGeo, this.constellationMat);
    this.scene.add(this.constellationLines);
  }

  private buildRainbow(): void {
    const rainbowGeo = new THREE.RingGeometry(52, 61, 96, 1, 0, Math.PI);
    this.rainbowMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uOpacityScale: { value: 1 - this.nightFactor },
      },
      vertexShader: `
        varying vec2 vPos;
        void main() {
          vPos = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vPos;
        uniform float uOpacityScale;
        void main() {
          float r = length(vPos);
          float t = clamp((r - 52.0) / 9.0, 0.0, 1.0);

          vec3 c0 = vec3(0.76, 0.74, 0.88);
          vec3 c1 = vec3(0.68, 0.82, 0.90);
          vec3 c2 = vec3(0.73, 0.86, 0.76);
          vec3 c3 = vec3(0.95, 0.90, 0.70);
          vec3 c4 = vec3(0.95, 0.80, 0.68);
          vec3 c5 = vec3(0.91, 0.72, 0.72);

          vec3 col = mix(c0, c1, smoothstep(0.0, 0.2, t));
          col = mix(col, c2, smoothstep(0.2, 0.4, t));
          col = mix(col, c3, smoothstep(0.4, 0.6, t));
          col = mix(col, c4, smoothstep(0.6, 0.8, t));
          col = mix(col, c5, smoothstep(0.8, 1.0, t));

          float radialFade = sin(t * 3.14159265);
          float horizonFade = smoothstep(0.0, 16.0, vPos.y);
          float alpha = radialFade * horizonFade * 0.24 * uOpacityScale;

          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    this.rainbowMesh = new THREE.Mesh(rainbowGeo, this.rainbowMat);
    this.rainbowMesh.position.set(-14, -2, -108);
    this.rainbowMesh.rotation.y = 0.14;
    this.scene.add(this.rainbowMesh);

    // Interactive sign on the rainbow: "La leyenda del puente del arcoíris · Clic aquí"
    const signTex = this.createRainbowSignTexture();
    this.rainbowSignMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 5.2),
      new THREE.MeshBasicMaterial({ map: signTex, transparent: true, depthWrite: false })
    );
    this.rainbowSignMesh.position.set(-14, 24, -103);
    this.rainbowSignMesh.rotation.y = 0.14;
    this.rainbowSignMesh.userData = { isRainbow: true };
    this.scene.add(this.rainbowSignMesh);

    // Exact arc hit mesh matching only the rainbow arch itself (never the empty sky)
    this.rainbowHitMesh = new THREE.Mesh(
      new THREE.RingGeometry(36, 48, 48, 1, 0, Math.PI),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    this.rainbowHitMesh.position.set(-14, -2, -107);
    this.rainbowHitMesh.rotation.y = 0.14;
    this.rainbowHitMesh.userData = { isRainbow: true };
    this.scene.add(this.rainbowHitMesh);
  }

  private createRainbowSignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 166;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.beginPath();
    ctx.roundRect(8, 8, 752, 150, 28);
    ctx.fill();

    ctx.strokeStyle = '#06ada2';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Official Spotify icon
    const cx = 68;
    const cy = 83;
    ctx.fillStyle = '#1DB954';
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineCap = 'round';
    [
      { yOff: -8, r: 23, w: 4.6 },
      { yOff: 2, r: 18, w: 4.0 },
      { yOff: 11, r: 13, w: 3.4 },
    ].forEach((wave) => {
      ctx.lineWidth = wave.w;
      ctx.beginPath();
      ctx.arc(cx, cy + 18 + wave.yOff, wave.r, -Math.PI * 0.72, -Math.PI * 0.28);
      ctx.stroke();
    });

    ctx.fillStyle = '#454545';
    ctx.font = '700 32px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('La leyenda del puente del arcoíris', 124, 62);

    ctx.fillStyle = '#06ada2';
    ctx.font = '700 24px sans-serif';
    ctx.fillText('Clic aquí · Escuchar en Spotify ↗', 124, 112);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildLighting(): void {
    this.hemiLight = new THREE.HemisphereLight('#fff8ed', '#687b58', 1.15);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight('#ffe6be', 1.85);
    this.dirLight.position.set(18, 22, -48);
    this.dirLight.castShadow = true;
    const isNarrowOrTouch = window.innerWidth < 1024 || 'ontouchstart' in window;
    this.dirLight.shadow.mapSize.set(isNarrowOrTouch ? 1024 : 2048, isNarrowOrTouch ? 1024 : 2048);
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 120;
    this.dirLight.shadow.camera.left = -32;
    this.dirLight.shadow.camera.right = 32;
    this.dirLight.shadow.camera.top = 32;
    this.dirLight.shadow.camera.bottom = -32;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);
  }

  private applyAtmosphere(night: number): void {
    this.skyMat.uniforms.uNight.value = night;
    this.grassUniforms.uNight.value = night;
    this.rainbowMat.uniforms.uOpacityScale.value = Math.max(0, 1 - night * 1.25);
    if (this.rainbowSignMesh) {
      this.rainbowSignMesh.visible = night < 0.6;
      this.rainbowHitMesh.visible = night < 0.6;
    }
    this.moonMat.opacity = night;
    this.moonMesh.visible = night > 0.02;
    this.moonHaloMat.opacity = night * 0.18;
    this.moonHaloMesh.visible = night > 0.02;
    this.starsMat.opacity = night * 0.96;
    this.starsPoints.visible = night > 0.02;
    this.constellationMat.opacity = night * 0.26;
    this.constellationLines.visible = night > 0.02;

    const dayFog = new THREE.Color('#dceaf2');
    const nightFog = new THREE.Color('#22334d');
    (this.scene.fog as THREE.FogExp2).color.copy(dayFog.lerp(nightFog, night));

    const daySky = new THREE.Color('#fff8ed');
    const nightSky = new THREE.Color('#7ea0cc');
    this.hemiLight.color.copy(daySky.lerp(nightSky, night));
    this.hemiLight.intensity = THREE.MathUtils.lerp(1.15, 0.78, night);

    const sunCol = new THREE.Color('#ffe6be');
    const moonCol = new THREE.Color('#cfe2f7');
    this.dirLight.color.copy(sunCol.lerp(moonCol, night));
    this.dirLight.intensity = THREE.MathUtils.lerp(1.85, 0.95, night);

    this.motesMat.opacity = THREE.MathUtils.lerp(0.65, 0.35, night);

    // Night field lights/candles glow brightly when night falls
    for (const item of this.fieldLanternLights) {
      item.light.intensity = THREE.MathUtils.lerp(0.15, 1.35, night);
      (item.mesh.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.lerp(0.25, 0.95, night);
    }

    // Vintage pendant bulbs inside the pavilion glow warmly (subtle by day, cozy at night)
    for (const bulbLight of this.vintageBulbLights) {
      bulbLight.intensity = THREE.MathUtils.lerp(0.45, 1.45, night);
    }

    // Daytime birds visible during the day, resting at night
    for (const bird of this.dayBirds) {
      bird.group.visible = night < 0.6;
    }
  }

  private buildTerrainAndPath(): void {
    const geo = new THREE.PlaneGeometry(240, 240, 96, 96);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors: number[] = [];
    const colA = new THREE.Color('#4f8442');
    const colB = new THREE.Color('#6ca14d');
    const colPath = new THREE.Color('#d8cab6');

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.getTerrainHeight(x, z);
      pos.setY(i, y);

      const n = (Math.sin(x * 0.12) * Math.cos(z * 0.12) + 1) * 0.5;
      const c = colA.clone().lerp(colB, n);

      const pathCurve = Math.sin(z * 0.08) * 0.9;
      const dPath = Math.abs(x - pathCurve);
      if (z < 10 && z > -35 && dPath < 1.8) {
        c.lerp(colPath, 1 - dPath / 1.8);
      }
      colors.push(c.r, c.g, c.b);
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.0,
    });

    this.terrainMesh = new THREE.Mesh(geo, mat);
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);

    const stoneMat = new THREE.MeshStandardMaterial({ color: '#d9cebe', roughness: 0.9 });
    const stoneGeo = new THREE.CylinderGeometry(0.65, 0.72, 0.08, 9);

    for (let z = 7; z >= -31; z -= 1.65) {
      const curveX = Math.sin(z * 0.08) * 0.9 + (Math.random() - 0.5) * 0.55;
      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.position.set(curveX, this.getTerrainHeight(curveX, z) + 0.02, z);
      stone.scale.set(0.85 + Math.random() * 0.4, 1, 0.7 + Math.random() * 0.35);
      stone.rotation.y = Math.random() * Math.PI;
      stone.receiveShadow = true;
      this.scene.add(stone);
    }
  }

  private buildGrassAndWildflowers(): void {
    const bladeCount = 6500;
    const bladeGeo = new THREE.PlaneGeometry(0.09, 0.52, 1, 3);
    bladeGeo.translate(0, 0.26, 0);

    const grassMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        uTime: this.grassUniforms.uTime,
        uNight: this.grassUniforms.uNight,
      },
      vertexShader: `
        uniform float uTime;
        varying float vH;
        void main() {
          vH = clamp(position.y / 0.52, 0.0, 1.0);
          vec4 worldBase = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          vec3 pos = position;

          float sway = sin(uTime * 1.35 + worldBase.x * 0.25 + worldBase.z * 0.22) * 0.14;
          float gust = cos(uTime * 0.7 + worldBase.x * 0.08) * 0.06;
          pos.x += (sway + gust) * vH * vH;
          pos.z += (sway * 0.5) * vH * vH;

          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        varying float vH;
        uniform float uNight;
        void main() {
          vec3 dayRoot = vec3(0.20, 0.47, 0.18);
          vec3 dayTip  = vec3(0.46, 0.76, 0.30);
          vec3 nightRoot = vec3(0.09, 0.14, 0.13);
          vec3 nightTip  = vec3(0.18, 0.27, 0.23);

          vec3 rootCol = mix(dayRoot, nightRoot, uNight);
          vec3 tipCol  = mix(dayTip, nightTip, uNight);
          vec3 col = mix(rootCol, tipCol, vH);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const grassMesh = new THREE.InstancedMesh(bladeGeo, grassMat, bladeCount);
    const dummy = new THREE.Object3D();
    let placed = 0;

    for (let i = 0; i < bladeCount * 2 && placed < bladeCount; i++) {
      const x = (Math.random() - 0.5) * 68;
      const z = 12 - Math.random() * 68;

      const pathCurve = Math.sin(z * 0.08) * 0.9;
      if (Math.abs(x - pathCurve) < 1.7 && z > -54) continue;
      if (Math.abs(x) < 8.6 && z <= 2.5 && z >= -44.8) continue;

      const y = this.getTerrainHeight(x, z);
      dummy.position.set(x, y, z);
      dummy.rotation.y = Math.random() * Math.PI;
      const s = 0.7 + Math.random() * 0.75;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      grassMesh.setMatrixAt(placed++, dummy.matrix);
    }
    grassMesh.count = placed;
    this.scene.add(grassMesh);

    // Wildflowers
    const flowerGeo = new THREE.SphereGeometry(0.065, 6, 6);
    const whiteMat = new THREE.MeshStandardMaterial({ color: '#fbf6ec', roughness: 0.7 });
    const lavMat = new THREE.MeshStandardMaterial({ color: '#cfc4de', roughness: 0.7 });

    for (let i = 0; i < 200; i++) {
      const x = (Math.random() - 0.5) * 48;
      const z = 8 - Math.random() * 52;
      const pathCurve = Math.sin(z * 0.08) * 0.9;
      if (Math.abs(x - pathCurve) < 2.0) continue;
      if (Math.abs(x) < 8.6 && z <= 2.5 && z >= -25.6) continue;

      const y = this.getTerrainHeight(x, z) + 0.25 + Math.random() * 0.14;
      const f = new THREE.Mesh(flowerGeo, i % 3 === 0 ? lavMat : whiteMat);
      f.position.set(x, y, z);
      this.scene.add(f);
    }

    // White lilies scattered across the green meadow
    for (let i = 0; i < 38; i++) {
      const x = (Math.random() - 0.5) * 42;
      const z = 5 - Math.random() * 44;
      const pathCurve = Math.sin(z * 0.08) * 0.9;
      if (Math.abs(x - pathCurve) < 2.3) continue;
      if (Math.abs(x) < 8.8 && z <= 2.6 && z >= -25.8) continue;

      const y = this.getTerrainHeight(x, z) + 0.14;
      const lily = this.createWhiteLily();
      lily.position.set(x, y, z);
      lily.scale.setScalar(1.15);
      this.scene.add(lily);
    }
  }

  private buildFieldNightLights(): void {
    // Warm meadow lanterns & candles distributed peacefully across the field
    const candleGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.18, 10);
    const candleMat = new THREE.MeshStandardMaterial({ color: '#f2e6cf', roughness: 0.8 });
    const glowGeo = new THREE.SphereGeometry(0.075, 8, 8);

    const coords: [number, number][] = [
      [-2.8, -5], [2.8, -5], [-3.2, -13], [3.2, -13],
      [-3.5, -21], [3.5, -21], [-10, -8], [10, -8],
      [-12, -18], [12, -18], [-9, -27], [9, -27],
      [-16, -13], [16, -13], [0, -35], [-6, -34], [6, -34],
    ];

    coords.forEach(([x, z], idx) => {
      const y = this.getTerrainHeight(x, z);
      const body = new THREE.Mesh(candleGeo, candleMat);
      body.position.set(x, y + 0.09, z);
      this.scene.add(body);

      const glowMat = new THREE.MeshBasicMaterial({
        color: '#ffd485',
        transparent: true,
        opacity: 0.9,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.set(x, y + 0.24, z);
      this.scene.add(glow);

      // Add real point lights to a subset for performance + warm pools of light
      const light = new THREE.PointLight('#ffbf69', 0, 7.5, 2);
      if (idx % 2 === 0) {
        light.position.set(x, y + 0.35, z);
        this.scene.add(light);
      }

      this.fieldLanternLights.push({ mesh: glow, light, baseY: y + 0.24 });
    });
  }

  private buildVineGates(): void {
    const gateZ = 2.0;
    const stoneMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.55,
      emissive: '#ffffff',
      emissiveIntensity: 0.14,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: '#f7f9fa',
      roughness: 0.5,
      emissive: '#ffffff',
      emissiveIntensity: 0.12,
    });
    const ironMat = new THREE.MeshStandardMaterial({ color: '#3b4845', roughness: 0.48, metalness: 0.45 });
    const bronzeMat = new THREE.MeshStandardMaterial({ color: '#b59a62', roughness: 0.38, metalness: 0.65 });
    const woodMat = new THREE.MeshStandardMaterial({ color: '#dcd2c0', roughness: 0.78 });

    // Vintage stone gate pillars with stepped plinths, molded capitals & antique lantern finials
    const plinthGeo = new THREE.BoxGeometry(1.18, 0.34, 1.18);
    const pillarGeo = new THREE.BoxGeometry(0.92, 3.85, 0.92);
    const capGeo = new THREE.BoxGeometry(1.16, 0.24, 1.16);

    [-2.58, 2.58].forEach((px) => {
      const plinth = new THREE.Mesh(plinthGeo, trimMat);
      plinth.position.set(px, 0.17, gateZ);
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      this.scene.add(plinth);

      const pillar = new THREE.Mesh(pillarGeo, stoneMat);
      pillar.position.set(px, 2.1, gateZ);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.scene.add(pillar);

      const cap = new THREE.Mesh(capGeo, trimMat);
      cap.position.set(px, 4.12, gateZ);
      cap.castShadow = true;
      this.scene.add(cap);

      // Vintage wrought-iron lantern finial atop each pillar
      const lanternBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.16, 6), ironMat);
      lanternBase.position.set(px, 4.32, gateZ);
      this.scene.add(lanternBase);

      const lanternGlass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.12, 0.28, 6),
        new THREE.MeshBasicMaterial({ color: '#ffefc8', transparent: true, opacity: 0.42 })
      );
      lanternGlass.position.set(px, 4.52, gateZ);
      this.scene.add(lanternGlass);

      const pillarCandle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.036, 0.12, 10),
        new THREE.MeshStandardMaterial({ color: '#fbf5ea', roughness: 0.7 })
      );
      pillarCandle.position.set(px, 4.44, gateZ);
      this.scene.add(pillarCandle);

      const pillarFlame = new THREE.Mesh(
        new THREE.SphereGeometry(0.026, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#ffe07d' })
      );
      pillarFlame.position.set(px, 4.53, gateZ);
      pillarFlame.scale.set(0.85, 1.45, 0.85);
      this.scene.add(pillarFlame);

      const pillarGlow = new THREE.PointLight('#ffdca0', 0.6, 5.0, 1.8);
      pillarGlow.position.set(px, 4.55, gateZ);
      this.scene.add(pillarGlow);

      const lanternRoof = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.18, 6), ironMat);
      lanternRoof.position.set(px, 4.74, gateZ);
      this.scene.add(lanternRoof);

      // Dense climbing vines + encrusted lilies and orchids covering the pillars
      this.addClimbingVinesToGroup(this.scene, new THREE.Vector3(px, 0.15, gateZ), 3.9, 0.54);
    });

    // Shining crystal-glass flanking entrance walls with luminous trim & delicate vines
    const crystalWallMat = new THREE.MeshPhysicalMaterial({
      color: '#e8fbfd',
      transparent: true,
      opacity: 0.28,
      roughness: 0.03,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      reflectivity: 1.0,
      ior: 1.52,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const crystalTrimMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.25,
      metalness: 0.15,
      emissive: '#bdeef0',
      emissiveIntensity: 0.18,
    });
    const sparkleMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.9,
    });

    [-5.45, 5.45].forEach((wx) => {
      // Base white marble plinth
      const wallPlinth = new THREE.Mesh(new THREE.BoxGeometry(4.92, 0.28, 0.32), crystalTrimMat);
      wallPlinth.position.set(wx, 0.14, gateZ);
      wallPlinth.receiveShadow = true;
      this.scene.add(wallPlinth);

      // Crystal glass wall panel
      const crystalWall = new THREE.Mesh(new THREE.BoxGeometry(4.82, 3.1, 0.12), crystalWallMat);
      crystalWall.position.set(wx, 1.82, gateZ);
      this.scene.add(crystalWall);

      // Gleaming top & side crystal mullions
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(4.94, 0.12, 0.22), crystalTrimMat);
      topRail.position.set(wx, 3.42, gateZ);
      this.scene.add(topRail);

      [-2.38, -0.8, 0.8, 2.38].forEach((mx) => {
        const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.16, 0.16), crystalTrimMat);
        mullion.position.set(wx + mx, 1.82, gateZ);
        this.scene.add(mullion);
      });

      // Subtle crystal facets/sparkles catching the light
      for (let sp = 0; sp < 10; sp++) {
        const facet = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), sparkleMat);
        facet.position.set(
          wx + (sp - 4.5) * 0.48,
          0.75 + ((sp * 7) % 5) * 0.52,
          gateZ + (sp % 2 === 0 ? 0.08 : -0.08)
        );
        this.scene.add(facet);
      }

      // Delicate framing vines, lilies & orchids along the crystal wall edges
      this.addWallVines(wx, gateZ, 4.65, 3.05);
    });

    // Double vintage wrought-iron overhead arch with bronze scrollwork medallions
    const archCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.58, 4.05, gateZ),
      new THREE.Vector3(-1.35, 4.95, gateZ),
      new THREE.Vector3(0, 5.28, gateZ),
      new THREE.Vector3(1.35, 4.95, gateZ),
      new THREE.Vector3(2.58, 4.05, gateZ),
    ]);
    const archMesh = new THREE.Mesh(new THREE.TubeGeometry(archCurve, 32, 0.075, 8, false), ironMat);
    archMesh.castShadow = true;
    this.scene.add(archMesh);

    const innerArchCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.45, 3.85, gateZ),
      new THREE.Vector3(-1.25, 4.65, gateZ),
      new THREE.Vector3(0, 4.95, gateZ),
      new THREE.Vector3(1.25, 4.65, gateZ),
      new THREE.Vector3(2.45, 3.85, gateZ),
    ]);
    const innerArchMesh = new THREE.Mesh(new THREE.TubeGeometry(innerArchCurve, 28, 0.04, 8, false), bronzeMat);
    this.scene.add(innerArchMesh);

    for (let s = 1; s <= 7; s++) {
      const t = s / 8;
      const p1 = archCurve.getPoint(t);
      const p2 = innerArchCurve.getPoint(t);
      const mid = p1.clone().lerp(p2, 0.5);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 6, 14), bronzeMat);
      ring.position.copy(mid);
      this.scene.add(ring);
    }

    this.addArchVines(archCurve);

    this.leftGatePivot.position.set(-2.12, 0, gateZ);
    this.rightGatePivot.position.set(2.12, 0, gateZ);

    this.buildSingleGateLeaf(this.leftGatePivot, 1, ironMat, woodMat);
    this.buildSingleGateLeaf(this.rightGatePivot, -1, ironMat, woodMat);

    this.scene.add(this.leftGatePivot);
    this.scene.add(this.rightGatePivot);

    this.buildEntranceFloorLanterns(gateZ);
  }

  private buildEntranceFloorLanterns(gateZ: number): void {
    const placements: Array<{ x: number; z: number; scale: number; withLight: boolean }> = [
      { x: -1.95, z: gateZ + 1.55, scale: 1.05, withLight: true },
      { x: 1.95, z: gateZ + 1.55, scale: 1.05, withLight: true },
      { x: -2.85, z: gateZ + 0.72, scale: 0.88, withLight: true },
      { x: 2.85, z: gateZ + 0.72, scale: 0.88, withLight: true },
      { x: -1.95, z: gateZ - 0.75, scale: 0.92, withLight: true },
      { x: 1.95, z: gateZ - 0.75, scale: 0.92, withLight: true },
    ];

    placements.forEach(({ x, z, scale, withLight }) => {
      const lantern = this.createFloorLantern(scale, withLight);
      const baseY = z <= gateZ ? 0.13 : Math.max(0.02, this.getTerrainHeight(x, z));
      lantern.position.set(x, baseY, z);
      lantern.rotation.y = x < 0 ? 0.28 : -0.28;
      this.scene.add(lantern);
    });
  }

  private createFloorLantern(scale = 1, withLight = false): THREE.Group {
    const group = new THREE.Group();
    const ironMat = new THREE.MeshStandardMaterial({ color: '#3b4845', roughness: 0.45, metalness: 0.45 });
    const bronzeMat = new THREE.MeshStandardMaterial({ color: '#b59a62', roughness: 0.35, metalness: 0.65 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#ebe4d8', roughness: 0.82 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: '#fffaf0',
      emissive: '#ffd58a',
      emissiveIntensity: 0.22,
      transparent: true,
      opacity: 0.28,
      roughness: 0.06,
      clearcoat: 1.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const candleMat = new THREE.MeshStandardMaterial({ color: '#fbf5ea', roughness: 0.72 });
    const flameMat = new THREE.MeshBasicMaterial({ color: '#ffdf7e' });
    const haloMat = new THREE.MeshBasicMaterial({
      color: '#ffd984',
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });

    // Small stone plinth
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.42), stoneMat);
    plinth.position.y = 0.04;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);

    // Lantern base frame
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.32), ironMat);
    base.position.y = 0.11;
    group.add(base);

    // 4 corner posts
    [
      [-0.13, -0.13],
      [0.13, -0.13],
      [-0.13, 0.13],
      [0.13, 0.13],
    ].forEach(([cx, cz]) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.46, 0.025), ironMat);
      post.position.set(cx, 0.37, cz);
      post.castShadow = true;
      group.add(post);
    });

    // Warm frosted glass body
    const glassBox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.44, 0.24), glassMat);
    glassBox.position.y = 0.37;
    group.add(glassBox);

    // Candle + glowing flame + soft warm halo inside
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.054, 0.22, 12), candleMat);
    candle.position.y = 0.25;
    group.add(candle);

    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 10), flameMat);
    flame.position.y = 0.39;
    flame.scale.set(0.85, 1.5, 0.85);
    group.add(flame);

    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), haloMat);
    halo.position.y = 0.39;
    group.add(halo);

    // Stepped vintage roof + bronze finial ring
    const roofRim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.34), ironMat);
    roofRim.position.y = 0.61;
    group.add(roofRim);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.19, 4), ironMat);
    roof.position.y = 0.725;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);

    const finial = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.01, 6, 12), bronzeMat);
    finial.position.y = 0.85;
    group.add(finial);

    if (withLight) {
      const glow = new THREE.PointLight('#ffdca0', 0.9, 6.5, 1.8);
      glow.position.set(0, 0.42, 0);
      group.add(glow);
    }

    group.scale.setScalar(scale);
    return group;
  }

  private buildMemorialQuotesSigns(): void {
    const quotes = [
      'No dejaron solo huellas en el piso; sembraron un hogar entero en el corazón.',
      'El amor que compartimos no termina; solo cambia de lugar para vivir en nosotros.',
      'Cada paseo, cada mirada y cada siesta juntos sigue latiendo en este jardín.',
      'Quien nos enseñó a amar sin condiciones nunca se va del todo.',
      'Tu recuerdo es una luz serena que nos acompaña en cada paso.',
      'Gracias por tantos años de compañía fiel, alegría y ternura.',
      'En cada brisa suave y en cada flor sembrada seguimos honrando tu vida.',
      'El vínculo verdadero permanece intacto más allá del tiempo.',
    ];

    const ironMat = new THREE.MeshStandardMaterial({
      color: '#e6c36a',
      emissive: '#8f6b1e',
      emissiveIntensity: 0.18,
      roughness: 0.22,
      metalness: 0.85,
    });
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: '#f2d98d',
      emissive: '#9c7826',
      emissiveIntensity: 0.16,
      roughness: 0.2,
      metalness: 0.88,
    });

    const pastelThemes = [
      { bg: '#f2eafb', border: '#c7a8ec', accent: '#9f75d6' }, // lila pastel
      { bg: '#e5f8f5', border: '#7bd8d2', accent: '#06ada2' }, // verde menta
      { bg: '#fdeef3', border: '#f0b6ca', accent: '#d97c9b' }, // rosa pastel
      { bg: '#eceefa', border: '#b4bee8', accent: '#7a89cc' }, // lavanda suave
      { bg: '#fdf2eb', border: '#f0c7ad', accent: '#d48d68' }, // durazno pastel
      { bg: '#e8f6ef', border: '#98d9b8', accent: '#4da379' }, // menta suave
      { bg: '#f9ebf0', border: '#e3b0c4', accent: '#c27091' }, // rosa empolvado
      { bg: '#f4eef9', border: '#cfb5e8', accent: '#9a74c9' }, // lila perla
    ];

    const zRows = [-4.2, -9.0, -13.8, -18.6];

    quotes.forEach((quote, idx) => {
      const side = idx % 2 === 0 ? -1 : 1;
      const row = Math.floor(idx / 2);
      const sx = side * 2.25;
      const sz = zRows[row % zRows.length];
      const ceilingY = 4.55;
      const barY = 3.45;
      const plaqueY = 2.66;
      const isOval = idx % 2 === 0;

      const signGroup = new THREE.Group();
      signGroup.position.set(sx, 0, sz);
      signGroup.rotation.y = side * -0.34;

      // Vertical ceiling support rods up to the pavilion roof
      [-0.55, 0.55].forEach((rx) => {
        const rodH = ceilingY - barY;
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, rodH, 6), ironMat);
        rod.position.set(rx, barY + rodH / 2, 0);
        signGroup.add(rod);
      });

      // Vintage horizontal wrought-iron bar with spear finial on the inner tip
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.56, 8), ironMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, barY, 0);
      signGroup.add(bar);

      const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.048, 0.14, 4), ironMat);
      spearTip.rotation.z = side === -1 ? -Math.PI / 2 : Math.PI / 2;
      spearTip.position.set(side === -1 ? 0.82 : -0.82, barY, 0);
      signGroup.add(spearTip);

      // Ornate vintage scrollwork curls on the bar
      [-0.36, 0.36].forEach((cx) => {
        const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.01, 6, 14, Math.PI * 1.35), bronzeMat);
        scroll.position.set(cx, barY - 0.08, 0);
        scroll.rotation.z = cx < 0 ? 0.4 : Math.PI - 0.4;
        signGroup.add(scroll);
      });

      // Delicate chain links suspending the vintage plaque
      const chainX = isOval ? [-0.34, 0.34] : [-0.46, 0.46];
      const chainTop = barY;
      const chainBottom = plaqueY + 0.32;
      const linksCount = 7;
      chainX.forEach((cx) => {
        for (let l = 0; l < linksCount; l++) {
          const ly = THREE.MathUtils.lerp(chainBottom, chainTop, (l + 0.5) / linksCount);
          const link = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0055, 6, 10), ironMat);
          link.position.set(cx, ly, 0);
          link.rotation.y = l % 2 === 0 ? 0 : Math.PI / 2;
          signGroup.add(link);
        }
      });

      // Decorative crest scroll above the plaque
      const crest = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 16, Math.PI), ironMat);
      crest.position.set(0, plaqueY + 0.33, 0);
      signGroup.add(crest);

      const theme = pastelThemes[idx % pastelThemes.length];
      const tex = this.createQuoteSignTexture(quote, theme, isOval ? 'oval' : 'baroque');
      const faceMat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.15,
        side: THREE.DoubleSide,
      });

      const plaquePlane = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.78), faceMat);
      plaquePlane.position.set(0, plaqueY, 0);
      signGroup.add(plaquePlane);

      this.scene.add(signGroup);
    });
  }

  private createQuoteSignTexture(
    quote: string,
    theme: { bg: string; border: string; accent: string },
    shape: 'oval' | 'baroque' = 'oval'
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 704;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const traceShape = (inset = 0) => {
      ctx.beginPath();
      if (shape === 'oval') {
        ctx.ellipse(cx, cy, 590 - inset, 304 - inset, 0, 0, Math.PI * 2);
      } else {
        const rx = 572 - inset;
        const ry = 284 - inset;
        ctx.moveTo(cx, cy - ry - 28);
        ctx.bezierCurveTo(cx + 170, cy - ry - 28, cx + 220, cy - ry + 36, cx + rx - 56, cy - ry + 36);
        ctx.quadraticCurveTo(cx + rx + 24, cy - ry + 36, cx + rx, cy - 76);
        ctx.quadraticCurveTo(cx + rx + 36, cy, cx + rx, cy + 76);
        ctx.quadraticCurveTo(cx + rx + 24, cy + ry - 36, cx + rx - 56, cy + ry - 36);
        ctx.bezierCurveTo(cx + 220, cy + ry - 36, cx + 170, cy + ry + 28, cx, cy + ry + 28);
        ctx.bezierCurveTo(cx - 170, cy + ry + 28, cx - 220, cy + ry - 36, cx - rx + 56, cy + ry - 36);
        ctx.quadraticCurveTo(cx - rx - 24, cy + ry - 36, cx - rx, cy + 76);
        ctx.quadraticCurveTo(cx - rx - 36, cy, cx - rx, cy - 76);
        ctx.quadraticCurveTo(cx - rx - 24, cy - ry + 36, cx - rx + 56, cy - ry + 36);
        ctx.bezierCurveTo(cx - 220, cy - ry + 36, cx - 170, cy - ry - 28, cx, cy - ry - 28);
        ctx.closePath();
      }
    };

    traceShape(0);
    ctx.fillStyle = theme.bg;
    ctx.fill();

    // Outer bright shining gold border
    const goldGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    goldGrad.addColorStop(0, '#f7e296');
    goldGrad.addColorStop(0.28, '#d4af37');
    goldGrad.addColorStop(0.55, '#fae7a5');
    goldGrad.addColorStop(0.8, '#c59b27');
    goldGrad.addColorStop(1, '#f7e296');
    ctx.lineWidth = 16;
    ctx.strokeStyle = goldGrad;
    ctx.stroke();

    // Inner pastel filigree border
    traceShape(24);
    ctx.lineWidth = 6;
    ctx.strokeStyle = theme.border;
    ctx.stroke();

    // Crisp paw emblem at top center
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.arc(cx, 128, 15, 0, Math.PI * 2);
    ctx.fill();
    [
      [cx - 28, 102],
      [cx - 10, 90],
      [cx + 10, 90],
      [cx + 28, 102],
    ].forEach(([px, py]) => {
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = '#2d2622';
    ctx.font = 'italic 600 44px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Word-wrap quote cleanly into centered lines
    const words = quote.split(' ');
    const lines: string[] = [];
    let current = '';
    words.forEach((word) => {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > 880) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    });
    if (current) lines.push(current);

    const lineHeight = 62;
    const startY = cy + 22 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, cx, startY + i * lineHeight);
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  private buildMemorialPavilion(): void {
    // Sober, pristine, luminous white-and-crystal-glass Memorial Sanctuary Hall
    // Opens directly onto the sunlit green fields at z = -25
    const travertineMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.65 });
    const runnerMat = new THREE.MeshStandardMaterial({ color: '#f0f7f7', roughness: 0.72 });
    const columnMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.5,
      emissive: '#ffffff',
      emissiveIntensity: 0.16,
    });
    const oakMat = new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: 0.72 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: '#eaf9fc',
      transparent: true,
      opacity: 0.22,
      roughness: 0.03,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      reflectivity: 1.0,
      ior: 1.52,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mullionMat = new THREE.MeshStandardMaterial({ color: '#b7dedc', roughness: 0.4, metalness: 0.25 });

    // Main floor slab (z = 2 to z = -44, width = 16.4, length = 46.2)
    const floorGeo = new THREE.BoxGeometry(16.4, 0.22, 46.2);
    this.pavilionFloorMesh = new THREE.Mesh(floorGeo, travertineMat);
    this.pavilionFloorMesh.position.set(0, 0.02, -21.0);
    this.pavilionFloorMesh.receiveShadow = true;
    this.scene.add(this.pavilionFloorMesh);

    // Subtle central gallery walkway
    const runner = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.02, 46.0), runnerMat);
    runner.position.set(0, 0.14, -21.0);
    runner.receiveShadow = true;
    this.scene.add(runner);

    // Front facade glass walls flanking the entrance gates (x = ±2.9 to ±8.1, z = 2.0)
    [-5.5, 5.5].forEach((fx) => {
      const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 4.1), glassMat);
      frontGlass.position.set(fx, 2.2, 2.0);
      this.scene.add(frontGlass);

      const topBeam = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.25, 0.35), columnMat);
      topBeam.position.set(fx, 4.35, 2.0);
      this.scene.add(topBeam);
    });

    // Side colonnade columns & tall glass windows (framing the green fields outside)
    const zCols = [2.0, -5.6, -13.2, -20.8, -28.4, -36.0, -44.0];
    zCols.forEach((cz, idx) => {
      [-8.0, 8.0].forEach((cx) => {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.45, 4.5, 0.45), columnMat);
        col.position.set(cx, 2.35, cz);
        col.castShadow = true;
        col.receiveShadow = true;
        this.scene.add(col);

        // Glass window span to next column
        if (idx < zCols.length - 1) {
          const nextZ = zCols[idx + 1];
          const midZ = (cz + nextZ) / 2;
          const spanLen = Math.abs(cz - nextZ) - 0.45;

          const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(spanLen, 4.05), glassMat);
          sideGlass.rotation.y = Math.PI / 2;
          sideGlass.position.set(cx, 2.2, midZ);
          this.scene.add(sideGlass);

          // Delicate bronze mullion
          const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.06, 4.1, 0.06), mullionMat);
          mullion.position.set(cx, 2.2, midZ);
          this.scene.add(mullion);
        }
      });

      // Overhead warm oak roof beam with open center skylight
      [-5.6, 5.6].forEach((bx) => {
        const sideRoof = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.22, 0.32), oakMat);
        sideRoof.position.set(bx, 4.55, cz);
        sideRoof.castShadow = true;
        this.scene.add(sideRoof);
      });

      // Soft warm gallery lighting inside the pavilion
      if (idx % 2 === 1) {
        const coveLight = new THREE.PointLight('#fff0d4', 0.55, 14, 2);
        coveLight.position.set(0, 4.1, cz);
        this.scene.add(coveLight);
      }
    });

    // Side roof overhangs (leaving central skylight open to the blue sky / stars)
    [-5.6, 5.6].forEach((rx) => {
      const roofGlass = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 46.2), glassMat);
      roofGlass.rotation.x = Math.PI / 2;
      roofGlass.position.set(rx, 4.68, -21.0);
      this.scene.add(roofGlass);

      const eaves = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.24, 46.4), columnMat);
      eaves.position.set(rx > 0 ? 8.0 : -8.0, 4.62, -21.0);
      this.scene.add(eaves);
    });

    // Wide stone garden steps at the rear terrace (z = -44.4) leading out to the meadow
    const step = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.12, 0.9), columnMat);
    step.position.set(0, -0.02, -44.4);
    step.receiveShadow = true;
    this.scene.add(step);

    // Small tranquil lotus pond inside the white-and-crystal pavilion (x = 0, z = -15.2)
    const pondGroup = new THREE.Group();
    pondGroup.position.set(0, 0.14, -15.2);

    const pondRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.11, 12, 36),
      columnMat
    );
    pondRim.rotation.x = Math.PI / 2;
    pondRim.position.y = 0.07;
    pondRim.receiveShadow = true;
    pondGroup.add(pondRim);

    const pondWater = new THREE.Mesh(
      new THREE.CircleGeometry(1.42, 36),
      new THREE.MeshStandardMaterial({
        color: '#64caca',
        roughness: 0.08,
        metalness: 0.32,
      })
    );
    pondWater.rotation.x = -Math.PI / 2;
    pondWater.position.y = 0.06;
    pondGroup.add(pondWater);

    const padMat = new THREE.MeshStandardMaterial({ color: '#4d8c52', roughness: 0.7 });
    const lotusCoords: [number, number, string][] = [
      [-0.55, -0.35, '#f6c8d3'],
      [0.48, -0.25, '#ffffff'],
      [-0.15, 0.52, '#f9dce3'],
      [0.58, 0.45, '#d5f2f0'],
      [-0.65, 0.3, '#ffffff'],
    ];
    lotusCoords.forEach(([lx, lz, petalCol]) => {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.015, 16), padMat);
      pad.position.set(lx, 0.075, lz);
      pondGroup.add(pad);

      const lotus = this.createWhiteLily(petalCol);
      lotus.position.set(lx, 0.09, lz);
      lotus.scale.setScalar(1.15);
      pondGroup.add(lotus);
    });
    this.scene.add(pondGroup);

    // Hanging vintage Edison-style pendant bulbs (bombillos vintage) along the pavilion
    const cordMat = new THREE.MeshStandardMaterial({ color: '#3b322b', roughness: 0.7 });
    const brassMat = new THREE.MeshStandardMaterial({ color: '#b89456', roughness: 0.35, metalness: 0.65 });
    const bulbGlassMat = new THREE.MeshBasicMaterial({
      color: '#ffd98e',
      transparent: true,
      opacity: 0.9,
    });
    const filamentMat = new THREE.MeshBasicMaterial({ color: '#fff4cc' });

    const bulbZPositions = [-1.4, -8.2, -15.0, -21.8];
    bulbZPositions.forEach((bz, bIdx) => {
      [-4.2, 4.2].forEach((bx, sideIdx) => {
        const dropLen = (bIdx + sideIdx) % 2 === 0 ? 0.85 : 1.08;
        const bulbY = 4.55 - dropLen;

        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, dropLen, 6), cordMat);
        cord.position.set(bx, 4.55 - dropLen / 2, bz);
        this.scene.add(cord);

        const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.09, 10), brassMat);
        socket.position.set(bx, bulbY, bz);
        this.scene.add(socket);

        const glass = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 14), bulbGlassMat);
        glass.scale.set(1, 1.35, 1);
        glass.position.set(bx, bulbY - 0.14, bz);
        this.scene.add(glass);

        const filament = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 6, 12), filamentMat);
        filament.position.set(bx, bulbY - 0.13, bz);
        this.scene.add(filament);

        if (bIdx % 2 === 0 || sideIdx === 0) {
          const pLight = new THREE.PointLight('#ffcc78', 0.65, 10.5, 2);
          pLight.position.set(bx, bulbY - 0.22, bz);
          this.scene.add(pLight);
          this.vintageBulbLights.push(pLight);
        }
      });
    });
  }

  private createGlassDoorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Luminous crystal glass tint
    const grad = ctx.createLinearGradient(0, 0, 256, 512);
    grad.addColorStop(0, 'rgba(235, 248, 252, 0.34)');
    grad.addColorStop(0.5, 'rgba(255, 252, 244, 0.24)');
    grad.addColorStop(1, 'rgba(225, 244, 246, 0.34)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 512);

    // Subtle frosted inner border
    ctx.strokeStyle = 'rgba(212, 182, 118, 0.55)';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 236, 492);

    // Etched golden-white pawprints (huellitas) trailing gently across the glass
    const paws: { x: number; y: number; rot: number; scale: number }[] = [
      { x: 75, y: 390, rot: -0.25, scale: 1.0 },
      { x: 145, y: 330, rot: 0.2, scale: 0.92 },
      { x: 90, y: 260, rot: -0.18, scale: 1.05 },
      { x: 162, y: 195, rot: 0.28, scale: 0.9 },
      { x: 108, y: 128, rot: -0.12, scale: 0.95 },
    ];

    paws.forEach(({ x, y, rot, scale }) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(scale, scale);

      ctx.fillStyle = 'rgba(232, 198, 130, 0.62)';
      ctx.beginPath();
      ctx.ellipse(0, 4, 11, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      [
        [-11, -9],
        [-4, -14],
        [4, -14],
        [11, -9],
      ].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.arc(dx, dy, 4.2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildSingleGateLeaf(
    pivot: THREE.Group,
    dir: 1 | -1,
    ironMat: THREE.Material,
    woodMat: THREE.Material
  ): void {
    const width = 2.08;
    const height = 3.1;

    // Slim, elegant perimeter frame (bottom, top, hinge stile, meeting stile)
    const bottomRail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.14, 0.08), woodMat);
    bottomRail.position.set(dir * (width / 2), 0.12, 0);
    bottomRail.castShadow = true;
    pivot.add(bottomRail);

    const topRail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, 0.08), ironMat);
    topRail.position.set(dir * (width / 2), height, 0);
    pivot.add(topRail);

    [0.04, width - 0.04].forEach((sx) => {
      const stile = new THREE.Mesh(new THREE.BoxGeometry(0.08, height, 0.08), ironMat);
      stile.position.set(dir * sx, height / 2 + 0.05, 0);
      stile.castShadow = true;
      pivot.add(stile);
    });

    // Beautiful crystal glass door pane with etched pawprints
    const glassTex = this.createGlassDoorTexture();
    const glassMat = new THREE.MeshBasicMaterial({
      map: glassTex,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.16, height - 0.22), glassMat);
    glassPane.position.set(dir * (width / 2), height / 2 + 0.06, 0);
    pivot.add(glassPane);

    // Elegant warm brass door handle near the center meeting edge
    const handleMat = new THREE.MeshStandardMaterial({ color: '#cfa862', roughness: 0.35, metalness: 0.7 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 10), handleMat);
    handle.position.set(dir * (width - 0.18), 1.35, 0.06);
    pivot.add(handle);

    // Vintage wrought-iron vertical pickets & ornamental rings across the door
    for (let b = 1; b <= 3; b++) {
      const bx = dir * (width * (b / 4));
      const picket = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, height - 0.2, 6), ironMat);
      picket.position.set(bx, height / 2 + 0.05, 0);
      pivot.add(picket);
    }

    const vineMat = new THREE.MeshStandardMaterial({ color: '#38642d', roughness: 0.85 });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#4c843c', roughness: 0.72, side: THREE.DoubleSide });

    // Lush framing vines + encrusted lilies and orchids
    const lilyColors = ['#ffffff', '#f9edf3', '#e7f7f6', '#fdf6e9'];
    const orchidPalette: [string, string][] = [
      ['#e5ccf7', '#8c4fa8'],
      ['#ffffff', '#d87fa3'],
      ['#fadbe6', '#b84b78'],
      ['#c9f0ed', '#06ada2'],
    ];

    for (let v = 0; v < 5; v++) {
      const pts: THREE.Vector3[] = [];
      const startX = dir * (0.1 + v * 0.17);
      for (let s = 0; s <= 7; s++) {
        const t = s / 7;
        pts.push(
          new THREE.Vector3(
            startX + Math.sin(t * 5 + v) * 0.18 * dir,
            0.18 + t * 2.88,
            Math.cos(t * 6 + v) * 0.06
          )
        );
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      pivot.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.022, 5, false), vineMat));

      const leafGeo = new THREE.PlaneGeometry(0.24, 0.16);
      for (let l = 0; l < 28; l++) {
        const pt = curve.getPoint(l / 27);
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.copy(pt).add(new THREE.Vector3((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.12));
        leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        pivot.add(leaf);

        if (l % 5 === 1) {
          const flower = this.createWhiteLily(lilyColors[(v + l) % lilyColors.length]);
          flower.position.copy(pt).add(new THREE.Vector3(0, 0.03, 0.07));
          flower.rotation.x = Math.PI / 2 - 0.25;
          pivot.add(flower);
        } else if (l % 5 === 3) {
          const [petalCol, lipCol] = orchidPalette[(v + l) % orchidPalette.length];
          const orchid = this.createOrchid(petalCol, lipCol);
          orchid.position.copy(pt).add(new THREE.Vector3(0, 0.02, 0.08));
          orchid.rotation.x = Math.PI / 2 - 0.2;
          pivot.add(orchid);
        }
      }
    }
  }

  private createOrchid(petalColor = '#e5ccf7', lipColor = '#8c4fa8'): THREE.Group {
    const orchid = new THREE.Group();
    const petalMat = new THREE.MeshStandardMaterial({
      color: petalColor,
      roughness: 0.42,
      side: THREE.DoubleSide,
    });
    const lipMat = new THREE.MeshStandardMaterial({
      color: lipColor,
      roughness: 0.45,
      side: THREE.DoubleSide,
    });

    // 5 rounded orchid petals (top dorsal, 2 lateral wings, 2 lower sepals)
    const wingGeo = new THREE.CircleGeometry(0.052, 8);
    const angles = [0, 1.15, -1.15, 2.45, -2.45];
    angles.forEach((a, idx) => {
      const petal = new THREE.Mesh(wingGeo, petalMat);
      const dist = idx === 0 ? 0.055 : 0.05;
      petal.position.set(Math.sin(a) * dist, 0.015, Math.cos(a) * dist);
      petal.rotation.x = -Math.PI / 2 + 0.18;
      petal.scale.set(idx === 1 || idx === 2 ? 1.2 : 0.9, 1.1, 1);
      orchid.add(petal);
    });

    // Contrasting ruffled labellum (lip) in the center
    const lip = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), lipMat);
    lip.position.set(0, 0.026, -0.012);
    lip.scale.set(1.2, 0.85, 1.1);
    orchid.add(lip);

    return orchid;
  }

  private addWallVines(centerX: number, wallZ: number, wallWidth: number, wallHeight: number): void {
    const vineMat = new THREE.MeshStandardMaterial({ color: '#38642d', roughness: 0.85 });
    const leafMats = [
      new THREE.MeshStandardMaterial({ color: '#3f6e33', roughness: 0.74, side: THREE.DoubleSide }),
      new THREE.MeshStandardMaterial({ color: '#538a42', roughness: 0.7, side: THREE.DoubleSide }),
      new THREE.MeshStandardMaterial({ color: '#689e52', roughness: 0.68, side: THREE.DoubleSide }),
    ];
    const leafGeo = new THREE.PlaneGeometry(0.28, 0.2);
    const lilyColors = ['#ffffff', '#f9edf3', '#e7f7f6'];
    const orchidPalette: [string, string][] = [
      ['#e5ccf7', '#8c4fa8'],
      ['#ffffff', '#d87fa3'],
      ['#fadbe6', '#b84b78'],
      ['#c9f0ed', '#06ada2'],
    ];

    // Dense climbing & draping vines across both sides of the vintage entrance wall
    for (let strand = 0; strand < 9; strand++) {
      const startX = centerX - wallWidth / 2 + (strand / 8) * wallWidth;
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 7; s++) {
        const t = s / 7;
        pts.push(
          new THREE.Vector3(
            startX + Math.sin(t * 4.5 + strand) * 0.34,
            0.15 + t * wallHeight,
            wallZ + (strand % 2 === 0 ? 0.24 : -0.24) + Math.cos(t * 5 + strand) * 0.04
          )
        );
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      this.scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.024, 5, false), vineMat));

      for (let l = 0; l < 24; l++) {
        const pt = curve.getPoint(l / 23);
        const leaf = new THREE.Mesh(leafGeo, leafMats[(strand + l) % leafMats.length]);
        leaf.position.copy(pt).add(
          new THREE.Vector3((Math.random() - 0.5) * 0.32, (Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.12)
        );
        leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        this.scene.add(leaf);

        if (l % 7 === 2) {
          const lily = this.createWhiteLily(lilyColors[(strand + l) % lilyColors.length]);
          lily.position.copy(pt).add(new THREE.Vector3(0, 0, strand % 2 === 0 ? 0.08 : -0.08));
          lily.rotation.x = strand % 2 === 0 ? Math.PI / 2 - 0.18 : -Math.PI / 2 + 0.18;
          this.scene.add(lily);
        } else if (l % 7 === 5) {
          const [petalCol, lipCol] = orchidPalette[(strand + l) % orchidPalette.length];
          const orchid = this.createOrchid(petalCol, lipCol);
          orchid.position.copy(pt).add(new THREE.Vector3(0, 0, strand % 2 === 0 ? 0.09 : -0.09));
          orchid.rotation.x = strand % 2 === 0 ? Math.PI / 2 - 0.15 : -Math.PI / 2 + 0.15;
          this.scene.add(orchid);
        }
      }
    }
  }

  private createWhiteLily(petalColor = '#ffffff'): THREE.Group {
    const lily = new THREE.Group();
    const petalMat = new THREE.MeshStandardMaterial({
      color: petalColor,
      roughness: 0.45,
      side: THREE.DoubleSide,
    });
    const centerMat = new THREE.MeshStandardMaterial({ color: '#f2d06b', roughness: 0.5 });

    const petalGeo = new THREE.ConeGeometry(0.038, 0.11, 5);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.position.set(Math.cos(angle) * 0.045, 0.03, Math.sin(angle) * 0.045);
      petal.rotation.z = -Math.cos(angle) * 0.72;
      petal.rotation.x = Math.sin(angle) * 0.72;
      lily.add(petal);
    }

    const center = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), centerMat);
    center.position.y = 0.03;
    lily.add(center);

    return lily;
  }

  private addClimbingVinesToGroup(
    target: THREE.Object3D,
    basePos: THREE.Vector3,
    height: number,
    radius: number
  ): void {
    const vineMat = new THREE.MeshStandardMaterial({ color: '#38642d', roughness: 0.85 });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#4f863e', roughness: 0.7, side: THREE.DoubleSide });
    const leafGeo = new THREE.PlaneGeometry(0.25, 0.18);
    const lilyColors = ['#ffffff', '#f9edf3', '#e7f7f6'];
    const orchidPalette: [string, string][] = [
      ['#e5ccf7', '#8c4fa8'],
      ['#ffffff', '#d87fa3'],
      ['#c9f0ed', '#06ada2'],
    ];

    for (let strand = 0; strand < 6; strand++) {
      const pts: THREE.Vector3[] = [];
      const offsetAngle = (strand / 6) * Math.PI * 2;
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const angle = offsetAngle + t * Math.PI * 2.6;
        pts.push(
          new THREE.Vector3(
            basePos.x + Math.cos(angle) * radius,
            basePos.y + t * height,
            basePos.z + Math.sin(angle) * radius
          )
        );
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      target.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.028, 5, false), vineMat));

      for (let l = 0; l < 32; l++) {
        const pt = curve.getPoint(l / 31);
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.copy(pt).add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0, (Math.random() - 0.5) * 0.2));
        leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        target.add(leaf);

        if (l % 9 === 2) {
          const lily = this.createWhiteLily(lilyColors[(strand + l) % lilyColors.length]);
          lily.position.copy(pt).add(new THREE.Vector3(0, 0, 0.06));
          lily.rotation.x = Math.PI / 2 - 0.2;
          target.add(lily);
        } else if (l % 9 === 6) {
          const [petalCol, lipCol] = orchidPalette[(strand + l) % orchidPalette.length];
          const orchid = this.createOrchid(petalCol, lipCol);
          orchid.position.copy(pt).add(new THREE.Vector3(0, 0, 0.06));
          orchid.rotation.x = Math.PI / 2 - 0.2;
          target.add(orchid);
        }
      }
    }
  }

  private addArchVines(archCurve: THREE.CatmullRomCurve3): void {
    const leafMat = new THREE.MeshStandardMaterial({ color: '#4f863e', roughness: 0.7, side: THREE.DoubleSide });
    const leafGeo = new THREE.PlaneGeometry(0.28, 0.2);
    const lilyColors = ['#ffffff', '#f9edf3', '#e7f7f6', '#fdf6e9'];
    const orchidPalette: [string, string][] = [
      ['#e5ccf7', '#8c4fa8'],
      ['#ffffff', '#d87fa3'],
      ['#fadbe6', '#b84b78'],
      ['#c9f0ed', '#06ada2'],
    ];

    for (let i = 0; i < 180; i++) {
      const t = i / 179;
      const pt = archCurve.getPoint(t);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.copy(pt).add(
        new THREE.Vector3((Math.random() - 0.5) * 0.38, (Math.random() - 0.5) * 0.38, (Math.random() - 0.5) * 0.32)
      );
      leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      this.scene.add(leaf);

      if (i % 8 === 0) {
        const lily = this.createWhiteLily(lilyColors[i % lilyColors.length]);
        lily.position.copy(pt).add(new THREE.Vector3(0, -0.06, 0.14));
        lily.rotation.x = Math.PI / 2 - 0.2;
        this.scene.add(lily);
      } else if (i % 8 === 4) {
        const [petalCol, lipCol] = orchidPalette[i % orchidPalette.length];
        const orchid = this.createOrchid(petalCol, lipCol);
        orchid.position.copy(pt).add(new THREE.Vector3(0, -0.05, 0.15));
        orchid.rotation.x = Math.PI / 2 - 0.18;
        this.scene.add(orchid);
      }
    }
  }

  private buildCentralContemplationCircle(): void {
    const centerZ = -30.5;
    const baseY = this.getTerrainHeight(0, centerZ);
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#d6ccbc', roughness: 0.9 });

    const platform = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.14, 32), stoneMat);
    platform.position.set(0, baseY + 0.05, centerZ);
    platform.receiveShadow = true;
    this.scene.add(platform);

    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.85, 0.35, 24), stoneMat);
    bowl.position.set(0, baseY + 0.25, centerZ);
    bowl.castShadow = true;
    this.scene.add(bowl);

    const waterMat = new THREE.MeshStandardMaterial({
      color: '#9db7c2',
      roughness: 0.1,
      metalness: 0.35,
    });
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, baseY + 0.43, centerZ);
    this.scene.add(water);
  }

  private buildWaterFeatures(): void {
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#dcd4c6', roughness: 0.88 });
    const waterMat = new THREE.MeshStandardMaterial({
      color: '#6fb4cc',
      roughness: 0.08,
      metalness: 0.35,
    });
    const padMat = new THREE.MeshStandardMaterial({ color: '#4d8242', roughness: 0.7 });

    // 1. Reflecting mirror pool near the entrance path (-3.4, -6.2)
    this.addReflectingPool(-3.4, -6.2, 1.85, stoneMat, waterMat, padMat);

    // 2. Tiered stone water fountain further along the path (3.6, -15.5)
    this.addTieredFountain(3.6, -15.5, stoneMat, waterMat);

    // 3. Second tranquil reflecting pool (-3.8, -22.5)
    this.addReflectingPool(-3.8, -22.5, 2.1, stoneMat, waterMat, padMat);
  }

  private addReflectingPool(
    x: number,
    z: number,
    radius: number,
    stoneMat: THREE.Material,
    waterMat: THREE.Material,
    padMat: THREE.Material
  ): void {
    const y = this.getTerrainHeight(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.14, 10, 32), stoneMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.08;
    rim.receiveShadow = true;
    group.add(rim);

    const water = new THREE.Mesh(new THREE.CircleGeometry(radius - 0.05, 32), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.09;
    group.add(water);

    // Lily pads & white water-lilies
    for (let i = 0; i < 3; i++) {
      const angle = i * 2.1 + 0.4;
      const r = radius * 0.45;
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.015, 14), padMat);
      pad.position.set(Math.cos(angle) * r, 0.1, Math.sin(angle) * r);
      group.add(pad);

      if (i % 2 === 0) {
        const lily = this.createWhiteLily();
        lily.position.set(Math.cos(angle) * r, 0.11, Math.sin(angle) * r);
        group.add(lily);
      }
    }

    this.scene.add(group);
  }

  private addTieredFountain(
    x: number,
    z: number,
    stoneMat: THREE.Material,
    waterMat: THREE.Material
  ): void {
    const y = this.getTerrainHeight(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const lowerBasin = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.25, 0.36, 24), stoneMat);
    lowerBasin.position.y = 0.18;
    lowerBasin.castShadow = true;
    lowerBasin.receiveShadow = true;
    group.add(lowerBasin);

    const lowerWater = new THREE.Mesh(new THREE.CircleGeometry(1.2, 24), waterMat);
    lowerWater.rotation.x = -Math.PI / 2;
    lowerWater.position.y = 0.37;
    group.add(lowerWater);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.85, 16), stoneMat);
    stem.position.y = 0.72;
    stem.castShadow = true;
    group.add(stem);

    const upperBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.35, 0.24, 20), stoneMat);
    upperBowl.position.y = 1.15;
    upperBowl.castShadow = true;
    group.add(upperBowl);

    const upperWater = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20), waterMat);
    upperWater.rotation.x = -Math.PI / 2;
    upperWater.position.y = 1.28;
    group.add(upperWater);

    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), stoneMat);
    finial.position.y = 1.42;
    group.add(finial);

    // Sprouting water droplets arcing gently from the top finial
    const dropMat = new THREE.MeshBasicMaterial({
      color: '#bfe8f5',
      transparent: true,
      opacity: 0.78,
    });
    const dropGeo = new THREE.SphereGeometry(0.032, 6, 6);
    for (let i = 0; i < 18; i++) {
      const drop = new THREE.Mesh(dropGeo, dropMat);
      this.scene.add(drop);
      this.fountainDroplets.push({
        mesh: drop,
        angle: (i / 18) * Math.PI * 2,
        phase: (i % 6) / 6,
        baseX: x,
        baseY: y + 1.54,
        baseZ: z,
      });
    }

    // Subtle expanding surface ripple in the lower basin
    const rippleMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.4, 24),
      new THREE.MeshBasicMaterial({ color: '#dff5fc', transparent: true, opacity: 0.45, side: THREE.DoubleSide })
    );
    rippleMesh.rotation.x = -Math.PI / 2;
    rippleMesh.position.y = 0.38;
    group.add(rippleMesh);
    this.waterRipples.push({ mesh: rippleMesh, phase: 0 });

    this.scene.add(group);
  }

  private buildPodcastBench(): void {
    const bx = 2.55;
    const bz = -7.2;
    const by = 0.13; // sits cleanly on the pavilion travertine floor

    const benchGroup = this.createCozySofa();
    benchGroup.position.set(bx, by, bz);
    benchGroup.rotation.y = -0.52;

    // Visible label plaque on backrest: official Spotify logo + short invitation phrase
    const labelTex = this.createPodcastLabelTexture();
    const labelMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.12, 0.28),
      new THREE.MeshBasicMaterial({ map: labelTex })
    );
    labelMesh.position.set(0, 0.72, -0.19);
    labelMesh.rotation.x = -0.08;
    benchGroup.add(labelMesh);

    // Floating Spotify logo emblem hovering gently above the cloud sofa
    const badgeGroup = new THREE.Group();
    badgeGroup.position.set(0, 1.38, 0);

    const spotifyTex = this.createSpotifyBadgeTexture();
    const badgeDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.15, 32),
      new THREE.MeshBasicMaterial({ map: spotifyTex, side: THREE.DoubleSide })
    );
    badgeGroup.add(badgeDisc);

    const badgeRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.158, 0.01, 8, 32),
      new THREE.MeshStandardMaterial({ color: '#64caca', roughness: 0.4 })
    );
    badgeGroup.add(badgeRing);

    benchGroup.add(badgeGroup);
    this.floatingSpotifyBadge = badgeGroup;

    // Interactive hit box (covers sofa + floating Spotify logo)
    this.podcastHitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 1.85, 0.95),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.podcastHitMesh.position.set(0, 0.92, 0);
    this.podcastHitMesh.userData = { isPodcastBench: true };
    benchGroup.add(this.podcastHitMesh);

    this.scene.add(benchGroup);
  }

  private createSpotifyBadgeTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1DB954';
    ctx.beginPath();
    ctx.arc(128, 128, 124, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineCap = 'round';
    [
      { yOff: -28, r: 86, w: 18 },
      { yOff: 4, r: 68, w: 15 },
      { yOff: 34, r: 50, w: 13 },
    ].forEach((wave) => {
      ctx.lineWidth = wave.w;
      ctx.beginPath();
      ctx.arc(128, 128 + 68 + wave.yOff, wave.r, -Math.PI * 0.72, -Math.PI * 0.28);
      ctx.stroke();
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createPodcastLabelTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 380;
    canvas.height = 88;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#faf6ee';
    ctx.fillRect(0, 0, 380, 88);

    ctx.strokeStyle = '#64caca';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 372, 80);

    // Official Spotify logo (#1DB954 circle + 3 white curved waves)
    const cx = 44;
    const cy = 44;
    ctx.fillStyle = '#1DB954';
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineCap = 'round';
    [
      { yOff: -5, r: 15, w: 3.2 },
      { yOff: 1, r: 12, w: 2.8 },
      { yOff: 7, r: 9, w: 2.4 },
    ].forEach((wave) => {
      ctx.lineWidth = wave.w;
      ctx.beginPath();
      ctx.arc(cx, cy + 12 + wave.yOff, wave.r, -Math.PI * 0.72, -Math.PI * 0.28);
      ctx.stroke();
    });

    ctx.fillStyle = '#2d2520';
    ctx.font = '12pt Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Tomate unos segundos para que', 78, 30);
    ctx.fillText('conozcas más sobre tu duelo', 78, 52);

    ctx.fillStyle = '#2f7d7d';
    ctx.font = 'italic 10pt Arial, sans-serif';
    ctx.fillText('Juntos en el Adiós · Spotify', 78, 72);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createMoonTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(104, 96, 16, 128, 128, 128);
    grad.addColorStop(0, '#fcfaf2');
    grad.addColorStop(0.6, '#ece6d8');
    grad.addColorStop(1, '#c8c2b6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Subtle lunar maria & soft craters
    const maria: [number, number, number, number][] = [
      [88, 92, 34, 0.14],
      [152, 114, 42, 0.12],
      [112, 164, 28, 0.11],
      [168, 72, 22, 0.1],
      [74, 152, 18, 0.12],
    ];
    maria.forEach(([x, y, r, a]) => {
      ctx.fillStyle = `rgba(110, 108, 104, ${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createCozySofa(): THREE.Group {
    // Cloud-style sofa (sofá tipo nube): puffy rounded cushions in soft cloud cream & #64caca accents
    const sofa = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({ color: '#faf8f4', roughness: 0.88 });
    const softAquaMat = new THREE.MeshStandardMaterial({ color: '#8ae0db', roughness: 0.78 });
    const turquoiseMat = new THREE.MeshStandardMaterial({ color: '#64caca', roughness: 0.72 });
    const oakLegMat = new THREE.MeshStandardMaterial({ color: '#d4be9e', roughness: 0.78 });

    // Low rounded legs
    [
      [-0.76, -0.28],
      [0.76, -0.28],
      [-0.76, 0.28],
      [0.76, 0.28],
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.14, 10), oakLegMat);
      leg.position.set(lx, 0.07, lz);
      leg.castShadow = true;
      sofa.add(leg);
    });

    // Rounded cloud base
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 14), cloudMat);
    base.scale.set(1.75, 0.28, 0.78);
    base.position.set(0, 0.2, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    sofa.add(base);

    // Three puffy cloud seat cushions
    [-0.52, 0, 0.52].forEach((cx) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), cloudMat);
      puff.scale.set(0.95, 0.42, 1.05);
      puff.position.set(cx, 0.36, 0.05);
      puff.castShadow = true;
      sofa.add(puff);
    });

    // Puffy cloud backrest puffs
    [-0.55, 0, 0.55].forEach((bx, idx) => {
      const backPuff = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), cloudMat);
      backPuff.scale.set(1.05, 0.92 + (idx === 1 ? 0.08 : 0), 0.55);
      backPuff.position.set(bx, 0.62, -0.26);
      backPuff.castShadow = true;
      sofa.add(backPuff);
    });

    // Soft rounded cloud armrests
    [-0.86, 0.86].forEach((ax) => {
      const armPuff = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 14), cloudMat);
      armPuff.scale.set(0.65, 0.72, 1.35);
      armPuff.position.set(ax, 0.48, 0.02);
      armPuff.castShadow = true;
      sofa.add(armPuff);
    });

    // Turquoise #64caca & aqua cloud throw pillows
    [-0.54, 0.54].forEach((px, i) => {
      const pillow = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 14, 12),
        i === 0 ? turquoiseMat : softAquaMat
      );
      pillow.scale.set(1.0, 0.95, 0.45);
      pillow.position.set(px, 0.58, -0.06);
      pillow.rotation.set(-0.25, i === 0 ? 0.32 : -0.32, 0);
      pillow.castShadow = true;
      sofa.add(pillow);
    });

    return sofa;
  }

  private buildSunMotes(): void {
    const count = 200;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 42;
      positions[i * 3 + 1] = 0.6 + Math.random() * 5.2;
      positions[i * 3 + 2] = 6 - Math.random() * 48;
    }
    this.motesGeometry = new THREE.BufferGeometry();
    this.motesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.motesMat = new THREE.PointsMaterial({
      color: '#fff2cf',
      size: 0.09,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.scene.add(new THREE.Points(this.motesGeometry, this.motesMat));
  }

  private buildFloatingLanterns(): void {
    // Chinese sky lantern (farol chino) glowing paper gradient texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0.0, '#c86420'); // warm honey top
    grad.addColorStop(0.45, '#f5a638'); // glowing amber mid
    grad.addColorStop(0.85, '#ffe08a'); // bright warm gold
    grad.addColorStop(1.0, '#fff9db'); // luminous flame opening at bottom
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 128);

    const lanternTex = new THREE.CanvasTexture(canvas);
    lanternTex.colorSpace = THREE.SRGBColorSpace;

    const paperMat = new THREE.MeshBasicMaterial({
      map: lanternTex,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
    });
    const topCapMat = new THREE.MeshBasicMaterial({ color: '#d4742a', transparent: true, opacity: 0.9 });
    const rimMat = new THREE.MeshBasicMaterial({ color: '#5c3c24' });
    const flameMat = new THREE.MeshBasicMaterial({ color: '#fff8d6' });

    const bodyGeo = new THREE.CylinderGeometry(0.24, 0.16, 0.56, 14, 1, true);
    const domeGeo = new THREE.SphereGeometry(0.24, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.42);
    const rimGeo = new THREE.TorusGeometry(0.16, 0.01, 6, 14);
    const flameGeo = new THREE.SphereGeometry(0.045, 6, 6);

    // 55 Chinese sky lanterns floating at varied heights and distances
    for (let i = 0; i < 55; i++) {
      const lx = (Math.random() - 0.5) * 84;
      const lz = -8 - Math.random() * 78;
      // Keep clear of inside the pavilion ceiling
      if (Math.abs(lx) < 9.5 && lz > -26) {
        continue;
      }
      const ly = 3.8 + Math.random() * 20;

      const g = new THREE.Group();
      g.position.set(lx, ly, lz);
      const scale = 0.75 + Math.random() * 0.65;
      g.scale.setScalar(scale);

      const body = new THREE.Mesh(bodyGeo, paperMat);
      g.add(body);

      const dome = new THREE.Mesh(domeGeo, topCapMat);
      dome.position.y = 0.27;
      dome.scale.y = 0.38;
      g.add(dome);

      const botRim = new THREE.Mesh(rimGeo, rimMat);
      botRim.rotation.x = Math.PI / 2;
      botRim.position.y = -0.28;
      g.add(botRim);

      const innerFlame = new THREE.Mesh(flameGeo, flameMat);
      innerFlame.position.y = -0.22;
      g.add(innerFlame);

      if (i % 9 === 0) {
        const pLight = new THREE.PointLight('#ffbf66', 0.65, 8, 2);
        pLight.position.y = -0.2;
        g.add(pLight);
      }

      this.scene.add(g);
      this.floatingLanterns.push({ group: g, baseY: ly, phase: i * 0.7 });
    }
  }

  private buildDaytimeBirds(): void {
    const birdMat = new THREE.MeshBasicMaterial({ color: '#3b4a54', side: THREE.DoubleSide });
    const wingGeo = new THREE.PlaneGeometry(0.26, 0.09);
    wingGeo.translate(0.13, 0, 0);

    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      const leftWing = new THREE.Mesh(wingGeo, birdMat);
      leftWing.rotation.y = Math.PI;
      const rightWing = new THREE.Mesh(wingGeo, birdMat);
      g.add(leftWing);
      g.add(rightWing);

      const center = new THREE.Vector3((i % 2 === 0 ? -1 : 1) * (8 + i * 2), 11 + (i % 3) * 2.5, -24 - i * 4);
      this.scene.add(g);
      this.dayBirds.push({
        group: g,
        leftWing,
        rightWing,
        center,
        radius: 10 + (i % 4) * 3.5,
        speed: 0.24 + (i % 3) * 0.06,
        angle: i * 0.85,
      });
    }
  }

  private buildWhiteButterflies(): void {
    const wingMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#f5fbff',
      emissiveIntensity: 0.25,
      roughness: 0.35,
      side: THREE.DoubleSide,
    });
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#5b524a', roughness: 0.8 });

    const upperWingGeo = new THREE.CircleGeometry(0.065, 10);
    upperWingGeo.scale(1.15, 0.85, 1);
    const lowerWingGeo = new THREE.CircleGeometry(0.045, 10);
    lowerWingGeo.scale(0.95, 1.1, 1);

    // 8 inside the sanctuary (near altars, walkway & lagoon) + 8 outside (near entrance & meadow)
    const centers: THREE.Vector3[] = [
      // Inside
      new THREE.Vector3(-3.2, 1.55, -3.8),
      new THREE.Vector3(3.1, 1.7, -5.8),
      new THREE.Vector3(-4.2, 1.45, -10.2),
      new THREE.Vector3(3.8, 1.65, -12.8),
      new THREE.Vector3(0.4, 1.35, -16.5),
      new THREE.Vector3(-3.4, 1.6, -21.2),
      new THREE.Vector3(3.6, 1.5, -24.5),
      new THREE.Vector3(0.0, 1.55, -29.2),
      // Outside
      new THREE.Vector3(-2.1, 1.65, 3.8),
      new THREE.Vector3(2.2, 1.8, 4.2),
      new THREE.Vector3(-4.5, 1.45, 5.5),
      new THREE.Vector3(4.6, 1.55, 5.8),
      new THREE.Vector3(-10.5, 1.5, -8.0),
      new THREE.Vector3(10.8, 1.6, -12.0),
      new THREE.Vector3(-11.2, 1.4, -22.0),
      new THREE.Vector3(11.4, 1.5, -26.0),
    ];

    centers.forEach((center, idx) => {
      const g = new THREE.Group();

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 6), bodyMat);
      body.rotation.x = Math.PI / 2;
      g.add(body);

      const makeWingSide = (dir: 1 | -1) => {
        const wingPivot = new THREE.Group();
        const upper = new THREE.Mesh(upperWingGeo, wingMat);
        upper.rotation.x = -Math.PI / 2;
        upper.position.set(dir * 0.055, 0, -0.02);
        wingPivot.add(upper);

        const lower = new THREE.Mesh(lowerWingGeo, wingMat);
        lower.rotation.x = -Math.PI / 2;
        lower.position.set(dir * 0.042, 0, 0.032);
        wingPivot.add(lower);

        return wingPivot;
      };

      const leftWing = makeWingSide(-1);
      const rightWing = makeWingSide(1);
      g.add(leftWing);
      g.add(rightWing);

      g.position.copy(center);
      this.scene.add(g);

      this.whiteButterflies.push({
        group: g,
        leftWing,
        rightWing,
        center,
        radiusX: 0.95 + (idx % 3) * 0.45,
        radiusZ: 0.85 + ((idx + 1) % 3) * 0.45,
        speed: 0.65 + (idx % 4) * 0.14,
        phase: idx * 0.9,
      });
    });
  }

  private buildWalkRipple(): void {
    const geo = new THREE.RingGeometry(0.28, 0.36, 32);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: '#f5e4c3',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.walkRipple = new THREE.Mesh(geo, mat);
    this.scene.add(this.walkRipple);
  }

  private buildChosenPlant(type: PlantType): THREE.Group {
    const plant = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b5341', roughness: 0.9 });

    // Warm ceramic planter pot (maceta) so the plant sits neatly beside the altar
    const potMat = new THREE.MeshStandardMaterial({ color: '#cfa586', roughness: 0.78 });
    const potRimMat = new THREE.MeshStandardMaterial({ color: '#dfbaa0', roughness: 0.72 });
    const soilMat = new THREE.MeshStandardMaterial({ color: '#4a382b', roughness: 0.95 });

    const potBody = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.21, 0.36, 18), potMat);
    potBody.position.y = 0.32;
    potBody.castShadow = true;
    potBody.receiveShadow = true;
    plant.add(potBody);

    const potRim = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.3, 0.06, 18), potRimMat);
    potRim.position.y = 0.5;
    potRim.castShadow = true;
    plant.add(potRim);

    const soil = new THREE.Mesh(new THREE.CircleGeometry(0.26, 16), soilMat);
    soil.rotation.x = -Math.PI / 2;
    soil.position.y = 0.505;
    plant.add(soil);

    const stemBase = new THREE.Group();
    stemBase.position.y = 0.5;
    plant.add(stemBase);

    if (type === 'olivo' || type === 'cipres' || type === 'cerezo' || type === 'guayacan' || type === 'sauce') {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 0.88, 8), trunkMat);
      trunk.position.y = 0.44;
      trunk.castShadow = true;
      stemBase.add(trunk);

      if (type === 'olivo') {
        const foliageMat = new THREE.MeshStandardMaterial({ color: '#6d8a5e', roughness: 0.85 });
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), foliageMat);
        crown.position.y = 1.02;
        crown.scale.set(1.15, 0.9, 1.15);
        crown.castShadow = true;
        stemBase.add(crown);
      } else if (type === 'cipres') {
        const foliageMat = new THREE.MeshStandardMaterial({ color: '#4c6644', roughness: 0.85 });
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.25, 10), foliageMat);
        cone.position.y = 1.15;
        cone.castShadow = true;
        stemBase.add(cone);
      } else if (type === 'cerezo' || type === 'guayacan') {
        const crownColor = type === 'cerezo' ? '#f4c6d0' : '#f0c44d';
        const foliageMat = new THREE.MeshStandardMaterial({ color: crownColor, roughness: 0.78 });
        [
          [0, 1.05, 0, 0.36],
          [-0.22, 0.94, 0.1, 0.25],
          [0.22, 0.96, -0.08, 0.26],
        ].forEach(([cx, cy, cz, r]) => {
          const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), foliageMat);
          puff.position.set(cx, cy, cz);
          puff.castShadow = true;
          stemBase.add(puff);
        });
      } else {
        // Sauce
        const foliageMat = new THREE.MeshStandardMaterial({ color: '#6a8f5c', roughness: 0.85 });
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), foliageMat);
        dome.position.y = 0.98;
        dome.scale.set(1.25, 0.72, 1.25);
        stemBase.add(dome);
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.008, 0.48, 5), foliageMat);
          drape.position.set(Math.cos(ang) * 0.34, 0.74, Math.sin(ang) * 0.34);
          stemBase.add(drape);
        }
      }
    } else if (type === 'lavanda') {
      // Natural radiating lavender bouquet: slender sage stems, narrow leaves, tiered violet florets
      const stemMat = new THREE.MeshStandardMaterial({ color: '#6b8760', roughness: 0.85 });
      const leafMat = new THREE.MeshStandardMaterial({ color: '#5b7850', roughness: 0.85, side: THREE.DoubleSide });
      const lavDarkMat = new THREE.MeshStandardMaterial({ color: '#8464ad', roughness: 0.65 });
      const lavLightMat = new THREE.MeshStandardMaterial({ color: '#a88bd1', roughness: 0.6 });

      // Narrow basal sage leaves
      const leafGeo = new THREE.PlaneGeometry(0.035, 0.22);
      leafGeo.translate(0, 0.11, 0);
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2;
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.rotation.y = ang;
        leaf.rotation.x = 0.55 + (i % 3) * 0.15;
        stemBase.add(leaf);
      }

      // 13 slender stems with tiered flower florets
      const floretGeo = new THREE.SphereGeometry(0.022, 7, 7);
      for (let i = 0; i < 13; i++) {
        const ang = (i / 13) * Math.PI * 2 + (i % 2) * 0.2;
        const tilt = i === 0 ? 0.04 : 0.16 + (i % 3) * 0.11;
        const stemH = 0.42 + (i % 3) * 0.08;

        const stalkGroup = new THREE.Group();
        stalkGroup.rotation.y = ang;
        stalkGroup.rotation.x = tilt;

        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.01, stemH, 5), stemMat);
        stem.position.y = stemH / 2;
        stalkGroup.add(stem);

        // Tiered lavender flower buds along upper third of the stem
        for (let b = 0; b < 5; b++) {
          const by = stemH - 0.14 + b * 0.036;
          const budMat = b % 2 === 0 ? lavDarkMat : lavLightMat;
          for (let side = 0; side < 2; side++) {
            const bud = new THREE.Mesh(floretGeo, budMat);
            bud.scale.set(0.85, 1.25, 0.85);
            const offsetAng = side * Math.PI + b * 0.9;
            bud.position.set(Math.cos(offsetAng) * 0.015, by, Math.sin(offsetAng) * 0.015);
            stalkGroup.add(bud);
          }
        }
        const tipBud = new THREE.Mesh(floretGeo, lavLightMat);
        tipBud.scale.set(0.8, 1.3, 0.8);
        tipBud.position.y = stemH + 0.015;
        stalkGroup.add(tipBud);

        stemBase.add(stalkGroup);
      }
    } else if (type === 'helecho') {
      const fernMat = new THREE.MeshStandardMaterial({ color: '#4f7f44', roughness: 0.8, side: THREE.DoubleSide });
      const frondGeo = new THREE.PlaneGeometry(0.14, 0.46);
      frondGeo.translate(0, 0.23, 0);
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2;
        const frond = new THREE.Mesh(frondGeo, fernMat);
        frond.rotation.y = ang;
        frond.rotation.x = 0.65;
        stemBase.add(frond);
      }
    } else if (type === 'suculenta') {
      const sucMat = new THREE.MeshStandardMaterial({ color: '#78a58a', roughness: 0.65 });
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 6), sucMat);
        leaf.position.set(Math.cos(ang) * 0.12, 0.08, Math.sin(ang) * 0.12);
        leaf.rotation.z = -Math.cos(ang) * 0.85;
        leaf.rotation.x = Math.sin(ang) * 0.85;
        stemBase.add(leaf);
      }
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), sucMat);
      center.position.y = 0.11;
      stemBase.add(center);
    } else if (type === 'jazmin') {
      const bushMat = new THREE.MeshStandardMaterial({ color: '#587547', roughness: 0.85 });
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), bushMat);
      bush.position.y = 0.22;
      stemBase.add(bush);
      const flowerMat = new THREE.MeshStandardMaterial({ color: '#fcf8ef', roughness: 0.5 });
      for (let i = 0; i < 7; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), flowerMat);
        f.position.set((Math.random() - 0.5) * 0.34, 0.2 + Math.random() * 0.22, (Math.random() - 0.5) * 0.34);
        stemBase.add(f);
      }
    } else if (type === 'lirio') {
      const stemMat = new THREE.MeshStandardMaterial({ color: '#587547', roughness: 0.85 });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.52, 6), stemMat);
      stem.position.y = 0.26;
      stemBase.add(stem);
      const lily = this.createWhiteLily();
      lily.position.y = 0.54;
      lily.scale.setScalar(1.65);
      stemBase.add(lily);
    } else if (type === 'orquidea') {
      const stemMat = new THREE.MeshStandardMaterial({ color: '#587547', roughness: 0.85 });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.56, 6), stemMat);
      stem.position.y = 0.28;
      stem.rotation.z = 0.12;
      stemBase.add(stem);
      const petalMat = new THREE.MeshStandardMaterial({ color: '#d9a4c5', roughness: 0.5 });
      for (let i = 0; i < 3; i++) {
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), petalMat);
        bloom.scale.set(1.2, 0.9, 0.6);
        bloom.position.set(-0.04 * i, 0.4 + i * 0.11, 0.04);
        stemBase.add(bloom);
      }
    } else if (type === 'rosal') {
      const bushMat = new THREE.MeshStandardMaterial({ color: '#527344', roughness: 0.85 });
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), bushMat);
      bush.position.y = 0.22;
      stemBase.add(bush);
      const roseMat = new THREE.MeshStandardMaterial({ color: '#d46b76', roughness: 0.55 });
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2;
        const rose = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 8), roseMat);
        rose.position.set(Math.cos(ang) * 0.14, 0.34 + (i % 2) * 0.06, Math.sin(ang) * 0.14);
        stemBase.add(rose);
      }
    } else {
      // Girasol
      const stemMat = new THREE.MeshStandardMaterial({ color: '#5a7846', roughness: 0.85 });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.72, 6), stemMat);
      stem.position.y = 0.36;
      stemBase.add(stem);
      const center = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.05, 12),
        new THREE.MeshStandardMaterial({ color: '#593e28' })
      );
      center.rotation.x = Math.PI / 2 - 0.25;
      center.position.set(0, 0.74, 0.05);
      stemBase.add(center);
      const petals = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.055, 6, 12),
        new THREE.MeshStandardMaterial({ color: '#e8b948' })
      );
      petals.rotation.x = -0.25;
      petals.position.set(0, 0.74, 0.04);
      stemBase.add(petals);
    }

    return plant;
  }

  private createMemorialObject(memorial: Memorial): MemorialObject {
    const group = new THREE.Group();
    const [mx, my, mz] = memorial.position;
    group.position.set(mx, my, mz);
    group.rotation.y = memorial.rotationY;

    const stoneMat = new THREE.MeshStandardMaterial({ color: '#d7cec0', roughness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ color: '#6b4f3b', roughness: 0.85 });

    // Stone pedestal
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.95, 0.65), stoneMat);
    pedestal.position.y = 0.475;
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    group.add(pedestal);

    // Wooden frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.08, 0.12), woodMat);
    frame.position.set(0, 1.48, -0.05);
    frame.castShadow = true;
    group.add(frame);

    const portraitTex = this.createPortraitTexture(memorial);
    const portrait = new THREE.Mesh(
      new THREE.PlaneGeometry(0.74, 0.88),
      new THREE.MeshBasicMaterial({ map: portraitTex })
    );
    portrait.position.set(0, 1.48, 0.015);
    group.add(portrait);

    // Delicate glass doors in front of the portrait (swing open when hovered or approached)
    const doorGlassMat = new THREE.MeshPhysicalMaterial({
      color: '#eaf6fa',
      transparent: true,
      opacity: 0.3,
      roughness: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const doorTrimMat = new THREE.MeshStandardMaterial({ color: '#c4a66a', roughness: 0.45, metalness: 0.35 });

    const leftDoorPivot = new THREE.Group();
    leftDoorPivot.position.set(-0.37, 1.48, 0.032);
    const leftGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.37, 0.88), doorGlassMat);
    leftGlass.position.x = 0.185;
    leftDoorPivot.add(leftGlass);
    const leftTrim = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.88, 0.015), doorTrimMat);
    leftTrim.position.x = 0.365;
    leftDoorPivot.add(leftTrim);
    group.add(leftDoorPivot);

    const rightDoorPivot = new THREE.Group();
    rightDoorPivot.position.set(0.37, 1.48, 0.032);
    const rightGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.37, 0.88), doorGlassMat);
    rightGlass.position.x = -0.185;
    rightDoorPivot.add(rightGlass);
    const rightTrim = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.88, 0.015), doorTrimMat);
    rightTrim.position.x = -0.365;
    rightDoorPivot.add(rightTrim);
    group.add(rightDoorPivot);

    const plaqueTex = this.createPlaqueTexture(memorial);
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(0.84, 0.28),
      new THREE.MeshBasicMaterial({ map: plaqueTex })
    );
    plaque.position.set(0, 0.62, 0.33);
    group.add(plaque);

    // Candle on ledge
    const candle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.06, 0.18, 12),
      new THREE.MeshStandardMaterial({ color: '#f5ebd6', roughness: 0.7 })
    );
    candle.position.set(0.24, 1.04, 0.22);
    group.add(candle);

    const flameMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.036, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#ffcf70', transparent: true, opacity: 0.95 })
    );
    flameMesh.scale.set(0.75, 1.5, 0.75);
    flameMesh.position.set(0.24, 1.17, 0.22);
    group.add(flameMesh);

    const flameLight = new THREE.PointLight('#ffbe6b', 0.9, 4.5, 2);
    flameLight.position.set(0.24, 1.24, 0.24);
    group.add(flameLight);

    if (memorial.toyLeftByUser) {
      const toyColor = memorial.toyLeftByUser === 'perro' ? '#c87a4b' : '#64caca';
      const toy = new THREE.Mesh(
        new THREE.SphereGeometry(0.068, 12, 12),
        new THREE.MeshStandardMaterial({ color: toyColor, roughness: 0.65 })
      );
      toy.position.set(-0.26, 1.02, 0.22);
      toy.castShadow = true;
      group.add(toy);
    }

    // Miniature 3D shelves flanking the photo + recognizable 3D figurines for sent gifts
    const shelfMat = new THREE.MeshStandardMaterial({ color: '#e6d8c3', roughness: 0.78 });
    [
      [-0.62, 1.65],
      [-0.62, 1.32],
      [0.62, 1.65],
      [0.62, 1.32],
    ].forEach(([sx, sy]) => {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.025, 0.18), shelfMat);
      shelf.position.set(sx, sy, 0.04);
      shelf.castShadow = true;
      group.add(shelf);
    });

    const shelfSlots: [number, number, number][] = [
      [-0.72, 1.72, 0.06],
      [-0.62, 1.72, 0.06],
      [-0.52, 1.72, 0.06],
      [0.52, 1.72, 0.06],
      [0.62, 1.72, 0.06],
      [0.72, 1.72, 0.06],
      [-0.72, 1.39, 0.06],
      [-0.62, 1.39, 0.06],
      [-0.52, 1.39, 0.06],
      [0.52, 1.39, 0.06],
      [0.62, 1.39, 0.06],
      [0.72, 1.39, 0.06],
    ];

    const gestures = (memorial.sentGestures || []).slice(-12);
    gestures.forEach((g, idx) => {
      const [gx, gy, gz] = shelfSlots[idx];
      const sprite = this.createEmojiOfferingSprite(g.emoji || '🤍');
      sprite.position.set(gx, gy, gz);
      group.add(sprite);
    });

    // Family's chosen plant/tree beside the memorial (never withers)
    const plant = this.buildChosenPlant(memorial.chosenPlant);
    plant.position.set(-1.12, 0, 0.05);
    group.add(plant);

    const hitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 2.2, 1.0),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitMesh.position.y = 1.1;
    hitMesh.userData = { memorialId: memorial.id };
    group.add(hitMesh);

    return {
      memorial,
      group,
      hitMesh,
      flameMesh,
      flameLight,
      leftDoorPivot,
      rightDoorPivot,
      doorOpenProgress: 0,
    };
  }

  private createEmojiOfferingSprite(emoji: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Soft glowing circular medallion behind the emoji
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#64caca';
    ctx.stroke();

    ctx.font = '62px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 68);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.11, 0.11, 1);
    return sprite;
  }

  private createPortraitTexture(memorial: Memorial): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 304;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, 304);
    grad.addColorStop(0, '#fbf6eb');
    grad.addColorStop(1, '#ede0ca');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 304);

    // Golden pawprints background (huellitas doradas)
    ctx.fillStyle = 'rgba(209, 160, 74, 0.28)';
    const pawCoords: [number, number][] = [
      [34, 40], [218, 44], [42, 130], [214, 145],
      [36, 232], [220, 238], [128, 28], [128, 276],
    ];
    pawCoords.forEach(([px, py]) => {
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
      [-7, -2.5, 2.5, 7].forEach((dx, j) => {
        ctx.beginPath();
        ctx.arc(px + dx, py - 9 - (j === 1 || j === 2 ? 2 : 0), 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    ctx.fillStyle = memorial.accentTone;
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.arc(128, 138, 76, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    if (memorial.photoUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Leave a neat golden-pawprint border around the photo
        const pad = 16;
        const boxW = 256 - pad * 2;
        const boxH = 304 - pad * 2;
        const scale = Math.max(boxW / img.width, boxH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.save();
        ctx.beginPath();
        ctx.rect(pad, pad, boxW, boxH);
        ctx.clip();
        ctx.drawImage(img, pad + (boxW - w) / 2, pad + (boxH - h) / 2, w, h);
        ctx.restore();
        ctx.strokeStyle = '#d4aa5d';
        ctx.lineWidth = 3;
        ctx.strokeRect(pad, pad, boxW, boxH);
        tex.needsUpdate = true;
      };
      img.src = memorial.photoUrl;
    } else {
      ctx.strokeStyle = memorial.accentTone;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(128, 138, 66, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#4a3b2f';
      ctx.font = 'italic 54px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(memorial.name.charAt(0).toUpperCase(), 128, 136);

      if (memorial.dates) {
        ctx.fillStyle = '#7a6858';
        ctx.font = '15px sans-serif';
        ctx.fillText(memorial.dates, 128, 245);
      }
    }

    return tex;
  }

  private createPlaqueTexture(memorial: Memorial): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 108;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#faf7f2';
    ctx.fillRect(0, 0, 280, 108);

    ctx.strokeStyle = '#64caca';
    ctx.lineWidth = 4;
    ctx.strokeRect(5, 5, 270, 98);

    ctx.fillStyle = '#0d827b';
    ctx.font = '600 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('En honor a', 140, 28);

    ctx.fillStyle = '#33271e';
    ctx.font = '700 21px Georgia, serif';
    ctx.textAlign = 'center';
    const nameText = `“${memorial.name}”`;
    ctx.fillText(nameText, 124, 58);

    const textWidth = ctx.measureText(nameText).width;
    const flagX = Math.min(238, 124 + textWidth / 2 + 10);
    drawCountryFlagOnCanvas(ctx, memorial.country || 'Colombia', flagX, 49, 26, 17);

    ctx.fillStyle = '#6f5f52';
    ctx.font = '14px sans-serif';
    ctx.fillText(memorial.dates || 'En nuestra memoria', 140, 86);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
  }

  private handleResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const aspect = w / Math.max(1, h);
    this.camera.fov = aspect < 0.85 ? 70 : aspect < 1.15 ? 60 : 52;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.keysPressed.add(e.key.toLowerCase());
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysPressed.delete(e.key.toLowerCase());
  };

  private handlePointerDown = (e: PointerEvent): void => {
    if (!this.isEntered) return;
    this.isDragging = true;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    this.lastPointerPos = { x: e.clientX, y: e.clientY };
  };

  private handlePointerMove = (e: PointerEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    if (this.isDragging && this.isEntered) {
      const dx = e.clientX - this.lastPointerPos.x;
      const dy = e.clientY - this.lastPointerPos.y;
      this.targetYaw += dx * 0.0032;
      this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + dy * 0.0026, -0.45, 0.55);
      this.lastPointerPos = { x: e.clientX, y: e.clientY };
      return;
    }

    if (this.isEntered) {
      this.raycaster.setFromCamera(this.pointerNDC, this.camera);
      const targets = [
        this.podcastHitMesh,
        ...this.memorialObjects.map((m) => m.hitMesh),
        ...(this.rainbowHitMesh.visible ? [this.rainbowHitMesh, this.rainbowSignMesh] : []),
      ];
      const hits = this.raycaster.intersectObjects(targets);
      if (hits.length > 0) {
        const ud = hits[0].object.userData;
        if (ud.isRainbow) {
          if (!this.isRainbowHovered) {
            this.isRainbowHovered = true;
            this.callbacks.onHoverRainbow(true);
          }
          if (this.isPodcastHovered) {
            this.isPodcastHovered = false;
            this.callbacks.onHoverPodcast(false);
          }
          if (this.hoveredMemorialId !== null) {
            this.hoveredMemorialId = null;
            this.callbacks.onHoverMemorial(null);
          }
          this.renderer.domElement.style.cursor = 'inherit';
          return;
        }
        if (this.isRainbowHovered) {
          this.isRainbowHovered = false;
          this.callbacks.onHoverRainbow(false);
        }
        if (ud.isPodcastBench) {
          if (!this.isPodcastHovered) {
            this.isPodcastHovered = true;
            this.callbacks.onHoverPodcast(true);
          }
          if (this.hoveredMemorialId !== null) {
            this.hoveredMemorialId = null;
            this.callbacks.onHoverMemorial(null);
          }
          this.renderer.domElement.style.cursor = 'inherit';
          return;
        }
        if (this.isPodcastHovered) {
          this.isPodcastHovered = false;
          this.callbacks.onHoverPodcast(false);
        }
        const id = ud.memorialId as string;
        const found = this.memorialObjects.find((m) => m.memorial.id === id)?.memorial ?? null;
        this.callbacks.onHoverBook(null);
        if (this.hoveredMemorialId !== id) {
          this.hoveredMemorialId = id;
          this.callbacks.onHoverMemorial(found);
        }
        this.renderer.domElement.style.cursor = 'inherit';
      } else {
        if (this.isRainbowHovered) {
          this.isRainbowHovered = false;
          this.callbacks.onHoverRainbow(false);
        }
        if (this.isPodcastHovered) {
          this.isPodcastHovered = false;
          this.callbacks.onHoverPodcast(false);
        }
        this.callbacks.onHoverBook(null);
        if (this.hoveredMemorialId !== null) {
          this.hoveredMemorialId = null;
          this.callbacks.onHoverMemorial(null);
        }
        this.renderer.domElement.style.cursor = 'inherit';
      }
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (!this.isDragging) return;
    this.isDragging = false;

    const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (dist < 6 && this.isEntered) {
      this.handleClick();
    }
  };

  private handleClick(): void {
    this.raycaster.setFromCamera(this.pointerNDC, this.camera);

    // 0. Check podcast bench first
    const podcastHits = this.raycaster.intersectObject(this.podcastHitMesh);
    if (podcastHits.length > 0) {
      this.callbacks.onSelectPodcast();
      return;
    }

    // 1. Check memorials
    const memHits = this.raycaster.intersectObjects(this.memorialObjects.map((m) => m.hitMesh));
    if (memHits.length > 0) {
      const id = memHits[0].object.userData.memorialId as string;
      const found = this.memorialObjects.find((m) => m.memorial.id === id);
      if (found) {
        this.focusMemorial(found.memorial);
        this.callbacks.onSelectMemorial(found.memorial);
        return;
      }
    }

    // 2. Check ground/floor vs rainbow (ground in front always wins over distant rainbow)
    const groundHits = this.raycaster.intersectObjects([this.terrainMesh, this.pavilionFloorMesh]);
    const rainbowHits = this.rainbowHitMesh.visible
      ? this.raycaster.intersectObjects([this.rainbowHitMesh, this.rainbowSignMesh])
      : [];

    if (
      rainbowHits.length > 0 &&
      (groundHits.length === 0 || rainbowHits[0].distance < groundHits[0].distance)
    ) {
      this.callbacks.onSelectRainbow();
      return;
    }

    // 3. Walk to clicked ground or pavilion floor
    if (groundHits.length > 0) {
      const pt = groundHits[0].point;
      const clampedX = THREE.MathUtils.clamp(pt.x, -26, 26);
      const clampedZ = THREE.MathUtils.clamp(pt.z, -38, 1.0);
      const y = this.getTerrainHeight(clampedX, clampedZ);

      this.targetCamPos.set(clampedX, y + 1.75, clampedZ);
      if (this.reducedMotion) {
        this.camPos.copy(this.targetCamPos);
      } else {
        this.walkRipple.position.set(clampedX, y + 0.05, clampedZ);
        this.walkRipple.scale.set(0.4, 0.4, 0.4);
        this.walkRippleLife = 1.0;
      }
    }
  }

  private animate = (): void => {
    this.animFrameId = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;

    // Smooth day/night transition
    if (Math.abs(this.nightFactor - this.targetNightFactor) > 0.002) {
      this.nightFactor = THREE.MathUtils.lerp(
        this.nightFactor,
        this.targetNightFactor,
        this.reducedMotion ? 1 : 1 - Math.exp(-2.2 * dt)
      );
      this.applyAtmosphere(this.nightFactor);
    }

    if (!this.reducedMotion) {
      this.grassUniforms.uTime.value = elapsed;
    }

    if (this.isEntering) {
      this.enterProgress = Math.min(1, this.enterProgress + dt * 0.42);
      const ease = 1 - Math.pow(1 - this.enterProgress, 3);

      this.leftGatePivot.rotation.y = -ease * Math.PI * 0.48;
      this.rightGatePivot.rotation.y = ease * Math.PI * 0.48;

      this.camPos.set(0, 1.85 - ease * 0.1, THREE.MathUtils.lerp(9.2, 0.6, ease));
      this.targetCamPos.copy(this.camPos);

      if (this.enterProgress >= 1) {
        this.isEntering = false;
        this.isEntered = true;
        this.callbacks.onEnterComplete();
      }
    } else if (this.isEntered) {
      const speed = 5.2 * dt;
      const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      let moved = false;

      if (this.keysPressed.has('w') || this.keysPressed.has('arrowup')) {
        this.targetCamPos.addScaledVector(forward, speed);
        moved = true;
      }
      if (this.keysPressed.has('s') || this.keysPressed.has('arrowdown')) {
        this.targetCamPos.addScaledVector(forward, -speed);
        moved = true;
      }
      if (this.keysPressed.has('a') || this.keysPressed.has('arrowleft')) {
        this.targetCamPos.addScaledVector(right, -speed);
        moved = true;
      }
      if (this.keysPressed.has('d') || this.keysPressed.has('arrowright')) {
        this.targetCamPos.addScaledVector(right, speed);
        moved = true;
      }

      if (moved) {
        this.targetCamPos.x = THREE.MathUtils.clamp(this.targetCamPos.x, -26, 26);
        this.targetCamPos.z = THREE.MathUtils.clamp(this.targetCamPos.z, -38, 1.8);
        this.targetCamPos.y = this.getTerrainHeight(this.targetCamPos.x, this.targetCamPos.z) + 1.75;
      }

      this.camPos.lerp(this.targetCamPos, this.reducedMotion ? 1 : 1 - Math.exp(-4.5 * dt));
    } else if (!this.reducedMotion) {
      this.camPos.y = 1.85 + Math.sin(elapsed * 0.6) * 0.03;
    }

    this.yaw = THREE.MathUtils.lerp(this.yaw, this.targetYaw, this.reducedMotion ? 1 : 1 - Math.exp(-8 * dt));
    this.pitch = THREE.MathUtils.lerp(this.pitch, this.targetPitch, this.reducedMotion ? 1 : 1 - Math.exp(-8 * dt));

    this.camera.position.copy(this.camPos);
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

    if (!this.reducedMotion) {
      const moteAttr = this.motesGeometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < moteAttr.count; i++) {
        let y = moteAttr.getY(i) + dt * 0.14;
        if (y > 6.2) y = 0.6;
        moteAttr.setY(i, y);
        moteAttr.setX(i, moteAttr.getX(i) + Math.sin(elapsed * 0.5 + i) * 0.0015);
      }
      moteAttr.needsUpdate = true;

      for (let i = 0; i < this.memorialObjects.length; i++) {
        const obj = this.memorialObjects[i];
        const flicker = 0.9 + Math.sin(elapsed * 7.5 + i * 2.1) * 0.12;
        obj.flameLight.intensity = (0.7 + this.nightFactor * 0.9) * flicker;
        obj.flameMesh.scale.set(0.75, 1.45 * flicker, 0.75);

        // Open altar glass doors smoothly when hovered or visitor is close
        const dist = this.camera.position.distanceTo(obj.group.position);
        const shouldOpen = this.hoveredMemorialId === obj.memorial.id || dist < 5.2;
        obj.doorOpenProgress = THREE.MathUtils.lerp(
          obj.doorOpenProgress,
          shouldOpen ? 1 : 0,
          1 - Math.exp(-5 * dt)
        );
        obj.leftDoorPivot.rotation.y = -obj.doorOpenProgress * Math.PI * 0.58;
        obj.rightDoorPivot.rotation.y = obj.doorOpenProgress * Math.PI * 0.58;
      }

      // Floating lanterns gentle bobbing
      for (const fl of this.floatingLanterns) {
        fl.group.position.y = fl.baseY + Math.sin(elapsed * 0.75 + fl.phase) * 0.22;
        fl.group.rotation.y += dt * 0.15;
      }

      if (this.floatingSpotifyBadge) {
        this.floatingSpotifyBadge.position.y = 1.38 + Math.sin(elapsed * 1.4) * 0.04;
        this.floatingSpotifyBadge.rotation.y = Math.sin(elapsed * 0.55) * 0.35;
      }

      // Daytime birds gliding gently across the blue sky
      for (const bird of this.dayBirds) {
        if (!bird.group.visible) continue;
        bird.angle += bird.speed * dt;
        const bx = bird.center.x + Math.cos(bird.angle) * bird.radius;
        const bz = bird.center.z + Math.sin(bird.angle) * bird.radius;
        bird.group.position.set(bx, bird.center.y + Math.sin(elapsed * 0.8 + bird.angle) * 0.35, bz);
        bird.group.rotation.y = -bird.angle;
        const flap = Math.sin(elapsed * 6.5 + bird.angle * 3) * 0.42;
        bird.leftWing.rotation.z = flap;
        bird.rightWing.rotation.z = -flap;
      }

      // White butterflies fluttering gently inside and outside the sanctuary
      for (const bf of this.whiteButterflies) {
        bf.phase += bf.speed * dt;
        const t = bf.phase;
        const bx = bf.center.x + Math.sin(t) * bf.radiusX;
        const bz = bf.center.z + Math.sin(t * 1.4) * bf.radiusZ;
        const by = bf.center.y + Math.sin(t * 2.1) * 0.24;
        const dx = Math.cos(t) * bf.radiusX;
        const dz = Math.cos(t * 1.4) * bf.radiusZ * 1.4;
        bf.group.position.set(bx, by, bz);
        bf.group.rotation.y = Math.atan2(dx, dz);
        const flap = Math.sin(elapsed * 9.5 + bf.phase * 2) * 0.78;
        bf.leftWing.rotation.z = -flap;
        bf.rightWing.rotation.z = flap;
      }

      // Fountain sprouting water droplets — slow and gentle
      for (const d of this.fountainDroplets) {
        d.phase = (d.phase + dt * 0.28) % 1;
        const t = d.phase;
        const radius = t * 0.48;
        const arcY = t * 0.26 - t * t * 0.36;
        d.mesh.position.set(
          d.baseX + Math.cos(d.angle) * radius,
          d.baseY + arcY,
          d.baseZ + Math.sin(d.angle) * radius
        );
      }

      // Water surface ripples — slow and serene
      for (const r of this.waterRipples) {
        r.phase = (r.phase + dt * 0.22) % 1;
        const scale = 1 + r.phase * 1.9;
        r.mesh.scale.set(scale, scale, 1);
        (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - r.phase) * 0.42;
      }

      // Shooting stars after 5 minutes (300 seconds) connected during night
      if (this.nightFactor > 0.5 && elapsed >= 300) {
        if (elapsed >= this.nextShootingStarAt) {
          this.nextShootingStarAt = elapsed + 10 + Math.random() * 14;
          const start = new THREE.Vector3(
            (Math.random() - 0.5) * 90,
            42 + Math.random() * 24,
            -95 - Math.random() * 45
          );
          const dir = new THREE.Vector3(
            (Math.random() > 0.5 ? 1 : -1) * (16 + Math.random() * 12),
            -(9 + Math.random() * 8),
            4
          );
          const pts = [start.clone(), start.clone().addScaledVector(dir.clone().normalize(), -6)];
          const geo = new THREE.BufferGeometry().setFromPoints(pts);
          const mat = new THREE.LineBasicMaterial({ color: '#fffbe8', transparent: true, opacity: 0.95 });
          const line = new THREE.Line(geo, mat);
          this.scene.add(line);
          this.shootingStars.push({ line, vel: dir, life: 0, maxLife: 1.4 });
        }

        for (let i = this.shootingStars.length - 1; i >= 0; i--) {
          const st = this.shootingStars[i];
          st.life += dt;
          st.line.position.addScaledVector(st.vel, dt);
          (st.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, 1 - st.life / st.maxLife);
          if (st.life >= st.maxLife) {
            this.scene.remove(st.line);
            this.shootingStars.splice(i, 1);
          }
        }
      }
    }

    if (this.walkRippleLife > 0) {
      this.walkRippleLife = Math.max(0, this.walkRippleLife - dt * 1.4);
      const mat = this.walkRipple.material as THREE.MeshBasicMaterial;
      mat.opacity = this.walkRippleLife * 0.55;
      const s = 0.4 + (1 - this.walkRippleLife) * 1.4;
      this.walkRipple.scale.set(s, s, s);
    }

    this.renderer.render(this.scene, this.camera);
  };
}
