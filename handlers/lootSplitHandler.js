const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
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
        console.log(`[LOOTSPLIT] Valor inválido: ${valorInput}`);
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

      console.log(`[LOOTSPLIT] Valor total: ${valorTotal}, Reparo: ${valorReparo}`);

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
        console.log(`[LOOTSPLIT] Evento não encontrado no Map, tentando stats...`);
        const stats = EventStatsHandler.getEventStats(interaction.guildId, eventId);
        if (stats) {
          evento = {
            ...stats,
            participacaoIndividual: new Map(Object.entries(stats.participacaoIndividual || {}))
          };
        }
      }

      if (!evento) {
        console.log(`[LOOTSPLIT] Evento ${eventId} não encontrado`);
        return interaction.reply({
          content: '❌ Evento não encontrado!',
          ephemeral: true
        });
      }

      console.log(`[LOOTSPLIT] Evento encontrado: ${evento.nome}`);

      if (!LootSplitCore || typeof LootSplitCore.calcularDivisao !== 'function') {
        console.error('[LOOTSPLIT] LootSplitCore.calcularDivisao não encontrado!');
        return interaction.reply({
          content: '❌ Erro interno: Sistema de cálculo indisponível.',
          ephemeral: true
        });
      }

      const resultado = LootSplitCore.calcularDivisao(evento, valorTotal, valorReparo, ajustes);
      console.log(`[LOOTSPLIT] Cálculo realizado:`, resultado);

      if (LootSplitCore.salvarSimulacao) {
        await LootSplitCore.salvarSimulacao(evento, resultado, valorReparo);
      }

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

      console.log(`[LOOTSPLIT] Simulação concluída com sucesso`);

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

      let atualizacoes = [];
      try {
        atualizacoes = JSON.parse(dadosInput);
      } catch {
        const linhas = dadosInput.split('\n');
        for (const linha of linhas) {
          const match = linha.match(/<@!?(\d+)>:?(\d{2}):(\d{2}):(\d{2})/) ||
            linha.match(/(\d{17,19}):?(\d{2}):(\d{2}):(\d{2})/);
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
      return interaction.reply({
        content: '⚠️ Existe uma simulação pendente para este evento. Finalize ou cancele antes de arquivar.',
        ephemeral: true
      });
    }

    if (simulacao && !simulacao.pago) {
      return interaction.reply({
        content: '⚠️ O split deste evento ainda não foi pago aos participantes!',
        ephemeral: true
      });
    }

    const canalLoot = interaction.channel;
    if (canalLoot) {
      await canalLoot.setName(`📁-${evento.nome.toLowerCase().replace(/\s+/g, '-')}`);
      
      const embedArquivo = new EmbedBuilder()
        .setTitle('✅ Evento Arquivado')
        .setDescription(`Evento **${evento.nome}** foi arquivado e todos os pagamentos foram processados.`)
        .setColor(0x57F287)
        .addFields(
          { name: '💰 Total Distribuído', value: `🪙 ${simulacao?.resultado?.valorDistribuir?.toLocaleString() || 0}`, inline: true },
          { name: '💸 Taxa Guilda', value: `🪙 ${simulacao?.resultado?.taxa?.toLocaleString() || 0}`, inline: true },
          { name: '👥 Participantes', value: `${Object.keys(simulacao?.resultado?.distribuicao || {}).length}`, inline: true }
        )
        .setTimestamp();

      await canalLoot.send({ embeds: [embedArquivo] });
    }

    await interaction.reply({
      content: '✅ Evento arquivado com sucesso!',
      ephemeral: true
    });
  }

  // 🆕 CORREÇÃO IMPORTANTE: Usar editReply quando já deferred
  static async handleConfirmarSplit(interaction, eventId) {
    try {
      const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
      const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

      if (!isADM && !isCaller) {
        // Como já foi deferred no buttonHandler, usar editReply
        return interaction.editReply({
          content: '❌ Apenas ADMs ou Callers podem confirmar o pagamento!',
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
          content: '❌ Simulação não encontrada! Faça uma simulação primeiro.',
          embeds: [],
          components: []
        });
      }

      if (simulacao.pago) {
        return interaction.editReply({
          content: '❌ Este split já foi pago anteriormente!',
          embeds: [],
          components: []
        });
      }

      console.log(`[LOOTSPLIT] Confirmando pagamento para evento ${eventId}`);
      const resultado = await LootSplitCore.finalizarSplit(evento, simulacao.resultado, interaction);
      
      if (resultado.jaPago) {
        return interaction.editReply({
          content: '❌ Este split já foi pago anteriormente!',
          embeds: [],
          components: []
        });
      }

      if (!resultado.sucesso) {
        throw new Error('Falha ao processar pagamentos');
      }

      // Criar embed de confirmação
      const embedConfirmacao = new EmbedBuilder()
        .setTitle('✅ Lootsplit Confirmado e Pago!')
        .setDescription(`Todos os valores foram depositados automaticamente nas contas dos participantes.`)
        .setColor(0x57F287)
        .addFields(
          { 
            name: '💰 Total Distribuído', 
            value: `🪙 ${simulacao.resultado.valorDistribuir.toLocaleString()}`, 
            inline: true 
          },
          { 
            name: '💸 Taxa Guilda', 
            value: `🪙 ${simulacao.resultado.taxa.toLocaleString()} (${simulacao.resultado.taxaPercentual}%)`, 
            inline: true 
          },
          { 
            name: '👥 Participantes Pagos', 
            value: `${resultado.pagamentos.length}`, 
            inline: true 
          }
        )
        .setTimestamp();

      if (simulacao.valorReparo > 0) {
        embedConfirmacao.addFields({
          name: '🔧 Reparo Descontado',
          value: `🪙 ${simulacao.valorReparo.toLocaleString()}`,
          inline: true
        });
      }

      if (resultado.erros.length > 0) {
        embedConfirmacao.addFields({
          name: '⚠️ Atenção',
          value: `${resultado.erros.length} pagamentos falharam. Verifique os logs.`,
          inline: false
        });
      }

      // 🆕 CORREÇÃO: Usar editReply já que foi deferred no buttonHandler
      await interaction.editReply({
        content: `✅ **Lootsplit confirmado e pagamentos realizados!**`,
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

      console.log(`[LOOTSPLIT] Pagamento confirmado com sucesso para evento ${eventId}`);

    } catch (error) {
      console.error('[LOOTSPLIT] Erro ao confirmar split:', error);
      // Usar editReply pois já foi deferred
      await interaction.editReply({
        content: `❌ Erro ao processar pagamento: ${error.message}`,
        embeds: [],
        components: []
      }).catch(() => {
        // Se falhar, tenta followUp
        interaction.followUp({
          content: `❌ Erro ao processar pagamento: ${error.message}`,
          ephemeral: true
        }).catch(() => {});
      });
    }
  }

  static async handleResimular(interaction, eventId) {
    // Resimular abre modal, então não pode ter sido deferred
    // Mas como buttonHandler não deferiu para resimular (já que abre modal), podemos usar reply normal
    const modal = LootSplitUI.createSimulationModal(eventId);
    await interaction.showModal(modal);
  }

  static async handleCancelarSplit(interaction, eventId) {
    // Já foi deferred no buttonHandler
    await interaction.editReply({
      content: '❌ Simulação cancelada. Clique em "Simular Lootsplit" para tentar novamente.',
      embeds: [],
      components: []
    }).catch(async () => {
      // Se falhar, tenta update
      await interaction.update({
        content: '❌ Simulação cancelada. Clique em "Simular Lootsplit" para tentar novamente.',
        embeds: [],
        components: []
      }).catch(() => {});
    });
  }
}

module.exports = LootSplitHandler;
