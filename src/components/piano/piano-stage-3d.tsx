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
const KEY_3D_WHITE_W = 16;
const KEY_3D_BLACK_W = 9.6;
const KEY_3D_WHITE_H = 100;
const KEY_3D_BLACK_H = 64;

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

const TOTAL_88_WIDTH = 52 * KEY_3D_WHITE_W; // ~832
const CENTER_88_OFFSET = get3DKeyCenterX(60); // Centered at Middle C (C4)

const KNUCKLE_DX: Record<Finger, number> = {
  1: -13,
  2: -6,
  3: 1,
  4: 7,
  5: 13,
};

const KNUCKLE_Z: Record<Finger, number> = {
  1: 8,
  2: 2,
  3: 0,
  4: 2,
  5: 7,
};

const FINGER_SPECS: Record<Finger, { radius: number; lengths: [number, number, number] }> = {
  1: { radius: 2.5, lengths: [8, 7, 6] },
  2: { radius: 2.2, lengths: [11, 9, 7] },
  3: { radius: 2.3, lengths: [13, 10, 8] },
  4: { radius: 2.1, lengths: [11, 9, 7] },
  5: { radius: 1.8, lengths: [9, 7, 6] },
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
    scene.background = new THREE.Color(0x0c0e14); // Deep concert navy-black
    scene.fog = new THREE.FogExp2(0x0c0e14, 0.0007);

    // Camera: Grand Concert 3/4 Golden Angle
    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 3500);
    camera.position.set(280, 180, 260);
    camera.lookAt(-10, 15, -20);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);

    // 2. Concert Lighting
    const ambientLight = new THREE.AmbientLight(0xffeedd, 1.6);
    scene.add(ambientLight);

    const mainSpot = new THREE.SpotLight(0xfffaee, 3.8, 2200, Math.PI / 3.4, 0.45, 1.2);
    mainSpot.position.set(260, 480, 300);
    mainSpot.target.position.set(0, 0, -30);
    mainSpot.castShadow = true;
    mainSpot.shadow.mapSize.width = 2048;
    mainSpot.shadow.mapSize.height = 2048;
    mainSpot.shadow.bias = -0.0002;
    scene.add(mainSpot);
    scene.add(mainSpot.target);

    const harpGoldLight = new THREE.PointLight(0xffc244, 2.4, 700);
    harpGoldLight.position.set(-80, 130, -180);
    scene.add(harpGoldLight);

    const rimCoolLight = new THREE.DirectionalLight(0x8faee8, 1.4);
    rimCoolLight.position.set(-300, 220, -240);
    scene.add(rimCoolLight);

    // 3. Stage Floor
    const floorGeo = new THREE.PlaneGeometry(3500, 3500);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x181512,
      roughness: 0.36,
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
    const halfW = TOTAL_88_WIDTH / 2 + 35; // ~451
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

    // 5. Concert Bench Group
    const benchGeo = new THREE.BoxGeometry(300, 14, 85);
    const benchTop = new THREE.Mesh(benchGeo, blackGlossMat);
    benchTop.position.set(0, -32, 105);
    benchTop.castShadow = true;
    pianoGroup.add(benchTop);

    const benchLegGeo = new THREE.CylinderGeometry(4.5, 3.5, 65, 12);
    [[-120, -64, 75], [120, -64, 75], [-120, -64, 135], [120, -64, 135]].forEach(([bx, by, bz]) => {
      const bLeg = new THREE.Mesh(benchLegGeo, blackGlossMat);
      bLeg.position.set(bx, by, bz);
      bLeg.castShadow = true;
      pianoGroup.add(bLeg);
    });

    // 6. Natural Virtuoso 3D Hands on Keyboard
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xffe2d2,
      roughness: 0.48,
      metalness: 0.04,
    });

    function createVirtuosoPianoHand(hand: "R" | "L") {
      const isRh = hand === "R";
      const handGroup = new THREE.Group();
      scene.add(handGroup);

      // Curved Palm
      const palmGeo = new THREE.SphereGeometry(1, 16, 14);
      palmGeo.scale(14, 5.0, 12);
      const palm = new THREE.Mesh(palmGeo, skinMat);
      palm.castShadow = true;
      palm.rotation.x = -0.16;
      handGroup.add(palm);

      // 5 Arched Fingers
      const fingers = new Map<Finger, THREE.Group>();
      const fNums: Finger[] = [1, 2, 3, 4, 5];

      for (const f of fNums) {
        const fGroup = new THREE.Group();
        const spec = FINGER_SPECS[f];
        const kx = (isRh ? 1 : -1) * KNUCKLE_DX[f];
        const kz = KNUCKLE_Z[f];

        fGroup.position.set(kx, 1, -kz);

        let curZ = 0;
        let curY = 0;
        spec.lengths.forEach((len, segIdx) => {
          const r = (spec.radius - segIdx * 0.35);
          const segGeo = new THREE.CylinderGeometry(r * 0.85, r, len, 10);
          segGeo.rotateX(Math.PI / 2 + 0.25 * segIdx);
          const seg = new THREE.Mesh(segGeo, skinMat);
          seg.position.set(0, curY - len * 0.15, curZ - len * 0.45);
          seg.castShadow = true;
          fGroup.add(seg);

          curZ -= len * 0.85;
          curY -= len * 0.35;
        });

        // Touch Ring Glow Accent
        const ringGeo = new THREE.TorusGeometry(2.6, 0.65, 8, 14);
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

      return { handGroup, fingers };
    }

    const rh = createVirtuosoPianoHand("R");
    const lh = createVirtuosoPianoHand("L");

    // 7. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 40;
    controls.maxDistance = 1400;
    controls.maxPolarAngle = Math.PI / 2 + 0.04;
    controls.target.set(-10, 15, -20);

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
      s.cameraTargetPos = new THREE.Vector3(280, 180, 260);
      s.controlsTargetPos = new THREE.Vector3(-10, 15, -20);
    } else if (viewAngle === "side") {
      s.cameraTargetPos = new THREE.Vector3(380, 95, 60);
      s.controlsTargetPos = new THREE.Vector3(-10, 10, -20);
    } else if (viewAngle === "player") {
      s.cameraTargetPos = new THREE.Vector3(0, 110, 180);
      s.controlsTargetPos = new THREE.Vector3(0, 0, -20);
    } else if (viewAngle === "top") {
      s.cameraTargetPos = new THREE.Vector3(0, 320, 30);
      s.controlsTargetPos = new THREE.Vector3(0, 0, -20);
    }
  }, [viewAngle]);

  // Frame Update: Keys Animation & Hands Kinematics across 88 keys
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;

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
        mat.color.setHex(kInfo.isBlack ? 0x14161a : 0xfafaf8);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    });

    // 2. Hand Kinematics across 88 keys
    function updateHandPose(
      pose: HandFrame,
      handGroup: THREE.Group,
      fingerMap: Map<Finger, THREE.Group>,
    ) {
      const hand = pose.hand;
      const isRh = hand === "R";
      
      const anchors = pose.fingers.length
        ? pose.fingers
        : pose.restPitches.map((pitch, i) => ({ finger: ((i + 1) as Finger), pitch }));
      const homes = fingerHomePitches(hand, anchors);

      const palmPitch = homes[2] ?? (isRh ? 64 : 48);
      const targetPalmX = get3DKeyCenterX(palmPitch) - CENTER_88_OFFSET;

      const wristBounce = (pose.strikeImpact ?? 0) * 2.2;
      const palmZ = 20;
      const palmY = 9 - wristBounce;

      handGroup.position.set(targetPalmX, palmY, palmZ);
      handGroup.visible = pose.opacity > 0.05;

      const fNums: Finger[] = [1, 2, 3, 4, 5];
      fNums.forEach((f) => {
        const pressed = pose.fingers.find((p) => p.finger === f);
        const pitch = pressed ? pressed.pitch : homes[f - 1]!;
        const fTargetX = get3DKeyCenterX(pitch) - CENTER_88_OFFSET - targetPalmX;
        const defaultKx = (isRh ? 1 : -1) * KNUCKLE_DX[f];
        const kx = defaultKx + (fTargetX - defaultKx) * 0.3;

        const fGroup = fingerMap.get(f);
        if (!fGroup) return;

        fGroup.position.x = kx;
        fGroup.position.y = pressed ? -3.5 : 0;
        fGroup.rotation.x = pressed ? 0.18 : 0;
      });
    }

    updateHandPose(frame.right, s.rhGroup, s.rhFingers);
    updateHandPose(frame.left, s.lhGroup, s.lhFingers);

    // Gentle camera tracking to active playing hand region
    const activeRightPitch = frame.right.fingers[0]?.pitch ?? (frame.right.restPitches[2] ?? 60);
    const activeLeftPitch = frame.left.fingers[0]?.pitch ?? (frame.left.restPitches[2] ?? 48);
    const centerTargetX = (get3DKeyCenterX(activeRightPitch) + get3DKeyCenterX(activeLeftPitch)) / 2 - CENTER_88_OFFSET;

    if (viewAngle === "cinematic" && !s.cameraTargetPos) {
      s.camera.position.x += (280 + centerTargetX * 0.18 - s.camera.position.x) * 0.04;
      s.controls.target.x += (-10 + centerTargetX * 0.25 - s.controls.target.x) * 0.04;
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
          시네마틱
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
        <span className="text-white/90 font-semibold">✨ 88건반 콘서트 그랜드 피아노 & 피아노 연주</span>
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
