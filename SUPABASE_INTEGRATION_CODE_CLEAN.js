/**
 * SUPABASE INTEGRATION - Gestão de Pessoas
 * Versão LIMPA: Apenas Supabase (sem localStorage)
 *
 * Configuração obrigatória no HTML (antes de carregar este script):
 * <script>
 *   window.SUPABASE_URL = 'https://xxxxx.supabase.co';
 *   window.SUPABASE_KEY = 'eyJ...'; // anon public key
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
  window.SUPABASE_URL || 'https://xxxxx.supabase.co',
  window.SUPABASE_KEY || 'eyJ...'
);

// ===== ESTADO EM MEMÓRIA =====
let _pessoasCache = [];
let _ausenciasCache = {};
let _mudancasCache = {};

// ===== CARREGAR DADOS DO SUPABASE =====
async function carregarPessoasSupabase() {
  try {
    // Carregar pessoas
    const pessoas = await sb.read('pessoas');
    _pessoasCache = pessoas;

    if (!window._dashboard) window._dashboard = {};
    window._dashboard.pessoas = pessoas.map(p => ({
      ...p,
      id: p.id || `pessoa_${Math.random().toString(36).substr(2, 9)}`
    }));

    // Carregar ausências
    const ausencias = await sb.read('pessoas_ausencias');
    _ausenciasCache = {};
    ausencias.forEach(a => {
      if (!_ausenciasCache[a.pessoa_id]) {
        _ausenciasCache[a.pessoa_id] = [];
      }
      _ausenciasCache[a.pessoa_id].push(a);
    });

    // Carregar mudanças (histórico)
    const mudancas = await sb.read('pessoas_mudancas');
    _mudancasCache = {};
    mudancas.forEach(m => {
      if (!_mudancasCache[m.pessoa_id]) {
        _mudancasCache[m.pessoa_id] = [];
      }
      _mudancasCache[m.pessoa_id].push(m);
    });

    console.log(`✓ Carregadas ${pessoas.length} pessoas do Supabase`);
    return true;
  } catch (err) {
    console.error('❌ Erro ao carregar do Supabase:', err);
    throw err; // Falha rápido - sem fallback
  }
}

// ===== OPERAÇÕES =====

async function salvarAusenciaSupabase(pessoaId, tipo, dataInicio, dataFim, observacao) {
  const ausencia = {
    pessoa_id: pessoaId,
    tipo,
    data_inicio: dataInicio,
    data_fim: dataFim,
    observacao
  };

  try {
    const result = await sb.create('pessoas_ausencias', ausencia);

    // Atualizar cache
    if (!_ausenciasCache[pessoaId]) {
      _ausenciasCache[pessoaId] = [];
    }
    _ausenciasCache[pessoaId] = [result]; // Uma por vez

    console.log('✓ Ausência salva');
    return result;
  } catch (err) {
    console.error('Erro ao salvar ausência:', err);
    throw err;
  }
}

async function removerAusenciaSupabase(pessoaId, ausenciaId) {
  try {
    await sb.delete('pessoas_ausencias', ausenciaId);

    // Limpar cache
    if (_ausenciasCache[pessoaId]) {
      _ausenciasCache[pessoaId] = [];
    }

    console.log('✓ Ausência removida');
  } catch (err) {
    console.error('Erro ao remover ausência:', err);
    throw err;
  }
}

async function mudarEquipeSupabase(pessoaId, novaEquipe) {
  try {
    await sb.update('pessoas', { equipe: novaEquipe }, pessoaId);

    // Atualizar cache
    const pessoa = window._dashboard.pessoas.find(p => p.id === pessoaId);
    if (pessoa) {
      pessoa.equipe = novaEquipe;
    }

    // Registrar mudança (histórico)
    await sb.create('pessoas_mudancas', {
      pessoa_id: pessoaId,
      tipo: 'equipe_mudada',
      dados_antigos: { equipe: pessoa?.equipe },
      dados_novos: { equipe: novaEquipe },
      created_by: 'usuario'
    });

    console.log('✓ Equipe alterada');
  } catch (err) {
    console.error('Erro ao mudar equipe:', err);
    throw err;
  }
}

async function removerPessoaSupabase(pessoaId) {
  try {
    await sb.update('pessoas', { ativa: false }, pessoaId);

    // Atualizar cache
    const pessoa = window._dashboard.pessoas.find(p => p.id === pessoaId);
    if (pessoa) {
      pessoa.ativa = false;
    }

    console.log('✓ Pessoa marcada como inativa');
  } catch (err) {
    console.error('Erro ao remover pessoa:', err);
    throw err;
  }
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

  try {
    const result = await sb.create('pessoas', pessoa);

    // Atualizar cache
    window._dashboard.pessoas.push(result || pessoa);
    _pessoasCache.push(result || pessoa);

    console.log('✓ Nova pessoa criada');
    return result || pessoa;
  } catch (err) {
    console.error('Erro ao criar pessoa:', err);
    throw err;
  }
}

// ===== VERIFICAR CONEXÃO =====
async function verificarConexaoSupabase() {
  try {
    await sb.read('pessoas', { query: { limit: '1' } });
    console.log('✓ Conexão com Supabase OK');
    return true;
  } catch (err) {
    console.error('❌ Supabase indisponível');
    throw err;
  }
}

// ===== INICIALIZAÇÃO =====
(async function init() {
  console.log('Inicializando Gestão de Pessoas com Supabase...');

  try {
    // Testar conexão
    await verificarConexaoSupabase();

    // Carregar dados
    await carregarPessoasSupabase();

    // Inicializar compatibilidade
    if (typeof carregarPessoasMudancas === 'function') {
      carregarPessoasMudancas();
    }

    console.log('✓ Pronto para uso');
  } catch (err) {
    console.error('❌ Falha na inicialização:', err);
    // Sem fallback - mostra erro claro
    alert('Erro ao conectar com Supabase. Verifique as credenciais e tente novamente.');
  }
})();

// ===== CARREGAR APENAS AUSÊNCIAS =====
async function carregarAusenciasSupabase() {
  try {
    // Carregar ausências
    const ausencias = await sb.read('pessoas_ausencias');
    _ausenciasCache = {};
    ausencias.forEach(a => {
      if (!_ausenciasCache[a.pessoa_id]) {
        _ausenciasCache[a.pessoa_id] = [];
      }
      _ausenciasCache[a.pessoa_id].push(a);
    });

    console.log(`✓ Carregadas ${ausencias.length} ausências do Supabase`);
    return true;
  } catch (err) {
    console.error('❌ Erro ao carregar ausências:', err);
    throw err;
  }
}

// ===== EXPORTAR FUNÇÕES =====
window.SupabaseGestao = {
  carregarPessoasSupabase,
  carregarAusenciasSupabase,
  salvarAusenciaSupabase,
  removerAusenciaSupabase,
  mudarEquipeSupabase,
  removerPessoaSupabase,
  criarNovaPessoaSupabase,
  verificarConexaoSupabase,
  // Expor caches para acesso ao frontend
  get ausenciasCache() { return _ausenciasCache; }
};

// Expor _pessoasMudancas para compatibilidade com dashboard.html
window._pessoasMudancas = {};
