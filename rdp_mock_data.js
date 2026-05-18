// Mock data para preview do dashboard RDP - estrutura compatível com window.D
(function(){
  const today = '2026-05-15';

  const equipesDef = [
    { nome: 'Engenharia Elétrica - Marcos Pereira', lider: 'Marcos Pereira' },
    { nome: 'Engenharia Hidráulica - Júlia Andrade', lider: 'Júlia Andrade' },
    { nome: 'Automação Industrial - Bruno Saraiva', lider: 'Bruno Saraiva' },
    { nome: 'Segurança Eletrônica - Larissa Mota', lider: 'Larissa Mota' },
    { nome: 'Projetos Especiais - Fernando Costa', lider: 'Fernando Costa' }
  ];

  const nomes = [
    'João Chiarelli','Mariana Lopes','Ricardo Tavares','Camila Souza','Pedro Albuquerque',
    'Beatriz Nascimento','Felipe Moraes','Renata Vasconcelos','André Bittencourt','Luana Cardoso',
    'Thiago Ramalho','Patrícia Furtado','Noélio Barbosa','Caio Marinho','Aline Pacheco',
    'Roberto Diniz','Vanessa Coelho','Diogo Siqueira','Helena Brandão','Marcelo Teixeira',
    'Sofia Vargas','Eduardo Pimentel','Larissa Mota','Bruno Saraiva','Júlia Andrade',
    'Marcos Pereira','Fernando Costa','Letícia Werneck','Otávio Reis','Isabela Drummond'
  ];

  const projetosDef = [
    { codigo:'PRJ22499', nome:'Centro de Distribuição Cajamar', cliente:'Magalu Logística', uf:'SP', categoria:'Logística', business_unit:'BU-Norte', segmento:'Industrial' },
    { codigo:'PRJ22501', nome:'Data Center Tier III', cliente:'Banco Itaú', uf:'SP', categoria:'Data Center', business_unit:'BU-Sul', segmento:'Financeiro' },
    { codigo:'PRJ22503', nome:'Refinaria - Bloco 4', cliente:'Petrobras', uf:'RJ', categoria:'Óleo & Gás', business_unit:'BU-Sudeste', segmento:'Energia' },
    { codigo:'PRJ22507', nome:'Hospital Sírio - Ala B', cliente:'Sírio-Libanês', uf:'SP', categoria:'Saúde', business_unit:'BU-Norte', segmento:'Hospitalar' },
    { codigo:'PRJ22510', nome:'Aeroporto - Terminal 3', cliente:'GRU Airport', uf:'SP', categoria:'Infraestrutura', business_unit:'BU-Norte', segmento:'Aeroportos' },
    { codigo:'PRJ22514', nome:'Subestação 230kV', cliente:'CPFL Energia', uf:'PR', categoria:'Energia', business_unit:'BU-Sul', segmento:'Utilities' },
    { codigo:'PRJ22519', nome:'Centro Logístico Anhanguera', cliente:'Mercado Livre', uf:'SP', categoria:'Logística', business_unit:'BU-Norte', segmento:'Industrial' },
    { codigo:'PRJ22522', nome:'Planta Farmacêutica Cosmópolis', cliente:'EMS Pharma', uf:'SP', categoria:'Farmacêutico', business_unit:'BU-Sudeste', segmento:'Industrial' }
  ];

  const sistemas = ['CFTV','Controle de Acesso','Alarme','Detecção de Incêndio','Automação','Redes'];

  // Gera pessoas
  const pessoas = nomes.map((nome, i) => {
    const eq = equipesDef[i % equipesDef.length];
    const slug = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'.');
    return {
      id: 'p' + (1000+i),
      nome,
      email: slug + '@convergint.com',
      equipe: eq.nome,
      lider: eq.lider,
      disciplina: ['Projetista','Engenheiro','Coordenador','Técnico','Consultor'][i%5],
      ativa: i !== 27 && i !== 19 // 2 inativos
    };
  });

  // Gera RDPs nos últimos 30 dias úteis
  function diasUteisAteHoje(n){
    const out = [];
    const d = new Date(today + 'T00:00:00Z');
    while(out.length < n){
      const dow = d.getUTCDay();
      if(dow >= 1 && dow <= 5) out.push(d.toISOString().slice(0,10));
      d.setUTCDate(d.getUTCDate()-1);
    }
    return out.reverse();
  }
  const diasGerar = diasUteisAteHoje(22);

  const rdps = [];
  let rdpSeq = 0;
  diasGerar.forEach((dia, idx) => {
    // taxa de envio cresce no fim do período + variação
    const taxaBase = 0.62 + (idx/diasGerar.length)*0.30 + (Math.random()*0.10 - 0.05);
    pessoas.filter(p => p.ativa).forEach((p, pi) => {
      // pessoa-específica: alguns são "estrelas", outros faltam mais
      const fator = 0.9 - ((pi*0.013) % 0.45);
      if(Math.random() < taxaBase * fator){
        const proj = projetosDef[(pi + idx) % projetosDef.length];
        const sistema = sistemas[(pi + idx) % sistemas.length];
        // alguns RDPs têm múltiplos projetos
        const multi = Math.random() < 0.15;
        const proj2 = projetosDef[(pi + idx + 3) % projetosDef.length];
        rdps.push({
          id: 'r' + (++rdpSeq),
          data: dia,
          responsavel: p.nome,
          email: p.email,
          equipe: p.equipe,
          arquivo: `RDP_${dia}_${p.nome.split(' ')[0]}.pdf`,
          projeto_codigo: multi ? [proj.codigo, proj2.codigo] : proj.codigo,
          projeto_nome: multi ? [proj.nome, proj2.nome] : proj.nome,
          sistema,
          n_atividades: 2 + Math.floor(Math.random()*6),
          n_pendencias: Math.floor(Math.random()*4),
          participantes: []
        });
      }
    });
  });

  // Gera projetos agregando RDPs
  const projetos = projetosDef.map(pd => {
    const projRdps = rdps.filter(r => {
      const cods = Array.isArray(r.projeto_codigo) ? r.projeto_codigo : [r.projeto_codigo];
      return cods.includes(pd.codigo);
    });
    const ultimo = projRdps.map(r=>r.data).sort().slice(-1)[0] || today;
    // Pendências por sistema
    const pendPS = {};
    const sistemasProj = [...new Set(projRdps.map(r => r.sistema))].slice(0,3);
    sistemasProj.forEach((s, i) => {
      pendPS[s] = [];
      const n = 2 + (i%3);
      for(let k=0;k<n;k++){
        pendPS[s].push({
          desc: [
            'Aguardando definição do cliente sobre layout do rack',
            'Pendência de aprovação do diagrama unifilar',
            'Aguardando entrega de materiais (cabo BLEX)',
            'Revisão do memorial descritivo necessária',
            'Falta confirmação do ponto de acesso da rede',
            'Cliente solicitou alteração no posicionamento da câmera 12'
          ][(i*3 + k) % 6],
          data: projRdps[k % projRdps.length]?.data || ultimo,
          responsavel: projRdps[k % projRdps.length]?.responsavel || pessoas[0].nome
        });
      }
    });
    return {
      ...pd,
      rdps: projRdps,
      ultimo_rdp: ultimo,
      pendencias_por_sistema: pendPS
    };
  });

  // Pendências global
  const pendencias = [];
  projetos.forEach(p => {
    Object.values(p.pendencias_por_sistema).forEach(arr => {
      arr.forEach(it => pendencias.push({ ...it, status: Math.random()<0.7?'aberta':'concluida', projeto: p.codigo }));
    });
  });

  window.D = {
    meta: { today, generatedAt: '2026-05-15T07:42:00' },
    pessoas,
    rdps,
    projetos,
    pendencias
  };

  // Stubs para evitar erros dos scripts originais
  window.SupabaseGestao = { ausenciasCache: {}, carregarAusenciasSupabase: async()=>{}, salvarAusenciaSupabase: async()=>{}, removerAusenciaSupabase: async()=>{}, mudarEquipeSupabase: async()=>{}, criarNovaPessoaSupabase: async()=>{}, removerPessoaSupabase: async()=>{} };
  window.initDashboardData = async function(){ /* mock já pronto */ };
})();
