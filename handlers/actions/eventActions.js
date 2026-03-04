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

    try {
      const voiceChannel = await interaction.guild.channels.fetch(event.voiceChannelId);
      if (voiceChannel) {
        for (const userId of event.participants) {
          try {
            const member = await interaction.guild.members.fetch(userId);
            if (member && member.voice.channel) {
              await member.voice.setChannel(voiceChannel);
            }
          } catch (moveError) {
            console.error(`Não foi possível mover ${userId}:`, moveError.message);
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
        p.joinTime = null;
      }
    }

    try {
      const categoriaEncerrados = interaction.guild.channels.cache.find(
        c => c.name === '📁 EVENTOS ENCERRADOS' && c.type === ChannelType.GuildCategory
      );

      const voiceChannel = await interaction.guild.channels.fetch(event.voiceChannelId).catch(() => null);
      const canalAguardando = interaction.guild.channels.cache.find(c => c.name === '🔊╠Aguardando-Evento');

      if (voiceChannel && canalAguardando) {
        for (const userId of event.participants) {
          try {
            const member = await interaction.guild.members.fetch(userId);
            if (member && member.voice.channel && member.voice.channel.id === event.voiceChannelId) {
              await member.voice.setChannel(canalAguardando.id);
            }
          } catch (moveError) {
            console.log(`Não foi possível mover ${userId} para aguardando:`, moveError.message);
          }
        }
      }

      let textChannel;

      if (categoriaEncerrados) {
        textChannel = await interaction.guild.channels.create({
          name: `📁-${event.nome.toLowerCase().replace(/\s+/g, '-')}`,
          type: ChannelType.GuildText,
          parent: categoriaEncerrados.id,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
              deny: [PermissionFlagsBits.SendMessages]
            },
            {
              id: interaction.user.id,
              allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel]
            }
          ]
        });
      }

      if (voiceChannel) {
        await voiceChannel.delete('Evento finalizado').catch(console.error);
      }

      if (textChannel) {
        const totalParticipants = event.participants.length;
        const embedLoot = new EmbedBuilder()
          .setTitle(`💰 **LOOT SPLIT - ${event.nome}**`)
          .setDescription(
            `> Evento finalizado por ${interaction.user}\n\n` +
            `👥 **Participantes:** ${totalParticipants}\n` +
            `⏱️ **Duração:** ${Math.floor((event.presenceData.endTime - event.presenceData.startTime) / 60000)} minutos\n\n` +
            `Clique no botão abaixo para simular a divisão do loot:`
          )
          .setColor(0x2ECC71)
          .setTimestamp();

        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`simulate_loot_${eventId}`)
              .setLabel('💰 Simular Loot Split')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`archive_loot_${eventId}`)
              .setLabel('📦 Arquivar Evento')
              .setStyle(ButtonStyle.Secondary)
          );

        await textChannel.send({
          embeds: [embedLoot],
          components: [row]
        });
      }

      const channel = await interaction.guild.channels.fetch(event.participarChannelId).catch(() => null);
      if (channel) {
        const message = await channel.messages.fetch(event.participarMessageId).catch(() => null);
        if (message) {
          const embedFinal = new EmbedBuilder()
            .setTitle(`🏁 **${event.nome}** - FINALIZADO`)
            .setDescription(`Evento finalizado por ${interaction.user}\n📁 Canal de arquivamento: ${textChannel ? `<#${textChannel.id}>` : 'Não criado'}`)
            .setColor(0x95A5A6)
            .setTimestamp();

          await message.edit({ embeds: [embedFinal], components: [] });
        }
      }

      await EventStatsHandler.saveEventStats(event, interaction.guild);

      setTimeout(() => {
        EventActions.activeEvents.delete(eventId);
      }, 3600000);

      await interaction.reply({
        content: `✅ Evento **${event.nome}** finalizado!\n📁 Canal criado: ${textChannel ? `<#${textChannel.id}>` : 'Erro ao criar'}\n👥 Participantes movidos para 🔊╠Aguardando-Evento`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Erro ao finalizar evento:', error);
      await interaction.reply({
        content: `❌ Erro ao finalizar evento: ${error.message}`,
        ephemeral: true
      });
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

EventActions.activeEvents = new Map();

module.exports = EventActions;
