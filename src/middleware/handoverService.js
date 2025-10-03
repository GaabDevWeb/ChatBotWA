const logger = require('../logger');

class HandoverService {
    /**
     * Gera mensagem de transferência personalizada por filial
     * @param {string} tipo - Tipo de transferência (cotacao, coleta, atendente)
     * @param {Object} filial - Dados da filial
     * @returns {string} Mensagem personalizada
     */
    static gerarMensagemTransferencia(tipo, filial) {
        if (!filial) {
            return this.gerarMensagemGenerica(tipo);
        }

        const telefone = filial.telefones && filial.telefones[0] ? filial.telefones[0] : '(XX) XXXX-XXXX';
        const email = filial.email || 'contato@bauerexpress.com.br';
        const nomeFilial = `${filial.nome}/${filial.uf}`;

        switch (tipo.toLowerCase()) {
            case 'cotacao':
            case 'cotação':
                return `💰 **SOLICITAÇÃO DE COTAÇÃO**

Vou te encaminhar para o setor de Cotações da Filial ${nomeFilial}.

📞 **Contato direto:** ${telefone}
📧 **E-mail:** ${email}
⏱️ **Horário:** Segunda a Sexta, 8h às 18h

Em instantes, um de nossos especialistas entrará em contato para elaborar sua cotação personalizada.`;

            case 'coleta':
                return `📋 **AGENDAMENTO DE COLETA**

Vou te encaminhar para o setor de Coletas da Filial ${nomeFilial}.

📞 **Contato direto:** ${telefone}
📧 **E-mail:** ${email}
⏱️ **Horário:** Segunda a Sexta, 8h às 18h

Nossa equipe entrará em contato para agendar a coleta em sua localização.`;

            case 'atendente':
            default:
                return `👤 **TRANSFERÊNCIA PARA ATENDENTE**

Conectando você com um atendente da Filial ${nomeFilial}.

📞 **Contato direto:** ${telefone}
📧 **E-mail:** ${email}
⏱️ **Horário:** Segunda a Sexta, 8h às 18h

Aguarde um momento que nosso atendente especializado irá te auxiliar.`;
        }
    }

    /**
     * Gera mensagem genérica quando filial não está disponível
     * @param {string} tipo - Tipo de transferência
     * @returns {string} Mensagem genérica
     */
    static gerarMensagemGenerica(tipo) {
        switch (tipo.toLowerCase()) {
            case 'cotacao':
            case 'cotação':
                return `💰 **SOLICITAÇÃO DE COTAÇÃO**

Vou te encaminhar para nosso setor de Cotações.

⏱️ **Horário:** Segunda a Sexta, 8h às 18h
📞 **Central:** 0800-XXX-XXXX

Em instantes, um de nossos especialistas entrará em contato.`;

            case 'coleta':
                return `📋 **AGENDAMENTO DE COLETA**

Vou te encaminhar para nosso setor de Coletas.

⏱️ **Horário:** Segunda a Sexta, 8h às 18h
📞 **Central:** 0800-XXX-XXXX

Nossa equipe entrará em contato para agendar a coleta.`;

            case 'atendente':
            default:
                return `👤 **TRANSFERÊNCIA PARA ATENDENTE**

Conectando você com nosso atendimento.

⏱️ **Horário:** Segunda a Sexta, 8h às 18h
📞 **Central:** 0800-XXX-XXXX

Aguarde um momento que nosso atendente irá te auxiliar.`;
        }
    }

    /**
     * Registra log da transferência
     * @param {string} userNumber - Número do usuário
     * @param {string} tipo - Tipo de transferência
     * @param {Object} filial - Dados da filial (opcional)
     */
    static registrarTransferencia(userNumber, tipo, filial = null) {
        const logData = {
            userNumber: userNumber.substring(0, 8) + '****', // Mascarar número
            tipo,
            filial: filial ? `${filial.nome}/${filial.uf}` : 'Genérica',
            timestamp: new Date().toISOString()
        };

        logger.info('Transferência realizada', logData);
    }
}

module.exports = HandoverService;