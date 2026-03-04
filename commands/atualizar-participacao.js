const { SlashCommandBuilder } = require('discord.js');
const LootSplitHandler = require('../handlers/lootSplitHandler');
const LootSplitUI = require('../handlers/lootSplitUI');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('atualizar-participação')
    .setDescription('Atualiza a taxa de participação de um membro no evento encerrado')
    .addUserOption(option =>
      option.setName('membro')
        .setDescription('Membro para atualizar')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('taxa')
        .setDescription('Porcentagem de participação (0 a 100)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100)
    ),

  async execute(interaction, client) {
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isADM && !isCaller) {
      return interaction.reply({
        content: '❌ Apenas ADMs ou Callers podem usar este comando!',
        ephemeral: true
      });
    }

    // Verificar se está no canal de eventos encerrados
    if (!interaction.channel.name.startsWith('💰-')) {
      return interaction.reply({
        content: '❌ Este comando só pode ser usado em canais de eventos encerrados (que começam com 💰)!',
        ephemeral: true
      });
    }

    const member = interaction.options.getUser('membro');
    const taxa = interaction.options.getInteger('taxa');

    // Extrair eventId da mensagem fixada ou do último embed
    const messages = await interaction.channel.messages.fetch({ limit: 10 });
    const lootMessage = messages.find(m => 
      m.embeds.length > 0 && 
      m.embeds[0].footer?.text.includes('ID: evt_')
    );

    if (!lootMessage) {
      return interaction.reply({
        content: '❌ Não encontrei o painel do lootsplit neste canal!',
        ephemeral: true
      });
    }

    const eventIdMatch = lootMessage.embeds[0].footer.text.match(/ID: (evt_[\w_]+)/);
    if (!eventIdMatch) {
      return interaction.reply({
        content: '❌ ID do evento não encontrado!',
        ephemeral: true
      });
    }

    const eventId = eventIdMatch[1];

    // Garantir que os dados estão carregados
    LootSplitHandler.loadSimulations();

    const simulation = LootSplitHandler.simulatedEvents.get(eventId);

    if (!simulation) {
      return interaction.reply({
        content: '❌ Evento não encontrado! Faça a simulação primeiro usando o botão "🔢 Simular Evento".',
        ephemeral: true
      });
    }

    if (simulation.archived) {
      return interaction.reply({
        content: '❌ Este evento já foi arquivado e não pode mais ser modificado!',
        ephemeral: true
      });
    }

    // Atualizar ou adicionar participante
    const existingParticipant = simulation.distribuicao.find(d => d.userId === member.id);

    if (existingParticipant) {
      existingParticipant.presence = taxa;
      existingParticipant.valorReceber = Math.floor(simulation.valorPorPessoa * (taxa / 100));
    } else {
      // Adicionar novo participante
      simulation.distribuicao.push({
        userId: member.id,
        presence: taxa,
        valorReceber: Math.floor(simulation.valorPorPessoa * (taxa / 100)),
        tempoReal: null // Sem tempo real pois foi adicionado manualmente
      });
    }

    // Recalcular total
    simulation.totalDistribuido = simulation.distribuicao.reduce((acc, p) => acc + p.valorReceber, 0);

    // Salvar alterações no arquivo
    LootSplitHandler.saveSimulations();

    // Atualizar mensagem do loot
    const event = LootSplitHandler.getEventFromMessage({ message: lootMessage });
    if (event) {
      const embed = LootSplitUI.createLootPanelEmbed(event, simulation.distribuicao, simulation, interaction.guild.id);
      await lootMessage.edit({ embeds: [embed] });
    }

    await interaction.reply({
      content: `✅ **Participação atualizada manualmente!**\n\n` +
        `👤 **Membro:** ${member}\n` +
        `📊 **Nova Taxa:** ${taxa}%\n` +
        `💰 **Valor a Receber:** 🪙 ${Math.floor(simulation.valorPorPessoa * (taxa / 100)).toLocaleString()}\n\n` +
        `⚠️ *Esta é uma alteração manual que sobrescreve o tempo automático.*\n` +
        `*Use /saldo para verificar o extrato.*`,
      ephemeral: false
    });
  }
};
