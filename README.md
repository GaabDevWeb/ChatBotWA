# OrbitBot – POC (WhatsApp Chatbot)

Projeto de Prova de Conceito (POC) de um chatbot WhatsApp para a Transportadora Bauer Express, focado em validar rapidamente funcionalidades-chave: roteamento por cidade/CEP, rastreamento (simulado), fluxo de RH, relacionamento com fornecedores e melhorias de UX na entrega das mensagens.

## Objetivos da POC
- Validar interação via WhatsApp usando `@whiskeysockets/baileys`.
- Roteamento por cidade/CEP com base em `data/filiais.json` e cache de clientes.
- Simular rastreamento de NF (com possibilidade de automação via `puppeteer`).
- Fluxos de RH: enviar currículo e ver vagas.
- Fluxo de fornecedores: coleta de dados e portfólio.
- Respostas formatadas e legíveis no WhatsApp (Markdown → WhatsApp).
- LGPD: consentimento explícito no fluxo de currículo e separação de dados.

## Principais Funcionalidades
- Mensagens sem fragmentação: mensagens longas são enviadas por completo.
- Conversão de Markdown para WhatsApp: títulos, negrito, itálico, listas, links e código são adaptados.
- Interceptador de menu: desvia para fluxos guiados quando aplicável (com logs informativos).
- Integração com IA (Gemini): respostas personalizadas e contextualizadas com histórico.
- Dashboard simples (local) para acompanhamento básico.

## Arquitetura e Estrutura
```
ChatBotWA/
├── app.js                 # Bootstrap do bot
├── src/
│   ├── bot.js             # Orquestra eventos e envio de respostas
│   ├── openai.js          # Integração com IA e configuração de prompt
│   ├── providers/
│   │   └── geminiProvider.js
│   ├── core/              # Pipeline, cache, retry
│   ├── middleware/
│   │   ├── menuInterceptor.js  # Fluxos guiados e menus
│   │   └── handoverService.js  # Encaminhamento para atendente humano
│   ├── services/          # Roteamento, RH, rastreamento (simulado/apto a scraping)
│   ├── repositories/      # Persistência e acesso a dados (SQLite)
│   ├── formatters/
│   │   └── mdToWhatsapp.js # Conversor Markdown → WhatsApp
│   ├── humanizer.js       # Envio de mensagens SEM dividir
│   ├── dashboard.js       # Servidor de dashboard local
│   └── treinamento.js     # Persona, regras e exemplos (prompt de sistema)
├── data/
│   ├── filiais.json       # Filiais para roteamento
│   ├── clientes_cache.json# Cache leve de clientes/cidades
│   └── vagas.json         # Vagas para RH
├── database/
│   ├── data/orbitbot.db   # Banco SQLite local (desenvolvimento)
│   └── db/index.js        # Esquema e operações
└── auth_info_baileys/     # Sessões do WhatsApp (NÃO versionar)
```

## Requisitos
- Node.js 18+ recomendado.
- Conta e chave de API do Google Generative AI (Gemini).
- Ambiente com acesso à internet estável.

## Configuração
1) Instale dependências:
```
npm install
```
2) Crie o arquivo `.env` com base no `.env.example`:
```
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash-exp
GEMINI_TEMPERATURE=0.7
GEMINI_MAX_TOKENS=800
OPENAI_MAX_RETRIES=3
OPENAI_INITIAL_TIMEOUT=8000
OPENAI_MAX_TIMEOUT=30000
OPENAI_MAX_HISTORY=10
DASHBOARD_PORT=3000
ENABLE_KEYWORD_FALLBACK=false
```
3) Inicie o bot:
```
npm start
```
4) Escaneie o QR Code no WhatsApp para autenticar. As credenciais ficarão em `auth_info_baileys/` (sensível; não versionar).

## Uso
- Envie uma mensagem ao número conectado no WhatsApp.
- Exemplos de intenções:
  - “Sou de Curitiba/PR e preciso de cotação.”
  - “Quero enviar meu currículo.”
  - “Rastrear NF 123456.”
  - “Cadastrar fornecedor.”
- O bot alterna entre fluxos guiados (menu) e IA conforme o contexto da conversa.

## Conversão Markdown → WhatsApp
O conversor em `src/formatters/mdToWhatsapp.js` adapta elementos Markdown para formatos suportados no WhatsApp:
- Títulos (`#`, `##`, …) → prefixos legíveis com espaçamento.
- Negrito: `**texto**` → `*texto*`.
- Itálico: `*texto*` ou `_texto_` → `_texto_`.
- Riscar: `~~texto~~` → `~texto~` (quando aplicável).
- Links: `[texto](url)` → `texto (url)`.
- Listas: mantém marcadores e numeração com formatação simples.
- Código: blocos transformados em seção com indentação; inline preservado com crase.

## IA e Respostas Contextualizadas
- Configuração em `src/openai.js` (modelo, temperatura, tokens, histórico).
- Persona e guard-rails em `src/treinamento.js`.
- Classificador de intenções: `src/services/intentClassifier.js`.
- Plugins e middlewares podem enriquecer contexto e validar respostas antes do envio.

## Banco de Dados e Dados
- Banco SQLite local em `database/data/orbitbot.db` para a POC.
- Dados de apoio em `data/` (filiais, vagas e cache de clientes).
- Para produção, definir política de migração, retenção e consentimento (LGPD).

## Logs e Observabilidade
- Logs via `pino` em console (configurável em `src/logger.js`).
- Recomenda-se adicionar rotação de logs e métricas adicionais para produção.

## Segurança e Privacidade
- Não versionar `.env`, `auth_info_baileys/`, chaves e credenciais.
- Coleta de consentimento explícito no fluxo de currículo (LGPD).
- Restrinja permissões de leitura/escrita dos diretórios sensíveis.

## Limitações e Próximos Passos
- Rastreamento real depende de integração externa estável (ex.: scraping com `puppeteer`).
- Robustez de reconexão, rate limiting e observabilidade são mínimos para POC.
- Ajustes de UX/formatos podem ser necessários para conteúdos muito extensos.
- Políticas de retenção de dados e consentimento devem ser formalizadas para produção.

## Solução de Problemas (Quick Tips)
- QR Code não aparece: garanta encoding UTF-8 no terminal.
- Conexão instável: verifique rede, firewall e estabilidade.
- Mensagens longas: o bot envia sem dividir; respeite limites do WhatsApp.

## Licença
- Consulte o arquivo `LICENSE` incluído no projeto.