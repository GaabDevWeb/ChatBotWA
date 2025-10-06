async function simularRespostaHumana(client, chatId, texto) {
    // Garantir que texto é uma string
    const textoStr = typeof texto === 'string' ? texto : String(texto || '');

    // Função auxiliar para enviar mensagem integral
    const enviarMensagem = async (mensagem) => {
        if (typeof client.sendMessage === 'function') {
            // Função sendMessage customizada do bot.js
            await client.sendMessage(chatId, mensagem);
        } else if (client && typeof client.sendText === 'function') {
            // Fallback para compatibilidade com venom-bot
            await client.sendText(chatId, mensagem);
        } else {
            console.error('Nenhuma função de envio de mensagem disponível');
        }
    };

    // Enviar a mensagem completa, sem qualquer divisão
    await enviarMensagem(textoStr);
}

module.exports = { simularRespostaHumana };