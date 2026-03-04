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

    // 🆕 CORREÇÃO: Verificar se participantes existe, se não, criar array vazio
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

    // 🆕 CORREÇÃO: Usar participacaoIndividual (do eventHandler) em vez de presenceData
    if (!event.participacaoIndividual) {
      event.participacaoIndividual = new Map();
    }

    event.participacaoIndividual.set(interaction.user.id, {
      userId: interaction.user.id,
      nickname: interaction.member.nickname || interaction.user.username,
      tempos: [],
      tempoTotal: 0,
      entradaAtual: event.status === 'em_andamento' ? Date.now() : null
    });

    try {
      const channel = await interaction.guild.channels.fetch(event.participarChannelId || event.textChannelId);
      const message = await channel.messages.fetch(event.participarMessageId || event.painelMessageId);

      const embed = EventEmbeds.createEventParticipationEmbed ? 
        EventEmbeds.createEventParticipationEmbed(event, interaction.guild.members.cache.get(event.criador || event.criadorId)) :
        EventHandler.createEventEmbed(event, interaction.guild.members.cache.get(event.criador || event.criadorId));
      
      let buttons;
      if (EventHandler.createEventButtonsByStatus) {
        buttons = EventHandler.createEventButtonsByStatus(event);
      } else {
        // Fallback para botões básicos
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`evt_participar_${eventId}`)
              .setLabel('✅ Participar')
              .setStyle(ButtonStyle.Success)
          );
        buttons = [row];
      }

      await message.edit({ embeds: [embed], components: buttons });
    } catch (error) {
      console.error('Erro ao atualizar mensagem do evento:', error);
    }

    await interaction.reply({
      content: `✅ Você entrou no evento **${event.nome}**!\n🔊 Canal de voz: <#${event.voiceChannelId}>`,
      ephemeral: true
    });

    if (EventStatsHandler.registerEventParticipation) {
      EventStatsHandler.registerEventParticipation(interaction.user.id, eventId, event.nome);
    }
  }

  static async handleIniciar(interaction, eventId) {
    const event = EventActions.activeEvents.get(eventId);

    if (!event) {
      return interaction.reply({
        content: '❌ Evento não encontrado!',
        ephemeral: true
      });
    }

    const isCreator = (event.criador || event.criadorId) === interaction.user.id;
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
    event.iniciadoEm = Date.now();

    // Garantir que participacaoIndividual existe
    if (!event.participacaoIndividual) {
      event.participacaoIndividual = new Map();
    }

    // Registrar entrada para participantes existentes
    for (const userId of (event.participantes || [])) {
      if (!event.participacaoIndividual.has(userId)) {
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        event.participacaoIndividual.set(userId, {
          userId: userId,
          nickname: member?.nickname || member?.user?.username || 'Desconhecido',
          tempos: [],
          tempoTotal: 0,
          entradaAtual: Date.now()
        });
      } else {
        const part = event.participacaoIndividual.get(userId);
        part.entradaAtual = Date.now();
      }
    }

    // Mover todos os participantes para o canal de voz automaticamente
    try {
      const voiceChannel = await interaction.guild.channels.fetch(event.voiceChannelId);
      if (voiceChannel) {
        for (const userId of (event.participantes || [])) {
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
      const channel = await interaction.guild.channels.fetch(event.participarChannelId || event.textChannelId);
      const message = await channel.messages.fetch(event.participarMessageId || event.painelMessageId);

      const embed = EventEmbeds.createEventParticipationEmbed ? 
        EventEmbeds.createEventParticipationEmbed(event, interaction.guild.members.cache.get(event.criador || event.criadorId)) :
        EventHandler.createEventEmbed(event, interaction.guild.members.cache.get(event.criador || event.criadorId));
      
      const buttons = EventHandler.createEventButtonsByStatus ? 
        EventHandler.createEventButtonsByStatus(event) : 
        EventEmbeds.createRunningButtons(eventId);

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

    const isCreator = (event.criador || event.criadorId) === interaction.user.id;
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

    // Calcular tempo para participantes presentes
    if (event.participacaoIndividual) {
      const agora = Date.now();
      for (const participacao of event.participacaoIndividual.values()) {
        if (participacao.entradaAtual) {
          const tempoSessao = agora - participacao.entradaAtual;
          participacao.tempos.push({
            entrada: participacao.entradaAtual,
            saida: agora,
            duracao: tempoSessao
          });
          participacao.tempoTotal += tempoSessao;
          participacao.entradaAtual = null;
        }
      }
    }

    try {
      const channel = await interaction.guild.channels.fetch(event.participarChannelId || event.textChannelId);
      const message = await channel.messages.fetch(event.participarMessageId || event.painelMessageId);

      const embed = EventEmbeds.createEventParticipationEmbed ? 
        EventEmbeds.createEventParticipationEmbed(event, interaction.guild.members.cache.get(event.criador || event.criadorId)) :
        EventHandler.createEventEmbed(event, interaction.guild.members.cache.get(event.criador || event.criadorId));
      
      const buttons = EventHandler.createEventButtonsByStatus ? 
        EventHandler.createEventButtonsByStatus(event) : 
        EventEmbeds.createPausedButtons(eventId);

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

    const isCreator = (event.criador || event.criadorId) === interaction.user.id;
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

    // Retomar tempo para participantes
    if (event.participacaoIndividual) {
      const agora = Date.now();
      for (const participacao of event.participacaoIndividual.values()) {
        participacao.entradaAtual = agora;
      }
    }

    try {
      const channel = await interaction.guild.channels.fetch(event.participarChannelId || event.textChannelId);
      const message = await channel.messages.fetch(event.participarMessageId || event.painelMessageId);

      const embed = EventEmbeds.createEventParticipationEmbed ? 
        EventEmbeds.createEventParticipationEmbed(event, interaction.guild.members.cache.get(event.criador || event.criadorId)) :
        EventHandler.createEventEmbed(event, interaction.guild.members.cache.get(event.criador || event.criadorId));
      
      const buttons = EventHandler.createEventButtonsByStatus ? 
        EventHandler.createEventButtonsByStatus(event) : 
        EventEmbeds.createRunningButtons(eventId);

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

    const isCreator = (event.criador || event.criadorId) === interaction.user.id;
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
      const channel = await interaction.guild.channels.fetch(event.participarChannelId || event.textChannelId);
      const message = await channel.messages.fetch(event.participarMessageId || event.painelMessageId);

      const embed = EventEmbeds.createEventParticipationEmbed ? 
        EventEmbeds.createEventParticipationEmbed(event, interaction.guild.members.cache.get(event.criador || event.criadorId)) :
        EventHandler.createEventEmbed(event, interaction.guild.members.cache.get(event.criador || event.criadorId));
      
      const buttons = EventHandler.createEventButtonsByStatus ? 
        EventHandler.createEventButtonsByStatus(event) : 
        EventEmbeds.createLockedButtons(eventId);

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

    const isCreator = (event.criador || event.criadorId) === interaction.user.id;
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
      const channel = await interaction.guild.channels.fetch(event.participarChannelId || event.textChannelId);
      const message = await channel.messages.fetch(event.participarMessageId || event.painelMessageId);

      const embed = EventEmbeds.createEventParticipationEmbed ? 
        EventEmbeds.createEventParticipationEmbed(event, interaction.guild.members.cache.get(event.criador || event.criadorId)) :
        EventHandler.createEventEmbed(event, interaction.guild.members.cache.get(event.criador || event.criadorId));
      
      let buttons;
      if (EventHandler.createEventButtonsByStatus) {
        buttons = EventHandler.createEventButtonsByStatus(event);
      } else if (event.status === 'em_andamento') {
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

    const isCreator = (event.criador || event.criadorId) === interaction.user.id;
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
      const channel = await interaction.guild.channels.fetch(event.participarChannelId || event.textChannelId);
      const message = await channel.messages.fetch(event.participarMessageId || event.painelMessageId);

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

    const isCreator = (event.criador || event.criadorId) === interaction.user.id;
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isCreator && !isADM && !isCaller) {
      return interaction.reply({
        content: '❌ Apenas o criador, ADMs ou Callers podem finalizar o evento!',
        ephemeral: true
      });
    }

    if (event.status === 'finalizado' || event.status === 'encerrado') {
      return interaction.reply({
        content: '❌ O evento já foi finalizado!',
        ephemeral: true
      });
    }

    event.status = 'encerrado';
    event.finalizadoEm = Date.now();

    // Calcular tempo final para todos os participantes presentes
    if (event.participacaoIndividual) {
      const agora = Date.now();
      for (const participacao of event.participacaoIndividual.values()) {
        if (participacao.entradaAtual) {
          const tempoSessao = agora - participacao.entradaAtual;
          participacao.tempos.push({
            entrada: participacao.entradaAtual,
            saida: agora,
            duracao: tempoSessao
          });
          participacao.tempoTotal += tempoSessao;
          participacao.entradaAtual = null;
        }
      }
    }

    try {
      // 1. Buscar categoria de eventos encerrados
      const categoriaEncerrados = interaction.guild.channels.cache.find(
        c => c.name === '📁 EVENTOS ENCERRADOS' && c.type === ChannelType.GuildCategory
      );

      // 2. Buscar canal de voz do evento e mover participantes para Aguardando-Evento
      const voiceChannel = await interaction.guild.channels.fetch(event.voiceChannelId).catch(() => null);
      const canalAguardando = interaction.guild.channels.cache.find(c => c.name === '🔊╠Aguardando-Evento');

      if (voiceChannel && canalAguardando) {
        for (const userId of (event.participantes || [])) {
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

      // 3. Criar novo canal de texto
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

      // 4. Deletar canal de voz original
      if (voiceChannel) {
        await voiceChannel.delete('Evento finalizado').catch(console.error);
      }

      // 5. Criar embed de loot split no novo canal de texto
      if (textChannel) {
        const totalParticipants = (event.participantes || []).length;
        const duracao = event.iniciadoEm ? Math.floor((Date.now() - event.iniciadoEm) / 60000) : 0;
        
        const embedLoot = new EmbedBuilder()
          .setTitle(`💰 **LOOT SPLIT - ${event.nome}**`)
          .setDescription(
            `> Evento finalizado por ${interaction.user}\n\n` +
            `👥 **Participantes:** ${totalParticipants}\n` +
            `⏱️ **Duração:** ${duracao} minutos\n\n` +
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

      // 6. Atualizar mensagem original no canal participar
      const channel = await interaction.guild.channels.fetch(event.participarChannelId || event.textChannelId).catch(() => null);
      if (channel) {
        const message = await channel.messages.fetch(event.participarMessageId || event.painelMessageId).catch(() => null);
        if (message) {
          const embedFinal = new EmbedBuilder()
            .setTitle(`🏁 **${event.nome}** - FINALIZADO`)
            .setDescription(`Evento finalizado por ${interaction.user}\n📁 Canal de arquivamento: ${textChannel ? `<#${textChannel.id}>` : 'Não criado'}`)
            .setColor(0x95A5A6)
            .setTimestamp();

          await message.edit({ embeds: [embedFinal], components: [] });
        }
      }

      // 7. Salvar estatísticas
      if (EventStatsHandler.saveEventStats) {
        await EventStatsHandler.saveEventStats(event, interaction.guild);
      }

      // 8. Remover do mapa de eventos ativos após 1 hora
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

// Map de eventos ativos compartilhado
EventActions.activeEvents = new Map();

module.exports = EventActions;
