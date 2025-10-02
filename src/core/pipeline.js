// Pipeline de mensagens: orquestra histórico -> IA -> persistência
const logger = require('../logger');
const { handleMessage } = require('../openai');
const historyRepo = require('../repositories/historyRepo');
const clientsRepo = require('../repositories/clientsRepo');
const MenuInterceptor = require('../middleware/menuInterceptor');

/**
 * Executa o pipeline de processamento de mensagem de um usuário
 * - Garante cliente
 * - Carrega histórico recente
 * - Intercepta comandos de menu (se aplicável)
 * - Chama IA (com hooks/plugins internos)
 * - Persiste pergunta e resposta
 * @param {string} userNumber WhatsApp number ex: 555499...@c.us
 * @param {string|Buffer|{type:'Buffer',data:number[]}} rawText
 * @returns {Promise<string>} resposta gerada
 */
async function run(userNumber, rawText) {
  const text = typeof rawText === 'string' ? rawText : (rawText?.type === 'Buffer' ? Buffer.from(rawText.data).toString('utf-8') : String(rawText ?? ''));

  // Garante que o cliente existe primeiro
  const cliente = await clientsRepo.getOrCreate(userNumber);
  
  // Depois busca o histórico
  const historico = await historyRepo.getRecent(userNumber, 50);

  // Intercepta comandos de menu antes da IA
  const menuResponse = await MenuInterceptor.process(userNumber, text, historico);
  
  let resposta;
  
  if (menuResponse) {
    // Se o interceptor gerou uma resposta, usa ela
    resposta = menuResponse;
    logger.info('Resposta gerada pelo MenuInterceptor', { userNumber, hasResponse: !!menuResponse });
  } else {
    // Caso contrário, processa normalmente pela IA
    resposta = await handleMessage(historico, text, cliente?.id || null);
    logger.info('Resposta gerada pela IA', { userNumber, hasResponse: !!resposta });
  }

  // Persiste pergunta e resposta (não bloquear resposta ao usuário)
  setImmediate(async () => {
    try {
      await Promise.allSettled([
        historyRepo.append(cliente.id, 'user', text),
        historyRepo.append(cliente.id, 'assistant', resposta),
      ]);
    } catch (err) {
      logger.error('Falha ao persistir histórico (assíncrono)', { error: err.message, userNumber });
    }
  });

  return resposta;
}

module.exports = { run };
