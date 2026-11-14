// Regenerates the Linux visual baselines inside Docker from the committed HEAD.
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const fail = (message) => {
  console.error(`screenshots: ${message}`);
  process.exit(1);
};
const run = (cmd, args, options = {}) =>
  spawnSync(cmd, args, { cwd: root, encoding: "utf8", ...options });

if (run("docker", ["info"]).status !== 0) {
  fail("Docker is not running. Start Docker Desktop and try again.");
}

// The baseline must match a commit, so local edits would make it unreproducible
const dirty = run("git", ["status", "--porcelain", "--", "src", "e2e"]).stdout.trim();
if (dirty) {
  fail(`uncommitted changes in src/ or e2e/; commit them first:\n${dirty}`);
}

const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const playwright = readJson("node_modules/@playwright/test/package.json").version;
const pnpm = readJson("package.json").packageManager.split("@")[1];
const image = `mcr.microsoft.com/playwright:v${playwright}-noble`;
const container = `screenshots-${process.pid}`;

const script = [
  "set -e",
  "mkdir /w && cd /w && tar -x",
  `npm i -g pnpm@${pnpm}`,
  "pnpm install --frozen-lockfile",
  "pnpm build",
  // =all because a plain update keeps files whose diff is under the tolerance
  "pnpm exec playwright test --project=chromium --grep @visual --update-snapshots=all",
].join(" && ");

console.log(`screenshots: image ${image}, pnpm ${pnpm}`);
const archive = spawn("git", ["archive", "HEAD"], { cwd: root, stdio: ["ignore", "pipe", "inherit"] });
const docker = spawn("docker", ["run", "--name", container, "-i", image, "bash", "-c", script], {
  stdio: ["pipe", "inherit", "inherit"],
});
archive.stdout.pipe(docker.stdin);

// Every exit path goes through here so the container never outlives the script
let cleanedUp = false;
function finish(code, message) {
  if (!cleanedUp) {
    cleanedUp = true;
    archive.kill();
    docker.kill();
    run("docker", ["rm", "-f", container]);
  }
  if (message) console.error(`screenshots: ${message}`);
  process.exit(code);
}

process.on("SIGINT", () => finish(130, "interrupted"));
process.on("SIGTERM", () => finish(143, "terminated"));
docker.on("error", (e) => finish(1, `could not run docker: ${e.message}`));
archive.on("error", (e) => finish(1, `could not run git archive: ${e.message}`));

docker.on("close", (code) => {
  if (code !== 0) finish(1, `the container exited with code ${code}`);
  const target = join(root, "e2e", "__screenshots__", "linux");
  const copy = run("docker", ["cp", `${container}:/w/e2e/__screenshots__/linux/.`, target]);
  if (copy.status !== 0) finish(1, `could not copy the screenshots:
${copy.stderr}`);
  const changes = run("git", ["status", "--short", "--", "e2e/__screenshots__/linux"]).stdout.trim();
  console.log(changes ? `screenshots: changes
${changes}` : "screenshots: no changes against HEAD");
  finish(0);
});
