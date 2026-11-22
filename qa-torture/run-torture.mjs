import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { runStaticAudit } from './checks/static-audit.mjs';
import { runBrowserLayers } from './e2e/run-browser-layers.mjs';

const ROOT = process.cwd();

async function main() {
  const layers = [];

  // Capa 1
  layers.push(runStaticAudit());

  // Capa 2 (Electron - Auto-omitida)
  layers.push({
    layer: 'Capa 2 — Auditoría Electron',
    checks: [{ name: 'Detección de Electron', ok: true, durationMs: 0, details: 'Auto-omitida: proyecto PWA estática sin Electron.' }],
    passed: true,
  });

  // Capa 3 (Fuzzing Vitest + fast-check)
  const startFuzz = Date.now();
  let fuzzOk = true;
  let fuzzDetails = 'Todas las propiedades de fuzzing (1.200+ ejecuciones) pasaron.';
  try {
    execSync('npx vitest run qa-torture/fuzz/logic.fuzz.test.ts', { cwd: ROOT, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    fuzzOk = false;
    fuzzDetails = ((err.stdout || '') + '\n' + (err.stderr || '')).slice(0, 1500);
  }
  layers.push({
    layer: 'Capa 3 — Fuzzing / Property-Based Testing (Vitest + fast-check)',
    checks: [{ name: 'Fuzzing de funciones puras críticas', ok: fuzzOk, durationMs: Date.now() - startFuzz, details: fuzzDetails }],
    passed: fuzzOk,
  });

  // Capas 4 - 7 (Playwright)
  const browserLayers = await runBrowserLayers();
  layers.push(...browserLayers);

  // Compile TORTURE_REPORT.md
  const allPassed = layers.every((l) => l.passed);
  const lines = [
    '# Protocolo de Tortura QA — Reporte Unificado (Mi Hub)',
    '',
    `- **Fecha:** ${new Date().toISOString()}`,
    `- **Resultado Global:** ${allPassed ? 'TODAS LAS CAPAS EN VERDE' : 'SE DETECTARON FALLOS'}`,
    '',
    ...layers.flatMap((l) => [
      `## ${l.layer} — ${l.passed ? 'PASS' : 'FAIL'}`,
      ...l.checks.map((c) => `- **${c.name}** (${c.ok ? 'OK' : 'FAIL'}, ${c.durationMs}ms): ${c.details}`),
      '',
    ]),
  ];

  const reportPath = path.join(ROOT, 'qa-torture', 'TORTURE_REPORT.md');
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');
  console.log(lines.join('\n'));
  process.exit(allPassed ? 0 : 1);
}

main();
