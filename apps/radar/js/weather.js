/* 무작위 날씨와 진행 중 변화, 바람 표류(순수 계산). 난이도와 무관. 끄면(enabled=false) 아무것도 바꾸지 않음 */
import { makeProj, wrap360 } from './geo.js';

const D = Math.PI / 180;
const KIND = { clear: ['맑음', 'Clear'], wind: ['강풍·높은 파도', 'Strong wind'], showers: ['소나기', 'Showers'], duct: ['이상 전파', 'Ducting'] };
const rr = (r, a, b) => a + r() * (b - a);
/* 해상 상태 0~8(더글러스 해상 상태)와 보퍼트 풍력 계급의 대응: 풍속은 그 계급의 대표값(m/s), 파고는 유의 파고 범위 */
export const SEA_STATE = [
  { bft: '0', ms: 0, wave: '0 m', ko: '고요(거울 같은 바다)', en: 'Calm (glassy)' },
  { bft: '1', ms: 1, wave: '0~0.1 m', ko: '고요(잔물결)', en: 'Calm (rippled)' },
  { bft: '2~3', ms: 3.5, wave: '0.1~0.5 m', ko: '잔잔함', en: 'Smooth' },
  { bft: '4', ms: 7, wave: '0.5~1.25 m', ko: '약간 거침', en: 'Slight' },
  { bft: '5', ms: 9.5, wave: '1.25~2.5 m', ko: '보통', en: 'Moderate' },
  { bft: '6', ms: 12.5, wave: '2.5~4 m', ko: '거침', en: 'Rough' },
  { bft: '7', ms: 15.5, wave: '4~6 m', ko: '매우 거침', en: 'Very rough' },
  { bft: '8~9', ms: 20.5, wave: '6~9 m', ko: '높음', en: 'High' },
  { bft: '10~11', ms: 27, wave: '9~14 m', ko: '매우 높음', en: 'Very high' },
];
const windOfSea = (sea) => SEA_STATE[Math.max(0, Math.min(8, Math.round(sea)))].ms;
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));

function rainBand(r, own, windFrom, dist0, dist1) {
  const P = makeProj(own.lat, own.lon), n = 2 + Math.floor(r() * 3), out = [];
  const b = windFrom + rr(r, -40, 40), d = rr(r, dist0, dist1);
  for (let i = 0; i < n; i++) {
    const bb = (b + (i - n / 2) * 12) * D, dd = d + rr(r, -1, 1);
    out.push({ lat: P.lat(dd * Math.cos(bb)), lon: P.lon(dd * Math.sin(bb)), rNM: rr(r, 0.8, 1.8), rate: Math.round(rr(r, 4, 10)) });
  }
  return out;
}

/* 난이도별 날씨 상한(처음 하는 학생에게 강풍·안개까지 한꺼번에 주지 않게). 시나리오 고정 날씨(S5)는 그대로 */
export const WX_CAP = { none: { sea: 3, fog: false }, easy: { sea: 3, fog: false }, medium: { sea: 5, fog: true }, hard: { sea: 8, fog: true } };
/* 시작 날씨. base(시나리오 고정)가 있으면 그것을 씀. cap = WX_CAP[난이도] */
/* 조류: 방향(흘러가는 쪽, SET) 0~359° 무작위, 세기(DRIFT) 0~4 kn 무작위 */
export const rollCurrent = (rnd) => ({ set: Math.floor(rnd() * 360), drift: Math.round(rnd() * 40) / 10 });
export function rollWeather(rnd, base, own, cap = WX_CAP.hard) {
  if (base) return { kind: base.kind || ((base.rain || []).length ? 'showers' : 'clear'), fog: !!base.fog, visNM: base.visNM ?? (base.fog ? 0.5 : 10), ducting: false, interference: false, ...base, rain: (base.rain || []).map((c) => ({ ...c })), fixed: true };
  const u = rnd(), kind = u < 0.4 ? 'clear' : u < 0.6 ? 'wind' : u < 0.85 ? 'showers' : 'duct';
  const windFrom = Math.round(rnd() * 360);
  // 해상 0~8: 맑음 0~3, 소나기 2~5, 강풍 5~8, 이상 전파(잔잔할 때 잘 생김) 0~2 — 난이도 상한으로 자름
  const sea = kind === 'wind' ? ri(rnd, 5, 8) : kind === 'showers' ? ri(rnd, 2, 5) : kind === 'duct' ? ri(rnd, 0, 2) : ri(rnd, 0, 3);
  const fog = (kind === 'clear' || kind === 'showers') && rnd() < 0.3 && cap.fog, s2 = Math.min(sea, cap.sea), k2 = kind === 'wind' && s2 < 5 ? 'clear' : kind;
  return { current: rollCurrent(rnd), kind: k2, fog, visNM: fog ? Math.round(rr(rnd, 0.5, 2) * 10) / 10 : 10, sea: s2, windFrom, windMs: windOfSea(s2), rain: kind === 'showers' ? rainBand(rnd, own, windFrom, 2, 8) : [], ducting: kind === 'duct', interference: false };
}

export function createWeatherRun({ rnd, enabled = true, cap = WX_CAP.hard }) { return { rnd, enabled, cap, next: rr(rnd, 600, 1500), seaTarget: null, seaT: 0 }; }

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
      const mx = (run.cap || WX_CAP.hard).sea, up = w.sea <= 2 || (w.sea < mx && r() < 0.5), t = Math.max(0, Math.min(mx, w.sea + (up ? 1 : -1) * (1 + Math.floor(r() * 2))));
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
export const speedLoss = (sea) => (sea >= 8 ? 3 : sea >= 7 ? 2.2 : sea >= 6 ? 1.5 : sea >= 5 ? 0.8 : 0);

export const currentLabel = (w, lang) => (w.current && w.current.drift >= 0.05 ? `${lang === 'en' ? 'Cur' : '조류'} ${String(Math.round(w.current.set)).padStart(3, '0')}°/${w.current.drift.toFixed(1)}kn` : '');
/* short = 헤더용(풍력 계급 뺌, 조류 짧게). 전체는 단추 풍선 도움말에 */
export function weatherLabel(w, lang, short = false) {
  const en = lang === 'en', k = (KIND[w.kind] || KIND.clear)[en ? 1 : 0];
  const st = SEA_STATE[Math.max(0, Math.min(8, Math.round(w.sea || 0)))];
  const c = w.current && w.current.drift >= 0.05 ? ` · ${en ? 'Current' : '조류'} ${String(Math.round(w.current.set)).padStart(3, '0')}° ${w.current.drift.toFixed(1)} kn` : '';
  if (short) return `${k} · ${en ? 'Sea' : '해상'} ${w.sea}` + (w.fog ? ` · ${en ? 'Vis' : '시정'} ${w.visNM}` : '');
  return `${k} · ${en ? 'Sea' : '해상'} ${w.sea} (${en ? 'Bft' : '풍력'} ${st.bft})` + (w.fog ? ` · ${en ? 'Vis' : '시정'} ${w.visNM} NM` : '') + c;
}
