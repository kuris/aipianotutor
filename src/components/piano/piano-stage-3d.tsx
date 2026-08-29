import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Maximize2, Minimize2 } from "lucide-react";
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
  1: -28,
  2: -13,
  3: 2,
  4: 16,
  5: 28,
};

const KNUC_UP: Record<Finger, number> = {
  1: 14,
  2: 25,
  3: 29,
  4: 25,
  5: 19,
};

const FINGER_SPECS: Record<Finger, { radius: number; lengths: [number, number, number] }> = {
  1: { radius: 3.2, lengths: [13, 11, 9] },
  2: { radius: 2.8, lengths: [17, 13, 10] },
  3: { radius: 2.9, lengths: [19, 14, 11] },
  4: { radius: 2.7, lengths: [17, 13, 10] },
  5: { radius: 2.4, lengths: [14, 10, 8] },
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
    rhElbow: THREE.Mesh;
    lhElbow: THREE.Mesh;
    rhForearm: THREE.Mesh;
    lhForearm: THREE.Mesh;
    pianistBody: THREE.Group;
    pianistTorso: THREE.Mesh;
    pianistHead: THREE.Group;
    rhModel?: THREE.Object3D;
    lhModel?: THREE.Object3D;
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

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c10);
    scene.fog = new THREE.FogExp2(0x0a0c10, 0.0008);

    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 4000);
    camera.position.set(380, 240, 420);
    camera.lookAt(-40, 40, -40);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // Warm Concert Hall Lighting
    const ambientLight = new THREE.AmbientLight(0xffeedd, 1.2);
    scene.add(ambientLight);

    // Main Stage Spotlight on Piano & Pianist
    const spotLight = new THREE.SpotLight(0xfff5e6, 3.8, 1600, Math.PI / 4, 0.4, 1.2);
    spotLight.position.set(350, 500, 300);
    spotLight.target.position.set(0, 0, -40);
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 2048;
    spotLight.shadow.mapSize.height = 2048;
    spotLight.shadow.bias = -0.0002;
    scene.add(spotLight);
    scene.add(spotLight.target);

    // Golden Harp Fill Light
    const harpLight = new THREE.PointLight(0xffd580, 2.0, 600);
    harpLight.position.set(-60, 120, -160);
    scene.add(harpLight);

    // Soft Rim Light from Back
    const rimLight = new THREE.DirectionalLight(0x8fa8d6, 1.2);
    rimLight.position.set(-260, 220, -300);
    scene.add(rimLight);

    // 1. Concert Stage Parquet Wooden Floor
    const floorGeo = new THREE.PlaneGeometry(3000, 3000);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x2e1c12,
      roughness: 0.35,
      metalness: 0.15,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -100;
    floor.receiveShadow = true;
    scene.add(floor);

    // 2. High-Gloss Concert Grand Piano
    const pianoGroup = new THREE.Group();
    scene.add(pianoGroup);

    const blackLacquer = new THREE.MeshStandardMaterial({
      color: 0x0c0d10,
      roughness: 0.12,
      metalness: 0.88,
    });

    const goldHarpMat = new THREE.MeshStandardMaterial({
      color: 0xe5a83b,
      roughness: 0.25,
      metalness: 0.82,
    });

    const woodSoundboardMat = new THREE.MeshStandardMaterial({
      color: 0xb87d40,
      roughness: 0.45,
      metalness: 0.05,
    });

    const stringMat = new THREE.MeshStandardMaterial({
      color: 0xdcdce4,
      roughness: 0.2,
      metalness: 0.9,
    });

    // Grand Piano Rim Shape
    const rimShape = new THREE.Shape();
    rimShape.moveTo(-460, 0);
    rimShape.lineTo(460, 0);
    rimShape.lineTo(460, -90);
    rimShape.bezierCurveTo(460, -380, 180, -680, -180, -720);
    rimShape.bezierCurveTo(-400, -700, -460, -500, -460, 0);

    const rimExtrude = new THREE.ExtrudeGeometry(rimShape, {
      depth: 95,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 3,
      bevelThickness: 3,
    });
    rimExtrude.rotateX(Math.PI / 2);
    const pianoRim = new THREE.Mesh(rimExtrude, blackLacquer);
    pianoRim.position.set(0, 8, -40);
    pianoRim.castShadow = true;
    pianoRim.receiveShadow = true;
    pianoGroup.add(pianoRim);

    // Soundboard
    const soundboardGeo = new THREE.ShapeGeometry(rimShape);
    soundboardGeo.rotateX(Math.PI / 2);
    const soundboard = new THREE.Mesh(soundboardGeo, woodSoundboardMat);
    soundboard.position.set(0, -15, -40);
    soundboard.receiveShadow = true;
    pianoGroup.add(soundboard);

    // Golden Harp Plate
    const harpGroup = new THREE.Group();
    harpGroup.position.set(0, -10, -40);
    pianoGroup.add(harpGroup);

    const plateGeo = new THREE.BoxGeometry(680, 8, 380);
    const harpPlate = new THREE.Mesh(plateGeo, goldHarpMat);
    harpPlate.position.set(-20, 0, -320);
    harpPlate.castShadow = true;
    harpGroup.add(harpPlate);

    // Golden Curved Ribs
    for (let i = 0; i < 6; i++) {
      const ribGeo = new THREE.CylinderGeometry(4, 5, 340 - i * 30, 16);
      ribGeo.rotateZ(Math.PI / 2);
      ribGeo.rotateY(0.25 + i * 0.08);
      const rib = new THREE.Mesh(ribGeo, goldHarpMat);
      rib.position.set(-150 + i * 55, 6, -200 - i * 40);
      rib.castShadow = true;
      harpGroup.add(rib);
    }

    // Strings
    const stringGroup = new THREE.Group();
    for (let s = 0; s < 40; s++) {
      const sx = -360 + s * 18;
      const sLen = 480 - Math.abs(s - 10) * 5;
      const strGeo = new THREE.CylinderGeometry(0.6, 0.6, sLen, 4);
      strGeo.rotateX(Math.PI / 2);
      const strMesh = new THREE.Mesh(strGeo, stringMat);
      strMesh.position.set(sx, 3, -30 - sLen / 2);
      stringGroup.add(strMesh);
    }
    harpGroup.add(stringGroup);

    // Open Grand Piano Lid (42 degrees open)
    const lidGroup = new THREE.Group();
    lidGroup.position.set(-460, 10, -40);

    const lidGeo = new THREE.ShapeGeometry(rimShape);
    const lidMesh = new THREE.Mesh(lidGeo, blackLacquer);
    lidMesh.castShadow = true;
    lidMesh.position.set(460, 0, 0);
    lidGroup.add(lidMesh);

    lidGroup.rotation.y = -Math.PI / 2;
    lidGroup.rotation.x = -0.52;
    lidGroup.rotation.z = -Math.PI / 2;
    pianoGroup.add(lidGroup);

    // Lid Prop Stick
    const stickGeo = new THREE.CylinderGeometry(3, 3, 170, 10);
    const stickMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.3,
      metalness: 0.85,
    });
    const stick = new THREE.Mesh(stickGeo, stickMat);
    stick.position.set(280, 75, -280);
    stick.rotation.z = 0.24;
    stick.rotation.x = 0.18;
    stick.castShadow = true;
    pianoGroup.add(stick);

    // Piano Legs
    const legGeo = new THREE.CylinderGeometry(14, 9, 100, 18);
    const legPositions = [
      [-420, -50, -40],
      [420, -50, -40],
      [-140, -50, -660],
    ];
    legPositions.forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(legGeo, blackLacquer);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      pianoGroup.add(leg);
    });

    // 88 Piano Keys
    const keysMap = new Map<number, { mesh: THREE.Mesh; initialY: number; isBlack: boolean }>();
    const whiteKeyGeo = new THREE.BoxGeometry(WHITE_KEY_W - 1.2, 16, WHITE_KEY_H);
    const blackKeyGeo = new THREE.BoxGeometry(BLACK_KEY_W - 1.0, 18, BLACK_KEY_H);

    const whiteKeyMat = new THREE.MeshStandardMaterial({
      color: 0xfbfbfa,
      roughness: 0.18,
      metalness: 0.05,
    });

    const blackKeyMat = new THREE.MeshStandardMaterial({
      color: 0x18191c,
      roughness: 0.22,
      metalness: 0.15,
    });

    const numKeys = range.end - range.start + 1;
    const centerOffset = keyCenterX(60, range.start);

    for (let p = range.start; p <= range.end; p++) {
      const black = isBlackKey(p);
      const kx = keyCenterX(p, range.start) - centerOffset;
      const ky = black ? 7.5 : 0;
      const kz = black ? -BLACK_KEY_H / 2 + 10 : 0;

      const mesh = new THREE.Mesh(black ? blackKeyGeo : whiteKeyGeo, black ? blackKeyMat.clone() : whiteKeyMat.clone());
      mesh.position.set(kx, ky, kz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pianoGroup.add(mesh);
      keysMap.set(p, { mesh, initialY: ky, isBlack: black });
    }

    // 3. Pianist Avatar & Bench
    const benchGeo = new THREE.BoxGeometry(360, 16, 120);
    const benchTop = new THREE.Mesh(benchGeo, blackLacquer);
    benchTop.position.set(0, -32, 150);
    benchTop.castShadow = true;
    pianoGroup.add(benchTop);

    const benchLegGeo = new THREE.CylinderGeometry(7, 5, 70, 12);
    [[-150, -68, 110], [150, -68, 110], [-150, -68, 190], [150, -68, 190]].forEach(([bx, by, bz]) => {
      const bLeg = new THREE.Mesh(benchLegGeo, blackLacquer);
      bLeg.position.set(bx, by, bz);
      bLeg.castShadow = true;
      pianoGroup.add(bLeg);
    });

    // Pianist Character
    const pianistBody = new THREE.Group();
    pianistBody.position.set(0, -24, 150);
    pianoGroup.add(pianistBody);

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf5d3b3,
      roughness: 0.52,
      metalness: 0.04,
    });

    const dressMat = new THREE.MeshStandardMaterial({
      color: 0xba3c3c, // Rose red elegant concert dress
      roughness: 0.65,
      metalness: 0.08,
    });

    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x2b1d14, // Dark brown elegant updo hair
      roughness: 0.55,
      metalness: 0.1,
    });

    // Torso & Dress
    const torsoGeo = new THREE.CylinderGeometry(14, 22, 68, 20);
    const pianistTorso = new THREE.Mesh(torsoGeo, dressMat);
    pianistTorso.position.set(0, 36, -4);
    pianistTorso.rotation.x = -0.12;
    pianistTorso.castShadow = true;
    pianistBody.add(pianistTorso);

    // Head & Hair
    const pianistHead = new THREE.Group();
    pianistHead.position.set(0, 78, -14);
    pianistBody.add(pianistHead);

    const headGeo = new THREE.SphereGeometry(12, 20, 16);
    headGeo.scale(1, 1.15, 1.05);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.castShadow = true;
    pianistHead.add(head);

    const hairGeo = new THREE.SphereGeometry(13.2, 20, 16);
    hairGeo.scale(1.04, 1.12, 1.15);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 4, -2);
    hair.castShadow = true;
    pianistHead.add(hair);

    // 4. Arms & Hands for Pianist
    function createPianistArm(hand: "R" | "L") {
      const isRh = hand === "R";
      const armGroup = new THREE.Group();
      scene.add(armGroup);

      // Slender Forearm connecting smoothly to hand
      const foreArmGeo = new THREE.CylinderGeometry(3.2, 2.5, 75, 12);
      foreArmGeo.rotateX(Math.PI / 2);
      const forearm = new THREE.Mesh(foreArmGeo, skinMat);
      forearm.castShadow = true;

      // Elbow
      const elbowGeo = new THREE.SphereGeometry(3.5, 12, 12);
      const elbow = new THREE.Mesh(elbowGeo, skinMat);

      // Hand Group
      const handGroup = new THREE.Group();
      scene.add(handGroup);

      // Natural Human Palm
      const palmGeo = new THREE.SphereGeometry(1, 18, 14);
      palmGeo.scale(14, 6, 16);
      const palm = new THREE.Mesh(palmGeo, skinMat);
      palm.castShadow = true;
      handGroup.add(palm);

      // 5 Fingers (Slim & Natural)
      const fingers = new Map<Finger, THREE.Group>();
      const fNums: Finger[] = [1, 2, 3, 4, 5];

      for (const f of fNums) {
        const fGroup = new THREE.Group();
        const spec = FINGER_SPECS[f];

        let curZ = 0;
        spec.lengths.forEach((len, segIdx) => {
          const r = spec.radius * 0.65 * (1 - segIdx * 0.12);
          const segGeo = new THREE.CylinderGeometry(r, r * 0.9, len * 0.7, 10);
          segGeo.rotateX(Math.PI / 2);
          const seg = new THREE.Mesh(segGeo, skinMat);
          seg.position.z = curZ - (len * 0.7) / 2;
          seg.castShadow = true;
          fGroup.add(seg);
          curZ -= len * 0.7;
        });

        // Glowing finger indicator on key touch
        const ringGeo = new THREE.TorusGeometry(3.5, 0.9, 8, 16);
        ringGeo.rotateX(Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: isRh ? 0xff4d79 : 0x00c4e6,
          transparent: true,
          opacity: 0.9,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.z = curZ;
        fGroup.add(ring);

        handGroup.add(fGroup);
        fingers.set(f, fGroup);
      }

      return { armGroup, handGroup, forearm, elbow, fingers };
    }

    const rh = createPianistArm("R");
    const lh = createPianistArm("L");

    // Load Realistic Sketchfab 3D Hand Model
    const gltfLoader = new GLTFLoader();
    gltfLoader.load(
      "/models/female_hand.glb",
      (gltf) => {
        const baseModel = gltf.scene;
        baseModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
            if (mat) {
              mat.roughness = 0.48;
              mat.metalness = 0.05;
            }
          }
        });

        // Right Hand Instance
        const rhModel = baseModel.clone();
        rhModel.scale.set(16, 16, 16);
        rhModel.position.set(0, -6, 2);
        rhModel.rotation.set(-0.2, Math.PI, 0);
        rh.handGroup.add(rhModel);

        // Left Hand Instance (Mirrored X)
        const lhModel = baseModel.clone();
        lhModel.scale.set(-16, 16, 16);
        lhModel.position.set(0, -6, 2);
        lhModel.rotation.set(-0.2, Math.PI, 0);
        lh.handGroup.add(lhModel);

        if (stateRef.current) {
          stateRef.current.rhModel = rhModel;
          stateRef.current.lhModel = lhModel;
        }
      },
      undefined,
      (err) => {
        console.warn("Sketchfab hand GLB fallback to procedural 3D hand:", err);
      },
    );

    // OrbitControls for Free 360-degree Rotation, Zoom and Panning
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 60;
    controls.maxDistance = 1400;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // Do not go below floor
    controls.target.set(-40, 30, -30);

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
      rhElbow: rh.elbow,
      lhElbow: lh.elbow,
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

      // Smooth Camera & Target Lerp if transitioning
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
      s.cameraTargetPos = new THREE.Vector3(340, 175, 260);
      s.controlsTargetPos = new THREE.Vector3(-30, 20, -30);
    } else if (viewAngle === "side") {
      s.cameraTargetPos = new THREE.Vector3(440, 110, 80);
      s.controlsTargetPos = new THREE.Vector3(-20, 15, -10);
    } else if (viewAngle === "player") {
      s.cameraTargetPos = new THREE.Vector3(0, 110, 185);
      s.controlsTargetPos = new THREE.Vector3(0, 0, -20);
    } else if (viewAngle === "top") {
      s.cameraTargetPos = new THREE.Vector3(0, 320, 30);
      s.controlsTargetPos = new THREE.Vector3(0, 0, -20);
    }
  }, [viewAngle]);

  // Frame Update: Animate Pianist, Arms, Hands, and Keys
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;

    const centerOffset = keyCenterX(60, range.start);

    // 1. Keys Animation
    const activePitches = new Map(frame.active.map((n) => [n.pitch, n.hand]));

    s.keysMap.forEach((kInfo, pitch) => {
      const activeHand = activePitches.get(pitch);
      const isPressed = !!activeHand;
      const pressOffset = isPressed ? (kInfo.isBlack ? 5.5 : 7.5) : 0;

      kInfo.mesh.position.y = kInfo.initialY - pressOffset;

      const mat = kInfo.mesh.material as THREE.MeshStandardMaterial;
      if (isPressed) {
        mat.color.setHex(activeHand === "R" ? 0xff4d79 : 0x00c4e6);
        mat.emissive.setHex(activeHand === "R" ? 0x881122 : 0x004466);
        mat.emissiveIntensity = 0.5;
      } else {
        mat.color.setHex(kInfo.isBlack ? 0x14161a : 0xfaf8f4);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    });

    // 2. Natural Pianist Body Swaying with Music Phrasing
    const activeCenterX = (frame.right.palmX + frame.left.palmX) / 2 - centerOffset;
    const strikeMax = Math.max(frame.right.strikeImpact ?? 0, frame.left.strikeImpact ?? 0);

    // Torso gentle lean & head nod
    s.pianistTorso.rotation.z = -activeCenterX * 0.0006;
    s.pianistTorso.rotation.x = -0.14 - strikeMax * 0.05;
    s.pianistHead.rotation.x = 0.10 + strikeMax * 0.10;
    s.pianistHead.rotation.y = activeCenterX * 0.0008;

    // 3. Hands & Arms Kinematics
    function updatePianistHandAndArm(
      pose: HandFrame,
      handGroup: THREE.Group,
      armGroup: THREE.Group,
      elbow: THREE.Mesh,
      fingerMap: Map<Finger, THREE.Group>,
    ) {
      const hand = pose.hand;
      const isRh = hand === "R";
      const targetPalmX = pose.palmX - centerOffset;
      const wristBounce = (pose.strikeImpact ?? 0) * 3.0;
      const palmZ = isRh ? 26 : 26;
      const palmY = 14 - wristBounce;

      handGroup.position.set(targetPalmX, palmY, palmZ);
      handGroup.visible = pose.opacity > 0.05;
      armGroup.visible = pose.opacity > 0.05;

      // Shoulder position on pianist body
      const shoulderX = isRh ? 24 : -24;
      const shoulderY = 56;
      const shoulderZ = 140;
      armGroup.position.set(shoulderX, shoulderY, shoulderZ);

      // Elbow position (midway natural bend)
      const elbowX = shoulderX + (targetPalmX - shoulderX) * 0.45 + (isRh ? 16 : -16);
      const elbowY = 22 - wristBounce * 0.5;
      const elbowZ = 85;

      elbow.position.set(elbowX - shoulderX, elbowY - shoulderY, elbowZ - shoulderZ);

      // Finger Poses
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
        const kx = defaultKx + (fTargetX - defaultKx) * 0.28;
        const ky = -KNUC_UP[f] * 0.16;
        const kz = -KNUC_UP[f] * 0.65;

        const fGroup = fingerMap.get(f);
        if (!fGroup) return;

        fGroup.position.set(kx, ky, kz);

        const black = isBlackKey(pitch);
        const targetTipZ = (black ? -22 : 0) - palmZ - kz;
        const targetTipY = (pressed ? -8 : 6) - palmY - ky;
        const dx = fTargetX - kx;
        const dz = targetTipZ;

        const yaw = Math.atan2(dx, -dz);
        const pitchAngle = Math.atan2(targetTipY, -dz);

        fGroup.rotation.set(pitchAngle * 0.78, yaw * 0.9, (isRh ? -1 : 1) * 0.08);
      });
    }

    updatePianistHandAndArm(frame.right, s.rhGroup, s.rhArm, s.rhElbow, s.rhFingers);
    updatePianistHandAndArm(frame.left, s.lhGroup, s.lhArm, s.lhElbow, s.lhFingers);

    // Subtle camera tracking for cinematic realism (only when cinematic preset is active)
    if (viewAngle === "cinematic" && !s.cameraTargetPos) {
      s.camera.position.x += (440 + activeCenterX * 0.35 - s.camera.position.x) * 0.05;
      s.controls.target.x += (-50 + activeCenterX * 0.5 - s.controls.target.x) * 0.05;
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
