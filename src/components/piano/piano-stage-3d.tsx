import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
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
  const containerRef = useRef<HTMLDivElement>(null);
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
    const ambientLight = new THREE.AmbientLight(0xffeedd, 1.1);
    scene.add(ambientLight);

    // Main Stage Spotlight on Piano & Pianist
    const spotLight = new THREE.SpotLight(0xfff3e0, 4.5, 1200, Math.PI / 3.5, 0.35, 1.2);
    spotLight.position.set(220, 550, 320);
    spotLight.target.position.set(0, 40, 0);
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 2048;
    spotLight.shadow.mapSize.height = 2048;
    spotLight.shadow.bias = -0.0003;
    scene.add(spotLight);
    scene.add(spotLight.target);

    // Golden Harp Fill Light
    const harpLight = new THREE.PointLight(0xffcc66, 2.5, 600);
    harpLight.position.set(-80, 180, -180);
    scene.add(harpLight);

    // Soft Rim Light from Back
    const rimLight = new THREE.DirectionalLight(0x7899cc, 1.4);
    rimLight.position.set(-300, 250, -350);
    scene.add(rimLight);

    // 1. Concert Stage Parquet Wooden Floor
    const floorGeo = new THREE.PlaneGeometry(3500, 3500);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x3d271a,
      roughness: 0.38,
      metalness: 0.12,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -135;
    floor.receiveShadow = true;
    scene.add(floor);

    // 2. High-Gloss Concert Grand Piano (Steinway / Yamaha Concert Grand Body)
    const pianoGroup = new THREE.Group();
    scene.add(pianoGroup);

    const blackLacquer = new THREE.MeshStandardMaterial({
      color: 0x07080b,
      roughness: 0.12,
      metalness: 0.25,
    });

    const goldHarpMat = new THREE.MeshStandardMaterial({
      color: 0xdfa038,
      roughness: 0.28,
      metalness: 0.78,
    });

    const woodSoundboardMat = new THREE.MeshStandardMaterial({
      color: 0xc48c4e,
      roughness: 0.45,
      metalness: 0.08,
    });

    const stringMat = new THREE.MeshStandardMaterial({
      color: 0xe0e0e8,
      roughness: 0.2,
      metalness: 0.9,
    });

    // Grand Piano Rim & Curved Tail
    const rimShape = new THREE.Shape();
    rimShape.moveTo(-520, -50);
    rimShape.lineTo(520, -50);
    rimShape.lineTo(520, -140);
    rimShape.bezierCurveTo(520, -420, 200, -780, -220, -840);
    rimShape.bezierCurveTo(-460, -820, -520, -600, -520, -50);

    const rimExtrude = new THREE.ExtrudeGeometry(rimShape, {
      depth: 130,
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: 4,
      bevelThickness: 4,
    });
    rimExtrude.rotateX(Math.PI / 2);
    const pianoRim = new THREE.Mesh(rimExtrude, blackLacquer);
    pianoRim.position.set(0, 10, -50);
    pianoRim.castShadow = true;
    pianoRim.receiveShadow = true;
    pianoGroup.add(pianoRim);

    // Wooden Soundboard inside Rim
    const soundboardGeo = new THREE.ShapeGeometry(rimShape);
    soundboardGeo.rotateX(Math.PI / 2);
    const soundboard = new THREE.Mesh(soundboardGeo, woodSoundboardMat);
    soundboard.position.set(0, -20, -50);
    soundboard.receiveShadow = true;
    pianoGroup.add(soundboard);

    // Cast-Iron Golden Harp Plate with intricate web ribs
    const harpGroup = new THREE.Group();
    harpGroup.position.set(0, -14, -50);
    pianoGroup.add(harpGroup);

    const plateGeo = new THREE.BoxGeometry(780, 10, 480);
    const harpPlate = new THREE.Mesh(plateGeo, goldHarpMat);
    harpPlate.position.set(-30, 0, -380);
    harpPlate.castShadow = true;
    harpGroup.add(harpPlate);

    // Golden Curved Ribs & Bridges
    for (let i = 0; i < 7; i++) {
      const ribGeo = new THREE.CylinderGeometry(5, 6, 420 - i * 35, 16);
      ribGeo.rotateZ(Math.PI / 2);
      ribGeo.rotateY(0.28 + i * 0.08);
      const rib = new THREE.Mesh(ribGeo, goldHarpMat);
      rib.position.set(-180 + i * 65, 8, -240 - i * 45);
      rib.castShadow = true;
      harpGroup.add(rib);
    }

    // Grand Piano Strings
    const stringGroup = new THREE.Group();
    for (let s = 0; s < 48; s++) {
      const sx = -420 + s * 18;
      const sLen = 580 - Math.abs(s - 12) * 6;
      const strGeo = new THREE.CylinderGeometry(0.7, 0.7, sLen, 6);
      strGeo.rotateX(Math.PI / 2);
      const strMesh = new THREE.Mesh(strGeo, stringMat);
      strMesh.position.set(sx, 4, -40 - sLen / 2);
      stringGroup.add(strMesh);
    }
    harpGroup.add(stringGroup);

    // Open Grand Piano Lid (45-degree angle open)
    const lidGroup = new THREE.Group();
    lidGroup.position.set(-520, 10, -50);

    const lidGeo = new THREE.ShapeGeometry(rimShape);
    const lidMesh = new THREE.Mesh(lidGeo, blackLacquer);
    lidMesh.castShadow = true;
    lidMesh.position.set(520, 0, 0);
    lidGroup.add(lidMesh);

    lidGroup.rotation.y = -Math.PI / 2;
    lidGroup.rotation.x = -0.55; // Open angle
    lidGroup.rotation.z = -Math.PI / 2;
    lidGroup.position.set(-520, 12, -50);
    pianoGroup.add(lidGroup);

    // Lid Prop Stick (Brass support stick)
    const stickGeo = new THREE.CylinderGeometry(4, 4, 210, 12);
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.2 });
    const stick = new THREE.Mesh(stickGeo, brassMat);
    stick.position.set(380, 110, -320);
    stick.rotation.z = 0.32;
    stick.rotation.x = 0.2;
    stick.castShadow = true;
    pianoGroup.add(stick);

    // Piano Legs & Lyre (Pedal box)
    const legGeo = new THREE.CylinderGeometry(14, 10, 140, 16);
    const leg1 = new THREE.Mesh(legGeo, blackLacquer);
    leg1.position.set(-460, -70, -80);
    const leg2 = new THREE.Mesh(legGeo, blackLacquer);
    leg2.position.set(460, -70, -80);
    const leg3 = new THREE.Mesh(legGeo, blackLacquer);
    leg3.position.set(-180, -70, -780);
    leg1.castShadow = true;
    leg2.castShadow = true;
    leg3.castShadow = true;
    pianoGroup.add(leg1);
    pianoGroup.add(leg2);
    pianoGroup.add(leg3);

    // Piano Bench
    const benchGroup = new THREE.Group();
    const seatGeo = new THREE.BoxGeometry(260, 22, 110);
    const seatMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.4 });
    const seat = new THREE.Mesh(seatGeo, seatMat);
    seat.position.set(0, -30, 210);
    seat.castShadow = true;
    benchGroup.add(seat);

    const bLegGeo = new THREE.CylinderGeometry(6, 5, 105, 12);
    for (const [bx, bz] of [[-110, 175], [110, 175], [-110, 245], [110, 245]]) {
      const bLeg = new THREE.Mesh(bLegGeo, blackLacquer);
      bLeg.position.set(bx, -82, bz);
      bLeg.castShadow = true;
      benchGroup.add(bLeg);
    }
    pianoGroup.add(benchGroup);

    // Fallboard with Red Felt
    const feltGeo = new THREE.BoxGeometry(1100, 4, 10);
    const feltMat = new THREE.MeshStandardMaterial({ color: 0xaa1422, roughness: 0.75 });
    const felt = new THREE.Mesh(feltGeo, feltMat);
    felt.position.set(0, 12, -58);
    pianoGroup.add(felt);

    // 88 Piano Keys
    const keysMap = new Map<number, { mesh: THREE.Mesh; initialY: number; isBlack: boolean }>();
    const whiteKeyMat = new THREE.MeshStandardMaterial({ color: 0xfaf8f4, roughness: 0.18, metalness: 0.04 });
    const blackKeyMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.3, metalness: 0.15 });

    const whiteGeo = new THREE.BoxGeometry(WHITE_KEY_W - 1.1, 14, WHITE_KEY_H);
    const blackGeo = new THREE.BoxGeometry(BLACK_KEY_W - 0.7, 22, BLACK_KEY_H);

    for (let p = 21; p <= 108; p++) {
      const isBlack = isBlackKey(p);
      const kx = keyCenterX(p, range.start) - keyCenterX(60, range.start);
      const ky = isBlack ? 15 : 8;
      const kz = isBlack ? -22 : 0;

      const mesh = new THREE.Mesh(isBlack ? blackGeo : whiteGeo, isBlack ? blackKeyMat.clone() : whiteKeyMat.clone());
      mesh.position.set(kx, ky, kz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pianoGroup.add(mesh);

      keysMap.set(p, { mesh, initialY: ky, isBlack });
    }

    // 3. 3D Pianist Character Avatar (Seated on bench)
    const pianistBody = new THREE.Group();
    pianistBody.position.set(0, -30, 210);
    scene.add(pianistBody);

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xf6d1b8,
      roughness: 0.52,
      metalness: 0.04,
    });

    const dressMat = new THREE.MeshStandardMaterial({
      color: 0xcc584c, // Rose coral elegant concert dress
      roughness: 0.65,
      metalness: 0.08,
    });

    const hairMat = new THREE.MeshStandardMaterial({
      color: 0xb58b5a, // Golden blonde hair
      roughness: 0.6,
      metalness: 0.1,
    });

    // Lower Body (Legs & Shoes)
    const legMeshGeo = new THREE.CylinderGeometry(9, 7, 85, 16);
    const leftLeg = new THREE.Mesh(legMeshGeo, skinMat);
    leftLeg.position.set(-28, -48, -12);
    leftLeg.rotation.x = 0.22;
    leftLeg.castShadow = true;
    pianistBody.add(leftLeg);

    const rightLeg = new THREE.Mesh(legMeshGeo, skinMat);
    rightLeg.position.set(28, -48, -12);
    rightLeg.rotation.x = 0.22;
    rightLeg.castShadow = true;
    pianistBody.add(rightLeg);

    // Torso & Concert Dress
    const torsoGeo = new THREE.CylinderGeometry(18, 24, 82, 20);
    const pianistTorso = new THREE.Mesh(torsoGeo, dressMat);
    pianistTorso.position.set(0, 48, -5);
    pianistTorso.rotation.x = -0.15; // Lean gently towards piano
    pianistTorso.castShadow = true;
    pianistBody.add(pianistTorso);

    // Neck & Head
    const pianistHead = new THREE.Group();
    pianistHead.position.set(0, 102, -18);
    pianistBody.add(pianistHead);

    const neckGeo = new THREE.CylinderGeometry(7, 8, 20, 16);
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.set(0, -6, 0);
    neck.castShadow = true;
    pianistHead.add(neck);

    const headGeo = new THREE.SphereGeometry(15, 24, 20);
    headGeo.scale(1, 1.15, 1.05);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 10, 0);
    head.castShadow = true;
    pianistHead.add(head);

    // Hair
    const hairGeo = new THREE.SphereGeometry(16.5, 24, 20);
    hairGeo.scale(1.04, 1.12, 1.18);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 12, -2);
    hair.castShadow = true;
    pianistHead.add(hair);

    // 4. Arms & Hands for Pianist
    function createPianistArm(hand: "R" | "L") {
      const isRh = hand === "R";
      const armGroup = new THREE.Group();
      scene.add(armGroup);

      // Upper Arm (From shoulder to elbow)
      const upperArmGeo = new THREE.CylinderGeometry(6.5, 5.5, 78, 16);
      const upperArm = new THREE.Mesh(upperArmGeo, skinMat);
      upperArm.position.set(0, -36, 0);
      upperArm.castShadow = true;

      // Elbow Joint
      const elbowGeo = new THREE.SphereGeometry(6, 16, 16);
      const elbow = new THREE.Mesh(elbowGeo, skinMat);
      elbow.position.set(0, -74, 0);
      elbow.castShadow = true;

      // Forearm (From elbow to wrist)
      const foreArmGeo = new THREE.CylinderGeometry(5.5, 4.5, 82, 16);
      foreArmGeo.rotateX(Math.PI / 2);
      const forearm = new THREE.Mesh(foreArmGeo, skinMat);
      forearm.castShadow = true;

      armGroup.add(upperArm);
      armGroup.add(elbow);

      // Hand Group
      const handGroup = new THREE.Group();
      scene.add(handGroup);

      // Palm (Natural Organic Ellipsoid)
      const palmGeo = new THREE.SphereGeometry(1, 24, 16);
      palmGeo.scale(26, 11, 28);
      const palm = new THREE.Mesh(palmGeo, skinMat);
      palm.castShadow = true;
      palm.receiveShadow = true;
      handGroup.add(palm);

      // Wrist
      const wristGeo = new THREE.CylinderGeometry(11, 13, 30, 18);
      wristGeo.rotateX(Math.PI / 2);
      const wrist = new THREE.Mesh(wristGeo, skinMat);
      wrist.position.set(0, -3, 26);
      wrist.castShadow = true;
      handGroup.add(wrist);

      // 5 Fingers
      const fingers = new Map<Finger, THREE.Group>();
      const fNums: Finger[] = [1, 2, 3, 4, 5];

      for (const f of fNums) {
        const fGroup = new THREE.Group();
        const spec = FINGER_SPECS[f];

        let curZ = 0;
        spec.lengths.forEach((len, segIdx) => {
          const r = spec.radius * (1 - segIdx * 0.12);
          const segGeo = new THREE.CylinderGeometry(r * 0.9, r, len, 14);
          segGeo.rotateX(Math.PI / 2);
          const seg = new THREE.Mesh(segGeo, skinMat);
          seg.position.set(0, 0, curZ - len / 2);
          seg.castShadow = true;
          fGroup.add(seg);

          const jointGeo = new THREE.SphereGeometry(r * 1.05, 12, 12);
          const joint = new THREE.Mesh(jointGeo, skinMat);
          joint.position.set(0, 0, curZ);
          fGroup.add(joint);

          curZ -= len;
        });

        // Tip Cap (Glowing ring accent)
        const tipGeo = new THREE.SphereGeometry(spec.radius * 0.9, 14, 14);
        const tipMesh = new THREE.Mesh(
          tipGeo,
          new THREE.MeshStandardMaterial({
            color: isRh ? 0xff4d79 : 0x00c4e6,
            emissive: isRh ? 0xaa1133 : 0x006688,
            emissiveIntensity: 0.5,
            roughness: 0.25,
          }),
        );
        tipMesh.position.set(0, 0, curZ);
        fGroup.add(tipMesh);

        handGroup.add(fGroup);
        fingers.set(f, fGroup);
      }

      return { armGroup, handGroup, elbow, forearm, fingers };
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
      s.cameraTargetPos = new THREE.Vector3(440, 220, 360);
      s.controlsTargetPos = new THREE.Vector3(-50, 40, -60);
    } else if (viewAngle === "side") {
      s.cameraTargetPos = new THREE.Vector3(520, 160, 180);
      s.controlsTargetPos = new THREE.Vector3(-40, 30, 0);
    } else if (viewAngle === "player") {
      s.cameraTargetPos = new THREE.Vector3(0, 165, 235);
      s.controlsTargetPos = new THREE.Vector3(0, 5, -20);
    } else if (viewAngle === "top") {
      s.cameraTargetPos = new THREE.Vector3(0, 380, 50);
      s.controlsTargetPos = new THREE.Vector3(0, 10, -20);
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
    s.pianistTorso.rotation.x = -0.16 - strikeMax * 0.06;
    s.pianistHead.rotation.x = 0.12 + strikeMax * 0.12;
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
      const wristBounce = (pose.strikeImpact ?? 0) * 3.5;
      const palmZ = isRh ? 58 : 68;
      const palmY = 24 - wristBounce;

      handGroup.position.set(targetPalmX, palmY, palmZ);
      handGroup.visible = pose.opacity > 0.05;
      armGroup.visible = pose.opacity > 0.05;

      // Shoulder position on pianist body
      const shoulderX = isRh ? 42 : -42;
      const shoulderY = 70;
      const shoulderZ = 200;
      armGroup.position.set(shoulderX, shoulderY, shoulderZ);

      // Elbow position (midway natural bend)
      const elbowX = shoulderX + (targetPalmX - shoulderX) * 0.5 + (isRh ? 24 : -24);
      const elbowY = 16 - wristBounce * 0.5;
      const elbowZ = 135;

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
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
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
