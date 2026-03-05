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

      // 🆕 CORREÇÃO: Botões modificados - apenas "Enviar para Financeiro"
      const botoes = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`enviar_financeiro_${eventId}`)
            .setLabel('📊 Enviar para Financeiro')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`resimular_${eventId}`)
            .setLabel('🔄 Resimular')
            .setStyle(ButtonStyle.Secondary),
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

  // 🆕 NOVO: Enviar para canal financeiro para aprovação
  static async enviarParaFinanceiro(interaction, eventId) {
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isStaff = interaction.member.roles.cache.some(r => r.name === 'Staff');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isADM && !isStaff && !isCaller) {
      return interaction.editReply({
        content: '❌ Apenas ADMs, Staff ou Callers podem enviar para o financeiro!',
        embeds: [],
        components: []
      });
    }

    try {
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

      const canalFinanceiro = interaction.guild.channels.cache.find(c => c.name === '📊╠financeiro');
      if (!canalFinanceiro) {
        return interaction.editReply({
          content: '❌ Canal financeiro não encontrado!',
          embeds: [],
          components: []
        });
      }

      // Criar embed para o financeiro
      const embedFinanceiro = new EmbedBuilder()
        .setTitle('💰 SOLICITAÇÃO DE PAGAMENTO LOOTSPLIT')
        .setDescription(
          `**Evento:** ${evento.nome}\n` +
          `**ID:** ${eventId}\n` +
          `**Solicitado por:** ${interaction.user}\n` +
          `**Canal do Evento:** ${interaction.channel}\n\n` +
          `Clique em **"Confirmar e Pagar"** para processar o pagamento aos participantes.`
        )
        .setColor(0xF39C12)
        .addFields(
          { name: '💰 Valor Total', value: `🪙 ${simulacao.resultado.valorTotal.toLocaleString()}`, inline: true },
          { name: '🔧 Reparo', value: `🪙 ${simulacao.valorReparo.toLocaleString()}`, inline: true },
          { name: '💸 Taxa Guilda', value: `${simulacao.resultado.taxaPercentual}% (🪙 ${simulacao.resultado.taxa.toLocaleString()})`, inline: true },
          { name: '💎 Valor a Distribuir', value: `🪙 ${simulacao.resultado.valorDistribuir.toLocaleString()}`, inline: true },
          { name: '👥 Participantes', value: `${Object.keys(simulacao.resultado.distribuicao).length}`, inline: true }
        )
        .setTimestamp();

      // Botões apenas para Staff/ADM
      const botoesFinanceiro = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`confirmar_split_financeiro_${eventId}_${interaction.channelId}`)
            .setLabel('✅ Confirmar e Pagar')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`recusar_split_financeiro_${eventId}`)
            .setLabel('❌ Recusar')
            .setStyle(ButtonStyle.Danger)
        );

      // Salvar referência do canal do evento
      const arquivo = path.join(__dirname, '..', 'data', 'lootsplits.json');
      const dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      if (dados[interaction.guildId] && dados[interaction.guildId][eventId]) {
        dados[interaction.guildId][eventId].canalEventoId = interaction.channelId;
        fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
      }

      await canalFinanceiro.send({
        content: `🔔 <@&${interaction.guild.roles.cache.find(r => r.name === 'Staff')?.id}> <@&${interaction.guild.roles.cache.find(r => r.name === 'ADM')?.id}> Nova solicitação de pagamento!`,
        embeds: [embedFinanceiro],
        components: [botoesFinanceiro]
      });

      // Atualizar mensagem original no canal do evento
      await interaction.editReply({
        content: `⏳ **Aguardando aprovação no financeiro...**\n📊 Solicitação enviada para ${canalFinanceiro}`,
        embeds: [],
        components: []
      });

      // Enviar mensagem no canal do evento informando
      await interaction.channel.send({
        content: `📊 **Solicitação de pagamento enviada para o financeiro!**\nAguardando aprovação de Staff/ADM...`
      });

    } catch (error) {
      console.error('[LOOTSPLIT] Erro ao enviar para financeiro:', error);
      await interaction.editReply({
        content: `❌ Erro: ${error.message}`,
        embeds: [],
        components: []
      });
    }
  }

  // 🆕 CORREÇÃO: Confirmar pagamento vindo do canal financeiro
  static async handleConfirmarSplitFinanceiro(interaction, eventId, canalEventoId) {
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isStaff = interaction.member.roles.cache.some(r => r.name === 'Staff');

    if (!isADM && !isStaff) {
      return interaction.reply({
        content: '❌ Apenas ADMs ou Staff podem confirmar o pagamento!',
        ephemeral: true
      });
    }

    try {
      await interaction.deferUpdate();

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

      // Processar pagamentos
      const resultado = await LootSplitCore.finalizarSplit(evento, simulacao.resultado, interaction);
      
      if (resultado.jaPago || !resultado.sucesso) {
        throw new Error('Falha ao processar pagamentos');
      }

      // Atualizar mensagem no financeiro
      const embedConfirmacao = new EmbedBuilder()
        .setTitle('✅ PAGAMENTO CONFIRMADO')
        .setDescription(`Pagamento processado por ${interaction.user}`)
        .setColor(0x57F287)
        .addFields(
          { name: '💰 Total Distribuído', value: `🪙 ${simulacao.resultado.valorDistribuir.toLocaleString()}`, inline: true },
          { name: '👥 Pagos', value: `${resultado.pagamentos.length}`, inline: true },
          { name: '📅 Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        );

      await interaction.editReply({
        content: `✅ **Pagamento confirmado e processado!**`,
        embeds: [embedConfirmacao],
        components: []
      });

      // 🆕 NOTIFICAR CANAL DO EVENTO E ENVIAR BOTÃO DE ARQUIVAR
      try {
        const canalEvento = await interaction.guild.channels.fetch(canalEventoId);
        if (canalEvento) {
          const embedEvento = new EmbedBuilder()
            .setTitle('✅ LOOTSPLIT PAGO!')
            .setDescription(`O pagamento foi confirmado pela Staff/ADM ${interaction.user}`)
            .setColor(0x57F287)
            .addFields(
              { name: '💰 Total', value: `🪙 ${simulacao.resultado.valorTotal.toLocaleString()}`, inline: true },
              { name: '💸 Taxa', value: `🪙 ${simulacao.resultado.taxa.toLocaleString()}`, inline: true },
              { name: '💎 Líquido', value: `🪙 ${simulacao.resultado.valorDistribuir.toLocaleString()}`, inline: true }
            );

          const botaoArquivar = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`arquivar_evento_${eventId}`)
                .setLabel('📁 Arquivar Evento')
                .setStyle(ButtonStyle.Success)
            );

          await canalEvento.send({
            content: `🎉 **Pagamento do lootsplit confirmado!**`,
            embeds: [embedEvento],
            components: [botaoArquivar]
          });
        }
      } catch (err) {
        console.error('[LOOTSPLIT] Erro ao notificar canal do evento:', err);
      }

    } catch (error) {
      console.error('[LOOTSPLIT] Erro:', error);
      await interaction.editReply({
        content: `❌ Erro: ${error.message}`,
        embeds: [],
        components: []
      });
    }
  }

  // ... (manter outros métodos existentes: processUpdateParticipation, handleArquivarEvento, etc.)
  
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

      if (simulacao && !simulacao.pago) {
        return interaction.editReply({
          content: '⚠️ Este evento ainda não teve o lootsplit pago! Confirme o pagamento antes de arquivar.',
          embeds: [],
          components: []
        });
      }

      if (EventStatsHandler.saveEventStats && evento) {
        await EventStatsHandler.saveEventStats(evento, interaction.guild);
      }

      if (canalAtual) {
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

        setTimeout(async () => {
          try {
            await canalAtual.delete(`Evento arquivado por ${interaction.user.tag}`);
            console.log(`[LOOTSPLIT] Canal ${canalAtual.id} deletado após arquivamento`);
          } catch (err) {
            console.error('[LOOTSPLIT] Erro ao deletar canal:', err);
          }
        }, 3000);
      }

      if (EventActions.activeEvents.has(eventId)) {
        EventActions.activeEvents.delete(eventId);
      }

    } catch (error) {
      console.error('[LOOTSPLIT] Erro ao arquivar evento:', error);
      await interaction.editReply({
        content: `❌ Erro ao arquivar: ${error.message}`,
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
