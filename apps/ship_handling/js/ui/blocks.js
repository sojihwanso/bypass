/* 단원 본문 블록을 HTML로 바꾼다. 문자열은 작성자가 쓴 HTML(굵게, 아래첨자 등)을 그대로 허용한다. */
export function renderBlocks(blocks) {
  return blocks.map(b => {
    switch (b.type) {
      case 'h': return `<h3 class="b-h" id="${b.id || ''}">${b.text}</h3>`;
      case 'p': return `<p class="b-p">${b.html}</p>`;
      case 'list': return `<${b.ordered ? 'ol' : 'ul'} class="b-list">${b.items.map(i => `<li>${i}</li>`).join('')}</${b.ordered ? 'ol' : 'ul'}>`;
      case 'table': return `<figure class="b-table"><div class="tw" tabindex="0" role="region" aria-label="${(b.caption || '표').replace(/<[^>]+>/g, '')}"><table><thead><tr>${b.head.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map((c, i) => i === 0 ? `<th scope="row">${c}</th>` : `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${b.caption ? `<figcaption>${b.caption}</figcaption>` : ''}</figure>`;
      case 'compare': return `<div class="b-compare" style="--n:${b.cols.length}">${b.cols.map(c => `<section><h4>${c.title}</h4>${c.lede ? `<p>${c.lede}</p>` : ''}<ul>${c.items.map(i => `<li>${i}</li>`).join('')}</ul></section>`).join('')}</div>`;
      case 'formula': return `<div class="b-formula">${b.lines.map(l => `<div>${l}</div>`).join('')}${b.note ? `<small>${b.note}</small>` : ''}</div>`;
      case 'figure': return `<figure class="b-figure">${b.svg}${b.caption ? `<figcaption>${b.caption}</figcaption>` : ''}</figure>`;
      case 'model': return `<figure class="b-model"><iframe data-model="${b.model}" title="${b.title}" loading="lazy"></iframe>${b.caption ? `<figcaption>${b.caption}</figcaption>` : ''}</figure>`;
      case 'note': return `<p class="b-note ${b.kind || ''}">${b.html}</p>`;
      case 'steps': return `<ol class="b-steps">${b.items.map(i => `<li><b>${i[0]}</b><span>${i[1]}</span></li>`).join('')}</ol>`;
      default: return '';
    }
  }).join('');
}
export function renderExam(exams) {
  return exams.map(e => `<section class="exam-card" aria-label="시험에서는">
    <div class="exam-top"><span class="tag exam">${e.source}</span><h3>시험에서는</h3></div>
    <blockquote>${e.question}</blockquote>
    <div class="exam-body"><div><h4>답안에 꼭 들어갈 것</h4><ol>${e.points.map(p => `<li>${p}</li>`).join('')}</ol></div>
    ${e.sketch ? `<figure class="exam-sketch">${e.sketch}<figcaption>${e.sketchCap || '시험지에 따라 그릴 수 있는 그림'}</figcaption></figure>` : ''}</div>
  </section>`).join('');
}
export function renderSources(list) {
  return `<section class="sources"><h3>출처</h3><ul>${list.map(s => `<li>${s}</li>`).join('')}</ul></section>`;
}

/* 인터랙티브 모형(anatomy) iframe: models/<이름>/<이름>.html?embed&theme=…
   테마는 앱 테마를 따라 postMessage(pvTheme)로 바꾸고, 높이는 모형이 postMessage(pvModel, height)로 알린다. */
const modelTheme = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
export function mountModels(root) {
  root.querySelectorAll('iframe[data-model]:not([src])').forEach(f => {
    f.src = 'models/' + f.dataset.model + '/' + f.dataset.model + '.html?embed&theme=' + modelTheme();
  });
}
new MutationObserver(() => document.querySelectorAll('iframe[data-model][src]').forEach(f => {
  try { f.contentWindow.postMessage({ pvTheme: modelTheme() }, '*'); } catch (e) { /* 무시 */ }
})).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
window.addEventListener('message', e => {
  const m = e.data;
  if (!m || !m.pvModel || !(m.height > 0)) return;
  document.querySelectorAll('iframe[data-model="' + m.pvModel + '"]').forEach(f => { if (f.contentWindow === e.source) f.style.height = m.height + 'px'; });
});
