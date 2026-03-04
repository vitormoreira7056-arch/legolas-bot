const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class EventEmbeds {
  static colors = {
    custom: 0x3498DB,
    raid_avalon: 0x9B59B6,
    gank: 0xE74C3C,
    bau_dourado: 0xF1C40F
  };

  static emojis = {
    custom: '⚔️',
    raid_avalon: '🐉',
    gank: '🔪',
    bau_dourado: '💰'
  };

  static getEventTypeName(tipo) {
    const names = {
      raid_avalon: 'Raid Avalon',
      gank: 'GANK',
      bau_dourado: 'Baú Dourado'
    };
    return names[tipo] || 'Evento';
  }

  static getEventEmoji(tipo) {
    return this.emojis[tipo] || '⚔️';
  }

  static getEventColor(tipo) {
    return this.colors[tipo] || 0x3498DB;
  }

  // Painel principal de criação
  static createEventPanelEmbed() {
    return new EmbedBuilder()
      .setTitle('⚔️ **CENTRAL DE EVENTOS**')
      .setDescription(
        '> Bem-vindo à central de criação de eventos!\n\n' +
        '**🎯 Tipos de Eventos:**\n' +
        '```yaml\n' +
        'Criar Evento: Evento personalizado\n' +
        'Raid Avalon: Dungeon endgame PvE\n' +
        'GANK: Caçada PvP em grupo\n' +
        'Baú Dourado: Conteúdo PvP massivo\n' +
        '```\n\n' +
        '*Selecione um tipo abaixo para criar*'
      )
      .setColor(0xE74C3C)
      .setThumbnail('https://i.imgur.com/8N1WvGK.png')
      .setFooter({ text: 'Sistema de Eventos • Albion Guild' })
      .setTimestamp();
  }

  static createEventPanelButtons() {
    return [
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('criar_evento_custom')
            .setLabel('✨ Criar Evento')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⚔️'),
          new ButtonBuilder()
            .setCustomId('criar_raid_avalon')
            .setLabel('🏰 Raid Avalon')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🐉'),
          new ButtonBuilder()
            .setCustomId('criar_gank')
            .setLabel('🔪 GANK')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⚔️'),
          new ButtonBuilder()
            .setCustomId('criar_bau_dourado')
            .setLabel('💰 Baú Dourado')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🏆')
        )
    ];
  }

  // Embed de participação
  static createEventParticipationEmbed(event, creator) {
    const statusEmojis = {
      aguardando: '⏳',
      em_andamento: '🔴',
      pausado: '⏸️',
      finalizado: '✅'
    };

    const statusTexts = {
      aguardando: 'Aguardando início',
      em_andamento: 'Em andamento',
      pausado: 'Pausado',
      finalizado: 'Finalizado'
    };

    const participantsList = event.participants.length > 0 
      ? event.participants.map((p, i) => `${i + 1}. <@${p}>`).join('\n')
      : '*Nenhum participante ainda*';

    const vagasText = event.vagas 
      ? `${event.participants.length}/${event.vagas}` 
      : `${event.participants.length}/∞`;

    return new EmbedBuilder()
      .setTitle(`${this.getEventEmoji(event.tipo)} **${event.nome}**`)
      .setDescription(
        `> Criado por ${creator}\n\n` +
        `**📝 Descrição:**\n${event.descricao || 'Sem descrição'}\n\n` +
        `${event.requisitos ? `**⚔️ Requisitos:**\n${event.requisitos}\n\n` : ''}` +
        `**⏰ Início:** ${event.horario}\n` +
        `**👥 Vagas:** ${vagasText}\n` +
        `**📊 Status:** ${statusEmojis[event.status]} ${statusTexts[event.status]}`
      )
      .setColor(this.getEventColor(event.tipo))
      .addFields({
        name: `🎮 Participantes (${event.participants.length})`,
        value: participantsList.substring(0, 1024) || '*Vazio*',
        inline: false
      })
      .setFooter({ text: `ID: ${event.id} • Clique nos botões abaixo` })
      .setTimestamp();
  }

  // Botões por status
  static createWaitingButtons(eventId) {
    return [
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_participar_${eventId}`)
            .setLabel('✋ Participar')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✋'),
          new ButtonBuilder()
            .setCustomId(`evt_iniciar_${eventId}`)
            .setLabel('▶️ Iniciar')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('▶️'),
          new ButtonBuilder()
            .setCustomId(`evt_cancelar_${eventId}`)
            .setLabel('❌ Cancelar')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
        )
    ];
  }

  static createRunningButtons(eventId) {
    return [
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_participar_${eventId}`)
            .setLabel('✋ Participar')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✋'),
          new ButtonBuilder()
            .setCustomId(`evt_pausar_${eventId}`)
            .setLabel('⏸️ Pausar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⏸️'),
          new ButtonBuilder()
            .setCustomId(`evt_finalizar_${eventId}`)
            .setLabel('🏁 Finalizar')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🏁'),
          new ButtonBuilder()
            .setCustomId(`evt_trancar_${eventId}`)
            .setLabel('🔒 Trancar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔒')
        )
    ];
  }

  static createPausedButtons(eventId) {
    return [
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_participar_${eventId}`)
            .setLabel('✋ Participar')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✋')
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`evt_voltar_${eventId}`)
            .setLabel('▶️ Voltar')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('▶️'),
          new ButtonBuilder()
            .setCustomId(`evt_finalizar_${eventId}`)
            .setLabel('🏁 Finalizar')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🏁'),
          new ButtonBuilder()
            .setCustomId(`evt_trancar_${eventId}`)
            .setLabel('🔒 Trancar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔒')
        )
    ];
  }

  static createLockedButtons(eventId) {
    return [
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_participar_${eventId}`)
            .setLabel('🔒 Trancado')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔒')
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`evt_pausar_${eventId}`)
            .setLabel('⏸️ Pausar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⏸️'),
          new ButtonBuilder()
            .setCustomId(`evt_finalizar_${eventId}`)
            .setLabel('🏁 Finalizar')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🏁'),
          new ButtonBuilder()
            .setCustomId(`evt_destrancar_${eventId}`)
            .setLabel('🔓 Destrancar')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔓')
        )
    ];
  }

  // Embed de evento finalizado (arquivo)
  static createArchivedEmbed(event) {
    return new EmbedBuilder()
      .setTitle(`${this.getEventEmoji(event.tipo)} **${event.nome}** - ENCERRADO`)
      .setDescription(
        `**📊 Resumo do Evento:**\n` +
        `• Criado por: <@${event.criador}>\n` +
        `• Iniciado em: <t:${Math.floor(event.createdAt.getTime() / 1000)}:F>\n` +
        `• Finalizado em: <t:${Math.floor(Date.now() / 1000)}:F>\n` +
        `• Total de participantes: ${event.participants.length}\n\n` +
        `**👥 Lista de Participantes:**\n` +
        (event.participants.map(id => `<@${id}>`).join('\n') || '*Nenhum*')
      )
      .setColor(0x2ECC71)
      .setFooter({ text: 'Evento finalizado • Arquivo' })
      .setTimestamp();
  }
}

module.exports = EventEmbeds;
