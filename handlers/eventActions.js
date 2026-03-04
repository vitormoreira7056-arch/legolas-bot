const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const ConfigHandler = require('./configHandler');
const BankCore = require('./bank/bankCore');
const db = require('../utils/database');
const SetupManager = require('./setupManager');
const EventHandler = require('./eventHandler');
const LootSplitHandler = require('./lootSplitHandler');
const LootSplitUI = require('./lootSplitUI');
const EventStatsHandler = require('./eventStatsHandler');

class EventActions {
  static async handleCriarEventoCustom(interaction) {
    const modal = EventHandler.createCustomEventModal();
    await interaction.showModal(modal);
  }

  static async handleCriarPresetEvent(interaction, tipo) {
    const modal = EventHandler.createPresetEventModal(tipo);
    await interaction.showModal(modal);
  }

  static async handleEventAction(interaction, customId) {
    const parts = customId.split('_');
    const action = parts[1];
    const eventId = parts.slice(2).join('_');

    switch (action) {
      case 'participar':
        await EventHandler.handleParticipar(interaction, eventId);
        break;
      case 'iniciar':
        await EventHandler.handleIniciar(interaction, eventId);
        break;
      case 'pausar':
        await EventHandler.handlePausar(interaction, eventId);
        break;
      case 'voltar':
        await EventHandler.handleVoltar(interaction, eventId);
        break;
      case 'trancar':
        await EventHandler.handleTrancar(interaction, eventId);
        break;
      case 'destrancar':
        await EventHandler.handleDestrancar(interaction, eventId);
        break;
      case 'cancelar':
        await EventHandler.handleCancelar(interaction, eventId);
        break;
      case 'finalizar':
        await EventHandler.handleFinalizar(interaction, eventId);
        break;
      default:
        await interaction.reply({ content: '❌ Ação desconhecida!', ephemeral: true });
    }
  }

  static async handleSimulateLoot(interaction, eventId) {
    const modal = LootSplitUI.createSimulationModal(eventId);
    await interaction.showModal(modal);
  }

  static async handleResimulateLoot(interaction, eventId) {
    const modal = LootSplitUI.createSimulationModal(eventId);
    await interaction.showModal(modal);
  }

  static async handleArchiveLoot(interaction, eventId) {
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isADM && !isCaller) {
      return interaction.reply({
        content: '❌ Apenas ADMs ou Callers podem arquivar o evento!',
        ephemeral: true
      });
    }

    await LootSplitHandler.archiveAndDeposit(interaction, eventId);

    await EventStatsHandler.updatePanel(interaction.guild);
  }

  static async handleUpdateParticipation(interaction, eventId) {
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isADM && !isCaller) {
      return interaction.reply({
        content: '❌ Apenas ADMs ou Callers podem atualizar participações!',
        ephemeral: true
      });
    }

    const modal = LootSplitUI.createUpdateParticipationModal(eventId);
    await interaction.showModal(modal);
  }

  static async handleEventStatsFilter(interaction) {
    await EventStatsHandler.handleFilterChange(interaction);
  }
}

// 🆕 CORREÇÃO: Adicionar Map de eventos ativos
EventActions.activeEvents = new Map();

module.exports = EventActions;