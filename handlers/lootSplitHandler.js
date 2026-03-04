const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
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
      console.log(`[LOOTSPLIT] Iniciando simulação para evento ${eventId}`);

      const valorInput = interaction.fields.getTextInputValue('valor_total');
      const reparoInput = interaction.fields.getTextInputValue('valor_reparo') || '0';
      const ajustesInput = interaction.fields.getTextInputValue('ajustes') || '';

      const valorTotal = parseInt(valorInput.replace(/\D/g, ''));
      const valorReparo = parseInt(reparoInput.replace(/\D/g, '')) || 0;

      if (isNaN(valorTotal) || valorTotal <= 0) {
        return interaction.reply({
          content: '❌ Valor inválido! Digite um número maior que 0.',
          ephemeral: true
        });
      }

      if (valorReparo > valorTotal) {
        return interaction.reply({
          content: '❌ O valor do reparo não pode ser maior que o valor total do loot!',
          ephemeral: true
        });
      }

      const ajustes = {};
      if (ajustesInput) {
        const linhas = ajustesInput.split(/[\n,]/);
        for (const linha of linhas) {
          const match = linha.match(/<@!?(\d+)>:(\d+)/) || linha.match(/(\d{17,19}):(\d+)/);
          if (match) ajustes[match[1]] = parseInt(match[2]);
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

      const resultado = LootSplitCore.calcularDivisao(evento, valorTotal, valorReparo, ajustes);
      await LootSplitCore.salvarSimulacao(evento, resultado, valorReparo);

      const embedResultado = LootSplitUI.createSimulationResultEmbed(evento, valorTotal, valorReparo, resultado);

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
      console.error('[LOOTSPLIT] Erro na simulação:', error);
      await interaction.reply({
        content: `❌ Erro ao processar simulação: ${error.message}`,
        ephemeral: true
      });
    }
  }

  static async processUpdateParticipation(interaction, eventId) {
    try {
      const dadosInput = interaction.fields.getTextInputValue('dados_participacao');
      const atualizacoes = [];
      const linhas = dadosInput.split('\n');
      
      for (const linha of linhas) {
        const trimmed = linha.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/<@!?(\d+)>:?(\d{1,2}):(\d{2}):(\d{2})/) ||
                     trimmed.match(/(\d{17,19}):?(\d{1,2}):(\d{2}):(\d{2})/);
        if (match) {
          const tempo = parseInt(match[2]) * 60 * 60 * 1000 + 
                       parseInt(match[3]) * 60 * 1000 + 
                       parseInt(match[4]) * 1000;
          atualizacoes.push({ userId: match[1], tempo });
        }
      }

      if (atualizacoes.length === 0) {
        return interaction.reply({
          content: '❌ Formato inválido! Use: `@usuario:01:30:00`',
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

      for (const atualizacao of atualizacoes) {
        if (evento.participacaoIndividual?.has(atualizacao.userId)) {
          evento.participacaoIndividual.get(atualizacao.userId).tempoTotal = atualizacao.tempo;
        } else {
          const member = await interaction.guild.members.fetch(atualizacao.userId).catch(() => null);
          if (member) {
            evento.participacaoIndividual.set(atualizacao.userId, {
              userId: atualizacao.userId,
              nickname: member.nickname || member.user.username,
              tempos: [],
              tempoTotal: atualizacao.tempo,
              entradaAtual: null
            });
          }
        }
      }

      if (EventActions.activeEvents.has(eventId)) {
        EventActions.activeEvents.set(eventId, evento);
      }

      const duracaoTotal = evento.duracaoTotal || (evento.iniciadoEm ? Date.now() - evento.iniciadoEm : 0);
      const painelAtualizado = LootSplitUI.createFinishedEventPanel(evento, duracaoTotal);
      await interaction.message.edit(painelAtualizado);

      await interaction.reply({
        content: `✅ **${atualizacoes.length}** participação(ões) atualizada(s)!`,
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

  // 🆕 CORREÇÃO: Agora DELETA o canal ao arquivar
  static async handleArquivarEvento(interaction, eventId) {
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isADM && !isCaller) {
      return interaction.editReply({
        content: '❌ Apenas ADMs ou Callers podem arquivar eventos!',
        embeds: [],
        components: []
      });
    }

    const canalAtual = interaction.channel;

    try {
      let evento = EventActions.activeEvents.get(eventId);
      if (!evento) {
        const stats = EventStatsHandler.getEventStats(interaction.guildId, eventId);
        if (stats) evento = stats;
      }

      if (!evento) {
        return interaction.editReply({
          content: '❌ Evento não encontrado!',
          embeds: [],
          components: []
        });
      }

      const simulacao = await LootSplitCore.carregarSimulacao(interaction.guildId, eventId);

      // Verificar se foi pago
      if (simulacao && !simulacao.pago) {
        return interaction.editReply({
          content: '⚠️ Este evento ainda não teve o lootsplit pago! Confirme o pagamento antes de arquivar.',
          embeds: [],
          components: []
        });
      }

      // Salvar estatísticas antes de deletar
      if (EventStatsHandler.saveEventStats && evento) {
        await EventStatsHandler.saveEventStats(evento, interaction.guild);
      }

      // 🆕 DELETAR O CANAL (não apenas mover)
      if (canalAtual) {
        // Enviar mensagem final antes de deletar
        const embedFinal = new EmbedBuilder()
          .setTitle('✅ Evento Arquivado')
          .setDescription(`Este canal será deletado em 3 segundos...`)
          .setColor(0x57F287)
          .addFields(
            { name: '💰 Total Distribuído', value: `🪙 ${simulacao?.resultado?.valorDistribuir?.toLocaleString() || 0}`, inline: true },
            { name: '💸 Taxa Guilda', value: `🪙 ${simulacao?.resultado?.taxa?.toLocaleString() || 0}`, inline: true },
            { name: '👥 Participantes', value: `${Object.keys(simulacao?.resultado?.distribuicao || {}).length}`, inline: true }
          );

        await interaction.editReply({
          content: `✅ **Evento arquivado com sucesso!**\n🗑️ Canal será deletado em 3 segundos...`,
          embeds: [embedFinal],
          components: []
        });

        // Aguardar 3 segundos para usuário ver a mensagem
        setTimeout(async () => {
          try {
            await canalAtual.delete(`Evento arquivado por ${interaction.user.tag}`);
            console.log(`[LOOTSPLIT] Canal ${canalAtual.id} deletado após arquivamento`);
          } catch (err) {
            console.error('[LOOTSPLIT] Erro ao deletar canal:', err);
          }
        }, 3000);
      }

      // Remover do mapa de eventos ativos
      if (EventActions.activeEvents.has(eventId)) {
        EventActions.activeEvents.delete(eventId);
      }

      console.log(`[LOOTSPLIT] Evento ${eventId} arquivado e canal deletado por ${interaction.user.tag}`);

    } catch (error) {
      console.error('[LOOTSPLIT] Erro ao arquivar evento:', error);
      await interaction.editReply({
        content: `❌ Erro ao arquivar: ${error.message}`,
        embeds: [],
        components: []
      });
    }
  }

  static async handleConfirmarSplit(interaction, eventId) {
    try {
      const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
      const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

      if (!isADM && !isCaller) {
        return interaction.editReply({
          content: '❌ Apenas ADMs ou Callers podem confirmar!',
          embeds: [],
          components: []
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
        return interaction.editReply({
          content: '❌ Evento não encontrado!',
          embeds: [],
          components: []
        });
      }

      const simulacao = await LootSplitCore.carregarSimulacao(interaction.guildId, eventId);
      if (!simulacao) {
        return interaction.editReply({
          content: '❌ Simulação não encontrada!',
          embeds: [],
          components: []
        });
      }

      if (simulacao.pago) {
        return interaction.editReply({
          content: '❌ Este split já foi pago!',
          embeds: [],
          components: []
        });
      }

      const resultado = await LootSplitCore.finalizarSplit(evento, simulacao.resultado, interaction);
      
      if (resultado.jaPago || !resultado.sucesso) {
        throw new Error('Falha ao processar pagamentos');
      }

      const embedConfirmacao = new EmbedBuilder()
        .setTitle('✅ Lootsplit Confirmado e Pago!')
        .setDescription(`Todos os valores foram depositados automaticamente.`)
        .setColor(0x57F287)
        .addFields(
          { name: '💰 Total Distribuído', value: `🪙 ${simulacao.resultado.valorDistribuir.toLocaleString()}`, inline: true },
          { name: '💸 Taxa Guilda', value: `🪙 ${simulacao.resultado.taxa.toLocaleString()}`, inline: true },
          { name: '👥 Pagos', value: `${resultado.pagamentos.length}`, inline: true }
        );

      if (simulacao.valorReparo > 0) {
        embedConfirmacao.addFields({
          name: '🔧 Reparo', value: `🪙 ${simulacao.valorReparo.toLocaleString()}`, inline: true
        });
      }

      await interaction.editReply({
        content: `✅ **Pagamentos realizados!**`,
        embeds: [embedConfirmacao],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`arquivar_evento_${eventId}`)
              .setLabel('📁 Arquivar Evento')
              .setStyle(ButtonStyle.Success)
          )
        ]
      });

    } catch (error) {
      console.error('[LOOTSPLIT] Erro:', error);
      await interaction.editReply({
        content: `❌ Erro: ${error.message}`,
        embeds: [],
        components: []
      });
    }
  }

  static async handleResimular(interaction, eventId) {
    const modal = LootSplitUI.createSimulationModal(eventId);
    await interaction.showModal(modal);
  }

  static async handleCancelarSplit(interaction, eventId) {
    await interaction.editReply({
      content: '❌ Simulação cancelada.',
      embeds: [],
      components: []
    });
  }
}

module.exports = LootSplitHandler;
