import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const version = process.argv[2]?.replace(/^v/, "");

if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  throw new Error("Usage: npm run release -- <major.minor.patch>");
}

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    ...options,
  });
}

function capture(command, args) {
  return execFileSync(command, args, { cwd: rootDir, encoding: "utf8" }).trim();
}

const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
if (packageJson.version !== version) {
  throw new Error(`package.json is ${packageJson.version}; expected ${version}.`);
}

if (capture("git", ["status", "--porcelain"])) {
  throw new Error("Release from a clean working tree.");
}

run("git", ["fetch", "origin", "main", "--tags"]);
const head = capture("git", ["rev-parse", "HEAD"]);
const main = capture("git", ["rev-parse", "origin/main"]);
if (head !== main) {
  throw new Error("Release only after the preparation commit is merged to main.");
}

run(npm, ["run", "lint"]);
run(npm, ["run", "typecheck"]);
run(npm, ["run", "format:check"]);
run(npm, ["test"]);
run(npm, ["run", "build"]);

const releaseDir = mkdtempSync(join(tmpdir(), "superposition-release-"));
const packed = JSON.parse(
  execFileSync(npm, ["pack", "--json", "--pack-destination", releaseDir], {
    cwd: rootDir,
    encoding: "utf8",
  }),
);
const tarball = join(releaseDir, packed[0].filename);
const tag = `v${version}`;

run("git", ["tag", "-a", tag, "-m", `Release ${tag}`]);
run("git", ["push", "origin", tag]);
run("gh", ["release", "create", tag, tarball, "--title", tag, "--generate-notes"]);
rmSync(releaseDir, { recursive: true, force: true });
