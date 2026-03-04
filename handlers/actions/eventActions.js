const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle } = require('discord.js');
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

    if (event.participants.includes(interaction.user.id)) {
      return interaction.reply({
        content: '⚠️ Você já está participando deste evento!',
        ephemeral: true
      });
    }

    if (event.vagas && event.participants.length >= event.vagas) {
      return interaction.reply({
        content: '❌ Todas as vagas foram preenchidas!',
        ephemeral: true
      });
    }

    event.participants.push(interaction.user.id);

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
      const channel = await interaction.guild.channels.fetch(event.participarChannelId);
      const message = await channel.messages.fetch(event.participarMessageId);

      const embed = EventEmbeds.createEventParticipationEmbed(event, interaction.guild.members.cache.get(event.criador));
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

    const isCreator = event.criador === interaction.user.id;
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

    for (const userId of event.participants) {
      event.presenceData.participants[userId] = {
        joinTime: Date.now(),
        totalTime: 0,
        isPresent: true
      };
    }

    // Mover todos os participantes para o canal de voz automaticamente
    let movidos = 0;
    let naoMovidos = [];

    try {
      const voiceChannel = await interaction.guild.channels.fetch(event.voiceChannelId);
      if (voiceChannel) {
        for (const userId of event.participants) {
          try {
            const member = await interaction.guild.members.fetch(userId);
            if (member && member.voice.channel) {
              // Só move se estiver em outro canal de voz
              await member.voice.setChannel(voiceChannel);
              movidos++;
            } else if (member && !member.voice.channel) {
              // Se não estiver em nenhum canal de voz, adiciona à lista
              naoMovidos.push(member.user.username);
            }
          } catch (moveError) {
            console.error(`Não foi possível mover ${userId}:`, moveError.message);
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            if (member) naoMovidos.push(member.user.username);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao mover participantes para o canal de voz:', error);
    }

    try {
      const channel = await interaction.guild.channels.fetch(event.participarChannelId);
      const message = await channel.messages.fetch(event.participarMessageId);

      const embed = EventEmbeds.createEventParticipationEmbed(event, interaction.guild.members.cache.get(event.criador));
      const buttons = EventEmbeds.createRunningButtons(eventId);

      await message.edit({ embeds: [embed], components: buttons });
    } catch (error) {
      console.error('Erro ao atualizar mensagem:', error);
    }

    // Montar mensagem de resposta detalhada
    let msgResposta = `▶️ Evento **${event.nome}** iniciado!\n\n`;
    msgResposta += `✅ **${movidos}** participante(s) movido(s) para o canal de voz.\n`;

    if (naoMovidos.length > 0) {
      msgResposta += `⚠️ **${naoMovidos.length}** não movido(s) (não estavam em canal de voz): ${naoMovidos.join(', ')}\n`;
      msgResposta += `🔊 Entre em qualquer canal de voz para ser movido automaticamente.`;
    }

    await interaction.reply({
      content: msgResposta,
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

    const isCreator = event.criador === interaction.user.id;
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
      const channel = await interaction.guild.channels.fetch(event.participarChannelId);
      const message = await channel.messages.fetch(event.participarMessageId);

      const embed = EventEmbeds.createEventParticipationEmbed(event, interaction.guild.members.cache.get(event.criador));
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

    const isCreator = event.criador === interaction.user.id;
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
      const channel = await interaction.guild.channels.fetch(event.participarChannelId);
      const message = await channel.messages.fetch(event.participarMessageId);

      const embed = EventEmbeds.createEventParticipationEmbed(event, interaction.guild.members.cache.get(event.criador));
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

    const isCreator = event.criador === interaction.user.id;
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
      const channel = await interaction.guild.channels.fetch(event.participarChannelId);
      const message = await channel.messages.fetch(event.participarMessageId);

      const embed = EventEmbeds.createEventParticipationEmbed(event, interaction.guild.members.cache.get(event.criador));
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

    const isCreator = event.criador === interaction.user.id;
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
      const channel = await interaction.guild.channels.fetch(event.participarChannelId);
      const message = await channel.messages.fetch(event.participarMessageId);

      const embed = EventEmbeds.createEventParticipationEmbed(event, interaction.guild.members.cache.get(event.criador));
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

    const isCreator = event.criador === interaction.user.id;
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');

    if (!isCreator && !isADM) {
      return interaction.reply({
        content: '❌ Apenas o criador ou ADMs podem cancelar o evento!',
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
      const channel = await interaction.guild.channels.fetch(event.participarChannelId);
      const message = await channel.messages.fetch(event.participarMessageId);

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

    const isCreator = event.criador === interaction.user.id;
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

    // Buscar canal "aguardando-evento" na categoria "banco da guilda"
    const canalAguardando = interaction.guild.channels.cache.find(
      c => c.type === ChannelType.GuildVoice && c.name === 'aguardando-evento'
    );

    // Buscar categoria de eventos encerrados
    const categoriaEncerrados = interaction.guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name === '📁 EVENTOS ENCERRADOS'
    );

    // Buscar o canal de voz do evento
    const voiceChannel = await interaction.guild.channels.fetch(event.voiceChannelId).catch(() => null);

    // Mover participantes do canal de voz para "aguardando-evento"
    if (voiceChannel && canalAguardando) {
      try {
        const membrosNoCanal = voiceChannel.members;
        for (const [memberId, member] of membrosNoCanal) {
          try {
            await member.voice.setChannel(canalAguardando);
          } catch (moveError) {
            console.error(`Não foi possível mover ${memberId} para aguardando:`, moveError.message);
          }
        }
      } catch (error) {
        console.error('Erro ao mover participantes para aguardando:', error);
      }
    }

    // Converter canal de voz em canal de texto e mover para encerrados
    let canalEncerradoId = null;
    if (voiceChannel && categoriaEncerrados) {
      try {
        // Criar novo canal de texto com as mesmas propriedades do canal de voz
        const textChannel = await interaction.guild.channels.create({
          name: `📁-${event.nome.toLowerCase().replace(/\s+/g, '-')}`,
          type: ChannelType.GuildText,
          parent: categoriaEncerrados.id,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              allow: [PermissionFlagsBits.ViewChannel],
              deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]
            }
          ]
        });

        canalEncerradoId = textChannel.id;

        // Criar embed de evento encerrado com informações do lootsplit
        const embedEncerrado = new EmbedBuilder()
          .setTitle(`🏆 **${event.nome}** - EVENTO ENCERRADO`)
          .setDescription(
            `> Evento finalizado por ${interaction.user}\n\n` +
            `**📊 Informações do Evento:**\n` +
            `• **Tipo:** ${event.tipo}\n` +
            `• **Iniciado em:** <t:${Math.floor(event.presenceData.startTime / 1000)}:F>\n` +
            `• **Finalizado em:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
            `• **Participantes:** ${event.participants.length}\n\n` +
            `**💰 Loot Split:**\n` +
            `Use os botões abaixo para simular o split do loot.`
          )
          .setColor(0x57F287)
          .setTimestamp();

        // Criar botões para lootsplit
        const botoesLoot = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`loot_simular_${eventId}`)
              .setLabel('💰 Simular Loot Split')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`loot_participacao_${eventId}`)
              .setLabel('📊 Atualizar Participação')
              .setStyle(ButtonStyle.Secondary)
          );

        await textChannel.send({
          embeds: [embedEncerrado],
          components: [botoesLoot]
        });

        // Deletar o canal de voz antigo
        await voiceChannel.delete('Evento finalizado - convertido para texto');

      } catch (error) {
        console.error('Erro ao converter canal de voz para texto:', error);
        await interaction.reply({
          content: '❌ Erro ao arquivar evento!',
          ephemeral: true
        });
        return;
      }
    }

    // Atualizar mensagem de participação
    try {
      const channel = await interaction.guild.channels.fetch(event.participarChannelId);
      const message = await channel.messages.fetch(event.participarMessageId);

      const embed = new EmbedBuilder()
        .setTitle(`🏆 **${event.nome}** - FINALIZADO`)
        .setDescription(`Evento finalizado por ${interaction.user}\n📁 Canal arquivado em <#${canalEncerradoId || 'desconhecido'}>`)
        .setColor(0x57F287)
        .setTimestamp();

      await message.edit({ embeds: [embed], components: [] });
    } catch (error) {
      console.error('Erro ao atualizar mensagem:', error);
    }

    // Remover do mapa de eventos ativos
    EventActions.activeEvents.delete(eventId);

    await interaction.reply({
      content: `✅ Evento **${event.nome}** finalizado!\n📁 Canal convertido para texto e arquivado.\n👥 Participantes movidos para aguardando-evento.\n💰 Painel de lootsplit criado.`,
      ephemeral: true
    });
  }

  // Handlers adicionais para botões de loot
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

// Map estático para armazenar eventos ativos
EventActions.activeEvents = new Map();

module.exports = EventActions;
