const MODULE_ID = "universal-animated-doors";
const LEGACY_MODULE_IDS = Object.freeze(["v11-animated-doors"]);
const PACKAGE_IDS = Object.freeze([MODULE_ID, ...LEGACY_MODULE_IDS]);
const CLOSING_LIGHT_RESTORE_FLAG = "closingLightRestore";
const DOOR_PRIMARY_SORT = -1;
const DOOR_ELEVATION_OFFSET = 0.01;

const DEFAULTS = Object.freeze({
  enabled: true,
  texture: "",
  animation: "swing",
  direction: "default",
  double: false,
  flip: false,
  duration: 500,
  strength: 1,
  refractLight: true,
  offsetX: 0,
  offsetY: 0
});

const DOOR_ANIMATIONS = ["none", "ascend", "descend", "slide", "swing", "swivel"];
const DIRECTIONS = ["default", "reverse"];
const CONFIG_FLAG_KEYS = ["enabled", "texture", "animation", "direction", "double", "flip", "duration", "strength", "refractLight", "offsetX", "offsetY"];
const LIGHT_UPDATE_TARGETS = Object.freeze({
  minMs: 28,
  maxMs: 88,
  samples: 16,
  minLeadMs: 10,
  maxLeadMs: 58,
  latencyBudgetMs: 38,
  criticalLatencyMs: 84,
  frameBudgetMs: 24,
  criticalFrameMs: 32,
  adaptUp: 1.12,
  criticalAdaptUp: 1.28,
  adaptDown: 0.82,
  recoverTicks: 8,
  recoverMs: 220
});

const stateOpen = () => CONST?.WALL_DOOR_STATES?.OPEN ?? 1;
const doorDoor = () => CONST?.WALL_DOOR_TYPES?.DOOR ?? 1;
const doorSecret = () => CONST?.WALL_DOOR_TYPES?.SECRET ?? 2;
const doorNone = () => CONST?.WALL_DOOR_TYPES?.NONE ?? 0;

const RU = Object.freeze({
  title: "Анимация двери",
  animation: "Тип анимации",
  texture: "Текстура двери",
  flip: "Отразить текстуру",
  double: "Две створки",
  duration: "Длительность",
  direction: "Направление открытия",
  strength: "Сила анимации",
  refractLight: "Свет",
  offsetX: "Сдвиг текстуры X",
  offsetY: "Сдвиг текстуры Y",
  sound: "Звук двери",
  choose: "Выбрать",
  none: "Нет",
  ascend: "Подъём",
  descend: "Спуск",
  slide: "Сдвиг",
  swing: "Распахивание",
  swivel: "Поворот",
  default: "Обычное",
  reverse: "Обратное",
  heavyWood: "Тяжёлая деревянная раздвижная дверь",
  heavyStone: "Тяжёлая каменная раздвижная дверь",
  heavyMetal: "Тяжёлая металлическая раздвижная дверь",
  prisonCell: "Тяжёлая дверь клетки камеры",
  cityGate: "Огромные металлические ворота города",
  saveError: "Не удалось сохранить настройки анимированной двери.",
  textureError: "Не удалось загрузить текстуру двери"
});

const MODULE_DOOR_SOUNDS = Object.freeze({
  uadHeavyWoodSliding: {
    label: "UAD.DoorSound.HeavyWoodSliding",
    file: "heavy-wooden-sliding-door.wav"
  },
  uadHeavyStoneSliding: {
    label: "UAD.DoorSound.HeavyStoneSliding",
    file: "heavy-stone-sliding-door.wav"
  },
  uadHeavyMetalSliding: {
    label: "UAD.DoorSound.HeavyMetalSliding",
    file: "heavy-metal-sliding-door.wav"
  },
  uadHeavyPrisonCell: {
    label: "UAD.DoorSound.HeavyPrisonCell",
    file: "heavy-prison-cell-door.wav"
  },
  uadHugeCityMetalGate: {
    label: "UAD.DoorSound.HugeCityMetalGate",
    file: "huge-city-metal-gate.m4a"
  }
});

const DOOR_SOUND_INTERACTIONS = Object.freeze(["open", "close", "lock", "unlock", "test"]);

function storedSetting(packageId, key) {
  for (const scope of ["world", "client"]) {
    const stored = game?.settings?.storage?.get?.(scope)?.get?.(`${packageId}.${key}`);
    if (stored && Object.prototype.hasOwnProperty.call(stored, "value")) return stored.value;
  }
  return undefined;
}

function setting(key) {
  try {
    const value = game.settings.get(MODULE_ID, key);
    if (value !== undefined) return value;
  } catch (error) {
    // The setting can be read before registration while Foundry is booting.
  }

  for (const id of LEGACY_MODULE_IDS) {
    const value = storedSetting(id, key);
    if (value !== undefined) return value;
  }

  return undefined;
}

function debug(...args) {
  if (setting("debug")) console.log(`${MODULE_ID} |`, ...args);
}

function refreshPrimarySort() {
  const primary = canvas?.primary;
  if (!primary) return;

  try {
    primary.sortDirty = true;
    primary.sortChildren?.();
  } catch (error) {
    debug("Could not sort primary canvas group", error);
  }
}

function clampNumber(value, min, max, fallback) {
  const normalized = typeof value === "string" ? value.trim().replace(",", ".") : value;
  const number = Number(normalized);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function asBoolean(value) {
  return value === true || value === "true" || value === "on" || value === 1 || value === "1";
}

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function lerp(from, to, t) {
  return from + ((to - from) * t);
}

function lerpAngle(from, to, t) {
  return from + normalizeAngle(to - from) * t;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function getWallDocument(wall) {
  return wall?.document ?? wall;
}

function getDocumentScene(document) {
  return document?.parent ?? document?.scene ?? null;
}

function isCurrentCanvasSceneDocument(document) {
  const scene = canvas?.scene;
  if (!scene || !document) return false;

  const documentScene = getDocumentScene(document);
  if (!documentScene) return true;

  return documentScene === scene
    || (documentScene.id && documentScene.id === scene.id)
    || (documentScene.uuid && documentScene.uuid === scene.uuid);
}

function getWallCoords(document) {
  const coords = document?.c ?? document?._source?.c;
  if (!Array.isArray(coords) || coords.length < 4) return null;
  return coords.map(Number);
}

function roundedSegment(segment) {
  return segment.map((value) => Math.round(Number(value)));
}

function sameCoords(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => value === b[index]);
}

function isDoorDocument(document) {
  const doorType = Number(document?.door ?? 0);
  return doorType === doorDoor() || doorType === doorSecret();
}

function isSecretDoorDocument(document) {
  return Number(document?.door ?? 0) === doorSecret();
}

function isDoorFormValue(value) {
  const doorType = Number(value ?? doorNone());
  return doorType === doorDoor() || doorType === doorSecret();
}

function isOpenDocument(document) {
  return Number(document?.ds ?? 0) === stateOpen();
}

function getPackageFlags(document) {
  for (const id of PACKAGE_IDS) {
    const flags = document?.flags?.[id];
    if (flags && typeof flags === "object" && CONFIG_FLAG_KEYS.some((key) => Object.prototype.hasOwnProperty.call(flags, key))) return flags;
  }
  return {};
}

function isTemporaryLightWall(document) {
  return PACKAGE_IDS.some((id) => Boolean(document?.flags?.[id]?.temporaryLightWall));
}

function getClosingLightRestore(document) {
  for (const id of PACKAGE_IDS) {
    const restore = document?.flags?.[id]?.[CLOSING_LIGHT_RESTORE_FLAG];
    if (restore && typeof restore === "object") return restore;
  }
  return null;
}

function isResponsibleGM() {
  if (!game?.user?.isGM) return false;
  const activeGMs = Array.from(game.users ?? [])
    .filter((user) => user?.active && user?.isGM)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return (activeGMs[0]?.id ?? game.user.id) === game.user.id;
}

function syncScenePerception() {
  try {
    canvas?.perception?.update?.({
      initializeLighting: true,
      initializeVision: true,
      initializeSounds: true,
      refreshTiles: true
    });
  } catch (error) {
    debug("Could not queue canvas perception refresh", error);
  }
}

function registerCoreDoorSounds() {
  const doorSounds = globalThis.CONFIG?.Wall?.doorSounds;
  if (!doorSounds) return;

  try {
    for (const [key, preset] of Object.entries(MODULE_DOOR_SOUNDS)) {
      const src = `modules/${MODULE_ID}/sounds/${preset.file}`;
      const entry = { label: preset.label };
      for (const interaction of DOOR_SOUND_INTERACTIONS) entry[interaction] = src;
      doorSounds[key] = entry;
    }
  } catch (error) {
    debug("Could not register core door sounds", error);
  }
}

function escapeHTML(value) {
  const text = String(value ?? "");
  if (foundry?.utils?.escapeHTML) return foundry.utils.escapeHTML(text);
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return text.replace(/[&<>"']/g, (char) => entities[char]);
}

function readDoorConfig(document) {
  const flags = getPackageFlags(document);
  const defaultTexture = setting("defaultTexture") || "";

  const cfg = {
    enabled: asBoolean(flags.enabled ?? DEFAULTS.enabled),
    texture: String(flags.texture ?? defaultTexture ?? DEFAULTS.texture).trim(),
    animation: String(flags.animation ?? DEFAULTS.animation),
    direction: String(flags.direction ?? DEFAULTS.direction),
    double: asBoolean(flags.double ?? DEFAULTS.double),
    flip: asBoolean(flags.flip ?? DEFAULTS.flip),
    duration: clampNumber(flags.duration, 0, 10000, DEFAULTS.duration),
    strength: clampNumber(flags.strength, 0, 3, DEFAULTS.strength),
    refractLight: asBoolean(flags.refractLight ?? DEFAULTS.refractLight),
    offsetX: clampNumber(flags.offsetX, -10000, 10000, DEFAULTS.offsetX),
    offsetY: clampNumber(flags.offsetY, -10000, 10000, DEFAULTS.offsetY)
  };

  if (!DOOR_ANIMATIONS.includes(cfg.animation)) cfg.animation = DEFAULTS.animation;
  if (!DIRECTIONS.includes(cfg.direction)) cfg.direction = DEFAULTS.direction;
  if (cfg.animation === "none") cfg.enabled = false;
  return cfg;
}

function cfgKey(cfg) {
  return [cfg.texture, cfg.animation, cfg.direction, cfg.double, cfg.flip, cfg.refractLight, cfg.offsetX, cfg.offsetY].join("|");
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstFiniteNumber(values, fallback = null) {
  for (const value of values) {
    const number = finiteNumber(value);
    if (number !== null) return number;
  }
  return fallback;
}

function wallElevationRange(document) {
  const flags = document?.flags ?? {};
  const helperRange = (() => {
    try {
      return CONFIG?.Levels?.helpers?.getRangeForDocument?.(document) ?? null;
    } catch (error) {
      return null;
    }
  })();

  const bottomCandidates = [
    helperRange?.rangeBottom,
    flags?.["wall-height"]?.bottom,
    flags?.levels?.rangeBottom,
    flags?.wallHeight?.wallHeightBottom,
    flags?.["wall-height"]?.heightBottom,
    document?.bottom,
    document?._source?.bottom,
    document?.elevation,
    document?._source?.elevation,
    flags?.levels?.wallHeightBottom,
    flags?.levels?.elevation
  ];

  const topCandidates = [
    helperRange?.rangeTop,
    flags?.["wall-height"]?.top,
    flags?.levels?.rangeTop,
    flags?.wallHeight?.wallHeightTop,
    flags?.["wall-height"]?.heightTop,
    document?.top,
    document?._source?.top,
    flags?.levels?.wallHeightTop
  ];

  const bottom = firstFiniteNumber(bottomCandidates, null);
  const top = firstFiniteNumber(topCandidates, null);

  return {
    bottom: bottom ?? 0,
    top: top ?? bottom ?? Infinity,
    hasRange: bottom !== null || top !== null
  };
}

function wallElevationValue(document) {
  return wallElevationRange(document).bottom;
}

function doorRenderElevationValue(document) {
  const elevation = wallElevationValue(document);
  return (Number.isFinite(elevation) ? elevation : 0) + DOOR_ELEVATION_OFFSET;
}

function wallGeometryKey(document) {
  const coords = getWallCoords(document);
  return `${coords?.map((value) => Math.round(Number(value))).join(",") ?? ""}|${doorRenderElevationValue(document)}`;
}

function doorSortIndex(document) {
  return DOOR_PRIMARY_SORT;
}

function activeLevelsElevation() {
  if (!game?.modules?.get?.("levels")?.active && !CONFIG?.Levels) return null;

  if (game?.user?.isGM && CONFIG?.Levels?.UI?.rangeEnabled) {
    const range = CONFIG.Levels.UI.currentRange ?? CONFIG.Levels.UI.getRange?.();
    const uiBottom = firstFiniteNumber([
      range?.bottom,
      CONFIG.Levels.UI.range?.[0]
    ], null);
    const uiTop = firstFiniteNumber([
      range?.top,
      CONFIG.Levels.UI.range?.[1]
    ], null);
    if (uiBottom !== null || uiTop !== null) {
      return {
        bottom: uiBottom ?? -Infinity,
        top: uiTop ?? Infinity,
        uiRange: true
      };
    }
  }

  const tokens = [
    CONFIG?.Levels?.currentToken,
    ...(canvas?.tokens?.controlled ?? [])
  ].filter(Boolean);
  const tokenElevations = [];
  for (const token of tokens) {
    const elevation = firstFiniteNumber([
      token?.losHeight,
      token?.document?.elevation,
      token?.elevation
    ], null);
    if (elevation !== null) tokenElevations.push(elevation);
  }
  if (tokenElevations.length) {
    return { elevations: Array.from(new Set(tokenElevations)), uiRange: false };
  }

  const visionSources = Array.from(canvas?.effects?.visionSources?.values?.() ?? []);
  const visionElevations = [];
  for (const source of visionSources) {
    const elevation = finiteNumber(source?.elevation);
    if (elevation !== null) visionElevations.push(elevation);
  }
  if (visionElevations.length) {
    return { elevations: Array.from(new Set(visionElevations)), uiRange: false };
  }

  return null;
}

function doorVisibleForActiveLevel(document) {
  const active = activeLevelsElevation();
  if (!active) return true;

  const range = wallElevationRange(document);
  if (!range.hasRange) return true;

  const bottom = Number.isFinite(range.bottom) ? range.bottom : -Infinity;
  const top = Number.isFinite(range.top) ? range.top : Infinity;
  if (active.uiRange) {
    const activeBottom = Number.isFinite(active.bottom) ? active.bottom : -Infinity;
    const activeTop = Number.isFinite(active.top) ? active.top : Infinity;
    return rangesOverlap(bottom, top, activeBottom, activeTop);
  }

  const elevations = Array.isArray(active.elevations) ? active.elevations : [active.elevation];
  return elevations.some((elevation) => elevationInRange(elevation, bottom, top));
}

function rangesOverlap(bottom, top, activeBottom, activeTop) {
  if (activeTop <= activeBottom) return elevationInRange(activeBottom, bottom, top);
  if (top <= bottom) return elevationInRange(bottom, activeBottom, activeTop);
  return bottom < activeTop && top > activeBottom;
}

function elevationInRange(elevation, bottom, top) {
  if (!Number.isFinite(elevation)) return false;
  if (elevation < bottom) return false;
  return Number.isFinite(top) ? elevation < top : true;
}

function copyFiniteProps(source, keys) {
  const result = {};
  for (const key of keys) {
    const value = finiteNumber(source?.[key]);
    if (value !== null) result[key] = value;
  }
  return result;
}

function wallHeightFlagsForTemporaryWall(document) {
  const flags = document?.flags ?? {};
  const copied = {};

  const wallHeight = copyFiniteProps(flags?.["wall-height"], ["bottom", "top", "heightBottom", "heightTop"]);
  if (Object.keys(wallHeight).length) copied["wall-height"] = wallHeight;

  const levels = copyFiniteProps(flags?.levels, ["rangeBottom", "rangeTop", "elevation", "wallHeightBottom", "wallHeightTop"]);
  if (Object.keys(levels).length) copied.levels = levels;

  const legacyWallHeight = copyFiniteProps(flags?.wallHeight, ["wallHeightBottom", "wallHeightTop"]);
  if (Object.keys(legacyWallHeight).length) copied.wallHeight = legacyWallHeight;

  return copied;
}

async function loadDoorTexture(path) {
  if (!path) return null;
  try {
    if (typeof loadTexture === "function") return await loadTexture(path);

    const texture = PIXI.Texture.from(path);
    if (texture?.baseTexture && !texture.baseTexture.valid) {
      await new Promise((resolve, reject) => {
        texture.baseTexture.once("loaded", resolve);
        texture.baseTexture.once("error", reject);
      });
    }
    return texture;
  } catch (error) {
    if (setting("debug")) {
      ui.notifications.warn(`${RU.textureError}: ${path}`);
      console.warn(`${MODULE_ID} | Failed to load texture`, path, error);
    }
    return null;
  }
}

function textureSize(texture) {
  return {
    width: Number(texture?.orig?.width || texture?.frame?.width || texture?.width || texture?.baseTexture?.width || 1),
    height: Number(texture?.orig?.height || texture?.frame?.height || texture?.height || texture?.baseTexture?.height || 1)
  };
}

function textureSlice(texture, part) {
  if (!texture || !part || part === "full") return texture;

  const baseTexture = texture.baseTexture;
  const frame = texture.frame;
  if (!baseTexture || !frame) return texture;

  const x = Number(frame.x || 0);
  const y = Number(frame.y || 0);
  const width = Number(frame.width || texture.width || 1);
  const height = Number(frame.height || texture.height || 1);
  const half = width / 2;
  const rect = part === "right"
    ? new PIXI.Rectangle(x + half, y, half, height)
    : new PIXI.Rectangle(x, y, half, height);

  try {
    return new PIXI.Texture(baseTexture, rect);
  } catch (error) {
    debug("Could not create split texture", error);
    return texture;
  }
}

class AnimatedDoorOverlay {
  constructor(document, cfg, texture, { initialOpen = isOpenDocument(document) } = {}) {
    this.document = document;
    this.cfg = cfg;
    this.texture = texture;
    this.key = cfgKey(cfg);
    this.geometryKey = wallGeometryKey(document);
    this.root = new PIXI.Container();
    this.root.name = `${MODULE_ID}.${document.id}`;
    this.root.sortableChildren = true;
    this.root.interactive = false;
    this.root.interactiveChildren = false;
    this.root.eventMode = "none";
    this.panels = [];
    this._raf = null;
    this._destroyed = false;
    this.updateSort();
    this.updateTextureOffset();
    this.updateLevelVisibility();
    this.rebuildPanels();
    this.applyState(initialOpen, false);
  }

  destroy() {
    lightBender?.stop?.(this.document?.id);
    this._destroyed = true;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this.root.destroy({ children: true });
  }

  updateDocument(document, cfg, texture) {
    this.document = document;
    this.cfg = cfg;
    if (texture) this.texture = texture;
    const nextKey = cfgKey(cfg);
    const nextGeometryKey = wallGeometryKey(document);
    if (nextKey !== this.key || nextGeometryKey !== this.geometryKey) {
      this.key = nextKey;
      this.geometryKey = nextGeometryKey;
      this.updateSort();
      this.updateTextureOffset();
      this.rebuildPanels();
    }
    this.updateLevelVisibility();
  }

  updateSort() {
    const sort = doorSortIndex(this.document);
    this.root.zIndex = sort;
    this.root.sort = sort;
    this.root.elevation = doorRenderElevationValue(this.document);
    this.root.shouldRenderDepth = false;
    if (this.root.parent === canvas?.primary) refreshPrimarySort();
  }

  updateTextureOffset() {
    const x = clampNumber(this.cfg?.offsetX, -10000, 10000, 0);
    const y = clampNumber(this.cfg?.offsetY, -10000, 10000, 0);
    this.root.position.set(x, y);
  }

  updateLevelVisibility() {
    this.root.visible = doorVisibleForActiveLevel(this.document);
  }

  rebuildPanels() {
    for (const child of this.root.removeChildren()) child.destroy({ children: true });
    this.panels = [];

    const coords = getWallCoords(this.document);
    if (!coords || !this.texture) return;

    const [x1, y1, x2, y2] = coords;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (!Number.isFinite(length) || length <= 0) return;

    const angle = Math.atan2(dy, dx);
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const createSwingPanel = ({ startX, startY, endX, endY, width, texture, name, mirrorX, slideSign = 1 }) => {
      const hingeAtEnd = Boolean(mirrorX);
      this.createPanel({
        x: hingeAtEnd ? endX : startX,
        y: hingeAtEnd ? endY : startY,
        angle,
        width,
        anchorX: hingeAtEnd ? 1 : 0,
        texture,
        name,
        swingSign: hingeAtEnd ? -1 : 1,
        slideSign,
        mirrorX
      });
    };

    if (this.cfg.double) {
      const half = length / 2;
      const leftTexture = this.texture;
      const rightTexture = this.texture;

      if (this.cfg.animation === "swing") {
        createSwingPanel({ startX: x1, startY: y1, endX: midX, endY: midY, width: half, texture: leftTexture, name: "left", mirrorX: this.cfg.flip, slideSign: -1 });
        createSwingPanel({ startX: midX, startY: midY, endX: x2, endY: y2, width: half, texture: rightTexture, name: "right", mirrorX: !this.cfg.flip, slideSign: 1 });
        return;
      }

      if (this.cfg.animation === "slide") {
        this.createPanel({ x: x1, y: y1, angle, width: half, anchorX: 0, texture: leftTexture, name: "left", swingSign: 1, slideSign: -1, mirrorX: this.cfg.flip });
        this.createPanel({ x: x2, y: y2, angle, width: half, anchorX: 1, texture: rightTexture, name: "right", swingSign: -1, slideSign: 1, mirrorX: !this.cfg.flip });
        return;
      }

      const leftCenterX = (x1 + midX) / 2;
      const leftCenterY = (y1 + midY) / 2;
      const rightCenterX = (midX + x2) / 2;
      const rightCenterY = (midY + y2) / 2;
      this.createPanel({ x: leftCenterX, y: leftCenterY, angle, width: half, anchorX: 0.5, texture: leftTexture, name: "left", swingSign: 1, slideSign: -1, mirrorX: this.cfg.flip });
      this.createPanel({ x: rightCenterX, y: rightCenterY, angle, width: half, anchorX: 0.5, texture: rightTexture, name: "right", swingSign: -1, slideSign: 1, mirrorX: !this.cfg.flip });
      return;
    }

    if (this.cfg.animation === "swing") {
      createSwingPanel({ startX: x1, startY: y1, endX: x2, endY: y2, width: length, texture: this.texture, name: "single", mirrorX: this.cfg.flip });
      return;
    }

    this.createPanel({ x: midX, y: midY, angle, width: length, anchorX: 0.5, texture: this.texture, name: "single", swingSign: 1, slideSign: 1, mirrorX: this.cfg.flip });
  }

  createPanel({ x, y, angle, width, anchorX, texture, name, swingSign = 1, slideSign = 1, mirrorX = false }) {
    const container = new PIXI.Container();
    container.name = `${MODULE_ID}.${name}.container`;
    container.interactive = false;
    container.interactiveChildren = false;
    container.eventMode = "none";
    container.position.set(x, y);
    container.rotation = angle;

    const sprite = new PIXI.Sprite(texture);
    sprite.name = `${MODULE_ID}.${name}.sprite`;
    sprite.anchor.set(mirrorX ? 1 - anchorX : anchorX, 0.5);
    sprite.interactive = false;
    sprite.eventMode = "none";

    const size = textureSize(texture);
    const gridSize = Number(canvas?.grid?.size || canvas?.dimensions?.size || 0);
    const scaleX = width / Math.max(1, size.width);
    const maxNaturalHeight = gridSize > 0 ? Math.min(size.height, gridSize) : size.height;
    const scaleY = Math.min(1, maxNaturalHeight / Math.max(1, size.height));
    sprite.scale.x = mirrorX ? -scaleX : scaleX;
    sprite.scale.y = scaleY;

    container.addChild(sprite);
    this.root.addChild(container);

    this.panels.push({
      container,
      sprite,
      baseX: x,
      baseY: y,
      baseAngle: angle,
      width,
      anchorX,
      swingSign,
      slideSign
    });
  }

  getTargets(open) {
    const sign = this.cfg.direction === "reverse" ? -1 : 1;
    const strength = Math.max(0.05, this.cfg.strength);
    const targets = [];

    for (const panel of this.panels) {
      let x = panel.baseX;
      let y = panel.baseY;
      let rotation = panel.baseAngle;
      let alpha = 1;
      let scale = 1;

      if (open) {
        const tangentX = Math.cos(panel.baseAngle);
        const tangentY = Math.sin(panel.baseAngle);
        const normalX = -Math.sin(panel.baseAngle);
        const normalY = Math.cos(panel.baseAngle);

        switch (this.cfg.animation) {
          case "swing": {
            const arc = Math.min(Math.PI * 0.85, (Math.PI / 2) * strength);
            rotation = panel.baseAngle + (arc * sign * panel.swingSign);
            break;
          }
          case "slide": {
            const distance = panel.width * strength;
            const slideSign = (this.cfg.double ? panel.slideSign : panel.slideSign) * sign;
            x += tangentX * distance * slideSign;
            y += tangentY * distance * slideSign;
            break;
          }
          case "ascend": {
            const distance = panel.width * 0.55 * strength;
            x += normalX * distance * sign;
            y += normalY * distance * sign;
            alpha = 0.15;
            scale = 1.15;
            break;
          }
          case "descend": {
            const distance = panel.width * 0.35 * strength;
            x -= normalX * distance * sign;
            y -= normalY * distance * sign;
            alpha = 0.65;
            scale = Math.max(0.2, 1 - (0.45 * strength));
            break;
          }
          case "swivel": {
            const arc = Math.min(Math.PI, (Math.PI / 2) * strength);
            rotation = panel.baseAngle + (arc * sign * panel.swingSign);
            break;
          }
        }
      }

      targets.push({ panel, x, y, rotation, alpha, scale });
    }

    return targets;
  }

  applyState(open, animate = true) {
    if (this._destroyed) return;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;

    const targets = this.getTargets(open);
    const duration = animate ? Math.max(0, this.cfg.duration) : 0;

    if (!duration) {
      lightBender?.stop?.(this.document?.id);
      for (const target of targets) {
        target.panel.container.position.set(target.x, target.y);
        target.panel.container.rotation = target.rotation;
        target.panel.container.alpha = target.alpha;
        target.panel.container.scale.set(target.scale, target.scale);
      }
      return;
    }

    const starts = targets.map((target) => ({
      panel: target.panel,
      x: target.panel.container.x,
      y: target.panel.container.y,
      rotation: target.panel.container.rotation,
      alpha: target.panel.container.alpha,
      scale: target.panel.container.scale.x || 1
    }));

    const start = performance.now();

    if (this.cfg.refractLight) {
      lightBender?.start?.(this.document, this, { duration, closing: !open, starts, targets, startedAt: start });
    } else {
      lightBender?.stop?.(this.document?.id);
    }

    const step = (now) => {
      if (this._destroyed) return;
      const rawT = Math.min(1, (now - start) / duration);
      const t = easeOutCubic(rawT);

      for (let i = 0; i < targets.length; i += 1) {
        const target = targets[i];
        const from = starts[i];
        const container = target.panel.container;
        container.position.set(lerp(from.x, target.x, t), lerp(from.y, target.y, t));
        container.rotation = lerpAngle(from.rotation, target.rotation, t);
        container.alpha = lerp(from.alpha, target.alpha, t);
        const scale = lerp(from.scale, target.scale, t);
        container.scale.set(scale, scale);
      }

      if (rawT < 1) this._raf = requestAnimationFrame(step);
      else this._raf = null;
    };

    this._raf = requestAnimationFrame(step);
  }

  getPanelSegment(panel, frame) {
    if (!panel || !frame) return null;

    const scale = Math.abs(frame.scale || 1);
    const width = panel.width * scale;
    const left = -panel.anchorX * width;
    const right = (1 - panel.anchorX) * width;
    const cos = Math.cos(frame.rotation);
    const sin = Math.sin(frame.rotation);

    const x0 = frame.x + (cos * left);
    const y0 = frame.y + (sin * left);
    const x1 = frame.x + (cos * right);
    const y1 = frame.y + (sin * right);

    if ([x0, y0, x1, y1].every(Number.isFinite) && Math.hypot(x1 - x0, y1 - y0) > 1) {
      return [x0, y0, x1, y1];
    }

    return null;
  }

  getFrameSegments(frames) {
    const segments = [];

    for (const frame of frames) {
      const segment = this.getPanelSegment(frame.panel, frame);
      if (segment) segments.push(segment);
    }

    return segments;
  }

  getSegmentsAt(starts, targets, rawT) {
    const progress = Math.min(1, Math.max(0, Number(rawT) || 0));
    const t = easeOutCubic(progress);

    return this.getFrameSegments(targets.map((target, index) => {
      const from = starts[index] ?? target;
      return {
        panel: target.panel,
        x: lerp(from.x, target.x, t),
        y: lerp(from.y, target.y, t),
        rotation: lerpAngle(from.rotation, target.rotation, t),
        scale: lerp(from.scale ?? 1, target.scale ?? 1, t)
      };
    }));
  }

  getCurrentSegments() {
    return this.getFrameSegments(this.panels.map((panel) => {
      const container = panel.container;
      if (!container || container.destroyed) return null;

      return {
        panel,
        x: container.x,
        y: container.y,
        rotation: container.rotation,
        scale: container.scale?.x || 1
      };
    }).filter(Boolean));
  }
}

class AnimatedDoorLightBender {
  constructor() {
    this.active = new Map();
    this.ignoredSourceUpdates = new Set();
  }

  normalizeLightData(source, document = null) {
    const sight = Number(source?.sight ?? document?.sight ?? 0);
    const light = Number(source?.light ?? document?.light ?? sight ?? 0);
    const dir = Number(source?.dir ?? document?.dir ?? 0);

    return {
      sight: Number.isFinite(sight) ? sight : 0,
      light: Number.isFinite(light) ? light : 0,
      dir: Number.isFinite(dir) ? dir : 0
    };
  }

  hasBlockingLight(data) {
    return Number(data?.sight ?? 0) !== 0 || Number(data?.light ?? 0) !== 0;
  }

  getSourceLightData(document) {
    const flagged = getClosingLightRestore(document);
    return this.normalizeLightData(flagged ?? document, document);
  }

  updateIntervalForDuration(duration) {
    const safeDuration = Math.max(1, Number(duration) || 1);
    const interval = Math.round(safeDuration / LIGHT_UPDATE_TARGETS.samples);
    return this.clampUpdateInterval(interval);
  }

  clampUpdateInterval(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return LIGHT_UPDATE_TARGETS.minMs;
    return Math.max(LIGHT_UPDATE_TARGETS.minMs, Math.min(LIGHT_UPDATE_TARGETS.maxMs, number));
  }

  adaptIntervalForLoad(state, { latency = null, frameGap = null } = {}) {
    if (!state) return;

    const now = performance.now();
    const baseInterval = Number(state.baseIntervalMs) || LIGHT_UPDATE_TARGETS.minMs;
    const interval = Number(state.intervalMs) || baseInterval;
    const latencyOver = Number.isFinite(latency) && latency > LIGHT_UPDATE_TARGETS.latencyBudgetMs;
    const latencyCritical = Number.isFinite(latency) && latency > LIGHT_UPDATE_TARGETS.criticalLatencyMs;
    const frameOver = Number.isFinite(frameGap) && frameGap > LIGHT_UPDATE_TARGETS.frameBudgetMs;
    const frameCritical = Number.isFinite(frameGap) && frameGap > LIGHT_UPDATE_TARGETS.criticalFrameMs;

    if (latencyOver || frameOver) {
      const observed = Math.max(
        Number.isFinite(latency) ? latency : 0,
        Number.isFinite(frameGap) ? frameGap : 0,
        interval
      );
      const critical = latencyCritical || frameCritical;
      state.loadStrikes = (state.loadStrikes || 0) + 1;
      state.lastLoadAt = now;
      if (!critical && state.loadStrikes < 3) return;

      const multiplier = critical ? LIGHT_UPDATE_TARGETS.criticalAdaptUp : LIGHT_UPDATE_TARGETS.adaptUp;
      const observedTarget = critical ? observed * 1.1 : interval;
      const nextInterval = this.clampUpdateInterval(Math.max(interval * multiplier, observedTarget));
      if (nextInterval > interval) {
        const lastSentAt = Number(state.lastUpdateSentAt) || 0;
        if (lastSentAt) state.nextUpdateAt = Math.max(Number(state.nextUpdateAt) || 0, lastSentAt + nextInterval);
      }
      state.intervalMs = nextInterval;
      state.stableLightTicks = 0;
      return;
    }

    state.loadStrikes = 0;
    state.stableLightTicks = (state.stableLightTicks || 0) + 1;
    const lastLoadAt = Number(state.lastLoadAt) || 0;
    const lastRecoverAt = Number(state.lastRecoverAt) || 0;
    const canRecover = (!lastLoadAt || now - lastLoadAt >= LIGHT_UPDATE_TARGETS.recoverMs)
      && (!lastRecoverAt || now - lastRecoverAt >= LIGHT_UPDATE_TARGETS.recoverMs);

    if (canRecover && state.stableLightTicks >= LIGHT_UPDATE_TARGETS.recoverTicks && interval > baseInterval) {
      state.intervalMs = Math.max(baseInterval, this.clampUpdateInterval(interval * LIGHT_UPDATE_TARGETS.adaptDown));
      state.stableLightTicks = 0;
      state.lastRecoverAt = now;
    }
  }

  updateLeadForState(state) {
    const interval = Number(state?.intervalMs) || LIGHT_UPDATE_TARGETS.minMs;
    const latency = Number.isFinite(state?.updateLatencyMs) ? state.updateLatencyMs : interval;
    return Math.min(
      LIGHT_UPDATE_TARGETS.maxLeadMs,
      Math.max(LIGHT_UPDATE_TARGETS.minLeadMs, Math.round((interval * 0.35) + (latency * 0.25)))
    );
  }

  startFrameMonitor(sourceId, token) {
    if (typeof requestAnimationFrame !== "function") return;

    const state = this.active.get(sourceId);
    if (!state || state.token !== token || state.frameRaf) return;

    const sample = (now) => {
      const current = this.active.get(sourceId);
      if (!current || current.token !== token || current.cleaning) return;

      if (Number.isFinite(current.lastFrameAt)) {
        const gap = now - current.lastFrameAt;
        if (Number.isFinite(gap) && gap > 0) {
          current.frameGapMs = Number.isFinite(current.frameGapMs)
            ? lerp(current.frameGapMs, gap, 0.35)
            : gap;
          this.adaptIntervalForLoad(current, { frameGap: current.frameGapMs });
        }
      }

      current.lastFrameAt = now;
      current.frameRaf = requestAnimationFrame(sample);
    };

    state.frameRaf = requestAnimationFrame(sample);
  }

  getOverlaySegments(overlay, timeline, duration, sampleAt) {
    if (timeline && typeof overlay?.getSegmentsAt === "function") {
      const rawT = duration > 0 ? (sampleAt - timeline.startedAt) / duration : 1;
      return overlay.getSegmentsAt(timeline.starts, timeline.targets, rawT);
    }

    return overlay?.getCurrentSegments?.() ?? [];
  }

  collectWallUpdates(state, segments) {
    if (!segments.length || !state.ids.length) return [];

    const updates = [];
    for (let index = 0; index < state.ids.length; index += 1) {
      const id = state.ids[index];
      const coords = roundedSegment(segments[index] ?? segments[segments.length - 1]);
      if (!coords.every(Number.isFinite) || Math.hypot(coords[2] - coords[0], coords[3] - coords[1]) <= 1) continue;
      if (sameCoords(coords, state.lastCoords[index])) continue;

      state.lastCoords[index] = coords;
      updates.push({ _id: id, c: coords });
    }

    return updates;
  }

  storePendingUpdates(state, updates) {
    if (!state.pendingUpdates) state.pendingUpdates = new Map();
    for (const update of updates) state.pendingUpdates.set(update._id, update);
  }

  schedulePendingUpdates(scene, sourceId, token) {
    const state = this.active.get(sourceId);
    if (!scene || !state || state.token !== token || state.cleaning || !state.pendingUpdates?.size) return;
    if (state.updateInFlight || state.drainTimer) return;

    const waitMs = Math.max(1, (Number(state.nextUpdateAt) || 0) - performance.now());
    state.drainTimer = setTimeout(() => {
      const current = this.active.get(sourceId);
      if (!current || current.token !== token || current.cleaning) return;

      current.drainTimer = null;
      if (current.updateInFlight || !current.pendingUpdates?.size) return;

      const pending = current.pendingUpdates;
      current.pendingUpdates = null;
      this.queueWallUpdates(scene, sourceId, token, Array.from(pending.values()));
    }, waitMs);
  }

  queueWallUpdates(scene, sourceId, token, updates) {
    const state = this.active.get(sourceId);
    if (!scene || !state || state.token !== token || state.cleaning || !updates.length) return;

    if (state.updateInFlight) {
      this.storePendingUpdates(state, updates);
      return;
    }

    const now = performance.now();
    if ((Number(state.nextUpdateAt) || 0) > now) {
      this.storePendingUpdates(state, updates);
      this.schedulePendingUpdates(scene, sourceId, token);
      return;
    }

    if (state.drainTimer) {
      clearTimeout(state.drainTimer);
      state.drainTimer = null;
    }

    state.updateInFlight = true;
    const sentAt = performance.now();
    state.lastUpdateSentAt = sentAt;
    state.nextUpdateAt = sentAt + (Number(state.intervalMs) || LIGHT_UPDATE_TARGETS.minMs);

    scene.updateEmbeddedDocuments("Wall", updates, { render: false, diff: false })
      .catch((error) => {
        debug("Could not update temporary light walls", error);
      })
      .finally(() => {
        const current = this.active.get(sourceId);
        if (!current || current.token !== token) return;

        const elapsed = performance.now() - sentAt;
        if (Number.isFinite(elapsed)) {
          current.updateLatencyMs = Number.isFinite(current.updateLatencyMs)
            ? lerp(current.updateLatencyMs, elapsed, 0.25)
            : elapsed;
          this.adaptIntervalForLoad(current, { latency: elapsed });
        }

        current.nextUpdateAt = Math.max(
          Number(current.nextUpdateAt) || 0,
          sentAt + (Number(current.intervalMs) || LIGHT_UPDATE_TARGETS.minMs)
        );
        current.updateInFlight = false;
        if (current.cleaning) return;

        this.schedulePendingUpdates(scene, sourceId, token);
      });
  }

  shouldRun(document, overlay, lightData = null) {
    if (!canvas?.ready || !canvas?.scene || !document?.id || !overlay) return false;
    if (!isResponsibleGM()) return false;
    if (!isCurrentCanvasSceneDocument(document)) return false;
    if (isTemporaryLightWall(document)) return false;

    const cfg = overlay.cfg ?? readDoorConfig(document);
    if (!cfg.refractLight || !cfg.duration || cfg.animation === "none") return false;

    return this.hasBlockingLight(lightData ?? this.getSourceLightData(document));
  }

  shouldPrepareClosing(document, changes) {
    if (!document?.id || !changes) return false;
    if (!isResponsibleGM()) return false;
    if (!isDoorDocument(document) || !isOpenDocument(document)) return false;
    if (!Object.prototype.hasOwnProperty.call(changes, "ds")) return false;
    return Number(changes.ds ?? 0) !== stateOpen();
  }

  prepareClosing(document, changes) {
    if (!this.shouldPrepareClosing(document, changes)) return;

    const cfg = readDoorConfig(document);
    if (!cfg.refractLight || !cfg.duration || cfg.animation === "none") return;

    const restore = this.normalizeLightData(document);
    if (!this.hasBlockingLight(restore)) return;
  }

  shouldIgnoreSourceWallUpdate(document, changes = {}) {
    if (!this.ignoredSourceUpdates.has(document?.id)) return false;
    return !Object.prototype.hasOwnProperty.call(changes, "ds");
  }

  markSourceUpdateIgnored(sourceId) {
    if (!sourceId) return;
    this.ignoredSourceUpdates.add(sourceId);
    setTimeout(() => this.ignoredSourceUpdates.delete(sourceId), 500);
  }

  restoreUpdateData(sourceId, restore) {
    const data = this.normalizeLightData(restore);
    const update = {
      _id: sourceId,
      sight: data.sight,
      light: data.light
    };

    for (const id of PACKAGE_IDS) update[`flags.${id}.-=${CLOSING_LIGHT_RESTORE_FLAG}`] = null;
    return update;
  }

  wallDataForSegment(document, segment, lightData = null) {
    const { sight, light, dir } = lightData ?? this.getSourceLightData(document);
    const flags = {
      ...wallHeightFlagsForTemporaryWall(document),
      [MODULE_ID]: {
        temporaryLightWall: true,
        source: document.id
      }
    };

    return {
      c: roundedSegment(segment),
      move: 0,
      sight,
      light,
      sound: 0,
      dir,
      door: doorNone(),
      ds: 0,
      flags
    };
  }

  async start(document, overlay, { duration = 0, closing = false, starts = null, targets = null, startedAt = null } = {}) {
    if (!document?.id) return;
    const sourceId = document.id;
    this.stop(sourceId);

    const sourceLightData = this.getSourceLightData(document);
    if (!this.shouldRun(document, overlay, sourceLightData)) return;

    const scene = canvas.scene;
    const token = foundry?.utils?.randomID?.() ?? `${Date.now()}-${Math.random()}`;
    const durationMs = Math.max(0, Number(duration) || 0);
    const intervalMs = this.updateIntervalForDuration(durationMs);
    const animationStartedAt = Number.isFinite(Number(startedAt)) ? Number(startedAt) : performance.now();
    const timeline = Array.isArray(starts) && starts.length && Array.isArray(targets) && targets.length
      ? { starts, targets, startedAt: animationStartedAt }
      : null;
    const initialSegments = this.getOverlaySegments(overlay, timeline, durationMs, animationStartedAt);
    if (!initialSegments.length) return;
    const initialCoords = initialSegments.map(roundedSegment);

    const state = {
      token,
      ids: [],
      timer: null,
      drainTimer: null,
      updateInFlight: false,
      pendingUpdates: null,
      updateLatencyMs: intervalMs,
      baseIntervalMs: intervalMs,
      intervalMs,
      stableLightTicks: 0,
      loadStrikes: 0,
      lastLoadAt: 0,
      lastRecoverAt: 0,
      lastUpdateSentAt: 0,
      frameRaf: null,
      lastFrameAt: null,
      frameGapMs: null,
      cleaning: false,
      closing,
      scene,
      restore: null,
      lastCoords: initialCoords.map((coords) => coords.slice())
    };
    this.active.set(sourceId, state);

    try {
      const created = await scene.createEmbeddedDocuments(
        "Wall",
        initialCoords.map((segment) => this.wallDataForSegment(document, segment, sourceLightData)),
        { render: false }
      );

      if (this.active.get(sourceId)?.token !== token) {
        const ids = created.map((wall) => wall.id).filter(Boolean);
        if (ids.length) await scene.deleteEmbeddedDocuments("Wall", ids, { render: false });
        return;
      }

      state.ids = created.map((wall) => wall.id).filter(Boolean);
      this.startFrameMonitor(sourceId, token);

      const tick = () => {
        const current = this.active.get(sourceId);
        if (!current || current.token !== token || current.cleaning) return;

        const now = performance.now();
        const elapsed = now - animationStartedAt;
        const leadMs = this.updateLeadForState(current);
        const sampleAt = Math.min(animationStartedAt + durationMs, now + leadMs);
        const segments = this.getOverlaySegments(overlay, timeline, durationMs, sampleAt);
        const updates = this.collectWallUpdates(current, segments);
        if (updates.length) this.queueWallUpdates(scene, sourceId, token, updates);

        if (elapsed >= durationMs) {
          this.stop(sourceId);
          return;
        }

        const remaining = Math.max(1, durationMs - (performance.now() - animationStartedAt));
        current.timer = setTimeout(tick, Math.min(current.intervalMs, remaining));
      };

      state.timer = setTimeout(tick, 0);
    } catch (error) {
      debug("Could not start light refraction", error);
      this.stop(sourceId);
    }
  }

  stop(sourceId) {
    const state = this.active.get(sourceId);
    if (!state) return;

    this.active.delete(sourceId);
    state.cleaning = true;
    if (state.timer) clearTimeout(state.timer);
    if (state.drainTimer) clearTimeout(state.drainTimer);
    if (state.frameRaf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(state.frameRaf);

    this.finishState(sourceId, state);
  }

  async finishState(sourceId, state) {
    try {
      const scene = state.scene ?? canvas?.scene;
      if (state.ids?.length && scene) {
        await scene.deleteEmbeddedDocuments("Wall", state.ids, { render: false });
      }
    } catch (error) {
      debug("Could not finish light refraction cleanup", error);
    }
  }

  async cleanupScene() {
    if (!canvas?.scene || !isResponsibleGM()) return;

    const walls = Array.from(canvas.scene.walls ?? []);
    const ids = walls
      .filter((wall) => isTemporaryLightWall(wall))
      .map((wall) => wall.id)
      .filter(Boolean);

    const restoreUpdates = walls
      .filter((wall) => !isTemporaryLightWall(wall))
      .map((wall) => {
        const restore = getClosingLightRestore(wall);
        return restore && wall?.id ? this.restoreUpdateData(wall.id, restore) : null;
      })
      .filter(Boolean);

    if (!ids.length && !restoreUpdates.length) return;

    try {
      for (const update of restoreUpdates) this.markSourceUpdateIgnored(update._id);
      if (restoreUpdates.length) await canvas.scene.updateEmbeddedDocuments("Wall", restoreUpdates, { render: false, diff: false });
      if (ids.length) await canvas.scene.deleteEmbeddedDocuments("Wall", ids, { render: false });
      syncScenePerception();
    } catch (error) {
      debug("Could not clean up temporary light walls", error);
    }
  }

  stopAll() {
    for (const sourceId of Array.from(this.active.keys())) this.stop(sourceId);
  }
}

const lightBender = new AnimatedDoorLightBender();

class AnimatedDoorManager {
  constructor() {
    this.container = null;
    this.ownsContainer = false;
    this.doors = new Map();
    this.loading = new Map();
    this.secretHideTimers = new Map();
  }

  getOverlayParent() {
    // Render door artwork in the primary canvas group so Scene foregrounds and
    // wall/roof tiles can naturally occlude it by elevation and sort order.
    const primary = canvas?.primary;
    if (primary && typeof primary.addChild === "function") return primary;

    const wallsLayer = canvas?.walls;
    if (wallsLayer && typeof wallsLayer.addChild === "function") return wallsLayer;

    const candidates = [canvas?.interface, canvas?.primary, canvas?.stage, canvas?.background];
    return candidates.find((parent) => parent && typeof parent.addChild === "function") ?? null;
  }

  usesSharedOverlayParent(parent) {
    return parent && parent === canvas?.primary;
  }

  placeContainerBelowWalls(parent) {
    if (!parent || !this.container) return;

    const wallsLayer = canvas?.walls;

    if (parent === wallsLayer) {
      this.container.zIndex = -100000;
      if ("eventMode" in this.container) this.container.eventMode = "none";
      this.container.interactive = false;
      this.container.interactiveChildren = false;

      if (this.container.parent !== parent) parent.addChildAt(this.container, 0);

      // Some Foundry layers enable PIXI child sorting during redraws.  Give the
      // texture container an extreme low zIndex and then force it back to index
      // 0 so a freshly configured door cannot cover the door-control icon until
      // the first click refreshes the wall.
      try {
        parent.sortableChildren = true;
        if (typeof parent.sortChildren === "function") parent.sortChildren();
        if (typeof parent.setChildIndex === "function" && parent.getChildIndex(this.container) !== 0) {
          parent.setChildIndex(this.container, 0);
        }
      } catch (error) {
        debug("Could not enforce WallsLayer child order", error);
      }
      return;
    }

    if (wallsLayer?.parent === parent && typeof parent.getChildIndex === "function") {
      const wallIndex = parent.getChildIndex(wallsLayer);
      this.container.zIndex = Number(wallsLayer.zIndex ?? 100) - 1;

      if (this.container.parent !== parent) {
        parent.addChildAt(this.container, Math.max(0, wallIndex));
      } else if (typeof parent.setChildIndex === "function") {
        const currentIndex = parent.getChildIndex(this.container);
        const freshWallIndex = parent.getChildIndex(wallsLayer);
        if (currentIndex >= freshWallIndex) parent.setChildIndex(this.container, Math.max(0, freshWallIndex - 1));
      }
      return;
    }

    if (this.container.parent !== parent) parent.addChild(this.container);
  }

  scheduleLayerOrderCheck() {
    const enforce = () => this.ensureContainer();
    enforce();
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(enforce);
    setTimeout(enforce, 50);
    setTimeout(enforce, 250);
  }

  ensureContainer() {
    if (!canvas?.ready) return null;

    const parent = this.getOverlayParent();
    if (!parent) return null;

    if (this.usesSharedOverlayParent(parent)) {
      if (this.container && this.ownsContainer && !this.container.destroyed) this.container.destroy({ children: true });
      this.container = parent;
      this.ownsContainer = false;
      parent.sortableChildren = true;
      refreshPrimarySort();
      return parent;
    }

    if (!this.container || !this.ownsContainer || this.container.destroyed) {
      this.container = new PIXI.Container();
      this.container.name = MODULE_ID;
      this.container.sortableChildren = true;
      this.container.zIndex = 0;
      this.container.interactive = false;
      this.container.interactiveChildren = false;
      this.container.eventMode = "none";
      this.ownsContainer = true;
    }

    if (this.container.parent && this.container.parent !== parent) this.container.parent.removeChild(this.container);

    this.placeContainerBelowWalls(parent);

    return this.container;
  }

  clear() {
    lightBender.stopAll();
    for (const timer of this.secretHideTimers.values()) clearTimeout(timer);
    this.secretHideTimers.clear();
    for (const door of this.doors.values()) door.destroy();
    this.doors.clear();
    this.loading.clear();
    if (this.ownsContainer && this.container && !this.container.destroyed) this.container.destroy({ children: true });
    this.container = null;
    this.ownsContainer = false;
    refreshPrimarySort();
  }

  rebuild() {
    this.clear();
    if (!canvas?.ready || !canvas?.scene) return;
    this.ensureContainer();
    for (const wall of canvas.scene.walls) this.refreshWall(wall, { animate: false });
    debug("rebuilt overlays");
  }

  shouldDraw(document, cfg = readDoorConfig(document), { existing = null, animate = false } = {}) {
    if (!canvas?.ready || !document || !isDoorDocument(document) || !cfg.enabled || cfg.animation === "none" || !cfg.texture || !getWallCoords(document)) return false;
    return true;
  }

  clearSecretHideTimer(id) {
    const timer = this.secretHideTimers.get(id);
    if (timer) clearTimeout(timer);
    this.secretHideTimers.delete(id);
  }

  scheduleSecretHide(document, cfg, animate) {
    const id = document?.id;
    if (!id) return;
    this.clearSecretHideTimer(id);
  }

  async refreshWall(wall, { animate = true } = {}) {
    const document = getWallDocument(wall);
    if (!document?.id) return;
    if (!isCurrentCanvasSceneDocument(document)) return;

    const cfg = readDoorConfig(document);
    const existing = this.doors.get(document.id);
    if (!this.shouldDraw(document, cfg, { existing, animate })) {
      this.removeWall(document.id);
      return;
    }

    const container = this.ensureContainer();
    if (!container) return;

    const nextKey = cfgKey(cfg);
    const needsTexture = !existing || existing.key !== nextKey;

    if (!needsTexture) {
      existing.updateDocument(document, cfg);
      existing.applyState(isOpenDocument(document), animate);
      this.scheduleSecretHide(document, cfg, animate);
      this.scheduleLayerOrderCheck();
      return;
    }

    const loadId = foundry.utils.randomID();
    this.loading.set(document.id, loadId);
    const texture = await loadDoorTexture(cfg.texture);
    if (this.loading.get(document.id) !== loadId) return;
    this.loading.delete(document.id);
    if (!isCurrentCanvasSceneDocument(document)) return;

    if (!texture) {
      this.removeWall(document.id);
      return;
    }

    this.removeWall(document.id);
    const targetOpen = isOpenDocument(document);
    const initialOpen = animate ? !targetOpen : targetOpen;
    const overlay = new AnimatedDoorOverlay(document, cfg, texture, { initialOpen });
    container.addChild(overlay.root);
    if (container === canvas?.primary) refreshPrimarySort();
    this.doors.set(document.id, overlay);
    overlay.applyState(targetOpen, animate);
    this.scheduleSecretHide(document, cfg, animate);
    this.scheduleLayerOrderCheck();
  }

  removeWall(id) {
    this.clearSecretHideTimer(id);
    const overlay = this.doors.get(id);
    if (overlay) overlay.destroy();
    this.doors.delete(id);
    this.loading.delete(id);
  }

  refreshLevelVisibility() {
    for (const overlay of this.doors.values()) overlay.updateLevelVisibility();
  }
}

const manager = new AnimatedDoorManager();

function flagPath(key) {
  return `flags.${MODULE_ID}.${key}`;
}

function getFieldByKey(form, key) {
  return form?.querySelector?.(`[data-v11ad-key="${key}"]`) ?? null;
}

function readTextField(form, key, fallback = "") {
  const field = getFieldByKey(form, key);
  if (!field) return fallback;
  return String(field.value ?? fallback).trim();
}

function readCheckboxField(form, key, fallback = false) {
  const field = getFieldByKey(form, key);
  if (!field) return fallback;
  return Boolean(field.checked);
}

function getV11ADFormData(form, document = null) {
  const current = document ? readDoorConfig(document) : DEFAULTS;
  const cfg = {
    enabled: true,
    texture: readTextField(form, "texture", current.texture),
    animation: readTextField(form, "animation", current.animation),
    direction: readTextField(form, "direction", current.direction),
    double: readCheckboxField(form, "double", current.double),
    flip: readCheckboxField(form, "flip", current.flip),
    duration: clampNumber(readTextField(form, "duration", current.duration), 0, 10000, DEFAULTS.duration),
    strength: clampNumber(readTextField(form, "strength", current.strength), 0, 3, DEFAULTS.strength),
    refractLight: readCheckboxField(form, "refractLight", current.refractLight),
    offsetX: clampNumber(readTextField(form, "offsetX", current.offsetX), -10000, 10000, DEFAULTS.offsetX),
    offsetY: clampNumber(readTextField(form, "offsetY", current.offsetY), -10000, 10000, DEFAULTS.offsetY)
  };

  if (!DOOR_ANIMATIONS.includes(cfg.animation)) cfg.animation = DEFAULTS.animation;
  if (!DIRECTIONS.includes(cfg.direction)) cfg.direction = DEFAULTS.direction;
  if (cfg.animation === "none") cfg.enabled = false;
  return cfg;
}

function writeV11ADFormData(formData, cfg) {
  for (const [key, value] of Object.entries(cfg)) formData[flagPath(key)] = value;
}

function getFormDoorValue(form, formData, document) {
  const fd = form ? new FormData(form) : null;
  const candidates = [
    fd?.get("door"),
    fd?.get("data.door"),
    formData?.door,
    formData?.["door"],
    formData?.["data.door"],
    document?.door
  ];
  return candidates.find((value) => value !== null && value !== undefined);
}

function isSubmittingAsDoor(form, formData, document) {
  return isDoorFormValue(getFormDoorValue(form, formData, document));
}

async function saveDoorConfigToDocument(document, cfg) {
  if (!document?.update) return;
  const updateData = {};
  writeV11ADFormData(updateData, cfg);
  await document.update(updateData);
}

function getLatestWallDocument(document, id) {
  return document?.parent?.walls?.get?.(id)
    ?? canvas?.scene?.walls?.get?.(id)
    ?? document;
}

function patchWallConfig() {
  const WallConfigClass = globalThis.WallConfig;
  if (!WallConfigClass?.prototype || WallConfigClass.prototype._v11adPatched) return;

  const defaultOptions = foundry?.utils?.deepClone
    ? foundry.utils.deepClone(WallConfigClass.defaultOptions ?? {})
    : { ...(WallConfigClass.defaultOptions ?? {}) };

  try {
    Object.defineProperty(WallConfigClass, "defaultOptions", {
      get() {
        const merge = foundry?.utils?.mergeObject;
        const base = merge ? merge({}, defaultOptions, { inplace: false }) : { ...defaultOptions };
        base.resizable = true;
        base.width = Math.max(Number(base.width) || 0, 620);
        base.height = Math.max(Number(base.height) || 0, 620);
        return base;
      },
      configurable: true
    });
  } catch (error) {
    debug("Could not patch WallConfig defaultOptions", error);
  }

  const originalUpdateObject = WallConfigClass.prototype._updateObject;
  WallConfigClass.prototype._updateObject = async function patchedAnimatedDoorUpdateObject(event, formData) {
    const document = getWallDocument(this.object);
    const wallId = document?.id;
    const form = this.form;
    const submittingDoor = form && isSubmittingAsDoor(form, formData, document);
    const cfg = submittingDoor
      ? getV11ADFormData(form, document)
      : { ...readDoorConfig(document), enabled: false };

    writeV11ADFormData(formData, cfg);

    const result = await originalUpdateObject.call(this, event, formData);

    if (wallId) {
      try {
        await saveDoorConfigToDocument(getLatestWallDocument(document, wallId), cfg);
      } catch (error) {
        ui.notifications?.warn?.(RU.saveError);
        console.warn(`${MODULE_ID} | Could not save wall flags`, error);
      }
    }

    return result;
  };

  WallConfigClass.prototype._v11adPatched = true;
}

function ensureResizableWallConfig(app, $html) {
  const $window = app?.element?.length ? app.element : $html.closest(".app.window-app");
  if (!$window?.length) return;

  $window.addClass("v11ad-resizable-window");
  app.options.resizable = true;

  const width = Math.max(Number($window.outerWidth()) || Number(app.position?.width) || 0, 660);
  const height = Math.max(Number($window.outerHeight()) || Number(app.position?.height) || 0, 680);
  app.setPosition({ width, height });
  $window.css({ width: `${width}px`, height: `${height}px` });
  const headerHeight = $window.find(".window-header").outerHeight() || 30;
  $window.find(".window-content").css({ height: `${height - headerHeight}px`, overflow: "auto" });

  $window.find(".v11ad-resize-handle").remove();

  const handle = $('<div class="window-resizable-handle v11ad-resize-handle" title="Растянуть"><i class="fas fa-expand-alt"></i></div>');
  $window.append(handle);

  const win = $window[0];
  const ownerDocument = win?.ownerDocument || globalThis.document;

  handle.on("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const rect = win.getBoundingClientRect();
    const startWidth = rect.width;
    const startHeight = rect.height;

    const applySize = (nextWidth, nextHeight) => {
      const safeWidth = Math.max(460, nextWidth);
      const safeHeight = Math.max(420, nextHeight);
      app.setPosition({ width: safeWidth, height: safeHeight });
      $window.css({ width: `${safeWidth}px`, height: `${safeHeight}px` });
      const header = $window.find(".window-header").outerHeight() || 30;
      $window.find(".window-content").css({ height: `${safeHeight - header}px`, overflow: "auto" });
    };

    const onMove = (moveEvent) => {
      applySize(startWidth + (moveEvent.clientX - startX), startHeight + (moveEvent.clientY - startY));
    };

    const onUp = () => {
      ownerDocument.removeEventListener("mousemove", onMove);
      ownerDocument.removeEventListener("mouseup", onUp);
      ownerDocument.body?.classList?.remove("v11ad-resizing");
    };

    ownerDocument.body?.classList?.add("v11ad-resizing");
    ownerDocument.addEventListener("mousemove", onMove);
    ownerDocument.addEventListener("mouseup", onUp);
  });
}

function selected(value, expected) {
  return value === expected ? "selected" : "";
}

function checked(value) {
  return value ? "checked" : "";
}

function dtypeForKey(key) {
  if (["enabled", "double", "flip", "refractLight"].includes(key)) return "Boolean";
  if (["duration", "strength", "offsetX", "offsetY"].includes(key)) return "Number";
  return "String";
}

function inputAttrs(key) {
  return `name="${flagPath(key)}" data-v11ad-key="${key}" data-dtype="${dtypeForKey(key)}"`;
}

function findDoorFields($html) {
  let $fields = $html.find('[name="door"], [name="data.door"]');
  if ($html.is?.('[name="door"], [name="data.door"]')) $fields = $fields.add($html);

  if (!$fields.length) {
    $html.find("select").each((_, element) => {
      const $element = $(element);
      const label = $element.closest(".form-group").find("label").text().trim().toLowerCase();
      const hasDoorValue = Array.from(element.options ?? []).some((option) => isDoorFormValue(option.value));
      if (hasDoorValue && (label.includes("двер") || label.includes("door"))) $fields = $fields.add($element);
    });
  }

  return $fields;
}

function getCurrentDoorFieldValue($fields, document) {
  if ($fields?.length) {
    const value = $fields.first().val();
    if (value !== undefined && value !== null) return value;
  }
  return document?.door;
}

function renderWallConfig(app, html) {
  patchWallConfig();
  const document = getWallDocument(app.object);
  if (!document) return;

  const cfg = readDoorConfig(document);
  const $html = html instanceof jQuery ? html : $(html);
  ensureResizableWallConfig(app, $html);

  $html.find(".v11ad-wall-config").remove();

  const block = $(`
    <fieldset class="v11ad-wall-config">
      <legend>${RU.title}</legend>

      <div class="form-group">
        <label>${RU.animation}</label>
        <select ${inputAttrs("animation")}>
          <option value="none" ${selected(cfg.animation, "none")}>${RU.none}</option>
          <option value="ascend" ${selected(cfg.animation, "ascend")}>${RU.ascend}</option>
          <option value="descend" ${selected(cfg.animation, "descend")}>${RU.descend}</option>
          <option value="slide" ${selected(cfg.animation, "slide")}>${RU.slide}</option>
          <option value="swing" ${selected(cfg.animation, "swing")}>${RU.swing}</option>
          <option value="swivel" ${selected(cfg.animation, "swivel")}>${RU.swivel}</option>
        </select>
      </div>

      <div class="form-group stacked">
        <label>${RU.texture}</label>
        <div class="v11ad-file-row">
          <input type="text" ${inputAttrs("texture")} value="${escapeHTML(cfg.texture)}">
          <button type="button" class="v11ad-file-picker" title="${RU.choose}"><i class="fas fa-file-import"></i></button>
        </div>
      </div>

      <div class="form-group">
        <label>${RU.offsetX}</label>
        <input type="number" ${inputAttrs("offsetX")} min="-10000" max="10000" step="1" value="${cfg.offsetX}">
      </div>

      <div class="form-group">
        <label>${RU.offsetY}</label>
        <input type="number" ${inputAttrs("offsetY")} min="-10000" max="10000" step="1" value="${cfg.offsetY}">
      </div>

      <div class="form-group">
        <label>${RU.flip}</label>
        <input type="checkbox" ${inputAttrs("flip")} value="true" ${checked(cfg.flip)}>
      </div>

      <div class="form-group">
        <label>${RU.double}</label>
        <input type="checkbox" ${inputAttrs("double")} value="true" ${checked(cfg.double)}>
      </div>

      <div class="form-group">
        <label>${RU.duration}</label>
        <input type="number" ${inputAttrs("duration")} min="0" max="10000" step="50" value="${cfg.duration}">
      </div>

      <div class="form-group">
        <label>${RU.direction}</label>
        <select ${inputAttrs("direction")}>
          <option value="default" ${selected(cfg.direction, "default")}>${RU.default}</option>
          <option value="reverse" ${selected(cfg.direction, "reverse")}>${RU.reverse}</option>
        </select>
      </div>

      <div class="form-group">
        <label>${RU.strength}</label>
        <input type="number" ${inputAttrs("strength")} min="0" max="3" step="0.05" value="${cfg.strength}">
      </div>

      <div class="form-group">
        <label>${RU.refractLight}</label>
        <input type="checkbox" ${inputAttrs("refractLight")} value="true" ${checked(cfg.refractLight)}>
      </div>
    </fieldset>
  `);

  block.find(".v11ad-file-picker").on("click", (event) => {
    event.preventDefault();
    const input = block.find('[data-v11ad-key="texture"]');
    new FilePicker({
      type: "imagevideo",
      current: input.val(),
      callback: (path) => input.val(path)
    }).render(true);
  });

  const doorFields = findDoorFields($html);
  const doorGroup = doorFields.first().closest(".form-group");
  if (doorGroup.length) doorGroup.after(block);
  else {
    const $form = $html.is("form") ? $html : $html.find("form").first();
    if ($form.length) $form.append(block);
    else $html.append(block);
  }

  const updateDoorVisibility = () => {
    const visible = isDoorFormValue(getCurrentDoorFieldValue(doorFields, document));
    block.toggle(visible);
    block.find(":input").prop("disabled", !visible);
  };

  doorFields.on(`change.${MODULE_ID} input.${MODULE_ID}`, updateDoorVisibility);
  updateDoorVisibility();
}

Hooks.once("init", () => {
  registerCoreDoorSounds();

  game.settings.register(MODULE_ID, "defaultTexture", {
    name: "Текстура двери по умолчанию",
    hint: "Путь к текстуре, который подставляется в новых анимированных дверях.",
    scope: "world",
    config: true,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, "debug", {
    name: "Отладка дверей",
    hint: "Показывать предупреждения и сообщения в консоли, если текстура не загрузилась.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });

  patchWallConfig();
});

Hooks.once("ready", () => {
  registerCoreDoorSounds();

  const module = game.modules.get(MODULE_ID);
  if (module) {
    module.api = {
      refresh: () => manager.rebuild(),
      refreshWall: (wall) => manager.refreshWall(wall),
      manager
    };
  }
});

Hooks.on("renderWallConfig", renderWallConfig);

Hooks.on("canvasReady", () => {
  lightBender.cleanupScene();
  manager.rebuild();
  manager.refreshLevelVisibility();
});
Hooks.on("canvasTearDown", () => manager.clear());

Hooks.on("createWall", (document) => {
  if (!isCurrentCanvasSceneDocument(document)) return;
  if (isTemporaryLightWall(document)) return;
  manager.refreshWall(document, { animate: false });
});
Hooks.on("preUpdateWall", (document, changes) => {
  if (!isCurrentCanvasSceneDocument(document)) return;
  if (isTemporaryLightWall(document)) return;
  lightBender.prepareClosing(document, changes);
});
Hooks.on("updateWall", (document, changes) => {
  if (!isCurrentCanvasSceneDocument(document)) return;
  if (isTemporaryLightWall(document)) return;
  if (lightBender.shouldIgnoreSourceWallUpdate(document, changes)) return;
  const animate = Object.prototype.hasOwnProperty.call(changes, "ds");
  manager.refreshWall(document, { animate });
});
Hooks.on("deleteWall", (document) => {
  if (!isCurrentCanvasSceneDocument(document)) return;
  if (isTemporaryLightWall(document)) return;
  manager.removeWall(document.id);
});

Hooks.on("levelsUiChangeLevel", () => manager.refreshLevelVisibility());
Hooks.on("levelsPerspectiveChanged", () => manager.refreshLevelVisibility());
Hooks.on("renderLevelsUI", () => manager.refreshLevelVisibility());
Hooks.on("closeLevelsUI", () => manager.refreshLevelVisibility());
Hooks.on("controlToken", () => manager.refreshLevelVisibility());
Hooks.on("updateToken", (document, changes) => {
  if (!isCurrentCanvasSceneDocument(document)) return;
  if (Object.prototype.hasOwnProperty.call(changes ?? {}, "elevation")) manager.refreshLevelVisibility();
});
