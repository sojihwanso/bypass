import { clamp } from './ship.js';
/* 수심/흘수 비(h/d)에 따른 조종 계수 (모델 값).
   교재 Volume 2 「천수효과」: 수심이 줄면 부가 관성·저항 모멘트가 커져 T와 K가 모두 작아진다
   → 추종성은 좋아지지만 선회성은 나빠진다. h/d = 1.3에서 정상 선회경은 깊은 물의 약 2배, 속력 감소는 보통 10% 이내. */
export function shallowFactors(hd) {
  const a = 1 / Math.pow(Math.max(hd, 1.05), 2);
  return { K: 1 - 0.85 * a, T: 1 - 0.3 * a, speedLoss: clamp(0.17 * a, 0, 0.1) };
}
/* Barrass 근사 최대 침하량(m): 개방 수역 Cb·V²/100, 제한 수로 Cb·V²/50 (V: kn) */
export function squatBarrass(Cb, Vkn, confined = false) { return Cb * Vkn * Vkn / (confined ? 50 : 100); }
