const fs = require('fs').promises;
const path = require('path');
const logger = require('../logger');

class RHService {
    constructor() {
        // Diretórios para armazenar dados
        this.curriculosDir = path.join(__dirname, '../../data/curriculos');
        this.vagasFile = path.join(__dirname, '../../data/vagas.json');
        
        // Garante que os diretórios existam
        this.initializeDirectories();
    }

    /**
     * Inicializa diretórios necessários
     */
    async initializeDirectories() {
        try {
            await fs.mkdir(path.dirname(this.curriculosDir), { recursive: true });
            await fs.mkdir(this.curriculosDir, { recursive: true });
            await fs.mkdir(path.dirname(this.vagasFile), { recursive: true });
            
            // Cria arquivo de vagas se não existir
            try {
                await fs.access(this.vagasFile);
            } catch {
                await this.criarVagasIniciais();
            }
        } catch (error) {
            logger.error('Erro ao inicializar diretórios RH', { error: error.message });
        }
    }

    /**
     * Cria arquivo inicial de vagas fictícias
     */
    async criarVagasIniciais() {
        const vagasIniciais = [
            {
                id: 1,
                titulo: "Motorista Categoria D",
                cidade: "São Paulo - SP",
                requisitos: "CNH categoria D, experiência com veículos pesados, disponibilidade para viagens",
                link: "https://empresa.com/vagas/motorista-d",
                ativa: true,
                dataPublicacao: new Date().toISOString()
            },
            {
                id: 2,
                titulo: "Auxiliar de Logística",
                cidade: "Rio de Janeiro - RJ",
                requisitos: "Ensino médio completo, conhecimento em Excel, experiência em estoque",
                link: "https://empresa.com/vagas/auxiliar-logistica",
                ativa: true,
                dataPublicacao: new Date().toISOString()
            },
            {
                id: 3,
                titulo: "Analista de Transportes",
                cidade: "Belo Horizonte - MG",
                requisitos: "Superior em Logística ou áreas afins, conhecimento em roteirização, inglês intermediário",
                link: "https://empresa.com/vagas/analista-transportes",
                ativa: true,
                dataPublicacao: new Date().toISOString()
            },
            {
                id: 4,
                titulo: "Operador de Empilhadeira",
                cidade: "Curitiba - PR",
                requisitos: "Curso de empilhadeira, experiência mínima 1 ano, disponibilidade para turnos",
                link: "https://empresa.com/vagas/operador-empilhadeira",
                ativa: true,
                dataPublicacao: new Date().toISOString()
            },
            {
                id: 5,
                titulo: "Coordenador de Frota",
                cidade: "Salvador - BA",
                requisitos: "Superior completo, experiência em gestão de frotas, conhecimento em manutenção preventiva",
                link: "https://empresa.com/vagas/coordenador-frota",
                ativa: true,
                dataPublicacao: new Date().toISOString()
            }
        ];

        try {
            await fs.writeFile(this.vagasFile, JSON.stringify(vagasIniciais, null, 2), 'utf8');
            logger.info('Arquivo de vagas iniciais criado com sucesso');
        } catch (error) {
            logger.error('Erro ao criar vagas iniciais', { error: error.message });
        }
    }

    /**
     * Lista todas as vagas ativas
     * @returns {Promise<Array>} Lista de vagas
     */
    async listarVagas() {
        try {
            const vagasData = await fs.readFile(this.vagasFile, 'utf8');
            const vagas = JSON.parse(vagasData);
            
            // Retorna apenas vagas ativas
            return vagas.filter(vaga => vaga.ativa);
            
        } catch (error) {
            logger.error('Erro ao listar vagas', { error: error.message });
            return [];
        }
    }

    /**
     * Salva dados do currículo
     * @param {Object} dados - Dados do currículo
     * @returns {Promise<boolean>} Sucesso da operação
     */
    async salvarCurriculo(dados) {
        try {
            const curriculoData = {
                protocolo: dados.protocolo,
                nome: dados.nome,
                cidade: dados.cidade,
                area: dados.area,
                dataEnvio: new Date().toISOString(),
                status: 'recebido',
                observacoes: ''
            };

            const fileName = `curriculo_${dados.protocolo}.json`;
            const filePath = path.join(this.curriculosDir, fileName);

            await fs.writeFile(filePath, JSON.stringify(curriculoData, null, 2), 'utf8');

            logger.info('Currículo salvo com sucesso', { 
                protocolo: dados.protocolo,
                arquivo: fileName
            });

            return true;

        } catch (error) {
            logger.error('Erro ao salvar currículo', { 
                error: error.message,
                protocolo: dados.protocolo
            });
            return false;
        }
    }

    /**
     * Busca currículo por protocolo
     * @param {string} protocolo - Protocolo do currículo
     * @returns {Promise<Object|null>} Dados do currículo ou null
     */
    async buscarCurriculo(protocolo) {
        try {
            const fileName = `curriculo_${protocolo}.json`;
            const filePath = path.join(this.curriculosDir, fileName);

            const curriculoData = await fs.readFile(filePath, 'utf8');
            return JSON.parse(curriculoData);

        } catch (error) {
            logger.error('Erro ao buscar currículo', { 
                error: error.message,
                protocolo
            });
            return null;
        }
    }

    /**
     * Lista todos os currículos recebidos
     * @returns {Promise<Array>} Lista de currículos
     */
    async listarCurriculos() {
        try {
            const files = await fs.readdir(this.curriculosDir);
            const curriculos = [];

            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.curriculosDir, file);
                    const curriculoData = await fs.readFile(filePath, 'utf8');
                    curriculos.push(JSON.parse(curriculoData));
                }
            }

            // Ordena por data de envio (mais recentes primeiro)
            return curriculos.sort((a, b) => new Date(b.dataEnvio) - new Date(a.dataEnvio));

        } catch (error) {
            logger.error('Erro ao listar currículos', { error: error.message });
            return [];
        }
    }

    /**
     * Atualiza status de um currículo
     * @param {string} protocolo - Protocolo do currículo
     * @param {string} novoStatus - Novo status
     * @param {string} observacoes - Observações adicionais
     * @returns {Promise<boolean>} Sucesso da operação
     */
    async atualizarStatusCurriculo(protocolo, novoStatus, observacoes = '') {
        try {
            const curriculo = await this.buscarCurriculo(protocolo);
            if (!curriculo) {
                return false;
            }

            curriculo.status = novoStatus;
            curriculo.observacoes = observacoes;
            curriculo.dataAtualizacao = new Date().toISOString();

            const fileName = `curriculo_${protocolo}.json`;
            const filePath = path.join(this.curriculosDir, fileName);

            await fs.writeFile(filePath, JSON.stringify(curriculo, null, 2), 'utf8');

            logger.info('Status do currículo atualizado', { 
                protocolo,
                novoStatus
            });

            return true;

        } catch (error) {
            logger.error('Erro ao atualizar status do currículo', { 
                error: error.message,
                protocolo
            });
            return false;
        }
    }

    /**
     * Adiciona nova vaga
     * @param {Object} vaga - Dados da vaga
     * @returns {Promise<boolean>} Sucesso da operação
     */
    async adicionarVaga(vaga) {
        try {
            const vagasData = await fs.readFile(this.vagasFile, 'utf8');
            const vagas = JSON.parse(vagasData);

            const novaVaga = {
                id: Math.max(...vagas.map(v => v.id), 0) + 1,
                titulo: vaga.titulo,
                cidade: vaga.cidade,
                requisitos: vaga.requisitos,
                link: vaga.link || '',
                ativa: true,
                dataPublicacao: new Date().toISOString()
            };

            vagas.push(novaVaga);

            await fs.writeFile(this.vagasFile, JSON.stringify(vagas, null, 2), 'utf8');

            logger.info('Nova vaga adicionada', { 
                id: novaVaga.id,
                titulo: novaVaga.titulo
            });

            return true;

        } catch (error) {
            logger.error('Erro ao adicionar vaga', { error: error.message });
            return false;
        }
    }

    /**
     * Desativa uma vaga
     * @param {number} vagaId - ID da vaga
     * @returns {Promise<boolean>} Sucesso da operação
     */
    async desativarVaga(vagaId) {
        try {
            const vagasData = await fs.readFile(this.vagasFile, 'utf8');
            const vagas = JSON.parse(vagasData);

            const vagaIndex = vagas.findIndex(v => v.id === vagaId);
            if (vagaIndex === -1) {
                return false;
            }

            vagas[vagaIndex].ativa = false;
            vagas[vagaIndex].dataDesativacao = new Date().toISOString();

            await fs.writeFile(this.vagasFile, JSON.stringify(vagas, null, 2), 'utf8');

            logger.info('Vaga desativada', { vagaId });

            return true;

        } catch (error) {
            logger.error('Erro ao desativar vaga', { 
                error: error.message,
                vagaId
            });
            return false;
        }
    }

    /**
     * Obtém estatísticas do RH
     * @returns {Promise<Object>} Estatísticas
     */
    async obterEstatisticas() {
        try {
            const curriculos = await this.listarCurriculos();
            const vagas = await this.listarVagas();

            const estatisticas = {
                totalCurriculos: curriculos.length,
                curriculosRecebidos: curriculos.filter(c => c.status === 'recebido').length,
                curriculosEmAnalise: curriculos.filter(c => c.status === 'em_analise').length,
                curriculosAprovados: curriculos.filter(c => c.status === 'aprovado').length,
                totalVagasAtivas: vagas.length,
                ultimosCurriculos: curriculos.slice(0, 5)
            };

            return estatisticas;

        } catch (error) {
            logger.error('Erro ao obter estatísticas RH', { error: error.message });
            return {
                totalCurriculos: 0,
                curriculosRecebidos: 0,
                curriculosEmAnalise: 0,
                curriculosAprovados: 0,
                totalVagasAtivas: 0,
                ultimosCurriculos: []
            };
        }
    }
}

module.exports = new RHService();