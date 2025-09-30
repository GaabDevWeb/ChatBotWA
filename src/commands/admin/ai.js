const logger = require('../../logger');

function register(commandBus, { pluginSystem, getSystemStats, clearCache }) {
  commandBus.register('ai', async (args) => {
    const aiCommand = args[0];

    if (!aiCommand) {
      return (
        '🤖 *Sistema de IA OrbitBot*\n\n' +
        '*Comandos Disponíveis:*\n\n' +
        '🔌 *Plugins*\n' +
        '• /ai plugin listar - Lista todos os plugins\n' +
        '• /ai plugin [nome] on/off - Habilita/desabilita plugin\n' +
        '• /ai plugin info [nome] - Mostra informações do plugin\n\n' +
        '📊 *Sistema*\n' +
        '• /ai stats - Mostra estatísticas do sistema\n' +
        '• /ai cache limpar - Limpa cache de respostas\n\n' +
        '*Exemplos:*\n' +
        '• /ai plugin sentimentAnalysis off\n' +
        '• /ai stats\n' +
        '• /ai cache limpar'
      );
    }

    switch (aiCommand) {
      case 'plugin': {
        const sub = args[1];
        if (!sub) return 'Por favor, especifique um comando. Use: listar, [nome] on/off, info [nome]';
        
        switch (sub) {
          case 'listar': {
            const plugins = pluginSystem.listPlugins();
            if (plugins.length === 0) {
              return '🔌 *Nenhum plugin disponível*';
            }
            return (
              `🔌 *Plugins Disponíveis:*\n\n` +
              plugins
                .map((p) => `• *${p.name}* ${p.enabled ? '✅' : '❌'}\n  ${p.description}\n`)
                .join('\n') +
              `\n*Use:* /ai plugin [nome] on/off para alterar`
            );
          }
          case 'info': {
            const pluginName = args[2];
            if (!pluginName) return 'Por favor, especifique o nome do plugin';
            
            const plugin = pluginSystem.getPlugin(pluginName);
            if (!plugin) return `Plugin "${pluginName}" não encontrado`;
            
            return (
              `🔌 *Plugin: ${plugin.name}*\n\n` +
              `*Status:* ${plugin.enabled ? '✅ Ativo' : '❌ Inativo'}\n` +
              `*Descrição:* ${plugin.description}\n` +
              `*Versão:* ${plugin.version || 'N/A'}\n` +
              `*Hooks:* ${plugin.hooks ? plugin.hooks.join(', ') : 'Nenhum'}\n` +
              `*Middleware:* ${plugin.middleware ? 'Sim' : 'Não'}`
            );
          }
          default: {
            // Comando para habilitar/desabilitar plugin
            const pluginName = sub;
            const action = args[2];
            
            if (!action || !['on', 'off'].includes(action)) {
              return 'Por favor, especifique "on" ou "off"';
            }
            
            try {
              const enabled = action === 'on';
              const result = pluginSystem.setPluginEnabled(pluginName, enabled);
              
              if (result) {
                logger.info(`Plugin ${pluginName} ${enabled ? 'habilitado' : 'desabilitado'}`);
                return `🔌 Plugin *${pluginName}* ${enabled ? '✅ habilitado' : '❌ desabilitado'}`;
              } else {
                return `❌ Plugin "${pluginName}" não encontrado`;
              }
            } catch (error) {
              logger.error('Erro ao alterar plugin', { plugin: pluginName, error: error.message });
              return `❌ Erro ao alterar plugin: ${error.message}`;
            }
          }
        }
      }

      case 'stats': {
        try {
          const systemStats = getSystemStats();
          return (
              `📊 *Estatísticas do Sistema*\n\n` +
              `🔌 *Plugins:*\n` +
              `• Total: ${systemStats.plugins.total}\n` +
              `• Ativos: ${systemStats.plugins.enabled}\n` +
              `• Inativos: ${systemStats.plugins.disabled}\n\n` +
              `💾 *Cache:*\n` +
              `• Entradas: ${systemStats.cache.size}\n` +
              `• Hits: ${systemStats.cache.hits}\n` +
              `• Misses: ${systemStats.cache.misses}\n` +
              `• Taxa de acerto: ${systemStats.cache.hitRate}%\n\n` +
              `🤖 *Sistema:*\n` +
              `• Modelo: Google Gemini 2.0 Flash\n` +
              `• Treinamento: Orbit Assistant\n` +
              `• Status: ✅ Operacional`
            );
        } catch (error) {
          logger.error('Erro ao obter estatísticas', { error: error.message });
          return '❌ Erro ao obter estatísticas do sistema';
        }
      }

      case 'cache': {
        const sub = args[1];
        if (sub === 'limpar') {
          try {
            const cleared = clearCache();
            logger.info('Cache limpo via comando admin');
            return `🗑️ Cache limpo com sucesso! ${cleared} entradas removidas.`;
          } catch (error) {
            logger.error('Erro ao limpar cache', { error: error.message });
            return '❌ Erro ao limpar cache';
          }
        } else {
          return 'Use: /ai cache limpar';
        }
      }

      default:
        return (
          '❌ Comando não reconhecido.\n\n' +
          'Use */ai* para ver todos os comandos disponíveis.'
        );
    }
  });
}

module.exports = { register };
