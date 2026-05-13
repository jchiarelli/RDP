/**
 * SUPABASE DATA MANAGER
 * Gerencia carregamento de dados do Supabase com cache local
 */

class SupabaseDataManager {
  constructor() {
    this.supabaseUrl = window.SUPABASE_URL;
    this.supabaseKey = window.SUPABASE_KEY;
    this.cacheTTL = 5 * 60 * 1000; // 5 minutos
    this.cache = {};
  }

  /**
   * Headers padrão para requisições Supabase
   */
  get headers() {
    return {
      'apikey': this.supabaseKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  /**
   * Verifica se cache ainda é válido
   */
  isCacheValid(key) {
    if (!this.cache[key]) return false;
    const elapsed = Date.now() - this.cache[key].timestamp;
    return elapsed < this.cacheTTL;
  }

  /**
   * Carrega RDPs do Supabase
   */
  async loadRDPs(filters = {}) {
    const cacheKey = 'rdps_' + JSON.stringify(filters);

    if (this.isCacheValid(cacheKey)) {
      return this.cache[cacheKey].data;
    }

    try {
      let url = `${this.supabaseUrl}/rest/v1/rdps`;
      const params = new URLSearchParams();

      // Adiciona filtros à query
      if (filters.data) params.append('data', `eq.${filters.data}`);
      if (filters.projeto_codigo) params.append('projeto_codigo', `eq.${filters.projeto_codigo}`);
      if (filters.responsavel) params.append('responsavel', `ilike.%${filters.responsavel}%`);

      // Ordering
      params.append('order', filters.order || 'data.desc');
      params.append('limit', filters.limit || '500');

      if (params.toString()) {
        url += '?' + params.toString();
      }

      const response = await fetch(url, { headers: this.headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      this.cache[cacheKey] = { data, timestamp: Date.now() };
      return data;
    } catch (error) {
      console.error('Erro ao carregar RDPs:', error);
      return [];
    }
  }

  /**
   * Carrega Projetos do Supabase
   */
  async loadProjetos() {
    const cacheKey = 'projetos';

    if (this.isCacheValid(cacheKey)) {
      return this.cache[cacheKey].data;
    }

    try {
      const url = `${this.supabaseUrl}/rest/v1/projetos`;
      const response = await fetch(url, { headers: this.headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      this.cache[cacheKey] = { data, timestamp: Date.now() };
      return data;
    } catch (error) {
      console.error('Erro ao carregar Projetos:', error);
      return [];
    }
  }

  /**
   * Carrega Pendências do Supabase
   */
  async loadPendencias() {
    const cacheKey = 'pendencias';

    if (this.isCacheValid(cacheKey)) {
      return this.cache[cacheKey].data;
    }

    try {
      const url = `${this.supabaseUrl}/rest/v1/pendencias`;
      const response = await fetch(url, { headers: this.headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      this.cache[cacheKey] = { data, timestamp: Date.now() };
      return data;
    } catch (error) {
      console.error('Erro ao carregar Pendências:', error);
      return [];
    }
  }

  /**
   * Carrega RDPs por data
   */
  async loadRDPsByDate(data) {
    return this.loadRDPs({ data });
  }

  /**
   * Carrega RDPs por projeto
   */
  async loadRDPsByProject(projeto_codigo) {
    return this.loadRDPs({ projeto_codigo });
  }

  /**
   * Carrega Pessoas do Supabase
   */
  async loadPessoas() {
    const cacheKey = 'pessoas';

    if (this.isCacheValid(cacheKey)) {
      return this.cache[cacheKey].data;
    }

    try {
      const url = `${this.supabaseUrl}/rest/v1/pessoas`;
      const response = await fetch(url, { headers: this.headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      this.cache[cacheKey] = { data, timestamp: Date.now() };
      return data;
    } catch (error) {
      console.error('Erro ao carregar Pessoas:', error);
      return [];
    }
  }

  /**
   * Limpa cache
   */
  clearCache() {
    this.cache = {};
  }
}

// Cria instância global se não existir
if (typeof window !== 'undefined') {
  window.SupabaseDataManager = SupabaseDataManager;
}
