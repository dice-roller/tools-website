import type { RollInputData, RollLimits } from "@dice-roller/rpg-dice-roller";

type Options = Record<string, unknown>;

interface CodeExampleOptions {
  notation: string;
  engine: string;
  defaultEngine: string;
  seed?: number;
  limits: RollLimits;
  defaultLimits: RollLimits;
  data: RollInputData;
  presenter: "Text" | "SVG";
  presenterOptions: Options;
  presenterDefaults: Options;
}

function isObject(value: unknown): value is Options {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Include only overrides, including individual changed modifier symbols. */
function changedOptions(values: Options, defaults: Options): Options {
  return Object.fromEntries(
    Object.entries(values).flatMap(([key, value]) => {
      const original = defaults[key];
      if (Object.is(value, original)) return [];
      if (isObject(value) && isObject(original)) {
        const changes = changedOptions(value, original);
        return Object.keys(changes).length ? [[key, changes]] : [];
      }
      return [[key, value]];
    }),
  );
}

/** Format JavaScript literals without interpolating unescaped user input. */
function literal(value: unknown, depth = 0): string {
  if (!isObject(value)) return JSON.stringify(value);
  const entries = Object.entries(value);
  if (!entries.length) return "{}";
  const indent = "  ".repeat(depth);
  const properties = entries.map(([key, item]) => {
    // __proto__ has special semantics in an object literal, even when quoted.
    const name =
      key === "__proto__"
        ? '[ "__proto__" ]'
        : /^[A-Za-z_$][\w$]*$/.test(key)
          ? key
          : JSON.stringify(key);
    return indent + "  " + name + ": " + literal(item, depth + 1) + ",";
  });
  return "{\n" + properties.join("\n") + "\n" + indent + "}";
}

export function buildPlaygroundCode(options: CodeExampleOptions) {
  const config: Options = {};
  if (options.seed !== undefined) {
    config.engine = { name: options.engine, seed: options.seed };
  } else if (options.engine !== options.defaultEngine) {
    config.engine = options.engine;
  }
  const limits = changedOptions(
    { ...options.limits },
    { ...options.defaultLimits },
  );
  if (Object.keys(limits).length) config.limits = limits;
  if (Object.keys(options.data).length) config.data = options.data;

  const overrides = changedOptions(
    options.presenterOptions,
    options.presenterDefaults,
  );
  const svg = options.presenter === "SVG";
  const customText = !svg && Object.keys(overrides).length > 0;
  const hasPresenter = svg || customText;
  const lines = [
    `import { Roll${customText ? ", presenters" : ""} } from "@dice-roller/rpg-dice-roller";`,
  ];
  if (svg)
    lines.push('import { SvgPresenter } from "@dice-roller/svg-presenter";');
  lines.push("");
  if (hasPresenter) {
    lines.push(
      `const presenter = new ${svg ? "SvgPresenter" : "presenters.TextPresenter"}(${Object.keys(overrides).length ? literal(overrides) : ""});`,
    );
  }
  if (hasPresenter) lines.push("");
  lines.push(
    `const result = new Roll(${literal(options.notation)}${Object.keys(config).length ? ", " + literal(config) : ""});`,
  );
  lines.push(
    `console.log(result.present(${hasPresenter ? "presenter" : ""}));`,
  );

  return {
    code: lines.join("\n"),
    install: svg ? "npm install @dice-roller/svg-presenter" : "",
  };
}
