const interceptor = require('../src/middleware/menuInterceptor');
const HandoverService = require('../src/middleware/handoverService');

async function testarRoteamento() {
    console.log('🧪 **TESTE DE ROTEAMENTO POR FILIAL**\n');

    const cenarios = [
        {
            nome: 'Cenário 1: Curitiba/PR',
            usuario: '+5541999999999',
            mensagens: [
                'Oi',
                'Curitiba',
                '4', // Solicitar Cotação
            ]
        },
        {
            nome: 'Cenário 2: CEP São Paulo',
            usuario: '+5511888888888',
            mensagens: [
                'Olá',
                '01310-100',
                '5', // Agendar Coleta
            ]
        },
        {
            nome: 'Cenário 3: Cidade não encontrada',
            usuario: '+5547777777777',
            mensagens: [
                'Bom dia',
                'Cidade Inexistente',
                'Florianópolis',
                '6', // Falar com Atendente
            ]
        },
        {
            nome: 'Cenário 4: Identificação automática',
            usuario: '+5554666666666',
            mensagens: [
                'Sou de Porto Alegre e preciso de uma cotação',
            ]
        }
    ];

    for (const cenario of cenarios) {
        console.log(`\n📋 **${cenario.nome}**`);
        console.log('=' .repeat(50));

        // Limpar estado do usuário
        interceptor.clearUserState(cenario.usuario);

        for (let i = 0; i < cenario.mensagens.length; i++) {
            const mensagem = cenario.mensagens[i];
            console.log(`\n👤 Cliente: "${mensagem}"`);
            
            try {
                const resposta = await interceptor.process(cenario.usuario, mensagem);
                
                if (resposta) {
                    console.log(`🤖 Bot: ${resposta.substring(0, 200)}${resposta.length > 200 ? '...' : ''}`);
                    
                    // Verificar se filial foi identificada
                    const filial = interceptor.getUserFilial(cenario.usuario);
                    if (filial) {
                        console.log(`✅ Filial identificada: ${filial.nome}/${filial.uf}`);
                        console.log(`📞 Telefone: ${filial.telefones?.[0] || 'N/A'}`);
                    }
                } else {
                    console.log('🤖 Bot: [Passou para IA - sem interceptação]');
                }
            } catch (error) {
                console.log(`❌ Erro: ${error.message}`);
            }
        }

        // Testar handover se filial foi identificada
        const filial = interceptor.getUserFilial(cenario.usuario);
        if (filial) {
            console.log('\n🔄 **Teste de Handover:**');
            const msgCotacao = HandoverService.gerarMensagemTransferencia('cotacao', filial);
            console.log(`💰 Cotação: ${msgCotacao.substring(0, 100)}...`);
        }
    }

    console.log('\n✅ **TESTE CONCLUÍDO**');
}

// Executar teste
testarRoteamento().catch(console.error);