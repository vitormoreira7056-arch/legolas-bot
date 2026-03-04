const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../utils/database');

// Armazenar transferências pendentes
global.transferenciasPendentes = global.transferenciasPendentes || new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transferir-saldo')
    .setDescription('Transfere saldo para outro membro da guilda')
    .addUserOption(option =>
      option.setName('membro')
        .setDescription('Membro que vai receber a transferência')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('valor')
        .setDescription('Valor a ser transferido')
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction, client) {
    const membro = interaction.options.getUser('membro');
    const valor = interaction.options.getInteger('valor');

    // Validações
    if (membro.id === interaction.user.id) {
      return interaction.reply({
        content: '❌ Você não pode transferir para si mesmo!',
        ephemeral: true
      });
    }

    if (membro.bot) {
      return interaction.reply({
        content: '❌ Não pode transferir para bots!',
        ephemeral: true
      });
    }

    const remetente = db.getUser(interaction.user.id);

    if (remetente.saldo < valor) {
      return interaction.reply({
        content: `❌ Saldo insuficiente!\n💰 Seu saldo: 🪙 ${remetente.saldo.toLocaleString()}\n💸 Valor a transferir: 🪙 ${valor.toLocaleString()}`,
        ephemeral: true
      });
    }

    // Criar ID único para a transferência
    const transferId = `transfer_${Date.now()}_${interaction.user.id}_${membro.id}`;

    // Salvar dados da transferência
    global.transferenciasPendentes.set(transferId, {
      id: transferId,
      remetenteId: interaction.user.id,
      destinatarioId: membro.id,
      valor: valor,
      status: 'pendente',
      timestamp: Date.now()
    });

    // Criar embed de confirmação para o destinatário
    const embedConfirmacao = new EmbedBuilder()
      .setTitle('💱 **NOVA TRANSFERÊNCIA RECEBIDA**')
      .setDescription(
        `> Você recebeu uma solicitação de transferência!\n\n` +
        `**👤 De:** ${interaction.user}\n` +
        `**💰 Valor:** 🪙 ${valor.toLocaleString()}\n` +
        `**📅 Data:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
        `*Aceite ou recuse a transferência abaixo:*`
      )
      .setColor(0xF1C40F)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    const botoesConfirmacao = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`confirmar_transferencia_${transferId}`)
          .setLabel('✅ Aceitar Transferência')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`recusar_transferencia_${transferId}`)
          .setLabel('❌ Recusar')
          .setStyle(ButtonStyle.Danger)
      );

    try {
      // Enviar DM para o destinatário
      await membro.send({
        embeds: [embedConfirmacao],
        components: [botoesConfirmacao]
      });

      // Responder ao remetente
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('⏳ **TRANSFERÊNCIA ENVIADA**')
            .setDescription(
              `> Solicitação de transferência enviada!\n\n` +
              `**👤 Para:** ${membro}\n` +
              `**💰 Valor:** 🪙 ${valor.toLocaleString()}\n` +
              `**📊 Seu Saldo Atual:** 🪙 ${remetente.saldo.toLocaleString()}\n\n` +
              `*Aguardando confirmação do destinatário...*\n` +
              `*O valor será debitado apenas após a confirmação.*`
            )
            .setColor(0xF39C12)
            .setTimestamp()
        ],
        ephemeral: true
      });

    } catch (error) {
      // Se não conseguir enviar DM
      global.transferenciasPendentes.delete(transferId);

      await interaction.reply({
        content: `❌ Não foi possível enviar a solicitação para ${membro}.\nVerifique se o usuário tem DMs abertas!`,
        ephemeral: true
      });
    }
  }
};
