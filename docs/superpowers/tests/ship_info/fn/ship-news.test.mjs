// node --test docs/superpowers/tests/ship_info/fn/   (Node 22.6+ 타입 제거 실행)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRss, isMaritime, classify, titleKey, pickItems, dedupe, SOURCES } from '../../../../../supabase/functions/ship-news/index.ts';

const PRESS = `<rss><channel><item>
  <title><![CDATA[HMM, 컨테이너선 &amp; 벌크선 <b>운임</b> 상승]]></title>
  <link>http://www.shippingnewsnet.com/news/articleView.html?idxno=1</link>
  <description><![CDATA[<p>해운 운임이 &quot;크게&quot; 올랐다.</p> 이어지는 본문]]></description>
  <author>쉬핑뉴스넷</author>
  <pubDate>2026-11-26 19:53:15</pubDate></item></channel></rss>`;
const GOOGLE = `<rss><channel><item><title>"일본마저 K조선 찾는다"…고부가 선박 기술력 - 이데일리</title>
  <link>https://news.google.com/rss/articles/ABC?oc=5</link>
  <pubDate>Wed, 26 Nov 2026 16:30:00 GMT</pubDate>
  <description>&lt;a href="https://news.google.com/rss/articles/ABC"&gt;"일본마저 K조선 찾는다"…고부가 선박 기술력&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;이데일리&lt;/font&gt;</description>
  <source url="https://www.edaily.co.kr">이데일리</source></item></channel></rss>`;

test('parse-cdata-entities', () => {
  const [a] = parseRss(PRESS, '쉬핑뉴스넷');
  assert.equal(a.t, 'HMM, 컨테이너선 & 벌크선 운임 상승');
  assert.equal(a.u, 'http://www.shippingnewsnet.com/news/articleView.html?idxno=1');
  assert.equal(a.s, '쉬핑뉴스넷');
  assert.equal(a.d, '2026-11-26');
  assert.ok(a.p.startsWith('해운 운임이 "크게" 올랐다.'), a.p);
});
test('parse-google-source', () => {
  const [a] = parseRss(GOOGLE, '구글 뉴스');
  assert.equal(a.s, '이데일리');
  assert.equal(a.t, '"일본마저 K조선 찾는다"…고부가 선박 기술력');
  assert.equal(a.p, '', 'google description is just the title');
});
test('date-kst', () => {
  assert.equal(parseRss(GOOGLE, 'x')[0].d, '2026-11-27');
});
test('summary-trim', () => {
  const long = PRESS.replace('이어지는 본문', '가'.repeat(300));
  assert.ok(parseRss(long, 'x')[0].p.length <= 120);
});
test('maritime-filter', () => {
  assert.ok(isMaritime('부산항 컨테이너 물동량 늘어'));
  assert.ok(isMaritime('조선소 LNG선 수주'));
  assert.ok(!isMaritime('프로야구 개막전 일정 발표'));
  assert.ok(!isMaritime('해운대 해수욕장 개장'), '해운대 is a beach, not shipping');
});
test('classify-rules', () => {
  assert.equal(classify('여수 앞바다 화물선 충돌', ''), '사고');
  assert.equal(classify('해기사 채용 늘린다', ''), '선원과 채용');
  assert.equal(classify('조선소 수주 잔고 3년치', ''), '조선');
  assert.equal(classify('부산항 물동량 사상 최대', ''), '항만');
  assert.equal(classify('컨테이너 운임지수 SCFI 하락', ''), '운임과 원자재');
  assert.equal(classify('팬오션 3분기 영업이익', ''), '실적과 시황');
  assert.equal(classify('해양수산부 탄소 규제 강화', ''), '정책과 제도');
  assert.equal(classify('머스크 새 항로 개설', ''), '해외 해운사');
  assert.equal(classify('HMM 신임 사장 선임', ''), '기업 소식');
});
test('dedupe-title-key', () => {
  assert.equal(titleKey('[단독] HMM, 운임 상승 (종합)'), titleKey('HMM 운임 상승'));
  const items = pickItems(parseRss(PRESS, '쉬핑뉴스넷'), false)
    .concat(pickItems(parseRss(PRESS.replace('idxno=1', 'idxno=2').replace('<b>운임</b>', '운임'), '다른곳'), false));
  assert.equal(dedupe(items).length, 1);
});
test('pick-search-needs-maritime-word', () => {
  const off = GOOGLE.replace('"일본마저 K조선 찾는다"…고부가 선박 기술력', '프로야구 개막전');
  assert.equal(pickItems(parseRss(off, 'x'), true).length, 0);
  assert.equal(pickItems(parseRss(GOOGLE, 'x'), true).length, 1);
  assert.ok(pickItems(parseRss(GOOGLE, 'x'), true)[0].c);
});
test('sources-list', () => {
  assert.ok(SOURCES.filter(s => !s.search).length === 4);
  assert.ok(SOURCES.filter(s => s.search).length >= 12);
  assert.ok(SOURCES.every(s => /^https:\/\//.test(s.url)));
});
test('press-source-name-not-author', () => {
  const x = PRESS.replace('<author>쉬핑뉴스넷</author>', '<author>김종휘 기자</author>');
  assert.equal(parseRss(x, '쉬핑뉴스넷')[0].s, '쉬핑뉴스넷');
});
test('air-cargo-excluded', () => {
  const air = PRESS.replace('HMM, 컨테이너선 &amp; 벌크선 <b>운임</b> 상승', '말레이시아항공 B787 10대 발주');
  const cargo = SOURCES.find(s => s.name === '카고뉴스');
  assert.ok(cargo && cargo.filter, 'cargonews must be filtered');
  assert.equal(pickItems(parseRss(air, '카고뉴스'), true).length, 0);
  const air2 = PRESS.replace('HMM, 컨테이너선 &amp; 벌크선 <b>운임</b> 상승', '항공화물 운임 올들어 최정점');
  assert.equal(pickItems(parseRss(air2, '카고뉴스'), true).length, 0);
});
test('law-word-not-policy', () => {
  assert.notEqual(classify('외항선 면세유 불법 유통 100명 검거', ''), '정책과 제도');
});
test('search-cap-per-query', () => {
  const many = '<rss>' + Array.from({length: 30}, (_, i) => `<item><title>부산항 선박 소식 ${i}번째 기사 제목</title><link>https://news.google.com/rss/articles/A${i}</link><pubDate>Wed, 26 Nov 2026 0${i % 10}:00:00 GMT</pubDate><source url="x">매체${i}</source></item>`).join('') + '</rss>';
  assert.equal(pickItems(parseRss(many, 'x'), true, 10).length, 10);
});
