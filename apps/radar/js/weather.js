/* 무작위 날씨와 진행 중 변화, 바람 표류(순수 계산). 난이도와 무관. 끄면(enabled=false) 아무것도 바꾸지 않음 */
import { makeProj, wrap360 } from './geo.js';

const D = Math.PI / 180;
const KIND = { clear: ['맑음', 'Clear'], wind: ['강풍·높은 파도', 'Strong wind'], showers: ['소나기', 'Showers'], duct: ['이상 전파', 'Ducting'] };
const rr = (r, a, b) => a + r() * (b - a);
const windOfSea = (sea) => Math.round(3 + sea * 2.8);

function rainBand(r, own, windFrom, dist0, dist1) {
  const P = makeProj(own.lat, own.lon), n = 2 + Math.floor(r() * 3), out = [];
  const b = windFrom + rr(r, -40, 40), d = rr(r, dist0, dist1);
  for (let i = 0; i < n; i++) {
    const bb = (b + (i - n / 2) * 12) * D, dd = d + rr(r, -1, 1);
    out.push({ lat: P.lat(dd * Math.cos(bb)), lon: P.lon(dd * Math.sin(bb)), rNM: rr(r, 0.8, 1.8), rate: Math.round(rr(r, 4, 10)) });
  }
  return out;
}

/* 시작 날씨. base(시나리오 고정)가 있으면 그것을 씀 */
export function rollWeather(rnd, base, own) {
  if (base) return { kind: base.kind || ((base.rain || []).length ? 'showers' : 'clear'), fog: !!base.fog, visNM: base.visNM ?? (base.fog ? 0.5 : 10), ducting: false, interference: false, ...base, rain: (base.rain || []).map((c) => ({ ...c })), fixed: true };
  const u = rnd(), kind = u < 0.4 ? 'clear' : u < 0.6 ? 'wind' : u < 0.85 ? 'showers' : 'duct';
  const windFrom = Math.round(rnd() * 360);
  const sea = kind === 'wind' ? 5 + Math.floor(rnd() * 2) : kind === 'showers' ? 2 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 2);
  const fog = (kind === 'clear' || kind === 'showers') && rnd() < 0.3;
  return { kind, fog, visNM: fog ? Math.round(rr(rnd, 0.5, 2) * 10) / 10 : 10, sea, windFrom, windMs: windOfSea(sea), rain: kind === 'showers' ? rainBand(rnd, own, windFrom, 2, 8) : [], ducting: kind === 'duct', interference: false };
}

export function createWeatherRun({ rnd, enabled = true }) { return { rnd, enabled, next: rr(rnd, 600, 1500), seaTarget: null, seaT: 0 }; }

/* w(=W.weather)를 제자리에서 바꿈. 알림 목록을 돌려줌 */
export function stepWeather(run, w, dt, own) {
  if (!run.enabled || w.fixed) return [];
  const r = run.rnd, ev = [], P = makeProj(own.lat, own.lon);
  // 비구름은 바람 따라 이동, 멀어지면 사라짐
  if (w.rain.length) {
    const to = (w.windFrom + 180) * D, v = 4.5 / 3600 * dt;
    w.rain = w.rain.map((c) => { const x = P.x(c.lon) + v * Math.sin(to), y = P.y(c.lat) + v * Math.cos(to); return { ...c, lat: P.lat(y), lon: P.lon(x) }; })
      .filter((c) => Math.hypot(P.x(c.lon), P.y(c.lat)) < 15);
    if (!w.rain.length && w.kind === 'showers') w.kind = 'clear';
  }
  // 바람·해상은 목표값으로 2분에 1단계
  if (run.seaTarget !== null && run.seaTarget !== w.sea) {
    run.seaT += dt;
    if (run.seaT >= 120) { run.seaT = 0; w.sea += Math.sign(run.seaTarget - w.sea); w.windMs = windOfSea(w.sea); if (w.kind !== 'showers' && w.kind !== 'duct') w.kind = w.sea >= 5 ? 'wind' : 'clear'; }
  }
  run.next -= dt;
  if (run.next <= 0) {
    run.next = rr(r, 600, 1500);
    if (r() < 0.5) {
      const band = rainBand(r, own, w.windFrom, 6, 10), b = Math.round(wrap360(w.windFrom));
      w.rain = w.rain.concat(band); w.kind = 'showers';
      ev.push({ kind: 'rain', ko: `강우 구역 접근 · 방위 ${String(b).padStart(3, '0')}°`, en: `Rain area approaching · ${String(b).padStart(3, '0')}°` });
    } else {
      const up = w.sea <= 2 || (w.sea < 6 && r() < 0.5), t = Math.max(0, Math.min(6, w.sea + (up ? 1 : -1) * (1 + Math.floor(r() * 2))));
      run.seaTarget = t; run.seaT = 0; w.windFrom = Math.round(wrap360(w.windFrom + rr(r, -30, 30)));
      ev.push(up ? { kind: 'wind', ko: `바람이 강해짐 · 해상 ${t}까지`, en: `Wind increasing · sea ${t}` } : { kind: 'wind', ko: `바람이 약해짐 · 해상 ${t}까지`, en: `Wind easing · sea ${t}` });
    }
  }
  return ev;
}

/* 바람에 밀리는 표류: 정횡 바람에서 최대 0.6 kn, 바람 아래쪽으로 */
export function windDrift(windFrom, windMs, hdg) {
  const rel = (windFrom - hdg) * D, drift = Math.min(0.6, 0.6 * Math.abs(Math.sin(rel)) * Math.min(1, windMs / 20));
  return { set: wrap360(windFrom + 180), drift };
}
export const speedLoss = (sea) => (sea >= 6 ? 1.5 : sea >= 5 ? 0.8 : 0);

export function weatherLabel(w, lang) {
  const en = lang === 'en', k = (KIND[w.kind] || KIND.clear)[en ? 1 : 0];
  return `${k} · ${en ? 'Sea' : '해상'} ${w.sea}` + (w.fog ? ` · ${en ? 'Vis' : '시정'} ${w.visNM} NM` : '');
}
