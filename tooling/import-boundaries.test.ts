import { ESLint } from "eslint";
import { describe, expect, test } from "vitest";

const IMPORTS = "no-restricted-imports";
const SYNTAX = "no-restricted-syntax";
const GLOBALS = "no-restricted-globals";

const DOMAIN = "src/domain/fence.ts";
const DOMAIN_TEST = "src/domain/fence.test.ts";
const DOMAIN_TEST_TSX = "src/domain/fence.test.tsx";
const FEATURES = "src/features/weather/use-weather.ts";
const HOOKS = "src/hooks/use-example.ts";
const MAP = "src/map/camera.ts";
const UI = "src/components/ui/button.tsx";
const COMPONENT = "src/components/detail/detail.tsx";
const APP = "src/app/page.tsx";
const LIB = "src/lib/x.ts";

type Forbidden = readonly [name: string, file: string, code: string, rule: string];
type Allowed = readonly [name: string, file: string, code: string];

// One forbidden case per rule block, plus a regression case for every leak found in review.
const forbidden: Forbidden[] = [
  // One per rule block in eslint.config.mjs
  ["domain: only imports domain (react)", DOMAIN, `import "react";`, IMPORTS],
  ["domain: network and DOM globals (fetch)", DOMAIN, `fetch("/x");`, GLOBALS],
  ["features: does not import map", FEATURES, `import "@/map/camera";`, IMPORTS],
  ["hooks: does not import domain", HOOKS, `import "@/domain/fence";`, IMPORTS],
  ["hooks: does not import components", HOOKS, `import "../components/ui/button";`, IMPORTS],
  ["hooks: does not import data", HOOKS, `import "@/data/species";`, IMPORTS],
  ["hooks: does not import lib (relative)", HOOKS, `import "../lib/x";`, IMPORTS],
  ["hooks: does not import maplibre", HOOKS, `import "maplibre-gl";`, IMPORTS],
  ["hooks: does not import test utilities", HOOKS, `import "@/testing/render";`, IMPORTS],
  ["map: does not import features", MAP, `import "@/features/fences/storage";`, IMPORTS],
  ["ui: does not import domain", UI, `import "@/domain/fence";`, IMPORTS],
  ["components: do not import app", COMPONENT, `import "@/app/page";`, IMPORTS],
  ["testing: the app does not import test utilities", UI, `import "@/testing/render";`, IMPORTS],
  ["testing: nor does a route", APP, `import { render } from "@/testing/render";`, IMPORTS],
  ["components: do not import queries", COMPONENT, `import "@/features/catalog/queries";`, IMPORTS],
  ["app: does not import maplibre", APP, `import "maplibre-gl";`, IMPORTS],
  ["unlisted folder: does not import maplibre", LIB, `import "maplibre-gl";`, IMPORTS],

  // Regression: leaks found during review
  ["maplibre subpath", COMPONENT, `import "maplibre-gl/dist/maplibre-gl.css";`, IMPORTS],
  ["relative folder without a file", FEATURES, `import "../../map";`, IMPORTS],
  ["maplibre through dynamic import()", COMPONENT, `await import("maplibre-gl");`, SYNTAX],
  ["maplibre through template import()", DOMAIN, "await import(`maplibre-gl`);", SYNTAX],
  ["maplibre through require", APP, `require("maplibre-gl");`, SYNTAX],
  ["domain: alias of an unlisted folder", DOMAIN, `import "@/other/x";`, IMPORTS],
  ["domain: short package name (fs)", DOMAIN, `import "fs";`, IMPORTS],
  ["domain: ../ into an unlisted folder", DOMAIN, `import "../other/x";`, IMPORTS],
  ["domain: ./../", DOMAIN, `import "./../x";`, IMPORTS],
  ["domain: @/domain/.. escapes", DOMAIN, `import "@/domain/../app/page";`, IMPORTS],
  ["domain: ../ from a subfolder", "src/domain/geo/edge.ts", `import "../x";`, IMPORTS],
  ["domain: tests do not import packages either", DOMAIN_TEST, `import "lodash";`, IMPORTS],
  ["domain: vitest outside tests", DOMAIN, `import { expect } from "vitest";`, IMPORTS],
  ["domain: fast-check outside tests", DOMAIN, `import fc from "fast-check";`, IMPORTS],
  ["domain: fast-check subpath in a test", DOMAIN_TEST, `import "fast-check/lib/x";`, IMPORTS],
];

const allowed: Allowed[] = [
  ["domain imports domain", DOMAIN, `import "./x"; import "./sub/x"; import "@/domain/geo/x";`],
  ["domain: vitest in a test", DOMAIN_TEST, `import { expect } from "vitest";`],
  ["domain: vitest in a tsx test", DOMAIN_TEST_TSX, `import { expect } from "vitest";`],
  ["domain: fast-check in a test", DOMAIN_TEST, `import fc from "fast-check";`],
  ["features imports domain and react", FEATURES, `import "@/domain/fence"; import "react";`],
  ["hooks: imports react and other hooks", HOOKS, `import "react"; import "./use-other"; import "@/hooks/use-other";`],
  ["route: _components imports hooks, domain and ui", "src/app/system/_components/colors.tsx", `import "@/hooks/use-example"; import "@/domain/color/contrast"; import "@/components/ui/button";`],
  ["map imports maplibre (static and dynamic)", MAP, `import "maplibre-gl"; await import("maplibre-gl");`],
  ["ui imports ui", UI, `import "@/components/ui/another";`],
  ["component imports domain, map and storage", COMPONENT, `import "@/domain/fence"; import "@/map/camera"; import "@/features/fences/storage";`],
  ["app imports queries and components", APP, `import "@/features/catalog/queries"; import "@/components/detail/detail";`],
  ["testing: a test imports test utilities", "src/components/ui/button.test.tsx", `import { render } from "@/testing/render";`],
  ["testing: src/testing imports testing-library", "src/testing/render.tsx", `import "@testing-library/react";`],
  ["unlisted folder imports react", LIB, `import "react";`],
];

const eslint = new ESLint();

async function lintMessages(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages;
}

// The first lint call loads the whole Next config, which can exceed the default timeout.
describe("folder import boundaries", { timeout: 60_000 }, () => {
  test.each(forbidden)("forbids: %s", async (_name, filePath, code, rule) => {
    const restricted = (await lintMessages(filePath, code)).filter((m) => m.ruleId === rule);
    expect(restricted.length).toBeGreaterThan(0);
  });

  test.each(allowed)("allows: %s", async (_name, filePath, code) => {
    const all = await lintMessages(filePath, code);
    expect(all.filter((m) => m.fatal)).toEqual([]);
    expect(all.filter((m) => m.ruleId?.startsWith("no-restricted-"))).toEqual([]);
  });
});
