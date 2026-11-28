import { convert } from "@dice-roller/convertor";
import type { Appearance } from "@dice-roller/svg-presenter";
import {
  Roll,
  type ConciseRollData,
  type DrawMode,
  type EncodedRollData,
  type RollInputData,
} from "@dice-roller/rpg-dice-roller";

const sharePrefix = "#play=v1.";
export const maxShareUrlLength = 2000;
const maxSnapshotBytes = 1024 * 1024;

// These defaults belong to v1 links. Keep them fixed as the Playground evolves.
const rollDefaults = {
  engine: "nativeMath",
  seed: "",
  maxQty: "999",
  maxIterations: "1000",
  maxGeneratedRolls: "1000000",
};

const settingsDefaults = {
  ...rollDefaults,
  notation: "4d6kh3 + 2",
  variables: "{}",
  presenter: "Text",
  tab: "visual",
  dataFormat: "full",
  textOptions: {
    separator: "; ",
    expandInlineRolls: false,
    flagSymbols: {
      compound: "!",
      explode: "!",
      "explode-matching-batch": "!m",
      "explode-matching-batch-failure": "mf",
      "critical-failure": "cf",
      "critical-success": "cs",
      drop: "d",
      max: "v",
      min: "^",
      penetrate: "p",
      "re-roll": "r",
      "re-roll-once": "ro",
      "target-failure": "_",
      "target-success": "*",
      unique: "u",
      "unique-once": "uo",
    },
  },
  svgOptions: {
    size: 140,
    width: 1040,
    noWrap: false,
    stroke: "#7962b5",
    fill: "#eee7fb",
    filled: false,
    showValues: true,
    showDescriptions: true,
    showDiceLabels: true,
    showVariableLabels: true,
    showModifierLabels: true,
    showModifierIcons: true,
    modifierIconPosition: "corner" as const,
    showNotation: true,
    showTotals: true,
  },
};

export type ShareRollSettings = typeof rollDefaults;
export type ShareSettings = Omit<typeof settingsDefaults, "svgOptions"> & {
  svgOptions: Appearance;
};

export interface SharedRoll {
  roll: Roll<unknown, DrawMode>;
  settings: ShareRollSettings;
  data: RollInputData;
}

export interface PlaygroundSnapshot {
  settings: ShareSettings;
  history: SharedRoll[];
  /** The latest result if its history entry has been removed. */
  latest?: SharedRoll;
  /** Zero-based index in oldest-first history. */
  preview?: number;
}

type SettingsPatch = {
  [key: string]: string | boolean | number | SettingsPatch | undefined;
};
type PackedContext = [SettingsPatch, RollInputData?];
type PackedRoll = [number, EncodedRollData | ConciseRollData];
interface PackedSnapshot {
  s?: SettingsPatch;
  c?: PackedContext[];
  r?: PackedRoll[];
  p?: number;
  l?: PackedRoll;
}

export function defaultShareSettings(): ShareSettings {
  return structuredClone(settingsDefaults);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function settingsPatch(
  settings: SettingsPatch,
  defaults: SettingsPatch,
): SettingsPatch {
  const patch: SettingsPatch = {};
  for (const [key, fallback] of Object.entries(defaults)) {
    const value = settings[key];
    if (value === undefined || value === fallback) continue;
    if (typeof value === "object" && typeof fallback === "object") {
      const nested = settingsPatch(value, fallback);
      if (Object.keys(nested).length) patch[key] = nested;
    } else {
      patch[key] = value;
    }
  }
  return patch;
}

function restoreSettings<T extends SettingsPatch>(
  defaults: T,
  patch: unknown,
): T {
  if (!isObject(patch)) throw new Error("Invalid shared settings.");
  return Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => {
      if (!Object.hasOwn(patch, key)) return [key, structuredClone(fallback)];
      const value = patch[key];
      if (typeof fallback === "object") {
        return [key, restoreSettings(fallback, value)];
      }
      if (typeof value !== typeof fallback) {
        throw new Error("Invalid shared settings.");
      }
      return [key, value];
    }),
  ) as T;
}

function checkPreview(
  preview: unknown,
  count: number,
): asserts preview is number | undefined {
  if (
    preview !== undefined &&
    (typeof preview !== "number" ||
      !Number.isInteger(preview) ||
      preview < 0 ||
      preview >= count)
  ) {
    throw new Error("Invalid shared preview.");
  }
}

function compactRoll(roll: SharedRoll): PackedRoll[1] {
  const full = roll.roll.export();
  try {
    const concise = convert(full, 1, { format: "concise", data: roll.data });
    const restored = Roll.import(concise, { data: roll.data });
    if (
      Object.is(restored.minTotal, roll.roll.minTotal) &&
      Object.is(restored.maxTotal, roll.roll.maxTotal) &&
      Object.is(restored.averageTotal, roll.roll.averageTotal)
    ) {
      return concise;
    }
  } catch {
    // Full exports preserve rolls that Concise cannot reconstruct.
  }
  return full;
}

function pack(snapshot: PlaygroundSnapshot): PackedSnapshot {
  checkPreview(snapshot.preview, snapshot.history.length);
  const settings = settingsPatch(
    { ...snapshot.settings, svgOptions: { ...snapshot.settings.svgOptions } },
    settingsDefaults,
  );
  const contexts: PackedContext[] = [];
  const indices = new Map<string, number>();
  function packRoll(entry: SharedRoll): PackedRoll {
    const patch = settingsPatch(entry.settings, rollDefaults);
    const context: PackedContext = Object.keys(entry.data).length
      ? [patch, entry.data]
      : [patch];
    const key = JSON.stringify(context, (_, value: unknown) =>
      isObject(value)
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, value[key]]),
          )
        : value,
    );
    let index = indices.get(key);
    if (index === undefined) {
      index = contexts.length;
      indices.set(key, index);
      contexts.push(context);
    }
    return [index, compactRoll(entry)];
  }
  const rolls = snapshot.history.map(packRoll);
  const latest = snapshot.latest && packRoll(snapshot.latest);
  return {
    ...(Object.keys(settings).length && { s: settings }),
    ...(contexts.length && { c: contexts }),
    ...(rolls.length && { r: rolls }),
    ...(latest && { l: latest }),
    ...(snapshot.preview !== undefined && { p: snapshot.preview }),
  };
}

function unpack(value: unknown): PlaygroundSnapshot {
  if (!isObject(value)) throw new Error("Invalid Playground snapshot.");
  const savedContexts: unknown = Object.hasOwn(value, "c") ? value.c : [];
  const rolls: unknown = Object.hasOwn(value, "r") ? value.r : [];
  if (!Array.isArray(savedContexts) || !Array.isArray(rolls)) {
    throw new Error("Invalid shared roll history.");
  }

  const contexts: unknown[] = savedContexts;
  function unpackRoll(entry: unknown): SharedRoll {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      !Number.isInteger(entry[0])
    ) {
      throw new Error("Invalid shared roll.");
    }
    const context: unknown = contexts[entry[0]];
    if (!Array.isArray(context) || context.length < 1 || context.length > 2) {
      throw new Error("Invalid shared roll settings.");
    }
    const settings = restoreSettings(rollDefaults, context[0]);
    const data: unknown = context.length === 2 ? context[1] : {};
    if (!isObject(data) || !isObject(entry[1])) {
      throw new Error("Invalid shared roll data.");
    }
    // Roll.import validates the payload and bindings using the library's schema.
    const roll = Roll.import(entry[1] as unknown as PackedRoll[1], {
      data: data as RollInputData,
    });
    return { roll, settings, data: data as RollInputData };
  }
  const history = rolls.map(unpackRoll);
  checkPreview(value.p, history.length);
  return {
    settings: restoreSettings(
      settingsDefaults,
      Object.hasOwn(value, "s") ? value.s : {},
    ),
    history,
    ...(Object.hasOwn(value, "l") && { latest: unpackRoll(value.l) }),
    ...(value.p !== undefined && { preview: value.p }),
  };
}

export async function encodePlaygroundUrl(
  pageUrl: string | URL,
  snapshot: PlaygroundSnapshot,
): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(pack(snapshot)));
  if (bytes.byteLength > maxSnapshotBytes) {
    throw new Error("The Playground snapshot is too large to share as a link.");
  }

  const stream = new Blob([bytes])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  if (compressed.length > maxShareUrlLength) {
    throw new Error("The Playground snapshot is too large to share as a link.");
  }
  const payload = btoa(String.fromCharCode(...compressed))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  const url = new URL(pageUrl);
  url.hash = sharePrefix + payload;
  if (url.href.length > maxShareUrlLength) {
    throw new Error("The Playground snapshot is too large to share as a link.");
  }
  return url.href;
}

export async function decodePlaygroundUrl(
  pageUrl: string | URL,
): Promise<PlaygroundSnapshot> {
  const url = new URL(pageUrl);
  const payload = url.hash.slice(sharePrefix.length);
  if (!url.hash.startsWith(sharePrefix) || !/^[\w-]+$/.test(payload)) {
    throw new Error("Invalid or unsupported Playground share link.");
  }
  if (url.href.length > maxShareUrlLength) {
    throw new Error("The Playground share link is too large.");
  }

  const compressed = Uint8Array.from(
    atob(payload.replaceAll("-", "+").replaceAll("_", "/")),
    (character) => character.charCodeAt(0),
  );
  const reader = new Blob([compressed])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"))
    .getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let json = "";
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxSnapshotBytes)
        throw new Error("The shared snapshot is too large.");
      json += decoder.decode(value, { stream: true });
    }
    json += decoder.decode();
  } finally {
    await reader.cancel();
  }
  return unpack(JSON.parse(json) as unknown);
}
