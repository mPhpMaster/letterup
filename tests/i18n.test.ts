import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const load = (name: string) => JSON.parse(readFileSync(join(root, "src/i18n", name), "utf8"));
const PLURAL = /_(zero|one|two|few|many|other)$/;

function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? flatten(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}
const baseKeys = (dict: Record<string, unknown>) => new Set(flatten(dict).map((k) => k.replace(PLURAL, "")));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

test("English and Arabic define the same keys", () => {
  const en = baseKeys(load("en.json"));
  const ar = baseKeys(load("ar.json"));
  assert.deepEqual([...en].filter((k) => !ar.has(k)), [], "missing in ar.json");
  assert.deepEqual([...ar].filter((k) => !en.has(k)), [], "missing in en.json");
});

test("every static t() key used in the UI exists", () => {
  const en = baseKeys(load("en.json"));
  const missing: string[] = [];
  for (const file of sourceFiles(join(root, "src"))) {
    for (const [, key] of readFileSync(file, "utf8").matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"/g)) {
      if (!en.has(key)) missing.push(`${key} (${file})`);
    }
  }
  assert.deepEqual(missing, []);
});

test("every category has a label in both languages", () => {
  const ids = [...readFileSync(join(root, "src/lib/categories.ts"), "utf8").matchAll(/id: "(\w+)"/g)].map((m) => m[1]);
  for (const locale of ["en.json", "ar.json"]) {
    const labels = load(locale).categories;
    for (const id of ids) assert.ok(labels[id], `${locale} missing categories.${id}`);
  }
});
