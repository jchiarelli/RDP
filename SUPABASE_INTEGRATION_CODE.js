/**
 * SUPABASE INTEGRATION - Gestão de Pessoas
 * Substitui localStorage por Supabase para persistência em banco de dados
 *
 * Configuração obrigatória no HTML (antes de carregar este script):
 * <script>
 *   window.SUPABASE_URL = 'https://rycygvzfuleezfjrdeaz.supabase.co';
 *   window.SUPABASE_KEY = 'sb_publishable_eOTgToeBo1pDGtPqCcXnrQ_W-3THsrT'; // anon public key
 * </script>
 */

// ===== SUPABASE CLIENT =====
class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.headers = {
      'apikey': key,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  async request(method, table, options = {}) {
    const path = `${this.url}/rest/v1/${table}`;
    const query = new URLSearchParams(options.query || {}).toString();
    const fullUrl = query ? `${path}?${query}` : path;

    const config = {
      method,
      headers: this.headers,
      ...(options.body && { body: JSON.stringify(options.body) })
    };

    try {
      const response = await fetch(fullUrl, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`Supabase error (${method} ${table}):`, err);
      throw err;
    }
  }

  // CRUD operations
  async read(table, options = {}) {
    return this.request('GET', table, options);
  }

  async create(table, data) {
    return this.request('POST', table, { body: data });
  }

  async update(table, data, id) {
    return this.request('PATCH', `${table}?id=eq.${id}`, { body: data });
  }

  async delete(table, id) {
    return this.request('DELETE', table, { query: { id: `eq.${id}` } });
  }
}

// ===== INICIALIZAR SUPABASE =====
const sb = new SupabaseClient(
  window.SUPABASE_URL || 'https://rycygvzfuleezfjrdeaz.supabase.co',
  window.SUPABASE_KEY || 'sb_publishable_eOTgToeBo1pDGtPqCcXnrQ_W-3THsrT'
);

// ===== CACHE LOCAL (offline-first) =====
let _localCache = {
  pessoas: [],
  ausencias: {},
  mudancas: []
};

let _pendingSync = [];
let _syncTimer = null;

// ===== CARREGAR DADOS DO SUPABASE =====
async function carregarPessoasSupabase() {
  try {
    // Carregar pessoas
    const pessoas = await sb.read('pessoas');
    _localCache.pessoas = pessoas;

    if (!window._dashboard) window._dashboard = {};
    window._dashboard.pessoas = pessoas.map(p => ({
      ...p,
      id: p.id || `pessoa_${Math.random().toString(36).substr(2, 9)}`
    }));

    // Carregar ausências
    const ausencias = await sb.read('pessoas_ausencias');
    _localCache.ausencias = {};
    ausencias.forEach(a => {
      if (!_localCache.ausencias[a.pessoa_id]) {
        _localCache.ausencias[a.pessoa_id] = [];
      }
      _localCache.ausencias[a.pessoa_id].push(a);
    });

    console.log(`✓ Carregadas ${pessoas.length} pessoas do Supabase`);
    return true;
  } catch (err) {
    console.error('Erro ao carregar do Supabase:', err);
    // Fallback para localStorage
    carregarDoCache();
    return false;
  }
}

// ===== CARREGAR DO CACHE (se Supabase falhar) =====
function carregarDoCache() {
  try {
    const cached = localStorage.getItem('pessoas_cache');
    if (cached) {
      _localCache = JSON.parse(cached);
      window._dashboard = { pessoas: _localCache.pessoas };
      console.log('✓ Carregado do cache local');
    }
  } catch (err) {
    console.error('Erro ao carregar cache:', err);
  }
}

// ===== SALVAR NO CACHE LOCAL =====
function salvarNoCache() {
  try {
    localStorage.setItem('pessoas_cache', JSON.stringify(_localCache));
    localStorage.setItem('pending_sync', JSON.stringify(_pendingSync));
  } catch (err) {
    console.error('Erro ao salvar cache:', err);
  }
}

// ===== SINCRONIZAR MUDANÇAS =====
async function sincronizarMudancas() {
  if (_pendingSync.length === 0) return;

  console.log(`Sincronizando ${_pendingSync.length} mudanças...`);

  for (const op of _pendingSync) {
    try {
      switch (op.type) {
        case 'pessoa_ausencia_add':
          await sb.create('pessoas_ausencias', op.data);
          console.log('✓ Ausência sincronizada');
          break;

        case 'pessoa_ausencia_remove':
          await sb.delete('pessoas_ausencias', op.data.id);
          console.log('✓ Ausência removida');
          break;

        case 'pessoa_equipe_mudada':
          await sb.update('pessoas', { equipe: op.data.equipe }, op.data.pessoa_id);
          console.log('✓ Equipe atualizada');
          break;

        case 'pessoa_removida':
          await sb.update('pessoas', { ativa: false }, op.data.pessoa_id);
          console.log('✓ Pessoa marcada como inativa');
          break;
      }
    } catch (err) {
      console.error(`Erro ao sincronizar ${op.type}:`, err);
      break; // Para em primeiro erro
    }
  }

  _pendingSync = [];
  salvarNoCache();

  // Recarregar dados
  await carregarPessoasSupabase();
  renderGestao();
}

// ===== DEBOUNCED SYNC =====
function agendarSincronizacao() {
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(sincronizarMudancas, 2000);
}

// ===== OPERATIONS =====

async function salvarAusenciaSupabase(pessoaId, tipo, dataInicio, dataFim, observacao) {
  const ausencia = {
    pessoa_id: pessoaId,
    tipo,
    data_inicio: dataInicio,
    data_fim: dataFim,
    observacao
  };

  // Salvar local primeiro
  if (!_localCache.ausencias[pessoaId]) {
    _localCache.ausencias[pessoaId] = [];
  }
  _localCache.ausencias[pessoaId] = [ausencia]; // Substitui (uma por vez)

  // Fila para sincronização
  _pendingSync.push({
    type: 'pessoa_ausencia_add',
    data: ausencia
  });

  salvarNoCache();
  agendarSincronizacao();

  console.log('✓ Ausência salva localmente, sincronizando...');
}

async function removerAusenciaSupabase(pessoaId) {
  // Limpar local
  if (_localCache.ausencias[pessoaId]) {
    _localCache.ausencias[pessoaId] = [];
  }

  // Fila para sincronização
  _pendingSync.push({
    type: 'pessoa_ausencia_remove',
    data: { pessoa_id: pessoaId }
  });

  salvarNoCache();
  agendarSincronizacao();

  console.log('✓ Ausência removida localmente, sincronizando...');
}

async function mudarEquipeSupabase(pessoaId, novaEquipe) {
  // Atualizar local
  const pessoa = window._dashboard.pessoas.find(p => p.id === pessoaId);
  if (pessoa) {
    pessoa.equipe = novaEquipe;
  }

  // Fila para sincronização
  _pendingSync.push({
    type: 'pessoa_equipe_mudada',
    data: { pessoa_id: pessoaId, equipe: novaEquipe }
  });

  salvarNoCache();
  agendarSincronizacao();

  console.log('✓ Equipe alterada localmente, sincronizando...');
}

async function removerPessoaSupabase(pessoaId) {
  // Marcar como inativa localmente
  const pessoa = window._dashboard.pessoas.find(p => p.id === pessoaId);
  if (pessoa) {
    pessoa.ativa = false;
  }

  // Fila para sincronização
  _pendingSync.push({
    type: 'pessoa_removida',
    data: { pessoa_id: pessoaId }
  });

  salvarNoCache();
  agendarSincronizacao();

  console.log('✓ Pessoa marcada como inativa, sincronizando...');
}

async function criarNovaPessoaSupabase(nome, email, equipe, disciplina, lider) {
  const pessoaId = `pessoa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const pessoa = {
    id: pessoaId,
    nome,
    email,
    equipe,
    disciplina: disciplina || '',
    lider: lider || '',
    ativa: true
  };

  // Adicionar localmente
  window._dashboard.pessoas.push(pessoa);
  _localCache.pessoas.push(pessoa);

  // Sincronizar
  try {
    await sb.create('pessoas', pessoa);
    console.log('✓ Nova pessoa criada no Supabase');
  } catch (err) {
    // Deixar na fila para sincronizar depois
    _pendingSync.push({
      type: 'pessoa_nova',
      data: pessoa
    });
    console.error('Erro ao criar pessoa, aguardando sincronização:', err);
  }

  salvarNoCache();
  agendarSincronizacao();
}

// ===== VERIFICAR CONEXÃO =====
async function verificarConexaoSupabase() {
  try {
    const result = await sb.read('pessoas', { query: { limit: '1' } });
    console.log('✓ Conexão com Supabase OK');
    return true;
  } catch (err) {
    console.warn('⚠️ Supabase indisponível, usando cache local');
    return false;
  }
}

// ===== SINCRONIZAR EM BACKGROUND =====
setInterval(() => {
  if (_pendingSync.length > 0) {
    sincronizarMudancas();
  }
}, 5000); // A cada 5 segundos

// Sincronizar ao voltar online
window.addEventListener('online', () => {
  console.log('✓ Conexão restaurada, sincronizando mudanças...');
  sincronizarMudancas();
});

// ===== INICIALIZAR NA CARGA =====
(async function init() {
  console.log('Inicializando Gestão de Pessoas com Supabase...');

  // Tentar carregar do Supabase primeiro
  const online = await verificarConexaoSupabase();

  if (online) {
    await carregarPessoasSupabase();
  } else {
    carregarDoCache();
  }

  // Tentar sincronizar mudanças pendentes
  if (_pendingSync.length > 0) {
    await sincronizarMudancas();
  }

  // Carregar pessoas_mudancas se existir (para manter compatibilidade)
  if (typeof carregarPessoasMudancas === 'function') {
    carregarPessoasMudancas();
  }
})();

// ===== EXPORTAR FUNÇÕES =====
window.SupabaseGestao = {
  carregarPessoasSupabase,
  salvarAusenciaSupabase,
  removerAusenciaSupabase,
  mudarEquipeSupabase,
  removerPessoaSupabase,
  criarNovaPessoaSupabase,
  sincronizarMudancas,
  verificarConexaoSupabase
};
