import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';
import { startStaticServer, isolatePage } from './helpers.mjs';

const ROOT = process.cwd();
const ARTIFACTS = path.join(ROOT, 'qa-torture', 'artifacts');
fs.mkdirSync(ARTIFACTS, { recursive: true });

export async function runBrowserLayers() {
  const { server, baseUrl } = await startStaticServer(ROOT);
  const browser = await chromium.launch({ headless: true });

  const layer4 = { layer: 'Capa 4 — Flujos Críticos, Sabotaje de Red y Responsive', checks: [], passed: true };
  const layer5 = { layer: 'Capa 5 — Accesibilidad Automática (WCAG 2.1 A/AA)', checks: [], passed: true };
  const layer6 = { layer: 'Capa 6 — Modo Mono Caótico (gremlins.js, 250+ acciones)', checks: [], passed: true };
  const layer7 = { layer: 'Capa 7 — Estrés de Volumen y Memoria', checks: [], passed: true };

  try {
    // =========================================================================
    // CAPA 4: Critical flows + Offline/F5 + Rapid multi-click + Mobile 390x844
    // =========================================================================
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      const errors = { pageErrors: [], consoleErrors: [] };
      await isolatePage(page, errors);

      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      const h1Text = await page.locator('h1').first().textContent();
      const rootVisible = Boolean(h1Text && h1Text.includes('Mi Hub'));

      // Flow 1: Toggle night pill + rapid double-click
      await page.locator('#btnToggleNoche').dblclick();
      await page.locator('#btnToggleNoche').click();

      // Flow 2: Open Glucose modal, submit reading
      await page.getByRole('button', { name: /Cargar/i }).first().click();
      await page.locator('#inputGlucoseVal').fill('121');
      await page.getByRole('button', { name: /Guardar Medición/i }).click();
      const lastGlucose = await page.locator('#lastGlucoseValue').textContent();

      // Flow 3: Open "¿Qué miro hoy?", mark "Ya la vi", add to list
      await page.getByRole('button', { name: /¿Qué miro hoy\?/i }).click();
      await page.getByRole('button', { name: /Ya la vi/i }).last().click();
      await page.getByRole('button', { name: /Sumar a Mi Lista/i }).click();

      // Flow 4: Open Metal Graph modal & close
      await page.getByRole('button', { name: /Explorar Grafo Metal Archives/i }).click();
      await page.locator('#dlgMetal button[aria-label="Cerrar"]').click();

      // Sabotage 1: Offline + F5 reload
      await context.setOffline(true);
      await page.locator('#btnToggleManana').click();
      await context.setOffline(false);
      await page.reload({ waitUntil: 'domcontentloaded' });
      const afterReloadGlucose = await page.locator('#lastGlucoseValue').textContent();

      // Sabotage 3: Mobile Responsive 390x844
      await page.setViewportSize({ width: 390, height: 844 });
      const overflowPx = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

      const flowOk = rootVisible && lastGlucose === '121' && afterReloadGlucose === '121' && errors.pageErrors.length === 0 && errors.consoleErrors.length === 0;
      const mobileOk = overflowPx <= 16;

      layer4.checks.push({
        name: 'Flujos críticos + Offline/F5 + Doble clic',
        ok: flowOk,
        durationMs: 0,
        details: flowOk
          ? 'Todos los flujos críticos, persistencia localStorage tras F5 y 0 pageerror/console.error.'
          : `pageErrors=${JSON.stringify(errors.pageErrors)} consoleErrors=${JSON.stringify(errors.consoleErrors)} lastGlucose=${lastGlucose}`
      });
      layer4.checks.push({
        name: 'Responsive Mobile (390x844)',
        ok: mobileOk,
        durationMs: 0,
        details: `Desborde horizontal: ${overflowPx}px (límite <= 16px).`
      });
      if (!flowOk || !mobileOk) layer4.passed = false;
      await context.close();
    }

    // =========================================================================
    // CAPA 5: Accessibility (@axe-core/playwright)
    // =========================================================================
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      const errors = { pageErrors: [], consoleErrors: [] };
      await isolatePage(page, errors);
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

      const axeResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      fs.writeFileSync(path.join(ARTIFACTS, 'a11y-report.json'), JSON.stringify(axeResults.violations, null, 2));
      const severe = axeResults.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
      const a11yOk = severe.length === 0;

      layer5.checks.push({
        name: 'Auditoría WCAG 2.1 A/AA (axe-core)',
        ok: a11yOk,
        durationMs: 0,
        details: a11yOk
          ? `0 violaciones critical/serious (${axeResults.violations.length} menores/moderadas).`
          : severe.map((v) => `[${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodos)`).join('\n')
      });
      if (!a11yOk) layer5.passed = false;
      await context.close();
    }

    // =========================================================================
    // CAPA 6: Chaotic Monkey Testing (gremlins.js, 250+ actions)
    // =========================================================================
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      const errors = { pageErrors: [], consoleErrors: [] };
      await isolatePage(page, errors);
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

      const gremlinsPath = path.join(ROOT, 'node_modules', 'gremlins.js', 'dist', 'gremlins.min.js');
      await page.addScriptTag({ path: gremlinsPath });

      const actionsRun = await page.evaluate(async () => {
        const horde = window.gremlins.createHorde({
          species: [
            window.gremlins.species.clicker(),
            window.gremlins.species.formFiller(),
            window.gremlins.species.typer(),
            window.gremlins.species.scroller()
          ],
          strategies: [window.gremlins.strategies.distribution({ nb: 260, delay: 5 })],
          randomizer: new window.gremlins.Chance(1337)
        });
        await horde.unleash();
        return 260;
      });

      const bodyLen = await page.evaluate(() => document.body.innerText.trim().length);
      const monkeyOk = bodyLen > 50 && errors.pageErrors.length === 0 && errors.consoleErrors.length === 0;

      layer6.checks.push({
        name: `Horda caótica gremlins.js (${actionsRun} acciones)`,
        ok: monkeyOk,
        durationMs: 0,
        details: monkeyOk
          ? `260 acciones ejecutadas sin crashes, 0 pageerror, 0 console.error, UI intacta.`
          : `Fallos: pageErrors=${JSON.stringify(errors.pageErrors)} consoleErrors=${JSON.stringify(errors.consoleErrors)} bodyLen=${bodyLen}`
      });
      if (!monkeyOk) layer6.passed = false;
      await context.close();
    }

    // =========================================================================
    // CAPA 7: High-Volume & Memory Stress Test (3,000+ records)
    // =========================================================================
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await context.newPage();
      const errors = { pageErrors: [], consoleErrors: [] };
      await isolatePage(page, errors);

      await page.addInitScript(() => {
        const glucoseLogs = Array.from({ length: 1500 }, (_, i) => ({
          date: `Día ${i + 1}`,
          slot: i % 2 === 0 ? 'En ayunas' : 'Antes de almorzar',
          value: 95 + (i % 45),
          note: `Registro estrés #${i + 1}`
        }));
        const watchlist = Array.from({ length: 1500 }, (_, i) => ({
          id: 10000 + i,
          title: `Serie Estrés ${i + 1}`,
          platform: ['Max', 'Netflix', 'Disney+', 'Prime Video', 'Paramount+', 'Apple TV+'][i % 6],
          season: 1,
          ep: 1
        }));
        const watchedSeries = Array.from({ length: 500 }, (_, i) => ({
          id: 50000 + i,
          title: `Vista Estrés ${i + 1}`,
          platform: 'Max',
          seasonsWatched: 2,
          genreIds: [18]
        }));
        localStorage.setItem('mi_hub_personal_v2', JSON.stringify({
          waPhone: '5493573495333',
          tmdbKey: '',
          pillNames: { manana: 'Metformina 850mg (Mañana)', noche: 'Metformina 850mg (Pre-Cena)' },
          pillsTakenByDate: {},
          glucoseLogs,
          watchlist,
          watchedSeries,
          riverMatchIndex: 0,
          metalBandIndex: 0
        }));
      });

      const t0 = Date.now();
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      const loadMs = Date.now() - t0;

      const metrics = await page.evaluate(() => {
        const domNodes = document.querySelectorAll('*').length;
        const lsBytes = new Blob([localStorage.getItem('mi_hub_personal_v2') || '']).size;
        const heapMb = performance.memory ? +(performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(2) : null;
        return { domNodes, localStorageKB: +(lsBytes / 1024).toFixed(1), heapMb };
      });

      const stressReport = { loadMs, ...metrics, totalRecords: 3500 };
      fs.writeFileSync(path.join(ARTIFACTS, 'stress-metrics.json'), JSON.stringify(stressReport, null, 2));

      const stressOk = loadMs < 10000 && metrics.domNodes < 15000 && errors.pageErrors.length === 0;
      layer7.checks.push({
        name: 'Estrés de volumen (3.500 registros en localStorage)',
        ok: stressOk,
        durationMs: loadMs,
        details: `Carga: ${loadMs}ms (<10.000ms) | Nodos DOM: ${metrics.domNodes} (<15.000) | localStorage: ${metrics.localStorageKB} KB | Heap JS: ${metrics.heapMb ?? 'N/A'} MB`
      });
      if (!stressOk) layer7.passed = false;
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  return [layer4, layer5, layer6, layer7];
}
