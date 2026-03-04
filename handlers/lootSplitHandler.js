const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const LootSplitCore = require('./lootSplitCore');
const LootSplitUI = require('./lootSplitUI');
const EventActions = require('./actions/eventActions');
const EventStatsHandler = require('./eventStatsHandler');
const EventHandler = require('./eventHandler');
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

      const resultado = LootSplitCore.calcularDivisao(evento, valorTotal, valorReparo, ajustes);
      console.log(`[LOOTSPLIT] Cálculo realizado:`, resultado);

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

      console.log(`[LOOTSPLIT] Simulação concluída com sucesso`);

    } catch (error) {
      console.error('[LOOTSPLIT] Erro na simulação:', error);
      await interaction.reply({
        content: `❌ Erro ao processar simulação: ${error.message}`,
        ephemeral: true
      });
    }
  }

  // 🆕 CORREÇÃO: Atualizar participação agora funciona corretamente
  static async processUpdateParticipation(interaction, eventId) {
    try {
      const dadosInput = interaction.fields.getTextInputValue('dados_participacao');

      // Parse do formato: @user:HH:MM:SS ou userId:HH:MM:SS
      const atualizacoes = [];
      const linhas = dadosInput.split('\n');
      
      for (const linha of linhas) {
        const trimmed = linha.trim();
        if (!trimmed) continue;

        // Match @user:HH:MM:SS ou userId:HH:MM:SS
        const match = trimmed.match(/<@!?(\d+)>:?(\d{1,2}):(\d{2}):(\d{2})/) ||
                     trimmed.match(/(\d{17,19}):?(\d{1,2}):(\d{2}):(\d{2})/);
        
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

      if (atualizacoes.length === 0) {
        return interaction.reply({
          content: '❌ Formato inválido! Use: `@usuario:01:30:00` ou `123456789:01:30:00`',
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
          content: '❌ Evento não encontrado ou já arquivado!',
          ephemeral: true
        });
      }

      // Atualizar tempos
      for (const atualizacao of atualizacoes) {
        if (evento.participacaoIndividual?.has(atualizacao.userId)) {
          const participacao = evento.participacaoIndividual.get(atualizacao.userId);
          participacao.tempoTotal = atualizacao.tempo;
        } else {
          // Adicionar novo participante se não existir
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

      // Atualizar o evento no Map se estiver ativo
      if (EventActions.activeEvents.has(eventId)) {
        EventActions.activeEvents.set(eventId, evento);
      }

      const duracaoTotal = evento.duracaoTotal || (evento.iniciadoEm ? Date.now() - evento.iniciadoEm : 0);
      const painelAtualizado = LootSplitUI.createFinishedEventPanel(evento, duracaoTotal);

      // Atualizar a mensagem original
      await interaction.message.edit(painelAtualizado);

      await interaction.reply({
        content: `✅ **${atualizacoes.length}** participação(ões) atualizada(s) com sucesso!\n\n${atualizacoes.map(a => `<@${a.userId}>: ${LootSplitCore.formatarTempo(a.tempo)}`).join('\n')}`,
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

  // 🆕 CORREÇÃO: Arquivar evento agora deleta o canal e salva estatísticas
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

    try {
      let evento = EventActions.activeEvents.get(eventId);

      if (!evento) {
        const stats = EventStatsHandler.getEventStats(interaction.guildId, eventId);
        if (stats) {
          evento = stats;
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

      // Verificar se foi pago
      if (simulacao && !simulacao.pago) {
        return interaction.editReply({
          content: '⚠️ Este evento ainda não teve o lootsplit pago! Confirme o pagamento antes de arquivar.',
          embeds: [],
          components: []
        });
      }

      // Salvar estatísticas finais antes de deletar
      if (EventStatsHandler.saveEventStats && evento) {
        await EventStatsHandler.saveEventStats(evento, interaction.guild);
      }

      // 🆕 MOVER O CANAL PARA CATEGORIA DE ARQUIVADOS (ao invés de deletar)
      const categoriaArquivados = interaction.guild.channels.cache.find(
        c => c.name === '📁 EVENTOS ARQUIVADOS' && c.type === 4
      );

      const canalAtual = interaction.channel;

      if (categoriaArquivados && canalAtual) {
        // Mover para categoria de arquivados e renomear
        await canalAtual.setParent(categoriaArquivados.id, { lockPermissions: false });
        await canalAtual.setName(`📁-${evento.nome.toLowerCase().replace(/\s+/g, '-')}`);
        
        // Remover permissões de escrita para não-admins
        await canalAtual.permissionOverwrites.edit(interaction.guild.id, {
          SendMessages: false,
          AddReactions: false
        });

        // Enviar mensagem final
        const embedFinal = new EmbedBuilder()
          .setTitle('📁 Evento Arquivado')
          .setDescription(`Este evento foi arquivado e todos os pagamentos foram processados.`)
          .setColor(0x95A5A6)
          .addFields(
            { name: '💰 Total Distribuído', value: `🪙 ${simulacao?.resultado?.valorDistribuir?.toLocaleString() || 0}`, inline: true },
            { name: '💸 Taxa Guilda', value: `🪙 ${simulacao?.resultado?.taxa?.toLocaleString() || 0}`, inline: true },
            { name: '👥 Participantes', value: `${Object.keys(simulacao?.resultado?.distribuicao || {}).length}`, inline: true }
          )
          .setTimestamp();

        await canalAtual.send({ embeds: [embedFinal] });

        // Atualizar mensagem de confirmação
        await interaction.editReply({
          content: `✅ **Evento arquivado com sucesso!**\n📁 Canal movido para ${categoriaArquivados}`,
          embeds: [],
          components: []
        });

      } else {
        // Se não tiver categoria, apenas renomeia e tranca
        if (canalAtual) {
          await canalAtual.setName(`📁-${evento.nome.toLowerCase().replace(/\s+/g, '-')}`);
          await canalAtual.permissionOverwrites.edit(interaction.guild.id, {
            SendMessages: false
          });

          await interaction.editReply({
            content: `✅ **Evento arquivado!**\n📁 Canal renomeado e trancado.`,
            embeds: [],
            components: []
          });
        }
      }

      // Remover do mapa de eventos ativos
      if (EventActions.activeEvents.has(eventId)) {
        EventActions.activeEvents.delete(eventId);
      }

      console.log(`[LOOTSPLIT] Evento ${eventId} arquivado por ${interaction.user.tag}`);

    } catch (error) {
      console.error('[LOOTSPLIT] Erro ao arquivar evento:', error);
      await interaction.editReply({
        content: `❌ Erro ao arquivar evento: ${error.message}`,
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

      // 🆕 AGORA COM BOTÃO DE ARQUIVAR APENAS APÓS PAGAMENTO
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
      await interaction.editReply({
        content: `❌ Erro ao processar pagamento: ${error.message}`,
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
      content: '❌ Simulação cancelada. Clique em "Simular Lootsplit" para tentar novamente.',
      embeds: [],
      components: []
    });
  }
}

module.exports = LootSplitHandler;
