
Este plano detalha como construir uma versão simplificada do chatbot para a transportadora, com o objetivo de testar as funcionalidades principais (roteamento, rastreio e RH) de forma rápida e com investimento mínimo.

---

### 1. Escopo e Canais na POC

O escopo da POC será focado em demonstrar as capacidades do bot em um único canal: o **WhatsApp Business**. As metas principais são:

- **Roteamento:** O bot deve conseguir direcionar o cliente para a filial correta com base na cidade ou CEP.
    
- **Rastreio (Autoatendimento):** O bot deve consultar o status da mercadoria usando os dados fornecidos pelo cliente (CNPJ + NF).
    
- **RH (Autoatendimento):** O bot deve coletar o consentimento do cliente para o tratamento de dados e simular o recebimento do currículo.
    
- **LGPD:** O bot deve demonstrar o aviso de privacidade e a coleta de consentimento explícito.
    
- **Indicadores (simulados):** Vamos simular os dados para um dashboard, mostrando como a POC pode gerar informações para otimizações futuras.
    

---

### 2. Arquitetura e Componentes da POC

A arquitetura será minimalista, utilizando ferramentas gratuitas.

- **CPaaS/Plataforma:** Usaremos uma plataforma que ofereça um plano gratuito para testes do WhatsApp Business API.
    
- **Bot Orquestrador:** Será uma API simples, desenvolvida em **Node.js** com o framework **Express** ou **Python** com o **FastAPI**, rodando em um servidor de hospedagem gratuita.
    
- **Simulação de Banco de Dados:** Não usaremos um banco de dados real. As tabelas de filiais e de cobertura serão simuladas como arquivos **JSON** ou como arrays de objetos dentro do próprio código, o que reduz a complexidade e o custo.
    

---

### 3. Módulos e Fluxos da POC (Foco no WhatsApp)

#### a) Módulo de Roteamento (Fluxo de Conversa)

Este é o primeiro contato do cliente. A lógica do bot é identificar a filial e apresentar o menu de forma clara.

- **1. Saudação:** O bot envia uma mensagem de saudação inicial.
    
    - **Mensagem:** `Olá! Bom dia! Sou o assistente virtual da Transportadora. Para começar, por favor, me informe sua cidade (ex: Curitiba/PR) ou seu CEP.`
        
- **2. Coleta de Informação:** O bot espera a resposta do cliente.
    
- **3. Confirmação de Filial:** O bot consulta o arquivo JSON de filiais e responde.
    
    - **Exemplo de Conteúdo do Arquivo JSON (simulando um banco de dados):**
        
        JSON
        
        ```
        [
          {"cidade": "Curitiba", "uf": "PR", "filial_id": "CWB"},
          {"cidade": "Joinville", "uf": "SC", "filial_id": "JOI"}
        ]
        ```
        
    - **Mensagem:** `Perfeito! A sua região é atendida pela Filial Curitiba/PR.`
        
- **4. Menu Principal:** O bot apresenta um menu interativo com botões.
    
    - **Mensagem:** `Como posso te ajudar hoje?` (seguido dos botões: `Rastreio`, `RH`, `Falar com Atendente`, etc.)
        

#### b) Módulo de Rastreamento (Web Scraping)

Este é o módulo central da POC. Em vez de uma API, o bot faz a consulta diretamente na página web da transportadora.

- **1. Coleta de dados:** O cliente clica no botão `Rastreio`. O bot pede os dados.
    
    - **Mensagem 1:** `Para consultar, informe o CNPJ (somente números).`
        
    - **Mensagem 2:** `Agora, informe o número da Nota Fiscal (NF).`
        
- **2. Execução do Web Scraping:** O Orquestrador do bot, utilizando bibliotecas como **Puppeteer** (Node.js) ou **Beautiful Soup** (Python), faz os seguintes passos automáticos:
    
    - Acessa a URL: `https://ssw.inf.br/2/rastreamento`.
        
    - Preenche os campos de CNPJ e NF.
        
    - Clica no botão de pesquisa.
        
    - Lê o código da página de resposta para encontrar o status (por exemplo, "Entregue") e a previsão de entrega.
        
- **3. Apresentação do Resultado:**
    
    - **Cenário de Sucesso:** `NF 12345 • Em trânsito – HUB Curitiba/PR (02/09/2025 14:22). Previsão de entrega: 04/09/2025.`
        
    - **Cenário de Erro:** `Não encontramos essa Nota Fiscal. Por favor, verifique os dados e tente novamente. Se precisar, podemos te transferir para o SAC.`
        

#### c) Módulo de Recursos Humanos (RH)

Este módulo também será de autoatendimento, simulando a coleta de currículos.

- **1. Consentimento LGPD:** O bot exibe o aviso de privacidade, conforme o documento original.
    
    - **Mensagem:** `Ao enviar seu currículo, você concorda com o tratamento de seus dados pessoais para fins de recrutamento e seleção, de acordo com a LGPD (Lei 13.709/2018).`
        
- **2. Coleta do Currículo:** O bot informa ao cliente onde enviar o arquivo.
    
    - **Mensagem:** `Certo! Você pode enviar seu currículo para rh@empresa.com.br. Agradecemos o seu interesse!`
        
- **3. Registro na POC:** A cada interação no módulo de RH, o bot registra a ação em um arquivo de log simples (por exemplo, um arquivo de texto `log_rh.txt`) para mostrar que a lógica de registro de consentimento funciona.
    

#### d) Outros Módulos (Cotação, Coleta, etc.)

Para estes módulos, a POC foca na transição para o atendimento humano.

- **Fluxo de "Handover":** Quando o cliente clica em "Cotação" ou "Coleta", o bot envia uma mensagem informando que irá transferir para um atendente.
    
    - **Mensagem:** `Vou te encaminhar para o setor de Coletas da Filial Curitiba. Em instantes, um de nossos atendentes entrará em contato.`
        
- **Registro de Ocorrência:** O bot pode registrar em um arquivo de log que a transferência foi solicitada, informando a filial e o serviço, simulando o que aconteceria em um sistema completo.
    

---

### 4. Simulação de Métricas e Dashboard

Para mostrar o potencial de um dashboard, a POC pode incluir uma lógica simples para registrar cada interação.

- **Como Fazer:** Cada vez que o bot for acionado, ele salva uma linha em um arquivo de texto, registrando a data, a hora, o tipo de solicitação (por exemplo: `rastreio_sucesso`, `rh_consentimento`, `transferencia_sac`).
    
- **O que a POC prova:** Com esses dados, é possível criar um painel simples para visualizar as interações e demonstrar as métricas do documento original, como **volume por canal** e **% de autoatendimento**.