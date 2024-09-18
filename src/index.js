const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ChannelType,
    PermissionsBitField,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle
} = require('discord.js');
const mysql = require('mysql2');
const quizConfig = require('./quizConfig');
require('dotenv').config();

// Configuração do MySQL
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect(err => {
    if (err) {
        console.error('Erro ao conectar ao MySQL:', err);
        return;
    }
    console.log('Conectado ao MySQL');
    createTableIfNotExists();
});

function createTableIfNotExists() {
    const createTableQuery = `
        CREATE TABLE IF NOT EXISTS players (
            id INT PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            whitelisted BOOLEAN DEFAULT FALSE
        );
    `;

    db.query(createTableQuery, (err, results) => {
        if (err) {
            console.error('Erro ao criar a tabela:', err);
            return;
        }
        console.log('Tabela players verificada/criada com sucesso.');
    });
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ],
    partials: ['CHANNEL']
});

// Map para rastrear processos de whitelist ativos por Discord ID
const activeWhitelists = new Map();

client.once('ready', () => {
    console.log(`Logado como ${client.user.tag}`);
    sendWelcomeMessage();
});

client.on('messageCreate', async (message) => {
    if (message.channel.id === process.env.WHITELIST_CHANNEL_ID && message.content.startsWith('!whitelist')) {
        const args = message.content.split(' ').slice(1);
        if (args.length < 1) {
            return message.reply('Por favor, forneça o ID do jogador.');
        }

        const playerId = args[0];
        const playerDiscordId = message.author.id;

        // Verificar se o jogador já está em um processo de whitelist ativo
        if (activeWhitelists.has(playerDiscordId)) {
            return message.reply('Você já tem um processo de whitelist ativo. Por favor, conclua-o antes de iniciar um novo.');
        }

        // Validar o ID do jogador
        if (!/^\d{1,6}$/.test(playerId)) {
            return message.reply('O ID do jogador deve ser numérico e ter no máximo 6 caracteres.');
        }

        // Adicionar jogador ao mapa de processos ativos
        activeWhitelists.set(playerDiscordId, playerId);

        try {
            // Criar canal temporário para o jogador
            const tempChannel = await createTemporaryChannel(message.guild, playerDiscordId, playerId);

            if (tempChannel) {
                // Enviar mensagem no canal original informando o novo canal ao jogador
                await message.channel.send(`${message.author}, seu questionário de whitelist foi iniciado. Por favor, vá para o canal: ${tempChannel.toString()}`);

                // Deletar a mensagem do comando após enviar a mensagem
                await message.delete();

                // Perguntar nome e sobrenome do jogador
                await askPlayerName(tempChannel, playerId, playerDiscordId);
            }
        } catch (error) {
            console.error('Erro durante o processo de whitelist:', error);
            // Enviar mensagem no canal original informando sobre o erro
            try {
                await message.channel.send(`${message.author}, ocorreu um erro ao iniciar o processo de whitelist. Por favor, tente novamente mais tarde.`);
            } catch (channelError) {
                console.error('Erro ao enviar mensagem de erro no canal:', channelError);
            }
            // Remover do mapa de processos ativos em caso de erro
            activeWhitelists.delete(playerDiscordId);
        }
    }
});

async function createTemporaryChannel(guild, playerDiscordId, playerId) {
    try {
        const channelName = `whitelist-${playerId}-${playerDiscordId}`;
        const tempChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            reason: `Canal temporário para o questionário de whitelist do jogador ${playerId}`,
            permissionOverwrites: [
                {
                    id: guild.id, // Negar acesso a todos
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: playerDiscordId, // Permitir ao jogador ver o canal
                    allow: [PermissionsBitField.Flags.ViewChannel],
                },
            ],
        });

        console.log(`Canal temporário criado: ${tempChannel.name}`);
        return tempChannel;
    } catch (error) {
        console.error('Erro ao criar o canal temporário:', error);
        throw error;
    }
}

async function askPlayerName(channel, playerId, playerDiscordId) {
    try {
        const filter = response => response.author.id === playerDiscordId;

        // Pergunta o nome
        await channel.send('Por favor, forneça o **nome** do seu personagem (no RP):');
        const nameResponse = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
        const playerName = nameResponse.first().content.trim();

        // Pergunta o sobrenome
        await channel.send('Por favor, forneça o **sobrenome** do seu personagem (no RP):');
        const surnameResponse = await channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] });
        const playerSurname = surnameResponse.first().content.trim();

        // Adicionar jogador ao banco de dados
        await addPlayerToDatabase(playerId, `${playerName} ${playerSurname}`);

        // Iniciar o questionário
        await startQuiz(channel, playerId, playerDiscordId, playerName, playerSurname);

    } catch (error) {
        if (error instanceof Map && error.size === 0) {
            await channel.send('Tempo esgotado para resposta. O canal será excluído.');
        } else {
            console.error('Erro ao perguntar nome e sobrenome:', error);
            await channel.send('Não foi possível obter o nome e sobrenome do jogador. O canal será excluído.');
        }

        // Remover do mapa de processos ativos e excluir o canal
        activeWhitelists.delete(playerDiscordId);
        setTimeout(() => channel.delete(), 5000);
    }
}

async function addPlayerToDatabase(playerId, fullName) {
    return new Promise((resolve, reject) => {
        db.query(
            'INSERT INTO players (id, name, whitelisted) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)',
            [playerId, fullName, false],
            (err, results) => {
                if (err) {
                    console.error('Erro ao adicionar jogador ao banco de dados:', err);
                    return reject(err);
                }
                console.log(`Jogador ${fullName} adicionado ao banco de dados.`);
                resolve();
            }
        );
    });
}

async function startQuiz(channel, playerId, playerDiscordId, playerName, playerSurname) {
    try {
        let correctAnswers = 0;

        for (const [index, question] of quizConfig.questions.entries()) {
            const embed = new EmbedBuilder()
                .setTitle(`Pergunta ${index + 1}`)
                .setDescription(question.question)
                .setColor('#0099ff');

            const row = new ActionRowBuilder();

            // Adicionar um identificador único ao customId dos botões
            question.options.forEach((option, i) => {
                const button = new ButtonBuilder()
                    .setCustomId(`whitelist_${playerDiscordId}_${index}-${i}`)
                    .setLabel(option)
                    .setStyle(ButtonStyle.Primary);
                row.addComponents(button);
            });

            const quizMessage = await channel.send({ embeds: [embed], components: [row] });

            const filter = interaction => {
                return interaction.user.id === playerDiscordId && interaction.customId.startsWith(`whitelist_${playerDiscordId}_`);
            };

            const collector = quizMessage.createMessageComponentCollector({ filter, max: 1, time: 60000 });

            // Use uma promessa para aguardar a resposta do jogador
            await new Promise((resolve, reject) => {
                collector.on('collect', async interaction => {
                    try {
                        const [prefix, id, indices] = interaction.customId.split('_');
                        const [questionIndex, optionIndex] = indices.split('-').map(Number);

                        const selectedOption = quizConfig.questions[questionIndex].options[optionIndex];
                        await interaction.reply({ content: `Você escolheu: ${selectedOption}`, ephemeral: true });

                        // Verifica se a resposta está correta
                        if (optionIndex === question.answer) {
                            correctAnswers++;
                        }

                        resolve();
                    } catch (error) {
                        console.error('Erro ao processar a resposta do questionário:', error);
                        await interaction.reply({ content: 'Houve um erro ao processar sua resposta. Tente novamente.', ephemeral: true });
                        reject(error);
                    }
                });

                collector.on('end', (collected, reason) => {
                    if (reason === 'time') {
                        channel.send('Tempo esgotado para responder a pergunta. O canal será excluído.');
                        setTimeout(() => channel.delete(), 5000);
                        reject(new Error('Tempo esgotado'));
                    }
                });
            });
        }

        // Após o questionário, determinar se o jogador passou
        const passingScore = quizConfig.passingScore || quizConfig.questions.length;

        if (correctAnswers >= passingScore) {
            // Atualiza a whitelist do jogador no banco de dados
            db.query('UPDATE players SET whitelisted = ? WHERE id = ?', [true, playerId], async (err, results) => {
                if (err) {
                    console.error('Erro ao atualizar whitelist:', err);
                    await channel.send('Houve um erro ao adicionar o jogador à whitelist.');
                    return;
                }
                if (results.affectedRows === 0) {
                    await channel.send(`Jogador ${playerId} não encontrado.`);
                    return;
                }
                await channel.send(`Parabéns! Você foi adicionado à whitelist com sucesso.`);

                // Atribuir o cargo "Cidadão Natural"
                const member = await channel.guild.members.fetch(playerDiscordId).catch(err => {
                    console.error(`Membro com ID ${playerDiscordId} não encontrado:`, err);
                    return null;
                });
                if (!member) {
                    await channel.send('Não foi possível encontrar seu membro no servidor.');
                    return;
                }

                const role = channel.guild.roles.cache.find(role => role.name === '✔️┋Cidadão Natural');
                if (role) {
                    await member.roles.add(role).catch(err => {
                        console.error('Erro ao adicionar o cargo "Cidadão Natural":', err);
                        channel.send('Não foi possível atribuir o cargo "Cidadão Natural".');
                    });
                } else {
                    console.error('Cargo "Cidadão Natural" não encontrado.');
                    await channel.send('Cargo "Cidadão Natural" não encontrado no servidor.');
                }

                // Renomear o jogador
                const newNickname = `${playerName} ${playerSurname} | ${playerId}`;
                await member.setNickname(newNickname).catch(err => {
                    console.error(`Erro ao renomear o membro para ${newNickname}:`, err);
                    if (err.code === 50013) { // Código de erro para Missing Permissions
                        channel.send('Não foi possível renomear seu apelido devido a falta de permissões. Por favor, entre em contato com um administrador.');
                    } else {
                        channel.send('Não foi possível renomear seu apelido. Por favor, tente novamente mais tarde.');
                    }
                });

                console.log(`Jogador ${playerId} renomeado para ${newNickname}.`);
            });
        } else {
            await channel.send('Infelizmente você não atingiu a pontuação necessária para entrar na whitelist.');
        }

        // Remover do mapa de processos ativos e excluir o canal após a finalização
        activeWhitelists.delete(playerDiscordId);
        setTimeout(() => channel.delete(), 5000);

    } catch (error) {
        console.error('Erro ao iniciar o questionário:', error);
        await channel.send('Ocorreu um erro ao iniciar o questionário. O canal será excluído.');
        // Remover do mapa de processos ativos e excluir o canal em caso de erro
        activeWhitelists.delete(playerDiscordId);
        setTimeout(() => channel.delete(), 5000);
    }
}

function sendWelcomeMessage() {
    const welcomeChannelID = process.env.WHITELIST_CHANNEL_ID;
    const channel = client.channels.cache.get(welcomeChannelID);

    if (channel) {
        const embed = new EmbedBuilder()
            .setTitle('Bem-vindo ao Bot de Whitelist!')
            .setDescription(`
**Como usar o bot:**

1. **Iniciar o processo de whitelist:**  
   Use o comando \`!whitelist [ID do jogador]\`. O bot irá criar um canal temporário para você realizar um questionário.

2. **Responder ao questionário:**  
   O bot enviará uma pergunta por vez no canal temporário. Responda clicando nos botões fornecidos.

3. **Instruções adicionais:**  
   - As respostas devem ser enviadas clicando nos botões fornecidos.
   - Certifique-se de fornecer o ID do jogador corretamente.

**Exemplo de uso:**
- Comando para iniciar o questionário: \`!whitelist 12345\`

Se tiver dúvidas, entre em contato com o administrador do servidor.
            `)
            .setColor('#0099ff')
            .setFooter({ text: 'Bot de Whitelist' });

        channel.send({ embeds: [embed] })
            .then(() => console.log('Mensagem de boas-vindas enviada com sucesso.'))
            .catch(err => console.error('Erro ao enviar a mensagem de boas-vindas:', err));
    } else {
        console.error(`Canal com ID ${welcomeChannelID} não encontrado.`);
    }
}

client.login(process.env.TOKEN);
