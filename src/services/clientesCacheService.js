const fs = require('fs');
const path = require('path');
const logger = require('../logger');

class ClientesCacheService {
  constructor() {
    this.cacheFile = path.join(__dirname, '../../data/clientes_cache.json');
    this._ensureFile();
    this._cache = this._load();
  }

  _ensureFile() {
    try {
      if (!fs.existsSync(this.cacheFile)) {
        fs.writeFileSync(this.cacheFile, '{}', 'utf-8');
      }
    } catch (err) {
      logger.error('Erro ao garantir clientes_cache.json', { error: err.message });
    }
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.cacheFile, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      logger.error('Falha ao carregar clientes_cache.json', { error: err.message });
      return {};
    }
  }

  _save() {
    try {
      fs.writeFileSync(this.cacheFile, JSON.stringify(this._cache, null, 2), 'utf-8');
    } catch (err) {
      logger.error('Falha ao salvar clientes_cache.json', { error: err.message });
    }
  }

  get(number) {
    return this._cache[number] || null;
  }

  set(number, data) {
    this._cache[number] = { ...(this._cache[number] || {}), ...data };
    this._save();
    return this._cache[number];
  }
}

module.exports = new ClientesCacheService();