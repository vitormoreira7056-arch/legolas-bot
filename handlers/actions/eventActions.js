const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const ConfigHandler = require('../configHandler');
const BankCore = require('../bank/bankCore');
const db = require('../../utils/database');
const SetupManager = require('../setupManager');
const EventHandler = require('../eventHandler');
const EventModals = require('../eventModals');
const LootSplitHandler = require('../lootSplitHandler');
const LootSplitUI = require('../lootSplitUI');
const EventStatsHandler = require('../eventStatsHandler');
const EventEmbeds = require('../eventEmbeds');

class EventActions {
  static async handleCriarEventoCustom(interaction) {
    const modal = EventModals.createCustomEventModal();
    await interaction.showModal(modal);
  }

  static async handleCriarPresetEvent(interaction, tipo) {
    const modal = EventModals.createPresetEventModal(tipo);
    await interaction.showModal(modal);
  }

  static async handleEventAction(interaction, customId) {
    const parts = customId.split('_');
    const action = parts[1];
    const eventId = parts.slice(2).join('_');

    switch (action) {
      case 'participar':
        await EventActions.handleParticipar(interaction, eventId);
        break;
      case 'iniciar':
        await EventActions.handleIniciar(interaction, eventId);
        break;
      case 'pausar':
        await EventActions.handlePausar(interaction, eventId);
        break;
      case 'voltar':
        await EventActions.handleVoltar(interaction, eventId);
        break;
      case 'trancar':
        await EventActions.handleTrancar(interaction, eventId);
        break;
      case 'destrancar':
        await EventActions.handleDestrancar(interaction, eventId);
        break;
      case 'cancelar':
        await EventActions.handleCancelar(interaction, eventId);
        break;
      case 'finalizar':
        await EventActions.handleFinalizar(interaction, eventId);
        break;
      default:
        await interaction.reply({ content: '❌ Ação desconhecida!', ephemeral: true });
    }
  }

  static async handleParticipar(interaction, eventId) {
    const event = EventActions.activeEvents.get(eventId);

    if (!event) {
      return interaction.reply({
        content: '❌ Evento não encontrado!',
        ephemeral: true
      });
    }

    if (event.status === 'finalizado') {
      return interaction.reply({
        content: '❌ Este evento já foi finalizado!',
        ephemeral: true
      });
    }

    if (event.status === 'cancelado') {
      return interaction.reply({
        content: '❌ Este evento foi cancelado!',
        ephemeral: true
      });
    }

    // 🆕 CORREÇÃO: Usar participantes (array) em vez de participants
    if (!event.participantes) {
      event.participantes = [];
    }

    if (event.participantes.includes(interaction.user.id)) {
      return interaction.reply({
        content: '⚠️ Você já está participando deste evento!',
        ephemeral: true
      });
    }

    if (event.vagas && event.participantes.length >= event.vagas) {
      return interaction.reply({
        content: '❌ Todas as vagas foram preenchidas!',
        ephemeral: true
      });
    }

    event.participantes.push(interaction.user.id);

    if (!event.presenceData) {
      event.presenceData = {
        startTime: null,
        endTime: null,
        participants: {}
      };
    }

    event.presenceData.participants[interaction.user.id] = {
      joinTime: Date.now(),
      totalTime: 0,
      isPresent: true
    };

    try {
      // 🆕 CORREÇÃO: Usar textChannelId e painelMessageId
      const channel = await interaction.guild.channels.fetch(event.textChannelId);
      const message = await channel.messages.fetch(event.painelMessageId);

      const embed = EventEmbeds.createEventParticipationEmbed(event, interaction.guild.members.cache.get(event.criadorId));
      let buttons;

      if (event.status === 'aguardando') {
        buttons = EventEmbeds.createWaitingButtons(eventId);
      } else if (event.status === 'em_andamento') {
        buttons = EventEmbeds.createRunningButtons(eventId);
      } else if (event.status === 'pausado') {
        buttons = EventEmbeds.createPausedButtons(eventId);
      } else if (event.trancado) {
        buttons = EventEmbeds.createLockedButtons(eventId);
      }

      await message.edit({ embeds: [embed], components: buttons });
    } catch (error) {
      console.error('Erro ao atualizar mensagem do evento:', error);
    }

    await interaction.reply({
      content: `✅ Você entrou no evento **${event.nome}**!\n🔊 Canal de voz: <#${event.voiceChannelId}>`,
      ephemeral: true
    });

    EventStatsHandler.registerEventParticipation(interaction.user.id, eventId, event.nome);
  }

  static async handleIniciar(interaction, eventId) {
    const event = EventActions.activeEvents.get(eventId);

    if (!event) {
      return interaction.reply({
        content: '❌ Evento não encontrado!',
        ephemeral: true
      });
    }

    // 🆕 CORREÇÃO: Usar criadorId em vez de criador
    const isCreator = event.criadorId === interaction.user.id;
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isCreator && !isADM && !isCaller) {
      return interaction.reply({
        content: '❌ Apenas o criador, ADMs ou Callers podem iniciar o evento!',
        ephemeral: true
      });
    }

    if (event.status !== 'aguardando') {
      return interaction.reply({
        content: '❌ O evento já foi iniciado ou está pausado!',
        ephemeral: true
      });
    }

    event.status = 'em_andamento';
    event.presenceData = {
      startTime: Date.now(),
      endTime: null,
      participants: {}
    };

    // 🆕 CORREÇÃO: Usar participantes em vez de participants
    if (!event.participantes) event.participantes = [];

    for (const userId of event.participantes) {
      event.presenceData.participants[userId] = {
        joinTime: Date.now(),
        totalTime: 0,
        isPresent: true
      };
    }

    // Mover todos os participantes para o canal de voz automaticamente
    try {
      const voiceChannel = await interaction.guild.channels.fetch(event.voiceChannelId);
      if (voiceChannel) {
        for (const userId of event.participantes) {
          try {
            const member = await interaction.guild.members.fetch(userId);
            if (member && member.voice.channel) {
              // Só move se estiver em outro canal de voz
              await member.voice.setChannel(voiceChannel);
            } else if (member && !member.voice.channel) {
              // Se não estiver em nenhum canal, não faz nada (não pode forçar entrar)
              // Opcionalmente pode enviar DM avisando
            }
          } catch (moveError) {
            console.error(`Não foi possível mover ${userId}:`, moveError.message);
            // Continua com os outros mesmo se um falhar
          }
        }
      }
    } catch (error) {
      console.error('Erro ao mover participantes para o canal de voz:', error);
    }

    try {
      // 🆕 CORREÇÃO: Usar textChannelId e painelMessageId
      const channel = await interaction.guild.channels.fetch(event.textChannelId);
      const message = await channel.messages.fetch(event.painelMessageId);

      const embed = EventEmbeds.createEventParticipationEmbed(event, interaction.guild.members.cache.get(event.criadorId));
      const buttons = EventEmbeds.createRunningButtons(eventId);

      await message.edit({ embeds: [embed], components: buttons });
    } catch (error) {
      console.error('Erro ao atualizar mensagem:', error);
    }

    await interaction.reply({
      content: `▶️ Evento **${event.nome}** iniciado! Todos os participantes foram movidos para o canal de voz!`,
      ephemeral: true
    });
  }

  static async handlePausar(interaction, eventId) {
    const event = EventActions.activeEvents.get(eventId);

    if (!event) {
      return interaction.reply({
        content: '❌ Evento não encontrado!',
        ephemeral: true
      });
    }

    const isCreator = event.criadorId === interaction.user.id;
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isCreator && !isADM && !isCaller) {
      return interaction.reply({
        content: '❌ Apenas o criador, ADMs ou Callers podem pausar o evento!',
        ephemeral: true
      });
    }

    if (event.status !== 'em_andamento') {
      return interaction.reply({
        content: '❌ O evento não está em andamento!',
        ephemeral: true
      });
    }

    event.status = 'pausado';

    const now = Date.now();
    for (const userId in event.presenceData.participants) {
      const p = event.presenceData.participants[userId];
      if (p.isPresent && p.joinTime) {
        p.totalTime += (now - p.joinTime);
        p.isPresent = false;
      }
    }

    try {
      const channel = await interaction.guild.channels.fetch(event.textChannelId);
      const message = await channel.messages.fetch(event.painelMessageId);

      const embed = EventEmbeds.createEventParticipationEmbed(event, interaction.guild.members.cache.get(event.criadorId));
      const buttons = EventEmbeds.createPausedButtons(eventId);

      await message.edit({ embeds: [embed], components: buttons });
    } catch (error) {
      console.error('Erro ao atualizar mensagem:', error);
    }

    await interaction.reply({
      content: `⏸️ Evento **${event.nome}** pausado.`,
      ephemeral: true
    });
  }

  static async handleVoltar(interaction, eventId) {
    const event = EventActions.activeEvents.get(eventId);

    if (!event) {
      return interaction.reply({
        content: '❌ Evento não encontrado!',
        ephemeral: true
      });
    }

    const isCreator = event.criadorId === interaction.user.id;
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isCreator && !isADM && !isCaller) {
      return interaction.reply({
        content: '❌ Apenas o criador, ADMs ou Callers podem retomar o evento!',
        ephemeral: true
      });
    }

    if (event.status !== 'pausado') {
      return interaction.reply({
        content: '❌ O evento não está pausado!',
        ephemeral: true
      });
    }

    event.status = 'em_andamento';

    const now = Date.now();
    for (const userId in event.presenceData.participants) {
      const p = event.presenceData.participants[userId];
      p.joinTime = now;
      p.isPresent = true;
    }

    try {
      const channel = await interaction.guild.channels.fetch(event.textChannelId);
      const message = await channel.messages.fetch(event.painelMessageId);

      const embed = EventEmbeds.createEventParticipationEmbed(event, interaction.guild.members.cache.get(event.criadorId));
      const buttons = EventEmbeds.createRunningButtons(eventId);

      await message.edit({ embeds: [embed], components: buttons });
    } catch (error) {
      console.error('Erro ao atualizar mensagem:', error);
    }

    await interaction.reply({
      content: `▶️ Evento **${event.nome}** retomado!`,
      ephemeral: true
    });
  }

  static async handleTrancar(interaction, eventId) {
    const event = EventActions.activeEvents.get(eventId);

    if (!event) {
      return interaction.reply({
        content: '❌ Evento não encontrado!',
        ephemeral: true
      });
    }

    const isCreator = event.criadorId === interaction.user.id;
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isCreator && !isADM && !isCaller) {
      return interaction.reply({
        content: '❌ Apenas o criador, ADMs ou Callers podem trancar o evento!',
        ephemeral: true
      });
    }

    event.trancado = true;

    try {
      const channel = await interaction.guild.channels.fetch(event.textChannelId);
      const message = await channel.messages.fetch(event.painelMessageId);

      const embed = EventEmbeds.createEventParticipationEmbed(event, interaction.guild.members.cache.get(event.criadorId));
      const buttons = EventEmbeds.createLockedButtons(eventId);

      await message.edit({ embeds: [embed], components: buttons });
    } catch (error) {
      console.error('Erro ao atualizar mensagem:', error);
    }

    await interaction.reply({
      content: `🔒 Evento **${event.nome}** trancado! Novos participantes não podem entrar.`,
      ephemeral: true
    });
  }

  static async handleDestrancar(interaction, eventId) {
    const event = EventActions.activeEvents.get(eventId);

    if (!event) {
      return interaction.reply({
        content: '❌ Evento não encontrado!',
        ephemeral: true
      });
    }

    const isCreator = event.criadorId === interaction.user.id;
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isCreator && !isADM && !isCaller) {
      return interaction.reply({
        content: '❌ Apenas o criador, ADMs ou Callers podem destrancar o evento!',
        ephemeral: true
      });
    }

    event.trancado = false;

    try {
      const channel = await interaction.guild.channels.fetch(event.textChannelId);
      const message = await channel.messages.fetch(event.painelMessageId);

      const embed = EventEmbeds.createEventParticipationEmbed(event, interaction.guild.members.cache.get(event.criadorId));
      let buttons;

      if (event.status === 'em_andamento') {
        buttons = EventEmbeds.createRunningButtons(eventId);
      } else if (event.status === 'pausado') {
        buttons = EventEmbeds.createPausedButtons(eventId);
      } else {
        buttons = EventEmbeds.createWaitingButtons(eventId);
      }

      await message.edit({ embeds: [embed], components: buttons });
    } catch (error) {
      console.error('Erro ao atualizar mensagem:', error);
    }

    await interaction.reply({
      content: `🔓 Evento **${event.nome}** destrancado! Novos participantes podem entrar.`,
      ephemeral: true
    });
  }

  static async handleCancelar(interaction, eventId) {
    const event = EventActions.activeEvents.get(eventId);

    if (!event) {
      return interaction.reply({
        content: '❌ Evento não encontrado!',
        ephemeral: true
      });
    }

    const isCreator = event.criadorId === interaction.user.id;
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    // 🆕 CORREÇÃO: Adicionado isCaller para consistência, ou remover dos outros métodos
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isCreator && !isADM && !isCaller) {
      return interaction.reply({
        content: '❌ Apenas o criador, ADMs ou Callers podem cancelar o evento!',
        ephemeral: true
      });
    }

    event.status = 'cancelado';

    try {
      const voiceChannel = await interaction.guild.channels.fetch(event.voiceChannelId);
      if (voiceChannel) await voiceChannel.delete('Evento cancelado');
    } catch (error) {
      console.error('Erro ao deletar canal de voz:', error);
    }

    try {
      const channel = await interaction.guild.channels.fetch(event.textChannelId);
      const message = await channel.messages.fetch(event.painelMessageId);

      const embed = new EmbedBuilder()
        .setTitle(`❌ **${event.nome}** - CANCELADO`)
        .setDescription(`Evento cancelado por ${interaction.user}`)
        .setColor(0xED4245)
        .setTimestamp();

      await message.edit({ embeds: [embed], components: [] });
    } catch (error) {
      console.error('Erro ao atualizar mensagem:', error);
    }

    setTimeout(() => {
      EventActions.activeEvents.delete(eventId);
    }, 3600000);

    await interaction.reply({
      content: `❌ Evento **${event.nome}** cancelado!`,
      ephemeral: true
    });
  }

  static async handleFinalizar(interaction, eventId) {
    const event = EventActions.activeEvents.get(eventId);

    if (!event) {
      return interaction.reply({
        content: '❌ Evento não encontrado!',
        ephemeral: true
      });
    }

    const isCreator = event.criadorId === interaction.user.id;
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isCreator && !isADM && !isCaller) {
      return interaction.reply({
        content: '❌ Apenas o criador, ADMs ou Callers podem finalizar o evento!',
        ephemeral: true
      });
    }

    if (event.status === 'finalizado') {
      return interaction.reply({
        content: '❌ O evento já foi finalizado!',
        ephemeral: true
      });
    }

    event.status = 'finalizado';
    event.presenceData.endTime = Date.now();

    const now = Date.now();
    for (const userId in event.presenceData.participants) {
      const p = event.presenceData.participants[userId];
      if (p.isPresent && p.joinTime) {
        p.totalTime += (now - p.joinTime);
        p.isPresent = false;
      }
    }

    // Calcular duração total do evento
    const duracaoTotal = event.presenceData.startTime ?
      event.presenceData.endTime - event.presenceData.startTime : 0;

    // Mover participantes do canal de voz para Aguardando-Evento
    const canalAguardando = interaction.guild.channels.cache.find(
      c => c.name.includes('Aguardando-Evento') && c.type === ChannelType.GuildVoice
    );

    const voiceChannel = await interaction.guild.channels.fetch(event.voiceChannelId).catch(() => null);

    if (voiceChannel && canalAguardando) {
      for (const [memberId, member] of voiceChannel.members) {
        try {
          await member.voice.setChannel(canalAguardando.id);
        } catch (error) {
          console.log(`Não foi possível mover ${member.user.tag}:`, error.message);
        }
      }
    }

    // Criar canal de texto na categoria de eventos encerrados
    let categoriaEncerrados = interaction.guild.channels.cache.find(
      c => c.name.includes('EVENTOS ENCERRADOS') && c.type === ChannelType.GuildCategory
    );

    let textChannel;
    try {
      textChannel = await interaction.guild.channels.create({
        name: `💰-${event.nome}`,
        type: ChannelType.GuildText,
        parent: categoriaEncerrados ? categoriaEncerrados.id : null,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
            deny: [PermissionFlagsBits.SendMessages]
          }
        ]
      });

      if (voiceChannel) {
        await voiceChannel.delete('Evento finalizado').catch(console.error);
      }

    } catch (error) {
      console.error('Erro ao criar canal:', error);
      textChannel = await interaction.guild.channels.fetch(event.textChannelId).catch(() => null);
    }

    // Atualizar dados do evento para o formato esperado pelo LootSplitUI
    const eventoFormatado = {
      ...event,
      id: eventId,
      participacaoIndividual: new Map(Object.entries(event.presenceData.participants).map(([userId, data]) => [
        userId,
        {
          userId,
          nickname: data.nickname || interaction.guild.members.cache.get(userId)?.nickname || 'Desconhecido',
          tempoTotal: data.totalTime,
          tempos: data.joinTime ? [{ entrada: data.joinTime, saida: event.presenceData.endTime, duracao: data.totalTime }] : []
        }
      ])),
      guildId: interaction.guild.id,
      textChannelId: textChannel ? textChannel.id : event.textChannelId
    };

    // Criar painel de lootsplit
    if (textChannel) {
      const painelLoot = LootSplitUI.createFinishedEventPanel(eventoFormatado, duracaoTotal);
      await textChannel.send(painelLoot);
    }

    // Salvar estatísticas
    await EventStatsHandler.saveEventStats(eventoFormatado, interaction.guild);

    // Remover do mapa de eventos ativos após 1 hora (para permitir consulta se necessário)
    setTimeout(() => {
      EventActions.activeEvents.delete(eventId);
    }, 3600000);

    await interaction.reply({
      content: `✅ Evento **${event.nome}** finalizado!\n📁 Canal de loot: ${textChannel || 'Não criado'}\n🔊 Participantes movidos para Aguardando-Evento.`,
      ephemeral: true
    });
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

EventActions.activeEvents = new Map();

module.exports = EventActions;
