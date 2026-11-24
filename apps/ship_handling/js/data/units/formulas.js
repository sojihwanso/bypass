/* 10-2 공식 모음: 각 단원의 formula 블록을 모아 만든 파일(단원을 고치면 다시 만든다) */
export default {
 "lede": "단원에 나온 식을 한곳에 모았다. 기호의 뜻은 식 아래 설명에 있다.",
 "blocks": [
  {
   "type": "p",
   "html": "각 단원에 나온 식을 단원 차례대로 모았다. 단원 이름을 누르면 그 단원으로 가서 식이 나온 맥락과 장면을 볼 수 있다."
  },
  {
   "type": "h",
   "text": "2-1 6자유도 운동"
  },
  {
   "type": "formula",
   "lines": [
    "T<sub>R</sub> = 2π · k<sub>x</sub> ÷ √(g · GM)"
   ],
   "note": "T<sub>R</sub> 고유 횡요 주기(초), k<sub>x</sub> 롤링 회전 반경, g 중력가속도, GM 횡메타센터 높이. 흔히 T<sub>R</sub> ≈ 0.8B ÷ √GM으로 어림한다."
  },
  {
   "type": "p",
   "html": "<a href=\"#/dof\">2-1 6자유도 운동 단원으로 가기</a>"
  },
  {
   "type": "h",
   "text": "2-2 경사와 복원성"
  },
  {
   "type": "formula",
   "lines": [
    "W = ρ · V = 부력"
   ],
   "note": "W 선박 무게(배수량), ρ 물의 밀도, V 잠긴 체적. 해수에서 청수로 들어가면 밀도가 작아져 흘수가 늘어난다."
  },
  {
   "type": "formula",
   "lines": [
    "복원 모멘트 = W · GZ = W · GM · sin φ"
   ],
   "note": "GZ는 G에서 부력 작용선에 내린 수선의 길이(복원정), φ 경사각. 메타센터 M은 경사 10~15° 안에서 거의 움직이지 않아 이 범위의 복원력을 초기 복원력이라 한다."
  },
  {
   "type": "formula",
   "lines": [
    "BM = I ÷ V",
    "I<sub>T</sub> ∝ L · B³,   I<sub>L</sub> ∝ B · L³"
   ],
   "note": "배는 폭보다 길이가 훨씬 길어서(이 배는 L/B ≈ 7) I<sub>L</sub>이 I<sub>T</sub>보다 수십 배 크다."
  },
  {
   "type": "p",
   "html": "<a href=\"#/stab\">2-2 경사와 복원성 단원으로 가기</a>"
  },
  {
   "type": "h",
   "text": "3-2 타의 양력과 실속"
  },
  {
   "type": "formula",
   "lines": [
    "p + ½ρv² + ρgz = 일정"
   ],
   "note": "p 압력, ρ 물의 밀도, v 유속, z 깊이. 같은 깊이에서 v가 커지면 p가 작아진다."
  },
  {
   "type": "formula",
   "lines": [
    "N = 58.8 · A · V² · sin δ (kgf)"
   ],
   "note": "Beaufoy 실험식. A 타 면적(m²), V 타 주위 유속(m/s). 직압력은 면적과 유속의 제곱에 비례한다. 실제보다 작게 나오는 경향이 있고 타의 모양은 반영하지 못한다."
  },
  {
   "type": "formula",
   "lines": [
    "x = (0.195 + 0.305 · sin δ) · b"
   ],
   "note": "Joessel 실험식. 앞날에서 직압력 중심까지 거리, b 타의 폭. 타각이 커지면 중심이 뒤로 옮겨 가 30°에서 폭의 약 35% 지점에 온다."
  },
  {
   "type": "p",
   "html": "<a href=\"#/rudder\">3-2 타의 양력과 실속 단원으로 가기</a>"
  },
  {
   "type": "h",
   "text": "3-3 타의 영향"
  },
  {
   "type": "formula",
   "lines": [
    "N = 58.8 · A · V² · sinδ",
    "M = N · (L/2) · cosδ = 14.7 · L · A · V² · sin2δ"
   ],
   "note": "A: 타 면적(m²), V: 타에 닿는 유속(m/s), δ: 타각, L: 배 길이(m). 무게중심에서 타까지를 L/2로 본 근사식이다."
  },
  {
   "type": "p",
   "html": "<a href=\"#/rudder-effect\">3-3 타의 영향 단원으로 가기</a>"
  },
  {
   "type": "h",
   "text": "4-1 조종성 지수 T와 K"
  },
  {
   "type": "formula",
   "lines": [
    "T · dr/dt + r = K · δ",
    "r(t) = K·δ · (1 − e<sup>−t/T</sup>)"
   ],
   "note": "T는 선회 관성 모멘트와 저항 모멘트의 비, K는 타력과 저항 모멘트의 비로 볼 수 있다."
  },
  {
   "type": "formula",
   "lines": [
    "T′ = T · V ÷ L,   K′ = K · L ÷ V"
   ],
   "note": "배의 길이 L과 속력 V로 나눠 무차원으로 만든 값. 일반 선박은 T′·K′가 1.0 정도이고, 비대한 선박의 T′는 1.5~2.5 정도다. 배가 크면 T′·K′가 커지는 경향이 있다."
  },
  {
   "type": "p",
   "html": "<a href=\"#/tk\">4-1 조종성 지수 T와 K 단원으로 가기</a>"
  },
  {
   "type": "h",
   "text": "4-2 오버슈트와 직진성"
  },
  {
   "type": "formula",
   "lines": [
    "T · dr/dt + r = 0  →  r(t) = r<sub>0</sub> · e<sup>−t/T</sup>",
    "오버슈트각 φ = r<sub>0</sub> · T  (t → ∞)"
   ],
   "note": "r<sub>0</sub>: 미드십으로 돌린 순간의 선회율. 추종성 지수 T가 작을수록(추종성이 좋을수록) 오버슈트각이 작다."
  },
  {
   "type": "formula",
   "lines": [
    "r(t) = r<sub>0</sub> · e<sup>−t/T</sup> − K·δ<sub>c</sub> · (1 − e<sup>−t/T</sup>)",
    "오버슈트각 φ = T·r<sub>0</sub> − K·δ<sub>c</sub>·T · ln(1 + r<sub>0</sub> ÷ (K·δ<sub>c</sub>))"
   ],
   "note": "두 번째 식은 첫 번째 식을 r = 0이 될 때까지 적분한 결과다. 미드십의 T·r<sub>0</sub>보다 항상 작다."
  },
  {
   "type": "p",
   "html": "<a href=\"#/overshoot\">4-2 오버슈트와 직진성 단원으로 가기</a>"
  },
  {
   "type": "h",
   "text": "4-3 선회권"
  },
  {
   "type": "formula",
   "lines": [
    "K = K′ · V / L,   R = V / (K · δ)  →  R = L / (K′ · δ)"
   ],
   "note": "정상 선회 반지름은 선속 V가 약분되어 사라진다. 그래서 보통 속력 범위에서 선회경은 속력에 거의 영향을 받지 않는다."
  },
  {
   "type": "p",
   "html": "<a href=\"#/turning\">4-3 선회권 단원으로 가기</a>"
  },
  {
   "type": "h",
   "text": "4-4 선회 중 선체 운동"
  },
  {
   "type": "formula",
   "lines": [
    "내방경사: sinθ ≈ N·cosδ·GP / (2·W·GM)",
    "외방경사: sinθ ≈ V²·cosβ·GP / (g·R·GM)"
   ],
   "note": "N: 타의 직압력, GP: 무게중심에서 타의 힘 작용점까지 높이 차, W: 배수량, R: 선회 반지름, β: 편각."
  },
  {
   "type": "p",
   "html": "<a href=\"#/turning-motion\">4-4 선회 중 선체 운동 단원으로 가기</a>"
  },
  {
   "type": "h",
   "text": "5-3 추진력과 슬립"
  },
  {
   "type": "formula",
   "lines": [
    "T = K<sub>T</sub> · ρ · n² · D⁴"
   ],
   "note": "K<sub>T</sub>: 추력 계수(모형 시험으로 구한다), ρ: 물의 밀도, n: 초당 회전수, D: 프로펠러 지름. 같은 프로펠러라도 슬립비가 클수록 K<sub>T</sub>가 커진다. 배가 멈춘 채 돌리는 부스팅 상태(슬립비 1.0)에서 K<sub>T</sub>는 0.4~0.5다."
  },
  {
   "type": "formula",
   "lines": [
    "겉보기 슬립비 s<sub>a</sub> = 1 − V / (P·n)",
    "실제 슬립비 s<sub>r</sub> = 1 − V<sub>p</sub> / (P·n),   V<sub>p</sub> = V − V<sub>w</sub>"
   ],
   "note": "배 주변의 물은 배에 끌려 같은 방향으로 따라온다. 이것이 반류(wake), 그 속도가 V<sub>w</sub>다. 물에 대한 프로펠러의 속도 V<sub>p</sub>는 반류만큼 작아 실제 슬립이 겉보기 슬립보다 크다."
  },
  {
   "type": "p",
   "html": "<a href=\"#/thrust\">5-3 추진력과 슬립 단원으로 가기</a>"
  },
  {
   "type": "h",
   "text": "7-1 바람"
  },
  {
   "type": "formula",
   "lines": [
    "F = ½ · ρ<sub>a</sub> · C<sub>a</sub> · (A·cos²θ + B·sin²θ) · V<sub>a</sub>²",
    "풍압 횡력 Y = F · sinα",
    "선수에서 풍압 중심까지 a ≈ (0.291 + 0.0023·θ) · L"
   ],
   "note": "ρa: 공기 밀도, Ca: 풍압 계수, A·B: 정면·측면 풍압 면적, Va: 상대 풍속, θ: 상대 풍향(°), α: 풍압 합력이 선수미선과 이루는 각. 실제 바람은 고르지 않아 평균 풍속의 1.25배(아주 강할 때 1.5배)를 쓴다(돌풍 요소)."
  },
  {
   "type": "p",
   "html": "<a href=\"#/wind\">7-1 바람 단원으로 가기</a>"
  },
  {
   "type": "h",
   "text": "7-2 수류"
  },
  {
   "type": "formula",
   "lines": [
    "R<sub>w</sub> = ½ · ρ<sub>w</sub> · C<sub>w</sub> · L · d · V<sub>w</sub>²"
   ],
   "note": "Rw: 유체 저항의 옆 성분, ρw: 물의 밀도, Cw: 측면 유압 계수, L: 배 길이, d: 흘수, Vw: 물에 대한 선체의 상대 속도. 정횡 수류이고 수심이 충분하면 VLCC의 Cw는 약 1이고, LNG선·컨테이너선·PCC는 그 약 90%·85%·75%다."
  },
  {
   "type": "p",
   "html": "<a href=\"#/current\">7-2 수류 단원으로 가기</a>"
  },
  {
   "type": "h",
   "text": "7-3 천수 효과"
  },
  {
   "type": "formula",
   "lines": [
    "T = I ÷ b,   K = a ÷ b"
   ],
   "note": "I 선회 관성 모멘트, a 타력 이득계수, b 저항 모멘트 이득계수. 수심이 줄면 셋 다 커지지만 b가 가장 크게 늘어 T와 K가 모두 작아진다."
  },
  {
   "type": "formula",
   "lines": [
    "최대 침하량 ≈ C<sub>b</sub> · V² ÷ 100 (m)",
    "좁은 수로에서는 ≈ C<sub>b</sub> · V² ÷ 50 (m)"
   ],
   "note": "V 선속(kn), C<sub>b</sub> 방형계수. 이 배(C<sub>b</sub> 0.63)는 10노트에서 약 0.6 m."
  },
  {
   "type": "p",
   "html": "<a href=\"#/shallow\">7-3 천수 효과 단원으로 가기</a>"
  },
  {
   "type": "h",
   "text": "7-6 파랑"
  },
  {
   "type": "formula",
   "lines": [
    "파장 λ = 1.56 · T<sub>w</sub>²,   파속 V<sub>w</sub> = 1.25 · √λ",
    "조우 주기 T<sub>E</sub> = λ / (V<sub>w</sub> − V · cosθ)",
    "자유 횡요 주기 T<sub>R</sub> = 0.8 · B / √GM,   동조 횡요: T<sub>E</sub> = T<sub>R</sub>",
    "자유 종요 주기 T<sub>P</sub> ≈ 0.5 · √L,   동조 종요: T<sub>E</sub> = T<sub>P</sub>"
   ],
   "note": "Tw: 파도 주기, V: 선속(m/s), θ: 파도를 만나는 각(파도를 따라갈 때 0°), B: 폭, GM: 메타센터 높이, L: 배 길이."
  },
  {
   "type": "p",
   "html": "<a href=\"#/waves\">7-6 파랑 단원으로 가기</a>"
  },
  {
   "type": "h",
   "text": "8-1 침로 유지"
  },
  {
   "type": "formula",
   "lines": [
    "Y = Y(e) + Y(β) + Y(δ),  M = M(e) + M(β) + M(δ)",
    "β = k · (B<sub>a</sub> ÷ L·d) · (V<sub>a</sub> ÷ V<sub>s</sub>)²"
   ],
   "note": "(e) 바람과 해류, (β) 비스듬한 선체가 받는 물의 저항, (δ) 타가 만드는 옆 힘과 모멘트. 둘 다 0이 되는 자세가 평형이다. β 풍압차, B<sub>a</sub> 수면 위 옆 면적(측면 풍압 면적), L 배 길이, d 흘수, V<sub>a</sub> 상대 풍속, V<sub>s</sub> 선속, k 배마다 다른 상수. 풍압차는 (풍속 ÷ 선속)²에 비례한다."
  },
  {
   "type": "p",
   "html": "<a href=\"#/keep\">8-1 침로 유지 단원으로 가기</a>"
  },
  {
   "type": "h",
   "text": "8-2 변침과 조타 계획"
  },
  {
   "type": "formula",
   "lines": [
    "AC = AB + BC = V · (T + t<sub>0</sub>/2) + R · tan(ψ/2)"
   ],
   "note": "V 선속, T 추종성 지수, t<sub>0</sub> 타가 원하는 각까지 돌아가는 시간, R 선회 반지름(= V ÷ K·δ), ψ 변침각. AB는 반응 지연 동안 직진하는 거리, BC는 선회 반지름이 만드는 거리다."
  },
  {
   "type": "p",
   "html": "<a href=\"#/alter\">8-2 변침과 조타 계획 단원으로 가기</a>"
  },
  {
   "type": "h",
   "text": "8-3 충돌 회피"
  },
  {
   "type": "formula",
   "lines": [
    "D = (3.3·R<sub>v</sub> + 6) · √((L<sub>o</sub>² + L<sub>t</sub>²) ÷ 2)"
   ],
   "note": "D 회피 동작 개시 거리(m), R<sub>v</sub> 상대 속력(m/s), L<sub>o</sub> 본선 길이(m), L<sub>t</sub> 상대선 길이(m). 장면의 예: 12노트끼리 직각으로 횡단(R<sub>v</sub> 약 8.7 m/s), 300 m와 200 m 배면 약 8,900 m(4.8해리)."
  },
  {
   "type": "formula",
   "lines": [
    "허용 최소: FA = (0.015·L<sub>t</sub> + 2.076)·L<sub>o</sub>,  SP = (0.008·L<sub>t</sub> + 0.667)·L<sub>o</sub>",
    "충분히 안전: FA = (0.025·L<sub>t</sub> + 3.125)·L<sub>o</sub>,  SP = (0.012·L<sub>t</sub> + 1.096)·L<sub>o</sub>"
   ],
   "note": "조선자 설문으로 얻은 항내 통과 거리. FA 앞뒤 방향, SP 옆 방향 거리, L<sub>o</sub> 본선 길이, L<sub>t</sub> 상대선 길이."
  },
  {
   "type": "p",
   "html": "<a href=\"#/avoid\">8-3 충돌 회피 단원으로 가기</a>"
  },
  {
   "type": "h",
   "text": "8-4 접이안"
  },
  {
   "type": "formula",
   "lines": [
    "σ = A ÷ D"
   ],
   "note": "D 제동(후진)을 건 지점에서 예정 정지점까지 거리, A 실제로 멈춘 곳과 예정 정지점 사이 남은 거리. σ = 1은 후진을 걸자마자 멈춘 것, σ = 0은 정지점에 딱 멈춘 것이다."
  },
  {
   "type": "p",
   "html": "<a href=\"#/berth\">8-4 접이안 단원으로 가기</a>"
  },
  {
   "type": "h",
   "text": "9-1 계류"
  },
  {
   "type": "formula",
   "lines": [
    "앞뒤 T<sub>FA</sub> = T · cosα · cosβ",
    "옆 T<sub>TR</sub> = T · cosα · sinβ",
    "위아래 T<sub>V</sub> = T · sinα"
   ],
   "note": "T 계선줄 장력, α 줄이 수평면과 이루는 수직각, β 줄의 수평 투영이 선수미선과 이루는 각. 바람과 파도가 배를 밀 때 줄마다 생기는 이 장력을 계류력(mooring force)이라 한다."
  },
  {
   "type": "p",
   "html": "<a href=\"#/mooring\">9-1 계류 단원으로 가기</a>"
  },
  {
   "type": "h",
   "text": "9-3 파주력과 주묘"
  },
  {
   "type": "formula",
   "lines": [
    "파주력 = 앵커 수중 무게 × 앵커 파주 계수 + 체인 m당 수중 무게 × 체인 파주 계수 × 파주부 길이"
   ],
   "note": "파주부는 체인 가운데 해저에 누워 있는 부분이다. 파주 계수는 앵커 모양과 저질(펄, 모래 등)에 따라 다르다."
  },
  {
   "type": "p",
   "html": "<a href=\"#/anchor\">9-3 파주력과 주묘 단원으로 가기</a>"
  }
 ],
 "sources": [
  "각 단원의 출처를 따른다"
 ]
};
