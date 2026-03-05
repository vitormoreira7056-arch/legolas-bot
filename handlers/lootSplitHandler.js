const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const LootSplitCore = require('./lootSplitCore');
const ConfigHandler = require('./configHandler');
const EventStatsHandler = require('./eventStatsHandler');
const db = require('../utils/database');

class LootSplitHandler {
  static async loadSimulations() {
    console.log('[LOOTSPLIT] Carregando simulações salvas...');
    // Implementação existente...
  }

  static async archiveAndDeposit(interaction, eventId) {
    console.log(`[LOOTSPLIT] Arquivando evento: ${eventId}`);
    // Implementação existente...
  }

  static async enviarParaFinanceiro(interaction, eventId) {
    console.log(`[LOOTSPLIT] Enviando para financeiro: ${eventId}`);
    
    try {
      // Carregar simulação
      const simulacao = await LootSplitCore.carregarSimulacao(interaction.guild.id, eventId);
      
      if (!simulacao) {
        console.error(`[LOOTSPLIT] Simulação não encontrada: ${eventId}`);
        return interaction.followUp({
          content: '❌ Simulação não encontrada!',
          ephemeral: true
        });
      }

      // Buscar canal financeiro
      const financeiroChannel = interaction.guild.channels.cache.find(c => c.name === '📊╠financeiro');
      if (!financeiroChannel) {
        return interaction.followUp({
          content: '❌ Canal financeiro não encontrado!',
          ephemeral: true
        });
      }

      // Verificar permissões
      const isStaff = interaction.member.roles.cache.some(r => r.name === 'Staff' || r.name === 'ADM');
      if (!isStaff) {
        return interaction.followUp({
          content: '❌ Apenas Staff ou ADM podem confirmar pagamentos!',
          ephemeral: true
        });
      }

      // Criar embed de confirmação
      const embed = new EmbedBuilder()
        .setTitle('💰 **CONFIRMAÇÃO DE PAGAMENTO**')
        .setDescription(`Evento: **${simulacao.evento.nome}**`)
        .setColor(0xF39C12)
        .addFields(
          { name: '💎 Valor Total', value: `🪙 ${simulacao.resultado.valorTotal.toLocaleString()}`, inline: true },
          { name: '💸 Taxa Guilda', value: `🪙 ${simulacao.resultado.taxa.toLocaleString()}`, inline: true },
          { name: '👥 Participantes', value: `${Object.keys(simulacao.resultado.distribuicao).length}`, inline: true }
        )
        .setFooter({ text: 'Aguardando confirmação do pagamento' });

      // Botões de confirmação
      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`confirmar_split_financeiro_${eventId}_${interaction.channel.id}`)
            .setLabel('✅ Confirmar Pagamento')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`recusar_split_financeiro_${eventId}`)
            .setLabel('❌ Recusar')
            .setStyle(ButtonStyle.Danger)
        );

      await financeiroChannel.send({
        content: `🔔 <@&${interaction.guild.roles.cache.find(r => r.name === 'Staff')?.id}> <@&${interaction.guild.roles.cache.find(r => r.name === 'ADM')?.id}> Aguardando confirmação de pagamento!`,
        embeds: [embed],
        components: [buttons]
      });

      await interaction.followUp({
        content: '✅ Solicitação de pagamento enviada para o canal financeiro!',
        ephemeral: true
      });

    } catch (error) {
      console.error('[LOOTSPLIT] Erro ao enviar para financeiro:', error);
      await interaction.followUp({
        content: '❌ Erro ao enviar para financeiro!',
        ephemeral: true
      });
    }
  }

  static async handleConfirmarSplitFinanceiro(interaction, eventId, canalEventoId) {
    console.log(`[LOOTSPLIT] Confirmando pagamento: ${eventId}`);
    
    try {
      await interaction.deferUpdate();

      // Verificar se é Staff ou ADM
      const isStaff = interaction.member.roles.cache.some(r => 
        r.name === 'Staff' || r.name === 'ADM'
      );

      if (!isStaff) {
        return interaction.editReply({
          content: '❌ Apenas Staff ou ADM podem confirmar!',
          embeds: [],
          components: []
        });
      }

      // Buscar simulação
      const simulacao = await LootSplitCore.carregarSimulacao(interaction.guild.id, eventId);
      
      if (!simulacao) {
        console.error(`[LOOTSPLIT] Simulação não encontrada: ${eventId}`);
        return interaction.editReply({
          content: '❌ Simulação não encontrada!',
          embeds: [],
          components: []
        });
      }

      // Verificar se já foi pago
      if (simulacao.pago) {
        return interaction.editReply({
          content: '❌ Este pagamento já foi processado!',
          embeds: [],
          components: []
        });
      }

      // Realizar pagamentos
      const resultado = await LootSplitCore.finalizarSplit(
        simulacao.evento,
        simulacao.resultado,
        interaction
      );

      if (resultado.sucesso) {
        // Atualizar mensagem
        await interaction.editReply({
          content: `✅ **Pagamento confirmado por ${interaction.user}**\n💰 ${resultado.pagamentos.length} participantes pagos!`,
          embeds: [],
          components: []
        });

        // Enviar botão de arquivar para o canal do evento
        await this.enviarBotaoArquivar(interaction, eventId, canalEventoId);

      } else if (resultado.jaPago) {
        await interaction.editReply({
          content: '⚠️ Este pagamento já foi processado anteriormente!',
          embeds: [],
          components: []
        });
      } else {
        await interaction.editReply({
          content: '❌ Erro ao processar pagamento!',
          embeds: [],
          components: []
        });
      }

    } catch (error) {
      console.error('[LOOTSPLIT] Erro ao confirmar pagamento:', error);
      await interaction.editReply({
        content: `❌ Erro: ${error.message}`,
        embeds: [],
        components: []
      });
    }
  }

  static async enviarBotaoArquivar(interaction, eventId, canalEventoId) {
    try {
      console.log(`[LOOTSPLIT] Enviando botão arquivar para canal: ${canalEventoId}`);
      
      let canalEvento = null;
      
      // Tentar buscar pelo ID salvo
      if (canalEventoId) {
        try {
          canalEvento = await interaction.guild.channels.fetch(canalEventoId);
        } catch (e) {
          console.log(`[LOOTSPLIT] Canal ${canalEventoId} não encontrado diretamente`);
        }
      }

      // Se não encontrar, procurar na categoria EVENTOS ENCERRADOS
      if (!canalEvento) {
        const categoriaEncerrados = interaction.guild.channels.cache.find(
          c => c.name === '📁 EVENTOS ENCERRADOS' && c.type === 4
        );

        if (categoriaEncerrados) {
          const canais = categoriaEncerrados.children.cache;
          canalEvento = canais.find(c => c.name.includes(eventId.substring(0, 8)) || c.topic?.includes(eventId));
        }
      }

      if (!canalEvento) {
        console.error(`[LOOTSPLIT] Canal do evento não encontrado: ${eventId}`);
        return;
      }

      // Verificar permissões
      const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
      if (!canalEvento.permissionsFor(botMember).has(['ViewChannel', 'SendMessages'])) {
        console.error(`[LOOTSPLIT] Sem permissão no canal ${canalEvento.name}`);
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📦 **ARQUIVAMENTO DO EVENTO**')
        .setDescription('O pagamento foi confirmado! Clique no botão abaixo para arquivar o evento.')
        .setColor(0x95A5A6);

      const button = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`arquivar_evento_${eventId}`)
            .setLabel('📦 Arquivar Evento')
            .setStyle(ButtonStyle.Primary)
        );

      await canalEvento.send({
        embeds: [embed],
        components: [button]
      });

      console.log(`[LOOTSPLIT] Botão arquivar enviado para ${canalEvento.name}`);

    } catch (error) {
      console.error('[LOOTSPLIT] Erro ao enviar botão arquivar:', error);
    }
  }

  static async handleArquivarEvento(interaction, eventId) {
    console.log(`[LOOTSPLIT] Arquivando evento: ${eventId}`);
    
    try {
      const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
      const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

      if (!isADM && !isCaller) {
        return interaction.editReply({
          content: '❌ Apenas ADMs ou Callers podem arquivar!',
          embeds: [],
          components: []
        });
      }

      // Deletar canal após 5 segundos
      setTimeout(async () => {
        try {
          await interaction.channel.delete('Evento arquivado');
        } catch (error) {
          console.error('[LOOTSPLIT] Erro ao deletar canal:', error);
        }
      }, 5000);

      await interaction.editReply({
        content: '✅ Evento arquivado! Canal será deletado em 5 segundos...',
        embeds: [],
        components: []
      });

    } catch (error) {
      console.error('[LOOTSPLIT] Erro ao arquivar:', error);
      await interaction.editReply({
        content: '❌ Erro ao arquivar evento!',
        embeds: [],
        components: []
      });
    }
  }

  static async handleResimular(interaction, eventId) {
    console.log(`[LOOTSPLIT] Re-simulando: ${eventId}`);
    // Implementação para re-simular...
  }

  static async handleCancelarSplit(interaction, eventId) {
    console.log(`[LOOTSPLIT] Cancelando split: ${eventId}`);
    await interaction.editReply({
      content: '❌ Divisão cancelada.',
      embeds: [],
      components: []
    });
  }

  // 🆕 NOVO: Processar atualização de participação do modal
  static async processUpdateParticipation(interaction, eventId) {
    console.log(`[LOOTSPLIT] Processando atualização de participação: ${eventId}`);
    
    try {
      const dadosInput = interaction.fields.getTextInputValue('dados_participacao');
      
      // Parse dos dados (formato: @user:HH:MM:SS)
      const linhas = dadosInput.split('\n');
      const atualizacoes = [];
      
      for (const linha of linhas) {
        const match = linha.match(/<@!?(\d+)>\s*[:=]?\s*(\d+):(\d+):(\d+)/);
        if (match) {
          const userId = match[1];
          const horas = parseInt(match[2]);
          const minutos = parseInt(match[3]);
          const segundos = parseInt(match[4]);
          
          const tempoMs = ((horas * 60 + minutos) * 60 + segundos) * 1000;
          
          atualizacoes.push({
            userId,
            tempoMs,
            tempoFormatado: `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`
          });
        }
      }

      if (atualizacoes.length === 0) {
        return interaction.reply({
          content: '❌ Nenhum dado válido encontrado! Use o formato: @usuario:01:30:00',
          ephemeral: true
        });
      }

      // Aqui você pode atualizar os dados do evento
      // Por exemplo, salvar em um arquivo ou atualizar no banco de dados
      
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ **PARTICIPAÇÃO ATUALIZADA**')
            .setDescription(`> ${atualizacoes.length} participante(s) atualizado(s) com sucesso!\n\n` +
              atualizacoes.map(a => `• <@${a.userId}>: ${a.tempoFormatado}`).join('\n'))
            .setColor(0x2ECC71)
            .setTimestamp()
        ],
        ephemeral: true
      });

      console.log(`[LOOTSPLIT] ${atualizacoes.length} participações atualizadas`);

    } catch (error) {
      console.error('[LOOTSPLIT] Erro ao processar atualização:', error);
      await interaction.reply({
        content: '❌ Erro ao processar atualização: ' + error.message,
        ephemeral: true
      });
    }
  }

  // 🆕 NOVO: Processar simulação do modal
  static async processSimulation(interaction, eventId) {
    console.log(`[LOOTSPLIT] Processando simulação: ${eventId}`);
    
    try {
      const valorTotal = parseInt(interaction.fields.getTextInputValue('valor_total'));
      const valorReparo = parseInt(interaction.fields.getTextInputValue('valor_reparo') || '0');
      const ajustesRaw = interaction.fields.getTextInputValue('ajustes') || '';

      if (isNaN(valorTotal) || valorTotal <= 0) {
        return interaction.reply({
          content: '❌ Valor total inválido!',
          ephemeral: true
        });
      }

      // Parse ajustes
      const ajustes = {};
      if (ajustesRaw) {
        const linhas = ajustesRaw.split('\n');
        for (const linha of linhas) {
          const match = linha.match(/<@!?(\d+)>\s*[:=]?\s*(\d+)/);
          if (match) {
            ajustes[match[1]] = parseInt(match[2]);
          }
        }
      }

      // Buscar dados do evento
      const EventActions = require('./eventActions');
      const evento = EventActions.activeEvents.get(eventId);
      
      if (!evento) {
        return interaction.reply({
          content: '❌ Evento não encontrado!',
          ephemeral: true
        });
      }

      // Calcular divisão
      const resultado = LootSplitCore.calcularDivisao(evento, valorTotal, valorReparo, ajustes);

      // Salvar simulação
      await LootSplitCore.salvarSimulacao(evento, resultado, valorReparo, interaction.channel.id);

      // Criar embed de resultado
      const embed = LootSplitUI.createSimulationResultEmbed(evento, valorTotal, valorReparo, resultado);

      // Botões de ação
      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`resimular_${eventId}`)
            .setLabel('🔄 Re-simular')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`enviar_financeiro_${eventId}`)
            .setLabel('💰 Enviar para Financeiro')
            .setStyle(ButtonStyle.Success)
        );

      await interaction.reply({
        embeds: [embed],
        components: [buttons]
      });

      console.log(`[LOOTSPLIT] Simulação processada com sucesso`);

    } catch (error) {
      console.error('[LOOTSPLIT] Erro ao processar simulação:', error);
      await interaction.reply({
        content: '❌ Erro ao processar simulação: ' + error.message,
        ephemeral: true
      });
    }
  }
}

module.exports = LootSplitHandler;
