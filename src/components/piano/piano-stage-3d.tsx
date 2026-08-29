import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  BLACK_KEY_H,
  BLACK_KEY_W,
  fingerHomePitches,
  isBlackKey,
  isWhiteKey,
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

const KNUCKLE_REST_DX: Record<Finger, number> = {
  1: -30,
  2: -14,
  3: 2,
  4: 17,
  5: 30,
};

const KNUC_UP: Record<Finger, number> = {
  1: 14,
  2: 26,
  3: 31,
  4: 26,
  5: 20,
};

const FINGER_SPECS: Record<Finger, { radius: number; lengths: [number, number, number] }> = {
  1: { radius: 3.4, lengths: [14, 12, 10] },
  2: { radius: 2.9, lengths: [18, 14, 11] },
  3: { radius: 3.0, lengths: [20, 15, 12] },
  4: { radius: 2.8, lengths: [18, 14, 11] },
  5: { radius: 2.5, lengths: [15, 11, 9] },
};

export function PianoStage3D({ frame, range }: PianoStage3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    keysMap: Map<number, { mesh: THREE.Mesh; initialY: number; isBlack: boolean }>;
    rhGroup: THREE.Group;
    lhGroup: THREE.Group;
    rhFingers: Map<Finger, THREE.Group>;
    lhFingers: Map<Finger, THREE.Group>;
    rhPalm: THREE.Mesh;
    lhPalm: THREE.Mesh;
    rhWrist: THREE.Mesh;
    lhWrist: THREE.Mesh;
    labels: THREE.Group;
  } | null>(null);

  const [viewAngle, setViewAngle] = useState<"player" | "top" | "angled">("angled");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 400;

    // Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f141c);
    scene.fog = new THREE.FogExp2(0x0f141c, 0.0012);

    const camera = new THREE.PerspectiveCamera(42, width / height, 1, 3000);
    camera.position.set(0, 220, 320);
    camera.lookAt(0, -10, 40);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xfff5ea, 2.2);
    mainLight.position.set(100, 350, 200);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.bias = -0.0005;
    scene.add(mainLight);

    const rimLight = new THREE.DirectionalLight(0x7090ff, 1.2);
    rimLight.position.set(-200, 180, -150);
    scene.add(rimLight);

    const warmLight = new THREE.PointLight(0xffaa66, 1.4, 600);
    warmLight.position.set(0, 120, 100);
    scene.add(warmLight);

    // Materials
    const whiteKeyMat = new THREE.MeshStandardMaterial({
      color: 0xfaf8f5,
      roughness: 0.22,
      metalness: 0.05,
    });

    const blackKeyMat = new THREE.MeshStandardMaterial({
      color: 0x14161a,
      roughness: 0.35,
      metalness: 0.15,
    });

    const rhSkinMat = new THREE.MeshStandardMaterial({
      color: 0xf5d0b5,
      roughness: 0.55,
      metalness: 0.05,
    });

    const lhSkinMat = new THREE.MeshStandardMaterial({
      color: 0xecd0b9,
      roughness: 0.55,
      metalness: 0.05,
    });

    // Piano Bed Base
    const bedGeo = new THREE.BoxGeometry(2000, 18, 220);
    const bedMat = new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.6 });
    const bed = new THREE.Mesh(bedGeo, bedMat);
    bed.position.set(0, -14, 20);
    bed.receiveShadow = true;
    scene.add(bed);

    // Fallboard (Red felt strip + back wall)
    const feltGeo = new THREE.BoxGeometry(2000, 4, 12);
    const feltMat = new THREE.MeshStandardMaterial({ color: 0xb81424, roughness: 0.8 });
    const felt = new THREE.Mesh(feltGeo, feltMat);
    felt.position.set(0, 2, -68);
    scene.add(felt);

    const fallboardGeo = new THREE.BoxGeometry(2000, 60, 20);
    const fallboardMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.15 });
    const fallboard = new THREE.Mesh(fallboardGeo, fallboardMat);
    fallboard.position.set(0, 32, -82);
    scene.add(fallboard);

    // Build 88 Keys (or range keys)
    const keysMap = new Map<number, { mesh: THREE.Mesh; initialY: number; isBlack: boolean }>();
    const whiteGeo = new THREE.BoxGeometry(WHITE_KEY_W - 1.2, 14, WHITE_KEY_H);
    const blackGeo = new THREE.BoxGeometry(BLACK_KEY_W - 0.8, 22, BLACK_KEY_H);

    for (let p = 21; p <= 108; p++) {
      const isBlack = isBlackKey(p);
      const kx = keyCenterX(p, range.start) - keyCenterX(60, range.start); // Center around Middle C
      const ky = isBlack ? 6 : 0;
      const kz = isBlack ? -22 : 0;

      const mesh = new THREE.Mesh(isBlack ? blackGeo : whiteGeo, isBlack ? blackKeyMat.clone() : whiteKeyMat.clone());
      mesh.position.set(kx, ky, kz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      keysMap.set(p, { mesh, initialY: ky, isBlack });
    }

    // Helper: Create 3D Organic Hand
    function create3DHand(hand: "R" | "L") {
      const group = new THREE.Group();

      // Palm (Ellipsoid)
      const palmGeo = new THREE.SphereGeometry(1, 24, 16);
      palmGeo.scale(32, 12, 34);
      const palm = new THREE.Mesh(palmGeo, hand === "R" ? rhSkinMat : lhSkinMat);
      palm.castShadow = true;
      palm.receiveShadow = true;
      group.add(palm);

      // Wrist
      const wristGeo = new THREE.CylinderGeometry(15, 17, 42, 20);
      wristGeo.rotateX(Math.PI / 2);
      const wrist = new THREE.Mesh(wristGeo, hand === "R" ? rhSkinMat : lhSkinMat);
      wrist.position.set(0, -4, 40);
      wrist.castShadow = true;
      group.add(wrist);

      // 5 Fingers
      const fingers = new Map<Finger, THREE.Group>();
      const fNums: Finger[] = [1, 2, 3, 4, 5];

      for (const f of fNums) {
        const fGroup = new THREE.Group();
        const spec = FINGER_SPECS[f];

        // 3 Phalanges (Proximal, Middle, Distal)
        let curZ = 0;
        spec.lengths.forEach((len, segIdx) => {
          const r = spec.radius * (1 - segIdx * 0.12);
          const segGeo = new THREE.CylinderGeometry(r * 0.9, r, len, 16);
          segGeo.rotateX(Math.PI / 2);
          const seg = new THREE.Mesh(segGeo, hand === "R" ? rhSkinMat : lhSkinMat);
          seg.position.set(0, 0, curZ - len / 2);
          seg.castShadow = true;
          fGroup.add(seg);

          // Knuckle joint sphere
          const jointGeo = new THREE.SphereGeometry(r * 1.05, 14, 14);
          const joint = new THREE.Mesh(jointGeo, hand === "R" ? rhSkinMat : lhSkinMat);
          joint.position.set(0, 0, curZ);
          fGroup.add(joint);

          curZ -= len;
        });

        // Tip Cap & Ring Badge
        const tipGeo = new THREE.SphereGeometry(spec.radius * 0.85, 16, 16);
        const tipMesh = new THREE.Mesh(
          tipGeo,
          new THREE.MeshStandardMaterial({
            color: hand === "R" ? 0xff4d79 : 0x00c4e6,
            emissive: hand === "R" ? 0x991133 : 0x005577,
            emissiveIntensity: 0.4,
            roughness: 0.3,
          }),
        );
        tipMesh.position.set(0, 0, curZ);
        fGroup.add(tipMesh);

        group.add(fGroup);
        fingers.set(f, fGroup);
      }

      scene.add(group);
      return { group, palm, wrist, fingers };
    }

    const rh = create3DHand("R");
    const lh = create3DHand("L");

    const labels = new THREE.Group();
    scene.add(labels);

    stateRef.current = {
      renderer,
      scene,
      camera,
      keysMap,
      rhGroup: rh.group,
      lhGroup: lh.group,
      rhFingers: rh.fingers,
      lhFingers: lh.fingers,
      rhPalm: rh.palm,
      lhPalm: lh.palm,
      rhWrist: rh.wrist,
      lhWrist: lh.wrist,
      labels,
    };

    // Resize handler
    const handleResize = () => {
      if (!container || !stateRef.current) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 400;
      stateRef.current.camera.aspect = w / h;
      stateRef.current.camera.updateProjectionMatrix();
      stateRef.current.renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Camera Angle Preset
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    if (viewAngle === "player") {
      s.camera.position.set(0, 190, 240);
      s.camera.lookAt(0, -15, 10);
    } else if (viewAngle === "top") {
      s.camera.position.set(0, 360, 40);
      s.camera.lookAt(0, 0, -10);
    } else {
      // angled
      s.camera.position.set(0, 240, 300);
      s.camera.lookAt(0, -10, 30);
    }
  }, [viewAngle]);

  // Update Hands & Keys on Frame
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;

    const centerOffset = keyCenterX(60, range.start);

    // 1. Update Keyboard Keys press depths & colors
    const activePitches = new Map(frame.active.map((n) => [n.pitch, n.hand]));

    s.keysMap.forEach((kInfo, pitch) => {
      const activeHand = activePitches.get(pitch);
      const isPressed = !!activeHand;
      const pressOffset = isPressed ? (kInfo.isBlack ? 5.5 : 7.5) : 0;

      kInfo.mesh.position.y = kInfo.initialY - pressOffset;

      const mat = kInfo.mesh.material as THREE.MeshStandardMaterial;
      if (isPressed) {
        mat.color.setHex(activeHand === "R" ? 0xff4d79 : 0x00c4e6);
        mat.emissive.setHex(activeHand === "R" ? 0x661122 : 0x003355);
        mat.emissiveIntensity = 0.5;
      } else {
        mat.color.setHex(kInfo.isBlack ? 0x14161a : 0xfaf8f5);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    });

    // 2. Update Hand Poses
    function updateHandPose(
      pose: HandFrame,
      group: THREE.Group,
      palmMesh: THREE.Mesh,
      wristMesh: THREE.Mesh,
      fingerMap: Map<Finger, THREE.Group>,
    ) {
      const hand = pose.hand;
      const isRh = hand === "R";
      const targetPalmX = pose.palmX - centerOffset;
      const wristBounce = (pose.strikeImpact ?? 0) * 3.5;
      const palmZ = isRh ? 75 : 85;
      const palmY = 22 - wristBounce;

      group.position.set(targetPalmX, palmY, palmZ);
      group.visible = pose.opacity > 0.05;

      const anchors = pose.fingers.length
        ? pose.fingers
        : pose.restPitches.map((pitch, i) => ({ finger: ((i + 1) as Finger), pitch }));
      const homes = fingerHomePitches(hand, anchors);

      const fNums: Finger[] = [1, 2, 3, 4, 5];
      fNums.forEach((f) => {
        const pressed = pose.fingers.find((p) => p.finger === f);
        const pitch = pressed ? pressed.pitch : homes[f - 1]!;
        const fTargetX = keyCenterX(pitch, range.start) - centerOffset - targetPalmX;
        const defaultKx = (isRh ? 1 : -1) * KNUCKLE_REST_DX[f];
        const kx = defaultKx + (fTargetX - defaultKx) * 0.3;
        const ky = -KNUC_UP[f] * 0.15;
        const kz = -KNUC_UP[f] * 0.6;

        const fGroup = fingerMap.get(f);
        if (!fGroup) return;

        fGroup.position.set(kx, ky, kz);

        // Angle finger towards key target
        const black = isBlackKey(pitch);
        const targetTipZ = (black ? -22 : 0) - palmZ - kz;
        const targetTipY = (pressed ? -8 : 6) - palmY - ky;
        const dx = fTargetX - kx;
        const dz = targetTipZ;

        const yaw = Math.atan2(dx, -dz);
        const pitchAngle = Math.atan2(targetTipY, -dz);

        fGroup.rotation.set(pitchAngle * 0.75, yaw * 0.9, (isRh ? -1 : 1) * 0.08);
      });
    }

    updateHandPose(frame.right, s.rhGroup, s.rhPalm, s.rhWrist, s.rhFingers);
    updateHandPose(frame.left, s.lhGroup, s.lhPalm, s.lhWrist, s.lhFingers);

    // Smooth camera horizontal pan following hand center
    const activeCenterX = (frame.right.palmX + frame.left.palmX) / 2 - centerOffset;
    s.camera.position.x += (activeCenterX * 0.6 - s.camera.position.x) * 0.08;
    s.camera.lookAt(s.camera.position.x * 0.8, -10, 30);
  }, [frame, range]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-inner">
      {/* Top 3D View Angle Controls */}
      <div className="absolute top-3 right-4 z-20 flex items-center gap-1.5 rounded-lg border border-border/80 bg-background/85 px-2 py-1 backdrop-blur-md">
        <span className="text-[11px] font-medium text-muted-foreground mr-1">3D 시점:</span>
        <button
          type="button"
          onClick={() => setViewAngle("angled")}
          className={`rounded px-2 py-0.5 text-xs transition-colors ${
            viewAngle === "angled" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          원근각
        </button>
        <button
          type="button"
          onClick={() => setViewAngle("player")}
          className={`rounded px-2 py-0.5 text-xs transition-colors ${
            viewAngle === "player" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          연주자
        </button>
        <button
          type="button"
          onClick={() => setViewAngle("top")}
          className={`rounded px-2 py-0.5 text-xs transition-colors ${
            viewAngle === "top" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          위에서
        </button>
      </div>

      <div className="pointer-events-none absolute top-3 left-4 z-10 text-[11px] tracking-wide text-muted-foreground">
        ✨ 3D 리얼리스틱 연주 모드 · 양손과 건반이 실시간 3D로 연동됩니다
      </div>
      <div className="pointer-events-none absolute bottom-3 left-4 z-10 text-[11px] font-medium tracking-wide text-lh">
        왼손 (Cyan)
      </div>
      <div className="pointer-events-none absolute right-4 bottom-3 z-10 text-[11px] font-medium tracking-wide text-rh">
        오른손 (Coral)
      </div>

      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="h-full w-full min-h-[260px] lg:min-h-[380px]" />
    </div>
  );
}
