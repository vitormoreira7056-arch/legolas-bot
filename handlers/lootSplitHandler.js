const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
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
      
      // 🆕 CORREÇÃO: Salvar simulação COM o canal do evento
      await LootSplitCore.salvarSimulacao(evento, resultado, valorReparo, interaction.channelId);

      const embedResultado = LootSplitUI.createSimulationResultEmbed(evento, valorTotal, valorReparo, resultado);

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

      // 🆕 CORREÇÃO: Carregar simulação e verificar se tem canal salvo
      const simulacao = await LootSplitCore.carregarSimulacao(interaction.guildId, eventId);
      if (!simulacao) {
        return interaction.editReply({
          content: '❌ Simulação não encontrada!',
          embeds: [],
          components: []
        });
      }

      // 🆕 CORREÇÃO: Garantir que o canal do evento está salvo
      const canalEventoId = interaction.channelId;
      const arquivo = path.join(__dirname, '..', 'data', 'lootsplits.json');
      
      try {
        const dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
        if (dados[interaction.guildId] && dados[interaction.guildId][eventId]) {
          dados[interaction.guildId][eventId].canalEventoId = canalEventoId;
          dados[interaction.guildId][eventId].canalEventoNome = interaction.channel.name;
          dados[interaction.guildId][eventId].nomeEvento = evento.nome;
          fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
          console.log(`[LOOTSPLIT] Canal do evento salvo: ${canalEventoId} (${interaction.channel.name})`);
        }
      } catch (err) {
        console.error('[LOOTSPLIT] Erro ao salvar canal do evento:', err);
      }

      const canalFinanceiro = interaction.guild.channels.cache.find(c => c.name === '📊╠financeiro');
      if (!canalFinanceiro) {
        return interaction.editReply({
          content: '❌ Canal financeiro não encontrado!',
          embeds: [],
          components: []
        });
      }

      const embedFinanceiro = new EmbedBuilder()
        .setTitle('💰 SOLICITAÇÃO DE PAGAMENTO LOOTSPLIT')
        .setDescription(
          `**Evento:** ${evento.nome}\n` +
          `**ID:** ${eventId}\n` +
          `**Solicitado por:** ${interaction.user}\n` +
          `**Canal do Evento:** <#${canalEventoId}>\n\n` +
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

      // 🆕 CORREÇÃO: Botão com referência clara ao canal do evento
      const botoesFinanceiro = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`confirmar_split_financeiro_${eventId}_${canalEventoId}`)
            .setLabel('✅ Confirmar e Pagar')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`recusar_split_financeiro_${eventId}`)
            .setLabel('❌ Recusar')
            .setStyle(ButtonStyle.Danger)
        );

      await canalFinanceiro.send({
        content: `🔔 <@&${interaction.guild.roles.cache.find(r => r.name === 'Staff')?.id}> <@&${interaction.guild.roles.cache.find(r => r.name === 'ADM')?.id}> Nova solicitação de pagamento!`,
        embeds: [embedFinanceiro],
        components: [botoesFinanceiro]
      });

      await interaction.editReply({
        content: `⏳ **Aguardando aprovação no financeiro...**\n📊 Solicitação enviada para ${canalFinanceiro}\n\n⚠️ O pagamento será processado e confirmado no canal <#${canalEventoId}>`,
        embeds: [],
        components: []
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

  // 🆕 MÉTODO CORRIGIDO: Confirmar pagamento e enviar painel para canal do evento
  static async handleConfirmarSplitFinanceiro(interaction, eventId, canalEventoId) {
    console.log(`[LOOTSPLIT] Confirmação iniciada - Evento: ${eventId}, Canal: ${canalEventoId}`);

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

      // Carregar simulação
      const simulacao = await LootSplitCore.carregarSimulacao(interaction.guildId, eventId);
      
      if (!simulacao) {
        console.error(`[LOOTSPLIT] Simulação não encontrada: ${eventId}`);
        return interaction.editReply({
          content: '❌ Simulação não encontrada! O evento pode já ter sido arquivado.',
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

      // Reconstruir evento
      const evento = {
        id: eventId,
        nome: simulacao.evento.nome,
        guildId: interaction.guildId,
        participacaoIndividual: new Map(simulacao.evento.participantes || [])
      };

      // Processar pagamentos
      const resultado = await LootSplitCore.finalizarSplit(evento, simulacao.resultado, interaction);
      
      if (!resultado.sucesso) {
        throw new Error('Falha ao processar pagamentos');
      }

      // 🆕 CORREÇÃO: Atualizar mensagem no financeiro primeiro
      const embedConfirmacaoFinanceiro = new EmbedBuilder()
        .setTitle('✅ PAGAMENTO CONFIRMADO')
        .setDescription(`Pagamento processado por ${interaction.user}\n\n📝 O recibo foi enviado para o canal do evento.`)
        .setColor(0x57F287)
        .addFields(
          { name: '💰 Total Distribuído', value: `🪙 ${simulacao.resultado.valorDistribuir.toLocaleString()}`, inline: true },
          { name: '👥 Pagos', value: `${resultado.pagamentos.length}`, inline: true },
          { name: '📅 Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        );

      await interaction.editReply({
        content: `✅ **Pagamento confirmado e processado!**`,
        embeds: [embedConfirmacaoFinanceiro],
        components: []
      });

      // 🆕 CORREÇÃO: ENVIAR PAINEL PARA O CANAL DO EVENTO
      try {
        console.log(`[LOOTSPLIT] Tentando enviar painel para canal: ${canalEventoId}`);
        
        let canalEvento = null;
        
        // Tentar 1: Buscar pelo ID direto
        try {
          canalEvento = await interaction.guild.channels.fetch(canalEventoId);
        } catch (e) {
          console.log(`[LOOTSPLIT] Canal não encontrado pelo ID: ${canalEventoId}`);
        }

        // Tentar 2: Se não encontrou, procurar na categoria EVENTOS ENCERRADOS
        if (!canalEvento) {
          console.log(`[LOOTSPLIT] Procurando canal na categoria EVENTOS ENCERRADOS...`);
          
          const categoriaEncerrados = interaction.guild.channels.cache.find(
            c => c.name === 'EVENTOS ENCERRADOS' && c.type === ChannelType.GuildCategory
          );

          if (categoriaEncerrados) {
            // Procurar canal pelo nome do evento
            const nomeCanal = simulacao.evento.nome.toLowerCase().replace(/\s+/g, '-');
            canalEvento = categoriaEncerrados.children.cache.find(
              c => c.name.includes(nomeCanal) || c.name.includes(eventId.slice(-10))
            );

            // Se ainda não encontrou, pegar o primeiro canal na categoria (fallback)
            if (!canalEvento) {
              canalEvento = categoriaEncerrados.children.cache.first();
            }
          }
        }

        // Tentar 3: Procurar em todo o servidor por nome similar
        if (!canalEvento) {
          const nomeCanal = simulacao.evento.nome.toLowerCase();
          canalEvento = interaction.guild.channels.cache.find(c => 
            c.name.toLowerCase().includes(nomeCanal) || 
            c.name.includes(eventId.slice(-10))
          );
        }

        if (!canalEvento) {
          throw new Error('Canal do evento não encontrado em nenhum local');
        }

        console.log(`[LOOTSPLIT] Canal encontrado: ${canalEvento.name} (${canalEvento.id})`);

        // Verificar permissões
        const permissoes = canalEvento.permissionsFor(interaction.guild.members.me);
        if (!permissoes || !permissoes.has(PermissionFlagsBits.SendMessages)) {
          throw new Error('Bot não tem permissão para enviar mensagens no canal do evento');
        }

        // Criar embed de confirmação para o canal do evento
        const embedEvento = new EmbedBuilder()
          .setTitle('✅ LOOTSPLIT PAGO E CONFIRMADO!')
          .setDescription(
            `🎉 **Pagamento processado com sucesso!**\n\n` +
            `**Processado por:** ${interaction.user}\n` +
            `**Data:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
            `Todos os valores foram depositados automaticamente nas contas dos participantes.`
          )
          .setColor(0x57F287)
          .addFields(
            { name: '💰 Valor Total', value: `🪙 ${simulacao.resultado.valorTotal.toLocaleString()}`, inline: true },
            { name: '🔧 Reparo', value: `🪙 ${simulacao.valorReparo.toLocaleString()}`, inline: true },
            { name: '💸 Taxa Guilda', value: `🪙 ${simulacao.resultado.taxa.toLocaleString()} (${simulacao.resultado.taxaPercentual}%)`, inline: true },
            { name: '💎 Líquido Distribuído', value: `🪙 ${simulacao.resultado.valorDistribuir.toLocaleString()}`, inline: true },
            { name: '👥 Participantes', value: `${Object.keys(simulacao.resultado.distribuicao).length}`, inline: true },
            { name: '✅ Status', value: 'PAGO', inline: true }
          )
          .setTimestamp();

        // Criar botão de arquivar
        const botaoArquivar = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`arquivar_evento_${eventId}`)
              .setLabel('📁 Arquivar Evento')
              .setStyle(ButtonStyle.Success)
          );

        // Enviar mensagem no canal do evento
        const mensagemEvento = await canalEvento.send({
          content: `🎉 **Pagamento do lootsplit confirmado e processado!**`,
          embeds: [embedEvento],
          components: [botaoArquivar]
        });

        console.log(`[LOOTSPLIT] Painel enviado com sucesso para ${canalEvento.name}: ${mensagemEvento.id}`);

      } catch (err) {
        console.error('[LOOTSPLIT] Erro ao enviar para canal do evento:', err);
        
        // Tentar enviar para o canal onde o botão foi clicado como fallback
        try {
          await interaction.channel.send({
            content: `⚠️ **Não foi possível enviar a confirmação para o canal do evento (${canalEventoId}).**\n` +
                    `Erro: ${err.message}\n\n` +
                    `**Pagamento foi processado com sucesso!** Verifique o canal do evento manualmente.`
          });
        } catch {}
      }

    } catch (error) {
      console.error('[LOOTSPLIT] Erro ao confirmar pagamento:', error);
      await interaction.editReply({
        content: `❌ Erro ao processar pagamento: ${error.message}`,
        embeds: [],
        components: []
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
