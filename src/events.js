const EventEmitter = require('events');
const logger = require('./logger');

class BaileysEventManager extends EventEmitter {
    constructor() {
        super();
        this.sock = null;
        this.eventHandlers = new Map();
    }

    /**
     * Inicializa o gerenciador de eventos com o socket do Baileys
     * @param {Object} sock - Socket do Baileys
     */
    initialize(sock) {
        this.sock = sock;
        this.setupBaileysEvents();
        logger.info('Gerenciador de eventos Baileys inicializado');
    }

    /**
     * Configura os eventos do Baileys
     */
    setupBaileysEvents() {
        if (!this.sock) return;

        // Evento de mensagens
        this.sock.ev.on('messages.upsert', (messageUpdate) => {
            this.handleMessagesUpsert(messageUpdate);
        });

        // Evento de atualização de conexão
        this.sock.ev.on('connection.update', (update) => {
            this.handleConnectionUpdate(update);
        });

        // Evento de atualização de credenciais
        this.sock.ev.on('creds.update', (creds) => {
            this.handleCredsUpdate(creds);
        });

        // Evento de presença (online/offline)
        this.sock.ev.on('presence.update', (presence) => {
            this.handlePresenceUpdate(presence);
        });

        // Evento de atualização de grupos
        this.sock.ev.on('groups.update', (groups) => {
            this.handleGroupsUpdate(groups);
        });

        // Evento de participantes de grupo
        this.sock.ev.on('group-participants.update', (participants) => {
            this.handleGroupParticipantsUpdate(participants);
        });

        // Evento de contatos
        this.sock.ev.on('contacts.update', (contacts) => {
            this.handleContactsUpdate(contacts);
        });

        // Evento de bloqueio/desbloqueio
        this.sock.ev.on('blocklist.set', (blocklist) => {
            this.handleBlocklistSet(blocklist);
        });

        // Evento de chamadas
        this.sock.ev.on('call', (calls) => {
            this.handleCall(calls);
        });
    }

    /**
     * Manipula eventos de mensagens
     * @param {Object} messageUpdate - Atualização de mensagens
     */
    handleMessagesUpsert(messageUpdate) {
        try {
            const { messages, type } = messageUpdate;
            
            for (const message of messages) {
                // Emite evento compatível com venom-bot
                this.emit('message', {
                    id: message.key.id,
                    from: message.key.remoteJid,
                    to: message.key.remoteJid,
                    body: message.message?.conversation || 
                          message.message?.extendedTextMessage?.text || '',
                    type: type,
                    timestamp: message.messageTimestamp,
                    fromMe: message.key.fromMe,
                    isGroupMsg: message.key.remoteJid?.includes('@g.us') || false,
                    author: message.key.participant || message.key.remoteJid,
                    quotedMsg: message.message?.extendedTextMessage?.contextInfo?.quotedMessage,
                    mentionedJidList: message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [],
                    rawMessage: message
                });

                logger.debug('Evento de mensagem processado', {
                    from: message.key.remoteJid,
                    type: type,
                    hasText: !!(message.message?.conversation || message.message?.extendedTextMessage?.text)
                });
            }
        } catch (error) {
            logger.error('Erro ao processar evento de mensagem', { error: error.message });
        }
    }

    /**
     * Manipula eventos de atualização de conexão
     * @param {Object} update - Atualização de conexão
     */
    handleConnectionUpdate(update) {
        try {
            const { connection, lastDisconnect, qr } = update;
            
            this.emit('connection.update', {
                connection,
                lastDisconnect,
                qr,
                isConnected: connection === 'open',
                isDisconnected: connection === 'close'
            });

            logger.debug('Evento de conexão processado', { connection });
        } catch (error) {
            logger.error('Erro ao processar evento de conexão', { error: error.message });
        }
    }

    /**
     * Manipula eventos de atualização de credenciais
     * @param {Object} creds - Credenciais
     */
    handleCredsUpdate(creds) {
        try {
            this.emit('creds.update', creds);
            logger.debug('Evento de credenciais processado');
        } catch (error) {
            logger.error('Erro ao processar evento de credenciais', { error: error.message });
        }
    }

    /**
     * Manipula eventos de presença
     * @param {Object} presence - Informações de presença
     */
    handlePresenceUpdate(presence) {
        try {
            this.emit('presence.update', presence);
            logger.debug('Evento de presença processado', { jid: presence.id });
        } catch (error) {
            logger.error('Erro ao processar evento de presença', { error: error.message });
        }
    }

    /**
     * Manipula eventos de atualização de grupos
     * @param {Array} groups - Lista de grupos atualizados
     */
    handleGroupsUpdate(groups) {
        try {
            for (const group of groups) {
                this.emit('group.update', group);
            }
            logger.debug('Evento de grupos processado', { count: groups.length });
        } catch (error) {
            logger.error('Erro ao processar evento de grupos', { error: error.message });
        }
    }

    /**
     * Manipula eventos de participantes de grupo
     * @param {Object} participants - Informações dos participantes
     */
    handleGroupParticipantsUpdate(participants) {
        try {
            this.emit('group.participants.update', participants);
            logger.debug('Evento de participantes de grupo processado', { 
                group: participants.id,
                action: participants.action 
            });
        } catch (error) {
            logger.error('Erro ao processar evento de participantes', { error: error.message });
        }
    }

    /**
     * Manipula eventos de contatos
     * @param {Array} contacts - Lista de contatos atualizados
     */
    handleContactsUpdate(contacts) {
        try {
            for (const contact of contacts) {
                this.emit('contact.update', contact);
            }
            logger.debug('Evento de contatos processado', { count: contacts.length });
        } catch (error) {
            logger.error('Erro ao processar evento de contatos', { error: error.message });
        }
    }

    /**
     * Manipula eventos de lista de bloqueio
     * @param {Object} blocklist - Lista de bloqueio
     */
    handleBlocklistSet(blocklist) {
        try {
            this.emit('blocklist.set', blocklist);
            logger.debug('Evento de lista de bloqueio processado');
        } catch (error) {
            logger.error('Erro ao processar evento de lista de bloqueio', { error: error.message });
        }
    }

    /**
     * Manipula eventos de chamadas
     * @param {Array} calls - Lista de chamadas
     */
    handleCall(calls) {
        try {
            for (const call of calls) {
                this.emit('call', call);
            }
            logger.debug('Evento de chamadas processado', { count: calls.length });
        } catch (error) {
            logger.error('Erro ao processar evento de chamadas', { error: error.message });
        }
    }

    /**
     * Registra um handler personalizado para um evento
     * @param {string} eventName - Nome do evento
     * @param {Function} handler - Função handler
     */
    registerHandler(eventName, handler) {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, []);
        }
        this.eventHandlers.get(eventName).push(handler);
        this.on(eventName, handler);
        
        logger.debug('Handler registrado', { eventName });
    }

    /**
     * Remove um handler de evento
     * @param {string} eventName - Nome do evento
     * @param {Function} handler - Função handler
     */
    removeHandler(eventName, handler) {
        if (this.eventHandlers.has(eventName)) {
            const handlers = this.eventHandlers.get(eventName);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
                this.off(eventName, handler);
                logger.debug('Handler removido', { eventName });
            }
        }
    }

    /**
     * Remove todos os handlers de um evento
     * @param {string} eventName - Nome do evento
     */
    removeAllHandlers(eventName) {
        if (this.eventHandlers.has(eventName)) {
            const handlers = this.eventHandlers.get(eventName);
            for (const handler of handlers) {
                this.off(eventName, handler);
            }
            this.eventHandlers.delete(eventName);
            logger.debug('Todos os handlers removidos', { eventName });
        }
    }

    /**
     * Limpa todos os handlers
     */
    clearAllHandlers() {
        for (const [eventName] of this.eventHandlers) {
            this.removeAllHandlers(eventName);
        }
        logger.info('Todos os handlers de eventos limpos');
    }
}

// Instância singleton
const eventManager = new BaileysEventManager();

module.exports = { BaileysEventManager, eventManager };