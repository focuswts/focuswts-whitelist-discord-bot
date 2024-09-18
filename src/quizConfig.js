// quizConfig.js

module.exports = {
    passingScore: 5, // Defina a pontuação mínima para passar no questionário
    questions: [
        {
            question: "Qual é a regra mais importante em nosso servidor?",
            options: [
                "Fazer qualquer coisa que quiser",
                "Respeitar as regras do servidor e outros jogadores",
                "Ignorar as regras se estiver em uma missão",
                "Seguir apenas as regras do roleplay"
            ],
            answer: 1 // Índice da alternativa correta (0 = primeira opção)
        },
        {
            question: "O que você deve fazer se encontrar um bug no servidor?",
            options: [
                "Explorar o bug ao máximo",
                "Ignorar o bug e continuar jogando",
                "Informar a equipe de administração sobre o bug",
                "Tentar resolver o bug sozinho"
            ],
            answer: 2
        },
        {
            question: "Qual é a principal função do seu personagem no roleplay?",
            options: [
                "Se divertir sem propósito",
                "Seguir o enredo e interagir conforme o roleplay",
                "Causar caos na cidade",
                "Ignorar interações e focar em ganhar dinheiro"
            ],
            answer: 1
        },
        {
            question: "Como lidar com conflitos com outros jogadores?",
            options: [
                "Resolver com violência",
                "Resolver pacificamente e, se necessário, chamar a administração",
                "Ignorar o conflito",
                "Sair do servidor e voltar mais tarde"
            ],
            answer: 1
        },
        {
            question: "Qual é a política sobre uso de cheats ou hacks?",
            options: [
                "Cheats são permitidos se não forem detectados",
                "Hacks são tolerados em emergências",
                "Uso de cheats ou hacks é proibido e punido com banimento",
                "Cheats são permitidos para VIPs"
            ],
            answer: 2
        }
        // Adicione mais perguntas conforme necessário
    ]
};
