#!/usr/bin/env node
/**
 * Ensures package.json version, optional git tag, and built userscript stay in sync.
 *
 * Usage:
 *   node scripts/assert-version-sync.mjs
 *   node scripts/assert-version-sync.mjs --tag v0.1.0
 *   node scripts/assert-version-sync.mjs --dist
 *
 * Env:
 *   GITHUB_REF_NAME — if set and looks like v*, used when --tag is omitted
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = resolve(root, "package.json");
const distPath = resolve(root, "dist/vvsu-tweaks.user.js");

const argv = process.argv.slice(2);
const checkDist = argv.includes("--dist");

function flagValue(name) {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  const v = argv[i + 1];
  if (!v || v.startsWith("--")) return null;
  return v;
}

const tagFlag = flagValue("--tag");
const tagFromEnv =
  process.env.GITHUB_REF_NAME && /^v\d/.test(process.env.GITHUB_REF_NAME)
    ? process.env.GITHUB_REF_NAME
    : undefined;
const tagRef = tagFlag === null ? null : (tagFlag ?? tagFromEnv);

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const TAG = /^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

function fail(msg) {
  console.error(`::error::${msg}`);
  console.error(msg);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const pkgVersion = String(pkg.version ?? "").trim();

if (!SEMVER.test(pkgVersion)) {
  fail(`package.json version "${pkgVersion}" is not valid semver (expected X.Y.Z)`);
}

if (tagRef === null) {
  fail("Flag --tag requires a value like v0.1.0");
}

if (tagRef) {
  if (!TAG.test(tagRef)) {
    fail(`Tag "${tagRef}" must look like vX.Y.Z`);
  }
  const tagVersion = tagRef.slice(1);
  if (tagVersion !== pkgVersion) {
    fail(
      `Version mismatch: git tag ${tagRef} ≠ package.json ${pkgVersion}. ` +
        `Use: npm run release:patch|minor|major  (or tag v${pkgVersion})`,
    );
  }
  console.log(`OK: tag ${tagRef} matches package.json ${pkgVersion}`);
} else {
  console.log(`OK: package.json version ${pkgVersion}`);
}

if (checkDist) {
  if (!existsSync(distPath)) {
    fail(`Missing build output: ${distPath}`);
  }
  const code = readFileSync(distPath, "utf8");
  const match = code.match(/\/\/\s*@version\s+(\S+)/);
  if (!match) {
    fail(`No @version in ${distPath}`);
  }
  const distVersion = match[1];
  if (distVersion !== pkgVersion) {
    fail(`Built userscript @version ${distVersion} ≠ package.json ${pkgVersion}`);
  }
  console.log(`OK: dist @version ${distVersion}`);
}
