const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const EventActions = require('./actions/eventActions');

class EventHandler {
  static getEventTypeName(tipo) {
    const nomes = {
      'raid_avalon': '🏰 Raid Avalon',
      'gank': '⚔️ Gank',
      'bau_dourado': '💰 Baú Dourado',
      'custom': '⚔️ Evento Personalizado'
    };
    return nomes[tipo] || '⚔️ Evento';
  }

  static createCustomEventModal() {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

    const modal = new ModalBuilder()
      .setCustomId('modal_evento_custom')
      .setTitle('📝 Criar Evento Personalizado');

    const nomeInput = new TextInputBuilder()
      .setCustomId('evt_nome')
      .setLabel('Nome do Evento')
      .setPlaceholder('Ex: Gank de Brecilien')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const descInput = new TextInputBuilder()
      .setCustomId('evt_desc')
      .setLabel('Descrição')
      .setPlaceholder('Descreva o evento...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(500);

    const reqInput = new TextInputBuilder()
      .setCustomId('evt_req')
      .setLabel('Requisitos')
      .setPlaceholder('Ex: IP 1300+, Montaria 8.3')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(200);

    const horarioInput = new TextInputBuilder()
      .setCustomId('evt_horario')
      .setLabel('Horário de Início')
      .setPlaceholder('Ex: 21:00 BRT')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(nomeInput);
    const row2 = new ActionRowBuilder().addComponents(descInput);
    const row3 = new ActionRowBuilder().addComponents(reqInput);
    const row4 = new ActionRowBuilder().addComponents(horarioInput);

    modal.addComponents(row1, row2, row3, row4);
    return modal;
  }

  static createPresetEventModal(tipo) {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

    const modal = new ModalBuilder()
      .setCustomId(`modal_evento_${tipo}`)
      .setTitle(`📝 ${this.getEventTypeName(tipo)}`);

    const descInput = new TextInputBuilder()
      .setCustomId('evt_desc')
      .setLabel('Descrição/Detalhes')
      .setPlaceholder('Detalhes específicos do evento...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(500);

    const reqInput = new TextInputBuilder()
      .setCustomId('evt_req')
      .setLabel('Requisitos Específicos')
      .setPlaceholder('Requisitos adicionais...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(200);

    const horarioInput = new TextInputBuilder()
      .setCustomId('evt_horario')
      .setLabel('Horário')
      .setPlaceholder('Ex: 21:00')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const vagasInput = new TextInputBuilder()
      .setCustomId('evt_vagas')
      .setLabel('Limite de Vagas (opcional)')
      .setPlaceholder('Ex: 20 (deixe em branco para ilimitado)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const row1 = new ActionRowBuilder().addComponents(descInput);
    const row2 = new ActionRowBuilder().addComponents(reqInput);
    const row3 = new ActionRowBuilder().addComponents(horarioInput);
    const row4 = new ActionRowBuilder().addComponents(vagasInput);

    modal.addComponents(row1, row2, row3, row4);
    return modal;
  }

  static async createEvent(interaction, eventData) {
    const guild = interaction.guild;

    const categoriaEventos = guild.channels.cache.find(c => c.name === '⚔️ EVENTOS ATIVOS' && c.type === 4);
    const canalParticipar = guild.channels.cache.find(c => c.name === '👋╠participar');

    if (!categoriaEventos) {
      throw new Error('Categoria ⚔️ EVENTOS ATIVOS não encontrada! Execute /instalar primeiro.');
    }

    if (!canalParticipar) {
      throw new Error('Canal 👋╠participar não encontrado! Execute /instalar primeiro.');
    }

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

    // Usar o Map compartilhado do EventActions
    EventActions.activeEvents.set(eventId, evento);

    const embed = this.createEventEmbed(evento, interaction.member);
    const buttons = this.createEventButtonsByStatus(evento);

    const membroRole = guild.roles.cache.find(r => r.name === 'Membro');
    const mentionText = membroRole ? `<@&${membroRole.id}>` : '@everyone';

    const painelMessage = await canalParticipar.send({
      content: `📢 ${mentionText} Novo evento criado!`,
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
      'aguardando': 0x3498DB,
      'em_andamento': 0xE74C3C,
      'pausado': 0xF39C12,
      'encerrado': 0x2ECC71,
      'cancelado': 0x95A5A6
    };

    const statusLabels = {
      'aguardando': 'AGUARDANDO',
      'em_andamento': 'EM ANDAMENTO',
      'pausado': 'PAUSADO',
      'encerrado': 'ENCERRADO',
      'cancelado': 'CANCELADO'
    };

    const numParticipantes = evento.participantes ? evento.participantes.length : 0;
    const vagasText = evento.vagas ? `/${evento.vagas}` : '';

    const embed = new EmbedBuilder()
      .setTitle(`${statusEmojis[evento.status] || '⏳'} **${evento.nome}**`)
      .setDescription(evento.descricao || 'Sem descrição')
      .setColor(statusColors[evento.status] || 0x3498DB)
      .addFields(
        { name: '👤 Criador', value: `<@${evento.criadorId}>`, inline: true },
        { name: '🕐 Horário', value: evento.horario, inline: true },
        { name: '👥 Participantes', value: `${numParticipantes}${vagasText}`, inline: true },
        { name: '🔊 Canal de Voz', value: `<#${evento.voiceChannelId}>`, inline: false }
      );

    if (evento.requisitos) {
      embed.addFields({ name: '📋 Requisitos', value: evento.requisitos, inline: false });
    }

    // Mostrar lista de participantes
    if (numParticipantes > 0) {
      const lista = evento.participantes.map(id => `<@${id}>`).join(', ');
      embed.addFields({ 
        name: `🎮 Participantes (${numParticipantes})`, 
        value: lista.length > 1024 ? lista.substring(0, 1021) + '...' : lista, 
        inline: false 
      });
    }

    const statusText = statusLabels[evento.status] || evento.status.toUpperCase();
    embed.setFooter({ 
      text: `ID: ${evento.id} • Status: ${statusText}${evento.trancado ? ' 🔒 TRANCADO' : ''}` 
    });
    embed.setTimestamp();

    return embed;
  }

  static createEventButtonsByStatus(evento) {
    const eventId = evento.id;
    const status = evento.status;
    const trancado = evento.trancado;
    const rows = [];

    // Linha 1: Participar / Pausar/Retomar
    if (status !== 'encerrado' && status !== 'cancelado') {
      const row1 = new ActionRowBuilder();

      if (!trancado) {
        row1.addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_participar_${eventId}`)
            .setLabel('✅ Participar')
            .setStyle(ButtonStyle.Success)
        );
      } else {
        row1.addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_participar_${eventId}`)
            .setLabel('🔒 Trancado')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );
      }

      if (status === 'em_andamento') {
        row1.addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_voltar_${eventId}`)
            .setLabel('⏸️ Sair/Pausar')
            .setStyle(ButtonStyle.Secondary)
        );
      }

      rows.push(row1);
    }

    // Linha 2: Controles Admin
    if (status !== 'encerrado' && status !== 'cancelado') {
      const row2 = new ActionRowBuilder();

      if (status === 'aguardando') {
        row2.addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_iniciar_${eventId}`)
            .setLabel('▶️ Iniciar')
            .setStyle(ButtonStyle.Primary)
        );
        row2.addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_cancelar_${eventId}`)
            .setLabel('❌ Cancelar')
            .setStyle(ButtonStyle.Danger)
        );
      } else if (status === 'em_andamento') {
        row2.addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_pausar_${eventId}`)
            .setLabel('⏸️ Pausar')
            .setStyle(ButtonStyle.Secondary)
        );
        row2.addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_finalizar_${eventId}`)
            .setLabel('🏁 Finalizar')
            .setStyle(ButtonStyle.Danger)
        );
      } else if (status === 'pausado') {
        row2.addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_iniciar_${eventId}`)
            .setLabel('▶️ Retomar')
            .setStyle(ButtonStyle.Primary)
        );
        row2.addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_finalizar_${eventId}`)
            .setLabel('🏁 Finalizar')
            .setStyle(ButtonStyle.Danger)
        );
      }

      rows.push(row2);
    }

    // Linha 3: Trancar/Destrancar
    if (status !== 'encerrado' && status !== 'cancelado' && status !== 'cancelado') {
      const row3 = new ActionRowBuilder();

      row3.addComponents(
        new ButtonBuilder()
          .setCustomId(trancado ? `evt_destrancar_${eventId}` : `evt_trancar_${eventId}`)
          .setLabel(trancado ? '🔓 Destrancar' : '🔒 Trancar')
          .setStyle(trancado ? ButtonStyle.Success : ButtonStyle.Secondary)
      );

      rows.push(row3);
    }

    return rows;
  }
}

module.exports = EventHandler;
