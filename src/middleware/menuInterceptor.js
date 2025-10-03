const logger = require('../logger');
const { classificar } = require('../services/intentClassifier');

class MenuInterceptor {
    constructor() {
        // Estados dos usuários (em produção, usar Redis ou banco)
        this.userStates = new Map();
        
        // Modo compatibilidade: ainda guarda keywords, mas prioridade será IA
        this.keywords = {
            rastreamento: [
                'rastreio', 'rastrear', 'mercadoria', 'encomenda', 'pedido',
                'nota fiscal', 'nf', 'cnpj', 'status', 'onde está',
                '📦', '1'
            ],
            rh: [
                'rh', 'recursos humanos', 'curriculo', 'currículo', 'cv',
                'vagas', 'emprego', 'trabalho', 'vaga', 'carreira',
                'oportunidade', 'contratação', 'seleção', 'recrutamento',
                '👥', '2'
            ],
            fornecedores: [
                'fornecedor', 'fornecedores', 'compras', 'suprimentos',
                'cadastro fornecedor', 'cadastro de fornecedor', 'cadastrar fornecedor',
                'portfólio', 'portfolio'
            ]
        };

        // Toggle: permite desativar o fallback por palavra‑chave via env
        // ENABLE_KEYWORD_FALLBACK=true|false (default: true)
        const flag = (process.env.ENABLE_KEYWORD_FALLBACK || 'true').toLowerCase();
        this.enableKeywordFallback = flag === 'true';
        
        // Timeout para limpar estados ociosos (15 minutos)
        this.stateTimeout = 15 * 60 * 1000;
        this.startCleanupTimer();
    }

    /**
     * Processa mensagem e decide se intercepta ou passa para IA
     * @param {string} userNumber - Número do usuário
     * @param {string} message - Mensagem recebida
     * @returns {Promise<string|null>} - Resposta ou null se deve passar para IA
     */
    async process(userNumber, message) {
        try {
            const normalizedMessage = message.toLowerCase().trim();
            const userState = this.getUserState(userNumber);

            // Se usuário está em um fluxo ativo, continua o fluxo
            if (userState.currentFlow) {
                return await this.continueFlow(userNumber, normalizedMessage, userState);
            }

            // Classificador de intenção por IA (sem palavras-chave)
            try {
                const resultado = await classificar(normalizedMessage);
                if (resultado && resultado.intent && resultado.intent !== 'none') {
                    if (resultado.intent === 'rastreamento') {
                        return await this.startRastreamentoFlow(userNumber, resultado.entities);
                    }
                    if (resultado.intent === 'rh') {
                        return await this.startRHFlow(userNumber, resultado.rh_action);
                    }
                    if (resultado.intent === 'fornecedores') {
                        return await this.startFornecedoresFlow(userNumber, resultado.fornecedores_action);
                    }
                }
            } catch (clsErr) {
                logger.error('Erro no classificador de intenção', { error: clsErr.message });
            }

            // Fallback: keywords (compatibilidade) — controlado por flag
            if (this.enableKeywordFallback && this.detectRastreamento(normalizedMessage)) {
                logger.info('Fallback por palavra‑chave ativou rastreamento');
                return await this.startRastreamentoFlow(userNumber);
            }
            if (this.enableKeywordFallback && this.detectRH(normalizedMessage)) {
                logger.info('Fallback por palavra‑chave ativou RH');
                return await this.startRHFlow(userNumber);
            }
            if (this.enableKeywordFallback && this.detectFornecedores(normalizedMessage)) {
                logger.info('Fallback por palavra‑chave ativou Fornecedores');
                return await this.startFornecedoresFlow(userNumber);
            }

            // Não interceptou, passa para IA
            return null;

        } catch (error) {
            logger.error('Erro no MenuInterceptor', { 
                error: error.message, 
                userNumber,
                message: message.substring(0, 100) 
            });
            return null; // Em caso de erro, passa para IA
        }
    }

    /**
     * Detecta se mensagem indica intenção de rastreamento
     */
    detectRastreamento(message) {
        return this.keywords.rastreamento.some(keyword => 
            message.includes(keyword)
        );
    }

    /**
     * Detecta intenção de RH
     */
    detectRH(message) {
        return this.keywords.rh.some(keyword => 
            message.includes(keyword)
        );
    }

    /**
     * Detecta intenção de Fornecedores
     */
    detectFornecedores(message) {
        return this.keywords.fornecedores.some(keyword =>
            message.includes(keyword)
        );
    }

    /**
     * Inicia fluxo de rastreamento
     */
    async startRastreamentoFlow(userNumber, entities) {
        const userState = this.getUserState(userNumber);
        userState.currentFlow = 'rastreamento';
        userState.step = 'cnpj';
        userState.data = {};
        userState.lastActivity = Date.now();

        logger.info('Iniciando fluxo de rastreamento', { userNumber });

        // Se IA já extraiu CNPJ/NF, preencher e pular etapas conforme possível
        const cnpj = entities?.cnpj || null;
        const nf = entities?.nf || null;
        if (cnpj && cnpj.length === 14) {
            userState.data.cnpj = cnpj;
            userState.step = nf ? 'nf' : 'nf';
            if (nf) {
                userState.data.nf = nf;
                logger.info('Entidades de rastreamento extraídas pela IA', { userNumber, cnpj: cnpj.substring(0,8)+'****', nf });
                return await this.executeRastreamento(userNumber, userState);
            }
            logger.info('CNPJ extraído pela IA, solicitando NF', { userNumber });
            return `✅ **CNPJ detectado automaticamente**

Agora, informe o **número da Nota Fiscal**:

💡 *Exemplo: 123456*`;
        }

        return `📦 **RASTREAMENTO DE MERCADORIA**

Para consultar o status da sua mercadoria, preciso de algumas informações:

Por favor, informe o **CNPJ** (somente números, sem pontos ou traços):

💡 *Exemplo: 12345678000195*`;
    }

    /**
     * Inicia fluxo de RH
     */
    async startRHFlow(userNumber, rhAction) {
        const userState = this.getUserState(userNumber);
        userState.currentFlow = 'rh';
        userState.step = 'menu';
        userState.data = {};
        userState.lastActivity = Date.now();

        logger.info('Iniciando fluxo de RH', { userNumber });

        // Se IA sugeriu ação, redireciona diretamente
        if (rhAction === 'ver_vagas') {
            this.clearUserState(userNumber);
            return await this.listarVagasAbertas();
        }
        if (rhAction === 'enviar_curriculo') {
            userState.step = 'curriculo_lgpd';
            return `📄 **ENVIO DE CURRÍCULO**

⚖️ **AVISO LGPD - Lei Geral de Proteção de Dados**

Para processar seu currículo, precisamos coletar e armazenar seus dados pessoais (nome, contato, experiências profissionais).

**Você concorda com o processamento dos seus dados pessoais?**

✅ Digite "SIM" para concordar
❌ Digite "NÃO" para cancelar`;
        }

        return `👥 **RECURSOS HUMANOS**

Bem-vindo ao nosso portal de RH! Como posso ajudá-lo hoje?

**Opções disponíveis:**
1️⃣ Enviar currículo
2️⃣ Ver vagas abertas

            Digite o número da opção desejada ou a palavra-chave:`;
    }

    /**
     * Inicia fluxo de cadastro de fornecedores
     */
    async startFornecedoresFlow(userNumber, fornecedoresAction) {
        const userState = this.getUserState(userNumber);
        userState.currentFlow = 'fornecedores';
        userState.step = 'razao_social';
        userState.data = {};
        userState.lastActivity = Date.now();

        logger.info('Iniciando fluxo de Fornecedores', { userNumber });

        return `🧾 **CADASTRO DE FORNECEDOR**

Vamos registrar seu fornecedor no nosso banco. Alguns dados são opcionais.

Primeiro, informe a **Razão Social** do fornecedor:`;
    }

    /**
     * Continua fluxo ativo baseado no estado atual
     */
    async continueFlow(userNumber, message, userState) {
        userState.lastActivity = Date.now();

        if (userState.currentFlow === 'rastreamento') {
            return await this.handleRastreamentoFlow(userNumber, message, userState);
        }

        if (userState.currentFlow === 'rh') {
            return await this.handleRHFlow(userNumber, message, userState);
        }
        if (userState.currentFlow === 'fornecedores') {
            return await this.handleFornecedoresFlow(userNumber, message, userState);
        }

        return null;
    }

    /**
     * Gerencia fluxo de rastreamento
     */
    async handleRastreamentoFlow(userNumber, message, userState) {
        switch (userState.step) {
            case 'cnpj':
                return await this.handleCnpjStep(userNumber, message, userState);
            
            case 'nf':
                return await this.handleNfStep(userNumber, message, userState);
            
            default:
                this.clearUserState(userNumber);
                return null;
        }
    }

    /**
     * Gerencia fluxo de RH baseado no passo atual
     */
    async handleRHFlow(userNumber, message, userState) {
        switch (userState.step) {
            case 'menu':
                return await this.handleRHMenuStep(userNumber, message, userState);
            
            case 'curriculo_lgpd':
                return await this.handleCurriculoLGPDStep(userNumber, message, userState);
            
            case 'curriculo_dados':
                return await this.handleCurriculoDadosStep(userNumber, message, userState);
            
            default:
                this.clearUserState(userNumber);
                return null;
        }
    }

    /**
     * Gerencia fluxo de Fornecedores baseado no passo atual
     */
    async handleFornecedoresFlow(userNumber, message, userState) {
        switch (userState.step) {
            case 'razao_social':
                return await this.handleFornecedorRazaoSocialStep(userNumber, message, userState);
            case 'cnpj':
                return await this.handleFornecedorCnpjStep(userNumber, message, userState);
            case 'categoria':
                return await this.handleFornecedorCategoriaStep(userNumber, message, userState);
            case 'portfolio_url':
                return await this.handleFornecedorPortfolioStep(userNumber, message, userState);
            case 'site_link':
                return await this.handleFornecedorSiteStep(userNumber, message, userState);
            case 'cidades_atendidas':
                return await this.handleFornecedorCidadesStep(userNumber, message, userState);
            case 'contato':
                return await this.handleFornecedorContatoStep(userNumber, message, userState);
            case 'confirmar':
                return await this.handleFornecedorConfirmarStep(userNumber, message, userState);
            default:
                this.clearUserState(userNumber);
                return null;
        }
    }

    /**
     * Coleta razão social (obrigatória)
     */
    async handleFornecedorRazaoSocialStep(userNumber, message, userState) {
        const razao = message.trim();
        if (!razao || razao.length < 2) {
            return `❌ **Razão Social inválida**

Por favor, informe a **Razão Social** completa do fornecedor:`;
        }
        userState.data.razao_social = razao;
        userState.step = 'cnpj';
        return `✅ **Razão Social registrada**

Informe o **CNPJ** (14 dígitos) ou digite "pular" se não tiver:`;
    }

    /**
     * Coleta CNPJ (opcional)
     */
    async handleFornecedorCnpjStep(userNumber, message, userState) {
        const normalized = message.toLowerCase().trim();
        if (normalized === 'pular') {
            userState.data.cnpj = null;
            userState.step = 'categoria';
            return `📂 **Categoria** (opcional)

Ex: Materiais de embalagem, Serviços de TI, Marketing...
Digite a categoria ou "pular":`;
        }

        const cnpj = message.replace(/\D/g, '');
        if (cnpj.length !== 14) {
            return `❌ **CNPJ inválido**

O CNPJ deve ter exatamente 14 números.

Informe o CNPJ correto ou digite "pular":`;
        }

        userState.data.cnpj = cnpj;
        userState.step = 'categoria';
        return `✅ **CNPJ registrado**

📂 **Categoria** (opcional)
Digite a categoria ou "pular":`;
    }

    /**
     * Coleta Categoria (opcional)
     */
    async handleFornecedorCategoriaStep(userNumber, message, userState) {
        const normalized = message.toLowerCase().trim();
        if (normalized !== 'pular') {
            userState.data.categoria = message.trim();
        }
        userState.step = 'portfolio_url';
        return `🌐 **Portfólio/Apresentação** (opcional)

Envie um link de portfólio/apresentação ou digite "pular":`;
    }

    /**
     * Coleta Portfolio URL (opcional)
     */
    async handleFornecedorPortfolioStep(userNumber, message, userState) {
        const normalized = message.toLowerCase().trim();
        if (normalized !== 'pular') {
            userState.data.portfolio_url = message.trim();
        }
        userState.step = 'site_link';
        return `🔗 **Site do fornecedor** (opcional)

Envie o link do site oficial ou digite "pular":`;
    }

    /**
     * Coleta Site Link (opcional)
     */
    async handleFornecedorSiteStep(userNumber, message, userState) {
        const normalized = message.toLowerCase().trim();
        if (normalized !== 'pular') {
            userState.data.site_link = message.trim();
        }
        userState.step = 'cidades_atendidas';
        return `🗺️ **Cidades atendidas** (opcional)

Liste cidades separadas por vírgula (Ex: São Paulo, Guarulhos) ou digite "pular":`;
    }

    /**
     * Coleta Cidades Atendidas (opcional)
     */
    async handleFornecedorCidadesStep(userNumber, message, userState) {
        const normalized = message.toLowerCase().trim();
        if (normalized !== 'pular') {
            userState.data.cidades_atendidas = message.trim();
        }
        userState.step = 'contato';
        return `📞 **Contato** (opcional)

Informe pessoa de contato/telefone/email ou digite "pular":`;
    }

    /**
     * Coleta Contato (opcional)
     */
    async handleFornecedorContatoStep(userNumber, message, userState) {
        const normalized = message.toLowerCase().trim();
        if (normalized !== 'pular') {
            userState.data.contato = message.trim();
        }
        userState.step = 'confirmar';

        const resumo = [
            `Razão Social: ${userState.data.razao_social}`,
            `CNPJ: ${userState.data.cnpj || '—'}`,
            `Categoria: ${userState.data.categoria || '—'}`,
            `Portfólio: ${userState.data.portfolio_url || '—'}`,
            `Site: ${userState.data.site_link || '—'}`,
            `Cidades: ${userState.data.cidades_atendidas || '—'}`,
            `Contato: ${userState.data.contato || '—'}`
        ].join('\n');

        return `🧾 **Confirmação do cadastro**

${resumo}

✅ Digite "SIM" para salvar
✏️ Digite "EDITAR" para reiniciar
❌ Digite "CANCELAR" para abortar`;
    }

    /**
     * Confirma e salva fornecedor
     */
    async handleFornecedorConfirmarStep(userNumber, message, userState) {
        const normalized = message.toLowerCase().trim();
        if (['cancelar','não','nao','n'].includes(normalized)) {
            this.clearUserState(userNumber);
            return `❌ **Cadastro cancelado**

Nenhum dado foi salvo.

🏠 *Digite "menu" para voltar ao início*`;
        }
        if (['editar','reiniciar'].includes(normalized)) {
            userState.data = {};
            userState.step = 'razao_social';
            return `✏️ **Vamos começar novamente**

Informe a **Razão Social** do fornecedor:`;
        }
        if (!['sim','s','ok','confirmar'].includes(normalized)) {
            return `⚠️ **Confirmação necessária**

✅ Digite "SIM" para salvar
✏️ Digite "EDITAR" para reiniciar
❌ Digite "CANCELAR" para abortar`;
        }

        try {
            const { salvarFornecedor } = require('../services/fornecedoresService');
            const salvo = await salvarFornecedor(userNumber, userState.data);
            const protocolo = salvo?.protocolo || 'FOR-XXXXXX';

            this.clearUserState(userNumber);

            return `✅ **FORNECEDOR CADASTRADO COM SUCESSO!**

📋 **Protocolo:** ${protocolo}

Use este protocolo para futuras consultas.

🧾 *Para cadastrar outro fornecedor, digite "fornecedor"*`;
        } catch (error) {
            logger.error('Erro ao salvar fornecedor', { error: error.message, userNumber });
            this.clearUserState(userNumber);
            return `❌ **Erro ao salvar fornecedor**

Tente novamente mais tarde ou fale com um atendente.`;
        }
    }

    /**
     * Processa entrada do CNPJ
     */
    async handleCnpjStep(userNumber, message, userState) {
        // Remove caracteres não numéricos
        const cnpj = message.replace(/\D/g, '');

        // Valida CNPJ (14 dígitos)
        if (cnpj.length !== 14) {
            return `❌ **CNPJ inválido**

O CNPJ deve ter exatamente 14 números.

Por favor, informe o CNPJ correto (somente números):
💡 *Exemplo: 12345678000195*`;
        }

        // Armazena CNPJ e avança para próximo passo
        userState.data.cnpj = cnpj;
        userState.step = 'nf';

        logger.info('CNPJ coletado', { userNumber, cnpj: cnpj.substring(0, 8) + '****' });

        return `✅ **CNPJ registrado**

Agora, informe o **número da Nota Fiscal**:

💡 *Exemplo: 123456*`;
    }

    /**
     * Processa entrada da Nota Fiscal
     */
    async handleNfStep(userNumber, message, userState) {
        // Remove caracteres não numéricos
        const nf = message.replace(/\D/g, '');

        // Valida NF (até 10 dígitos)
        if (!nf || nf.length > 10) {
            return `❌ **Nota Fiscal inválida**

A Nota Fiscal deve conter apenas números (até 10 dígitos).

Por favor, informe o número correto da Nota Fiscal:`;
        }

        // Armazena NF
        userState.data.nf = nf;

        logger.info('Dados coletados para rastreamento', { 
            userNumber, 
            cnpj: userState.data.cnpj.substring(0, 8) + '****',
            nf: nf
        });

        // Executa consulta de rastreamento
        return await this.executeRastreamento(userNumber, userState);
    }

    /**
     * Executa consulta de rastreamento
     */
    async executeRastreamento(userNumber, userState) {
        try {
            // Importa o serviço de rastreamento
            const rastreamentoService = require('../services/rastreamentoService');
            
            const resultado = await rastreamentoService.consultar(
                userState.data.cnpj, 
                userState.data.nf
            );

            // Limpa estado do usuário
            this.clearUserState(userNumber);

            // Formata resposta de sucesso
            return this.formatarResultadoRastreamento(resultado, userState.data.nf);

        } catch (error) {
            logger.error('Erro na consulta de rastreamento', { 
                error: error.message, 
                userNumber,
                cnpj: userState.data.cnpj.substring(0, 8) + '****',
                nf: userState.data.nf
            });

            // Limpa estado do usuário
            this.clearUserState(userNumber);

            // Retorna erro amigável
            return `❌ **Não encontramos essa Nota Fiscal**

Possíveis motivos:
• CNPJ ou NF incorretos
• Mercadoria ainda não foi coletada
• Sistema temporariamente indisponível

🔄 *Digite "rastreio" para tentar novamente*
👤 *Digite "atendente" para falar com nossa equipe*
🏠 *Digite "menu" para voltar ao menu principal*`;
        }
    }

    /**
     * Formata resultado do rastreamento
     */
    formatarResultadoRastreamento(resultado, nf) {
        // Verifica se houve erro ou não há dados
        if (!resultado || !resultado.sucesso) {
            return `❌ **Mercadoria não encontrada**

NF ${nf} não foi localizada em nosso sistema.

🔄 *Digite "rastreio" para nova consulta*
👤 *Digite "atendente" para ajuda especializada*`;
        }

        // Se o RastreamentoService já formatou a mensagem, retorna ela
        if (resultado.mensagem) {
            return resultado.mensagem;
        }

        // Fallback para formato antigo (caso necessário)
        return `✅ **RASTREAMENTO - NF ${nf}**

📍 **Status:** ${resultado.status || 'Não informado'}
📍 **Localização:** ${resultado.localizacao || 'Não informado'}
🕐 **Última atualização:** ${resultado.dataAtualizacao || 'Não informado'}
📅 **Previsão de entrega:** ${resultado.previsaoEntrega || 'A definir'}

Precisa de mais alguma coisa?

🔄 *Rastrear outra mercadoria*
👤 *Falar com atendente*
🏠 *Menu principal*`;
    }

    /**
     * Processa seleção do menu RH
     */
    async handleRHMenuStep(userNumber, message, userState) {
        const normalizedMessage = message.toLowerCase().trim();

        // Opção 1: Enviar currículo
        if (normalizedMessage === '1' || normalizedMessage.includes('curriculo') || normalizedMessage.includes('currículo') || normalizedMessage.includes('cv')) {
            userState.step = 'curriculo_lgpd';
            return `📄 **ENVIO DE CURRÍCULO**

⚖️ **AVISO LGPD - Lei Geral de Proteção de Dados**

Para processar seu currículo, precisamos coletar e armazenar seus dados pessoais (nome, contato, experiências profissionais).

**Seus dados serão utilizados exclusivamente para:**
• Análise de adequação às vagas disponíveis
• Contato para processos seletivos
• Manutenção em banco de talentos

**Você concorda com o processamento dos seus dados pessoais?**

✅ Digite "SIM" para concordar
❌ Digite "NÃO" para cancelar`;
        }

        // Opção 2: Ver vagas abertas
        if (normalizedMessage === '2' || normalizedMessage.includes('vagas') || normalizedMessage.includes('emprego') || normalizedMessage.includes('trabalho')) {
            this.clearUserState(userNumber);
            return await this.listarVagasAbertas();
        }

        // Opção inválida
        return `❌ **Opção inválida**

Por favor, escolha uma das opções:

1️⃣ Enviar currículo
2️⃣ Ver vagas abertas

Digite o número da opção ou a palavra-chave:`;
    }

    /**
     * Processa resposta LGPD para currículo
     */
    async handleCurriculoLGPDStep(userNumber, message, userState) {
        const normalizedMessage = message.toLowerCase().trim();

        if (normalizedMessage === 'sim' || normalizedMessage === 's' || normalizedMessage === 'aceito' || normalizedMessage === 'concordo') {
            userState.step = 'curriculo_dados';
            return `✅ **CONSENTIMENTO CONFIRMADO**

Agora preciso de algumas informações básicas:

📝 **Por favor, informe:**

**Nome completo:**`;
        }

        if (normalizedMessage === 'não' || normalizedMessage === 'nao' || normalizedMessage === 'n' || normalizedMessage === 'recuso') {
            this.clearUserState(userNumber);
            return `❌ **Processo cancelado**

Sem o consentimento LGPD, não podemos processar seu currículo.

Caso mude de ideia, digite "RH" novamente.

👥 *Voltar ao RH*
🏠 *Menu principal*`;
        }

        return `⚖️ **Confirmação necessária**

Para continuar, preciso da sua confirmação sobre o processamento dos dados.

✅ Digite "SIM" para concordar
❌ Digite "NÃO" para cancelar`;
    }

    /**
     * Processa coleta de dados do currículo
     */
    async handleCurriculoDadosStep(userNumber, message, userState) {
        if (!userState.data.nome) {
            userState.data.nome = message.trim();
            return `👋 Olá, ${userState.data.nome}!

**Cidade onde reside:**`;
        }

        if (!userState.data.cidade) {
            userState.data.cidade = message.trim();
            return `📍 ${userState.data.cidade} - Perfeito!

**Área de interesse profissional:**
(Ex: Logística, Administrativo, Vendas, TI, etc.)`;
        }

        if (!userState.data.area) {
            userState.data.area = message.trim();
            
            // Gera protocolo único
            const protocolo = `RH${Date.now().toString().slice(-6)}`;
            userState.data.protocolo = protocolo;

            // Salva dados (implementar rhService)
            await this.salvarCurriculo(userState.data);

            this.clearUserState(userNumber);

            return `✅ **CURRÍCULO RECEBIDO COM SUCESSO!**

📋 **Protocolo:** ${protocolo}

**Dados registrados:**
👤 Nome: ${userState.data.nome}
📍 Cidade: ${userState.data.cidade}
💼 Área: ${userState.data.area}

**Próximos passos:**
• Seu currículo foi adicionado ao nosso banco de talentos
• Entraremos em contato caso surjam vagas compatíveis
• Guarde seu protocolo para futuras consultas

📎 **Para enviar seu arquivo PDF/DOC:**
Envie o arquivo do currículo agora ou posteriormente mencionando o protocolo ${protocolo}

Obrigado pelo interesse em nossa empresa!

👥 *Voltar ao RH*
🏠 *Menu principal*`;
        }

        return null;
    }

    /**
     * Lista vagas abertas disponíveis
     */
    async listarVagasAbertas() {
        try {
            // Importa o serviço de RH (será criado)
            const rhService = require('../services/rhService');
            const vagas = await rhService.listarVagas();

            if (!vagas || vagas.length === 0) {
                return `📋 **VAGAS ABERTAS**

Atualmente não temos vagas abertas.

🔔 **Cadastre seu interesse:**
Digite "currículo" para enviar seu CV e ser notificado sobre novas oportunidades.

👥 *Voltar ao RH*
🏠 *Menu principal*`;
            }

            let resposta = `📋 **VAGAS ABERTAS**\n\n`;
            
            vagas.forEach((vaga, index) => {
                resposta += `**${index + 1}. ${vaga.titulo}**\n`;
                resposta += `📍 ${vaga.cidade}\n`;
                resposta += `📋 ${vaga.requisitos}\n`;
                if (vaga.link) {
                    resposta += `🔗 Mais info: ${vaga.link}\n`;
                }
                resposta += `\n`;
            });

            resposta += `💼 **Interessado em alguma vaga?**\n`;
            resposta += `Digite "currículo" para enviar seu CV\n\n`;
            resposta += `👥 *Voltar ao RH*\n`;
            resposta += `🏠 *Menu principal*`;

            return resposta;

        } catch (error) {
            logger.error('Erro ao listar vagas', { error: error.message });
            return `❌ **Erro ao carregar vagas**

Tente novamente em alguns instantes.

👥 *Voltar ao RH*
🏠 *Menu principal*`;
        }
    }

    /**
     * Salva dados do currículo
     */
    async salvarCurriculo(dados) {
        try {
            // Importa o serviço de RH (será criado)
            const rhService = require('../services/rhService');
            await rhService.salvarCurriculo(dados);
            
            logger.info('Currículo salvo com sucesso', { 
                protocolo: dados.protocolo,
                nome: dados.nome,
                cidade: dados.cidade,
                area: dados.area
            });
        } catch (error) {
            logger.error('Erro ao salvar currículo', { 
                error: error.message,
                dados: dados
            });
        }
    }

    /**
     * Obtém ou cria estado do usuário
     */
    getUserState(userNumber) {
        if (!this.userStates.has(userNumber)) {
            this.userStates.set(userNumber, {
                currentFlow: null,
                step: null,
                data: {},
                lastActivity: Date.now()
            });
        }
        return this.userStates.get(userNumber);
    }

    /**
     * Limpa estado do usuário
     */
    clearUserState(userNumber) {
        this.userStates.delete(userNumber);
        logger.debug('Estado do usuário limpo', { userNumber });
    }

    /**
     * Inicia timer de limpeza de estados ociosos
     */
    startCleanupTimer() {
        setInterval(() => {
            const now = Date.now();
            for (const [userNumber, state] of this.userStates.entries()) {
                if (now - state.lastActivity > this.stateTimeout) {
                    this.clearUserState(userNumber);
                }
            }
        }, 5 * 60 * 1000); // Executa a cada 5 minutos
    }

    /**
     * Obtém estatísticas do interceptor
     */
    getStats() {
        return {
            activeUsers: this.userStates.size,
            flows: Array.from(this.userStates.values()).reduce((acc, state) => {
                acc[state.currentFlow || 'none'] = (acc[state.currentFlow || 'none'] || 0) + 1;
                return acc;
            }, {})
        };
    }
}

module.exports = new MenuInterceptor();