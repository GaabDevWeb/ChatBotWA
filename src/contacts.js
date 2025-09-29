const logger = require('./logger');

class ContactsManager {
    constructor(sock) {
        this.sock = sock;
        this.contacts = new Map();
        this.groups = new Map();
    }

    /**
     * Atualiza o socket do Baileys
     * @param {Object} sock - Socket do Baileys
     */
    updateSocket(sock) {
        this.sock = sock;
    }

    /**
     * Obtém informações de um contato
     * @param {string} jid - JID do contato
     * @returns {Object|null} Informações do contato
     */
    async getContact(jid) {
        try {
            if (!this.sock) {
                logger.error('Socket não disponível para obter contato');
                return null;
            }

            // Verifica se já temos o contato em cache
            if (this.contacts.has(jid)) {
                return this.contacts.get(jid);
            }

            // Busca informações do contato
            const contact = await this.sock.onWhatsApp(jid);
            if (contact && contact.length > 0) {
                const contactInfo = {
                    jid: contact[0].jid,
                    exists: contact[0].exists,
                    name: contact[0].name || jid.split('@')[0]
                };
                
                this.contacts.set(jid, contactInfo);
                return contactInfo;
            }

            return null;
        } catch (error) {
            logger.error('Erro ao obter contato', { jid, error: error.message });
            return null;
        }
    }

    /**
     * Obtém lista de contatos
     * @returns {Array} Lista de contatos
     */
    async getContacts() {
        try {
            if (!this.sock) {
                logger.error('Socket não disponível para obter contatos');
                return [];
            }

            // No Baileys, os contatos são obtidos através do store
            const contacts = Object.values(this.sock.authState.creds.contacts || {});
            return contacts.map(contact => ({
                jid: contact.id,
                name: contact.name || contact.id.split('@')[0],
                notify: contact.notify
            }));
        } catch (error) {
            logger.error('Erro ao obter lista de contatos', { error: error.message });
            return [];
        }
    }

    /**
     * Obtém informações de um grupo
     * @param {string} groupJid - JID do grupo
     * @returns {Object|null} Informações do grupo
     */
    async getGroup(groupJid) {
        try {
            if (!this.sock) {
                logger.error('Socket não disponível para obter grupo');
                return null;
            }

            // Verifica se já temos o grupo em cache
            if (this.groups.has(groupJid)) {
                return this.groups.get(groupJid);
            }

            // Busca metadados do grupo
            const groupMetadata = await this.sock.groupMetadata(groupJid);
            if (groupMetadata) {
                const groupInfo = {
                    jid: groupMetadata.id,
                    subject: groupMetadata.subject,
                    desc: groupMetadata.desc,
                    participants: groupMetadata.participants,
                    owner: groupMetadata.owner,
                    creation: groupMetadata.creation,
                    size: groupMetadata.size
                };
                
                this.groups.set(groupJid, groupInfo);
                return groupInfo;
            }

            return null;
        } catch (error) {
            logger.error('Erro ao obter grupo', { groupJid, error: error.message });
            return null;
        }
    }

    /**
     * Obtém lista de grupos
     * @returns {Array} Lista de grupos
     */
    async getGroups() {
        try {
            if (!this.sock) {
                logger.error('Socket não disponível para obter grupos');
                return [];
            }

            const groups = await this.sock.groupFetchAllParticipating();
            return Object.values(groups).map(group => ({
                jid: group.id,
                subject: group.subject,
                desc: group.desc,
                participants: group.participants,
                owner: group.owner,
                creation: group.creation,
                size: group.size
            }));
        } catch (error) {
            logger.error('Erro ao obter lista de grupos', { error: error.message });
            return [];
        }
    }

    /**
     * Verifica se um JID é de um grupo
     * @param {string} jid - JID para verificar
     * @returns {boolean} True se for um grupo
     */
    isGroup(jid) {
        return jid && jid.includes('@g.us');
    }

    /**
     * Verifica se um JID é de um contato individual
     * @param {string} jid - JID para verificar
     * @returns {boolean} True se for um contato individual
     */
    isContact(jid) {
        return jid && jid.includes('@s.whatsapp.net');
    }

    /**
     * Formata um JID para o formato correto
     * @param {string} number - Número de telefone
     * @returns {string} JID formatado
     */
    formatJid(number) {
        // Remove caracteres não numéricos
        const cleanNumber = number.replace(/\D/g, '');
        
        // Adiciona código do país se necessário (Brasil = 55)
        let formattedNumber = cleanNumber;
        if (cleanNumber.length === 11 && cleanNumber.startsWith('0')) {
            formattedNumber = '55' + cleanNumber.substring(1);
        } else if (cleanNumber.length === 10) {
            formattedNumber = '55' + cleanNumber;
        } else if (cleanNumber.length === 11 && !cleanNumber.startsWith('55')) {
            formattedNumber = '55' + cleanNumber;
        }

        return formattedNumber + '@s.whatsapp.net';
    }

    /**
     * Limpa o cache de contatos e grupos
     */
    clearCache() {
        this.contacts.clear();
        this.groups.clear();
        logger.info('Cache de contatos e grupos limpo');
    }
}

module.exports = { ContactsManager };