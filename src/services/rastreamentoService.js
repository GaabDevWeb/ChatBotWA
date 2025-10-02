const puppeteer = require('puppeteer');
const logger = require('../logger');

class RastreamentoService {
    constructor() {
        this.baseUrl = 'https://ssw.inf.br/2/rastreamento';
        this.timeout = 30000; // 30 segundos
        this.retryAttempts = 2;
    }

    /**
     * Consulta rastreamento de mercadoria usando web scraping funcional
     * @param {string} cnpj - CNPJ (14 dígitos)
     * @param {string} nf - Número da Nota Fiscal
     * @returns {Promise<Object>} Dados do rastreamento
     */
    async consultar(cnpj, nf) {
        let browser = null;
        
        try {
            logger.info('🚀 Iniciando web scraping SSW...', { 
                cnpj: cnpj.substring(0, 8) + '****',
                nf
            });
            
            // Lança o navegador
            browser = await puppeteer.launch({
                headless: true, // Mudado para true em produção
                defaultViewport: null,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });
            
            // Cria nova página
            const page = await browser.newPage();
            
            logger.info('📄 Navegando para a URL da SSW...');
            
            // Navega para a URL
            await page.goto(this.baseUrl, {
                waitUntil: 'networkidle2',
                timeout: this.timeout
            });
            
            logger.info('✅ Página carregada com sucesso!');
            
            // Aguarda os campos estarem disponíveis
            await page.waitForSelector('#cnpj', { timeout: 10000 });
            await page.waitForSelector('#NR', { timeout: 10000 });
            
            logger.info('📝 Preenchendo campos...');
            
            // Limpa e preenche o campo CNPJ
            await page.click('#cnpj');
            await page.keyboard.down('Control');
            await page.keyboard.press('KeyA');
            await page.keyboard.up('Control');
            await page.type('#cnpj', cnpj);
            
            // Limpa e preenche o campo NR (Número da Nota)
            await page.click('#NR');
            await page.keyboard.down('Control');
            await page.keyboard.press('KeyA');
            await page.keyboard.up('Control');
            await page.type('#NR', nf);
            
            logger.info('✅ Campos preenchidos com sucesso!');
            
            // Aguarda o botão rastrear estar disponível
            await page.waitForSelector('#btn_rastrear', { timeout: 10000 });
            
            // Clica no botão rastrear
            logger.info('🖱️ Clicando no botão rastrear...');
            await page.click('#btn_rastrear');
            
            // Aguarda a navegação para a página de resultado
            logger.info('⏳ Aguardando redirecionamento para página de resultado...');
            
            try {
                await page.waitForNavigation({ 
                    waitUntil: 'domcontentloaded',
                    timeout: 15000
                });
            } catch (navError) {
                logger.info('⚠️ Timeout na navegação, verificando se a página mudou...');
                await page.waitForTimeout(2000);
            }
            
            // Verifica se chegou na página de resultado
            const currentUrl = page.url();
            logger.info(`📍 URL atual: ${currentUrl}`);
            
            if (currentUrl.includes('resultSSW')) {
                logger.info('✅ Redirecionado para página de resultado com sucesso!');
                
                // Aguardar especificamente pela tabela de resultados
                try {
                    await page.waitForSelector('table[style*="border:1px solid #e9e9e9"]', { timeout: 10000 });
                    logger.info('✅ Tabela de resultados encontrada!');
                } catch (tableError) {
                    logger.info('⚠️ Tabela não encontrada, tentando capturar dados mesmo assim...');
                }
                
                // Captura dados específicos baseados na estrutura HTML real
                logger.info('🔍 Capturando dados de rastreamento...');
                
                const rastreamentoInfo = await this.extrairDadosRastreamento(page);
                
                logger.info('📦 Dados capturados com sucesso', {
                    totalResultados: rastreamentoInfo.totalResultados
                });
                
                return this.formatarResposta(rastreamentoInfo);
                
            } else {
                logger.warn('⚠️ Não foi redirecionado para a página de resultado esperada.');
                
                // Captura possíveis mensagens de erro
                const errorInfo = await page.evaluate(() => {
                    const body = document.body.textContent;
                    return {
                        url: window.location.href,
                        content: body.trim()
                    };
                });
                
                return {
                    sucesso: false,
                    erro: 'Não foi possível acessar os dados de rastreamento',
                    detalhes: errorInfo.content.substring(0, 200)
                };
            }
            
        } catch (error) {
            logger.error('❌ Erro durante o web scraping:', error);
            return {
                sucesso: false,
                erro: 'Erro interno no sistema de rastreamento',
                detalhes: error.message
            };
        } finally {
            if (browser) {
                await browser.close();
                logger.info('🔒 Navegador fechado.');
            }
        }
    }

    /**
     * Extrai dados de rastreamento da página de resultado
     * @param {Object} page - Página do Puppeteer
     * @returns {Promise<Object>} Dados extraídos
     */
    async extrairDadosRastreamento(page) {
        return await page.evaluate(() => {
            const resultados = [];
            
            // Capturar informações do remetente
            const remetenteElement = document.querySelector('span.rastreamento');
            const cnpjElement = document.querySelector('span.tdb[style*="color:blue"]');
            
            const remetente = remetenteElement ? remetenteElement.textContent.trim() : '';
            const cnpjRemetente = cnpjElement ? cnpjElement.textContent.trim() : '';
            
            // Buscar a tabela principal de resultados (com borda)
            const tabelaResultados = document.querySelector('table[style*="border:1px solid #e9e9e9"]');
            
            if (tabelaResultados) {
                // Buscar todas as linhas de dados (com background branco e cursor pointer)
                const linhasDados = tabelaResultados.querySelectorAll('tr[style*="background-color:#FFFFFF"][style*="cursor:pointer"]');
                
                linhasDados.forEach((linha, index) => {
                    const celulas = linha.querySelectorAll('td');
                    
                    if (celulas.length >= 3) {
                        // Primeira coluna: Número Fiscal/Coleta e Número do Pedido
                        const celulaFiscal = celulas[0];
                        const numeroFiscal = celulaFiscal.textContent.trim();
                        
                        // Segunda coluna: Unidade e Data/Hora
                        const celulaLocal = celulas[1];
                        const unidadeDataHora = celulaLocal.textContent.trim();
                        
                        // Terceira coluna: Situação completa
                        const celulaSituacao = celulas[2];
                        const situacaoCompleta = celulaSituacao.textContent.trim();
                        
                        // Extrair título da situação (em negrito)
                        const tituloSituacao = celulaSituacao.querySelector('p.titulo');
                        const titulo = tituloSituacao ? tituloSituacao.textContent.trim() : '';
                        
                        // Extrair detalhes da situação
                        const detalhesElements = celulaSituacao.querySelectorAll('p.tdb');
                        const detalhes = Array.from(detalhesElements).map(el => el.textContent.trim()).join(' ');
                        
                        resultados.push({
                            indice: index + 1,
                            numeroFiscal: numeroFiscal,
                            unidadeDataHora: unidadeDataHora,
                            tituloSituacao: titulo,
                            detalhesSituacao: detalhes,
                            situacaoCompleta: situacaoCompleta
                        });
                    }
                });
            }
            
            return {
                remetente: remetente,
                cnpjRemetente: cnpjRemetente,
                totalResultados: resultados.length,
                resultados: resultados
            };
        });
    }

    /**
     * Formata a resposta para o MenuInterceptor
     * @param {Object} rastreamentoInfo - Dados brutos do rastreamento
     * @returns {Object} Resposta formatada
     */
    formatarResposta(rastreamentoInfo) {
        if (!rastreamentoInfo || rastreamentoInfo.totalResultados === 0) {
            return {
                sucesso: false,
                erro: 'Nenhum resultado de rastreamento encontrado',
                detalhes: 'Verifique se o CNPJ e número da nota fiscal estão corretos'
            };
        }

        let mensagem = `📦 *RASTREAMENTO DE MERCADORIA*\n\n`;
        mensagem += `📋 *Remetente:* ${rastreamentoInfo.remetente}\n`;
        mensagem += `🏢 *CNPJ:* ${rastreamentoInfo.cnpjRemetente}\n`;
        mensagem += `📊 *Total de registros:* ${rastreamentoInfo.totalResultados}\n\n`;

        rastreamentoInfo.resultados.forEach((resultado, index) => {
            mensagem += `🔸 *REGISTRO ${index + 1}*\n`;
            mensagem += `📄 *Número Fiscal:* ${resultado.numeroFiscal}\n`;
            mensagem += `📍 *Local/Data:* ${resultado.unidadeDataHora}\n`;
            mensagem += `🎯 *Status:* ${resultado.tituloSituacao}\n`;
            if (resultado.detalhesSituacao) {
                mensagem += `📝 *Detalhes:* ${resultado.detalhesSituacao}\n`;
            }
            mensagem += `\n`;
        });

        mensagem += `✅ *Consulta realizada com sucesso!*`;

        return {
            sucesso: true,
            mensagem: mensagem,
            dados: rastreamentoInfo
        };
    }

    /**
     * Valida os dados de entrada
     * @param {string} cnpj - CNPJ
     * @param {string} nf - Número da nota fiscal
     * @returns {Object} Resultado da validação
     */
    validarDados(cnpj, nf) {
        const errors = [];

        // Validação CNPJ
        if (!cnpj || cnpj.length < 11) {
            errors.push('CNPJ deve ter pelo menos 11 dígitos');
        }

        // Validação NF
        if (!nf || nf.trim().length === 0) {
            errors.push('Número da nota fiscal é obrigatório');
        }

        return {
            valido: errors.length === 0,
            erros: errors
        };
    }

    /**
     * Método público com validação
     * @param {string} cnpj - CNPJ
     * @param {string} nf - Número da nota fiscal
     * @returns {Promise<Object>} Resultado da consulta
     */
    async consultarComValidacao(cnpj, nf) {
        const validacao = this.validarDados(cnpj, nf);
        
        if (!validacao.valido) {
            return {
                sucesso: false,
                erro: 'Dados inválidos',
                detalhes: validacao.erros.join(', ')
            };
        }

        return await this.consultar(cnpj, nf);
    }
}

module.exports = new RastreamentoService();