import { describe, expect, it } from "vitest";
import { FAILED, PASSED, SKIPPED, checkTestDatabase, formatSummary, runPreflight } from "./preflight.mjs";

function fakeClock() {
  let current = 0;
  return () => (current += 500);
}

describe("runPreflight", () => {
  it("returns exit code 0 when every step passes", async () => {
    const ran = [];
    const { results, exitCode } = await runPreflight({
      steps: [{ name: "a", script: "a" }, { name: "b", script: "b" }],
      run: (script) => (ran.push(script), 0),
      log: () => undefined,
      now: fakeClock()
    });

    expect(exitCode).toBe(0);
    expect(ran).toEqual(["a", "b"]);
    expect(results.map((result) => result.status)).toEqual([PASSED, PASSED]);
  });

  it("keeps running after a failed step and returns exit code 1", async () => {
    const ran = [];
    const { results, exitCode } = await runPreflight({
      steps: [{ name: "lint", script: "lint" }, { name: "build", script: "build" }],
      run: (script) => (ran.push(script), script === "lint" ? 2 : 0),
      log: () => undefined,
      now: fakeClock()
    });

    expect(exitCode).toBe(1);
    expect(ran).toEqual(["lint", "build"]);
    expect(results[0]).toMatchObject({ status: FAILED, reason: "çıkış kodu 2" });
    expect(results[1].status).toBe(PASSED);
  });

  it("reports a skipped step with its reason without failing", async () => {
    const lines = [];
    const ran = [];
    const { results, exitCode } = await runPreflight({
      steps: [{ name: "db:test", script: "db:test", precondition: async () => "bağlantı yok" }],
      run: (script) => (ran.push(script), 0),
      log: (line) => lines.push(line),
      now: fakeClock()
    });

    expect(exitCode).toBe(0);
    expect(ran).toEqual([]);
    expect(results[0]).toMatchObject({ status: SKIPPED, reason: "bağlantı yok" });
    expect(lines.join("\n")).toContain("ATLANDI (bağlantı yok)");
  });
});

describe("formatSummary", () => {
  it("prints one row per step with duration", () => {
    const table = formatSummary([
      { name: "test", status: PASSED, reason: null, durationMs: 1500 },
      { name: "db:test", status: SKIPPED, reason: "neden", durationMs: 0 }
    ]);

    expect(table).toContain("| test ");
    expect(table).toContain("1.5 sn");
    expect(table).toContain("ATLANDI (neden)");
  });
});

describe("checkTestDatabase", () => {
  it("skips when the connection variable is missing", async () => {
    expect(await checkTestDatabase({})).toBe("TEST_DATABASE_MIGRATION_URL tanımlı değil");
  });

  it("does not leak connection details when the database is unreachable", async () => {
    const reason = await checkTestDatabase({
      TEST_DATABASE_MIGRATION_URL: "postgres://gizli-kullanici:gizli-parola@127.0.0.1:1/yok"
    });

    expect(reason).toMatch(/^test veritabanına bağlanılamadı/);
    expect(reason).not.toContain("gizli");
  });
});
