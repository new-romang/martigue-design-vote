(() => {
  'use strict';
  const C = window.DASHBOARD_CONFIG;
  const ids = C.candidateIds;
  const colors = C.candidateColors;
  let refreshTimer = null;

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = (v='') => String(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pct = (a,b) => b ? Math.round(a/b*100) : 0;
  const sum = obj => Object.values(obj).reduce((a,b)=>a+b,0);
  const emptyCounts = () => Object.fromEntries(ids.map(id=>[id,0]));

  function setStatus(text, type='') {
    const el = $('#liveStatus');
    if (!el) return;
    el.className = 'live-status ' + type;
    el.innerHTML = `<span class="live-dot"></span>${esc(text)}`;
  }

  // Google Visualization의 JSONP 응답을 사용해 CORS 없이 읽습니다.
  function querySheet() {
    return new Promise((resolve, reject) => {
      const old = document.getElementById('sheet-jsonp');
      if (old) old.remove();
      const timeout = setTimeout(() => reject(new Error('Google Sheets 응답 시간이 초과되었습니다.')), 15000);
      window.google = window.google || {};
      google.visualization = google.visualization || {};
      google.visualization.Query = google.visualization.Query || {};
      const previous = google.visualization.Query.setResponse;
      google.visualization.Query.setResponse = (response) => {
        clearTimeout(timeout);
        google.visualization.Query.setResponse = previous;
        if (!response || response.status === 'error') {
          const msg = response?.errors?.map(e=>e.detailed_message || e.message).join(' / ') || '시트 데이터를 읽지 못했습니다.';
          reject(new Error(msg));
          return;
        }
        resolve(response.table);
      };
      const s = document.createElement('script');
      s.id = 'sheet-jsonp';
      s.onerror = () => { clearTimeout(timeout); reject(new Error('Google Sheets 연결에 실패했습니다. 공유 설정을 확인하세요.')); };
      const base = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(C.sheetId)}/gviz/tq`;
      s.src = `${base}?gid=${encodeURIComponent(C.gid)}&headers=1&tqx=out:json&_=${Date.now()}`;
      document.head.appendChild(s);
    });
  }

  // RAW 시트 열 위치를 직접 사용합니다.
  // A=타임스탬프, B=디자인 투표, C=성별, D=연령대
  function cellValue(cell) {
    return cell?.f ?? cell?.v ?? '';
  }

  function tableToRawRows(table) {
    return (table.rows || []).map(r => ({
      timestamp: cellValue(r.c?.[0]),
      vote: cellValue(r.c?.[1]),
      gender: cellValue(r.c?.[2]),
      age: cellValue(r.c?.[3])
    })).filter(row => String(row.vote ?? '').trim() !== '');
  }

  function normGender(v) {
    const s = String(v ?? '').trim().toLowerCase();
    if (/여|female|woman|여자/.test(s)) return '여성';
    if (/남|male|man|남자/.test(s)) return '남성';
    return null;
  }

  function normAge(v) {
    const s = String(v ?? '').trim();
    const m = s.match(/(10|20|30|40|50|60|70|80|90)/);
    if (m) return `${m[1]}대`;
    const n = Number(String(v).replace(/[^0-9.]/g,''));
    if (Number.isFinite(n) && n >= 10 && n < 100) return `${Math.floor(n/10)*10}대`;
    return null;
  }

  function extractVotesFromCell(v) {
    const s = String(v ?? '').trim();
    if (!s) return [];
    const chosen = new Set();
    // 값 예: "01, 02" / "05" / "02,06"
    for (const token of s.split(/[,，;、/|\n]+/)) {
      const m = token.trim().match(/(?:^|\D)(0?[1-6])(?:번)?(?:\D|$)/);
      if (m) chosen.add(String(Number(m[1])).padStart(2,'0'));
    }
    // 혹시 구분자가 특이한 경우에도 01~06만 보조 탐색
    if (!chosen.size) {
      for (const id of ids) {
        const n = Number(id);
        const re = new RegExp(`(?:^|[^0-9])0?${n}(?:번)?(?=[^0-9]|$)`);
        if (re.test(s)) chosen.add(id);
      }
    }
    return [...chosen];
  }

  function analyze(rows) {
    const voteCounts = emptyCounts();
    const genderRespondents = {'남성':0,'여성':0};
    const genderVotes = {'남성':emptyCounts(),'여성':emptyCounts()};
    const ageVotes = {};
    const ageRespondents = {};
    const respondents = [];

    for (const row of rows) {
      const votes = extractVotesFromCell(row.vote);
      if (!votes.length) continue;
      const g = normGender(row.gender);
      const a = normAge(row.age);
      respondents.push({row,g,a,votes});

      if (g) genderRespondents[g]++;
      if (a) ageRespondents[a] = (ageRespondents[a] || 0) + 1;
      if (a && !ageVotes[a]) ageVotes[a] = emptyCounts();
      for (const id of votes) {
        voteCounts[id]++;
        if (g) genderVotes[g][id]++;
        if (a) ageVotes[a][id]++;
      }
    }
    return {
      rows, respondents, voteCounts, genderRespondents, genderVotes,
      ageVotes, ageRespondents,
      genderHeader: 'C열 성별', ageHeader: 'D열 연령대', voteHeaders: ['B열 투표응답']
    };
  }

  function ranked(counts) {
    return ids.map(id=>({id, votes:counts[id]||0})).sort((a,b)=>b.votes-a.votes || a.id.localeCompare(b.id));
  }
  function winners(counts) {
    const mx = Math.max(0,...ids.map(id=>counts[id]||0));
    return ids.filter(id => (counts[id]||0) === mx && mx > 0);
  }

  function renderKpis(a) {
    const totalPeople = a.respondents.length;
    const totalVotes = sum(a.voteCounts);
    const r = ranked(a.voteCounts);
    const avg = totalPeople ? (totalVotes/totalPeople).toFixed(1) : '0.0';
    const ageTotals = Object.fromEntries(Object.entries(a.ageVotes).map(([age,c])=>[age,sum(c)]));
    const topAge = Object.entries(ageTotals).sort((x,y)=>y[1]-x[1] || x[0].localeCompare(y[0]))[0] || ['-',0];
    const k = $$('.kpis .kpi');
    if (k[0]) k[0].querySelector('.v').innerHTML = `${totalPeople}<small> 명</small>`;
    if (k[1]) k[1].querySelector('.v').innerHTML = `${totalVotes}<small> 표</small>`;
    if (k[2]) k[2].querySelector('.v').innerHTML = `${avg}<small> 표</small>`;
    if (k[3]) k[3].querySelector('.v').innerHTML = `${r[0]?.id || '-'}<small> · ${r[0]?.votes || 0}표</small>`;
    if (k[4]) {
      const label = k[4].querySelector('.l'); if (label) label.textContent = '최다 득표 연령';
      k[4].querySelector('.v').innerHTML = `${topAge[0].replace('대','')}<small>대 · ${topAge[1]}표</small>`;
    }
  }

  function renderRank(a) {
    const grid = $('.rg'); if (!grid) return;
    const cards = new Map($$('.rc', grid).map(card => [$('.rid',card)?.textContent.trim(), card]));
    const total = sum(a.voteCounts);
    ranked(a.voteCounts).forEach((item,idx) => {
      const card = cards.get(item.id); if (!card) return;
      const badge = $('.bg',card); badge.textContent = String(idx+1); badge.classList.toggle('g', idx===0);
      $('.rv',card).innerHTML = `${item.votes}<small> 표 · ${pct(item.votes,total)}%</small>`;
      grid.appendChild(card);
    });
  }

  function renderBars(a) {
    const max = Math.max(1,...ids.map(id=>a.voteCounts[id]||0));
    const byId = new Map($$('.bars .bc').map(b => [$('.bl',b)?.textContent.trim(), b]));
    ids.forEach(id => {
      const b = byId.get(id); if (!b) return;
      const v = a.voteCounts[id]||0;
      $('.bv',b).textContent = v;
      $('.bar',b).style.height = `${Math.max(v ? 5 : 2, Math.round(v/max*100))}%`;
      $('.bar',b).style.background = colors[id];
      b.classList.toggle('win', winners(a.voteCounts).includes(id));
    });
  }

  function renderGenderDonut(a) {
    const male = a.genderRespondents['남성']||0, female = a.genderRespondents['여성']||0, known=male+female;
    const card = $('.dcard'); if (!card) return;
    const sub = $('.csub',card); if (sub) sub.textContent = `전체 ${a.respondents.length}명`;
    const fPct = pct(female,known), mPct = 100-fPct;
    const circumference = 2*Math.PI*44;
    const circles = $$('svg circle',card);
    if (circles[1]) { circles[1].setAttribute('stroke-dasharray', `${(circumference*mPct/100).toFixed(2)} ${(circumference*(100-mPct)/100).toFixed(2)}`); circles[1].setAttribute('stroke-dashoffset','0'); }
    if (circles[2]) { circles[2].setAttribute('stroke-dasharray', `${(circumference*fPct/100).toFixed(2)} ${(circumference*(100-fPct)/100).toFixed(2)}`); circles[2].setAttribute('stroke-dashoffset', `${-(circumference*mPct/100).toFixed(2)}`); }
    const ctr = $('.dctr',card); if (ctr) ctr.innerHTML = `<div class="b">${fPct}%</div><div class="s">여성</div>`;
    const rows = $$('.lg .r',card);
    if (rows[0]) $('.vv',rows[0]).textContent = `${male}명 · ${pct(male,known)}%`;
    if (rows[1]) $('.vv',rows[1]).textContent = `${female}명 · ${fPct}%`;
  }

  function genderTableHtml(counts, color) {
    const r = ranked(counts), max=Math.max(1,...r.map(x=>x.votes));
    const win = winners(counts);
    return r.map((x,idx)=>`<tr><td class="id">${x.id}</td><td><span class="mb" style="width:${Math.max(5,Math.round(x.votes/max*34))}px;background:${color}"></span>${x.votes}</td><td class="rk">${win.includes(x.id) ? '공동 1위<span class="star">★</span>' : `${idx+1}위`}</td></tr>`).join('');
  }

  function renderGenderRanks(a) {
    const card = $$('.card').find(c => $('h2',c)?.textContent.includes('성별 선호 순위')); if (!card) return;
    const m=sum(a.genderVotes['남성']), f=sum(a.genderVotes['여성']);
    $('.csub',card).textContent = `남 ${m}표 · 여 ${f}표 · ★ 1위`;
    const bodies = $$('tbody',card);
    if (bodies[0]) bodies[0].innerHTML = genderTableHtml(a.genderVotes['남성'], colors['01']);
    if (bodies[1]) bodies[1].innerHTML = genderTableHtml(a.genderVotes['여성'], colors['05']);
  }

  function ageSortKey(age) { const n=parseInt(age,10); return Number.isFinite(n)?n:999; }
  function renderAges(a) {
    const wrap = $('.agewrap'); if (!wrap) return;
    let ages = Object.keys(a.ageVotes).sort((x,y)=>ageSortKey(x)-ageSortKey(y));
    if (!ages.length) ages=['20대','30대','40대','50대','60대'];
    wrap.innerHTML = ages.map(age => {
      const counts = a.ageVotes[age] || emptyCounts();
      const total=sum(counts), win=winners(counts);
      const segs = ids.filter(id=>counts[id]>0).map(id => {
        const w = total ? counts[id]/total*100 : 0;
        const label = w >= 13 ? id : '';
        return `<div class="seg" style="width:${w.toFixed(1)}%;background:${colors[id]}" title="${id}: ${counts[id]}표">${label}</div>`;
      }).join('');
      return `<div class="arow"><div class="al">${esc(age)}<small>${total}표</small></div><div class="track">${segs}</div><div class="win">${win.length ? win.join('·') : '-'}</div></div>`;
    }).join('');
  }

  function renderInsights(a) {
    const list=$('.ins-list'); if (!list) return;
    const r=ranked(a.voteCounts), top=r[0]||{id:'-',votes:0}, second=r[1]||{id:'-',votes:0};
    const gap=top.votes-second.votes;
    const maleWins=winners(a.genderVotes['남성']), femaleWins=winners(a.genderVotes['여성']);
    const topGenderParts=[];
    if (maleWins.includes(top.id)) topGenderParts.push(maleWins.length>1?'남성 공동 1위':'남성 1위');
    if (femaleWins.includes(top.id)) topGenderParts.push(femaleWins.length>1?'여성 공동 1위':'여성 1위');
    const topAgeWins=Object.entries(a.ageVotes).filter(([age,c])=>winners(c).includes(top.id)).map(([age])=>age);
    const male=a.genderRespondents['남성']||0, female=a.genderRespondents['여성']||0, known=male+female;
    const dominantGender = female>=male ? '여성' : '남성';
    const dominantCount = Math.max(female,male), dominantShare=pct(dominantCount,known);
    const ageTotals=Object.fromEntries(Object.entries(a.ageVotes).map(([age,c])=>[age,sum(c)]));
    const topAge=Object.entries(ageTotals).sort((x,y)=>y[1]-x[1])[0];
    const otherAgeWinners = [...new Set(Object.entries(a.ageVotes).filter(([age])=>!topAge || age!==topAge[0]).flatMap(([,c])=>winners(c)).filter(id=>id!==top.id))];
    const line2 = (topGenderParts.length || topAgeWins.length)
      ? `<span class="hl">${top.id}번</span>은 ${[...topGenderParts, topAgeWins.length?`${topAgeWins.join('·')} 1위`:null].filter(Boolean).join(', ')}로 폭넓은 선호를 보입니다.`
      : `<span class="hl">${top.id}번</span>이 전체 득표에서는 가장 앞서 있습니다.`;
    const line3 = known ? `응답자 중 <b>${dominantGender} ${dominantShare}%</b>(${dominantCount}명)로 ${dominantGender} 응답 비중이 더 큽니다.` : '성별 열을 자동 인식하지 못했습니다.';
    const line4 = topAge ? `<b>${topAge[0]}가 ${topAge[1]}표</b>로 가장 큰 연령대입니다.${otherAgeWinners.length?` 다른 연령대에서는 <b>${otherAgeWinners.join('·')}번</b>도 1위를 기록합니다.`:''}` : '연령대 열을 자동 인식하지 못했습니다.';
    list.innerHTML = [
      `<div class="ins"><div class="num b">1</div><div class="tx"><span class="hl">${top.id}번</span>이 <b>${top.votes}표</b>로 1위. 2위 <b>${second.id}번(${second.votes}표)</b>과 <b>${gap}표</b> 차입니다.</div></div>`,
      `<div class="ins"><div class="num">2</div><div class="tx">${line2}</div></div>`,
      `<div class="ins"><div class="num p">3</div><div class="tx">${line3}</div></div>`,
      `<div class="ins"><div class="num">4</div><div class="tx">${line4}</div></div>`
    ].join('');
  }

  function render(a) {
    renderKpis(a); renderRank(a); renderBars(a); renderGenderDonut(a); renderGenderRanks(a); renderAges(a); renderInsights(a);
  }

  async function refresh() {
    setStatus('Google Sheets 불러오는 중…');
    try {
      const table = await querySheet();
      const rows = tableToRawRows(table);
      if (!rows.length) throw new Error('시트에 읽을 수 있는 응답 행이 없습니다.');
      const a = analyze(rows);
      if (!a.respondents.length) throw new Error('투표값이 있는 응답 행을 찾지 못했습니다.');
      render(a);
      const t = new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
      const auto = [a.genderHeader?`성별: ${a.genderHeader}`:'성별 열 미인식', a.ageHeader?`연령: ${a.ageHeader}`:'연령 열 미인식'].join(' · ');
      const voteCols = a.voteHeaders.length ? `투표 열: ${a.voteHeaders.join(' / ')}` : '투표 열 미인식';
      setStatus(`LIVE · ${t} · ${a.respondents.length}명 · ${auto}`, 'ok');
      console.info('[dashboard] vote headers:', a.voteHeaders);
      console.info('[dashboard] raw rows / valid respondents:', a.rows.length, a.respondents.length);
    } catch (err) {
      console.error(err);
      setStatus(`연결 오류 · ${err.message}`, 'err');
    }
  }

  refresh();
  refreshTimer = setInterval(refresh, Math.max(30000, Number(C.refreshMs)||60000));
})();
