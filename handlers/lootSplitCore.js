const { EmbedBuilder, ChannelType } = require('discord.js');
const db = require('../utils/database');
const ConfigHandler = require('./configHandler');
const LootSplitUI = require('./lootSplitUI');
const fs = require('fs');
const path = require('path');

class LootSplitCore {
  static simulatedEvents = new Map();
  static dataFile = path.join(__dirname, '..', 'data', 'lootsplits.json');

  static loadSimulations() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
        this.simulatedEvents = new Map(Object.entries(data));
        console.log(`✅ ${this.simulatedEvents.size} lootsplits carregados do arquivo`);
      }
    } catch (error) {
      console.error('Erro ao carregar lootsplits:', error);
      this.simulatedEvents = new Map();
    }
  }

  static saveSimulations() {
    try {
      const dir = path.dirname(this.dataFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Object.fromEntries(this.simulatedEvents);
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Erro ao salvar lootsplits:', error);
    }
  }

  // Calcular presença baseada em tempo real com precisão melhorada
  static calculatePresenceFromTime(presenceData, userId) {
    if (!presenceData || !presenceData.participants || !presenceData.participants[userId]) {
      return 100;
    }

    const userData = presenceData.participants[userId];
    const startTime = presenceData.startTime;
    const endTime = presenceData.endTime || Date.now();
    const totalEventTime = endTime - startTime;

    if (totalEventTime <= 0) return 100;

    let finalTime = userData.totalTime || 0;

    if (userData.isPresent && userData.joinTime) {
      finalTime += (endTime - userData.joinTime);
    }

    finalTime = Math.min(finalTime, totalEventTime);

    let percentage = Math.round((finalTime / totalEventTime) * 100);

    const timeDifference = Math.abs(finalTime - totalEventTime);
    if (timeDifference <= 1000) {
      percentage = 100;
    }

    return Math.max(0, Math.min(100, percentage));
  }

  // Criar nova simulação
  static createSimulation(eventId, event, valorBau, reparo, guildId) {
    const config = ConfigHandler.getConfig(guildId);
    const taxaGuilda = config.taxaGuilda || 0;
    const valorTaxa = Math.floor(valorBau * (taxaGuilda / 100));
    const valorLiquido = valorBau - valorTaxa - reparo;

    const valorPorPessoaFull = Math.floor(valorLiquido / event.participants.length);

    const distribuicao = event.participants.map(userId => {
      const presence = event.presenceData 
        ? this.calculatePresenceFromTime(event.presenceData, userId)
        : (userId === event.criador ? 100 : 70);

      const valorReceber = Math.floor(valorPorPessoaFull * (presence / 100));

      return {
        userId,
        presence: presence,
        valorReceber: valorReceber,
        tempoReal: event.presenceData?.participants[userId]?.totalTime || null
      };
    });

    const totalDistribuido = distribuicao.reduce((acc, p) => acc + p.valorReceber, 0);

    const simulation = {
      eventId,
      valorBau,
      reparo,
      taxaGuilda,
      valorTaxa,
      valorLiquido,
      valorPorPessoa: valorPorPessoaFull,
      distribuicao,
      totalDistribuido,
      archived: false,
      timestamp: new Date(),
      presenceData: event.presenceData,
      channelId: null // 🆕 Guardar ID do canal para deletar depois
    };

    this.simulatedEvents.set(eventId, simulation);
    this.saveSimulations();

    return simulation;
  }

  // Atualizar participação manualmente
  static updateParticipation(eventId, event, updates) {
    const { addMembersRaw, updatePresenceRaw, removeMembersRaw } = updates;
    let modified = false;

    let simulation = this.simulatedEvents.get(eventId);

    if (!simulation) {
      const config = ConfigHandler.getConfig(event.guildId || event.guild?.id);
      const distribuicao = event.participants.map(userId => ({
        userId,
        presence: event.presenceData 
          ? this.calculatePresenceFromTime(event.presenceData, userId)
          : 100,
        valorReceber: 0,
        tempoReal: event.presenceData?.participants[userId]?.totalTime || null
      }));

      simulation = {
        eventId,
        valorBau: 0,
        reparo: 0,
        taxaGuilda: config.taxaGuilda || 0,
        valorTaxa: 0,
        valorLiquido: 0,
        valorPorPessoa: 0,
        distribuicao,
        totalDistribuido: 0,
        archived: false,
        timestamp: new Date(),
        presenceData: event.presenceData,
        channelId: null
      };

      this.simulatedEvents.set(eventId, simulation);
      modified = true;
    }

    // Processar adição de membros
    if (addMembersRaw && addMembersRaw.trim()) {
      const ids = addMembersRaw.match(/\d{17,19}/g) || [];
      for (const userId of ids) {
        if (!event.participants.includes(userId)) {
          event.participants.push(userId);
          modified = true;

          if (!simulation.distribuicao.find(d => d.userId === userId)) {
            simulation.distribuicao.push({
              userId,
              presence: 100,
              valorReceber: 0,
              tempoReal: null
            });
          }
        }
      }
    }

    // Processar remoção de membros
    if (removeMembersRaw && removeMembersRaw.trim()) {
      const ids = removeMembersRaw.match(/\d{17,19}/g) || [];
      for (const userId of ids) {
        const index = event.participants.indexOf(userId);
        if (index > -1) {
          event.participants.splice(index, 1);
          modified = true;

          const distIndex = simulation.distribuicao.findIndex(d => d.userId === userId);
          if (distIndex > -1) {
            simulation.distribuicao.splice(distIndex, 1);
          }
        }
      }
    }

    // Processar atualização de presença manual
    if (updatePresenceRaw && updatePresenceRaw.trim()) {
      const lines = updatePresenceRaw.split('\n');
      for (const line of lines) {
        const match = line.match(/(\d{17,19}):\s*(\d+)/);
        if (match) {
          const userId = match[1];
          const presence = parseInt(match[2]);

          if (presence >= 0 && presence <= 100) {
            const participant = simulation.distribuicao.find(d => d.userId === userId);
            if (participant) {
              participant.presence = presence;
              participant.valorReceber = Math.floor(simulation.valorPorPessoa * (presence / 100));
              modified = true;
            }
          }
        }
      }
    }

    // Recalcular valores se simulation tem valores válidos
    if (simulation.valorPorPessoa > 0) {
      simulation.distribuicao.forEach(p => {
        p.valorReceber = Math.floor(simulation.valorPorPessoa * (p.presence / 100));
      });

      simulation.totalDistribuido = simulation.distribuicao.reduce((acc, p) => acc + p.valorReceber, 0);
    }

    if (modified) {
      this.saveSimulations();
    }

    return { modified, simulation };
  }

  // Arquivar evento e depositar valores
  static async archiveAndDeposit(eventId, event, interaction) {
    const simulation = this.simulatedEvents.get(eventId);
    if (!simulation) {
      return { success: false, error: 'Simulação não encontrada!' };
    }

    if (simulation.archived) {
      return { success: false, error: 'Este evento já foi arquivado!' };
    }

    const guild = interaction.guild;
    const depositosRealizados = [];
    const falhas = [];

    for (const participante of simulation.distribuicao) {
      try {
        const user = db.getUser(participante.userId);
        const valorFinal = participante.valorReceber;

        user.saldo += valorFinal;
        user.totalDepositado += valorFinal;
        db.updateUser(participante.userId, user);

        db.addTransaction('evento', participante.userId, valorFinal, {
          eventId: event.id,
          eventName: event.nome,
          valorBau: simulation.valorBau,
          reparo: simulation.reparo,
          taxaGuilda: simulation.taxaGuilda,
          presence: participante.presence,
          tempoReal: participante.tempoReal,
          tipo: 'lootsplit_final'
        });

        depositosRealizados.push({
          userId: participante.userId,
          valor: valorFinal
        });

        // Notificar usuário na DM
        const member = await guild.members.fetch(participante.userId).catch(() => null);
        if (member) {
          await member.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('💰 **LOOT RECEBIDO!**')
                .setDescription(
                  `> Você recebeu sua parte do lootsplit!\n\n` +
                  `**🎮 Evento:** ${event.nome}\n` +
                  `**💰 Valor:** 🪙 ${valorFinal.toLocaleString()}\n` +
                  `**📊 Presença:** ${participante.presence}%\n` +
                  `**💵 Novo Saldo:** 🪙 ${user.saldo.toLocaleString()}`
                )
                .setColor(0x2ECC71)
                .setTimestamp()
            ]
          }).catch(() => {});
        }

      } catch (error) {
        console.error(`Erro ao depositar para ${participante.userId}:`, error);
        falhas.push(participante.userId);
      }
    }

    simulation.archived = true;
    simulation.dataArquivamento = new Date();

    // 🆕 NOVO: Guardar ID do canal antes de deletar
    const channelToDelete = interaction.channel;
    simulation.channelId = channelToDelete.id;

    this.simulatedEvents.set(eventId, simulation);
    this.saveSimulations();

    // Log no canal de logs
    const logsChannel = guild.channels.cache.find(c => c.name === '📜╠logs-banco');
    if (logsChannel) {
      await logsChannel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('📁 **EVENTO ARQUIVADO - LOOTSPLIT**')
            .setDescription(
              `> Evento finalizado e valores depositados\n\n` +
              `**🎮 Evento:** ${event.nome}\n` +
              `**💰 Valor Total:** 🪙 ${simulation.valorBau.toLocaleString()}\n` +
              `**💸 Taxa Guilda:** ${simulation.taxaGuilda}% (🪙 ${simulation.valorTaxa.toLocaleString()})\n` +
              `**🔧 Reparo:** 🪙 ${simulation.reparo.toLocaleString()}\n` +
              `**📦 Líquido:** 🪙 ${simulation.valorLiquido.toLocaleString()}\n` +
              `**👥 Participantes:** ${depositosRealizados.length}\n` +
              `**💵 Total Distribuído:** 🪙 ${simulation.totalDistribuido.toLocaleString()}\n` +
              `**🏦 Arquivado por:** ${interaction.user}`
            )
            .setColor(0x2ECC71)
            .setTimestamp()
        ]
      });
    }

    // 🆕 NOVO: Deletar o canal do evento encerrado
    try {
      // Aguardar 5 segundos para o usuário ver a mensagem de confirmação
      setTimeout(async () => {
        try {
          await channelToDelete.delete('Evento arquivado - Lootsplit concluído');
          console.log(`🗑️ Canal ${channelToDelete.name} deletado após arquivamento`);
        } catch (deleteError) {
          console.error('Erro ao deletar canal:', deleteError);
        }
      }, 5000);
    } catch (error) {
      console.error('Erro ao agendar deleção do canal:', error);
    }

    return { 
      success: true, 
      depositosRealizados, 
      falhas, 
      simulation,
      channelDeletado: true
    };
  }

  // Extrair evento da mensagem do embed
  static getEventFromMessage(interaction) {
    const embed = interaction.message.embeds[0];
    if (!embed) return null;

    const footerText = embed.footer?.text || '';
    const eventIdMatch = footerText.match(/ID: (evt_[\w_]+)/);
    const criadorMatch = footerText.match(/Criado por <@(\d+)>/);

    if (!eventIdMatch) return null;

    const participants = [];
    const participantsField = embed.fields.find(f => f.name.includes('Participantes'));

    if (participantsField) {
      const lines = participantsField.value.split('\n');
      for (const line of lines) {
        const match = line.match(/<@(\d+)>/);
        if (match && !participants.includes(match[1])) {
          participants.push(match[1]);
        }
      }
    }

    const simulation = this.simulatedEvents.get(eventIdMatch[1]);
    if (simulation && simulation.distribuicao) {
      simulation.distribuicao.forEach(d => {
        if (!participants.includes(d.userId)) {
          participants.push(d.userId);
        }
      });
    }

    return {
      id: eventIdMatch[1],
      nome: embed.title?.replace(/[⏳🔢✅] \*\*LOOTSPLIT - /, '').replace('**', '') || 'Evento',
      criador: criadorMatch ? criadorMatch[1] : null,
      participants: participants,
      presenceData: simulation?.presenceData
    };
  }

  // Criar painel inicial de lootsplit
  static async sendInitialLootPanel(channel, event, participants, presenceData = null) {
    let participantsData;

    if (presenceData) {
      participantsData = participants.map(userId => ({
        userId,
        presence: this.calculatePresenceFromTime(presenceData, userId),
        tempoReal: presenceData.participants[userId]?.totalTime || null
      }));
    } else {
      participantsData = participants.map(userId => ({
        userId,
        presence: userId === event.criador ? 100 : 70 + (userId.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % 31),
        tempoReal: null
      }));
    }

    const embed = LootSplitUI.createLootPanelEmbed(event, participantsData, null, channel.guild.id);
    const buttons = LootSplitUI.createLootPanelButtons(event.id, 'pending');

    const msg = await channel.send({
      content: `💰 **Lootsplit disponível para:** ${participants.map(id => `<@${id}>`).join(' ')}`,
      embeds: [embed],
      components: buttons
    });

    return msg;
  }
}

module.exports = LootSplitCore;
