const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');

class EventHandler {
  static getEventTypeName(tipo) {
    const nomes = {
      'raid_avalon': '🏰 Raid Avalon',
      'gank': '⚔️ Gank',
      'bau_dourado': '💰 Baú Dourado',
      'custom': '📝 Personalizado'
    };
    return nomes[tipo] || '⚔️ Evento';
  }

  static createCustomEventModal() {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

    const modal = new ModalBuilder()
      .setCustomId('modal_evento_custom')
      .setTitle('📝 Criar Evento');

    const nomeInput = new TextInputBuilder()
      .setCustomId('evt_nome')
      .setLabel('Nome do Evento')
      .setPlaceholder('Ex: Gank Brecilien')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const descInput = new TextInputBuilder()
      .setCustomId('evt_desc')
      .setLabel('Descrição')
      .setPlaceholder('Detalhes do evento...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(500);

    const reqInput = new TextInputBuilder()
      .setCustomId('evt_req')
      .setLabel('Requisitos')
      .setPlaceholder('IP 1300+, Montaria 8.3')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(200);

    const horarioInput = new TextInputBuilder()
      .setCustomId('evt_horario')
      .setLabel('Horário')
      .setPlaceholder('21:00 BRT')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nomeInput),
      new ActionRowBuilder().addComponents(descInput),
      new ActionRowBuilder().addComponents(reqInput),
      new ActionRowBuilder().addComponents(horarioInput)
    );

    return modal;
  }

  static createPresetEventModal(tipo) {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

    const modal = new ModalBuilder()
      .setCustomId(`modal_evento_${tipo}`)
      .setTitle(`📝 ${this.getEventTypeName(tipo)}`);

    const descInput = new TextInputBuilder()
      .setCustomId('evt_desc')
      .setLabel('Descrição')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(500);

    const reqInput = new TextInputBuilder()
      .setCustomId('evt_req')
      .setLabel('Requisitos')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(200);

    const horarioInput = new TextInputBuilder()
      .setCustomId('evt_horario')
      .setLabel('Horário')
      .setPlaceholder('21:00')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const vagasInput = new TextInputBuilder()
      .setCustomId('evt_vagas')
      .setLabel('Vagas (opcional)')
      .setPlaceholder('20')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(descInput),
      new ActionRowBuilder().addComponents(reqInput),
      new ActionRowBuilder().addComponents(horarioInput),
      new ActionRowBuilder().addComponents(vagasInput)
    );

    return modal;
  }

  static async createEvent(interaction, eventData) {
    const guild = interaction.guild;
    const categoriaEventos = guild.channels.cache.find(c => c.name === '⚔️ EVENTOS ATIVOS' && c.type === 4);
    const canalParticipar = guild.channels.cache.find(c => c.name === '👋╠participar');

    if (!categoriaEventos) throw new Error('Categoria ⚔️ EVENTOS ATIVOS não encontrada!');
    if (!canalParticipar) throw new Error('Canal 👋╠participar não encontrado!');

    const eventId = `evt_${Date.now()}_${interaction.user.id}`;

    const voiceChannel = await guild.channels.create({
      name: `🔊 ${eventData.nome}`,
      type: ChannelType.GuildVoice,
      parent: categoriaEventos.id,
      userLimit: eventData.vagas || 0
    });

    const evento = {
      id: eventId,
      nome: eventData.nome,
      tipo: eventData.tipo,
      descricao: eventData.descricao,
      requisitos: eventData.requisitos,
      horario: eventData.horario,
      vagas: eventData.vagas,
      criadorId: interaction.user.id,
      textChannelId: canalParticipar.id,
      voiceChannelId: voiceChannel.id,
      participantes: [],
      participacaoIndividual: new Map(),
      status: 'aguardando',
      trancado: false,
      criadoEm: Date.now(),
      guildId: guild.id,
      painelMessageId: null
    };

    // Usar EventActions.activeEvents
    const EventActions = require('./actions/eventActions');
    EventActions.activeEvents.set(eventId, evento);

    const embed = this.createEventEmbed(evento, interaction.member);
    const buttons = this.createEventButtonsByStatus(evento);

    const membroRole = guild.roles.cache.find(r => r.name === 'Membro');
    const mentionText = membroRole ? `<@&${membroRole.id}>` : '@everyone';

    const painelMessage = await canalParticipar.send({
      content: `📢 ${mentionText} Novo evento!`,
      embeds: [embed],
      components: buttons
    });

    evento.painelMessageId = painelMessage.id;

    return { textChannel: canalParticipar, voiceChannel, eventId, painelMessage };
  }

  static createEventEmbed(evento, criador) {
    const statusEmojis = {
      'aguardando': '⏳',
      'em_andamento': '🔥',
      'pausado': '⏸️',
      'encerrado': '✅',
      'cancelado': '❌'
    };

    const statusColors = {
      'aguardando': 0x5865F2,
      'em_andamento': 0xED4245,
      'pausado': 0xFEE75C,
      'encerrado': 0x57F287,
      'cancelado': 0x99AAB5
    };

    const statusLabels = {
      'aguardando': 'AGUARDANDO',
      'em_andamento': 'EM ANDAMENTO',
      'pausado': 'PAUSADO',
      'encerrado': 'ENCERRADO',
      'cancelado': 'CANCELADO'
    };

    const numParticipantes = evento.participantes?.length || 0;
    const vagasText = evento.vagas ? `/${evento.vagas}` : '';
    const trancadoText = evento.trancado ? ' 🔒 TRANCADO' : '';

    const embed = new EmbedBuilder()
      .setTitle(`${statusEmojis[evento.status]} **${evento.nome}**`)
      .setDescription(evento.descricao || 'Sem descrição')
      .setColor(statusColors[evento.status])
      .addFields(
        { name: '👤 Criador', value: `<@${evento.criadorId}>`, inline: true },
        { name: '🕐 Horário', value: evento.horario, inline: true },
        { name: '👥 Participantes', value: `${numParticipantes}${vagasText}`, inline: true },
        { name: '🔊 Canal', value: `<#${evento.voiceChannelId}>`, inline: false }
      );

    if (evento.requisitos) {
      embed.addFields({ name: '📋 Requisitos', value: evento.requisitos, inline: false });
    }

    if (numParticipantes > 0) {
      const lista = evento.participantes.map(id => `<@${id}>`).join(', ');
      embed.addFields({
        name: `🎮 Participantes (${numParticipantes})`,
        value: lista.length > 1024 ? lista.substring(0, 1021) + '...' : lista,
        inline: false
      });
    }

    embed.setFooter({
      text: `ID: ${evento.id} • ${statusLabels[evento.status]}${trancadoText}`
    });
    embed.setTimestamp();

    return embed;
  }

  // 🆕 MÉTODO PRINCIPAL: Criar botões baseado no status atual do evento
  static createEventButtonsByStatus(evento) {
    const eventId = evento.id;
    const status = evento.status;
    const trancado = evento.trancado;
    const rows = [];

    // ==================== LINHA 1: PARTICIPAR ====================
    const row1 = new ActionRowBuilder();
    
    if (status === 'aguardando' || status === 'em_andamento' || status === 'pausado') {
      if (trancado) {
        // Evento trancado - botão desabilitado
        row1.addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_participar_${eventId}`)
            .setLabel('🔒 Trancado')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );
      } else {
        // Evento aberto - pode participar
        row1.addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_participar_${eventId}`)
            .setLabel('✅ Participar')
            .setStyle(ButtonStyle.Success)
        );
      }

      // Botão Sair/Pausar (apenas quando em andamento)
      if (status === 'em_andamento') {
        row1.addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_voltar_${eventId}`)
            .setLabel('⏸️ Sair do Evento')
            .setStyle(ButtonStyle.Secondary)
        );
      }
    }
    
    if (row1.components.length > 0) rows.push(row1);

    // ==================== LINHA 2: CONTROLES ADMIN ====================
    const row2 = new ActionRowBuilder();
    let temBotaoAdmin = false;

    if (status === 'aguardando') {
      // Status: Aguardando → Mostrar: Iniciar, Cancelar
      row2.addComponents(
        new ButtonBuilder()
          .setCustomId(`evt_iniciar_${eventId}`)
          .setLabel('▶️ Iniciar Evento')
          .setStyle(ButtonStyle.Primary)
      );
      row2.addComponents(
        new ButtonBuilder()
          .setCustomId(`evt_cancelar_${eventId}`)
          .setLabel('❌ Cancelar')
          .setStyle(ButtonStyle.Danger)
      );
      temBotaoAdmin = true;
      
    } else if (status === 'em_andamento') {
      // Status: Em Andamento → Mostrar: Pausar, Finalizar (Iniciar vira Pausar, Cancelar vira Finalizar)
      row2.addComponents(
        new ButtonBuilder()
          .setCustomId(`evt_pausar_${eventId}`)
          .setLabel('⏸️ Pausar Evento')
          .setStyle(ButtonStyle.Secondary)
      );
      row2.addComponents(
        new ButtonBuilder()
          .setCustomId(`evt_finalizar_${eventId}`)
          .setLabel('🏁 Finalizar Evento')
          .setStyle(ButtonStyle.Danger)
      );
      temBotaoAdmin = true;
      
    } else if (status === 'pausado') {
      // Status: Pausado → Mostrar: Retomar, Finalizar
      row2.addComponents(
        new ButtonBuilder()
          .setCustomId(`evt_iniciar_${eventId}`)
          .setLabel('▶️ Retomar Evento')
          .setStyle(ButtonStyle.Primary)
      );
      row2.addComponents(
        new ButtonBuilder()
          .setCustomId(`evt_finalizar_${eventId}`)
          .setLabel('🏁 Finalizar Evento')
          .setStyle(ButtonStyle.Danger)
      );
      temBotaoAdmin = true;
    }

    if (temBotaoAdmin) rows.push(row2);

    // ==================== LINHA 3: TRANCAR/DESTRANCAR ====================
    if (status === 'aguardando' || status === 'em_andamento' || status === 'pausado') {
      const row3 = new ActionRowBuilder();
      
      row3.addComponents(
        new ButtonBuilder()
          .setCustomId(trancado ? `evt_destrancar_${eventId}` : `evt_trancar_${eventId}`)
          .setLabel(trancado ? '🔓 Destrancar' : '🔒 Trancar Evento')
          .setStyle(trancado ? ButtonStyle.Success : ButtonStyle.Secondary)
      );
      
      rows.push(row3);
    }

    return rows;
  }
}

module.exports = EventHandler;
