import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// Pure functions mirroring Mi Hub core logic
function calcGlucoseAverage(logs) {
  const valid = logs
    .map((l) => Number(l?.value))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 1000);
  if (valid.length === 0) return 0;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

function formatWhatsAppUrl(phoneRaw, message) {
  // Strip any astral-plane 4-byte emojis to guarantee zero rombos
  const cleanMsg = String(message || '').replace(/[\u{10000}-\u{10FFFF}]/gu, '');
  const phone = String(phoneRaw || '').replace(/\D/g, '');
  return phone
    ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(cleanMsg)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(cleanMsg)}`;
}

function parseSpotifyEmbedUrl(rawUrl) {
  const match = String(rawUrl || '').trim().match(/open\.spotify\.com\/(playlist|album|artist|track)\/([a-zA-Z0-9]+)/);
  if (!match) return null;
  return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
}

function stepEpisode(season, ep, maxEps, totalSeasons) {
  const safeMax = Math.max(1, Math.floor(Number.isFinite(maxEps) ? maxEps : 10));
  const safeTotal = Math.max(1, Math.floor(Number.isFinite(totalSeasons) ? totalSeasons : 1));
  const curSeason = Math.max(1, Math.floor(Number.isFinite(season) ? season : 1));
  const curEp = Math.max(1, Math.floor(Number.isFinite(ep) ? ep : 1));
  if (curEp >= safeMax) {
    if (curSeason < safeTotal) return { season: curSeason + 1, ep: 1, finished: false };
    return { season: curSeason, ep: safeMax, finished: true };
  }
  return { season: curSeason, ep: curEp + 1, finished: false };
}

describe('Capa 3 — Fuzzing / Property-Based Testing (Mi Hub)', () => {
  it('calcGlucoseAverage nunca devuelve NaN, Infinity ni negativos ante valores extremos', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ value: fc.oneof(fc.double(), fc.constant(NaN), fc.constant(Infinity), fc.constant(-Infinity), fc.string()) }), { maxLength: 100 }),
        (logs) => {
          const avg = calcGlucoseAverage(logs);
          expect(Number.isFinite(avg)).toBe(true);
          expect(avg).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 300 }
    );
  });

  it('formatWhatsAppUrl nunca incluye emojis de 4 bytes (cero rombos) y usa api.whatsapp.com/send', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (phone, msg) => {
        const url = formatWhatsAppUrl(phone, msg);
        expect(url.startsWith('https://api.whatsapp.com/send?')).toBe(true);
        const decoded = decodeURIComponent(url.split('text=')[1] || '');
        expect(/[\u{10000}-\u{10FFFF}]/u.test(decoded)).toBe(false);
      }),
      { numRuns: 300 }
    );
  });

  it('parseSpotifyEmbedUrl no lanza excepciones con URLs arbitrarias', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const res = parseSpotifyEmbedUrl(raw);
        if (res !== null) {
          expect(res.startsWith('https://open.spotify.com/embed/')).toBe(true);
        }
      }),
      { numRuns: 300 }
    );
  });

  it('stepEpisode nunca excede maxEps ni cae debajo de 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -5, max: 20 }),
        fc.integer({ min: -5, max: 50 }),
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 1, max: 15 }),
        (season, ep, maxEps, totalSeasons) => {
          const next = stepEpisode(season, ep, maxEps, totalSeasons);
          expect(next.season).toBeGreaterThanOrEqual(1);
          expect(next.ep).toBeGreaterThanOrEqual(1);
          expect(next.ep).toBeLessThanOrEqual(maxEps);
        }
      ),
      { numRuns: 300 }
    );
  });
});
