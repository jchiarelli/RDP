/**
 * DASHBOARD DATA LOADER
 * Carrega dados do Supabase e popula variável global D
 */

// Variável global com todos os dados do dashboard
window.D = null;

/**
 * Inicializa os dados do dashboard
 * Chamada no DOMContentLoaded
 */
async function initDashboardData() {
  try {
    console.log('🔄 Iniciando carregamento de dados do Supabase...');

    // Cria instância do gerenciador de dados
    const manager = new SupabaseDataManager();

    // Carrega todos os dados em paralelo
    const [rdps, projetos, pendencias, pessoas] = await Promise.all([
      manager.loadRDPs(),
      manager.loadProjetos(),
      manager.loadPendencias(),
      manager.loadPessoas()
    ]);

    // Enriquece projetos com seus RDPs
    const projetosEnriquecidos = enriquecerProjetos(projetos || [], rdps || [], pendencias || []);

    // Armazena na variável global D
    window.D = {
      rdps: rdps || [],
      projetos: projetosEnriquecidos,
      pendencias: pendencias || [],
      pessoas: pessoas || [],
      manager: manager
    };

    console.log('✅ Dados carregados:', {
      rdps: window.D.rdps.length,
      projetos: window.D.projetos.length,
      pendencias: window.D.pendencias.length,
      pessoas: window.D.pessoas.length
    });

    return window.D;
  } catch (error) {
    console.error('❌ Erro ao carregar dados:', error);
    window.D = {
      rdps: [],
      projetos: [],
      pendencias: [],
      pessoas: [],
      manager: null,
      error: error.message
    };
    return window.D;
  }
}

/**
 * Enriquece projetos com seus RDPs e estatísticas
 */
function enriquecerProjetos(projetos, rdps, pendencias) {
  // Grupo RDPs por código de projeto
  const rdpsPorProjeto = {};
  rdps.forEach(rdp => {
    const codigo = rdp.projeto_codigo || rdp.projeto;
    if (!codigo) return;
    if (!rdpsPorProjeto[codigo]) rdpsPorProjeto[codigo] = [];
    rdpsPorProjeto[codigo].push(rdp);
  });

  // Grupo pendencias por projeto e sistema
  const pendenciasPorProjeto = {};
  pendencias.forEach(pend => {
    const codigo = pend.projeto_codigo || pend.projeto;
    if (!codigo) return;
    if (!pendenciasPorProjeto[codigo]) pendenciasPorProjeto[codigo] = {};
    const sistema = pend.sistema || 'Geral';
    if (!pendenciasPorProjeto[codigo][sistema]) pendenciasPorProjeto[codigo][sistema] = [];
    pendenciasPorProjeto[codigo][sistema].push(pend);
  });

  // Enriquece cada projeto
  return projetos.map(proj => {
    const codigo = proj.codigo;
    const projetoRdps = rdpsPorProjeto[codigo] || [];
    const projetoPendencias = pendenciasPorProjeto[codigo] || {};

    return {
      ...proj,
      rdps: projetoRdps,
      pendencias_por_sistema: projetoPendencias,
      ultimo_rdp: projetoRdps.length > 0
        ? projetoRdps[0].data // Assume RDPs vêm ordenados por data DESC
        : null
    };
  });
}

/**
 * Extrai lista única de pessoas dos RDPs
 */
function extrairPessoas(rdps = []) {
  const pessoasSet = new Set();
  const pessoasMap = new Map();

  rdps.forEach(rdp => {
    // Responsável
    if (rdp.responsavel) {
      pessoasSet.add(rdp.responsavel);
      if (!pessoasMap.has(rdp.responsavel)) {
        pessoasMap.set(rdp.responsavel, { nome: rdp.responsavel });
      }
    }

    // Equipe (pode ser string ou array)
    if (rdp.equipe) {
      const equipeList = typeof rdp.equipe === 'string'
        ? rdp.equipe.split(',').map(e => e.trim())
        : Array.isArray(rdp.equipe) ? rdp.equipe : [];

      equipeList.forEach(pessoa => {
        if (pessoa) {
          pessoasSet.add(pessoa);
          if (!pessoasMap.has(pessoa)) {
            pessoasMap.set(pessoa, { nome: pessoa });
          }
        }
      });
    }
  });

  return Array.from(pessoasMap.values());
}

/**
 * Recarrega dados e atualiza D
 */
async function refreshDashboardData() {
  return initDashboardData();
}

/**
 * Configura atualização automática de dados
 */
function setupAutoRefresh(intervalMinutes = 5) {
  setInterval(() => {
    console.log('🔄 Auto-refresh de dados...');
    refreshDashboardData();
  }, intervalMinutes * 60 * 1000);
}

/**
 * Popula dropdowns de filtro com valores únicos
 */
function populateFilterDropdowns() {
  if (!window.D || !window.D.rdps.length) return;

  // Projetos únicos
  const projetos = [...new Set(window.D.rdps
    .map(r => r.projeto_codigo)
    .filter(Boolean))];

  const projetoSelect = document.querySelector('select[data-filter="projeto"]');
  if (projetoSelect) {
    projetos.forEach(proj => {
      const option = document.createElement('option');
      option.value = proj;
      option.textContent = proj;
      projetoSelect.appendChild(option);
    });
  }

  // Responsáveis únicos
  const responsaveis = [...new Set(window.D.rdps
    .map(r => r.responsavel)
    .filter(Boolean))];

  const respSelect = document.querySelector('select[data-filter="responsavel"]');
  if (respSelect) {
    responsaveis.forEach(resp => {
      const option = document.createElement('option');
      option.value = resp;
      option.textContent = resp;
      respSelect.appendChild(option);
    });
  }
}

// Dispara evento quando dados carregam
window.addEventListener('load', () => {
  if (window.D) {
    window.dispatchEvent(new CustomEvent('dashboardDataLoaded', { detail: window.D }));
  }
});

// Listener para when initDashboardData() completes
document.addEventListener('DOMContentLoaded', async () => {
  // Wait for data to load
  await initDashboardData();
  // Dispatch event para o dashboard saber que dados estão prontos
  window.dispatchEvent(new CustomEvent('supabaseDataReady', { detail: window.D }));
  console.log('✅ Dados prontos no window.D:', window.D);
});
