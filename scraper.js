const puppeteer = require('puppeteer');

/**
 * Script de Web Scraping para SSW Rastreamento
 * Acessa https://ssw.inf.br/2/rastreamento e preenche os campos CNPJ e NR
 */

async function sswWebScraping(cnpj, numeroNota) {
    let browser;
    
    try {
        console.log('🚀 Iniciando web scraping SSW...');
        
        // Lança o navegador
        browser = await puppeteer.launch({
            headless: false, // Deixa visível para debug
            defaultViewport: null,
            args: ['--start-maximized']
        });
        
        // Cria nova página
        const page = await browser.newPage();
        
        console.log('📄 Navegando para a URL da SSW...');
        
        // Navega para a URL
        await page.goto('https://ssw.inf.br/2/rastreamento', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        console.log('✅ Página carregada com sucesso!');
        
        // Aguarda os campos estarem disponíveis
        await page.waitForSelector('#cnpj', { timeout: 10000 });
        await page.waitForSelector('#NR', { timeout: 10000 });
        
        console.log('📝 Preenchendo campo CNPJ...');
        
        // Limpa e preenche o campo CNPJ
        await page.click('#cnpj');
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyA');
        await page.keyboard.up('Control');
        await page.type('#cnpj', cnpj);
        
        console.log('📝 Preenchendo campo Número da Nota...');
        
        // Limpa e preenche o campo NR (Número da Nota)
        await page.click('#NR');
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyA');
        await page.keyboard.up('Control');
        await page.type('#NR', numeroNota);
        
        console.log('✅ Campos preenchidos com sucesso!');
        console.log(`   CNPJ: ${cnpj}`);
        console.log(`   Número da Nota: ${numeroNota}`);
        
        // Aguarda o botão rastrear estar disponível
        console.log('🔍 Aguardando botão rastrear...');
        await page.waitForSelector('#btn_rastrear', { timeout: 10000 });
        
        // Clica no botão rastrear
        console.log('🖱️ Clicando no botão rastrear...');
        await page.click('#btn_rastrear');
        
        // Aguarda a navegação para a página de resultado com timeout maior
        console.log('⏳ Aguardando redirecionamento para página de resultado...');
        
        try {
            await page.waitForNavigation({ 
                waitUntil: 'domcontentloaded',
                timeout: 1000 // Reduzido de 45000 para 15000
            });
        } catch (navError) {
            console.log('⚠️ Timeout na navegação, verificando se a página mudou...');
            // Reduzido de 3000 para 1000ms
            await page.waitForTimeout(1000);
        }
        
        // Verifica se chegou na página de resultado
        const currentUrl = page.url();
        console.log(`📍 URL atual: ${currentUrl}`);
        
        if (currentUrl.includes('resultSSW')) {
            console.log('✅ Redirecionado para página de resultado com sucesso!');
            
            // Aguardar especificamente pela tabela de resultados ao invés de tempo fixo
            console.log('⏳ Aguardando tabela de resultados carregar...');
            try {
                await page.waitForSelector('table[style*="border:1px solid #e9e9e9"]', { timeout: 10000 });
                console.log('✅ Tabela de resultados encontrada!');
            } catch (tableError) {
                console.log('⚠️ Tabela não encontrada, tentando capturar dados mesmo assim...');
            }
            
            // Captura dados específicos baseados na estrutura HTML real
            console.log('🔍 Capturando dados de rastreamento...');
            
            const rastreamentoInfo = await page.evaluate(() => {
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
            
            console.log('📦 DADOS DE RASTREAMENTO CAPTURADOS:');
            console.log('=' .repeat(80));
            console.log(`📋 ${rastreamentoInfo.remetente} ${rastreamentoInfo.cnpjRemetente}`);
            console.log(`📊 Total de resultados encontrados: ${rastreamentoInfo.totalResultados}`);
            console.log('=' .repeat(80));
            
            if (rastreamentoInfo.resultados.length > 0) {
                rastreamentoInfo.resultados.forEach(resultado => {
                    console.log(`\n🔸 RESULTADO ${resultado.indice}:`);
                    console.log(`   📄 Número Fiscal: ${resultado.numeroFiscal}`);
                    console.log(`   📍 Local/Data: ${resultado.unidadeDataHora}`);
                    console.log(`   🎯 Status: ${resultado.tituloSituacao}`);
                    console.log(`   📝 Detalhes: ${resultado.detalhesSituacao}`);
                    console.log('   ' + '-'.repeat(60));
                });
            } else {
                console.log('⚠️ Nenhum resultado de rastreamento encontrado.');
            }
            
            console.log('=' .repeat(80));
            
            return rastreamentoInfo;
            
        } else {
            console.log('⚠️ Não foi redirecionado para a página de resultado esperada.');
            console.log('   Verificando se há mensagens de erro na página atual...');
            
            // Captura possíveis mensagens de erro
            const errorInfo = await page.evaluate(() => {
                const body = document.body.textContent;
                return {
                    url: window.location.href,
                    content: body.trim()
                };
            });
            
            console.log(`📍 URL atual: ${errorInfo.url}`);
            console.log(`📄 Conteúdo da página: ${errorInfo.content.substring(0, 300)}...`);
        }
        
        console.log('🎉 Web scraping concluído com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro durante o web scraping:', error.message);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
            console.log('🔒 Navegador fechado.');
        }
    }
}

// Função principal para executar o script
async function main() {
    // Dados reais fornecidos pelo usuário
    const cnpj = '11986456000199'; // CNPJ real para teste
    const numeroNota = '35498'; // Número da nota fiscal real
    
    try {
        const resultado = await sswWebScraping(cnpj, numeroNota);
        
        if (resultado && resultado.length > 0) {
            console.log('\n🎯 RESUMO DOS DADOS CAPTURADOS:');
            console.log('================================');
            resultado.forEach((item, index) => {
                console.log(`${index + 1}. ${item.conteudo}`);
            });
            console.log('================================\n');
        }
        
    } catch (error) {
        console.error('💥 Falha na execução:', error);
        process.exit(1);
    }
}

// Executa apenas se for chamado diretamente
if (require.main === module) {
    main();
}

// Exporta a função para uso em outros módulos
module.exports = { sswWebScraping };