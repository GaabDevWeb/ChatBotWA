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

  // Normaliza termos removendo acentos, pontuação e espaços extras
  normalizarCidade(texto) {
    return String(texto || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ') // remove pontuação, barras, hífens etc.
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Remove siglas de UF quando estiverem presentes como tokens separados
  removerUF(textoNorm) {
    const ufs = ['ac','al','ap','am','ba','ce','df','es','go','ma','mt','ms','mg','pa','pb','pr','pe','pi','rj','rn','rs','ro','rr','sc','sp','se','to'];
    const tokens = String(textoNorm || '').split(' ').filter(Boolean);
    const filtrados = tokens.filter(t => !ufs.includes(t));
    return filtrados.join(' ').trim();
  }

  // Extrai prefixo de CEP (primeiros 3 dígitos) para mapear por área
  obterPrefixoCEP(cep) {
    const apenasDigitos = String(cep || '').replace(/\D/g, '');
    if (apenasDigitos.length < 3) return null;
    return apenasDigitos.slice(0, 3);
  }

  resolverPorCidade(cidadeOuFrase) {
    // Normaliza texto do usuário e remove UF se houver
    const textoNorm = this.normalizarCidade(cidadeOuFrase);
    if (!textoNorm) return null;
    const nCidade = this.removerUF(textoNorm);

    // Procura primeiro por igualdade exata com cidade da filial ou cidades atendidas
    for (const f of this.filiais) {
      const cidadeFilial = this.removerUF(this.normalizarCidade(f.cidade));
      const atendidasNorm = Array.isArray(f.cidades_atendidas)
        ? f.cidades_atendidas.map(c => this.removerUF(this.normalizarCidade(c)))
        : [];

      if (cidadeFilial === nCidade || atendidasNorm.includes(nCidade)) {
        return f;
      }
    }

    // Se não achou por igualdade, tenta encontrar cidade presente dentro da frase do usuário
    for (const f of this.filiais) {
      const candidatos = [f.cidade, ...(Array.isArray(f.cidades_atendidas) ? f.cidades_atendidas : [])]
        .filter(Boolean)
        .map(c => this.removerUF(this.normalizarCidade(c)))
        .filter(Boolean);
      if (candidatos.some(nome => nCidade.includes(nome))) {
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