require('dotenv').config();
const logger = require('../logger');
const geminiProvider = require('../providers/geminiProvider');

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * Extrai números úteis do texto para reforçar entidades (regex-based)
 */
function extractNumericEntities(text) {
  const onlyDigits = (s) => (s || '').replace(/\D/g, '');
  const cnpjMatch = text.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{14}\b/);
  const nfMatch = text.match(/\b\d{4,10}\b/);
  const cnpj = cnpjMatch ? onlyDigits(cnpjMatch[0]) : null;
  const nf = nfMatch ? onlyDigits(nfMatch[0]) : null;
  return { cnpj, nf };
}

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (_) {
    // tenta achar bloco de código JSON
    const match = str.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (__) {}
    }
    return null;
  }
}

/**
 * Classifica a intenção do usuário e extrai entidades relevantes.
 * Retorna objeto com formato:
 * { intent ∈ {"rastreamento","rh","fornecedores","cotacao","coleta","atendente","none"},
 *   entities: { cnpj, nf }, rh_action, fornecedores_action }
*/
async function classificar(message) {
  const texto = String(message || '').trim();
  const fallbackEntities = extractNumericEntities(texto);

  if (!GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY ausente, retornando classificação básica por regex');
    // Heurística mínima quando IA indisponível
    const lower = texto.toLowerCase();
    const intent =
      (lower.includes('cotacao') || lower.includes('cotação') || lower.includes('orcamento') || lower.includes('orçamento') || lower.includes('preco') || lower.includes('preço'))
        ? 'cotacao'
        : (lower.includes('coleta') || lower.includes('agendar coleta') || lower.includes('retirada'))
        ? 'coleta'
        : (lower.includes('atendente') || lower.includes('falar com atendente') || lower.includes('humano') || lower.includes('suporte') || lower.includes('atendimento'))
        ? 'atendente'
        : (fallbackEntities.cnpj || lower.includes('nota fiscal') || lower.includes('encomenda') || lower.includes('rastreio'))
        ? 'rastreamento'
        : (lower.includes('curriculo') || lower.includes('currículo') || lower.includes('vagas') || lower.includes('rh'))
        ? 'rh'
        : (lower.includes('fornecedor') || lower.includes('fornecedores') || lower.includes('compras') || lower.includes('suprimentos'))
        ? 'fornecedores'
        : 'none';
    const rh_action = lower.includes('vaga') || lower.includes('vagas') ? 'ver_vagas' : (lower.includes('curriculo') || lower.includes('currículo')) ? 'enviar_curriculo' : null;
    const fornecedores_action = (lower.includes('cadastrar') || lower.includes('cadastro') || lower.includes('registrar')) ? 'cadastrar' : null;
    return { intent, entities: fallbackEntities, rh_action, fornecedores_action };
  }

  // Heurística de segurança para evitar má classificação óbvia
  const lower = texto.toLowerCase();
  const rhHints = ['curriculo','currículo','cv','vagas','vaga','emprego','trabalho','carreira','rh','recursos humanos'];
  const rastHints = ['rastreio','rastrear','mercadoria','encomenda','pedido','nota fiscal','nf','cnpj','status','onde está'];
  const fornHints = ['fornecedor','fornecedores','compras','suprimentos','cadastro fornecedor','portfólio','portfolio','cnpj fornecedor'];
  const cotaHints = ['cotacao','cotação','orcamento','orçamento','preco','preço','cotar'];
  const coletaHints = ['coleta','agendar coleta','retirada'];
  const atendHints = ['atendente','falar com atendente','humano','suporte','atendimento'];

  try {
    const messages = [
      {
        role: 'system',
        content:
          'Você é um classificador de intenções para WhatsApp da transportadora. Sempre responda APENAS um JSON. Campos: intent ∈ {"rastreamento","rh","fornecedores","cotacao","coleta","atendente","none"}; entities: { cnpj (14 dígitos ou null), nf (apenas números 4-10 dígitos ou null) }; rh_action ∈ {"enviar_curriculo","ver_vagas",null}; fornecedores_action ∈ {"cadastrar",null}. Não explique, não inclua texto fora do JSON. Exemplos:\n\n' +
          'Usuário: "Preciso saber onde está meu pedido"\n' +
          '{"intent":"rastreamento","entities":{"cnpj":null,"nf":null},"rh_action":null}\n\n' +
          'Usuário: "Pode verificar o status? CNPJ 12345678000195 NF 123456"\n' +
          '{"intent":"rastreamento","entities":{"cnpj":"12345678000195","nf":"123456"},"rh_action":null}\n\n' +
          'Usuário: "Quero enviar meu currículo"\n' +
          '{"intent":"rh","entities":{"cnpj":null,"nf":null},"rh_action":"enviar_curriculo"}\n\n' +
          'Usuário: "Quais vagas estão abertas?"\n' +
          '{"intent":"rh","entities":{"cnpj":null,"nf":null},"rh_action":"ver_vagas"}\n\n' +
          'Usuário: "Preciso de uma cotação"\n' +
          '{"intent":"cotacao","entities":{"cnpj":null,"nf":null},"rh_action":null}\n\n' +
          'Usuário: "Quero agendar uma coleta"\n' +
          '{"intent":"coleta","entities":{"cnpj":null,"nf":null},"rh_action":null}\n\n' +
          'Usuário: "Quero falar com atendente"\n' +
          '{"intent":"atendente","entities":{"cnpj":null,"nf":null},"rh_action":null}'
      },
      {
        role: 'user',
        content: texto
      }
    ];

    const content = await geminiProvider.generate(messages, {
      apiKey: GEMINI_API_KEY,
      model: MODEL,
      temperature: 0.0,
      maxTokens: 200,
      timeoutMs: 8000
    });

    const parsed = safeJsonParse(String(content || '')) || {};
    let intent = parsed.intent || 'none';
    let rh_action = parsed.rh_action || null;
    let fornecedores_action = parsed.fornecedores_action || null;
    let cnpj = parsed?.entities?.cnpj || null;
    let nf = parsed?.entities?.nf || null;

    // Normaliza entidades para dígitos
    const onlyDigits = (s) => (s || '').replace(/\D/g, '');
    cnpj = cnpj ? onlyDigits(cnpj) : null;
    nf = nf ? onlyDigits(nf) : null;

    // Reforça com regex se faltou
    if (!cnpj || cnpj.length !== 14) cnpj = fallbackEntities.cnpj || null;
    if (!nf) nf = fallbackEntities.nf || null;

    // Heurísticas guard rail
    // Se texto sinaliza RH fortemente, força RH
    if (rhHints.some(k => lower.includes(k)) && intent !== 'rh') {
      intent = 'rh';
      if (!rh_action) {
        rh_action = lower.includes('vaga') || lower.includes('vagas') ? 'ver_vagas'
          : (lower.includes('curriculo') || lower.includes('currículo') || lower.includes('cv')) ? 'enviar_curriculo' : null;
      }
    }
    // Se texto indica rastreamento fortemente, assegura rastreamento
    if (rastHints.some(k => lower.includes(k)) && intent !== 'rastreamento') {
      intent = 'rastreamento';
    }
    // Se texto indica fornecedores, assegura fornecedores
    if (fornHints.some(k => lower.includes(k)) && intent !== 'fornecedores') {
      intent = 'fornecedores';
      if (!fornecedores_action) {
        fornecedores_action = (lower.includes('cadastrar') || lower.includes('cadastro') || lower.includes('registrar')) ? 'cadastrar' : null;
      }
    }
    // Se texto indica cotação, assegura cotacao
    if (cotaHints.some(k => lower.includes(k)) && intent !== 'cotacao') {
      intent = 'cotacao';
    }
    // Se texto indica coleta, assegura coleta
    if (coletaHints.some(k => lower.includes(k)) && intent !== 'coleta') {
      intent = 'coleta';
    }
    // Se texto indica atendimento humano, assegura atendente
    if (atendHints.some(k => lower.includes(k)) && intent !== 'atendente') {
      intent = 'atendente';
    }

    return { intent, entities: { cnpj, nf }, rh_action, fornecedores_action };

  } catch (error) {
    logger.error('Falha na classificação por IA', { error: error.message });
    // Fallback robusto: aplica heurísticas locais mesmo sem IA
    let intent = 'none';
    let rh_action = null;
    let fornecedores_action = null;
    if (cotaHints.some(k => lower.includes(k))) {
      intent = 'cotacao';
    } else if (coletaHints.some(k => lower.includes(k))) {
      intent = 'coleta';
    } else if (atendHints.some(k => lower.includes(k))) {
      intent = 'atendente';
    } else if (rhHints.some(k => lower.includes(k))) {
      intent = 'rh';
      rh_action = lower.includes('vaga') || lower.includes('vagas') ? 'ver_vagas'
        : (lower.includes('curriculo') || lower.includes('currículo') || lower.includes('cv')) ? 'enviar_curriculo' : null;
    } else if (rastHints.some(k => lower.includes(k))) {
      intent = 'rastreamento';
    } else if (fornHints.some(k => lower.includes(k))) {
      intent = 'fornecedores';
      fornecedores_action = (lower.includes('cadastrar') || lower.includes('cadastro') || lower.includes('registrar')) ? 'cadastrar' : null;
    }
    return { intent, entities: fallbackEntities, rh_action, fornecedores_action };
  }
}

module.exports = { classificar };