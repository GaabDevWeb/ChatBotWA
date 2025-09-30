const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Provider responsável por chamar a API oficial do Google Gemini
 * @param {Array<{role: 'system'|'user'|'assistant', content: string}>} messages
 * @param {{
 *   apiKey: string,
 *   model: string,
 *   temperature?: number,
 *   maxTokens?: number,
 *   timeoutMs?: number,
 * }} options
 * @returns {Promise<string>} Conteúdo da resposta do assistente
 */
async function generate(messages, options) {
  const {
    apiKey,
    model = 'gemini-2.0-flash-exp',
    temperature = 0.7,
    maxTokens = 800,
    timeoutMs = 15000,
  } = options;

  if (!apiKey) throw new Error('GEMINI_API_KEY ausente');

  // Inicializa o cliente Gemini
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ 
    model,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    }
  });

  // Converte mensagens para o formato do Gemini
  // O Gemini usa um formato diferente: combina system + user messages
  let systemPrompt = '';
  const conversationHistory = [];

  for (const message of messages) {
    if (message.role === 'system') {
      systemPrompt += message.content + '\n';
    } else if (message.role === 'user') {
      conversationHistory.push({
        role: 'user',
        parts: [{ text: message.content }]
      });
    } else if (message.role === 'assistant') {
      conversationHistory.push({
        role: 'model',
        parts: [{ text: message.content }]
      });
    }
  }

  // Prepara o prompt final
  const lastUserMessage = conversationHistory[conversationHistory.length - 1];
  const historyWithoutLast = conversationHistory.slice(0, -1);
  
  // Combina system prompt com a mensagem do usuário
  const finalPrompt = systemPrompt ? 
    `${systemPrompt.trim()}\n\n${lastUserMessage.parts[0].text}` : 
    lastUserMessage.parts[0].text;

  try {
    // Cria uma sessão de chat se houver histórico
    if (historyWithoutLast.length > 0) {
      const chat = geminiModel.startChat({
        history: historyWithoutLast
      });
      
      // Implementa timeout manual
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
      });

      const responsePromise = chat.sendMessage(finalPrompt);
      const result = await Promise.race([responsePromise, timeoutPromise]);
      
      const response = await result.response;
      const content = response.text();
      
      if (!content) throw new Error('Resposta da API inválida');
      return content;
    } else {
      // Sem histórico, usa generateContent diretamente
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
      });

      const responsePromise = geminiModel.generateContent(finalPrompt);
      const result = await Promise.race([responsePromise, timeoutPromise]);
      
      const response = await result.response;
      const content = response.text();
      
      if (!content) throw new Error('Resposta da API inválida');
      return content;
    }
  } catch (error) {
    // Trata erros específicos do Gemini
    if (error.message?.includes('SAFETY')) {
      throw new Error('Conteúdo bloqueado por filtros de segurança');
    }
    if (error.message?.includes('QUOTA_EXCEEDED')) {
      throw new Error('Cota da API excedida');
    }
    if (error.message?.includes('timeout')) {
      throw new Error('Timeout na requisição');
    }
    
    // Re-lança outros erros
    throw error;
  }
}

module.exports = { generate };