async function simularRespostaHumana(client, chatId, texto) {
    await new Promise(resolve => setTimeout(resolve, 400 + Math.random() * 200));

    const frases = texto.split(/(?<=[.!?])\s+/).filter(f => f.length > 0);
    let mensagemAtual = '';
    const MAX_LENGTH = 180;

    for (const frase of frases) {
        if ((mensagemAtual + frase).length <= MAX_LENGTH) {
            mensagemAtual += (mensagemAtual ? ' ' : '') + frase;
        } else {
            if (mensagemAtual) {
                // Para Baileys, usa a função sendMessage passada como parâmetro
                if (typeof client.sendMessage === 'function') {
                    await client.sendMessage(chatId, { text: mensagemAtual });
                } else if (typeof client.sendMessage === 'function' && client.sendMessage.length === 2) {
                    // Função sendMessage customizada do bot.js
                    await client.sendMessage(chatId, mensagemAtual);
                } else {
                    // Fallback para compatibilidade com venom-bot
                    await client.sendText(chatId, mensagemAtual);
                }
                await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 150));
                mensagemAtual = '';
            }

            if (frase.length > MAX_LENGTH) {
                const partesLongas = frase.match(/.{1,180}(?:\s|$)/g) || [frase];
                for (const parte of partesLongas) {
                    if (typeof client.sendMessage === 'function') {
                        await client.sendMessage(chatId, { text: parte.trim() });
                    } else if (typeof client.sendMessage === 'function' && client.sendMessage.length === 2) {
                        await client.sendMessage(chatId, parte.trim());
                    } else {
                        await client.sendText(chatId, parte.trim());
                    }
                    await new Promise(resolve => setTimeout(resolve, 150));
                }
            } else {
                mensagemAtual = frase;
            }
        }
    }

    if (mensagemAtual) {
        if (typeof client.sendMessage === 'function') {
            await client.sendMessage(chatId, { text: mensagemAtual });
        } else if (typeof client.sendMessage === 'function' && client.sendMessage.length === 2) {
            await client.sendMessage(chatId, mensagemAtual);
        } else {
            await client.sendText(chatId, mensagemAtual);
        }
    }
}

module.exports = { simularRespostaHumana };