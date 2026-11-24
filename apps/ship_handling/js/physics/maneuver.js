import { SH, DEG, KN, G9, clamp } from './ship.js';
/* 1차 노모토 모델(T·r′ + r = K·δ)에 횡이동, 속력 감소, 횡경사를 더한 단순 조종 모델.
   K = K′·U/L, T = T′·L/U. 반환 값은 모두 '모델 값'이다. */
export const KM_REF = 18.05; // 중앙 단면 계산값(stability.SEC0.KM)과 맞춤
const RUD_AREA = 70;
export function maneuver(o) {
  const dt = o.dt || 0.25, n = Math.ceil(o.dur / dt) + 1, L = SH.L;
  const A = {}; for (const k of ['X', 'Z', 'psi', 'u', 'v', 'r', 'phi', 'del', 'cmd']) A[k] = new Float32Array(n);
  let X = o.X0 || 0, Z = o.Z0 || 0, psi = o.psi0 || 0, u = o.U0, v = o.v0 || 0, r = o.r0 || 0, phi = 0, dphi = 0, del = (o.del0 || 0) * DEG;
  const GM = o.GM || 1.8, KG = KM_REF - GM, wn = 2 * Math.PI / (0.8 * SH.B / Math.sqrt(GM));
  const sh = o.shallow || { K: 1, T: 1, speedLoss: 0 };
  const st = { t: 0, psi, X, Z, u, r, v, del, ev: {} };
  let last = n;
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    Object.assign(st, { t, psi, X, Z, u, r, v, del });
    const cmd = clamp(o.cmd(st), -35, 35) * DEG;
    A.X[i] = X; A.Z[i] = Z; A.psi[i] = psi; A.u[i] = u; A.v[i] = v; A.r[i] = r; A.phi[i] = phi; A.del[i] = del; A.cmd[i] = cmd;
    if (o.stop && o.stop(st)) { last = i + 1; break; }
    const rate = (o.rudderRate || 2.32) * DEG * dt; del += clamp(cmd - del, -rate, rate);
    const Ue = Math.max(u, 0.6);
    const Kp = (o.nonlin ? o.K0 / (1 + 0.03 * Math.abs(del) / DEG) : o.K0) * sh.K;
    const K = Kp * Ue / L, T = o.Tp * sh.T * L / Ue;
    const extra = o.moment ? o.moment(st) : 0;
    r += (K * (del + extra) - r) / T * dt;
    const cY = o.cY ?? 0.25;
    v += (-cY * Ue * Ue / L * del - (v + r * (o.drift ?? 0.32) * L) / 25 + (o.sway ? o.sway(st) : 0)) * dt;
    const rp = Math.abs(r) * L / Ue, U0 = (o.Ut ? o.Ut(st) : o.U0) * (1 - sh.speedLoss);
    const Ut = U0 * (1 - (o.loss ?? 0.5) * Math.min(1, rp / 0.6));
    u += (Ut - u) / (o.tauU || 60) * dt;
    const phOut = -Math.atan(u * r * (KG - SH.T / 2) / (G9 * GM));
    const Fr = 0.5 * 1025 * RUD_AREA * (Ue * 1.1) ** 2 * 1.6 * Math.sin(del);
    const phIn = Math.atan(Fr * (KG - 6.5) / (SH.disp * 1000 * G9 * GM));
    dphi += (wn * wn * (phIn + phOut - phi) - 2 * 0.08 * wn * dphi) * dt; phi += dphi * dt;
    X += (u * Math.cos(psi) - v * Math.sin(psi)) * dt; Z += (u * Math.sin(psi) + v * Math.cos(psi)) * dt; psi += r * dt;
  }
  if (last < n) for (const k in A) A[k] = A[k].slice(0, last);
  A.dt = dt; A.n = A.X.length; A.dur = (A.n - 1) * dt; return A;
}
export function firstIdx(arr, f) { for (let i = 0; i < arr.length; i++) if (f(arr[i], i)) return i; return -1; }

/* 같은 초기 회두 상태(우현 10° 타로 선수가 20° 돈 순간)에서 미드십 또는 반대타를 썼을 때의 추가 회두각.
   mode: 'mid' → 0°, 'counter' → 반대 10°. 반환: { A, tSwitch, psiSwitch, extra(°), iPeak } */
export function overshootAfter({ mode, U0 = 16 * KN, ang = 10, trigger = 20, counter = 10, K0 = 1.5, Tp = 1.2 }) {
  let sw = null;
  const A = maneuver({ U0, dur: 600, K0, Tp, cY: 0.12, loss: 0.15, cmd: s => {
    if (s.t < 3) return 0;
    if (sw == null && s.psi >= trigger * DEG) sw = s.t;
    if (sw == null) return ang;
    return mode === 'counter' ? -counter : 0;
  }, stop: s => sw != null && s.t > sw + 5 && s.r <= 0.003 * DEG }); // 선회율이 0.003°/초 아래로 떨어지면 멈춘 것으로 본다
  const iS = Math.round(sw / A.dt); let iPeak = iS;
  for (let i = iS; i < A.n; i++) if (A.psi[i] > A.psi[iPeak]) iPeak = i;
  return { A, tSwitch: sw, psiSwitch: A.psi[iS] / DEG, extra: (A.psi[iPeak] - A.psi[iS]) / DEG, iPeak };
}
