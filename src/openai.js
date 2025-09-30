require('dotenv').config();
const logger = require('./logger');
const { treinamento } = require('./treinamento');
const { pluginSystem } = require('./pluginSystem');
const geminiProvider = require('./providers/geminiProvider');
const cache = require('./core/cache');
const retry = require('./core/retry');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MAX_RETRIES = parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10);
const INITIAL_TIMEOUT = parseInt(process.env.OPENAI_INITIAL_TIMEOUT || '8000', 10);
const MAX_TIMEOUT = parseInt(process.env.OPENAI_MAX_TIMEOUT || '30000', 10);

// Configuração simplificada usando apenas variáveis de ambiente
const DEFAULT_MODEL = 'gemini-2.0-flash-exp';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 800;
const DEFAULT_MAX_HISTORY = 10;

function generateCacheKey(historico, userMessage) {
    const histLen = Array.isArray(historico) ? historico.length : (Array.isArray(historico?.messages) ? historico.messages.length : 0);
    return `${userMessage}-${histLen}-orbit`;
}

function limparMensagem(mensagem) {
    if (typeof mensagem === 'string') return mensagem;
    if (mensagem && typeof mensagem === 'object' && mensagem.type === 'Buffer') {
        return Buffer.from(mensagem.data).toString('utf-8');
    }
    return '';
}

// Função principal para processar mensagens com sistema modular
async function handleMessage(historico, userMessage, userId = null) {
    if (!GEMINI_API_KEY) {
        logger.error('GEMINI_API_KEY não definida no ambiente (.env)');
        throw new Error('Configuração inválida: defina GEMINI_API_KEY no .env');
    }

    try {
        // Executa hooks antes do processamento
        const preProcessData = await pluginSystem.executeHook('beforeMessage', {
            message: userMessage,
            historico,
            userId
        });

        // Verifica se há resposta automática
        if (preProcessData.autoResponse) {
            logger.info('Resposta automática detectada', { response: preProcessData.autoResponse });
            return preProcessData.autoResponse;
        }

        // Gera chave de cache simplificada
        const cacheKey = generateCacheKey(historico, userMessage);
        const cached = cache.get(cacheKey);
        if (cached) {
            logger.api('Resposta encontrada no cache');
            return cached;
        }

        const responseContent = await retry.execute(async (attempt) => {
                // Configurações do modelo usando variáveis de ambiente ou padrões
                const modelName = process.env.GEMINI_MODEL || DEFAULT_MODEL;
                const temperature = process.env.GEMINI_TEMPERATURE ? parseFloat(process.env.GEMINI_TEMPERATURE) : DEFAULT_TEMPERATURE;
const maxTokens = process.env.GEMINI_MAX_TOKENS ? parseInt(process.env.GEMINI_MAX_TOKENS, 10) : DEFAULT_MAX_TOKENS;

                const attemptTimeout = Math.min(INITIAL_TIMEOUT * Math.pow(2, attempt), MAX_TIMEOUT);

                logger.api(`Tentativa ${attempt + 1} de ${MAX_RETRIES}`, {
                    model: modelName,
                    timeoutMs: attemptTimeout
                });
                
                // Limita histórico baseado na configuração
                const maxHistory = process.env.OPENAI_MAX_HISTORY ? parseInt(process.env.OPENAI_MAX_HISTORY, 10) : DEFAULT_MAX_HISTORY;
                const fullMessages = (historico?.messages || []);
                const limitedHistory = fullMessages.slice(-maxHistory);
                const olderHistory = fullMessages.slice(0, Math.max(0, fullMessages.length - maxHistory));
                const summaryBlock = olderHistory.length ? summarizeHistory(olderHistory) : null;
                
                const messages = [
                    { role: 'system', content: treinamento },
                    ...(summaryBlock ? [{ role: 'system', content: summaryBlock }] : []),
                    ...limitedHistory.map(item => ({
                        role: item.role,
                        content: limparMensagem(item.mensagem)
                    })).filter(item => item.content),
                    { role: 'user', content: userMessage }
                ];

                logger.api('Enviando requisição para API Gemini', {
                    historico_length: limitedHistory.length,
                    message_length: userMessage.length,
                    model: modelName
                });

                const content = await geminiProvider.generate(messages, {
                    apiKey: GEMINI_API_KEY,
                    model: modelName,
                    temperature,
                    maxTokens,
                    timeoutMs: attemptTimeout
                });

                logger.api('Resposta recebida da API Gemini', {
                    status: 'ok',
                    has_content: !!content
                });

                // Executa hooks após o processamento
                const postProcessData = await pluginSystem.executeHook('afterMessage', {
                    message: userMessage,
                    response: content,
                    historico,
                    userId,
                    sentiment: preProcessData.sentiment,
                    sentimentScore: preProcessData.sentimentScore
                });

                // Salva em cache
                cache.set(cacheKey, postProcessData.response);

                // Executa hook de mensagem processada
                await pluginSystem.executeHook('messageProcessed', {
                    userId,
                    message: userMessage,
                    response: postProcessData.response,
                    timestamp: new Date()
                });

                return postProcessData.response;
        }, {
            retries: MAX_RETRIES,
            baseDelayMs: 800,
            factor: 2,
            shouldRetry: (error, attempt) => {
                // Retry somente em timeout/ECONNRESET/5xx e 429 (rate limiting)
                const status = error?.response?.status;
                const code = error?.code;
                
                // Para erro 429, usar backoff mais agressivo
                if (status === 429) {
                    logger.api('Rate limit detectado, aguardando mais tempo', {
                        attempt: attempt + 1,
                        nextDelayMs: Math.pow(2, attempt + 1) * 2000 // Backoff mais agressivo para 429
                    });
                    return true;
                }
                
                if (status && status >= 500) return true;
                if (code === 'ECONNRESET' || code === 'ECONNABORTED' || code === 'ETIMEDOUT') return true;
                // Axios timeout
                if (error?.message && /timeout/i.test(error.message)) return true;
                return false;
            },
            onError: (error, attempt) => {
                const status = error?.response?.status;
                
                // Log específico para rate limiting
                if (status === 429) {
                    logger.error(`Rate limit atingido - tentativa ${attempt + 1}`, {
                        message: error.message,
                        status: status,
                        data: error.response?.data,
                        code: error.code,
                        nextRetryIn: `${Math.pow(2, attempt + 1) * 2}s`
                    });
                } else {
                    logger.error(`Erro na tentativa ${attempt + 1}`, {
                        message: error.message,
                        status: error.response?.status,
                        data: error.response?.data,
                        code: error.code
                    });
                }
            }
        });

        return responseContent;
    } catch (error) {
        // Fallback quando todas as tentativas falharam
        logger.error('Todas as tentativas de API falharam, usando resposta de fallback', {
            error: error.message,
            userId,
            message: userMessage
        });
        
        // Resposta de fallback baseada no tipo de erro
        const status = error?.response?.status;
        let fallbackMessage;
        
        if (status === 429) {
            fallbackMessage = "🤖 Desculpe, estou com muitas solicitações no momento. Tente novamente em alguns minutos, por favor.";
        } else if (status >= 500) {
            fallbackMessage = "🤖 Estou com problemas técnicos temporários. Tente novamente em alguns instantes.";
        } else {
            fallbackMessage = "🤖 Não consegui processar sua mensagem no momento. Tente reformular ou aguarde um pouco.";
        }
        
        // Log do fallback para monitoramento
        logger.api('Resposta de fallback enviada', {
            status: 'fallback',
            originalError: error.message,
            fallbackMessage
        });
        
        return fallbackMessage;
    }
}

// Gera um resumo simples local dos itens antigos do histórico sem chamar API externa
function summarizeHistory(items) {
    try {
        const parts = items.map(it => `${it.role === 'user' ? 'U' : 'A'}: ${limparMensagem(it.mensagem)}`)
            .filter(Boolean);
        // Heurística: corta em ~800 chars e remove redundâncias simples
        let joined = parts.join('\n');
        joined = joined.replace(/\s+/g, ' ').trim();
        if (joined.length > 800) joined = joined.slice(-800);
        return `Contexto resumido (anteriores): ${joined}`;
    } catch (e) {
        return null;
    }
}

// Função para processar mensagem com middleware
async function processMessageWithMiddleware(message, next) {
    return await pluginSystem.executeMiddleware(message, next);
}

// Função para obter estatísticas do sistema
function getSystemStats() {
    const pluginStats = pluginSystem.getStats();
    const cacheStats = cache.stats();

    return {
        plugins: pluginStats,
        cache: cacheStats
    };
}

// Função para limpar cache
function clearCache() {
    return cache.clear();
}

module.exports = { 
    handleMessage,
    processMessageWithMiddleware,
    getSystemStats,
    clearCache
};