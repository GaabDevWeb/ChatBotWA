const { 
    default: makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const { ContactsManager } = require('./contacts');
const { eventManager } = require('./events');
const { simularRespostaHumana } = require('./humanizer');
const performanceMonitor = require('./performance');
const messageQueue = require('./queue');
const logger = require('./logger');
const backupManager = require('./backup');
const { aiConfigManager } = require('./aiConfig');
const { pluginSystem } = require('./pluginSystem');
const commandBus = require('./commands/commandBus');
const aiAdmin = require('./commands/admin/ai');
const dbAdmin = require('./commands/admin/db');
const backupAdmin = require('./commands/admin/backup');
const historyAdmin = require('./commands/admin/history');
const pipeline = require('./core/pipeline');

// Lista de administradores autorizados
const ADMIN_NUMBERS = ['5554996121107@c.us'];

function isAdmin(number) {
    return ADMIN_NUMBERS.includes(number);
}

// Registra comandos de administrador no Command Bus
aiAdmin.register(commandBus, {
    aiConfigManager,
    pluginSystem,
    getSystemStats: require('./openai').getSystemStats,
    clearCache: require('./openai').clearCache
});
dbAdmin.register(commandBus);
backupAdmin.register(commandBus, { backupManager });
historyAdmin.register(commandBus);

let sock;
let qrDinamic;
let isConnected = false;
let contactsManager;

async function connectToWhatsApp() {
    const authDir = path.join(__dirname, '..', 'auth_info_baileys');
    
    // Cria diretório de autenticação se não existir
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    
    logger.info(`Usando Baileys v${version.join('.')}, é a mais recente: ${isLatest}`);

    sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        browser: Browsers.macOS('Desktop'),
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: false
    });

    // Bind do store para salvar credenciais
    sock.ev.on('creds.update', saveCreds);

    // Handler de conexão
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrDinamic = qr;
            logger.info('QR Code gerado, escaneie com seu WhatsApp');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            isConnected = false;
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            
            logger.info('Conexão fechada devido a:', lastDisconnect?.error);
            
            if (shouldReconnect) {
                logger.info('Reconectando...');
                setTimeout(connectToWhatsApp, 3000);
            }
        } else if (connection === 'open') {
            isConnected = true;
            logger.info('Bot conectado com sucesso ao WhatsApp!');
            
            // Inicializar gerenciadores
            contactsManager = new ContactsManager(sock);
            eventManager.initialize(sock);
            
            logger.info('Bot conectado com sucesso!');
            console.log('✅ Bot conectado ao WhatsApp!');
        }
    });

    // Configurar handler de mensagens usando o sistema de eventos
    eventManager.on('message', async (message) => {
        try {
            // Filtrar mensagens de grupo se necessário
            if (message.isGroupMsg) {
                logger.debug('Mensagem de grupo ignorada', { from: message.from });
                return;
            }

            // Verificar se é comando de admin
            if (message.body.startsWith('/') && isAdmin(message.from)) {
                logger.info('Comando de admin detectado', { 
                    from: message.from, 
                    command: message.body 
                });
                
                const response = await commandBus.execute(message.body.slice(1), { from: message.from });
                await sendMessage(message.from, response);
                return;
            }

            // Adicionar mensagem à fila para processamento
            messageQueue.addMessage({
                from: message.from,
                body: message.body,
                isGroupMsg: message.isGroupMsg
            });

            logger.debug('Mensagem adicionada à fila', { 
                from: message.from,
                queueSize: messageQueue.getQueueSize()
            });

        } catch (error) {
            logger.error('Erro ao processar mensagem', { 
                error: error.message,
                from: message.from 
            });
        }
    });

    return sock;
}

async function sendMessage(to, text) {
    if (!isConnected || !sock) {
        logger.error('Bot não está conectado');
        return false;
    }
    
    try {
        await sock.sendMessage(to, { text: text });
        return true;
    } catch (error) {
        logger.error('Erro ao enviar mensagem', { error: error.message });
        return false;
    }
}

function startBot() {
    performanceMonitor.start();
    logger.info('Iniciando bot com sistema modular usando Baileys');

    // Configura o processador de mensagens da fila
    messageQueue.on('process', async (message) => {
        const startTime = Date.now();
        logger.info('Iniciando processamento de mensagem', { 
            from: message.from, 
            text: message.body 
        });

        try {
            // Verifica se é um comando de admin
            if (message.body.startsWith('/') && isAdmin(message.from)) {
                logger.info('Processando comando de admin', { command: message.body });
                const response = await commandBus.execute(message.body.slice(1), { from: message.from });
                await sendMessage(message.from, response);
                return;
            }

            // Processa pelo pipeline (garante cliente, histórico e persistência)
            logger.info('Processando mensagem via pipeline', {
                from: message.from,
                hasText: !!message.body
            });
            const resposta = await pipeline.run(message.from, message.body);
            if (!resposta) {
                await sendMessage(message.from, 'Erro ao processar mensagem. Tente novamente.');
                return;
            }

            // Envia resposta ao usuário usando o humanizer adaptado
            await simularRespostaHumana({ sendMessage }, message.from, resposta);

            // Registra métricas
            const responseTime = Date.now() - startTime;
            performanceMonitor.addMessageResponseTime(responseTime);

        } catch (err) {
            logger.error('Erro no processamento', { 
                error: err.message,
                stack: err.stack,
                from: message.from,
                message: message.body
            });
            performanceMonitor.addError();
            
            try {
                await sendMessage(message.from, 'Estou tendo dificuldades técnicas. Por favor, tente novamente.');
            } catch (sendError) {
                logger.error('Erro ao enviar mensagem de erro', { 
                    error: sendError.message,
                    stack: sendError.stack
                });
            }
        }
    });

    // Configura o handler de erros da fila
    messageQueue.on('error', (error) => {
        logger.error('Erro na fila de mensagens', {
            message: error.message,
            retries: error.retries,
            error: error.error.message
        });
    });

    // Inicia a conexão
    connectToWhatsApp().catch(err => {
        logger.error('Erro ao conectar ao WhatsApp', {
            error: err.message,
            stack: err.stack
        });
        performanceMonitor.addError();
    });
}

module.exports = { 
    startBot, 
    sendMessage, 
    sock: () => sock, 
    getContactsManager: () => contactsManager,
    getEventManager: () => eventManager,
    getSock: () => sock
};