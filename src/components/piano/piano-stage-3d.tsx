import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Maximize2, Minimize2 } from "lucide-react";
import {
  BLACK_KEY_H,
  BLACK_KEY_W,
  fingerHomePitches,
  isBlackKey,
  keyCenterX,
  WHITE_KEY_H,
  WHITE_KEY_W,
  type KeyRange,
} from "@/lib/piano/geometry";
import type { Finger, HandFrame, LessonFrame } from "@/lib/piano/types";

interface PianoStage3DProps {
  frame: LessonFrame;
  range: KeyRange;
}

const KNUCKLE_DX: Record<Finger, number> = {
  1: -14,
  2: -7,
  3: 1,
  4: 8,
  5: 14,
};

const KNUCKLE_Z: Record<Finger, number> = {
  1: 8,
  2: 2,
  3: 0,
  4: 2,
  5: 7,
};

const FINGER_LENGTHS: Record<Finger, number[]> = {
  1: [9, 7],
  2: [12, 10, 7],
  3: [14, 11, 8],
  4: [12, 10, 7],
  5: [10, 7, 6],
};

export function PianoStage3D({ frame, range }: PianoStage3DProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    keysMap: Map<number, { mesh: THREE.Mesh; initialY: number; isBlack: boolean }>;
    rhGroup: THREE.Group;
    lhGroup: THREE.Group;
    rhFingers: Map<Finger, THREE.Group>;
    lhFingers: Map<Finger, THREE.Group>;
    rhArm: THREE.Group;
    lhArm: THREE.Group;
    rhForearm: THREE.Mesh;
    lhForearm: THREE.Mesh;
    pianistBody: THREE.Group;
    pianistTorso: THREE.Group;
    pianistHead: THREE.Group;
    cameraTargetPos?: THREE.Vector3;
    controlsTargetPos?: THREE.Vector3;
  } | null>(null);

  const [viewAngle, setViewAngle] = useState<"custom" | "anime_side" | "cinematic" | "player" | "top">("anime_side");

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => {
        if (!containerRef.current || !stateRef.current) return;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        stateRef.current.camera.aspect = w / h;
        stateRef.current.camera.updateProjectionMatrix();
        stateRef.current.renderer.setSize(w, h);
      }, 50);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!rootRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await rootRef.current.requestFullscreen();
      } catch (e) {
        console.error("Fullscreen error:", e);
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch (e) {
        console.error("Exit fullscreen error:", e);
      }
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 900;
    const height = container.clientHeight || 480;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1e28); // Soft cinematic anime blue-gray
    scene.fog = new THREE.FogExp2(0x1a1e28, 0.0008);

    // Exact reference camera angle: Left 3/4 Anime Side Profile View
    const camera = new THREE.PerspectiveCamera(34, width / height, 1, 3000);
    camera.position.set(-165, 88, 145);
    camera.lookAt(40, 18, -15);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 2. Soft Anime Cinematic Lighting
    const ambientLight = new THREE.AmbientLight(0xf2e8e1, 1.6);
    scene.add(ambientLight);

    const keySpot = new THREE.SpotLight(0xfff6ea, 3.2, 1600, Math.PI / 3.5, 0.5, 1.2);
    keySpot.position.set(-120, 360, 240);
    keySpot.target.position.set(0, 10, -20);
    keySpot.castShadow = true;
    keySpot.shadow.mapSize.width = 2048;
    keySpot.shadow.mapSize.height = 2048;
    keySpot.shadow.bias = -0.0002;
    scene.add(keySpot);
    scene.add(keySpot.target);

    const rimLight = new THREE.DirectionalLight(0xaac2eb, 1.4);
    rimLight.position.set(240, 220, -180);
    scene.add(rimLight);

    const hairBackLight = new THREE.PointLight(0xffe8d6, 1.8, 500);
    hairBackLight.position.set(-80, 120, 180);
    scene.add(hairBackLight);

    // 3. Studio Stage Floor
    const floorGeo = new THREE.PlaneGeometry(3000, 3000);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1f242e,
      roughness: 0.4,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -95;
    floor.receiveShadow = true;
    scene.add(floor);

    // 4. Grand Piano Group (Satin Matte/Gloss Black)
    const pianoGroup = new THREE.Group();
    scene.add(pianoGroup);

    const blackPianoMat = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.22,
      metalness: 0.8,
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd69b2d,
      roughness: 0.25,
      metalness: 0.9,
    });

    const woodSoundboardMat = new THREE.MeshStandardMaterial({
      color: 0xb57840,
      roughness: 0.5,
      metalness: 0.05,
    });

    // Grand Piano Rim & Body
    const rimShape = new THREE.Shape();
    rimShape.moveTo(-380, 0);
    rimShape.lineTo(380, 0);
    rimShape.lineTo(380, -80);
    rimShape.bezierCurveTo(380, -320, 140, -560, -140, -600);
    rimShape.bezierCurveTo(-340, -580, -380, -420, -380, 0);

    const rimExtrude = new THREE.ExtrudeGeometry(rimShape, {
      depth: 85,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 3,
      bevelThickness: 3,
    });
    rimExtrude.rotateX(Math.PI / 2);
    const pianoRim = new THREE.Mesh(rimExtrude, blackPianoMat);
    pianoRim.position.set(0, 6, -30);
    pianoRim.castShadow = true;
    pianoRim.receiveShadow = true;
    pianoGroup.add(pianoRim);

    // Soundboard
    const soundboardGeo = new THREE.ShapeGeometry(rimShape);
    soundboardGeo.rotateX(Math.PI / 2);
    const soundboard = new THREE.Mesh(soundboardGeo, woodSoundboardMat);
    soundboard.position.set(0, -12, -30);
    soundboard.receiveShadow = true;
    pianoGroup.add(soundboard);

    // Golden Harp
    const harpPlateGeo = new THREE.BoxGeometry(540, 6, 300);
    const harpPlate = new THREE.Mesh(harpPlateGeo, goldMat);
    harpPlate.position.set(-15, -8, -260);
    pianoGroup.add(harpPlate);

    // Piano Music Desk (보면대)
    const musicDeskGeo = new THREE.BoxGeometry(260, 38, 6);
    const musicDesk = new THREE.Mesh(musicDeskGeo, blackPianoMat);
    musicDesk.position.set(0, 32, -45);
    musicDesk.rotation.x = -0.32;
    musicDesk.castShadow = true;
    pianoGroup.add(musicDesk);

    // Open Lid (45 degrees)
    const lidGroup = new THREE.Group();
    lidGroup.position.set(-380, 8, -30);
    const lidGeo = new THREE.ShapeGeometry(rimShape);
    const lidMesh = new THREE.Mesh(lidGeo, blackPianoMat);
    lidMesh.castShadow = true;
    lidMesh.position.set(380, 0, 0);
    lidGroup.add(lidMesh);
    lidGroup.rotation.y = -Math.PI / 2;
    lidGroup.rotation.x = -0.52;
    lidGroup.rotation.z = -Math.PI / 2;
    pianoGroup.add(lidGroup);

    // Piano Legs
    const legGeo = new THREE.CylinderGeometry(10, 7, 95, 16);
    [[-340, -48, -40], [340, -48, -40], [-110, -48, -540]].forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(legGeo, blackPianoMat);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      pianoGroup.add(leg);
    });

    // 88 Piano Keys
    const keysMap = new Map<number, { mesh: THREE.Mesh; initialY: number; isBlack: boolean }>();
    const whiteKeyGeo = new THREE.BoxGeometry(WHITE_KEY_W - 1.2, 14, WHITE_KEY_H);
    const blackKeyGeo = new THREE.BoxGeometry(BLACK_KEY_W - 1.0, 16, BLACK_KEY_H);

    const whiteKeyMat = new THREE.MeshStandardMaterial({
      color: 0xfbfbfa,
      roughness: 0.18,
      metalness: 0.04,
    });

    const blackKeyMat = new THREE.MeshStandardMaterial({
      color: 0x14161a,
      roughness: 0.25,
      metalness: 0.1,
    });

    const centerOffset = keyCenterX(60, range.start);

    for (let p = range.start; p <= range.end; p++) {
      const black = isBlackKey(p);
      const kx = keyCenterX(p, range.start) - centerOffset;
      const ky = black ? 6.5 : 0;
      const kz = black ? -BLACK_KEY_H / 2 + 10 : 0;

      const mesh = new THREE.Mesh(black ? blackKeyGeo : whiteKeyGeo, black ? blackKeyMat.clone() : whiteKeyMat.clone());
      mesh.position.set(kx, ky, kz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pianoGroup.add(mesh);
      keysMap.set(p, { mesh, initialY: ky, isBlack: black });
    }

    // 5. Anime School Girl Pianist (Silver Long Hair & Beige School Blazer)
    const benchGeo = new THREE.BoxGeometry(240, 14, 85);
    const benchTop = new THREE.Mesh(benchGeo, blackPianoMat);
    benchTop.position.set(0, -32, 105);
    benchTop.castShadow = true;
    pianoGroup.add(benchTop);

    const benchLegGeo = new THREE.CylinderGeometry(4.5, 3.5, 65, 12);
    [[-100, -64, 75], [100, -64, 75], [-100, -64, 135], [100, -64, 135]].forEach(([bx, by, bz]) => {
      const bLeg = new THREE.Mesh(benchLegGeo, blackPianoMat);
      bLeg.position.set(bx, by, bz);
      bLeg.castShadow = true;
      pianoGroup.add(bLeg);
    });

    // Pianist Character Group
    const pianistBody = new THREE.Group();
    pianistBody.position.set(0, -25, 105);
    pianoGroup.add(pianistBody);

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xffe6d8, // Fair anime skin
      roughness: 0.55,
      metalness: 0.02,
    });

    const silverHairMat = new THREE.MeshStandardMaterial({
      color: 0xe5eaf0, // Silver/Platinum hair
      roughness: 0.38,
      metalness: 0.12,
    });

    const blazerBeigeMat = new THREE.MeshStandardMaterial({
      color: 0xdfcca6, // School uniform beige blazer
      roughness: 0.7,
      metalness: 0.05,
    });

    const skirtNavyMat = new THREE.MeshStandardMaterial({
      color: 0x363842, // Charcoal pleated skirt
      roughness: 0.75,
      metalness: 0.05,
    });

    const socksMat = new THREE.MeshStandardMaterial({
      color: 0xf5f5f5,
      roughness: 0.6,
    });

    const shoesMat = new THREE.MeshStandardMaterial({
      color: 0x1f1b18,
      roughness: 0.3,
      metalness: 0.4,
    });

    // Seated Legs & Skirt
    const skirtGeo = new THREE.CylinderGeometry(14, 22, 24, 24);
    const skirt = new THREE.Mesh(skirtGeo, skirtNavyMat);
    skirt.position.set(0, 10, 0);
    skirt.castShadow = true;
    pianistBody.add(skirt);

    // Legs sitting forward
    const thighGeo = new THREE.CylinderGeometry(5.2, 4.6, 26, 14);
    thighGeo.rotateX(Math.PI / 2);
    const leftThigh = new THREE.Mesh(thighGeo, skinMat);
    leftThigh.position.set(-6.5, 4, -12);
    leftThigh.castShadow = true;
    pianistBody.add(leftThigh);

    const rightThigh = new THREE.Mesh(thighGeo, skinMat);
    rightThigh.position.set(6.5, 4, -12);
    rightThigh.castShadow = true;
    pianistBody.add(rightThigh);

    // Lower legs with white socks
    const calfGeo = new THREE.CylinderGeometry(4.2, 3.6, 30, 14);
    const leftCalf = new THREE.Mesh(calfGeo, socksMat);
    leftCalf.position.set(-6.5, -15, -24);
    leftCalf.castShadow = true;
    pianistBody.add(leftCalf);

    const rightCalf = new THREE.Mesh(calfGeo, socksMat);
    rightCalf.position.set(6.5, -15, -24);
    rightCalf.castShadow = true;
    pianistBody.add(rightCalf);

    // Shoes
    const shoeGeo = new THREE.BoxGeometry(6.5, 6, 14);
    const leftShoe = new THREE.Mesh(shoeGeo, shoesMat);
    leftShoe.position.set(-6.5, -31, -22);
    pianistBody.add(leftShoe);

    const rightShoe = new THREE.Mesh(shoeGeo, shoesMat);
    rightShoe.position.set(6.5, -31, -22);
    pianistBody.add(rightShoe);

    // Torso Group (Beige Blazer)
    const pianistTorso = new THREE.Group();
    pianistTorso.position.set(0, 22, 0);
    pianistBody.add(pianistTorso);

    const torsoGeo = new THREE.CylinderGeometry(11, 13.5, 36, 18);
    const torsoMesh = new THREE.Mesh(torsoGeo, blazerBeigeMat);
    torsoMesh.position.set(0, 18, 0);
    torsoMesh.rotation.x = -0.06; // slight lean forward to piano
    torsoMesh.castShadow = true;
    pianistTorso.add(torsoMesh);

    // Collar / Ribbon
    const ribbonGeo = new THREE.ConeGeometry(3.5, 7, 4);
    const ribbonMat = new THREE.MeshStandardMaterial({ color: 0x8a2c2c, roughness: 0.6 });
    const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbon.position.set(0, 31, -11.5);
    ribbon.rotation.x = Math.PI;
    pianistTorso.add(ribbon);

    // Head Group (Silver Anime Hair)
    const pianistHead = new THREE.Group();
    pianistHead.position.set(0, 42, -2);
    pianistTorso.add(pianistHead);

    const headGeo = new THREE.SphereGeometry(9.0, 18, 16);
    headGeo.scale(1, 1.15, 1.05);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.castShadow = true;
    pianistHead.add(head);

    // Silver Anime Hair Elements
    // Top Dome Hair
    const hairTopGeo = new THREE.SphereGeometry(10.2, 18, 16);
    hairTopGeo.scale(1.05, 1.12, 1.15);
    const hairTop = new THREE.Mesh(hairTopGeo, silverHairMat);
    hairTop.position.set(0, 3, -1);
    hairTop.castShadow = true;
    pianistHead.add(hairTop);

    // Front Bangs (Anime Fringe)
    const bangsGeo = new THREE.ConeGeometry(5, 12, 8);
    bangsGeo.rotateZ(0.1);
    const bangs = new THREE.Mesh(bangsGeo, silverHairMat);
    bangs.position.set(-2.5, 2, -9.5);
    bangs.rotation.x = 0.3;
    pianistHead.add(bangs);

    const bangs2 = new THREE.Mesh(bangsGeo, silverHairMat);
    bangs2.position.set(2.5, 2, -9.5);
    bangs2.rotation.x = 0.3;
    pianistHead.add(bangs2);

    // Long Flowing Side Locks (Left & Right)
    const sideLockGeo = new THREE.CylinderGeometry(2.0, 0.6, 38, 12);
    const leftSideLock = new THREE.Mesh(sideLockGeo, silverHairMat);
    leftSideLock.position.set(-8.5, -10, -5);
    leftSideLock.rotation.z = -0.12;
    leftSideLock.rotation.x = 0.15;
    leftSideLock.castShadow = true;
    pianistHead.add(leftSideLock);

    const rightSideLock = new THREE.Mesh(sideLockGeo, silverHairMat);
    rightSideLock.position.set(8.5, -10, -5);
    rightSideLock.rotation.z = 0.12;
    rightSideLock.rotation.x = 0.15;
    rightSideLock.castShadow = true;
    pianistHead.add(rightSideLock);

    // Long Flowing Back Hair (Down to waist)
    const backHairGeo = new THREE.CylinderGeometry(8.5, 12.0, 48, 16);
    const backHair = new THREE.Mesh(backHairGeo, silverHairMat);
    backHair.position.set(0, -14, 5.5);
    backHair.rotation.x = -0.15;
    backHair.castShadow = true;
    pianistHead.add(backHair);

    // 6. Arms with Beige Blazer Sleeves & Natural Pianist Hands
    function createAnimePianistArm(hand: "R" | "L") {
      const isRh = hand === "R";
      const armGroup = new THREE.Group();
      scene.add(armGroup);

      // Upper arm sleeve from shoulder
      const shoulderX = isRh ? 15 : -15;
      const upperArmGeo = new THREE.CylinderGeometry(4.2, 3.8, 30, 12);
      upperArmGeo.rotateX(Math.PI / 3.2);
      const upperArm = new THREE.Mesh(upperArmGeo, blazerBeigeMat);
      upperArm.position.set(shoulderX, 30, 90);
      upperArm.castShadow = true;
      armGroup.add(upperArm);

      // Forearm sleeve reaching to keys
      const forearmGeo = new THREE.CylinderGeometry(3.6, 3.2, 36, 12);
      forearmGeo.rotateX(Math.PI / 2.2);
      const forearm = new THREE.Mesh(forearmGeo, blazerBeigeMat);
      forearm.position.set(shoulderX * 0.7, 16, 50);
      forearm.castShadow = true;
      armGroup.add(forearm);

      // Hand Group (Palm & Fingers)
      const handGroup = new THREE.Group();
      scene.add(handGroup);

      // Curved Palm
      const palmGeo = new THREE.SphereGeometry(1, 14, 12);
      palmGeo.scale(13, 4.8, 12);
      const palm = new THREE.Mesh(palmGeo, skinMat);
      palm.castShadow = true;
      palm.rotation.x = -0.16;
      handGroup.add(palm);

      // 5 Curved Fingers
      const fingers = new Map<Finger, THREE.Group>();
      const fNums: Finger[] = [1, 2, 3, 4, 5];

      for (const f of fNums) {
        const fGroup = new THREE.Group();
        const lens = FINGER_LENGTHS[f];
        const kx = (isRh ? 1 : -1) * KNUCKLE_DX[f];
        const kz = KNUCKLE_Z[f];

        fGroup.position.set(kx, 1, -kz);

        let curZ = 0;
        let curY = 0;
        lens.forEach((len, segIdx) => {
          const r = (2.4 - segIdx * 0.3) * (f === 1 ? 1.1 : f === 5 ? 0.85 : 1.0);
          const segGeo = new THREE.CylinderGeometry(r * 0.85, r, len, 10);
          segGeo.rotateX(Math.PI / 2 + 0.26 * segIdx);
          const seg = new THREE.Mesh(segGeo, skinMat);
          seg.position.set(0, curY - len * 0.15, curZ - len * 0.45);
          seg.castShadow = true;
          fGroup.add(seg);

          curZ -= len * 0.85;
          curY -= len * 0.35;
        });

        // Touch Ring Accent
        const ringGeo = new THREE.TorusGeometry(2.6, 0.6, 8, 14);
        ringGeo.rotateX(Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: isRh ? 0xff4d79 : 0x00c4e6,
          transparent: true,
          opacity: 0.9,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(0, curY, curZ);
        fGroup.add(ring);

        handGroup.add(fGroup);
        fingers.set(f, fGroup);
      }

      return { armGroup, forearm, handGroup, fingers };
    }

    const rh = createAnimePianistArm("R");
    const lh = createAnimePianistArm("L");

    // 7. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 40;
    controls.maxDistance = 1200;
    controls.maxPolarAngle = Math.PI / 2 + 0.04;
    controls.target.set(40, 18, -15);

    controls.addEventListener("start", () => {
      setViewAngle("custom");
    });

    stateRef.current = {
      renderer,
      scene,
      camera,
      controls,
      keysMap,
      rhGroup: rh.handGroup,
      lhGroup: lh.handGroup,
      rhFingers: rh.fingers,
      lhFingers: lh.fingers,
      rhArm: rh.armGroup,
      lhArm: lh.armGroup,
      rhForearm: rh.forearm,
      lhForearm: lh.forearm,
      pianistBody,
      pianistTorso,
      pianistHead,
    };

    // Resize Handler
    const handleResize = () => {
      if (!container || !stateRef.current) return;
      const w = container.clientWidth || 900;
      const h = container.clientHeight || 480;
      stateRef.current.camera.aspect = w / h;
      stateRef.current.camera.updateProjectionMatrix();
      stateRef.current.renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      const s = stateRef.current;
      if (s) {
        if (s.cameraTargetPos) {
          s.camera.position.lerp(s.cameraTargetPos, 0.08);
          if (s.camera.position.distanceTo(s.cameraTargetPos) < 1) {
            s.cameraTargetPos = undefined;
          }
        }
        if (s.controlsTargetPos) {
          s.controls.target.lerp(s.controlsTargetPos, 0.08);
          if (s.controls.target.distanceTo(s.controlsTargetPos) < 1) {
            s.controlsTargetPos = undefined;
          }
        }
        s.controls.update();
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Camera Angle Presets
  useEffect(() => {
    const s = stateRef.current;
    if (!s || viewAngle === "custom") return;

    if (viewAngle === "anime_side") {
      // Exact reference shot: Left side profile anime girl
      s.cameraTargetPos = new THREE.Vector3(-165, 88, 145);
      s.controlsTargetPos = new THREE.Vector3(40, 18, -15);
    } else if (viewAngle === "cinematic") {
      s.cameraTargetPos = new THREE.Vector3(260, 150, 240);
      s.controlsTargetPos = new THREE.Vector3(-20, 20, -10);
    } else if (viewAngle === "player") {
      s.cameraTargetPos = new THREE.Vector3(0, 95, 160);
      s.controlsTargetPos = new THREE.Vector3(0, 0, -15);
    } else if (viewAngle === "top") {
      s.cameraTargetPos = new THREE.Vector3(0, 260, 30);
      s.controlsTargetPos = new THREE.Vector3(0, 0, -15);
    }
  }, [viewAngle]);

  // Frame Update: Kinematics of Pianist, Arms, Hands and Keys
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;

    const centerOffset = keyCenterX(60, range.start);

    // 1. Keys Animation
    const activePitches = new Map(frame.active.map((n) => [n.pitch, n.hand]));

    s.keysMap.forEach((kInfo, pitch) => {
      const activeHand = activePitches.get(pitch);
      const isPressed = !!activeHand;
      const pressOffset = isPressed ? (kInfo.isBlack ? 4.5 : 6.0) : 0;

      kInfo.mesh.position.y = kInfo.initialY - pressOffset;

      const mat = kInfo.mesh.material as THREE.MeshStandardMaterial;
      if (isPressed) {
        mat.color.setHex(activeHand === "R" ? 0xff4d79 : 0x00c4e6);
        mat.emissive.setHex(activeHand === "R" ? 0x991133 : 0x005577);
        mat.emissiveIntensity = 0.55;
      } else {
        mat.color.setHex(kInfo.isBlack ? 0x14161a : 0xfbfbfa);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    });

    // 2. Anime Pianist Natural Sway
    const activeCenterX = (frame.right.palmX + frame.left.palmX) / 2 - centerOffset;
    const strikeMax = Math.max(frame.right.strikeImpact ?? 0, frame.left.strikeImpact ?? 0);

    s.pianistTorso.rotation.z = -activeCenterX * 0.0006;
    s.pianistTorso.rotation.x = -0.06 - strikeMax * 0.03;
    s.pianistHead.rotation.x = 0.06 + strikeMax * 0.06;
    s.pianistHead.rotation.y = activeCenterX * 0.0005;

    // 3. Hand & Arm Kinematics
    function updateHandPose(
      pose: HandFrame,
      handGroup: THREE.Group,
      fingerMap: Map<Finger, THREE.Group>,
      armGroup: THREE.Group,
      forearm: THREE.Mesh,
    ) {
      const hand = pose.hand;
      const isRh = hand === "R";
      const targetPalmX = pose.palmX - centerOffset;
      const wristBounce = (pose.strikeImpact ?? 0) * 2.2;
      const palmZ = 20;
      const palmY = 9 - wristBounce;

      handGroup.position.set(targetPalmX, palmY, palmZ);
      handGroup.visible = pose.opacity > 0.05;
      armGroup.visible = pose.opacity > 0.05;

      // Forearm sleeve tracks to hand palm position
      const shoulderX = isRh ? 15 : -15;
      forearm.position.x = (shoulderX + targetPalmX) / 2;
      forearm.position.y = 12 - wristBounce * 0.5;

      const anchors = pose.fingers.length
        ? pose.fingers
        : pose.restPitches.map((pitch, i) => ({ finger: ((i + 1) as Finger), pitch }));
      const homes = fingerHomePitches(hand, anchors);

      const fNums: Finger[] = [1, 2, 3, 4, 5];
      fNums.forEach((f) => {
        const pressed = pose.fingers.find((p) => p.finger === f);
        const pitch = pressed ? pressed.pitch : homes[f - 1]!;
        const fTargetX = keyCenterX(pitch, range.start) - centerOffset - targetPalmX;
        const defaultKx = (isRh ? 1 : -1) * KNUCKLE_DX[f];
        const kx = defaultKx + (fTargetX - defaultKx) * 0.25;

        const fGroup = fingerMap.get(f);
        if (!fGroup) return;

        fGroup.position.x = kx;
        fGroup.position.y = pressed ? -3.5 : 0;
        fGroup.rotation.x = pressed ? 0.18 : 0;
      });
    }

    updateHandPose(frame.right, s.rhGroup, s.rhFingers, s.rhArm, s.rhForearm);
    updateHandPose(frame.left, s.lhGroup, s.lhFingers, s.lhArm, s.lhForearm);

    // Subtle gentle camera focus
    if (viewAngle === "anime_side" && !s.cameraTargetPos) {
      s.controls.target.x += (40 + activeCenterX * 0.15 - s.controls.target.x) * 0.04;
    }
  }, [frame, range, viewAngle]);

  return (
    <div
      ref={rootRef}
      className={`relative flex h-full w-full flex-col overflow-hidden bg-card shadow-2xl transition-all ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none border-none" : "rounded-xl border border-border"
      }`}
    >
      {/* 3D Camera Angles Bar */}
      <div className="absolute top-3 right-4 z-20 flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/85 px-2.5 py-1.5 shadow-md backdrop-blur-md">
        <span className="text-[11px] font-semibold text-muted-foreground mr-1">🎥 시점:</span>
        <button
          type="button"
          onClick={() => setViewAngle("anime_side")}
          className={`rounded px-2 py-1 text-xs transition-all ${
            viewAngle === "anime_side"
              ? "bg-primary text-primary-foreground font-bold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          ✨ 애니메 측면
        </button>
        <button
          type="button"
          onClick={() => setViewAngle("cinematic")}
          className={`rounded px-2 py-1 text-xs transition-all ${
            viewAngle === "cinematic"
              ? "bg-primary text-primary-foreground font-bold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          시네마틱
        </button>
        <button
          type="button"
          onClick={() => setViewAngle("player")}
          className={`rounded px-2 py-1 text-xs transition-all ${
            viewAngle === "player"
              ? "bg-primary text-primary-foreground font-bold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          연주자
        </button>
        <button
          type="button"
          onClick={() => setViewAngle("top")}
          className={`rounded px-2 py-1 text-xs transition-all ${
            viewAngle === "top"
              ? "bg-primary text-primary-foreground font-bold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          탑다운
        </button>
        {viewAngle === "custom" && (
          <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-semibold">
            자유 시점
          </span>
        )}

        <div className="mx-1 h-3.5 w-px bg-border" />

        {/* Fullscreen Toggle Button */}
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? "창 모드로 복귀 (ESC)" : "3D 피아노 전체 화면"}
          className="flex items-center gap-1 rounded bg-muted/60 hover:bg-muted px-2 py-1 text-xs font-semibold text-foreground transition-all"
        >
          {isFullscreen ? (
            <>
              <Minimize2 className="size-3.5 text-amber-400" />
              <span>창 모드</span>
            </>
          ) : (
            <>
              <Maximize2 className="size-3.5 text-neutral-300" />
              <span>전체 화면</span>
            </>
          )}
        </button>
      </div>

      <div className="pointer-events-none absolute top-3 left-4 z-10 flex flex-col gap-0.5 text-[11px] font-medium tracking-wide text-muted-foreground">
        <span className="text-white/90 font-semibold">✨ 피아니스트 연주 & 그랜드 피아노</span>
        <span className="text-[10px] text-neutral-400">
          🖱️ 마우스 드래그: 360° 회전 · 휠: 확대/축소 · 우클릭: 이동
        </span>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-4 z-10 text-[11px] font-semibold tracking-wide text-lh">
        왼손 (Cyan)
      </div>
      <div className="pointer-events-none absolute right-4 bottom-3 z-10 text-[11px] font-semibold tracking-wide text-rh">
        오른손 (Coral)
      </div>

      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="h-full w-full min-h-[300px] lg:min-h-[440px] cursor-grab active:cursor-grabbing" />
    </div>
  );
}
