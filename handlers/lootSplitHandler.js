const LootSplitCore = require('./lootSplitCore');
const LootSplitUI = require('./lootSplitUI');

class LootSplitHandler {
  // Delegar para LootSplitCore
  static get simulatedEvents() {
    return LootSplitCore.simulatedEvents;
  }

  static loadSimulations() {
    return LootSplitCore.loadSimulations();
  }

  static saveSimulations() {
    return LootSplitCore.saveSimulations();
  }

  static calculatePresenceFromTime(presenceData, userId) {
    return LootSplitCore.calculatePresenceFromTime(presenceData, userId);
  }

  static getEventFromMessage(interaction) {
    return LootSplitCore.getEventFromMessage(interaction);
  }

  static async sendInitialLootPanel(channel, event, participants, presenceData) {
    return LootSplitCore.sendInitialLootPanel(channel, event, participants, presenceData);
  }

  // Processar simulação de loot
  static async processSimulation(interaction, eventId) {
    const valorBau = parseInt(interaction.fields.getTextInputValue('loot_valor_bau'));
    const reparo = parseInt(interaction.fields.getTextInputValue('loot_reparo')) || 0;

    if (isNaN(valorBau) || valorBau <= 0) {
      return interaction.reply({
        content: '❌ Valor do baú inválido!',
        ephemeral: true
      });
    }

    if (reparo < 0 || reparo >= valorBau) {
      return interaction.reply({
        content: '❌ Valor de reparo inválido!',
        ephemeral: true
      });
    }

    const event = this.getEventFromMessage(interaction);
    if (!event) {
      return interaction.reply({
        content: '❌ Evento não encontrado!',
        ephemeral: true
      });
    }

    const simulation = LootSplitCore.createSimulation(
      eventId, 
      event, 
      valorBau, 
      reparo, 
      interaction.guild.id
    );

    const embed = LootSplitUI.createLootPanelEmbed(event, simulation.distribuicao, simulation, interaction.guild.id);
    const buttons = LootSplitUI.createLootPanelButtons(eventId, 'simulated');

    await interaction.message.edit({
      embeds: [embed],
      components: buttons
    });

    await interaction.reply({
      content: `✅ Simulação realizada com base no tempo de presença!\n` +
        `💸 Taxa Guilda (${simulation.taxaGuilda}%): 🪙 ${simulation.valorTaxa.toLocaleString()}\n` +
        `📦 Total distribuído: 🪙 ${simulation.totalDistribuido.toLocaleString()}`,
      ephemeral: true
    });
  }

  // Processar atualização de participação
  static async processUpdateParticipation(interaction, eventId) {
    const event = this.getEventFromMessage(interaction);

    if (!event) {
      return interaction.reply({
        content: '❌ Evento não encontrado!',
        ephemeral: true
      });
    }

    const simulation = LootSplitCore.simulatedEvents.get(eventId);
    if (simulation && simulation.archived) {
      return interaction.reply({
        content: '❌ Este evento já foi arquivado e não pode mais ser modificado!',
        ephemeral: true
      });
    }

    const updates = {
      addMembersRaw: interaction.fields.getTextInputValue('add_members'),
      updatePresenceRaw: interaction.fields.getTextInputValue('update_presence'),
      removeMembersRaw: interaction.fields.getTextInputValue('remove_members')
    };

    const result = LootSplitCore.updateParticipation(eventId, event, updates);

    if (!result.modified) {
      return interaction.reply({
        content: 'ℹ️ Nenhuma alteração realizada.',
        ephemeral: true
      });
    }

    const status = result.simulation.archived 
      ? 'archived' 
      : (result.simulation.valorBau > 0 ? 'simulated' : 'pending');

    const embed = LootSplitUI.createLootPanelEmbed(event, result.simulation.distribuicao, result.simulation, interaction.guild.id);
    const buttons = LootSplitUI.createLootPanelButtons(eventId, status);

    await interaction.message.edit({
      embeds: [embed],
      components: buttons
    });

    await interaction.reply({
      content: '✅ Participação atualizada com sucesso!',
      ephemeral: true
    });
  }

  // Arquivar e depositar
  static async archiveAndDeposit(interaction, eventId) {
    const event = this.getEventFromMessage(interaction);
    if (!event) {
      return interaction.reply({
        content: '❌ Evento não encontrado!',
        ephemeral: true
      });
    }

    const result = await LootSplitCore.archiveAndDeposit(eventId, event, interaction);

    if (!result.success) {
      return interaction.reply({
        content: `❌ ${result.error}`,
        ephemeral: true
      });
    }

    const { simulation, depositosRealizados, falhas, channelDeletado } = result;

    const embed = LootSplitUI.createLootPanelEmbed(event, simulation.distribuicao, simulation, interaction.guild.id);
    const buttons = LootSplitUI.createLootPanelButtons(eventId, 'archived');

    await interaction.message.edit({
      embeds: [embed],
      components: buttons
    });

    let resposta = `✅ **Evento arquivado com sucesso!**\n\n` +
      `💸 Taxa Guilda: ${simulation.taxaGuilda}% (🪙 ${simulation.valorTaxa.toLocaleString()})\n` +
      `💰 Total distribuído: 🪙 ${simulation.totalDistribuido.toLocaleString()}\n` +
      `👥 Participantes atendidos: ${depositosRealizados.length}`;

    if (falhas.length > 0) {
      resposta += `\n⚠️ Falhas: ${falhas.length} usuários`;
    }

    if (channelDeletado) {
      resposta += `\n\n🗑️ **Este canal será deletado em 5 segundos...**`;
    }

    await interaction.reply({
      content: resposta,
      ephemeral: true
    });
  }
}

module.exports = LootSplitHandler;
