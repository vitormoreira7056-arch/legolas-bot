const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle } = require('discord.js');
const EventHandler = require('../eventHandler');
const EventModals = require('../eventModals');
const LootSplitHandler = require('../lootSplitHandler');
const LootSplitUI = require('../lootSplitUI');
const EventStatsHandler = require('../eventStatsHandler');
const EventEmbeds = require('../eventEmbeds');
const db = require('../../utils/database');

class EventActions {
  constructor() {
    this.activeEvents = new Map();
  }

  static async forceUpdatePanel(interaction, eventId) {
    try {
      const event = this.activeEvents.get(eventId);
      if (!event) {
        console.error(`[ERRO] Evento ${eventId} não encontrado no Map`);
        return false;
      }

      const channel = await interaction.guild.channels.fetch(event.textChannelId).catch(err => {
        console.error(`[ERRO] Canal não encontrado:`, err.message);
        return null;
      });

      if (!channel) return false;

      const message = await channel.messages.fetch(event.painelMessageId).catch(err => {
        console.error(`[ERRO] Mensagem não encontrada:`, err.message);
        return null;
      });

      if (!message) return false;

      const criador = await interaction.guild.members.fetch(event.criadorId).catch(() => null);
      const embed = EventHandler.createEventEmbed(event, criador);
      const buttons = EventHandler.createEventButtonsByStatus(event);

      await message.edit({
        embeds: [embed],
        components: buttons
      });

      console.log(`[OK] Painel atualizado - Status: ${event.status} - Participantes: ${event.participantes?.length || 0}`);
      return true;
    } catch (error) {
      console.error('[ERRO] Falha ao atualizar painel:', error);
      return false;
    }
  }

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
        await this.handleParticipar(interaction, eventId);
        break;
      case 'iniciar':
        await this.handleIniciar(interaction, eventId);
        break;
      case 'pausar':
        await this.handlePausar(interaction, eventId);
        break;
      case 'voltar':
        await this.handleVoltar(interaction, eventId);
        break;
      case 'trancar':
        await this.handleTrancar(interaction, eventId);
        break;
      case 'destrancar':
        await this.handleDestrancar(interaction, eventId);
        break;
      case 'cancelar':
        await this.handleCancelar(interaction, eventId);
        break;
      case 'finalizar':
        await this.handleFinalizar(interaction, eventId);
        break;
      default:
        await interaction.reply({ content: '❌ Ação desconhecida!', ephemeral: true });
    }
  }

  static async handleParticipar(interaction, eventId) {
    const event = this.activeEvents.get(eventId);

    if (!event) {
      return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });
    }

    if (event.status === 'finalizado' || event.status === 'encerrado') {
      return interaction.reply({ content: '❌ Evento já finalizado!', ephemeral: true });
    }

    if (event.status === 'cancelado') {
      return interaction.reply({ content: '❌ Evento cancelado!', ephemeral: true });
    }

    if (event.trancado) {
      return interaction.reply({
        content: '🔒 Evento está **trancado**! Apenas administradores podem destrancar.',
        ephemeral: true
      });
    }

    if (!event.participantes) event.participantes = [];
    if (!event.participacaoIndividual) event.participacaoIndividual = new Map();

    if (event.participantes.includes(interaction.user.id)) {
      return interaction.reply({ content: '⚠️ Você já está participando!', ephemeral: true });
    }

    if (event.vagas && event.participantes.length >= event.vagas) {
      return interaction.reply({ content: '❌ Vagas esgotadas!', ephemeral: true });
    }

    const userData = db.getUser(interaction.user.id);
    const nickDoJogo = userData.nickDoJogo || interaction.member.nickname || interaction.user.username;

    event.participantes.push(interaction.user.id);
    event.participacaoIndividual.set(interaction.user.id, {
      userId: interaction.user.id,
      nickname: nickDoJogo,
      tempos: [],
      tempoTotal: 0,
      entradaAtual: event.status === 'em_andamento' ? Date.now() : null
    });

    await this.forceUpdatePanel(interaction, eventId);

    await interaction.reply({
      content: `✅ Você entrou em **${event.nome}**!\n🔊 <#${event.voiceChannelId}>`,
      ephemeral: true
    });

    if (EventStatsHandler.registerEventParticipation) {
      EventStatsHandler.registerEventParticipation(interaction.user.id, eventId, event.nome);
    }
  }

  static async handleIniciar(interaction, eventId) {
    const event = this.activeEvents.get(eventId);
    if (!event) return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });

    const isCreator = event.criadorId === interaction.user.id;
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isCreator && !isADM && !isCaller) {
      return interaction.reply({ content: '❌ Sem permissão!', ephemeral: true });
    }

    if (event.status !== 'aguardando' && event.status !== 'pausado') {
      return interaction.reply({ content: '❌ Já iniciado!', ephemeral: true });
    }

    const estavaPausado = event.status === 'pausado';
    event.status = 'em_andamento';
    if (!event.iniciadoEm) event.iniciadoEm = Date.now();

    if (!event.participacaoIndividual) event.participacaoIndividual = new Map();

    for (const userId of event.participantes) {
      if (!event.participacaoIndividual.has(userId)) {
        const member = await interaction.guild.members.fetch(userId).catch(() => null);

        const userData = db.getUser(userId);
        const nickDoJogo = userData.nickDoJogo || member?.nickname || member?.user?.username || 'Desconhecido';

        event.participacaoIndividual.set(userId, {
          userId: userId,
          nickname: nickDoJogo,
          tempos: [],
          tempoTotal: 0,
          entradaAtual: Date.now()
        });
      } else {
        const part = event.participacaoIndividual.get(userId);
        if (!part.entradaAtual) part.entradaAtual = Date.now();
      }
    }

    let movidos = 0;
    try {
      const voiceChannel = await interaction.guild.channels.fetch(event.voiceChannelId);
      if (voiceChannel) {
        for (const userId of event.participantes) {
          try {
            const member = await interaction.guild.members.fetch(userId);
            if (member?.voice.channel && member.voice.channel.id !== event.voiceChannelId) {
              await member.voice.setChannel(voiceChannel);
              movidos++;
            }
          } catch {}
        }
      }
    } catch (error) {
      console.error('Erro ao mover:', error);
    }

    await this.forceUpdatePanel(interaction, eventId);

    let msg = estavaPausado ? '▶️ Retomado!' : '▶️ Iniciado!';
    if (movidos > 0) msg += ` (${movidos} movidos)`;

    await interaction.reply({ content: msg, ephemeral: true });
  }

  static async handlePausar(interaction, eventId) {
    const event = this.activeEvents.get(eventId);
    if (!event) return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });

    const isCreator = event.criadorId === interaction.user.id;
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isCreator && !isADM && !isCaller) {
      return interaction.reply({ content: '❌ Sem permissão!', ephemeral: true });
    }

    if (event.status !== 'em_andamento') {
      return interaction.reply({ content: '❌ Não está em andamento!', ephemeral: true });
    }

    event.status = 'pausado';

    if (event.participacaoIndividual) {
      const agora = Date.now();
      for (const p of event.participacaoIndividual.values()) {
        if (p.entradaAtual) {
          const tempo = agora - p.entradaAtual;
          p.tempos.push({ entrada: p.entradaAtual, saida: agora, duracao: tempo });
          p.tempoTotal += tempo;
          p.entradaAtual = null;
        }
      }
    }

    await this.forceUpdatePanel(interaction, eventId);

    await interaction.reply({ content: `⏸️ **${event.nome}** pausado!`, ephemeral: true });
  }

  static async handleVoltar(interaction, eventId) {
    const event = this.activeEvents.get(eventId);
    if (!event) return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });

    if (event.status === 'pausado') {
      return this.handleIniciar(interaction, eventId);
    }

    if (event.status !== 'em_andamento') {
      return interaction.reply({ content: '❌ Evento não ativo!', ephemeral: true });
    }

    if (event.participacaoIndividual?.has(interaction.user.id)) {
      const p = event.participacaoIndividual.get(interaction.user.id);
      if (p.entradaAtual) {
        const agora = Date.now();
        p.tempos.push({ entrada: p.entradaAtual, saida: agora, duracao: agora - p.entradaAtual });
        p.tempoTotal += (agora - p.entradaAtual);
        p.entradaAtual = null;
      }
    }

    await this.forceUpdatePanel(interaction, eventId);
    await interaction.reply({ content: '⏸️ Você saiu. Tempo registrado!', ephemeral: true });
  }

  static async handleTrancar(interaction, eventId) {
    const event = this.activeEvents.get(eventId);
    if (!event) return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });

    const isCreator = event.criadorId === interaction.user.id;
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isCreator && !isADM && !isCaller) {
      return interaction.reply({ content: '❌ Sem permissão!', ephemeral: true });
    }

    event.trancado = true;
    await this.forceUpdatePanel(interaction, eventId);

    await interaction.reply({
      content: `🔒 **${event.nome}** trancado! Novas entradas bloqueadas.`,
      ephemeral: true
    });
  }

  static async handleDestrancar(interaction, eventId) {
    const event = this.activeEvents.get(eventId);
    if (!event) return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });

    const isCreator = event.criadorId === interaction.user.id;
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isCreator && !isADM && !isCaller) {
      return interaction.reply({ content: '❌ Sem permissão!', ephemeral: true });
    }

    event.trancado = false;
    await this.forceUpdatePanel(interaction, eventId);

    await interaction.reply({
      content: `🔓 **${event.nome}** destrancado! Novas entradas liberadas.`,
      ephemeral: true
    });
  }

  static async handleCancelar(interaction, eventId) {
    const event = this.activeEvents.get(eventId);
    if (!event) return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });

    const isCreator = event.criadorId === interaction.user.id;
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');

    if (!isCreator && !isADM) {
      return interaction.reply({ content: '❌ Sem permissão!', ephemeral: true });
    }

    event.status = 'cancelado';

    try {
      const voiceChannel = await interaction.guild.channels.fetch(event.voiceChannelId);
      if (voiceChannel) await voiceChannel.delete('Cancelado');
    } catch {}

    try {
      const channel = await interaction.guild.channels.fetch(event.textChannelId);
      const message = await channel.messages.fetch(event.painelMessageId);

      const embed = new EmbedBuilder()
        .setTitle(`❌ **${event.nome}** - CANCELADO`)
        .setDescription(`Cancelado por ${interaction.user}`)
        .setColor(0xED4245)
        .setTimestamp();

      await message.edit({ embeds: [embed], components: [] });
    } catch {}

    setTimeout(() => this.activeEvents.delete(eventId), 3600000);

    await interaction.reply({ content: `❌ **${event.nome}** cancelado!`, ephemeral: true });
  }

  static async handleFinalizar(interaction, eventId) {
    const event = this.activeEvents.get(eventId);
    if (!event) return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });

    const isCreator = event.criadorId === interaction.user.id;
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isCreator && !isADM && !isCaller) {
      return interaction.reply({ content: '❌ Sem permissão!', ephemeral: true });
    }

    if (event.status === 'encerrado') {
      return interaction.reply({ content: '❌ Já finalizado!', ephemeral: true });
    }

    event.status = 'encerrado';
    event.finalizadoEm = Date.now();

    if (event.participacaoIndividual) {
      const agora = Date.now();
      for (const p of event.participacaoIndividual.values()) {
        if (p.entradaAtual) {
          const tempo = agora - p.entradaAtual;
          p.tempos.push({ entrada: p.entradaAtual, saida: agora, duracao: tempo });
          p.tempoTotal += tempo;
          p.entradaAtual = null;
        }
      }
    }

    try {
      const voiceChannel = await interaction.guild.channels.fetch(event.voiceChannelId).catch(() => null);
      
      // 🆕 CORREÇÃO: Verificar se o canal existe antes de tentar mover
      const canalAguardando = interaction.guild.channels.cache.find(c => c.name === '🔊╠Aguardando-Evento');
      
      if (voiceChannel && canalAguardando) {
        console.log(`[EVENT] Movendo participantes para ${canalAguardando.name}...`);
        for (const userId of event.participantes) {
          try {
            const member = await interaction.guild.members.fetch(userId);
            if (member?.voice.channel?.id === event.voiceChannelId) {
              await member.voice.setChannel(canalAguardando.id);
            }
          } catch (err) {
            console.log(`[EVENT] Não foi possível mover ${userId}: ${err.message}`);
          }
        }
      } else if (voiceChannel && !canalAguardando) {
        console.log('[EVENT] Canal 🔊╠Aguardando-Evento não encontrado. Participantes não serão movidos.');
        // Desconectar usuários do canal de voz do evento
        for (const userId of event.participantes) {
          try {
            const member = await interaction.guild.members.fetch(userId);
            if (member?.voice.channel?.id === event.voiceChannelId) {
              await member.voice.disconnect('Evento finalizado - canal de destino não encontrado');
            }
          } catch (err) {
            console.log(`[EVENT] Não foi possível desconectar ${userId}: ${err.message}`);
          }
        }
      }

      const categoriaEncerrados = interaction.guild.channels.cache.find(
        c => c.name === '📁 EVENTOS ENCERRADOS' && c.type === ChannelType.GuildCategory
      );

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

      if (voiceChannel) await voiceChannel.delete('Finalizado').catch(() => {});

      const channel = await interaction.guild.channels.fetch(event.textChannelId).catch(() => null);
      if (channel) {
        const message = await channel.messages.fetch(event.painelMessageId).catch(() => null);
        if (message) {
          const embedFinal = new EmbedBuilder()
            .setTitle(`🏁 **${event.nome}** - FINALIZADO`)
            .setDescription(`Finalizado por ${interaction.user}\n📁 ${textChannel ? `<#${textChannel.id}>` : 'N/A'}`)
            .setColor(0x95A5A6)
            .setTimestamp();

          await message.edit({ embeds: [embedFinal], components: [] });
        }
      }

      if (textChannel) {
        const duracao = event.iniciadoEm ? (Date.now() - event.iniciadoEm) : 0;
        const painelLoot = LootSplitUI.createFinishedEventPanel(event, duracao);
        await textChannel.send(painelLoot);
      }

      if (EventStatsHandler.saveEventStats) {
        await EventStatsHandler.saveEventStats(event, interaction.guild);
      }

      setTimeout(() => this.activeEvents.delete(eventId), 3600000);

      await interaction.reply({
        content: `✅ **${event.nome}** finalizado!\n📁 ${textChannel ? `<#${textChannel.id}>` : 'Erro'}`,
        ephemeral: true
      });

    } catch (error) {
      console.error('Erro ao finalizar:', error);
      await interaction.reply({ content: `❌ Erro: ${error.message}`, ephemeral: true });
    }
  }

  static async handleSimulateLoot(interaction, eventId) {
    console.log(`[EVENTACTIONS] Iniciando handleSimulateLoot para ${eventId}`);

    try {
      if (!LootSplitUI) {
        console.error('[EVENTACTIONS] LootSplitUI não importado!');
        return interaction.followUp({
          content: '❌ Erro interno: LootSplitUI não disponível.',
          ephemeral: true
        });
      }

      if (typeof LootSplitUI.createSimulationModal !== 'function') {
        console.error('[EVENTACTIONS] createSimulationModal não é uma função!');
        return interaction.followUp({
          content: '❌ Erro interno: Método de simulação indisponível.',
          ephemeral: true
        });
      }

      console.log(`[EVENTACTIONS] Criando modal...`);
      const modal = LootSplitUI.createSimulationModal(eventId);

      console.log(`[EVENTACTIONS] Mostrando modal...`);
      await interaction.showModal(modal);

      console.log(`[EVENTACTIONS] Modal mostrado com sucesso!`);

    } catch (error) {
      console.error('[EVENTACTIONS] Erro ao mostrar modal:', error);

      try {
        if (interaction.deferred) {
          await interaction.followUp({
            content: `❌ Erro ao abrir simulação: ${error.message}`,
            ephemeral: true
          });
        } else {
          await interaction.reply({
            content: `❌ Erro ao abrir simulação: ${error.message}`,
            ephemeral: true
          });
        }
      } catch (replyError) {
        console.error('[EVENTACTIONS] Não foi possível enviar mensagem de erro:', replyError);
      }
    }
  }

  static async handleResimulateLoot(interaction, eventId) {
    console.log(`[EVENTACTIONS] Re-simulando para ${eventId}`);

    try {
      if (!LootSplitUI || typeof LootSplitUI.createSimulationModal !== 'function') {
        return interaction.followUp({
          content: '❌ Erro interno.',
          ephemeral: true
        });
      }

      const modal = LootSplitUI.createSimulationModal(eventId);
      await interaction.showModal(modal);
    } catch (error) {
      console.error('[EVENTACTIONS] Erro ao reabrir modal:', error);

      try {
        if (interaction.deferred) {
          await interaction.followUp({
            content: `❌ Erro: ${error.message}`,
            ephemeral: true
          });
        }
      } catch {}
    }
  }

  static async handleArchiveLoot(interaction, eventId) {
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isADM && !isCaller) {
      return interaction.reply({ content: '❌ Sem permissão!', ephemeral: true });
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

    try {
      console.log(`[UPDATE-PARTICIPACAO] Criando modal para evento: ${eventId}`);
      
      const modal = new ModalBuilder()
        .setCustomId(`modal_update_participation_${eventId}`)
        .setTitle('📝 Atualizar Participação');

      const dadosInput = new TextInputBuilder()
        .setCustomId('dados_participacao')
        .setLabel('Dados de participação')
        .setPlaceholder('@usuario:01:30:00\n@outro:02:15:30')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(1000);

      modal.addComponents(new ActionRowBuilder().addComponents(dadosInput));

      await interaction.showModal(modal);
      console.log(`[UPDATE-PARTICIPACAO] Modal mostrado com sucesso!`);

    } catch (error) {
      console.error('[UPDATE-PARTICIPACAO] Erro ao mostrar modal:', error);

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: `❌ Erro ao abrir atualização: ${error.message}`,
            ephemeral: true
          });
        }
      } catch (replyError) {
        console.error('[UPDATE-PARTICIPACAO] Não foi possível enviar resposta:', replyError);
      }
    }
  }

  static async handleEventStatsFilter(interaction) {
    await EventStatsHandler.handleFilterChange(interaction);
  }
}

EventActions.activeEvents = new Map();

module.exports = EventActions;
