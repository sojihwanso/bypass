import { DEG } from './ship.js';
/* 직압력 계수: 35° 부근에서 최대, 그 뒤 실속으로 감소 (모형 실험 경향을 흉내 낸 모델 값) */
export function cnModel(d) {
  d = Math.abs(d); if (d === 0) return 0;
  return d <= 35 ? 1.15 * Math.sin(1.6 * d * DEG) : Math.max(0.55, 1.15 * Math.sin(1.6 * 35 * DEG) - 0.026 * (d - 35));
}
/* Beaufoy 실험식 N = 58.8·A·V²·sinδ (kgf) → tf로 반환 (교재 V2 2.3) */
export function beaufoyN(A, V, deg) { return 58.8 * A * V * V * Math.sin(deg * DEG) / 1000; }
/* Joessel 식: 앞날에서 직압력 중심까지 x = (0.195 + 0.305 sinδ)·b (교재 V2 2.5) */
export function joesselX(deg, b) { return (0.195 + 0.305 * Math.sin(deg * DEG)) * b; }
/* 모델 직압력 (tf) */
export function normalForce(A, V, deg) { return 0.5 * 1025 * V * V * A * cnModel(deg) / 9810; }
