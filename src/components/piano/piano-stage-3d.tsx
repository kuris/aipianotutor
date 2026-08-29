import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Maximize2, Minimize2 } from "lucide-react";
import {
  fingerHomePitches,
  isBlackKey,
  isWhiteKey,
  type KeyRange,
} from "@/lib/piano/geometry";
import type { Finger, HandFrame, LessonFrame } from "@/lib/piano/types";

interface PianoStage3DProps {
  frame: LessonFrame;
  range: KeyRange;
}

// Full 88-Key Grand Piano Range (A0 = 21 to C8 = 108)
const PIANO_START_KEY = 21;
const PIANO_END_KEY = 108;

// 3D Concert Piano Dimensions
const KEY_3D_WHITE_W = 16.2;
const KEY_3D_BLACK_W = 9.8;
const KEY_3D_WHITE_H = 102;
const KEY_3D_BLACK_H = 65;

function get3DKeyCenterX(pitch: number): number {
  let whiteCount = 0;
  for (let p = PIANO_START_KEY; p < pitch; p++) {
    if (isWhiteKey(p)) whiteCount++;
  }
  if (isWhiteKey(pitch)) {
    return (whiteCount + 0.5) * KEY_3D_WHITE_W;
  }
  return whiteCount * KEY_3D_WHITE_W;
}

const TOTAL_88_WIDTH = 52 * KEY_3D_WHITE_W; // ~842.4
const CENTER_88_OFFSET = get3DKeyCenterX(60); // Centered at Middle C (C4)

const FINGER_SPECS: Record<Finger, { radius: number }> = {
  1: { radius: 2.8 },
  2: { radius: 2.4 },
  3: { radius: 2.5 },
  4: { radius: 2.3 },
  5: { radius: 2.0 },
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
    pianistBody: THREE.Group;
    rhArm: THREE.Mesh;
    lhArm: THREE.Mesh;
    rhForearm: THREE.Mesh;
    lhForearm: THREE.Mesh;
    rhPalm: THREE.Mesh;
    lhPalm: THREE.Mesh;
    rhFingers: Map<Finger, { base: THREE.Group; tip: THREE.Mesh; ring: THREE.Mesh }>;
    lhFingers: Map<Finger, { base: THREE.Group; tip: THREE.Mesh; ring: THREE.Mesh }>;
    cameraTargetPos?: THREE.Vector3;
    controlsTargetPos?: THREE.Vector3;
  } | null>(null);

  const [viewAngle, setViewAngle] = useState<"custom" | "cinematic" | "side" | "player" | "top">("cinematic");

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
    scene.background = new THREE.Color(0x0c0e14);
    scene.fog = new THREE.FogExp2(0x0c0e14, 0.0006);

    // Camera: Grand Concert Cinema 3/4 Perspective View
    const camera = new THREE.PerspectiveCamera(38, width / height, 1, 3500);
    camera.position.set(-180, 150, 240);
    camera.lookAt(10, 20, -10);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(0xffeedd, 1.8);
    scene.add(ambientLight);

    const mainSpot = new THREE.SpotLight(0xfffaee, 4.2, 2400, Math.PI / 3.4, 0.45, 1.2);
    mainSpot.position.set(220, 500, 300);
    mainSpot.target.position.set(0, 0, -30);
    mainSpot.castShadow = true;
    mainSpot.shadow.mapSize.width = 2048;
    mainSpot.shadow.mapSize.height = 2048;
    mainSpot.shadow.bias = -0.0002;
    scene.add(mainSpot);
    scene.add(mainSpot.target);

    const harpGoldLight = new THREE.PointLight(0xffc244, 2.6, 750);
    harpGoldLight.position.set(-80, 130, -180);
    scene.add(harpGoldLight);

    const rimCoolLight = new THREE.DirectionalLight(0x8faee8, 1.4);
    rimCoolLight.position.set(-280, 240, -220);
    scene.add(rimCoolLight);

    // 3. Stage Floor
    const floorGeo = new THREE.PlaneGeometry(3500, 3500);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x161311,
      roughness: 0.35,
      metalness: 0.15,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -95;
    floor.receiveShadow = true;
    scene.add(floor);

    // 4. Concert Grand Piano
    const pianoGroup = new THREE.Group();
    scene.add(pianoGroup);

    const blackGlossMat = new THREE.MeshStandardMaterial({
      color: 0x090a0d,
      roughness: 0.12,
      metalness: 0.88,
    });

    const goldHarpMat = new THREE.MeshStandardMaterial({
      color: 0xdea032,
      roughness: 0.2,
      metalness: 0.9,
    });

    const soundboardMat = new THREE.MeshStandardMaterial({
      color: 0xb57840,
      roughness: 0.45,
      metalness: 0.05,
    });

    const stringMat = new THREE.MeshStandardMaterial({
      color: 0xd8d8e6,
      roughness: 0.18,
      metalness: 0.95,
    });

    // Grand Piano Rim Shape
    const halfW = TOTAL_88_WIDTH / 2 + 35; // ~456
    const rimShape = new THREE.Shape();
    rimShape.moveTo(-halfW, 0);
    rimShape.lineTo(halfW, 0);
    rimShape.lineTo(halfW, -100);
    rimShape.bezierCurveTo(halfW, -360, halfW * 0.35, -650, -halfW * 0.35, -720);
    rimShape.bezierCurveTo(-halfW * 0.85, -690, -halfW, -500, -halfW, 0);

    const rimExtrude = new THREE.ExtrudeGeometry(rimShape, {
      depth: 90,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 3,
      bevelThickness: 3,
    });
    rimExtrude.rotateX(Math.PI / 2);
    const pianoRim = new THREE.Mesh(rimExtrude, blackGlossMat);
    pianoRim.position.set(0, 6, -30);
    pianoRim.castShadow = true;
    pianoRim.receiveShadow = true;
    pianoGroup.add(pianoRim);

    // Soundboard
    const soundboardGeo = new THREE.ShapeGeometry(rimShape);
    soundboardGeo.rotateX(Math.PI / 2);
    const soundboard = new THREE.Mesh(soundboardGeo, soundboardMat);
    soundboard.position.set(0, -12, -30);
    soundboard.receiveShadow = true;
    pianoGroup.add(soundboard);

    // Gold Cast-Iron Plate
    const harpPlateGeo = new THREE.BoxGeometry(halfW * 1.55, 6, 400);
    const harpPlate = new THREE.Mesh(harpPlateGeo, goldHarpMat);
    harpPlate.position.set(-15, -8, -300);
    pianoGroup.add(harpPlate);

    for (let i = 0; i < 6; i++) {
      const ribGeo = new THREE.CylinderGeometry(4.0, 5.0, 340 - i * 34, 12);
      ribGeo.rotateZ(Math.PI / 2);
      ribGeo.rotateY(0.24 + i * 0.08);
      const rib = new THREE.Mesh(ribGeo, goldHarpMat);
      rib.position.set(-halfW * 0.6 + i * 65, -4, -190 - i * 45);
      pianoGroup.add(rib);
    }

    // Strings
    for (let s = 0; s < 48; s++) {
      const sx = -halfW * 0.8 + s * 15.5;
      const sLen = 460 - Math.abs(s - 10) * 5;
      const strGeo = new THREE.CylinderGeometry(0.5, 0.5, sLen, 4);
      strGeo.rotateX(Math.PI / 2);
      const strMesh = new THREE.Mesh(strGeo, stringMat);
      strMesh.position.set(sx, -4, -25 - sLen / 2);
      pianoGroup.add(strMesh);
    }

    // Open Lid (45 degrees)
    const lidGroup = new THREE.Group();
    lidGroup.position.set(-halfW, 8, -30);
    const lidGeo = new THREE.ShapeGeometry(rimShape);
    const lidMesh = new THREE.Mesh(lidGeo, blackGlossMat);
    lidMesh.castShadow = true;
    lidMesh.position.set(halfW, 0, 0);
    lidGroup.add(lidMesh);
    lidGroup.rotation.y = -Math.PI / 2;
    lidGroup.rotation.x = -0.52;
    lidGroup.rotation.z = -Math.PI / 2;
    pianoGroup.add(lidGroup);

    // Music Desk (보면대)
    const musicDeskGeo = new THREE.BoxGeometry(320, 38, 6);
    const musicDesk = new THREE.Mesh(musicDeskGeo, blackGlossMat);
    musicDesk.position.set(0, 32, -45);
    musicDesk.rotation.x = -0.32;
    musicDesk.castShadow = true;
    pianoGroup.add(musicDesk);

    // Piano Legs
    const legGeo = new THREE.CylinderGeometry(11, 8, 95, 16);
    [[-halfW * 0.9, -48, -40], [halfW * 0.9, -48, -40], [-halfW * 0.3, -48, -640]].forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(legGeo, blackGlossMat);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      pianoGroup.add(leg);
    });

    // 88 Piano Keys (Complete A0 to C8)
    const keysMap = new Map<number, { mesh: THREE.Mesh; initialY: number; isBlack: boolean }>();
    const whiteKeyGeo = new THREE.BoxGeometry(KEY_3D_WHITE_W - 1.2, 14, KEY_3D_WHITE_H);
    const blackKeyGeo = new THREE.BoxGeometry(KEY_3D_BLACK_W - 1.0, 16, KEY_3D_BLACK_H);

    const whiteKeyMat = new THREE.MeshStandardMaterial({
      color: 0xfafaf8,
      roughness: 0.16,
      metalness: 0.04,
    });

    const blackKeyMat = new THREE.MeshStandardMaterial({
      color: 0x14161a,
      roughness: 0.22,
      metalness: 0.12,
    });

    for (let p = PIANO_START_KEY; p <= PIANO_END_KEY; p++) {
      const black = isBlackKey(p);
      const kx = get3DKeyCenterX(p) - CENTER_88_OFFSET;
      const ky = black ? 6.5 : 0;
      const kz = black ? -KEY_3D_BLACK_H / 2 + 10 : 0;

      const mesh = new THREE.Mesh(black ? blackKeyGeo : whiteKeyGeo, black ? blackKeyMat.clone() : whiteKeyMat.clone());
      mesh.position.set(kx, ky, kz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pianoGroup.add(mesh);
      keysMap.set(p, { mesh, initialY: ky, isBlack: black });
    }

    // 5. Concert Bench
    const benchGeo = new THREE.BoxGeometry(320, 14, 85);
    const benchTop = new THREE.Mesh(benchGeo, blackGlossMat);
    benchTop.position.set(0, -32, 115);
    benchTop.castShadow = true;
    pianoGroup.add(benchTop);

    const benchLegGeo = new THREE.CylinderGeometry(4.5, 3.5, 65, 12);
    [[-130, -64, 85], [130, -64, 85], [-130, -64, 145], [130, -64, 145]].forEach(([bx, by, bz]) => {
      const bLeg = new THREE.Mesh(benchLegGeo, blackGlossMat);
      bLeg.position.set(bx, by, bz);
      bLeg.castShadow = true;
      pianoGroup.add(bLeg);
    });

    // 6. Real-Time Synced Kinematic Pianist Body, Arms & Fingers
    const pianistBody = new THREE.Group();
    pianistBody.position.set(0, -25, 115);
    pianoGroup.add(pianistBody);

    const suitMat = new THREE.MeshStandardMaterial({
      color: 0x181a22,
      roughness: 0.65,
      metalness: 0.1,
    });

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xffe2d2,
      roughness: 0.48,
      metalness: 0.04,
    });

    // Torso / Back
    const torsoGeo = new THREE.BoxGeometry(72, 68, 38);
    const torso = new THREE.Mesh(torsoGeo, suitMat);
    torso.position.set(0, 36, 0);
    torso.castShadow = true;
    pianistBody.add(torso);

    // Collar
    const collarGeo = new THREE.BoxGeometry(24, 12, 10);
    const collarMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.position.set(0, 68, -14);
    pianistBody.add(collar);

    // Head & Hair
    const headGeo = new THREE.SphereGeometry(14, 18, 16);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 84, -4);
    head.castShadow = true;
    pianistBody.add(head);

    const hairGeo = new THREE.SphereGeometry(15.2, 18, 16);
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.7 });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 86, -2);
    hair.castShadow = true;
    pianistBody.add(hair);

    // Legs
    const legLeftGeo = new THREE.BoxGeometry(20, 16, 55);
    const legLeft = new THREE.Mesh(legLeftGeo, suitMat);
    legLeft.position.set(-20, -4, -18);
    legLeft.castShadow = true;
    pianistBody.add(legLeft);

    const legRightGeo = new THREE.BoxGeometry(20, 16, 55);
    const legRight = new THREE.Mesh(legRightGeo, suitMat);
    legRight.position.set(20, -4, -18);
    legRight.castShadow = true;
    pianistBody.add(legRight);

    // Dynamic Limbs (Upper Arm & Forearm)
    const armGeo = new THREE.CylinderGeometry(6.8, 8.2, 54, 12);
    const rhArm = new THREE.Mesh(armGeo, suitMat);
    rhArm.castShadow = true;
    scene.add(rhArm);

    const lhArm = new THREE.Mesh(armGeo, suitMat);
    lhArm.castShadow = true;
    scene.add(lhArm);

    const forearmGeo = new THREE.CylinderGeometry(5.8, 7.2, 58, 12);
    const rhForearm = new THREE.Mesh(forearmGeo, suitMat);
    rhForearm.castShadow = true;
    scene.add(rhForearm);

    const lhForearm = new THREE.Mesh(forearmGeo, suitMat);
    lhForearm.castShadow = true;
    scene.add(lhForearm);

    // Dynamic Hands & Fingers
    function createHandParts(hand: "R" | "L") {
      const isRh = hand === "R";
      const palmGeo = new THREE.SphereGeometry(1, 16, 14);
      palmGeo.scale(15, 5.2, 13);
      const palm = new THREE.Mesh(palmGeo, skinMat);
      palm.castShadow = true;
      scene.add(palm);

      const fingers = new Map<Finger, { base: THREE.Group; tip: THREE.Mesh; ring: THREE.Mesh }>();
      const fNums: Finger[] = [1, 2, 3, 4, 5];

      for (const f of fNums) {
        const base = new THREE.Group();
        scene.add(base);

        const spec = FINGER_SPECS[f];
        const segGeo = new THREE.CylinderGeometry(spec.radius * 0.8, spec.radius, 22, 10);
        segGeo.rotateX(Math.PI / 2 + 0.15);
        const seg = new THREE.Mesh(segGeo, skinMat);
        seg.position.set(0, -3, -10);
        seg.castShadow = true;
        base.add(seg);

        const tipGeo = new THREE.SphereGeometry(spec.radius * 0.9, 10, 10);
        const tip = new THREE.Mesh(tipGeo, skinMat);
        tip.position.set(0, -5, -20);
        tip.castShadow = true;
        base.add(tip);

        const ringGeo = new THREE.TorusGeometry(3.0, 0.7, 8, 14);
        ringGeo.rotateX(Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: isRh ? 0xff4d79 : 0x00c4e6,
          transparent: true,
          opacity: 0.95,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(0, -5, -20);
        base.add(ring);

        fingers.set(f, { base, tip, ring });
      }

      return { palm, fingers };
    }

    const rhParts = createHandParts("R");
    const lhParts = createHandParts("L");

    // 7. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 40;
    controls.maxDistance = 1400;
    controls.maxPolarAngle = Math.PI / 2 + 0.04;
    controls.target.set(10, 20, -10);

    controls.addEventListener("start", () => {
      setViewAngle("custom");
    });

    stateRef.current = {
      renderer,
      scene,
      camera,
      controls,
      keysMap,
      pianistBody,
      rhArm,
      lhArm,
      rhForearm,
      lhForearm,
      rhPalm: rhParts.palm,
      lhPalm: lhParts.palm,
      rhFingers: rhParts.fingers,
      lhFingers: lhParts.fingers,
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

    if (viewAngle === "cinematic") {
      s.cameraTargetPos = new THREE.Vector3(-180, 150, 240);
      s.controlsTargetPos = new THREE.Vector3(10, 20, -10);
    } else if (viewAngle === "side") {
      s.cameraTargetPos = new THREE.Vector3(-280, 100, 60);
      s.controlsTargetPos = new THREE.Vector3(0, 15, -20);
    } else if (viewAngle === "player") {
      s.cameraTargetPos = new THREE.Vector3(0, 120, 185);
      s.controlsTargetPos = new THREE.Vector3(0, 0, -20);
    } else if (viewAngle === "top") {
      s.cameraTargetPos = new THREE.Vector3(0, 320, 30);
      s.controlsTargetPos = new THREE.Vector3(0, 0, -20);
    }
  }, [viewAngle]);

  // Helper to orient and scale limb cylinder between two points
  function alignLimb(mesh: THREE.Mesh, p1: THREE.Vector3, p2: THREE.Vector3) {
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    mesh.position.copy(mid);

    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    mesh.scale.set(1, Math.max(0.1, len / 54), 1);

    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  }

  // Frame Update: Absolute Exact Synchronization of Keys, Hands and Limbs
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;

    // 1. Keys Animation: Exact physical stroke sync
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
        mat.emissiveIntensity = 0.6;
      } else {
        mat.color.setHex(kInfo.isBlack ? 0x14161a : 0xfafaf8);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    });

    // 2. Exact Finger Placement on 3D Key Coordinates
    function updateHandPose(
      pose: HandFrame,
      palmMesh: THREE.Mesh,
      fingerMap: Map<Finger, { base: THREE.Group; tip: THREE.Mesh; ring: THREE.Mesh }>,
    ) {
      const hand = pose.hand;
      const isRh = hand === "R";

      const anchors = pose.fingers.length
        ? pose.fingers
        : pose.restPitches.map((pitch, i) => ({ finger: ((i + 1) as Finger), pitch }));
      const homes = fingerHomePitches(hand, anchors);

      // Determine active target finger positions on exact 3D keys
      const fingerCoords: { f: Finger; x: number; y: number; z: number; pressed: boolean }[] = [];
      const fNums: Finger[] = [1, 2, 3, 4, 5];

      fNums.forEach((f) => {
        const pressedInfo = pose.fingers.find((p) => p.finger === f);
        const pitch = pressedInfo ? pressedInfo.pitch : homes[f - 1]!;
        const black = isBlackKey(pitch);

        const key3DX = get3DKeyCenterX(pitch) - CENTER_88_OFFSET;
        const key3DZ = black ? -KEY_3D_BLACK_H / 2 + 10 : -8;
        const key3DY = black ? (pressedInfo ? 2.5 : 7.0) : (pressedInfo ? -5.5 : 0.5);

        fingerCoords.push({ f, x: key3DX, y: key3DY, z: key3DZ, pressed: !!pressedInfo });
      });

      // Calculate Palm/Wrist position from finger span
      const avgX = fingerCoords.reduce((sum, c) => sum + c.x, 0) / 5;
      const wristBounce = (pose.strikeImpact ?? 0) * 2.5;
      const palmX = avgX;
      const palmY = 12 - wristBounce;
      const palmZ = 34;

      palmMesh.position.set(palmX, palmY, palmZ);
      palmMesh.visible = pose.opacity > 0.05;

      // Position each finger extending from palm to exact key
      fingerCoords.forEach(({ f, x, y, z, pressed }) => {
        const fObj = fingerMap.get(f);
        if (!fObj) return;

        fObj.base.position.set(x, y + 5, z + 20);
        fObj.base.rotation.x = pressed ? 0.28 : 0.08;
        fObj.ring.visible = pressed;
        fObj.base.visible = pose.opacity > 0.05;
      });

      return new THREE.Vector3(palmX, palmY, palmZ);
    }

    const rWrist = updateHandPose(frame.right, s.rhPalm, s.rhFingers);
    const lWrist = updateHandPose(frame.left, s.lhPalm, s.lhFingers);

    // 3. Body and Arm Kinematics connected from Shoulders to Wrists
    const avgPlayX = (rWrist.x + lWrist.x) / 2;
    s.pianistBody.position.x = avgPlayX * 0.35;

    const strikeMax = Math.max(frame.right.strikeImpact ?? 0, frame.left.strikeImpact ?? 0);
    s.pianistBody.rotation.z = -avgPlayX * 0.0003;
    s.pianistBody.rotation.x = -0.05 - strikeMax * 0.03;

    const bodyX = s.pianistBody.position.x;
    const rShoulder = new THREE.Vector3(bodyX + 28, 16, 115);
    const lShoulder = new THREE.Vector3(bodyX - 28, 16, 115);

    const rElbow = new THREE.Vector3().addVectors(rShoulder, rWrist).multiplyScalar(0.5).add(new THREE.Vector3(12, -8, 10));
    const lElbow = new THREE.Vector3().addVectors(lShoulder, lWrist).multiplyScalar(0.5).add(new THREE.Vector3(-12, -8, 10));

    alignLimb(s.rhArm, rShoulder, rElbow);
    alignLimb(s.lhArm, lShoulder, lElbow);
    alignLimb(s.rhForearm, rElbow, rWrist);
    alignLimb(s.lhForearm, lElbow, lWrist);

    // 4. Smooth Camera Tracking
    if (viewAngle === "cinematic" && !s.cameraTargetPos) {
      s.controls.target.x += (avgPlayX * 0.2 - s.controls.target.x) * 0.04;
    }
  }, [frame, range, viewAngle]);

  return (
    <div
      ref={rootRef}
      className={`relative flex h-full w-full flex-col overflow-hidden bg-card shadow-2xl transition-all ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none border-none" : "rounded-xl border border-border"
      }`}
    >
      {/* 3D Camera Angles & Controls Bar */}
      <div className="absolute top-3 right-4 z-20 flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/85 px-2.5 py-1.5 shadow-md backdrop-blur-md">
        <span className="text-[11px] font-semibold text-muted-foreground mr-1">🎥 카메라:</span>
        <button
          type="button"
          onClick={() => setViewAngle("cinematic")}
          className={`rounded px-2 py-1 text-xs transition-all ${
            viewAngle === "cinematic"
              ? "bg-primary text-primary-foreground font-bold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          ✨ 시네마틱
        </button>
        <button
          type="button"
          onClick={() => setViewAngle("side")}
          className={`rounded px-2 py-1 text-xs transition-all ${
            viewAngle === "side"
              ? "bg-primary text-primary-foreground font-bold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          사이드 뷰
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
        <span className="text-white/90 font-semibold">✨ 100% 실시간 타건 동기화 피아니스트 & 88 그랜드 피아노</span>
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
