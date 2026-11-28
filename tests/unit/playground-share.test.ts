import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { deflateSync, inflateSync } from "node:zlib";
import { Roll } from "@dice-roller/rpg-dice-roller";
import {
  decodePlaygroundUrl,
  defaultShareSettings,
  encodePlaygroundUrl,
  maxShareUrlLength,
} from "../../app/utils/playground-share.ts";
import type { PlaygroundSnapshot } from "../../app/utils/playground-share.ts";

const pageUrl = "https://example.org/tools/playground";

function readPayload(link: string) {
  const payload = new URL(link).hash.slice("#play=v2.".length);
  return JSON.parse(inflateSync(Buffer.from(payload, "base64url")).toString());
}

function linkWithPayload(json: string) {
  return pageUrl + "#play=v2." + deflateSync(json).toString("base64url");
}

test("omits unchanged settings and restores the v2 defaults", async () => {
  const snapshot = { settings: defaultShareSettings(), history: [] };
  const link = await encodePlaygroundUrl(pageUrl, snapshot);
  assert.deepEqual(readPayload(link), {});
  assert.deepEqual(await decodePlaygroundUrl(link), snapshot);
});

test("restores the original notation default from v1 links", async () => {
  const legacy = linkWithPayload("{}").replace("#play=v2.", "#play=v1.");
  assert.equal(
    (await decodePlaygroundUrl(legacy)).settings.notation,
    "4d6kh3 + 2",
  );
});

test("packs presenter overrides and restores ordered rolls with their own bindings", async () => {
  const settings = defaultShareSettings();
  settings.notation = "d20+$bonus [🎲]";
  settings.variables = '{"bonus":42}';
  settings.presenter = "SVG";
  settings.svgOptions.size = 72;
  settings.textOptions.flagSymbols.drop = "DROP";
  settings.tab = "data";
  settings.dataFormat = "concise";

  const rollSettings = {
    engine: "mersenne",
    seed: "42",
    maxQty: "999",
    maxIterations: "1000",
    maxGeneratedRolls: "1000000",
  };
  const history = [3, 4, 3].map((bonus, index) => {
    const data = { bonus };
    const roll = Roll.import(
      { notation: "d20+$bonus", rolls: [[index + 1]] },
      { data },
    );
    return { roll, data, settings: rollSettings };
  });
  const snapshot: PlaygroundSnapshot = { settings, history, preview: 0 };
  const link = await encodePlaygroundUrl(pageUrl + "#previous", snapshot);
  assert.match(
    link,
    /^https:\/\/example\.org\/tools\/playground#play=v2\.[\w-]+$/,
  );
  assert.ok(link.length <= maxShareUrlLength);

  const packed = readPayload(link);
  assert.deepEqual(packed.s.svgOptions, { size: 72 });
  assert.deepEqual(packed.s.textOptions, { flagSymbols: { drop: "DROP" } });
  assert.deepEqual(packed.c, [
    [{ engine: "mersenne", seed: "42" }, { bonus: 3 }],
    [{ engine: "mersenne", seed: "42" }, { bonus: 4 }],
  ]);
  assert.deepEqual(
    packed.r,
    history.map((_, index) => [
      index === 1 ? 1 : 0,
      { notation: "d20+$bonus", rolls: [[index + 1]] },
    ]),
  );
  assert.ok(
    link.length <
      JSON.stringify(history.map(({ roll }) => roll.export())).length,
  );

  const restored = await decodePlaygroundUrl(link);
  assert.deepEqual(restored.settings, settings);
  assert.equal(restored.preview, 0);
  assert.deepEqual(
    restored.history.map(({ roll, settings, data }) => ({
      result: roll.export(),
      settings,
      data,
    })),
    history.map(({ roll, settings, data }) => ({
      result: roll.export(),
      settings,
      data,
    })),
  );
});

test("uses Full data when Concise would lose recorded statistics", async () => {
  const settings = defaultShareSettings();
  const full = { ...new Roll("d6").export(), averageTotal: 12 };
  const snapshot = {
    settings,
    history: [{ roll: Roll.import(full), settings, data: {} }],
  };
  const url = await encodePlaygroundUrl(pageUrl, snapshot);
  assert.deepEqual(readPayload(url).r[0][1], full);
  assert.deepEqual(
    (await decodePlaygroundUrl(url)).history[0]?.roll.export(),
    full,
  );
});

test("restores a displayed roll whose history entry was removed", async () => {
  const settings = defaultShareSettings();
  const roll = Roll.import({ notation: "d6", rolls: [[4]] });
  const latest = { roll, settings, data: {} };
  const url = await encodePlaygroundUrl(pageUrl, {
    settings,
    history: [],
    latest,
  });
  const restored = await decodePlaygroundUrl(url);
  assert.deepEqual(restored.history, []);
  assert.deepEqual(restored.latest?.roll.export(), roll.export());
});

test("rejects oversized snapshots and links", async () => {
  const settings = defaultShareSettings();
  settings.variables = JSON.stringify({
    value: randomBytes(4000).toString("hex"),
  });
  await assert.rejects(
    encodePlaygroundUrl(pageUrl, { settings, history: [] }),
    /too large/,
  );
  await assert.rejects(
    decodePlaygroundUrl(pageUrl + "#play=v2." + "a".repeat(2000)),
    /too large/,
  );
});

test("rejects unsupported versions, invalid history references and invalid previews", async () => {
  await assert.rejects(
    decodePlaygroundUrl(pageUrl + "#play=v3.e30"),
    /unsupported/,
  );
  await assert.rejects(
    decodePlaygroundUrl(linkWithPayload('{"r":[[1,{}]]}')),
    /roll settings/,
  );
  await assert.rejects(
    decodePlaygroundUrl(linkWithPayload('{"p":0}')),
    /preview/,
  );
  await assert.rejects(
    decodePlaygroundUrl(linkWithPayload('{"s":{"svgOptions":{"size":"72"}}}')),
    /settings/,
  );
});
