const logger = require('../logger');
const suppliersRepo = require('../repositories/suppliersRepo');

function gerarProtocolo(prefix = 'FOR') {
  return `${prefix}${Date.now().toString().slice(-8)}`;
}

async function salvarFornecedor(clienteIdentifier, dados) {
  const protocolo = dados.protocolo || gerarProtocolo();
  const registro = {
    protocolo,
    razao_social: dados.razao_social,
    cnpj: dados.cnpj || null,
    categoria: dados.categoria || null,
    portfolio_url: dados.portfolio_url || null,
    site_link: dados.site_link || null,
    cidades_atendidas: Array.isArray(dados.cidades_atendidas) ? dados.cidades_atendidas.join(', ') : (dados.cidades_atendidas || null),
    contato: dados.contato || null,
    created_at: Date.now()
  };

  const saved = await suppliersRepo.create(clienteIdentifier, registro);
  logger.info('Fornecedor salvo', { protocolo: saved.protocolo, clienteIdentifier });
  return saved;
}

async function buscarPorProtocolo(protocolo) {
  return await suppliersRepo.getByProtocolo(protocolo);
}

async function listarPorCliente(clienteIdentifier, page = 1, pageSize = 50) {
  return await suppliersRepo.listByCliente(clienteIdentifier, page, pageSize);
}

module.exports = {
  gerarProtocolo,
  salvarFornecedor,
  buscarPorProtocolo,
  listarPorCliente
};