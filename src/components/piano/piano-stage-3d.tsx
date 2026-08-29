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
  1: -16,
  2: -8,
  3: 1,
  4: 9,
  5: 16,
};

const KNUCKLE_Z: Record<Finger, number> = {
  1: 10,
  2: 2,
  3: 0,
  4: 3,
  5: 8,
};

const FINGER_LENGTHS: Record<Finger, number[]> = {
  1: [10, 8],
  2: [14, 11, 8],
  3: [16, 12, 9],
  4: [14, 11, 8],
  5: [11, 8, 7],
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
    pianistBody: THREE.Group;
    pianistTorso: THREE.Mesh;
    pianistHead: THREE.Group;
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
    scene.background = new THREE.Color(0x08090c);
    scene.fog = new THREE.FogExp2(0x08090c, 0.001);

    // Cinematic default camera angle: 3/4 Concert Side View
    const camera = new THREE.PerspectiveCamera(38, width / height, 1, 3000);
    camera.position.set(280, 160, 260);
    camera.lookAt(-20, 20, -10);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // 2. Concert Lighting
    const ambientLight = new THREE.AmbientLight(0xffeedd, 1.4);
    scene.add(ambientLight);

    const spotLight = new THREE.SpotLight(0xfffaed, 4.0, 1800, Math.PI / 3.8, 0.4, 1.2);
    spotLight.position.set(300, 480, 280);
    spotLight.target.position.set(0, 0, -40);
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 2048;
    spotLight.shadow.mapSize.height = 2048;
    spotLight.shadow.bias = -0.0002;
    scene.add(spotLight);
    scene.add(spotLight.target);

    const harpLight = new THREE.PointLight(0xffc860, 2.2, 700);
    harpLight.position.set(-80, 140, -180);
    scene.add(harpLight);

    const rimLight = new THREE.DirectionalLight(0x8fa8d6, 1.2);
    rimLight.position.set(-280, 200, -280);
    scene.add(rimLight);

    // 3. Concert Stage Floor
    const floorGeo = new THREE.PlaneGeometry(3000, 3000);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x24160e,
      roughness: 0.32,
      metalness: 0.15,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -95;
    floor.receiveShadow = true;
    scene.add(floor);

    // 4. Concert Grand Piano Group
    const pianoGroup = new THREE.Group();
    scene.add(pianoGroup);

    const blackLacquer = new THREE.MeshStandardMaterial({
      color: 0x090a0d,
      roughness: 0.1,
      metalness: 0.9,
    });

    const goldHarpMat = new THREE.MeshStandardMaterial({
      color: 0xe0a232,
      roughness: 0.22,
      metalness: 0.85,
    });

    const woodSoundboardMat = new THREE.MeshStandardMaterial({
      color: 0xb3763b,
      roughness: 0.45,
      metalness: 0.05,
    });

    const stringMat = new THREE.MeshStandardMaterial({
      color: 0xd0d0dc,
      roughness: 0.2,
      metalness: 0.95,
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
    const pianoRim = new THREE.Mesh(rimExtrude, blackLacquer);
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

    // Cast-Iron Golden Harp
    const harpPlateGeo = new THREE.BoxGeometry(560, 6, 320);
    const harpPlate = new THREE.Mesh(harpPlateGeo, goldHarpMat);
    harpPlate.position.set(-15, -8, -260);
    harpPlate.castShadow = true;
    pianoGroup.add(harpPlate);

    for (let i = 0; i < 6; i++) {
      const ribGeo = new THREE.CylinderGeometry(3.5, 4.5, 280 - i * 25, 12);
      ribGeo.rotateZ(Math.PI / 2);
      ribGeo.rotateY(0.24 + i * 0.08);
      const rib = new THREE.Mesh(ribGeo, goldHarpMat);
      rib.position.set(-120 + i * 46, -4, -160 - i * 35);
      rib.castShadow = true;
      pianoGroup.add(rib);
    }

    // Strings
    for (let s = 0; s < 36; s++) {
      const sx = -280 + s * 16;
      const sLen = 380 - Math.abs(s - 8) * 4;
      const strGeo = new THREE.CylinderGeometry(0.5, 0.5, sLen, 4);
      strGeo.rotateX(Math.PI / 2);
      const strMesh = new THREE.Mesh(strGeo, stringMat);
      strMesh.position.set(sx, -4, -25 - sLen / 2);
      pianoGroup.add(strMesh);
    }

    // Open Piano Lid (42 degrees)
    const lidGroup = new THREE.Group();
    lidGroup.position.set(-380, 8, -30);

    const lidGeo = new THREE.ShapeGeometry(rimShape);
    const lidMesh = new THREE.Mesh(lidGeo, blackLacquer);
    lidMesh.castShadow = true;
    lidMesh.position.set(380, 0, 0);
    lidGroup.add(lidMesh);

    lidGroup.rotation.y = -Math.PI / 2;
    lidGroup.rotation.x = -0.50;
    lidGroup.rotation.z = -Math.PI / 2;
    pianoGroup.add(lidGroup);

    // Lid Prop Stick
    const stickGeo = new THREE.CylinderGeometry(2.5, 2.5, 140, 10);
    const stickMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 });
    const stick = new THREE.Mesh(stickGeo, stickMat);
    stick.position.set(220, 58, -220);
    stick.rotation.z = 0.24;
    stick.rotation.x = 0.16;
    stick.castShadow = true;
    pianoGroup.add(stick);

    // Piano Legs
    const legGeo = new THREE.CylinderGeometry(11, 7, 95, 16);
    [[-340, -48, -40], [340, -48, -40], [-110, -48, -540]].forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(legGeo, blackLacquer);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      pianoGroup.add(leg);
    });

    // 88 Piano Keys
    const keysMap = new Map<number, { mesh: THREE.Mesh; initialY: number; isBlack: boolean }>();
    const whiteKeyGeo = new THREE.BoxGeometry(WHITE_KEY_W - 1.2, 14, WHITE_KEY_H);
    const blackKeyGeo = new THREE.BoxGeometry(BLACK_KEY_W - 1.0, 16, BLACK_KEY_H);

    const whiteKeyMat = new THREE.MeshStandardMaterial({
      color: 0xf8f8f6,
      roughness: 0.16,
      metalness: 0.04,
    });

    const blackKeyMat = new THREE.MeshStandardMaterial({
      color: 0x16181c,
      roughness: 0.22,
      metalness: 0.12,
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

    // 5. Elegant Pianist Avatar & Concert Bench
    const benchGeo = new THREE.BoxGeometry(280, 14, 100);
    const benchTop = new THREE.Mesh(benchGeo, blackLacquer);
    benchTop.position.set(0, -32, 130);
    benchTop.castShadow = true;
    pianoGroup.add(benchTop);

    const benchLegGeo = new THREE.CylinderGeometry(5, 4, 65, 12);
    [[-120, -64, 95], [120, -64, 95], [-120, -64, 165], [120, -64, 165]].forEach(([bx, by, bz]) => {
      const bLeg = new THREE.Mesh(benchLegGeo, blackLacquer);
      bLeg.position.set(bx, by, bz);
      bLeg.castShadow = true;
      pianoGroup.add(bLeg);
    });

    // Pianist Avatar
    const pianistBody = new THREE.Group();
    pianistBody.position.set(0, -26, 130);
    pianoGroup.add(pianistBody);

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf5d0b5,
      roughness: 0.5,
      metalness: 0.04,
    });

    const dressMat = new THREE.MeshStandardMaterial({
      color: 0xb53535, // Elegant concert rose dress
      roughness: 0.65,
      metalness: 0.06,
    });

    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x221811, // Dark glossy hair
      roughness: 0.45,
      metalness: 0.1,
    });

    // Torso & Dress
    const torsoGeo = new THREE.CylinderGeometry(11, 18, 58, 20);
    const pianistTorso = new THREE.Mesh(torsoGeo, dressMat);
    pianistTorso.position.set(0, 30, -2);
    pianistTorso.rotation.x = -0.12;
    pianistTorso.castShadow = true;
    pianistBody.add(pianistTorso);

    // Head & Hair
    const pianistHead = new THREE.Group();
    pianistHead.position.set(0, 66, -10);
    pianistBody.add(pianistHead);

    const headGeo = new THREE.SphereGeometry(9.5, 18, 16);
    headGeo.scale(1, 1.15, 1.05);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.castShadow = true;
    pianistHead.add(head);

    const hairGeo = new THREE.SphereGeometry(10.5, 18, 16);
    hairGeo.scale(1.04, 1.12, 1.15);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 3, -2);
    hair.castShadow = true;
    pianistHead.add(hair);

    // 6. Natural Hand Models (Arched Keyboard Hands)
    function createNaturalPianoHand(hand: "R" | "L") {
      const isRh = hand === "R";
      const handGroup = new THREE.Group();
      scene.add(handGroup);

      // Curved Palm
      const palmGeo = new THREE.SphereGeometry(1, 16, 14);
      palmGeo.scale(16, 5.5, 14);
      const palm = new THREE.Mesh(palmGeo, skinMat);
      palm.castShadow = true;
      palm.rotation.x = -0.18;
      handGroup.add(palm);

      // 5 Curved Fingers resting on keys
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
          const r = (3.0 - segIdx * 0.4) * (f === 1 ? 1.1 : f === 5 ? 0.85 : 1.0);
          const segGeo = new THREE.CylinderGeometry(r * 0.9, r, len, 10);
          segGeo.rotateX(Math.PI / 2 + 0.25 * segIdx); // Gentle curved arch
          const seg = new THREE.Mesh(segGeo, skinMat);
          seg.position.set(0, curY - len * 0.15, curZ - len * 0.45);
          seg.castShadow = true;
          fGroup.add(seg);

          curZ -= len * 0.85;
          curY -= len * 0.35;
        });

        // Touch Ring Accent
        const ringGeo = new THREE.TorusGeometry(3.2, 0.75, 8, 14);
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

    const rh = createNaturalPianoHand("R");
    const lh = createNaturalPianoHand("L");

    // 7. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 50;
    controls.maxDistance = 1200;
    controls.maxPolarAngle = Math.PI / 2 + 0.04;
    controls.target.set(-20, 15, -15);

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

  // Update Camera Angle Preset
  useEffect(() => {
    const s = stateRef.current;
    if (!s || viewAngle === "custom") return;

    if (viewAngle === "cinematic") {
      s.cameraTargetPos = new THREE.Vector3(280, 160, 260);
      s.controlsTargetPos = new THREE.Vector3(-20, 20, -10);
    } else if (viewAngle === "side") {
      s.cameraTargetPos = new THREE.Vector3(380, 100, 70);
      s.controlsTargetPos = new THREE.Vector3(-15, 15, -10);
    } else if (viewAngle === "player") {
      s.cameraTargetPos = new THREE.Vector3(0, 100, 175);
      s.controlsTargetPos = new THREE.Vector3(0, 0, -15);
    } else if (viewAngle === "top") {
      s.cameraTargetPos = new THREE.Vector3(0, 280, 30);
      s.controlsTargetPos = new THREE.Vector3(0, 0, -15);
    }
  }, [viewAngle]);

  // Frame Update: Animate Pianist, Hands, and Keys
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
        mat.color.setHex(kInfo.isBlack ? 0x16181c : 0xf8f8f6);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    });

    // 2. Pianist Sway
    const activeCenterX = (frame.right.palmX + frame.left.palmX) / 2 - centerOffset;
    const strikeMax = Math.max(frame.right.strikeImpact ?? 0, frame.left.strikeImpact ?? 0);

    s.pianistTorso.rotation.z = -activeCenterX * 0.0005;
    s.pianistTorso.rotation.x = -0.12 - strikeMax * 0.04;
    s.pianistHead.rotation.x = 0.08 + strikeMax * 0.08;
    s.pianistHead.rotation.y = activeCenterX * 0.0006;

    // 3. Hands Kinematics
    function updateHandPose(
      pose: HandFrame,
      handGroup: THREE.Group,
      fingerMap: Map<Finger, THREE.Group>,
    ) {
      const hand = pose.hand;
      const isRh = hand === "R";
      const targetPalmX = pose.palmX - centerOffset;
      const wristBounce = (pose.strikeImpact ?? 0) * 2.5;
      const palmZ = 20;
      const palmY = 10 - wristBounce;

      handGroup.position.set(targetPalmX, palmY, palmZ);
      handGroup.visible = pose.opacity > 0.05;

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
        fGroup.position.y = pressed ? -4 : 0;
        fGroup.rotation.x = pressed ? 0.2 : 0;
      });
    }

    updateHandPose(frame.right, s.rhGroup, s.rhFingers);
    updateHandPose(frame.left, s.lhGroup, s.lhFingers);

    // Subtle cinematic camera tracking
    if (viewAngle === "cinematic" && !s.cameraTargetPos) {
      s.camera.position.x += (280 + activeCenterX * 0.25 - s.camera.position.x) * 0.05;
      s.controls.target.x += (-20 + activeCenterX * 0.4 - s.controls.target.x) * 0.05;
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
        <span className="text-white/90 font-semibold">✨ 3D 콘서트 그랜드 피아노 & 피아니스트</span>
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
