const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

class LootSplitUI {
  static createSimulationModal(eventId) {
    const modal = new ModalBuilder()
      .setCustomId(`modal_simulate_${eventId}`)
      .setTitle('💰 Simular Divisão de Loot');

    const valorInput = new TextInputBuilder()
      .setCustomId('valor_total')
      .setLabel('Valor total do loot')
      .setPlaceholder('Ex: 1000000')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const reparoInput = new TextInputBuilder()
      .setCustomId('valor_reparo')
      .setLabel('Valor para reparo (opcional)')
      .setPlaceholder('Ex: 50000')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const ajustesInput = new TextInputBuilder()
      .setCustomId('ajustes')
      .setLabel('Ajustes por jogador (opcional)')
      .setPlaceholder('@usuario: 80\n@outro: 120')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(valorInput),
      new ActionRowBuilder().addComponents(reparoInput),
      new ActionRowBuilder().addComponents(ajustesInput)
    );

    return modal;
  }

  // 🆕 CORREÇÃO: Adicionado método que estava faltando
  static createUpdateParticipationModal(eventId) {
    const modal = new ModalBuilder()
      .setCustomId(`modal_update_participation_${eventId}`)
      .setTitle('📝 Atualizar Participação');

    const dadosInput = new TextInputBuilder()
      .setCustomId('dados_participacao')
      .setLabel('Dados de participação')
      .setPlaceholder('@usuario:01:30:00\n@outro:02:15:30')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    modal.addComponents(new ActionRowBuilder().addComponents(dadosInput));

    return modal;
  }

  static createFinishedEventPanel(event, duracaoMs) {
    const horas = Math.floor(duracaoMs / (1000 * 60 * 60));
    const minutos = Math.floor((duracaoMs % (1000 * 60 * 60)) / (1000 * 60));

    const embed = new EmbedBuilder()
      .setTitle('📦 EVENTO FINALIZADO - AGUARDANDO LOOTSPLIT')
      .setDescription(
        `**${event.nome}** foi finalizado!\n\n` +
        `⏱️ Duração: ${horas}h ${minutos}m\n` +
        `👥 Participantes: ${event.participantes?.length || 0}\n\n` +
        `Clique no botão abaixo para simular a divisão do loot.`
      )
      .setColor(0xF39C12);

    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`simulate_loot_${event.id}`)
          .setLabel('💰 Simular Lootsplit')
          .setStyle(ButtonStyle.Primary)
      );

    return { embeds: [embed], components: [buttons] };
  }

  static createSimulationResultEmbed(evento, valorTotal, valorReparo, resultado) {
    const fields = [];

    fields.push(
      { name: '💎 Valor Total', value: `🪙 ${valorTotal.toLocaleString()}`, inline: true },
      { name: '🔧 Reparo', value: `🪙 ${valorReparo.toLocaleString()}`, inline: true },
      { name: '💸 Taxa Guilda', value: `${resultado.taxaPercentual}% (🪙 ${resultado.taxa.toLocaleString()})`, inline: true },
      { name: '💵 Valor a Distribuir', value: `🪙 ${resultado.valorDistribuir.toLocaleString()}`, inline: false }
    );

    let distribuicaoText = '';
    for (const [userId, dados] of Object.entries(resultado.distribuicao)) {
      const ajusteText = dados.ajuste ? ` [${dados.ajuste}]` : '';
      distribuicaoText += `<@${userId}>: 🪙 ${dados.valor.toLocaleString()} (${dados.porcentagem}%)${ajusteText}\n`;
    }

    if (distribuicaoText) {
      fields.push({ name: '📊 Distribuição', value: distribuicaoText.substring(0, 1024), inline: false });
    }

    return new EmbedBuilder()
      .setTitle('💰 RESULTADO DA SIMULAÇÃO')
      .setDescription(`Evento: **${evento.nome}**`)
      .setColor(0x2ECC71)
      .addFields(fields)
      .setTimestamp();
  }
}

module.exports = LootSplitUI;
