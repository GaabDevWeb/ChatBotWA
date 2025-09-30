async function simularRespostaHumana(client, chatId, texto) {
    // Garantir que texto é uma string
    if (typeof texto !== 'string') {
        texto = String(texto || '');
    }
    
    await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 200));

    // Garantir que texto é uma string antes de usar split
    const textoStr = typeof texto === 'string' ? texto : String(texto || '');
    const frases = textoStr.split(/(?<=[.!?])\s+/).filter(f => f.length > 0);
    let mensagemAtual = '';
    const MAX_LENGTH = 180;

    // Função auxiliar para enviar mensagem
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

    for (const frase of frases) {
        // Garantir que frase é uma string
        const fraseStr = typeof frase === 'string' ? frase : String(frase || '');
        
        if ((mensagemAtual + fraseStr).length <= MAX_LENGTH) {
            mensagemAtual += (mensagemAtual ? ' ' : '') + fraseStr;
        } else {
            if (mensagemAtual) {
                await enviarMensagem(mensagemAtual);
                await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 150));
                mensagemAtual = '';
            }

            if (fraseStr.length > MAX_LENGTH) {
                // Garantir que fraseStr é uma string antes de usar match
                const partesLongas = fraseStr.match(/.{1,180}(?:\s|$)/g) || [fraseStr];
                for (const parte of partesLongas) {
                    const parteStr = typeof parte === 'string' ? parte : String(parte || '');
                    await enviarMensagem(parteStr.trim());
                    await new Promise(resolve => setTimeout(resolve, 150));
                }
            } else {
                mensagemAtual = fraseStr;
            }
        }
    }

    if (mensagemAtual) {
        await enviarMensagem(mensagemAtual);
    }
}

module.exports = { simularRespostaHumana };