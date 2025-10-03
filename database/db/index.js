const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Caminho do banco de dados: OrbitBot/database/data/orbitbot.db
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'orbitbot.db');

// Garante a existência do diretório
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Instância única do DB
const db = new sqlite3.Database(dbPath);

// Inicializa esquema
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT UNIQUE NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS historico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  )`);

  // Índices úteis
  db.run(`CREATE INDEX IF NOT EXISTS idx_historico_cliente ON historico(cliente_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_historico_timestamp ON historico(timestamp)`);

  // Migração: adiciona coluna 'filial' para armazenar dados da filial em JSON
  db.all('PRAGMA table_info(clientes)', (err, rows) => {
    if (!err && Array.isArray(rows)) {
      const hasFilial = rows.some((c) => c.name === 'filial');
      if (!hasFilial) {
        db.run('ALTER TABLE clientes ADD COLUMN filial TEXT');
      }
    }
  });

  // Nova tabela: fornecedores
  db.run(`CREATE TABLE IF NOT EXISTS fornecedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    protocolo TEXT UNIQUE,
    razao_social TEXT NOT NULL,
    cnpj TEXT,
    categoria TEXT,
    portfolio_url TEXT,
    site_link TEXT,
    cidades_atendidas TEXT,
    contato TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_fornecedores_protocolo ON fornecedores(protocolo)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_fornecedores_cliente ON fornecedores(cliente_id)`);
});

function cadastrarCliente(numero) {
  return new Promise((resolve, reject) => {
    // Tenta buscar primeiro para evitar erro de UNIQUE
    db.get('SELECT id, numero FROM clientes WHERE numero = ?', [numero], (err, row) => {
      if (err) return reject(err);
      if (row) return resolve(row);

      db.run('INSERT INTO clientes (numero) VALUES (?)', [numero], function (err2) {
        if (err2) return reject(err2);
        resolve({ id: this.lastID, numero });
      });
    });
  });
}

function buscarCliente(numero) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, numero, filial FROM clientes WHERE numero = ?', [numero], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      let filialObj = null;
      if (row.filial) {
        try { filialObj = JSON.parse(row.filial); } catch (_) { filialObj = null; }
      }
      resolve({ id: row.id, numero: row.numero, filial: filialObj });
    });
  });
}

function adicionarMensagem(clienteId, mensagem, role) {
  return new Promise((resolve, reject) => {
    const ts = Date.now();
    db.run(
      'INSERT INTO historico (cliente_id, role, mensagem, timestamp) VALUES (?, ?, ?, ?)',
      [clienteId, role, mensagem, ts],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, cliente_id: clienteId, role, mensagem, timestamp: ts });
      }
    );
  });
}

function _resolveClienteId(identifier, cb) {
  if (typeof identifier === 'number') return cb(null, identifier);
  
  // Identificadores como string: aceita IDs numéricos ou procura pelo campo numero
  if (typeof identifier === 'string') {
    if (/^\d+$/.test(identifier)) {
      // string numérica simples -> interpreta como ID
      return cb(null, parseInt(identifier, 10));
    }
    // Qualquer outra string: procurar pelo campo numero
    db.get('SELECT id FROM clientes WHERE numero = ?', [identifier], (err, row) => {
      if (err) return cb(err);
      if (!row) return cb(new Error('Cliente não encontrado'));
      cb(null, row.id);
    });
  } else {
    return cb(new Error('Identificador de cliente inválido'));
  }
}

function buscarHistorico(identifier, page = 1, pageSize = 50) {
  return new Promise((resolve, reject) => {
    _resolveClienteId(identifier, (err, clienteId) => {
      if (err) return reject(err);

      const offset = (page - 1) * pageSize;

      db.all(
        'SELECT role, mensagem, timestamp FROM historico WHERE cliente_id = ? ORDER BY id ASC LIMIT ? OFFSET ?',
        [clienteId, pageSize, offset],
        (err2, rows) => {
          if (err2) return reject(err2);

          db.get(
            'SELECT COUNT(*) as total FROM historico WHERE cliente_id = ?',
            [clienteId],
            (err3, countRow) => {
              if (err3) return reject(err3);
              const total = countRow.total || 0;
              const totalPages = Math.max(1, Math.ceil(total / pageSize));

              resolve({
                messages: rows.map(r => ({ role: r.role, mensagem: r.mensagem, timestamp: r.timestamp })),
                pagination: {
                  currentPage: page,
                  pageSize,
                  totalMessages: total,
                  totalPages
                }
              });
            }
          );
        }
      );
    });
  });
}

function buscarUltimasMensagens(clienteId, limit = 20) {
  return new Promise((resolve, reject) => {
    _resolveClienteId(clienteId, (err, resolvedId) => {
      if (err) return reject(err);
      db.all(
        'SELECT role, mensagem, timestamp FROM historico WHERE cliente_id = ? ORDER BY id DESC LIMIT ?',
        [resolvedId, limit],
        (err2, rows) => {
          if (err2) return reject(err2);
          // retorna em ordem cronológica
          resolve(rows.reverse().map(r => ({ role: r.role, mensagem: r.mensagem, timestamp: r.timestamp })));
        }
      );
    });
  });
}

function buscarClientePorId(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id, numero, filial FROM clientes WHERE id = ?', [id], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      let filialObj = null;
      if (row.filial) {
        try { filialObj = JSON.parse(row.filial); } catch (_) { filialObj = null; }
      }
      resolve({ id: row.id, numero: row.numero, filial: filialObj });
    });
  });
}

function atualizarFilial(identifier, filialObj) {
  return new Promise((resolve, reject) => {
    _resolveClienteId(identifier, (err, clienteId) => {
      if (err) return reject(err);
      const json = filialObj ? JSON.stringify(filialObj) : null;
      db.run('UPDATE clientes SET filial = ? WHERE id = ?', [json, clienteId], function (err2) {
        if (err2) return reject(err2);
        resolve(true);
      });
    });
  });
}

// --- Fornecedores operations ---
function cadastrarFornecedor(clienteIdentifier, fornecedor) {
  return new Promise((resolve, reject) => {
    _resolveClienteId(clienteIdentifier, (err, clienteId) => {
      if (err) return reject(err);
      const {
        protocolo,
        razao_social,
        cnpj,
        categoria,
        portfolio_url,
        site_link,
        cidades_atendidas,
        contato,
        created_at
      } = fornecedor || {};

      const ts = typeof created_at === 'number' ? created_at : Date.now();
      db.run(
        `INSERT INTO fornecedores (
            cliente_id, protocolo, razao_social, cnpj, categoria,
            portfolio_url, site_link, cidades_atendidas, contato, created_at
         ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          clienteId,
          protocolo || null,
          razao_social,
          cnpj || null,
          categoria || null,
          portfolio_url || null,
          site_link || null,
          cidades_atendidas || null,
          contato || null,
          ts
        ],
        function (err2) {
          if (err2) return reject(err2);
          db.get('SELECT * FROM fornecedores WHERE id = ?', [this.lastID], (err3, row) => {
            if (err3) return reject(err3);
            resolve(row);
          });
        }
      );
    });
  });
}

function buscarFornecedorPorProtocolo(protocolo) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM fornecedores WHERE protocolo = ?', [protocolo], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function listarFornecedoresPorCliente(clienteIdentifier, page = 1, pageSize = 50) {
  return new Promise((resolve, reject) => {
    _resolveClienteId(clienteIdentifier, (err, clienteId) => {
      if (err) return reject(err);
      const offset = (page - 1) * pageSize;
      db.all(
        'SELECT * FROM fornecedores WHERE cliente_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
        [clienteId, pageSize, offset],
        (err2, rows) => {
          if (err2) return reject(err2);
          db.get('SELECT COUNT(*) as total FROM fornecedores WHERE cliente_id = ?', [clienteId], (err3, countRow) => {
            if (err3) return reject(err3);
            const total = countRow.total || 0;
            const totalPages = Math.max(1, Math.ceil(total / pageSize));
            resolve({ items: rows, pagination: { currentPage: page, pageSize, totalItems: total, totalPages } });
          });
        }
      );
    });
  });
}

module.exports = {
  cadastrarCliente,
  buscarCliente,
  adicionarMensagem,
  buscarHistorico,
  buscarUltimasMensagens,
  buscarClientePorId,
  atualizarFilial,
  cadastrarFornecedor,
  buscarFornecedorPorProtocolo,
  listarFornecedoresPorCliente,
};
