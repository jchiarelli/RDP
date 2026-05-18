// === RDP Dashboard – render functions (tech redesign) ===
const $ = id => document.getElementById(id);

function escHtml(s){ return String(s||'').replace(/[<>&"]/g, c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c])); }
function fmtDate(iso){
  if(!iso) return '-';
  const s = String(iso).slice(0,10);
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}
function fmtDateShort(iso){
  const s = String(iso||'').slice(0,10);
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : s;
}
function dminus(d, n){ const x = new Date(d); x.setDate(x.getDate()-n); return x.toISOString().slice(0,10); }
function isWeekday(iso){ const d = new Date(iso+'T12:00:00Z').getUTCDay(); return d>=1 && d<=5; }
function rangeDates(de, ate){
  const out = [];
  const d = new Date(de+'T12:00:00Z'); const fim = new Date(ate+'T12:00:00Z');
  while(d<=fim){ out.push(d.toISOString().slice(0,10)); d.setUTCDate(d.getUTCDate()+1); }
  return out;
}
function rangeWeekdays(de, ate){ return rangeDates(de,ate).filter(isWeekday); }

function pessoaNoRDP(pessoa, r){
  if(!pessoa || !r) return false;
  if(pessoa.email && r.email===pessoa.email) return true;
  if(pessoa.nome && (r.responsavel||'').toLowerCase()===pessoa.nome.toLowerCase()) return true;
  const parts = Array.isArray(r.participantes) ? r.participantes : [];
  for(const p of parts){
    if(p.email && pessoa.email && p.email===pessoa.email) return true;
    if(p.nome && pessoa.nome && (p.nome||'').toLowerCase()===pessoa.nome.toLowerCase()) return true;
  }
  return false;
}
function pessoaEmLicenca(pessoa, dataRef){
  if(!pessoa) return false;
  if(pessoa.ativa === false) return true;
  const cache = window.SupabaseGestao?.ausenciasCache || {};
  const arr = cache[pessoa.id] || [];
  for(const a of arr){
    if(dataRef >= a.data_inicio && dataRef <= a.data_fim) return true;
  }
  return false;
}
function statusPessoa(pessoa, dataRef){
  if(!pessoa || !window.D) return null;
  if(pessoaEmLicenca(pessoa, dataRef)) return null;
  const env = (window.D.rdps||[]).filter(r => (r.data||'').slice(0,10)===dataRef && pessoaNoRDP(pessoa, r));
  return env[0] || null;
}
function statusPessoaTodos(pessoa, dataRef){
  if(!pessoa || !window.D) return [];
  if(pessoaEmLicenca(pessoa, dataRef)) return [];
  return (window.D.rdps||[]).filter(r => (r.data||'').slice(0,10)===dataRef && pessoaNoRDP(pessoa, r));
}
function ultimoEnvio(pessoa){
  if(!pessoa || !window.D) return null;
  return (window.D.rdps||[]).filter(r => pessoaNoRDP(pessoa, r))
    .sort((a,b)=>(b.data||'').localeCompare(a.data||''))[0] || null;
}
function getDataInicioContabilizacao(){ return localStorage.getItem('rdp_data_inicio') || '2026-01-01'; }
function toggleTheme(){
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  const nxt = cur==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme', nxt);
  try{ localStorage.setItem('rdp-theme', nxt); }catch(e){}
  // Re-render para charts pegarem nova cor de tema
  const active = document.querySelector('.nav-item.active');
  if(active && active.dataset.tab){
    const fn = 'render'+active.dataset.tab.charAt(0).toUpperCase()+active.dataset.tab.slice(1);
    if(typeof window[fn]==='function') window[fn]();
  }
}
function exportarTudo(){
  if(!window.D){ alert('Sem dados.'); return; }
  const b = new Blob([JSON.stringify(window.D,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = 'rdp_export.json';
  document.body.appendChild(a); a.click(); a.remove();
}
function abrirRDP(data, arquivo){
  if(!data || !arquivo) return;
  const arquivos = Array.isArray(arquivo) ? arquivo : [arquivo];
  alert('📂 Arquivo RDP\n\nData: '+fmtDate(data)+'\nArquivo(s):\n'+arquivos.join('\n'));
}

/* ============= SPARKLINE SVG ============= */
function sparkline(values, opts){
  const w = (opts&&opts.w) || 90;
  const h = (opts&&opts.h) || 24;
  const color = (opts&&opts.color) || 'var(--c-primary)';
  const fill = (opts&&opts.fill) || 'var(--c-primary-soft)';
  if(!values || values.length===0) return '';
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = (max-min) || 1;
  const dx = w / Math.max(values.length-1, 1);
  const pts = values.map((v,i)=>{
    const x = i*dx;
    const y = h - ((v - min)/range)*(h-2) - 1;
    return [x, y];
  });
  const linePath = pts.map((p,i)=> (i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  const areaPath = linePath + ` L${w},${h} L0,${h} Z`;
  const last = pts[pts.length-1];
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <path d="${areaPath}" fill="${fill}" />
    <path d="${linePath}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="${last[0]}" cy="${last[1]}" r="2" fill="${color}"/>
  </svg>`;
}

/* ============= NAV ============= */
function bindNav(){
  document.querySelectorAll('.nav-item[data-tab]').forEach(n => {
    n.onclick = () => {
      document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
      n.classList.add('active');
      document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
      const id = n.dataset.tab;
      $('section-'+id).classList.add('active');
      const titles = {
        overview:['Visão Geral','Métricas-chave, conformidade e alertas em tempo real'],
        status:['Status Diário','Quem enviou o RDP hoje · pendentes em destaque'],
        equipe:['Por Equipe','Compliance, ranking individual e tendência por equipe'],
        projetos:['Projetos','RDPs do dia, pendências por sistema e ações vinculadas'],
        gestao:['Gestão de Pessoas','Cadastro, ausências e mudança de equipe'],
        metas:['Metas','Configurar metas e período de contabilização']
      };
      if(titles[id]){ $('pageTitle').textContent=titles[id][0]; $('pageSub').textContent=titles[id][1]; }
      try{
        if(id==='overview') renderOverview();
        else if(id==='status') renderStatus();
        else if(id==='equipe') renderEquipe();
        else if(id==='projetos') renderProjetos();
        else if(id==='gestao') renderGestao();
        else if(id==='metas') renderMetas();
      }catch(e){ console.error(e); }
    };
  });
}

/* ============= OVERVIEW ============= */
function renderOverview(){
  const sec = $('section-overview');
  if(!window.D){ sec.innerHTML = '<div class="empty">Sem dados.</div>'; return; }
  const today = window.D.meta?.today || new Date().toISOString().slice(0,10);

  const datasSet = new Set((window.D.rdps||[]).map(r => (r.data||'').slice(0,10)));
  const datasOrd = Array.from(datasSet).filter(d => d <= today).sort();
  const lastDate = datasOrd[datasOrd.length-1] || today;
  const defaultDe = sec.dataset.de || dminus(lastDate, 6);
  const defaultAte = sec.dataset.ate || lastDate;
  const equipeFiltroStr = (sec.dataset.equipeFiltro || '').trim() || 'Todas';
  const equipeFiltro = equipeFiltroStr === 'Todas' ? ['Todas'] : equipeFiltroStr.split('|').filter(Boolean);
  const equipes = Array.from(new Set((window.D.pessoas||[]).map(p=>p.equipe).filter(Boolean))).sort();

  const diasUteis = rangeWeekdays(defaultDe, defaultAte);
  const pessoasFil = (window.D.pessoas||[]).filter(p => p.ativa!==false && (equipeFiltro.includes('Todas') || equipeFiltro.includes(p.equipe)));
  const rdpsRange = (window.D.rdps||[]).filter(r => {
    const d = (r.data||'').slice(0,10);
    return d >= defaultDe && d <= defaultAte;
  });

  // pessoa-dia
  let totalEnvios = 0;
  const pessoaDias = new Map();
  pessoasFil.forEach(p => {
    const dias = new Set();
    diasUteis.forEach(d => {
      if(rdpsRange.some(r => (r.data||'').slice(0,10)===d && pessoaNoRDP(p,r))) dias.add(d);
    });
    pessoaDias.set(p.id || p.email, dias);
    totalEnvios += dias.size;
  });
  const totalEsperado = pessoasFil.length * diasUteis.length;
  const totalPendentes = totalEsperado - totalEnvios;
  const conformidade = totalEsperado ? (totalEnvios/totalEsperado*100) : 0;
  const metaGeral = parseInt(localStorage.getItem('rdp_meta_geral_diaria') || '95', 10);

  // KPIs novos
  // 1) Conformidade de hoje
  const enviadosHoje = pessoasFil.filter(p => statusPessoa(p, today)).length;
  const conformHoje = pessoasFil.length ? (enviadosHoje / pessoasFil.length * 100) : 0;

  // 2) Streak (dias consecutivos com 100%) — olhando para trás a partir do último dia
  let streak = 0;
  for(let i=diasUteis.length-1;i>=0;i--){
    const d = diasUteis[i];
    const env = pessoasFil.filter(p => !pessoaEmLicenca(p,d) && statusPessoaTodos(p,d).length>0).length;
    const ativos = pessoasFil.filter(p => !pessoaEmLicenca(p,d)).length;
    if(ativos>0 && env===ativos) streak++; else break;
  }

  // 3) Em risco: pessoas sem RDP há 3+ dias úteis
  const ultimosUteis = rangeWeekdays(dminus(today, 14), today);
  const emRisco = pessoasFil.filter(p => {
    if(pessoaEmLicenca(p, today)) return false;
    // conta dias sem envio recentes contíguos
    let semEnvio = 0;
    for(let i=ultimosUteis.length-1;i>=0;i--){
      const d = ultimosUteis[i];
      if(pessoaEmLicenca(p,d)) continue;
      if(statusPessoaTodos(p,d).length===0) semEnvio++;
      else break;
    }
    return semEnvio >= 3;
  });

  // 4) Projetos ativos
  const projetosAtivos = new Set();
  rdpsRange.forEach(r => {
    const codes = Array.isArray(r.projeto_codigo) ? r.projeto_codigo : [r.projeto_codigo];
    codes.forEach(c => c && projetosAtivos.add(c));
  });

  // 5) Pendências abertas
  const pendAbertas = (window.D.pendencias||[]).filter(p => (p.status||'').toLowerCase()==='aberta').length;

  // 6) Velocidade média (RDPs/dia)
  const velocidade = diasUteis.length ? (rdpsRange.length / diasUteis.length) : 0;

  // sparklines por KPI
  const dailyVals = diasUteis.map(d => pessoasFil.filter(p => statusPessoaTodos(p,d).length>0).length);
  const dailyPerc = diasUteis.map((d,i) => {
    const ativos = pessoasFil.filter(p => !pessoaEmLicenca(p,d)).length;
    return ativos ? (dailyVals[i]/ativos*100) : 0;
  });

  // Top 3 performers no período
  const ranking = pessoasFil.map(p => {
    let env = 0;
    diasUteis.forEach(d => { if(statusPessoaTodos(p,d).length>0) env++; });
    const ult = ultimoEnvio(p);
    return { pessoa:p, env, esperado:diasUteis.length, taxa: diasUteis.length?env/diasUteis.length*100:0, ultimo: ult ? ult.data : '' };
  }).sort((a,b)=> b.env - a.env || a.pessoa.nome.localeCompare(b.pessoa.nome));
  const top3 = ranking.slice(0,5);

  // Pendentes período inteiro
  const pendentes = pessoasFil.filter(p => {
    const dias = pessoaDias.get(p.id || p.email) || new Set();
    if(dias.size>0) return false;
    const todosEmLicenca = diasUteis.every(d => pessoaEmLicenca(p,d));
    return !todosEmLicenca;
  });

  // Top projetos
  const projCount = {};
  rdpsRange.forEach(r => {
    const codes = Array.isArray(r.projeto_codigo) ? r.projeto_codigo : [r.projeto_codigo];
    codes.forEach(c => { if(c) projCount[c] = (projCount[c]||0)+1; });
  });
  const topProj = Object.entries(projCount).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([cod,n])=>{
    const p = (window.D.projetos||[]).find(x=>x.codigo===cod);
    return { codigo:cod, nome:p?.nome||'-', cliente:p?.cliente||'', n };
  });

  sec.innerHTML = `
    <div class="filters">
      <div class="field"><label>De</label><input type="date" class="input" id="ovDe" value="${defaultDe}"></div>
      <div class="field"><label>Até</label><input type="date" class="input" id="ovAte" value="${defaultAte}"></div>
      <div class="field" style="min-width:230px">
        <label>Equipe</label>
        <div class="eq-dropdown">
          <button class="eq-dropdown-btn" id="ovEqBtn" type="button"><span id="ovEqLabel">Todas as equipes</span><span class="eq-dropdown-btn-icon">▼</span></button>
          <div class="eq-dropdown-menu" id="ovEqMenu">
            <div class="eq-dropdown-item"><input type="checkbox" id="ovEqTodas" ${equipeFiltro.includes('Todas')?'checked':''}><label for="ovEqTodas">Todas as equipes</label></div>
            ${equipes.map((e,i)=>`<div class="eq-dropdown-item"><input type="checkbox" id="ovEq_${i}" class="ovEqCheckbox" value="${escHtml(e)}" ${equipeFiltro.includes(e)?'checked':''}><label for="ovEq_${i}">${escHtml(e.split(' - ')[0])}</label></div>`).join('')}
          </div>
        </div>
      </div>
      <div class="field"><label>&nbsp;</label><button class="btn btn-primary" id="ovApply">Aplicar</button></div>
      <div class="field"><label>&nbsp;</label><button class="btn" id="ovReset">7d</button></div>
      <div class="field"><label>&nbsp;</label><button class="btn" id="ovReset30">30d</button></div>
    </div>

    <p class="page-sub">
      Período <b style="color:var(--c-text)">${fmtDate(defaultDe)}</b> → <b style="color:var(--c-text)">${fmtDate(defaultAte)}</b>
      · ${diasUteis.length} dia(s) útil(eis)
      · ${equipeFiltro.includes('Todas')?'todas as equipes':equipeFiltro.length+' equipe(s)'}
      · sync ${window.D.meta?.generatedAt?.slice(11,16) || '—'}
    </p>

    <div class="kpi-grid">
      <div class="kpi ${conformidade>=metaGeral?'k-success':conformidade>=metaGeral*0.7?'k-warning':'k-danger'}">
        <div class="kpi-head">
          <span class="kpi-label">Conformidade</span>
          <span class="kpi-chip ${conformidade>=metaGeral?'up':'down'}">meta ${metaGeral}%</span>
        </div>
        <div class="kpi-value mono">${conformidade.toFixed(0)}<span class="unit">%</span></div>
        <div class="kpi-sub">${totalEnvios.toLocaleString('pt-BR')} de ${totalEsperado.toLocaleString('pt-BR')} envios</div>
        <div class="kpi-bar"><span style="width:${Math.min(conformidade,100)}%"></span></div>
        <div class="kpi-spark">${sparkline(dailyPerc, {w:160,h:22,color:conformidade>=metaGeral?'var(--c-success)':'var(--c-warning)', fill:conformidade>=metaGeral?'rgba(16,232,158,.12)':'rgba(245,181,68,.12)'})}</div>
      </div>

      <div class="kpi ${conformHoje>=metaGeral?'k-success':conformHoje>=70?'k-warning':'k-danger'}">
        <div class="kpi-head"><span class="kpi-label">Conformidade Hoje</span><span class="kpi-chip">${fmtDateShort(today)}</span></div>
        <div class="kpi-value mono">${conformHoje.toFixed(0)}<span class="unit">%</span></div>
        <div class="kpi-sub">${enviadosHoje}/${pessoasFil.length} colaboradores enviaram</div>
        <div class="kpi-bar"><span style="width:${conformHoje}%"></span></div>
      </div>

      <div class="kpi k-violet">
        <div class="kpi-head"><span class="kpi-label">Streak 100%</span><span class="kpi-chip">consecutivos</span></div>
        <div class="kpi-value mono">${streak}<span class="unit">dia${streak===1?'':'s'}</span></div>
        <div class="kpi-sub">${streak>=5?'🔥 sequência excelente':streak>=2?'mantendo o ritmo':'iniciar nova sequência'}</div>
      </div>

      <div class="kpi ${emRisco.length===0?'k-success':emRisco.length<3?'k-warning':'k-danger'}">
        <div class="kpi-head"><span class="kpi-label">Pessoas em Risco</span><span class="kpi-chip ${emRisco.length>0?'down':'up'}">3+ dias sem RDP</span></div>
        <div class="kpi-value mono">${emRisco.length}</div>
        <div class="kpi-sub">${emRisco.length===0?'nenhum atraso crítico':'atenção imediata necessária'}</div>
      </div>

      <div class="kpi k-violet">
        <div class="kpi-head"><span class="kpi-label">Projetos Ativos</span><span class="kpi-chip">${rdpsRange.length} RDPs</span></div>
        <div class="kpi-value mono">${projetosAtivos.size}</div>
        <div class="kpi-sub">com lançamentos no período</div>
      </div>

      <div class="kpi ${pendAbertas===0?'k-success':pendAbertas>20?'k-danger':'k-warning'}">
        <div class="kpi-head"><span class="kpi-label">Pendências Abertas</span><span class="kpi-chip ${pendAbertas>0?'down':'up'}">global</span></div>
        <div class="kpi-value mono">${pendAbertas}</div>
        <div class="kpi-sub">aguardando ação</div>
      </div>

      <div class="kpi">
        <div class="kpi-head"><span class="kpi-label">Velocidade Média</span><span class="kpi-chip">RDP/dia</span></div>
        <div class="kpi-value mono">${velocidade.toFixed(1)}</div>
        <div class="kpi-sub">${rdpsRange.length} RDPs ÷ ${diasUteis.length} dias</div>
        <div class="kpi-spark">${sparkline(dailyVals, {w:160,h:22})}</div>
      </div>

      <div class="kpi k-violet">
        <div class="kpi-head"><span class="kpi-label">Pendentes Período</span><span class="kpi-chip">0 RDPs</span></div>
        <div class="kpi-value mono">${pendentes.length}</div>
        <div class="kpi-sub">${pessoasFil.length>0?((pendentes.length/pessoasFil.length*100).toFixed(0)+'% da base'):'—'}</div>
      </div>
    </div>

    <div class="row-2">
      <div class="card">
        <div class="card-head">
          <h3>Desempenho por Equipe</h3>
          <div class="card-sub">% envio no período</div>
        </div>
        <div class="card-body"><canvas id="chEquipe" height="220"></canvas></div>
      </div>
      <div class="card">
        <div class="card-head">
          <h3>Entrega Diária</h3>
          <div class="card-sub">RDPs únicos por dia útil</div>
        </div>
        <div class="card-body"><canvas id="chDaily" height="220"></canvas></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h3>Heatmap de Conformidade</h3>
        <div class="card-sub">conformidade diária por equipe · últimos ${Math.min(diasUteis.length,30)} dias úteis</div>
      </div>
      <div class="card-body" id="hmBody"></div>
    </div>

    <div class="row-3">
      <div class="card">
        <div class="card-head">
          <h3>Top Performers</h3>
          <div class="card-sub">no período</div>
        </div>
        <div class="card-body no-pad">
          <table class="tbl">
            <thead><tr><th>#</th><th>Colaborador</th><th>Equipe</th><th>Envios</th><th>Taxa</th></tr></thead>
            <tbody>${top3.map((r,i)=>{
              const cor = r.taxa>=80?'var(--c-success)':r.taxa>=50?'var(--c-warning)':'var(--c-danger)';
              return `<tr>
                <td><span class="rank-num">#${i+1}</span></td>
                <td><b>${escHtml(r.pessoa.nome)}</b></td>
                <td><span class="badge badge-default">${escHtml((r.pessoa.equipe||'').split(' - ')[0])}</span></td>
                <td class="mono">${r.env}/${r.esperado}</td>
                <td><div class="taxa-cell"><div class="taxa-bar"><div class="taxa-bar-fill" style="width:${r.taxa}%;background:${cor}"></div></div><b class="mono" style="color:${cor}">${r.taxa.toFixed(0)}%</b></div></td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-head">
          <h3>Top Projetos</h3>
          <div class="card-sub">por volume de RDPs</div>
        </div>
        <div class="card-body no-pad">
          <table class="tbl">
            <thead><tr><th>Projeto</th><th style="text-align:right">RDPs</th></tr></thead>
            <tbody>${topProj.map(p=>`<tr>
              <td><b class="mono">${escHtml(p.codigo)}</b><br><small style="color:var(--c-text-3)">${escHtml(p.cliente)}</small></td>
              <td style="text-align:right"><b class="mono">${p.n}</b></td>
            </tr>`).join('') || '<tr><td colspan="2" class="empty">—</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    </div>

    ${emRisco.length>0 ? `<div class="alert danger">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" style="flex-shrink:0;margin-top:1px"><path d="M9 2L1 16h16L9 2zM9 7v4M9 13.5v.5"/></svg>
      <div><b>${emRisco.length} pessoa(s) em risco crítico.</b> 3+ dias úteis consecutivos sem RDP: ${emRisco.slice(0,4).map(p=>escHtml(p.nome)).join(', ')}${emRisco.length>4?', +'+(emRisco.length-4):''}.</div>
    </div>` : ''}

    <div class="card">
      <div class="card-head">
        <h3>Pendentes do Período</h3>
        <div class="card-sub">não enviaram nenhum RDP no intervalo · <span class="badge badge-warning no-dot">${pendentes.length}</span></div>
      </div>
      <div class="card-body no-pad">
        <table class="tbl">
          <thead><tr><th>Colaborador</th><th>Equipe</th><th>Email</th><th>Último RDP</th><th>Projeto Ativo</th></tr></thead>
          <tbody>${pendentes.length ? pendentes.map(p=>{
            const ult = ultimoEnvio(p);
            let ultBadge = '<span class="badge badge-danger no-dot">Nunca enviou</span>';
            if(ult){
              const diasAtras = Math.round((new Date(today) - new Date(ult.data))/86400000);
              ultBadge = `<span class="mono">${fmtDate(ult.data)}</span> <span class="badge ${diasAtras>=3?'badge-danger':'badge-warning'} no-dot">${diasAtras}d</span>`;
            }
            const proj = ult?.projeto_codigo;
            const projHtml = proj ? (Array.isArray(proj) ? proj.map(c=>`<span class="badge badge-primary no-dot mono">${escHtml(c)}</span>`).join(' ') : `<span class="badge badge-primary no-dot mono">${escHtml(proj)}</span>`) : '—';
            return `<tr>
              <td><b>${escHtml(p.nome)}</b></td>
              <td><span class="badge badge-default">${escHtml((p.equipe||'').split(' - ')[0])}</span></td>
              <td><small style="color:var(--c-text-3)">${escHtml(p.email)}</small></td>
              <td>${ultBadge}</td>
              <td>${projHtml}</td>
            </tr>`;
          }).join('') : '<tr><td colspan="5" class="empty">✓ Todos enviaram pelo menos 1 RDP no período.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;

  // Heatmap render
  const hmDias = diasUteis.slice(-30);
  const equipesObj = {};
  pessoasFil.forEach(p => {
    if(!p.equipe) return;
    if(!equipesObj[p.equipe]) equipesObj[p.equipe] = [];
    equipesObj[p.equipe].push(p);
  });
  let hmHtml = '<div class="heatmap">';
  hmHtml += '<div class="heatmap-row"><div class="heatmap-label"></div>' + hmDias.map((d,i)=>{
    const dow = new Date(d+'T12:00:00Z').getUTCDay();
    const show = i%5===0 || i===hmDias.length-1;
    return `<div class="hm-cell" style="background:transparent;color:var(--c-text-3);font-family:var(--mono);font-size:9px;display:flex;align-items:flex-end;justify-content:center">${show?fmtDateShort(d):''}</div>`;
  }).join('') + '</div>';
  Object.entries(equipesObj).sort().forEach(([eq, membros]) => {
    hmHtml += `<div class="heatmap-row"><div class="heatmap-label" title="${escHtml(eq)}">${escHtml(eq.split(' - ')[0])}</div>`;
    hmDias.forEach(d => {
      const ativos = membros.filter(p => !pessoaEmLicenca(p,d));
      const enviados = ativos.filter(p => statusPessoaTodos(p,d).length>0).length;
      const pct = ativos.length ? enviados/ativos.length : 0;
      let v = 0;
      if(pct>=1) v = 4; else if(pct>=.75) v = 3; else if(pct>=.5) v = 2; else if(pct>0) v = 1; else v = 0;
      const cls = pct===0 && ativos.length>0 ? 'miss' : '';
      hmHtml += `<div class="hm-cell ${cls}" data-v="${v}" title="${fmtDate(d)}: ${enviados}/${ativos.length} (${(pct*100).toFixed(0)}%)"></div>`;
    });
    hmHtml += '</div>';
  });
  hmHtml += '</div>';
  hmHtml += `<div class="heatmap-legend">
    <span>Menos</span>
    <span class="swatch"><i style="background:var(--c-surface-3)"></i></span>
    <span class="swatch"><i style="background:rgba(34,211,238,.18)"></i></span>
    <span class="swatch"><i style="background:rgba(34,211,238,.38)"></i></span>
    <span class="swatch"><i style="background:rgba(34,211,238,.62)"></i></span>
    <span class="swatch"><i style="background:var(--c-primary);box-shadow:0 0 6px var(--c-primary-glow)"></i></span>
    <span>Mais</span>
    <span style="margin-left:auto" class="swatch"><i class="hm-cell miss" style="width:11px;height:11px"></i>0% (gap)</span>
  </div>`;
  $('hmBody').innerHTML = hmHtml;

  // Handlers filtros
  $('ovApply').onclick = () => {
    sec.dataset.de = $('ovDe').value;
    sec.dataset.ate = $('ovAte').value;
    const todos = $('ovEqTodas').checked;
    const sel = Array.from(document.querySelectorAll('.ovEqCheckbox:checked')).map(c=>c.value);
    sec.dataset.equipeFiltro = (todos || sel.length===0) ? 'Todas' : sel.join('|');
    renderOverview();
  };
  $('ovReset').onclick = () => { sec.dataset.de = dminus(lastDate,6); sec.dataset.ate = lastDate; renderOverview(); };
  $('ovReset30').onclick = () => { sec.dataset.de = dminus(lastDate,29); sec.dataset.ate = lastDate; renderOverview(); };

  // dropdown equipe
  const updateLabel = () => {
    const todos = $('ovEqTodas').checked;
    const n = Array.from(document.querySelectorAll('.ovEqCheckbox:checked')).length;
    $('ovEqLabel').textContent = todos ? 'Todas as equipes' : (n===0 ? 'Nenhuma' : (n===1?'1 equipe':n+' equipes'));
  };
  const ovBtn = $('ovEqBtn'), ovMenu = $('ovEqMenu');
  ovBtn.onclick = e => { e.stopPropagation(); ovMenu.classList.toggle('show'); ovBtn.classList.toggle('open'); };
  document.addEventListener('click', () => { ovMenu.classList.remove('show'); ovBtn.classList.remove('open'); });
  ovMenu.addEventListener('click', e=>e.stopPropagation());
  $('ovEqTodas').onchange = () => { if($('ovEqTodas').checked) document.querySelectorAll('.ovEqCheckbox').forEach(c=>c.checked=false); updateLabel(); };
  document.querySelectorAll('.ovEqCheckbox').forEach(c=> c.onchange = () => {
    if(c.checked) $('ovEqTodas').checked = false;
    if(!Array.from(document.querySelectorAll('.ovEqCheckbox')).some(x=>x.checked)) $('ovEqTodas').checked = true;
    updateLabel();
  });
  updateLabel();

  // CHARTS
  const isDark = document.documentElement.getAttribute('data-theme')!=='light';
  const gridColor = isDark ? 'rgba(155,164,184,.08)' : 'rgba(74,84,104,.08)';
  const tickColor = isDark ? '#9AA4B8' : '#4A5468';

  setTimeout(()=>{
    const eqGroups = {};
    pessoasFil.forEach(p => {
      const e = p.equipe || '-';
      if(!eqGroups[e]) eqGroups[e] = {esp:0, env:0};
      eqGroups[e].esp += diasUteis.length;
      eqGroups[e].env += (pessoaDias.get(p.id||p.email) || new Set()).size;
    });
    const eqLabels = Object.keys(eqGroups);
    const eqData = eqLabels.map(l => eqGroups[l].esp ? eqGroups[l].env/eqGroups[l].esp*100 : 0);
    const ctx1 = $('chEquipe');
    if(ctx1) new Chart(ctx1, {
      type:'bar',
      data:{
        labels: eqLabels.map(l=>l.split(' - ')[0]),
        datasets:[{
          label:'% enviado',
          data:eqData,
          backgroundColor: eqData.map(v => v>=metaGeral?'rgba(16,232,158,.7)':v>=70?'rgba(245,181,68,.7)':'rgba(255,92,122,.7)'),
          borderColor: eqData.map(v => v>=metaGeral?'#10E89E':v>=70?'#F5B544':'#FF5C7A'),
          borderWidth:1.5,
          borderRadius:4,
          maxBarThickness:48
        }]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}, tooltip:{callbacks:{label:c=>c.parsed.y.toFixed(1)+'%'}}},
        scales:{
          y:{beginAtZero:true, max:100, ticks:{callback:v=>v+'%', color:tickColor, font:{family:'JetBrains Mono', size:10}}, grid:{color:gridColor}},
          x:{ticks:{color:tickColor, font:{size:10}}, grid:{display:false}}
        }
      }
    });

    const ctx2 = $('chDaily');
    if(ctx2) new Chart(ctx2, {
      type:'line',
      data:{
        labels: diasUteis.map(fmtDateShort),
        datasets:[{
          label:'envios',
          data: dailyVals,
          borderColor:'#22D3EE',
          backgroundColor:'rgba(34,211,238,.18)',
          borderWidth:2,
          tension:.35,
          fill:true,
          pointRadius:3,
          pointBackgroundColor:'#22D3EE'
        }]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{
          y:{beginAtZero:true, ticks:{color:tickColor, font:{family:'JetBrains Mono', size:10}}, grid:{color:gridColor}},
          x:{ticks:{color:tickColor, font:{size:10}, maxRotation:0}, grid:{display:false}}
        }
      }
    });
  }, 30);
}

/* ============= STATUS DIÁRIO ============= */
function renderStatus(){
  const sec = $('section-status');
  if(!window.D){ sec.innerHTML = '<div class="empty">Sem dados.</div>'; return; }
  const today = window.D.meta?.today || new Date().toISOString().slice(0,10);
  const datasOrd = Array.from(new Set((window.D.rdps||[]).map(r=>(r.data||'').slice(0,10)))).filter(d=>d<=today).sort().reverse();
  const dataAtual = sec.dataset.data || (datasOrd[0] || today);
  const equipeF = sec.dataset.equipe || 'Todas';
  const statusF = sec.dataset.status || 'Todos';
  const buscaF = (sec.dataset.busca || '').toLowerCase();
  const equipes = Array.from(new Set((window.D.pessoas||[]).map(p=>p.equipe).filter(Boolean))).sort();

  let pessoas = (window.D.pessoas||[]).filter(p => p.ativa!==false);
  if(equipeF!=='Todas') pessoas = pessoas.filter(p => p.equipe===equipeF);
  if(buscaF) pessoas = pessoas.filter(p => {
    const rdpsP = (window.D.rdps||[]).filter(r => (r.data||'').slice(0,10)===dataAtual && pessoaNoRDP(p,r));
    const matchProj = rdpsP.some(r => {
      const codigo = Array.isArray(r.projeto_codigo)?r.projeto_codigo.join(' '):r.projeto_codigo||'';
      const nome = Array.isArray(r.projeto_nome)?r.projeto_nome.join(' '):r.projeto_nome||'';
      return (codigo+' '+nome).toLowerCase().includes(buscaF);
    });
    return (p.nome||'').toLowerCase().includes(buscaF) || (p.email||'').toLowerCase().includes(buscaF) || matchProj;
  });
  const enriquecido = pessoas.map(p => ({ pessoa:p, enviou: statusPessoaTodos(p, dataAtual), emLicenca: pessoaEmLicenca(p, dataAtual) }));
  let listFil = enriquecido;
  if(statusF==='Enviou') listFil = enriquecido.filter(x=>x.enviou.length>0);
  if(statusF==='Pendente') listFil = enriquecido.filter(x=>x.enviou.length===0 && !x.emLicenca);

  const enviaramN = enriquecido.filter(x=>x.enviou.length>0).length;
  const pendentesN = enriquecido.filter(x=>x.enviou.length===0 && !x.emLicenca).length;
  const licencaN = enriquecido.filter(x=>x.emLicenca).length;
  const totalAtivos = enriquecido.filter(x=>!x.emLicenca).length;
  const conform = totalAtivos ? (enviaramN/totalAtivos*100) : 0;

  sec.innerHTML = `
    <div class="filters">
      <div class="field"><label>Data</label><select class="select" id="stDate">${datasOrd.map(d=>`<option ${d===dataAtual?'selected':''}>${d}</option>`).join('')}</select></div>
      <div class="field"><label>Equipe</label><select class="select" id="stEquipe"><option>Todas</option>${equipes.map(e=>`<option ${e===equipeF?'selected':''}>${escHtml(e.split(' - ')[0])}</option>`).join('')}</select></div>
      <div class="field"><label>Status</label><select class="select" id="stStatus"><option>Todos</option><option ${statusF==='Enviou'?'selected':''}>Enviou</option><option ${statusF==='Pendente'?'selected':''}>Pendente</option></select></div>
      <div class="field" style="flex:1"><label>Buscar</label><input class="input" id="stBusca" placeholder="Nome, email ou projeto..." value="${escHtml(buscaF)}"></div>
      <div class="field"><label>&nbsp;</label><button class="btn btn-primary" id="stApply">Filtrar</button></div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
      <div class="kpi k-success"><div class="kpi-head"><span class="kpi-label">Enviaram</span></div><div class="kpi-value mono">${enviaramN}</div><div class="kpi-sub">no dia ${fmtDate(dataAtual)}</div></div>
      <div class="kpi k-danger"><div class="kpi-head"><span class="kpi-label">Pendentes</span></div><div class="kpi-value mono">${pendentesN}</div><div class="kpi-sub">sem RDP no dia</div></div>
      <div class="kpi k-violet"><div class="kpi-head"><span class="kpi-label">Em Licença</span></div><div class="kpi-value mono">${licencaN}</div><div class="kpi-sub">férias / afastamento</div></div>
      <div class="kpi"><div class="kpi-head"><span class="kpi-label">Conformidade</span></div><div class="kpi-value mono">${conform.toFixed(0)}<span class="unit">%</span></div><div class="kpi-bar"><span style="width:${conform}%"></span></div></div>
    </div>

    <div class="card">
      <div class="card-head">
        <h3>Colaboradores · ${fmtDate(dataAtual)}</h3>
        <div class="chips-row">
          <span class="badge badge-success">${enviaramN} enviaram</span>
          <span class="badge badge-warning">${pendentesN} pendentes</span>
          <span class="badge badge-violet">${licencaN} em licença</span>
        </div>
      </div>
      <div class="card-body no-pad"><table class="tbl">
        <thead><tr><th>Status</th><th>Colaborador</th><th>Equipe</th><th>Disciplina</th><th>Projeto</th><th>Arquivo</th></tr></thead>
        <tbody>${listFil.length ? listFil.map((x,pi)=>{
          if(x.emLicenca){
            return `<tr>
              <td><span class="badge badge-violet">Licença</span></td>
              <td><b>${escHtml(x.pessoa.nome)}</b><br><small style="color:var(--c-text-3)">${escHtml(x.pessoa.email)}</small></td>
              <td><span class="badge badge-default">${escHtml((x.pessoa.equipe||'').split(' - ')[0])}</span></td>
              <td>${escHtml(x.pessoa.disciplina||'-')}</td>
              <td>—</td><td>—</td>
            </tr>`;
          }
          if(x.enviou.length>0){
            return x.enviou.map((rdp,ri)=>{
              const btnId = `st-${pi}-${ri}`;
              let arquivos = Array.isArray(rdp.arquivo)?rdp.arquivo:[rdp.arquivo];
              const label = arquivos.length>1?`📄 ${arquivos.length} arquivos`:`📄 ${escHtml((arquivos[0]||'').slice(0,32))}`;
              const proj = rdp.projeto_codigo;
              const projHtml = proj ? (Array.isArray(proj) ? proj.map(c=>`<span class="badge badge-primary no-dot mono">${escHtml(c)}</span>`).join(' ') : `<span class="badge badge-primary no-dot mono">${escHtml(proj)}</span>`) : '-';
              return `<tr>
                <td><span class="badge badge-success">Enviou</span></td>
                <td><b>${escHtml(x.pessoa.nome)}</b><br><small style="color:var(--c-text-3)">${escHtml(x.pessoa.email)}</small></td>
                <td><span class="badge badge-default">${escHtml((x.pessoa.equipe||'').split(' - ')[0])}</span></td>
                <td>${escHtml(x.pessoa.disciplina||'-')}</td>
                <td>${projHtml}</td>
                <td><button id="${btnId}" class="btn btn-ghost" style="font-size:11px;padding:4px 8px">${label}</button></td>
              </tr>`;
            }).join('');
          }
          return `<tr>
            <td><span class="badge badge-danger">Pendente</span></td>
            <td><b>${escHtml(x.pessoa.nome)}</b><br><small style="color:var(--c-text-3)">${escHtml(x.pessoa.email)}</small></td>
            <td><span class="badge badge-default">${escHtml((x.pessoa.equipe||'').split(' - ')[0])}</span></td>
            <td>${escHtml(x.pessoa.disciplina||'-')}</td>
            <td>—</td><td>—</td>
          </tr>`;
        }).join('') : '<tr><td colspan="6" class="empty">Sem registros.</td></tr>'}</tbody>
      </table></div>
    </div>
  `;

  listFil.forEach((x,pi)=>{
    x.enviou.forEach((rdp,ri)=>{
      const btn = $(`st-${pi}-${ri}`);
      if(btn) btn.onclick = () => abrirRDP(rdp.data, rdp.arquivo);
    });
  });

  $('stApply').onclick = () => {
    sec.dataset.data = $('stDate').value;
    sec.dataset.equipe = $('stEquipe').value === 'Todas' ? 'Todas' : equipes.find(e=>e.split(' - ')[0]===$('stEquipe').value) || 'Todas';
    sec.dataset.status = $('stStatus').value;
    sec.dataset.busca = $('stBusca').value;
    renderStatus();
  };
}

/* ============= POR EQUIPE ============= */
function renderEquipe(){
  const sec = $('section-equipe');
  if(!window.D){ sec.innerHTML = '<div class="empty">Sem dados.</div>'; return; }
  const today = window.D.meta?.today || new Date().toISOString().slice(0,10);
  const datasOrd = Array.from(new Set((window.D.rdps||[]).map(r=>(r.data||'').slice(0,10)))).filter(d=>d<=today).sort();
  const dataInicio = getDataInicioContabilizacao();
  const de = sec.dataset.de || dataInicio || datasOrd[0] || '';
  const ate = sec.dataset.ate || datasOrd[datasOrd.length-1] || '';
  const eqFiltroStr = (sec.dataset.equipeFiltro || '').trim() || 'Todas';
  const eqFiltro = eqFiltroStr==='Todas' ? ['Todas'] : eqFiltroStr.split('|').filter(Boolean);

  const equipes = {};
  (window.D.pessoas||[]).filter(p=>p.ativa!==false).forEach(p=>{
    if(!p.equipe) return;
    if(!equipes[p.equipe]) equipes[p.equipe] = { membros:[], leader:p.lider||p.equipe.split(' - ').slice(-1)[0] };
    equipes[p.equipe].membros.push(p);
  });

  const periodo = rangeWeekdays(de, ate).filter(d => d>=dataInicio);

  const compl = Object.entries(equipes).filter(([n])=>eqFiltro.includes('Todas')||eqFiltro.includes(n)).map(([n, eq])=>{
    const esperado = eq.membros.length * periodo.length;
    let env = 0;
    eq.membros.forEach(p => periodo.forEach(d => { if(statusPessoa(p,d)) env++; }));
    return { nome:n, leader:eq.leader, membros:eq.membros.length, env, esperado, taxa: esperado?env/esperado*100:0 };
  }).sort((a,b)=>b.taxa-a.taxa);

  const ranking = (window.D.pessoas||[]).filter(p => p.ativa!==false && (eqFiltro.includes('Todas')||eqFiltro.includes(p.equipe))).map(p=>{
    let env = 0;
    periodo.forEach(d => { if(statusPessoa(p,d)) env++; });
    const ult = ultimoEnvio(p);
    return { pessoa:p, env, esperado: periodo.length, ultimo: ult?ult.data:'' };
  }).sort((a,b)=>b.env-a.env || a.pessoa.nome.localeCompare(b.pessoa.nome));

  sec.innerHTML = `
    <div class="filters">
      <div class="field"><label>De</label><input type="date" class="input" id="eqDe" value="${de}"></div>
      <div class="field"><label>Até</label><input type="date" class="input" id="eqAte" value="${ate}"></div>
      <div class="field" style="min-width:230px">
        <label>Equipe</label>
        <div class="eq-dropdown">
          <button class="eq-dropdown-btn" id="eqBtn" type="button"><span id="eqLabel">Todas as equipes</span><span class="eq-dropdown-btn-icon">▼</span></button>
          <div class="eq-dropdown-menu" id="eqMenu">
            <div class="eq-dropdown-item"><input type="checkbox" id="eqTodas" ${eqFiltro.includes('Todas')?'checked':''}><label for="eqTodas">Todas as equipes</label></div>
            ${Object.keys(equipes).sort().map((e,i)=>`<div class="eq-dropdown-item"><input type="checkbox" id="eq_${i}" class="eqCheckbox" value="${escHtml(e)}" ${eqFiltro.includes(e)?'checked':''}><label for="eq_${i}">${escHtml(e.split(' - ')[0])}</label></div>`).join('')}
          </div>
        </div>
      </div>
      <div class="field"><label>&nbsp;</label><button class="btn btn-primary" id="eqApply">Aplicar</button></div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
      ${compl.map(c=>{
        const cor = c.taxa>=80?'var(--c-success)':c.taxa>=50?'var(--c-warning)':'var(--c-danger)';
        const corClass = c.taxa>=80?'k-success':c.taxa>=50?'k-warning':'k-danger';
        return `<div class="equipe-card" style="--c-primary:${cor}">
          <div class="eq-name">${escHtml(c.nome.split(' - ')[0])}</div>
          <div class="lead-name">Líder: ${escHtml(c.leader||'-')}</div>
          <div class="equipe-row"><span>Membros</span><span class="v">${c.membros}</span></div>
          <div class="equipe-row"><span>Conformidade</span><span class="v" style="color:${cor}">${c.taxa.toFixed(0)}%</span></div>
          <div style="font-size:10.5px;color:var(--c-text-3);font-family:var(--mono)">${c.env} de ${c.esperado} esperados</div>
          <div class="compliance-bar"><div class="compliance-bar-fill" style="width:${c.taxa.toFixed(0)}%;background:${cor}"></div></div>
        </div>`;
      }).join('')}
    </div>

    <div class="card">
      <div class="card-head"><h3>Ranking Individual</h3><div class="card-sub">ordenado por envios no período</div></div>
      <div class="card-body no-pad"><table class="tbl">
        <thead><tr><th>#</th><th>Colaborador</th><th>Equipe</th><th>Enviados</th><th>Esperados</th><th>Taxa</th><th>Último</th></tr></thead>
        <tbody>${ranking.map((r,i)=>{
          const taxa = r.esperado?r.env/r.esperado*100:0;
          const cor = taxa>=80?'var(--c-success)':taxa>=50?'var(--c-warning)':'var(--c-danger)';
          return `<tr>
            <td><span class="rank-num">#${i+1}</span></td>
            <td><b>${escHtml(r.pessoa.nome)}</b></td>
            <td><span class="badge badge-default">${escHtml((r.pessoa.equipe||'').split(' - ')[0])}</span></td>
            <td class="mono">${r.env}</td>
            <td class="mono" style="color:var(--c-text-3)">${r.esperado}</td>
            <td><div class="taxa-cell"><div class="taxa-bar"><div class="taxa-bar-fill" style="width:${taxa.toFixed(0)}%;background:${cor}"></div></div><b class="mono" style="color:${cor}">${taxa.toFixed(0)}%</b></div></td>
            <td><small class="mono" style="color:var(--c-text-3)">${r.ultimo?fmtDate(r.ultimo):'-'}</small></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>
    <p class="page-sub">Período respeita a data de início definida em Metas: <b style="color:var(--c-text)">${fmtDate(dataInicio)}</b></p>
  `;

  $('eqApply').onclick = () => {
    sec.dataset.de = $('eqDe').value;
    sec.dataset.ate = $('eqAte').value;
    const todas = $('eqTodas').checked;
    const sel = Array.from(document.querySelectorAll('.eqCheckbox:checked')).map(c=>c.value);
    sec.dataset.equipeFiltro = (todas || sel.length===0) ? 'Todas' : sel.join('|');
    renderEquipe();
  };
  const updateLabel = () => {
    const todos = $('eqTodas').checked;
    const n = Array.from(document.querySelectorAll('.eqCheckbox:checked')).length;
    $('eqLabel').textContent = todos ? 'Todas as equipes' : (n===0?'Nenhuma':(n===1?'1 equipe':n+' equipes'));
  };
  const b = $('eqBtn'), m = $('eqMenu');
  b.onclick = e => { e.stopPropagation(); m.classList.toggle('show'); b.classList.toggle('open'); };
  document.addEventListener('click', () => { m.classList.remove('show'); b.classList.remove('open'); });
  m.addEventListener('click', e=>e.stopPropagation());
  $('eqTodas').onchange = () => { if($('eqTodas').checked) document.querySelectorAll('.eqCheckbox').forEach(c=>c.checked=false); updateLabel(); };
  document.querySelectorAll('.eqCheckbox').forEach(c=> c.onchange = () => {
    if(c.checked) $('eqTodas').checked = false;
    if(!Array.from(document.querySelectorAll('.eqCheckbox')).some(x=>x.checked)) $('eqTodas').checked = true;
    updateLabel();
  });
  updateLabel();
}

/* ============= PROJETOS ============= */
const ACOES_KEY = 'rdp-acoes-v1';
let _acoesCache = {};
function acoesLoad(){
  try { _acoesCache = JSON.parse(localStorage.getItem(ACOES_KEY)||'{}'); } catch(e){ _acoesCache = {}; }
  return _acoesCache;
}
function acoesSave(obj){ _acoesCache = obj||{}; try{ localStorage.setItem(ACOES_KEY, JSON.stringify(_acoesCache)); }catch(e){} }
function pendKey(proj,sist,desc){ return proj+'||'+sist+'||'+String(desc||'').toLowerCase().replace(/\s+/g,' ').trim().slice(0,80); }
function uuid(){ return 'a'+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); }
function acaoAdd(pk,txt,resp,prazo){ const all = acoesLoad(); if(!all[pk]) all[pk]=[]; all[pk].push({id:uuid(),acao:txt,responsavel:resp||'',prazo:prazo||'',status:'Aberta',criadoEm:new Date().toISOString()}); acoesSave(all); }
function acaoUpd(pk,id,patch){ const all = acoesLoad(); const l = all[pk]||[]; const i = l.findIndex(x=>x.id===id); if(i<0) return; Object.assign(l[i],patch); acoesSave(all); }
function acaoDel(pk,id){ if(!confirm('Remover ação?')) return; const all = acoesLoad(); if(!all[pk]) return; all[pk] = all[pk].filter(x=>x.id!==id); if(!all[pk].length) delete all[pk]; acoesSave(all); renderProjetos(); }
const STATUS_NEXT = { 'Aberta':'Em andamento', 'Em andamento':'Concluida', 'Concluida':'Aberta' };
const STATUS_CLS = { 'Aberta':'badge-warning', 'Em andamento':'badge-primary', 'Concluida':'badge-success' };
function acaoToggle(pk,id){ const a = (acoesLoad()[pk]||[]).find(x=>x.id===id); if(!a) return; acaoUpd(pk,id,{status:STATUS_NEXT[a.status]||'Aberta'}); renderProjetos(); }
function acaoAddUI(pk, sfx){
  const t = $('ac-'+sfx+'-t').value.trim(); if(!t){ alert('Descreva a ação'); return; }
  acaoAdd(pk, t, $('ac-'+sfx+'-r').value.trim(), $('ac-'+sfx+'-p').value);
  renderProjetos();
}
function renderPendItem(projCod, sist, it){
  const desc = (it.desc||it.descricao||it.titulo||it.observacao||'').toString().trim();
  const pk = pendKey(projCod, sist, desc);
  const acoes = acoesLoad()[pk] || [];
  const hasAcao = acoes.length>0;
  const allDone = hasAcao && acoes.every(a=>a.status==='Concluida');
  const cls = allDone ? 'concluida' : (hasAcao?'has-acao':'');
  const sfx = pk.slice(-12).replace(/[^a-z0-9]/gi,'');
  return `<div class="proj-pend-item ${cls}" data-pkey="${pk}" onclick="event.stopPropagation()">
    <div class="proj-pend-info">
      <div class="proj-pend-desc">${escHtml(desc||'Pendência sem descrição')}</div>
      <small style="color:var(--c-text-3);white-space:nowrap" class="mono">${fmtDate(it.data)} · ${escHtml(it.responsavel||'-')}</small>
    </div>
    <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
      <span class="proj-pend-toggle" onclick="this.closest('.proj-pend-item').classList.toggle('expanded')">${hasAcao ? '▸ '+acoes.length+' ação(ões)' : '+ adicionar ação'}</span>
    </div>
    <div class="acoes-box">
      ${acoes.map(a=>`<div class="acao-item">
        <span style="flex:1">${escHtml(a.acao)} ${a.responsavel?'· <b>'+escHtml(a.responsavel)+'</b>':''} ${a.prazo?'· prazo '+fmtDate(a.prazo):''}</span>
        <button class="acao-status-btn ${STATUS_CLS[a.status]||'badge-warning'}" onclick="acaoToggle('${pk}','${a.id}')">${a.status}</button>
        <button class="acao-status-btn badge-default" onclick="acaoDel('${pk}','${a.id}')">×</button>
      </div>`).join('')}
      <div class="acao-add">
        <input type="text" placeholder="Nova ação..." id="ac-${sfx}-t">
        <input type="text" placeholder="Responsável" id="ac-${sfx}-r" style="flex:0 0 120px">
        <input type="date" id="ac-${sfx}-p">
        <button onclick="acaoAddUI('${pk}','${sfx}')">Adicionar</button>
      </div>
    </div>
  </div>`;
}

function renderProjetos(){
  const sec = $('section-projetos');
  if(!window.D){ sec.innerHTML = '<div class="empty">Sem dados.</div>'; return; }
  const projs = window.D.projetos || [];
  const buscaF = (sec.dataset.busca || '').toLowerCase();
  const catF = sec.dataset.cat || 'Todas';
  const buF = sec.dataset.bu || 'Todas';
  const cats = Array.from(new Set(projs.map(p=>p.categoria).filter(Boolean))).sort();
  const bus = Array.from(new Set(projs.map(p=>p.business_unit).filter(Boolean))).sort();

  let fil = projs;
  if(buscaF) fil = fil.filter(p => ((p.codigo||'')+(p.nome||'')+(p.cliente||'')).toLowerCase().includes(buscaF));
  if(catF!=='Todas') fil = fil.filter(p=>p.categoria===catF);
  if(buF!=='Todas') fil = fil.filter(p=>p.business_unit===buF);

  const allAcoes = acoesLoad();
  let totA=0, abrA=0;
  for(const k in allAcoes){ allAcoes[k].forEach(a=>{ totA++; if(a.status!=='Concluida') abrA++; }); }

  sec.innerHTML = `
    <div class="filters">
      <div class="field" style="flex:1"><label>Buscar</label><input class="input" id="pjBusca" placeholder="Código, nome ou cliente..." value="${escHtml(buscaF)}"></div>
      <div class="field"><label>Categoria</label><select class="select" id="pjCat"><option>Todas</option>${cats.map(c=>`<option ${c===catF?'selected':''}>${escHtml(c)}</option>`).join('')}</select></div>
      <div class="field"><label>Business Unit</label><select class="select" id="pjBu"><option>Todas</option>${bus.map(b=>`<option ${b===buF?'selected':''}>${escHtml(b)}</option>`).join('')}</select></div>
      <div class="field"><label>&nbsp;</label><button class="btn btn-primary" id="pjApply">Filtrar</button></div>
    </div>
    <p class="page-sub">${fil.length} projeto(s) · <b style="color:var(--c-text)">${abrA}</b> ações abertas de ${totA} totais</p>
    <div id="pjList"></div>
  `;
  $('pjApply').onclick = () => { sec.dataset.busca=$('pjBusca').value; sec.dataset.cat=$('pjCat').value; sec.dataset.bu=$('pjBu').value; renderProjetos(); };

  $('pjList').innerHTML = fil.length ? fil.map((p,pidx)=>{
    const sistemas = Object.keys(p.pendencias_por_sistema||{}).sort();
    return `<div class="proj-card" onclick="this.classList.toggle('expanded')">
      <div class="proj-head">
        <div>
          <div class="proj-code">${escHtml(p.codigo)} <small>· ${escHtml(p.nome||'-')}</small></div>
          <div class="proj-name">${escHtml(p.cliente||'')}${p.uf?' · '+escHtml(p.uf):''}</div>
          <div class="proj-tags">
            ${p.categoria?`<span class="badge badge-violet">${escHtml(p.categoria)}</span>`:''}
            ${p.business_unit?`<span class="badge badge-primary">${escHtml(p.business_unit)}</span>`:''}
            ${p.segmento?`<span class="badge badge-default">${escHtml(p.segmento)}</span>`:''}
            ${sistemas.map(s=>`<span class="badge badge-warning no-dot">${escHtml(s)}</span>`).join('')}
          </div>
        </div>
        <div class="proj-meta"><b>${(p.rdps||[]).length}</b>RDPs<br><span>Último: ${fmtDate(p.ultimo_rdp)}</span></div>
      </div>
      <div class="proj-pend">
        <h4 style="margin:0 0 10px;font-family:var(--mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--c-text-3)">RDPs no projeto</h4>
        <table class="tbl" style="margin-bottom:14px"><thead><tr><th>Data</th><th>Responsável</th><th>Sistema</th><th>Atividades</th><th>Pendências</th><th></th></tr></thead>
          <tbody>${(p.rdps||[]).map((r,ri)=>{
            const btnId = `pj-${pidx}-${ri}`;
            const lbl = (Array.isArray(r.arquivo)&&r.arquivo.length>1)?`📄×${r.arquivo.length}`:'📄';
            return `<tr><td class="mono">${fmtDate(r.data)}</td><td>${escHtml(r.responsavel)}</td><td><span class="badge badge-default">${escHtml(r.sistema||'-')}</span></td><td class="mono">${r.n_atividades}</td><td class="mono">${r.n_pendencias}</td><td style="text-align:center"><button id="${btnId}" class="btn btn-ghost" style="padding:4px 8px">${lbl}</button></td></tr>`;
          }).join('')}</tbody></table>
        ${sistemas.map(s=>{
          const ps = (p.pendencias_por_sistema[s]||[]).filter(it => (it.desc||it.descricao||'').trim());
          if(!ps.length) return '';
          return `<div class="proj-pend-grupo"><h4>Pendências · ${escHtml(s)} (${ps.length})</h4>${ps.map(it=>renderPendItem(p.codigo,s,it)).join('')}</div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('') : '<div class="empty">Nenhum projeto encontrado.</div>';

  fil.forEach((p,pidx)=>{
    (p.rdps||[]).forEach((r,ri)=>{
      const btn = $(`pj-${pidx}-${ri}`);
      if(btn) btn.onclick = e => { e.stopPropagation(); abrirRDP(r.data, r.arquivo); };
    });
  });
}

/* ============= METAS ============= */
function renderMetas(){
  const sec = $('section-metas');
  if(!window.D){ sec.innerHTML = '<div class="empty">Sem dados.</div>'; return; }
  const dataIni = getDataInicioContabilizacao();
  const metaGeral = parseInt(localStorage.getItem('rdp_meta_geral_diaria')||'95', 10);
  const metas = JSON.parse(localStorage.getItem('rdp_metas')||'{}');
  const pessoasAtivas = (window.D.pessoas||[]).filter(p=>p.ativa!==false);
  const rdpsDesde = (window.D.rdps||[]).filter(r => (r.data||'').slice(0,10) >= dataIni);
  const diasUteis = Array.from(new Set(rdpsDesde.map(r=>(r.data||'').slice(0,10)))).length || 1;
  const esperado = pessoasAtivas.length * diasUteis;
  const enviados = rdpsDesde.length;
  const taxa = esperado ? (enviados/esperado*100) : 0;
  const hoje = window.D.meta?.today || new Date().toISOString().slice(0,10);
  const enviadosHoje = (window.D.rdps||[]).filter(r=>(r.data||'').slice(0,10)===hoje).length;
  const conformHoje = pessoasAtivas.length ? (enviadosHoje/pessoasAtivas.length*100) : 0;
  const pessoas = (window.D.pessoas||[]).sort((a,b)=>a.nome.localeCompare(b.nome));

  sec.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi ${conformHoje>=metaGeral?'k-success':'k-warning'}">
        <div class="kpi-head"><span class="kpi-label">Taxa Hoje</span><span class="kpi-chip">${fmtDate(hoje)}</span></div>
        <div class="kpi-value mono">${conformHoje.toFixed(0)}<span class="unit">%</span></div>
        <div class="kpi-sub">${enviadosHoje}/${pessoasAtivas.length} colaboradores</div>
        <div class="kpi-bar"><span style="width:${conformHoje}%"></span></div>
      </div>
      <div class="kpi k-violet">
        <div class="kpi-head"><span class="kpi-label">Meta Diária Geral</span></div>
        <div class="kpi-value mono">${metaGeral}<span class="unit">%</span></div>
        <div class="kpi-sub">configurada</div>
      </div>
      <div class="kpi">
        <div class="kpi-head"><span class="kpi-label">Taxa Acumulada</span><span class="kpi-chip">desde ${fmtDateShort(dataIni)}</span></div>
        <div class="kpi-value mono">${taxa.toFixed(1)}<span class="unit">%</span></div>
        <div class="kpi-sub">${enviados} / ${esperado}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <h3>Configuração Geral</h3>
        <div class="card-sub">parâmetros do contador de conformidade</div>
      </div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="field">
            <label>Meta Diária Geral (%)</label>
            <input type="number" id="metaInput" value="${metaGeral}" min="0" max="100" class="input">
          </div>
          <div class="field">
            <label>Início da Contabilização</label>
            <input type="date" id="metaDataInicio" value="${dataIni}" class="input">
          </div>
        </div>
        <div style="margin-top:14px;display:flex;gap:8px">
          <button class="btn btn-primary" onclick="salvarMetaGeral()">Salvar Meta</button>
          <button class="btn" onclick="salvarDataInicio()">Atualizar Início</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3>Metas Individuais</h3><div class="card-sub">opcional · meta semanal por colaborador</div></div>
      <div class="card-body no-pad">
        <table class="tbl">
          <thead><tr><th>Colaborador</th><th>Equipe</th><th style="width:140px">Meta Semanal</th><th style="width:100px">Ação</th></tr></thead>
          <tbody>${pessoas.map(p=>{
            const m = metas[p.id]||5;
            return `<tr>
              <td><b>${escHtml(p.nome)}</b></td>
              <td><span class="badge badge-default">${escHtml((p.equipe||'').split(' - ')[0])}</span></td>
              <td><input type="number" id="meta_${p.id}" value="${m}" min="0" max="10" class="input" style="width:80px"></td>
              <td><button class="btn btn-primary" onclick="salvarMetaPessoa('${p.id}')">Salvar</button></td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </div>
  `;
}
window.salvarMetaGeral = function(){
  const v = parseInt($('metaInput').value||'95',10);
  localStorage.setItem('rdp_meta_geral_diaria', String(Math.max(0,Math.min(100,v))));
  alert('Meta geral atualizada.');
  renderMetas();
};
window.salvarDataInicio = function(){
  const d = $('metaDataInicio').value;
  if(!d){ alert('Selecione uma data'); return; }
  localStorage.setItem('rdp_data_inicio', d);
  alert('Data de início atualizada.');
  renderMetas();
};
window.salvarMetaPessoa = function(pid){
  const v = parseInt($('meta_'+pid).value||'5',10);
  const all = JSON.parse(localStorage.getItem('rdp_metas')||'{}');
  all[pid] = v;
  localStorage.setItem('rdp_metas', JSON.stringify(all));
  alert('Meta salva.');
};

/* ============= GESTÃO ============= */
function getPessoaStatus(p, dataISO){
  if(!p) return {status:'ativa', tipos:[]};
  if(p.ativa===false) return {status:'inativa', tipos:[]};
  const cache = window.SupabaseGestao?.ausenciasCache || {};
  const arr = cache[p.id] || [];
  const ativas = arr.filter(a => dataISO >= a.data_inicio && dataISO <= a.data_fim);
  if(ativas.length) return {status:'ausente', tipos: ativas.map(a=>a.tipo)};
  return {status:'ativa', tipos:[]};
}
function renderGestao(){
  const sec = $('section-gestao');
  if(!window.D){ sec.innerHTML = '<div class="empty">Sem dados.</div>'; return; }
  const statusFilter = $('gestao-filter-status')?.value || 'todos';
  const equipeFilter = $('gestao-filter-equipe')?.value || 'todas';
  const searchFilter = $('gestao-filter-search')?.value?.toLowerCase() || '';

  const equipes = new Set();
  const stats = {total:0, ativos:0, ausentes:0, inativos:0};
  const hoje = new Date().toISOString().split('T')[0];
  (window.D.pessoas||[]).forEach(p=>{
    if(p.equipe && p.equipe!=='-') equipes.add(p.equipe);
    stats.total++;
    const st = getPessoaStatus(p, hoje);
    if(st.status==='ativa') stats.ativos++;
    else if(st.status==='inativa') stats.inativos++;
    else stats.ausentes++;
  });

  let pessoas = (window.D.pessoas||[]).filter(p=>{
    if(searchFilter && !(p.nome||'').toLowerCase().includes(searchFilter)) return false;
    const st = getPessoaStatus(p, hoje);
    if(statusFilter==='todos'){ if(st.status==='inativa') return false; }
    else if(statusFilter==='ativos' && st.status!=='ativa') return false;
    else if(statusFilter==='ferias' && !st.tipos.includes('férias')) return false;
    else if(statusFilter==='inativos' && st.status!=='inativa') return false;
    if(equipeFilter!=='todas' && p.equipe!==equipeFilter) return false;
    return true;
  }).sort((a,b)=>(a.nome||'').localeCompare(b.nome||''));

  sec.innerHTML = `
    <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
      <div class="kpi"><div class="kpi-label">Total</div><div class="kpi-value mono">${stats.total}</div><div class="kpi-sub">colaboradores</div></div>
      <div class="kpi k-success"><div class="kpi-label">Ativos</div><div class="kpi-value mono">${stats.ativos}</div><div class="kpi-sub">${stats.total?(stats.ativos/stats.total*100).toFixed(0):0}% do total</div></div>
      <div class="kpi k-warning"><div class="kpi-label">Em Afastamento</div><div class="kpi-value mono">${stats.ausentes}</div><div class="kpi-sub">férias/médico/licença</div></div>
      <div class="kpi k-danger"><div class="kpi-label">Inativos</div><div class="kpi-value mono">${stats.inativos}</div><div class="kpi-sub">removidos da operação</div></div>
    </div>

    <div class="filters">
      <div class="field"><label>Status</label><select id="gestao-filter-status" class="select"><option value="todos">Todos</option><option value="ativos">Ativos</option><option value="ferias">Em Férias</option><option value="inativos">Inativos</option></select></div>
      <div class="field"><label>Equipe</label><select id="gestao-filter-equipe" class="select"><option value="todas">Todas</option>${Array.from(equipes).sort().map(e=>`<option value="${escHtml(e)}">${escHtml(e.split(' - ')[0])}</option>`).join('')}</select></div>
      <div class="field" style="flex:1;min-width:200px"><label>Buscar</label><input id="gestao-filter-search" type="text" class="input" placeholder="Nome..."></div>
      <div class="field"><label>&nbsp;</label><button class="btn btn-primary" id="gestao-btn-novo">+ Nova Pessoa</button></div>
    </div>

    <div class="card">
      <div class="card-head"><h3>Pessoas da Operação</h3><div class="card-sub">${pessoas.length} resultado(s)</div></div>
      <div class="card-body no-pad">
        ${pessoas.length===0 ? '<div class="empty">Nenhuma pessoa encontrada.</div>' :
          `<table class="tbl"><thead><tr><th>#</th><th>Nome</th><th>Email</th><th>Equipe</th><th>Disciplina</th><th>Status</th><th style="text-align:center">Ações</th></tr></thead>
            <tbody>${pessoas.map((p,i)=>{
              const st = getPessoaStatus(p, hoje);
              const label = st.status==='ativa'?'Ativo':st.status==='inativa'?'Inativo':st.tipos.join(', ');
              const cls = st.status==='ativa'?'badge-success':st.status==='inativa'?'badge-danger':'badge-warning';
              return `<tr>
                <td><span class="rank-num">${i+1}</span></td>
                <td><b>${escHtml(p.nome)}</b></td>
                <td><small style="color:var(--c-text-3)">${escHtml(p.email||'-')}</small></td>
                <td><span class="badge badge-default">${escHtml((p.equipe||'-').split(' - ')[0])}</span></td>
                <td>${escHtml(p.disciplina||'-')}</td>
                <td><span class="badge ${cls}">${escHtml(label)}</span></td>
                <td style="text-align:center">
                  <button class="btn btn-icon btn-ghost" onclick="abrirModal('equipe','${p.id}')" title="Mudar Equipe">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="2"/><path d="M11.5 7c0-.4-.1-.7-.2-1l1-.6-1-1.7-1 .4c-.5-.4-1-.6-1.6-.7L8.5 2h-2L6.3 3.4c-.6.1-1.1.3-1.6.7l-1-.4-1 1.7 1 .6c-.1.3-.2.6-.2 1s.1.7.2 1l-1 .6 1 1.7 1-.4c.5.4 1 .6 1.6.7L6.5 12h2l.2-1.4c.6-.1 1.1-.3 1.6-.7l1 .4 1-1.7-1-.6c.1-.3.2-.6.2-1z"/></svg>
                  </button>
                  <button class="btn btn-icon btn-ghost" onclick="abrirModal('ausencia','${p.id}')" title="Ausência">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="10" height="9" rx="1"/><path d="M2 6h10M5 1.5v3M9 1.5v3"/></svg>
                  </button>
                  <button class="btn btn-icon btn-ghost" onclick="if(confirm('Remover ${escHtml(p.nome)}?')){alert('Removido (demo)')}" title="Remover">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 4h8M5.5 4V2.5h3V4M4 4l.5 8h5L10 4"/></svg>
                  </button>
                </td>
              </tr>`;
            }).join('')}</tbody></table>`
        }
      </div>
    </div>
  `;
  $('gestao-filter-status').value = statusFilter;
  $('gestao-filter-equipe').value = equipeFilter;
  $('gestao-filter-search').value = searchFilter;
  $('gestao-filter-status').onchange = renderGestao;
  $('gestao-filter-equipe').onchange = renderGestao;
  $('gestao-filter-search').oninput = renderGestao;
  $('gestao-btn-novo').onclick = () => abrirModal('novo');
}
function abrirModal(tipo, pid){
  alert('Modal: '+tipo+(pid?' / '+pid:'')+'\n(demo — integração Supabase desativada no preview)');
}

/* ============= BOOT ============= */
function updateClock(){
  const now = new Date();
  const dt = now.toLocaleDateString('pt-BR', {weekday:'short', day:'2-digit', month:'short'}).replace('.','');
  const tm = now.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  if($('tsDate')) $('tsDate').textContent = dt;
  if($('tsTime')) $('tsTime').textContent = tm;
}
document.addEventListener('DOMContentLoaded', async () => {
  bindNav();
  updateClock(); setInterval(updateClock, 1000);
  acoesLoad();
  if(window.initDashboardData) await window.initDashboardData();
  if(!window.D){ $('section-overview').innerHTML = '<div class="alert danger">Sem dados.</div>'; return; }
  $('pageSub').textContent = (window.D.rdps||[]).length+' RDPs · '+(window.D.pessoas||[]).length+' pessoas · '+(window.D.projetos||[]).length+' projetos · '+(window.D.pendencias||[]).length+' pendências';
  renderOverview();
});
