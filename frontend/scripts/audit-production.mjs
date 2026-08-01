import { spawnSync } from "node:child_process";

const minimumSeverity = 3;
const severityRank = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};
const acceptedAdvisories = new Map([
  [
    "GHSA-qwww-vcr4-c8h2",
    "React Router states this affects only unstable RSC APIs; this project is a client-only BrowserRouter SPA.",
  ],
]);

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error("Run this check through npm run audit:prod so the npm CLI can be resolved safely.");
  process.exit(1);
}

const audit = spawnSync(process.execPath, [npmCli, "audit", "--omit=dev", "--json"], {
  encoding: "utf8",
});

if (audit.error) {
  console.error(`Unable to run npm audit: ${audit.error.message}`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  console.error("npm audit did not return valid JSON.");
  if (audit.stderr) console.error(audit.stderr.trim());
  process.exit(1);
}

if (report.error || !report.vulnerabilities || !report.metadata) {
  const auditError = report.error?.summary || report.error?.code || "incomplete audit response";
  console.error(`npm audit failed: ${auditError}`);
  process.exit(1);
}

const findings = [];
const accepted = [];

for (const [dependency, vulnerability] of Object.entries(report.vulnerabilities || {})) {
  for (const advisory of vulnerability.via || []) {
    if (typeof advisory === "string") continue;
    if ((severityRank[advisory.severity] || 0) < minimumSeverity) continue;

    const advisoryId = advisory.url?.split("/").pop();
    const rationale = advisoryId ? acceptedAdvisories.get(advisoryId) : undefined;

    if (rationale) {
      accepted.push(`${advisoryId} (${dependency}): ${rationale}`);
    } else {
      findings.push(
        `${advisory.severity.toUpperCase()} ${dependency}: ${advisory.title} (${advisory.url || "no advisory URL"})`,
      );
    }
  }
}

for (const item of [...new Set(accepted)]) {
  console.warn(`Accepted scoped advisory: ${item}`);
}

if (findings.length > 0) {
  console.error(`Production dependency audit failed:\n- ${[...new Set(findings)].join("\n- ")}`);
  process.exit(1);
}

console.log("Production dependency audit passed: no unaccepted High/Critical advisories.");
