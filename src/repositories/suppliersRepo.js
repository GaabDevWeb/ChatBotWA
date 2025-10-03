// Repositório de Fornecedores: encapsula acesso ao banco
const {
  cadastrarFornecedor,
  buscarFornecedorPorProtocolo,
  listarFornecedoresPorCliente
} = require('../../database');

async function create(clienteIdentifier, fornecedorData) {
  return await cadastrarFornecedor(clienteIdentifier, fornecedorData);
}

async function getByProtocolo(protocolo) {
  return await buscarFornecedorPorProtocolo(protocolo);
}

async function listByCliente(clienteIdentifier, page = 1, pageSize = 50) {
  return await listarFornecedoresPorCliente(clienteIdentifier, page, pageSize);
}

module.exports = {
  create,
  getByProtocolo,
  listByCliente
};