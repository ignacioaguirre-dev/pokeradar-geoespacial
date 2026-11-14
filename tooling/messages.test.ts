import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type Tree = { [key: string]: string | Tree };

function strings(tree: Tree, path = ""): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [[`${path}${key}`, value] as [string, string]] : strings(value, `${path}${key}.`),
  );
}

// A message glued to another by its own leading space breaks when translated or reordered:
// joined phrases belong in one ICU message
function edgeSpaces(messages: Tree): string[] {
  return strings(messages)
    .filter(([, text]) => text !== text.trim())
    .map(([key]) => key);
}

describe("message catalog", () => {
  it("flags a message that starts or ends with a space", () => {
    expect(edgeSpaces({ A: { glued: " y más", fine: "Listo." } })).toEqual(["A.glued"]);
  });

  it("es-AR has no message with spaces at its edges", () => {
    const messages = JSON.parse(readFileSync(join(__dirname, "..", "messages", "es-AR.json"), "utf8")) as Tree;
    expect(edgeSpaces(messages)).toEqual([]);
  });
});
