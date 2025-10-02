const fs = require('fs');
const path = require('path');
const logger = require('../logger');

class RoteamentoService {
  constructor() {
    this.filiaisFile = path.join(__dirname, '../../data/filiais.json');
    this.filiais = [];
    this._carregarFiliais();
  }

  _carregarFiliais() {
    try {
      const raw = fs.readFileSync(this.filiaisFile, 'utf-8');
      this.filiais = JSON.parse(raw);
      logger.info('Filiais carregadas para roteamento', { total: this.filiais.length });
    } catch (err) {
      logger.error('Falha ao carregar filiais.json', { error: err.message, file: this.filiaisFile });
      this.filiais = [];
    }
  }

  listarFiliais() {
    return this.filiais;
  }

  normalizarCidade(texto) {
    return String(texto || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  }

  // Extrai prefixo de CEP (primeiros 3 dígitos) para mapear por área
  obterPrefixoCEP(cep) {
    const apenasDigitos = String(cep || '').replace(/\D/g, '');
    if (apenasDigitos.length < 3) return null;
    return apenasDigitos.slice(0, 3);
  }

  resolverPorCidade(cidade) {
    const nCidade = this.normalizarCidade(cidade);
    if (!nCidade) return null;

    // Procura em campo cidade e na lista de cidades atendidas
    for (const f of this.filiais) {
      const cidadeFilial = this.normalizarCidade(f.cidade);
      const atende = Array.isArray(f.cidades_atendidas) ? f.cidades_atendidas.map(c => this.normalizarCidade(c)) : [];
      if (cidadeFilial === nCidade || atende.includes(nCidade)) {
        return f;
      }
    }
    return null;
  }

  resolverPorCEP(cep) {
    const prefixo = this.obterPrefixoCEP(cep);
    if (!prefixo) return null;
    for (const f of this.filiais) {
      const lista = Array.isArray(f.cep_prefixos) ? f.cep_prefixos.map(String) : [];
      if (lista.includes(prefixo)) return f;
    }
    return null;
  }

  // Resolve melhor filial dado cidade e/ou CEP; prioriza CEP se válido
  resolverFilial({ cidade, cep }) {
    let filial = null;
    if (cep) filial = this.resolverPorCEP(cep);
    if (!filial && cidade) filial = this.resolverPorCidade(cidade);
    return filial;
  }
}

module.exports = new RoteamentoService();