import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type Equipment = {
  id: string;
  name: string;
  type: "도끼" | "곡괭이" | "삽" | "칼" | "낚싯대";
  grade: "일반" | "고급" | "희귀" | "영웅" | "전설" | "신화";
  bonus: number;
};

type SaveData = {
  gold: number;
  wood: number;
  stone: number;
  dirt: number;
  fish: number;
  food: number;
  farmSeeds: Record<CropType, number>;
  farmPlots: FarmPlot[];
  toolLevel: number;
  toolName: string;
  inventory: Equipment[];
  equippedToolId: string | null;
  equippedTools: Record<Equipment["type"], string | null>;
};

type ResourceType = "wood" | "stone" | "dirt" | "fish";
type CropType = "밀" | "당근" | "감자";
type FarmPlot = { crop: CropType | null; plantedAt: number | null; readyAt: number | null };
const CROP_CONFIG: Record<CropType, { icon: string; time: number; yield: number }> = {
  밀: { icon: "🌾", time: 12000, yield: 3 },
  당근: { icon: "🥕", time: 18000, yield: 5 },
  감자: { icon: "🥔", time: 24000, yield: 7 },
};
function resourceToolType(type: ResourceType): Equipment["type"] { if (type === "wood") return "도끼"; if (type === "stone") return "곡괭이"; if (type === "dirt") return "삽"; return "낚싯대"; }

const SAVE_KEY = "break-the-walls-roll-the-dice-v1";
const STARTING_SAVE: SaveData = {
  gold: 0,
  wood: 0,
  stone: 0,
  dirt: 0,
  fish: 0,
  food: 0,
  farmSeeds: { 밀: 3, 당근: 3, 감자: 3 },
  farmPlots: Array.from({ length: 6 }, () => ({ crop: null, plantedAt: null, readyAt: null })),
  toolLevel: 1,
  toolName: "맨손",
  inventory: [],
  equippedToolId: null,
  equippedTools: { 도끼: null, 곡괭이: null, 삽: null, 칼: null, 낚싯대: null },
};

const EQUIPMENT_TYPES: Equipment["type"][] = ["도끼", "곡괭이", "삽", "칼", "낚싯대"];
const EQUIPMENT_GRADES: { grade: Equipment["grade"]; chance: number; bonus: number }[] = [
  { grade: "일반", chance: 0.5, bonus: 1 }, { grade: "고급", chance: 0.25, bonus: 2 },
  { grade: "희귀", chance: 0.14, bonus: 4 }, { grade: "영웅", chance: 0.07, bonus: 7 },
  { grade: "전설", chance: 0.035, bonus: 12 }, { grade: "신화", chance: 0.005, bonus: 20 },
];

function makeEquipment(): Equipment {
  const roll = Math.random(); let cursor = 0;
  const picked = EQUIPMENT_GRADES.find((entry) => { cursor += entry.chance; return roll < cursor; }) ?? EQUIPMENT_GRADES[0];
  const type = EQUIPMENT_TYPES[Math.floor(Math.random() * EQUIPMENT_TYPES.length)];
  return { id: crypto.randomUUID(), name: `${picked.grade} ${type}`, type, grade: picked.grade, bonus: picked.bonus };
}

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return STARTING_SAVE;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      gold: Number(parsed.gold) || 0,
      wood: Number(parsed.wood) || 0,
      stone: Number(parsed.stone) || 0,
      dirt: Number((parsed as Partial<SaveData>).dirt) || 0,
      fish: Number((parsed as Partial<SaveData>).fish) || 0,
      food: Number((parsed as Partial<SaveData>).food) || 0,
      farmSeeds: parsed.farmSeeds && typeof parsed.farmSeeds === "object" ? {
        밀: Number(parsed.farmSeeds.밀) || 0,
        당근: Number(parsed.farmSeeds.당근) || 0,
        감자: Number(parsed.farmSeeds.감자) || 0,
      } : { ...STARTING_SAVE.farmSeeds },
      farmPlots: Array.isArray(parsed.farmPlots) && parsed.farmPlots.length === 6
        ? parsed.farmPlots.map((plot) => ({
            crop: plot?.crop === "밀" || plot?.crop === "당근" || plot?.crop === "감자" ? plot.crop : null,
            plantedAt: typeof plot?.plantedAt === "number" ? plot.plantedAt : null,
            readyAt: typeof plot?.readyAt === "number" ? plot.readyAt : null,
          }))
        : STARTING_SAVE.farmPlots,
      toolLevel: Math.max(1, Number(parsed.toolLevel) || 1),
      toolName: typeof parsed.toolName === "string" ? parsed.toolName : "맨손",
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory as Equipment[] : [],
      equippedToolId: typeof parsed.equippedToolId === "string" ? parsed.equippedToolId : null,
      equippedTools: parsed.equippedTools && typeof parsed.equippedTools === "object" ? { 도끼: parsed.equippedTools.도끼 ?? null, 곡괭이: parsed.equippedTools.곡괭이 ?? null, 삽: parsed.equippedTools.삽 ?? null, 칼: parsed.equippedTools.칼 ?? null, 낚싯대: parsed.equippedTools.낚싯대 ?? null } : { ...STARTING_SAVE.equippedTools },
    };
  } catch {
    return STARTING_SAVE;
  }
}

function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [message, setMessage] = useState("나무와 바위를 클릭해서 첫 자본을 만들어보세요.");
  const [shopRoll, setShopRoll] = useState("장비를 뽑아보세요.");
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"estate" | "gather" | "farm" | "shop" | "gacha">("estate");
  const [gatheringActivity, setGatheringActivity] = useState<ResourceType | null>(null);
  const [gatherPlayer, setGatherPlayer] = useState({ x: 50, y: 72 });
  const [gatherAction, setGatherAction] = useState(0);
  const [fishingState, setFishingState] = useState<"idle" | "waiting" | "bite">("idle");
  const [fishingMinigameOpen, setFishingMinigameOpen] = useState(false);
  const [fishingFishX, setFishingFishX] = useState(50);
  const [fishingFishDir, setFishingFishDir] = useState(1);
  const [gatherReward, setGatherReward] = useState<string | null>(null);
  const [gatherTimingX, setGatherTimingX] = useState(50);
  const [gatherTimingDir, setGatherTimingDir] = useState(1);
  const [gatherCombo, setGatherCombo] = useState(0);
  const [gatherStamina, setGatherStamina] = useState(100);
  const [gatherSwing, setGatherSwing] = useState(false);
  const [fishingCast, setFishingCast] = useState(false);
  const [fishingResult, setFishingResult] = useState<string | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<Equipment["type"]>("도끼");
  const [farmTick, setFarmTick] = useState(Date.now());
  const gatherRequiredHits = gatheringActivity === "wood" ? 3 : gatheringActivity === "stone" ? 4 : 2;
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; }, [save]);
  const messageTimerRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }, [save]);

  useEffect(() => {
    const timer = window.setInterval(() => setFarmTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!gatheringActivity) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "escape") {
        leaveGatheringActivity();
        return;
      }
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "e", " "].includes(key)) event.preventDefault();
      if (fishingMinigameOpen && (key === "e" || key === " ")) {
        catchFish();
        return;
      }
      const step = 6;
      setGatherPlayer((prev) => ({
        x: Math.max(10, Math.min(90, prev.x + (key === "a" || key === "arrowleft" ? -step : key === "d" || key === "arrowright" ? step : 0))),
        y: Math.max(18, Math.min(84, prev.y + (key === "w" || key === "arrowup" ? -step : key === "s" || key === "arrowdown" ? step : 0))),
      }));
      if (key === "e" || key === " ") interactGathering();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gatheringActivity, fishingMinigameOpen]);

  useEffect(() => {
    if (!gatheringActivity || gatheringActivity === "fish" || fishingMinigameOpen) return;
    const timer = window.setInterval(() => {
      setGatherTimingX((prev) => {
        const next = prev + gatherTimingDir * 3;
        if (next >= 94 || next <= 6) {
          setGatherTimingDir((dir) => -dir);
          return Math.max(6, Math.min(94, next));
        }
        return next;
      });
    }, 50);
    return () => window.clearInterval(timer);
  }, [gatheringActivity, fishingMinigameOpen, gatherTimingDir]);

  useEffect(() => {
    if (!fishingMinigameOpen) return;
    const timer = window.setInterval(() => {
      setFishingFishX((prev) => {
        const next = prev + fishingFishDir * 2.4;
        if (next >= 92 || next <= 8) {
          setFishingFishDir((dir) => -dir);
          return Math.max(8, Math.min(92, next));
        }
        return next;
      });
    }, 50);
    return () => window.clearInterval(timer);
  }, [fishingMinigameOpen, fishingFishDir]);

  const openGatheringActivity = (type: ResourceType) => {
    const requiredType = resourceToolType(type);
    const equipped = saveRef.current.inventory.find((item) => item.id === saveRef.current.equippedTools[requiredType]);
    if (!equipped) {
      showMessage("⚠️ " + requiredType + "를 먼저 장착하세요.");
      setInventoryOpen(true);
      setEquipmentFilter(requiredType);
      return;
    }
    setGatheringActivity(type);
    setGatherPlayer({ x: 50, y: 72 });
    setGatherAction(0);
    setFishingState("idle");
    setGatherTimingX(50);
    setGatherTimingDir(1);
    setGatherReward(null);
    setGatherCombo(0);
    setGatherStamina(100);
    setGatherSwing(false);
    setFishingCast(type === "fish");
    setFishingResult(null);
    setFishingMinigameOpen(type === "fish");
  };

  const leaveGatheringActivity = () => {
    setGatheringActivity(null);
    setFishingState("idle");
    setFishingMinigameOpen(false);
    setGatherReward(null);
    setGatherCombo(0);
    setGatherStamina(100);
    setGatherSwing(false);
    setFishingCast(false);
    setFishingResult(null);
    setActiveTab("gather");
  };

  const showMessage = (text: string) => {
    setMessage(text);
    if (messageTimerRef.current !== null) {
      window.clearTimeout(messageTimerRef.current);
    }
    messageTimerRef.current = window.setTimeout(() => {
      setMessage("다시 채집하려면 나무나 바위를 클릭하세요.");
    }, 1800);
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#8fc8e9");

    const camera = new THREE.OrthographicCamera(-12, 12, 9, -9, 0.1, 100);
    camera.position.set(15, 17, 15);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight("#ffffff", "#64748b", 2.2);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight("#fff6df", 3.2);
    sun.position.set(8, 18, 10);
    sun.castShadow = true;
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(30, 0.8, 24),
      new THREE.MeshStandardMaterial({ color: "#6da34d", roughness: 1 }),
    );
    ground.position.y = -0.4;
    ground.receiveShadow = true;
    scene.add(ground);

    const path = new THREE.Mesh(
      new THREE.BoxGeometry(30, 0.18, 4.2),
      new THREE.MeshStandardMaterial({ color: "#c9aa72", roughness: 1 }),
    );
    path.position.set(0, 0.05, 0);
    scene.add(path);

    const resources: THREE.Group[] = [];
    const timers = new Set<number>();

    const makeTree = (x: number, z: number, scale = 1) => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.scale.setScalar(scale);
      group.userData.resourceType = "wood" satisfies ResourceType;

      const trunk = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 2.4, 0.8),
        new THREE.MeshStandardMaterial({ color: "#7a4d2b", roughness: 1 }),
      );
      trunk.position.y = 1.2;
      trunk.castShadow = true;
      group.add(trunk);

      const leaves = new THREE.Mesh(
        new THREE.ConeGeometry(1.75, 3.4, 6),
        new THREE.MeshStandardMaterial({ color: "#2f7d32", roughness: 1 }),
      );
      leaves.position.y = 3.4;
      leaves.castShadow = true;
      group.add(leaves);

      scene.add(group);
      resources.push(group);
    };

    const makeRock = (x: number, z: number, scale = 1) => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.scale.setScalar(scale);
      group.userData.resourceType = "stone" satisfies ResourceType;

      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.25, 0),
        new THREE.MeshStandardMaterial({ color: "#66717c", roughness: 1 }),
      );
      rock.scale.set(1.15, 0.8, 1);
      rock.position.y = 1;
      rock.castShadow = true;
      group.add(rock);

      const ore = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.18, 0.25),
        new THREE.MeshStandardMaterial({ color: "#b8c2cc", roughness: 0.8 }),
      );
      ore.position.set(0.45, 1.25, 0.25);
      ore.rotation.y = 0.5;
      group.add(ore);

      scene.add(group);
      resources.push(group);
    };

    [
      [-10, -7, 1.05],
      [-6.5, 6, 0.9],
      [7.5, -6, 1],
      [11, 6, 0.85],
      [2, 8, 0.8],
    ].forEach(([x, z, scale]) => makeTree(x, z, scale));

    [
      [-10, 3, 1],
      [-4, -7, 0.9],
      [8.5, 5.5, 1.05],
      [10, -1, 0.8],
    ].forEach(([x, z, scale]) => makeRock(x, z, scale));

    const makeDirt = (x: number, z: number, scale = 1) => {
      const group = new THREE.Group(); group.position.set(x, 0, z); group.scale.setScalar(scale); group.userData.resourceType = "dirt" satisfies ResourceType;
      const soil = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 2.2), new THREE.MeshStandardMaterial({ color: "#8b5a3c", roughness: 1 }));
      soil.position.y = 0.3; group.add(soil); scene.add(group); resources.push(group);
    };
    const makeFishingSpot = (x: number, z: number, scale = 1) => {
      const group = new THREE.Group(); group.position.set(x, 0, z); group.scale.setScalar(scale); group.userData.resourceType = "fish" satisfies ResourceType;
      const pond = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.18, 20), new THREE.MeshStandardMaterial({ color: "#3d8fbd", roughness: 0.7 }));
      pond.position.y = 0.08; group.add(pond); scene.add(group); resources.push(group);
    };
    [[-2, -8, 1], [4, 7, 0.9], [11, -5, 0.85]].forEach(([x, z, scale]) => makeDirt(x, z, scale));
    [[-8, -1, 1], [6, -8, 0.9]].forEach(([x, z, scale]) => makeFishingSpot(x, z, scale));
    const castle = new THREE.Group();
    castle.position.set(0, 0, 0);

    const castleBase = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 2.5, 5.6),
      new THREE.MeshStandardMaterial({ color: "#d5d0c5", roughness: 0.9 }),
    );
    castleBase.position.y = 1.25;
    castleBase.castShadow = true;
    castle.add(castleBase);

    const towerPositions: [number, number][] = [
      [-2.7, -2.7],
      [2.7, -2.7],
      [-2.7, 2.7],
      [2.7, 2.7],
    ];

    towerPositions.forEach(([x, z]) => {
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(1.65, 4.5, 1.65),
        new THREE.MeshStandardMaterial({ color: "#b9b4aa", roughness: 0.95 }),
      );
      tower.position.set(x, 2.25, z);
      tower.castShadow = true;
      castle.add(tower);

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(1.25, 1.7, 4),
        new THREE.MeshStandardMaterial({ color: "#6d4a35", roughness: 1 }),
      );
      roof.position.set(x, 5.35, z);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      castle.add(roof);
    });

    scene.add(castle);

    const shop = new THREE.Group();
    shop.position.set(-7.5, 0, 0);
    const shopBody = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 2.8, 3.8),
      new THREE.MeshStandardMaterial({ color: "#d08b45", roughness: 1 }),
    );
    shopBody.position.y = 1.4;
    shopBody.castShadow = true;
    shop.add(shopBody);

    const shopRoof = new THREE.Mesh(
      new THREE.ConeGeometry(3.1, 2.4, 4),
      new THREE.MeshStandardMaterial({ color: "#8b3f32", roughness: 1 }),
    );
    shopRoof.position.y = 4;
    shopRoof.rotation.y = Math.PI / 4;
    shopRoof.castShadow = true;
    shop.add(shopRoof);
    scene.add(shop);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    let cameraAzimuth = Math.PI / 4;
    let cameraElevation = 0.78;
    let cameraRadius = 23;
    const cameraTarget = new THREE.Vector3(0, 0, 0);
    let dragging = false;
    let moved = false;
    let lastPointerX = 0;
    let lastPointerY = 0;

    const updateCamera = () => {
      const horizontalRadius = cameraRadius * Math.cos(cameraElevation);
      camera.position.set(
        Math.cos(cameraAzimuth) * horizontalRadius,
        cameraRadius * Math.sin(cameraElevation),
        Math.sin(cameraAzimuth) * horizontalRadius,
      );
      camera.lookAt(cameraTarget);
    };

    const findResource = (object: THREE.Object3D | null) => {
      let current = object;
      while (current) {
        if (current.userData.resourceType) return current;
        current = current.parent;
      }
      return null;
    };

    const collectAtPointer = () => {
      setActiveTab("gather");
    };

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      moved = false;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      renderer.domElement.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;

      const dx = event.clientX - lastPointerX;
      const dy = event.clientY - lastPointerY;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;

      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      if (!moved) return;

      cameraAzimuth -= dx * 0.008;
      cameraElevation = THREE.MathUtils.clamp(cameraElevation + dy * 0.006, 0.32, 1.28);
      updateCamera();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;

      if (!moved) {
        collectAtPointer();
      }

      renderer.domElement.releasePointerCapture?.(event.pointerId);
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);

    let frame = 0;
    const animate = () => {
      const time = performance.now() * 0.001;
      resources.forEach((resource, index) => {
        if (resource.visible) {
          resource.rotation.y = Math.sin(time * 0.35 + index) * 0.025;
        }
      });
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    updateCamera();
    animate();

    const onResize = () => {
      if (!mount) return;
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      const aspect = width / Math.max(height, 1);
      const view = 10;
      camera.left = -view * aspect;
      camera.right = view * aspect;
      camera.top = view;
      camera.bottom = -view;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener("resize", onResize);
    onResize();

    return () => {
      cancelAnimationFrame(frame);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("resize", onResize);
      timers.forEach((timer) => window.clearTimeout(timer));
      if (messageTimerRef.current !== null) {
        window.clearTimeout(messageTimerRef.current);
      }

      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((item) => item.dispose());
          else material.dispose();
        }
      });

      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  const rollTool = () => {
    const cost = 50 + save.inventory.length * 25;
    if (save.gold < cost) {
      showMessage(`골드가 부족합니다. 필요 골드: ${cost}G`);
      return;
    }
    const equipment = makeEquipment();
    setSave((prev) => ({ ...prev, gold: prev.gold - cost, inventory: [...prev.inventory, equipment] }));
    setShopRoll(`🎁 ${equipment.name} 획득! 장비 탭에서 장착하세요.`);
    showMessage(`🎁 ${equipment.name} 획득! 채집 보너스 +${equipment.bonus}`);
  };

  const equipTool = (equipmentId: string) => {
    const equipment = save.inventory.find((item) => item.id === equipmentId);
    if (!equipment) return;
    setSave((prev) => ({ ...prev, toolLevel: equipment.bonus, toolName: equipment.name, equippedToolId: equipment.id, equippedTools: { ...prev.equippedTools, [equipment.type]: equipment.id } }));
    setEquipmentFilter(equipment.type);
    showMessage(`⚒️ ${equipment.name} 장착! ${equipment.type === "도끼" ? "목재" : equipment.type === "곡괭이" ? "석재" : equipment.type === "삽" ? "흙" : equipment.type === "낚싯대" ? "물고기" : "전투"} 채집량 +${equipment.bonus}`);
  };

  const catchFish = () => {
    const equipped = saveRef.current.inventory.find((item) => item.id === saveRef.current.equippedTools["낚싯대"]);
    if (!equipped || !fishingMinigameOpen || !fishingCast) return;
    const distanceFromSweetSpot = Math.abs(fishingFishX - 50);
    if (distanceFromSweetSpot <= 8) {
      const amount = equipped.bonus + (distanceFromSweetSpot <= 3 ? 1 : 0);
      setSave((prev) => ({ ...prev, fish: prev.fish + amount }));
      setFishingResult("🎉 PERFECT CATCH! 물고기 +" + amount);
      setGatherReward("🐟 +" + amount);
      showMessage(distanceFromSweetSpot <= 3 ? "🎯 완벽한 낚시! +" + amount : "🎣 낚시 성공! +" + amount);
    } else {
      setFishingResult("💨 물고기가 도망갔다!");
      setGatherReward("MISS");
      showMessage("🐟 타이밍을 놓쳤습니다. 다시 입질을 기다리세요.");
    }
    setFishingCast(false);
    setFishingMinigameOpen(false);
    setFishingFishX(50);
  };

  const interactGathering = () => {
    if (!gatheringActivity || gatheringActivity === "fish") return;
    const requiredType = resourceToolType(gatheringActivity);
    const equipped = saveRef.current.inventory.find((item) => item.id === saveRef.current.equippedTools[requiredType]);
    if (!equipped || gatherSwing || gatherStamina < 12) return;

    setGatherSwing(true);
    setGatherStamina((prev) => Math.max(0, prev - 12));

    const distance = Math.abs(gatherTimingX - 50);
    const perfect = distance <= 5;
    const good = distance <= 13;
    const damage = perfect ? 2 : good ? 1 : 0;

    window.setTimeout(() => {
      setGatherSwing(false);
      if (damage === 0) {
        setGatherCombo(0);
        setGatherReward("MISS");
        showMessage("💨 빗나갔습니다! 노란 구간을 노리세요.");
        return;
      }

      const nextHits = gatherAction + 1;
      const nextCombo = gatherCombo + (perfect ? 1 : 0);
      setGatherAction(nextHits);
      setGatherCombo(nextCombo);
      setGatherReward(perfect ? "🎯 PERFECT!" : "💥 GOOD");

      if (nextHits >= gatherRequiredHits) {
        const amount = equipped.bonus + Math.floor(nextCombo / 2);
        setSave((prev) => gatheringActivity === "wood"
          ? { ...prev, wood: prev.wood + amount }
          : gatheringActivity === "stone"
            ? { ...prev, stone: prev.stone + amount }
            : { ...prev, dirt: prev.dirt + amount });
        setGatherAction(0);
        setGatherCombo(0);
        const reward = gatheringActivity === "wood" ? "🌲 목재 +" + amount : gatheringActivity === "stone" ? "⛏️ 석재 +" + amount : "🟫 흙 +" + amount;
        setGatherReward("🎉 " + reward);
        showMessage((perfect ? "🎯 PERFECT COMBO! " : "💪 채집 성공! ") + reward);
      } else {
        showMessage((perfect ? "🎯 PERFECT · " : "💥 GOOD · ") + nextHits + "/" + gatherRequiredHits + (nextCombo > 1 ? " · COMBO x" + nextCombo : ""));
      }
    }, 170);
  };

  const plantCrop = (index: number, crop: CropType) => {
    const plot = save.farmPlots[index];
    if (!plot || plot.crop) return;
    if (save.farmSeeds[crop] <= 0) {
      showMessage("🌱 " + crop + " 씨앗이 없습니다.");
      return;
    }
    const now = Date.now();
    const readyAt = now + CROP_CONFIG[crop].time;
    setSave((prev) => ({
      ...prev,
      farmSeeds: { ...prev.farmSeeds, [crop]: prev.farmSeeds[crop] - 1 },
      farmPlots: prev.farmPlots.map((item, i) => i === index ? { crop, plantedAt: now, readyAt } : item),
    }));
    showMessage("🌱 " + crop + "를 심었습니다.");
  };

  const harvestCrop = (index: number) => {
    const plot = save.farmPlots[index];
    if (!plot.crop || !plot.readyAt || farmTick < plot.readyAt) return;
    const crop = plot.crop;
    const config = CROP_CONFIG[crop];
    setSave((prev) => ({
      ...prev,
      food: prev.food + config.yield,
      farmSeeds: { ...prev.farmSeeds, [crop]: prev.farmSeeds[crop] + 1 },
      farmPlots: prev.farmPlots.map((item, i) => i === index ? { crop: null, plantedAt: null, readyAt: null } : item),
    }));
    showMessage("🌾 농산물 +" + config.yield + " · 씨앗 1개를 회수했습니다.");
  };

  const sellAll = () => {
    const revenue = save.wood * 5 + save.stone * 8 + save.dirt * 3 + save.fish * 12 + save.food * 10;
    if (revenue <= 0) {
      showMessage("팔 자원이 없습니다.");
      return;
    }

    setSave((prev) => ({
      ...prev,
      gold: prev.gold + revenue,
      wood: 0,
      stone: 0,
      dirt: 0,
      fish: 0,
      food: 0,
    }));
    showMessage(`💰 자원을 팔아 골드 +${revenue}`);
  };

  const resetGame = () => {
    if (!window.confirm("현재 저장 데이터를 초기화할까요?")) return;
    localStorage.removeItem(SAVE_KEY);
    setSave(STARTING_SAVE);
    showMessage("새 영지를 시작했습니다.");
  };

  return (
    <main className="game-shell">
      <div ref={mountRef} className="world" />

      <header className="hud">
        <div className="brand">
          <div className="brand-mark">🏰</div>
          <div>
            <strong>성벽을 부수고 주사위를 던져라</strong>
            <span>나무 베다 지치면 알바를 쓰고, 결국 대기업 회장이 된다.</span>
          </div>
        </div>

        <div className="resources">
          <div className="resource-pill gold">💰 <b>{save.gold.toLocaleString()}</b><small>골드</small></div>
          <div className="resource-pill wood">🌲 <b>{save.wood}</b><small>목재</small></div>
          <div className="resource-pill stone">🪨 <b>{save.stone}</b><small>석재</small></div><div className="resource-pill wood">🟫 <b>{save.dirt}</b><small>흙</small></div><div className="resource-pill stone">🐟 <b>{save.fish}</b><small>물고기</small></div>
        </div>
      </header>

      <section className="side-panel mission-panel">
        <div className="eyebrow">PHASE 1 · 영지 운영</div>
        <h1>영지를 키워라</h1>
        <p>채집은 현장에 들어가 직접 플레이하고, 영지에서는 판매·농장·장비·자동화를 관리합니다.</p>
        <div className="objective"><span>⛏️ 채집</span><b>현장 플레이</b></div>
        <div className="objective"><span>🌾 농장</span><b>재배 · 수확</b></div>
        <div className="objective"><span>🛒 상점</span><b>판매 · 골드 확보</b></div>
      </section>

      



      {inventoryOpen && (
        <section className="equipment-screen">
          <div className="equipment-screen-header">
            <div>
              <div className="eyebrow">EQUIPMENT · ARMORY</div>
              <h2>🎒 장비 보관함</h2>
              <p>뽑은 장비를 확인하고 원하는 장비를 장착하세요.</p>
            </div>
            <button className="close-equipment" onClick={() => { setInventoryOpen(false); setActiveTab("estate"); }}>← 영지로 돌아가기</button>
          </div>
          <div className="equipment-slots">
            {EQUIPMENT_TYPES.map((type) => {
              const equipped = save.inventory.find((item) => item.id === save.equippedTools[type]);
              const icon = type === "도끼" ? "🪓" : type === "곡괭이" ? "⛏️" : type === "삽" ? "🛠️" : type === "칼" ? "⚔️" : "🎣";
              return <div className="equipment-slot" key={type}><div className="slot-icon">{icon}</div><span>{type} 슬롯</span><b>{equipped?.name ?? "비어 있음"}</b><small>{equipped ? "채집량 +" + equipped.bonus : "장비를 장착하세요"}</small></div>;
            })}
          </div>
          <div className="equipment-workbench">
            <div className="equipment-summary">
              <div><span>장착 슬롯</span><b>{save.inventory.find((item) => item.id === save.equippedTools[equipmentFilter])?.name ?? "비어 있음"}</b><small>{equipmentFilter === "도끼" ? "목재" : equipmentFilter === "곡괭이" ? "석재" : equipmentFilter === "삽" ? "흙" : equipmentFilter === "낚싯대" ? "물고기" : "전투"} 채집량 증가</small></div>
              <div><span>보유 장비</span><b>{save.inventory.length}</b><small>개</small></div>
              <div><span>미장착</span><b>{save.inventory.filter((item) => !Object.values(save.equippedTools).includes(item.id)).length}</b><small>개</small></div>
            </div>
            <div className="equipment-category-tabs">
              {EQUIPMENT_TYPES.map((type) => (
                <button key={type} className={equipmentFilter === type ? "active" : ""} onClick={() => setEquipmentFilter(type)}>
                  {type === "도끼" ? "🪓" : type === "곡괭이" ? "⛏️" : type === "삽" ? "🛠️" : type === "칼" ? "⚔️" : "🎣"} {type}
                </button>
              ))}
            </div>
            <div className="equipment-group">
              <div className="equipment-group-title">
                <div><span>{equipmentFilter}</span><b>{equipmentFilter === "도끼" ? "목재" : equipmentFilter === "곡괭이" ? "석재" : equipmentFilter === "삽" ? "흙" : equipmentFilter === "낚싯대" ? "물고기" : "전투"} 생산 보너스</b></div>
                <small>장착 1개 · 보관 {save.inventory.filter((item) => item.type === equipmentFilter).length}개</small>
              </div>
              <div className="equipment-grid grouped">
                {save.inventory.filter((item) => item.type === equipmentFilter).length === 0 ? (
                  <div className="empty-inventory large">이 종류의 장비가 없습니다.<br />아래에서 장비를 뽑아보세요.</div>
                ) : save.inventory.filter((item) => item.type === equipmentFilter).map((item) => {
                  const isEquipped = save.equippedTools[item.type] === item.id;
                  return (
                    <article className={"equipment-card-large " + (isEquipped ? "equipped" : "unequipped")} key={item.id}>
                      <div className="equipment-icon">{item.type === "도끼" ? "🪓" : item.type === "곡괭이" ? "⛏️" : item.type === "삽" ? "🛠️" : item.type === "칼" ? "⚔️" : "🎣"}</div>
                      <div className={"equipment-grade grade-" + item.grade}>{item.grade}</div>
                      <h3>{item.name}</h3>
                      <div className="equipment-bonus">+{item.bonus} {equipmentFilter === "도끼" ? "목재" : equipmentFilter === "곡괭이" ? "석재" : equipmentFilter === "삽" ? "흙" : equipmentFilter === "낚싯대" ? "물고기" : "전투력"}</div>
                      <div className="equipment-type">{isEquipped ? "✓ 장착 중" : "미장착"}</div>
                      <button onClick={() => equipTool(item.id)}>{isEquipped ? "✓ 장착 중" : "장착하기"}</button>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {!inventoryOpen && gatheringActivity && (
        <section className="gathering-game">
          {fishingMinigameOpen ? (
            <div className="gather-2d-screen fishing-2d-screen">
              <div className="g2d-topbar">
                <div><span>FISHING DOCK</span><h2>낚시터</h2></div>
                <button onClick={leaveGatheringActivity}>나가기</button>
              </div>
              <div className="g2d-world fishing-world">
                <div className="water-grid" />
                <div className="dock-planks" />
                <div className="angler-2d"><div className="angler-head" /><div className="angler-body" /><div className="angler-tool">╲</div></div>
                <div className="fishing-badge">{fishingResult ?? (fishingCast ? "🐟 입질! 물고기를 따라가세요" : "🎣 낚싯대를 던졌습니다")}</div>
                <div className="fish-shadow" style={{ left: fishingFishX + "%", top: "58%" }} />
                <div className="fish-2d" style={{ left: fishingFishX + "%", top: "58%" }}><span className="fish-eye" /></div>
                <div className="fishing-ripple" style={{ left: fishingFishX + "%", top: "64%" }} />
                <div className="fishing-line-2d" style={{ left: "28%", top: "47%", width: Math.max(8, fishingFishX - 28) + "%" }} />
              </div>
              <div className="g2d-action-panel">
                <div className="g2d-title-row"><div><span>🎣 낚싯대</span><b>{fishingCast ? "물고기가 걸렸다! 지금 낚아채세요." : "다시 입질을 기다리려면 버튼을 누르세요."}</b></div><strong>+{saveRef.current.inventory.find((item) => item.id === saveRef.current.equippedTools["낚싯대"])?.bonus ?? 0}</strong></div>
                <div className="fishing-meter-2d"><div className="fishing-target-2d" /><div className="fishing-cursor-2d" style={{ left: fishingFishX + "%" }} /></div>
                {fishingCast ? (
                  <button className="g2d-main-action fishing-action" onClick={catchFish}>🎣 낚아채기 <small>E / SPACE</small></button>
                ) : (
                  <button className="g2d-main-action fishing-action" onClick={() => { setFishingCast(true); setFishingMinigameOpen(true); setFishingResult(null); setFishingFishX(15); }}>🎣 다시 캐스팅</button>
                )}
              </div>
            </div>
          ) : (
            <section className={"gather-2d-screen " + gatheringActivity}>
              <div className="g2d-topbar">
                <div>
                  <span>RESOURCE FIELD · 2D</span>
                  <h2>{gatheringActivity === "wood" ? "벌목장" : gatheringActivity === "stone" ? "광산" : "토지 작업장"}</h2>
                </div>
                <button onClick={leaveGatheringActivity}>나가기</button>
              </div>

              <div className="g2d-world resource-world">
                <div className="ground-grid" />
                <div className="world-shadow shadow-node" />
                <div className="resource-node-2d">
                  {gatheringActivity === "wood" && <><div className="tree-trunk-2d" /><div className="tree-crown-2d one" /><div className="tree-crown-2d two" /><div className="tree-crown-2d three" /></>}
                  {gatheringActivity === "stone" && <><div className="rock-2d rock-a" /><div className="rock-2d rock-b" /><div className="ore-2d" /></>}
                  {gatheringActivity === "dirt" && <><div className="soil-bed-2d" /><div className="soil-lines-2d" /><div className="sprout-2d one" /><div className="sprout-2d two" /><div className="sprout-2d three" /></>}
                </div>
                <div className={"worker-2d " + (gatherAction % 2 ? "swing" : "")}>
                  <div className="worker-shadow" /><div className="worker-head" /><div className="worker-hair" /><div className="worker-body" /><div className="worker-arm" /><div className="worker-tool-2d">{gatheringActivity === "wood" ? "╱" : gatheringActivity === "stone" ? "⛏" : "╱"}</div>
                </div>
                <div className="node-hud-2d">
                  <div><span>{gatheringActivity === "wood" ? "TREE" : gatheringActivity === "stone" ? "ORE VEIN" : "SOIL"}</span><b>{Math.max(0, gatherRequiredHits - gatherAction)} HP</b></div>
                  <div className="node-hp"><i style={{ width: ((Math.max(0, gatherRequiredHits - gatherAction) / gatherRequiredHits) * 100) + "%" }} /></div>
                </div>
                {gatherReward && <div className="g2d-floating-reward">{gatherReward}</div>}
              </div>

              <div className="g2d-action-panel">
                <div className="g2d-title-row">
                  <div><span>{gatheringActivity === "wood" ? "🪓 도끼" : gatheringActivity === "stone" ? "⛏️ 곡괭이" : "🛠️ 삽"} · COMBO x{gatherCombo}</span><b>노란 구간에 맞춰 타격하세요 · MISS는 콤보를 끊습니다.</b></div>
                  <strong>{gatherAction} / {gatherRequiredHits}</strong>
                </div>
                <div className="gather-stamina"><span>STAMINA</span><div><i style={{ width: gatherStamina + "%" }} /></div><b>{gatherStamina}</b></div>
                <div className="gather-timing-game"><div className="gather-timing-zone-wide" /><i style={{ left: gatherTimingX + "%" }} /></div>
                <div className="g2d-progress"><i style={{ width: (gatherAction / gatherRequiredHits) * 100 + "%" }} /></div>
                <button className="g2d-main-action" onClick={interactGathering} disabled={gatherSwing || gatherStamina < 12}>
                  {gatherSwing ? "💥 타격!" : gatheringActivity === "wood" ? "🪓 약점 타격" : gatheringActivity === "stone" ? "⛏️ 약점 채굴" : "🛠️ 정확히 파기"} <small>E / SPACE</small>
                </button>
              </div>
            </section>
          )}
        </section>
      )}

      {!inventoryOpen && activeTab === "gather" && (
        <section className="mode-screen gather-screen">
          <div className="mode-screen-inner">
            <div className="mode-heading">
              <div>
                <div className="eyebrow">GATHERING · RESOURCE ZONE</div>
                <h2>⛏️ 채집</h2>
                <p>채집 장소를 한곳에 모아 필요한 장비와 생산량을 확인하세요.</p>
              </div>
              <div className="mode-stat">장비 보너스는 실제 채집량에 적용됩니다.</div>
            </div>
            <div className="gather-grid">
              {([
                ["wood", "🌲", "벌목장", "목재", "도끼", save.wood, "5G"],
                ["stone", "🪨", "광산", "석재", "곡괭이", save.stone, "8G"],
                ["dirt", "🟫", "토지", "흙", "삽", save.dirt, "3G"],
                ["fish", "🐟", "낚시터", "물고기", "낚싯대", save.fish, "12G"],
              ] as [ResourceType, string, string, string, Equipment["type"], number, string][]).map(([type, icon, place, label, tool, count, price]) => {
                const equipped = save.inventory.find((item) => item.id === save.equippedTools[tool]);
                return (
                  <article className="gather-card" key={type}>
                    <div className="gather-art">{icon}</div>
                    <div className="gather-card-copy">
                      <span>{place}</span>
                      <h3>{label}</h3>
                      <small>{tool} 필요 · 판매 {price}</small>
                    </div>
                    <div className="gather-card-bottom">
                      <b>보유 {count}</b>
                      <span>{equipped ? "+" + equipped.bonus + " /회" : "장비 없음"}</span>
                    </div>
                    <button onClick={() => openGatheringActivity(type)}>
                      {type === "fish" ? (equipped ? "🎣 바로 낚시하러 가기" : "🎒 낚싯대 장착 필요") : (equipped ? "▶ 미니게임 시작" : "🎒 " + tool + " 장착 필요")}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {!inventoryOpen && !gatheringActivity && activeTab === "shop" && (
        <section className="mode-screen shop-screen">
          <div className="mode-screen-inner">
            <div className="mode-heading"><div><div className="eyebrow">SHOP · SELL & UPGRADE</div><h2>🛒 상점</h2><p>모은 자원을 팔아 영지 운영 자금을 확보하세요.</p></div><div className="mode-stat">보유 골드 {save.gold.toLocaleString()}G</div></div>
            <div className="shop-page-card">
              <div className="shop-page-grid">
                <div><span>🌲 목재</span><b>{save.wood} × 5G</b><small>{save.wood * 5}G</small></div>
                <div><span>🪨 석재</span><b>{save.stone} × 8G</b><small>{save.stone * 8}G</small></div>
                <div><span>🟫 흙</span><b>{save.dirt} × 3G</b><small>{save.dirt * 3}G</small></div>
                <div><span>🐟 물고기</span><b>{save.fish} × 12G</b><small>{save.fish * 12}G</small></div>
                <div><span>🌾 농산물</span><b>{save.food} × 10G</b><small>{save.food * 10}G</small></div>
              </div>
              <div className="shop-page-total"><span>예상 판매 금액</span><b>{(save.wood * 5 + save.stone * 8 + save.dirt * 3 + save.fish * 12 + save.food * 10).toLocaleString()}G</b></div>
              <button className="sell-button" onClick={sellAll}>전부 판매하기</button>
              <button className="reset-button" onClick={resetGame}>저장 초기화</button>
            </div>
          </div>
        </section>
      )}

      {!inventoryOpen && !gatheringActivity && activeTab === "gacha" && (
        <section className="mode-screen gacha-screen">
          <div className="mode-screen-inner">
            <div className="mode-heading"><div><div className="eyebrow">GACHA · EQUIPMENT DRAW</div><h2>🎰 장비 뽑기</h2><p>뽑은 장비는 자동 장착되지 않습니다. 장비 탭에서 종류별로 장착하세요.</p></div><div className="mode-stat">다음 뽑기 {50 + save.inventory.length * 25}G</div></div>
            <div className="gacha-hero">
              <div className="gacha-machine">🎰</div>
              <div className="gacha-result">{shopRoll}</div>
              <button className="roll-button" onClick={rollTool}>장비 뽑기 · {50 + save.inventory.length * 25}G</button>
              <small>일반 50% · 고급 25% · 희귀 14% · 영웅 7% · 전설 3.5% · 신화 0.5%</small>
            </div>
            <div className="gacha-rates">
              {EQUIPMENT_TYPES.map((type) => <div key={type}><span>{type}</span><b>{type === "도끼" ? "🌲 목재" : type === "곡괭이" ? "🪨 석재" : type === "삽" ? "🟫 흙" : type === "낚싯대" ? "🐟 물고기" : "⚔️ 전투"}</b></div>)}
            </div>
          </div>
        </section>
      )}

      {!inventoryOpen && activeTab === "farm" && (
        <section className="mode-screen farm-screen">
          <div className="mode-screen-inner">
            <div className="mode-heading">
              <div>
                <div className="eyebrow">FARM · GROW & HARVEST</div>
                <h2>🌾 농장</h2>
                <p>씨앗을 심고 기다렸다가 수확하세요. 나중에는 농부와 자동화 시설로 확장합니다.</p>
              </div>
              <div className="farm-seeds">
                <span>🌾 {save.farmSeeds.밀}</span>
                <span>🥕 {save.farmSeeds.당근}</span>
                <span>🥔 {save.farmSeeds.감자}</span>
                <b>창고 농산물 {save.food}</b>
              </div>
            </div>
            <div className="farm-grid">
              {save.farmPlots.map((plot, index) => {
                const remaining = plot.readyAt ? Math.max(0, plot.readyAt - farmTick) : 0;
                const ready = Boolean(plot.crop && remaining <= 0);
                return (
                  <article className={"farm-plot " + (plot.crop ? "planted" : "empty")} key={index}>
                    <div className="plot-number">밭 {index + 1}</div>
                    <div className="plot-art">{plot.crop ? CROP_CONFIG[plot.crop].icon : "🟫"}</div>
                    {plot.crop ? (
                      <>
                        <h3>{plot.crop}</h3>
                        <p>{ready ? "수확 가능 · +" + CROP_CONFIG[plot.crop].yield + " 농산물" : Math.ceil(remaining / 1000) + "초 후 수확"}</p>
                        <button disabled={!ready} onClick={() => harvestCrop(index)}>{ready ? "🌾 수확하기" : "성장 중..."}</button>
                      </>
                    ) : (
                      <>
                        <h3>빈 밭</h3>
                        <p>씨앗을 선택해서 심으세요.</p>
                        <div className="seed-actions">
                          {(Object.keys(CROP_CONFIG) as CropType[]).map((crop) => (
                            <button key={crop} disabled={save.farmSeeds[crop] <= 0} onClick={() => plantCrop(index, crop)}>
                              {CROP_CONFIG[crop].icon} {crop}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {!inventoryOpen && !gatheringActivity && (
        <nav className="bottom-nav">
          <button className={activeTab === "estate" ? "active" : ""} onClick={() => setActiveTab("estate")}><span>🏰</span>영지</button>
          <button className={activeTab === "gather" ? "active" : ""} onClick={() => setActiveTab("gather")}><span>⛏️</span>채집</button>
          <button className={activeTab === "farm" ? "active" : ""} onClick={() => setActiveTab("farm")}><span>🌾</span>농장</button>
          <button className={activeTab === "shop" ? "active" : ""} onClick={() => setActiveTab("shop")}><span>🛒</span>상점</button>
          <button className={activeTab === "gacha" ? "active" : ""} onClick={() => setActiveTab("gacha")}><span>🎰</span>뽑기</button>
          <button onClick={() => { setInventoryOpen(true); setEquipmentFilter("도끼"); }}><span>🎒</span>장비</button>
        </nav>
      )}

      <div className="toast">{message}</div>

    </main>
  );
}

export default App;
