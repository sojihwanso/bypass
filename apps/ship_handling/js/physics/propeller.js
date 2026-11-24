/* 겉보기 슬립 = (P·n − V) ÷ (P·n), n은 RPM. 회전이 없으면 null */
export function apparentSlip(P, rpm, V) {
  const pn = P * Math.abs(rpm) / 60; if (pn < 1e-9) return null;
  return (pn - Math.sign(rpm) * V) / pn;
}
export const PROP = { x: -141, y: 5.0, R: 4.4, P: 8.6 };
