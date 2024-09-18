# Bot de Whitelist para Discord

Este é um bot de Discord para gerenciar processos de whitelist de forma automática, criando canais temporários e conduzindo um questionário com os usuários. Todo o fluxo de interação ocorre diretamente nos canais temporários, facilitando o gerenciamento e a experiência do usuário.

## Funcionalidades

- **Processo de Whitelist Automatizado:** Os usuários iniciam o processo com um comando e são guiados através de um questionário personalizado.
- **Canais Temporários Exclusivos:** O bot cria canais temporários únicos para cada usuário, garantindo privacidade e organização.
- **Questionário Personalizável:** As perguntas e respostas podem ser configuradas no arquivo `quizConfig.js`.
- **Atualização de Banco de Dados:** Integração com um banco de dados MySQL para registrar os usuários aprovados.
- **Atribuição de Cargo e Apelido:** Usuários aprovados recebem um cargo específico e têm seus apelidos atualizados no servidor.

## Pré-requisitos

- **Node.js** (versão 16.6.0 ou superior)
- **npm** (geralmente instalado com o Node.js)
- **Conta no Discord e um servidor onde o bot será adicionado**
- **Bot do Discord:** Criado através do [Portal de Desenvolvedores do Discord](https://discord.com/developers/applications)
- **Banco de Dados MySQL**

## Configuração

- **AJUSTAR O ARQUIVO .env**

```bash
git clone https://github.com/seu-usuario/seu-repositorio.git
cd seu-repositorio
