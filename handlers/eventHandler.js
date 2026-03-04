const { ChannelType, PermissionFlagsBits } = require('discord.js');
const EventEmbeds = require('./eventEmbeds');
const EventModals = require('./eventModals');
const EventActions = require('./actions/eventActions'); // 🆕 CORREÇÃO: Importar da pasta actions

class EventHandler {
  // Delegar armazenamento para EventActions
  static get activeEvents() {
    return EventActions.activeEvents;
  }

  // ========== PAINEL E MODAIS ==========

  static createEventPanelEmbed() {
    return EventEmbeds.createEventPanelEmbed();
  }

  static createEventPanelButtons() {
    return EventEmbeds.createEventPanelButtons();
  }

  static createCustomEventModal() {
    return EventModals.createCustomEventModal();
  }

  static createPresetEventModal(tipo) {
    return EventModals.createPresetEventModal(tipo);
  }

  static getEventTypeName(tipo) {
    return EventEmbeds.getEventTypeName(tipo);
  }

  // ========== CRIAR EVENTO ==========

  static async createEvent(interaction, eventData) {
    const guild = interaction.guild;
    const creator = interaction.member;

    const catEventosAtivos = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name === '⚔️ EVENTOS ATIVOS'
    );
    const chParticipar = guild.channels.cache.find(
      c => c.name === '👋╠participar'
    );

    if (!catEventosAtivos || !chParticipar) {
      throw new Error('Canais necessários não encontrados! Execute /instalar primeiro.');
    }

    // Criar canal de voz
    const voiceChannel = await guild.channels.create({
      name: `${EventEmbeds.getEventEmoji(eventData.tipo)} ${eventData.nome}`,
      type: ChannelType.GuildVoice,
      parent: catEventosAtivos.id,
      userLimit: eventData.vagas || 0,
      permissionOverwrites: [
        { 
          id: guild.id, 
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] 
        }
      ]
    });

    // Criar evento
    const eventId = `evt_${Date.now()}_${creator.id}`;
    const event = {
      id: eventId,
      nome: eventData.nome,
      tipo: eventData.tipo,
      descricao: eventData.descricao,
      requisitos: eventData.requisitos,
      horario: eventData.horario,
      vagas: eventData.vagas,
      criador: creator.id,
      voiceChannelId: voiceChannel.id,
      participants: [],
      status: 'aguardando',
      createdAt: new Date(),
      guildId: guild.id
    };

    // 🆕 CORREÇÃO: Usar o activeEvents do EventActions importado
    EventActions.activeEvents.set(eventId, event);

    // Criar mensagem de participação
    const embed = EventEmbeds.createEventParticipationEmbed(event, creator);
    const buttons = EventEmbeds.createWaitingButtons(eventId);

    const msgParticipar = await chParticipar.send({
      content: `📢 @everyone Novo evento criado!`,
      embeds: [embed],
      components: buttons
    });

    event.participarMessageId = msgParticipar.id;
    event.participarChannelId = chParticipar.id;

    return {
      success: true,
      eventId: eventId,
      voiceChannel: voiceChannel
    };
  }

  // ========== AÇÕES (DELEGAR PARA EventActions) ==========

  static async handleParticipar(interaction, eventId) {
    return EventActions.handleParticipar(interaction, eventId);
  }

  static async handleIniciar(interaction, eventId) {
    return EventActions.handleIniciar(interaction, eventId);
  }

  static async handlePausar(interaction, eventId) {
    return EventActions.handlePausar(interaction, eventId);
  }

  static async handleVoltar(interaction, eventId) {
    return EventActions.handleVoltar(interaction, eventId);
  }

  static async handleTrancar(interaction, eventId) {
    return EventActions.handleTrancar(interaction, eventId);
  }

  static async handleDestrancar(interaction, eventId) {
    return EventActions.handleDestrancar(interaction, eventId);
  }

  static async handleCancelar(interaction, eventId) {
    return EventActions.handleCancelar(interaction, eventId);
  }

  static async handleFinalizar(interaction, eventId) {
    return EventActions.handleFinalizar(interaction, eventId);
  }
}

module.exports = EventHandler;