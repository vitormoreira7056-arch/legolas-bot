const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const LootSplitCore = require('./lootSplitCore');
const LootSplitUI = require('./lootSplitUI');
const EventActions = require('./actions/eventActions');
const EventStatsHandler = require('./eventStatsHandler');
const fs = require('fs');
const path = require('path');

class LootSplitHandler {
  static async loadSimulations() {
    const arquivo = path.join(__dirname, '..', 'data', 'lootsplits.json');

    try {
      if (fs.existsSync(arquivo)) {
        const dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
        console.log('✅ Simulações de lootsplit carregadas com sucesso!');
        return dados;
      }
    } catch (error) {
      console.error('Erro ao carregar simulações:', error);
    }

    return {};
  }

  static async processSimulation(interaction, eventId) {
    try {
      const valorInput = interaction.fields.getTextInputValue('valor_total');
      const ajustesInput = interaction.fields.getTextInputValue('ajustes') || '';

      const valorTotal = parseInt(valorInput.replace(/\D/g, ''));

      if (isNaN(valorTotal) || valorTotal <= 0) {
        return interaction.reply({
          content: '❌ Valor inválido! Digite um número maior que 0.',
          ephemeral: true
        });
      }

      const ajustes = {};
      if (ajustesInput) {
        const linhas = ajustesInput.split(/[\n,]/);
        for (const linha of linhas) {
          const match = linha.match(/<@!?(\d+)>:(\d+)/) || linha.match(/(\d{17,19}):(\d+)/);
          if (match) {
            ajustes[match[1]] = parseInt(match[2]);
          }
        }
      }

      let evento = EventActions.activeEvents.get(eventId);

      if (!evento) {
        const stats = EventStatsHandler.getEventStats(interaction.guildId, eventId);
        if (stats) {
          evento = {
            ...stats,
            participacaoIndividual: new Map(Object.entries(stats.participacaoIndividual || {}))
          };
        }
      }

      if (!evento) {
        return interaction.reply({
          content: '❌ Evento não encontrado!',
          ephemeral: true
        });
      }

      const resultado = LootSplitCore.calcularDivisao(evento, valorTotal, ajustes);

      await LootSplitCore.salvarSimulacao(evento, resultado);

      const embedResultado = LootSplitUI.createSimulationResultEmbed(evento, valorTotal, resultado.distribuicao);

      const botoes = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`confirmar_split_${eventId}`)
            .setLabel('✅ Confirmar e Pagar')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`resimular_${eventId}`)
            .setLabel('🔄 Resimular')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`cancelar_split_${eventId}`)
            .setLabel('❌ Cancelar')
            .setStyle(ButtonStyle.Danger)
        );

      await interaction.reply({
        embeds: [embedResultado],
        components: [botoes]
      });

    } catch (error) {
      console.error('Erro na simulação:', error);
      await interaction.reply({
        content: '❌ Erro ao processar simulação!',
        ephemeral: true
      });
    }
  }

  static async processUpdateParticipation(interaction, eventId) {
    try {
      const dadosInput = interaction.fields.getTextInputValue('dados_participacao');

      let atualizacoes = [];
      try {
        atualizacoes = JSON.parse(dadosInput);
      } catch {
        const linhas = dadosInput.split('\n');
        for (const linha of linhas) {
          const match = linha.match(/<@!?(\d+)>:(\d{2}):(\d{2}):(\d{2})/) ||
            linha.match(/(\d{17,19}):(\d{2}):(\d{2}):(\d{2})/);
          if (match) {
            const horas = parseInt(match[2]) * 60 * 60 * 1000;
            const minutos = parseInt(match[3]) * 60 * 1000;
            const segundos = parseInt(match[4]) * 1000;
            atualizacoes.push({
              userId: match[1],
              tempo: horas + minutos + segundos
            });
          }
        }
      }

      let evento = EventActions.activeEvents.get(eventId);

      if (!evento) {
        return interaction.reply({
          content: '❌ Evento não encontrado ou já arquivado!',
          ephemeral: true
        });
      }

      for (const atualizacao of atualizacoes) {
        if (evento.participacaoIndividual?.has(atualizacao.userId)) {
          const participacao = evento.participacaoIndividual.get(atualizacao.userId);
          participacao.tempoTotal = atualizacao.tempo || 0;
        }
      }

      const duracaoTotal = evento.duracaoTotal || (evento.iniciadoEm ? Date.now() - evento.iniciadoEm : 0);
      const painelAtualizado = LootSplitUI.createFinishedEventPanel(evento, duracaoTotal);

      await interaction.message.edit(painelAtualizado);

      await interaction.reply({
        content: '✅ Participações atualizadas com sucesso!',
        ephemeral: true
      });

    } catch (error) {
      console.error('Erro ao atualizar participação:', error);
      await interaction.reply({
        content: '❌ Erro ao processar atualização!',
        ephemeral: true
      });
    }
  }

  static async archiveAndDeposit(interaction, eventId) {
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isADM && !isCaller) {
      return interaction.reply({
        content: '❌ Apenas ADMs ou Callers podem arquivar!',
        ephemeral: true
      });
    }

    let evento = EventActions.activeEvents.get(eventId);

    if (!evento) {
      const stats = EventStatsHandler.getEventStats(interaction.guildId, eventId);
      if (stats) {
        evento = stats;
      }
    }

    if (!evento) {
      return interaction.reply({
        content: '❌ Evento não encontrado!',
        ephemeral: true
      });
    }

    const simulacao = await LootSplitCore.carregarSimulacao(interaction.guildId, eventId);

    if (simulacao && !simulacao.finalizado) {
      await LootSplitCore.finalizarSplit(evento, simulacao.resultado, interaction);
    }

    const canalLoot = interaction.channel;
    if (canalLoot) {
      await canalLoot.setName(`📁-${evento.nome}`);
      await canalLoot.send({
        embeds: [{
          setTitle: '✅ Evento Arquivado',
          setDescription: `Evento **${evento.nome}** foi arquivado e pagamentos processados.`,
          setColor: 0x57F287,
          setTimestamp: new Date()
        }]
      });
    }

    await interaction.reply({
      content: '✅ Evento arquivado e taxas depositadas no banco da guilda!',
      ephemeral: true
    });
  }

  static async handleConfirmarSplit(interaction, eventId) {
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isADM && !isCaller) {
      return interaction.reply({
        content: '❌ Apenas ADMs ou Callers podem confirmar o pagamento!',
        ephemeral: true
      });
    }

    let evento = EventActions.activeEvents.get(eventId);

    if (!evento) {
      const stats = EventStatsHandler.getEventStats(interaction.guildId, eventId);
      if (stats) {
        evento = {
          ...stats,
          participacaoIndividual: new Map(Object.entries(stats.participacaoIndividual || {}))
        };
      }
    }

    if (!evento) {
      return interaction.reply({
        content: '❌ Evento não encontrado!',
        ephemeral: true
      });
    }

    const simulacao = await LootSplitCore.carregarSimulacao(interaction.guildId, eventId);

    if (!simulacao) {
      return interaction.reply({
        content: '❌ Simulação não encontrada! Faça uma simulação primeiro.',
        ephemeral: true
      });
    }

    if (simulacao.finalizado) {
      return interaction.reply({
        content: '❌ Este split já foi finalizado!',
        ephemeral: true
      });
    }

    await LootSplitCore.finalizarSplit(evento, simulacao.resultado, interaction);

    await interaction.update({
      content: `✅ **Lootsplit confirmado e pagamentos realizados!**\n💰 Total distribuído: 🪙 ${simulacao.resultado.valorDistribuir.toLocaleString()}\n💸 Taxa guilda: 🪙 ${simulacao.resultado.taxa.toLocaleString()}`,
      components: []
    });
  }

  static async handleResimular(interaction, eventId) {
    const modal = LootSplitUI.createSimulationModal(eventId);
    await interaction.showModal(modal);
  }

  static async handleCancelarSplit(interaction, eventId) {
    await interaction.update({
      content: '❌ Simulação cancelada. Clique em "Simular Lootsplit" para tentar novamente.',
      embeds: [],
      components: []
    });
  }
}

module.exports = LootSplitHandler;
