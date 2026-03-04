const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const ConfigHandler = require('./configHandler');

class LootSplitUI {
  static createFinishedEventPanel(evento, duracaoTotalMs) {
    const config = ConfigHandler.getConfig(evento.guildId) || {};
    const taxaGuilda = config.taxaPadrao || 10;

    // Calcular duração total formatada
    const duracaoHoras = Math.floor(duracaoTotalMs / (1000 * 60 * 60));
    const duracaoMinutos = Math.floor((duracaoTotalMs % (1000 * 60 * 60)) / (1000 * 60));
    const duracaoSegundos = Math.floor((duracaoTotalMs % (1000 * 60)) / 1000);
    const duracaoFormatada = `${duracaoHoras.toString().padStart(2, '0')}:${duracaoMinutos.toString().padStart(2, '0')}:${duracaoSegundos.toString().padStart(2, '0')}`;

    // 🆕 MELHORIA: Calcular quando o evento começou (baseado no iniciadoEm ou criadoEm)
    const inicioEvento = evento.iniciadoEm || evento.criadoEm || Date.now();
    const tempoDesdeInicio = Date.now() - inicioEvento;
    const horasDesdeInicio = Math.floor(tempoDesdeInicio / (1000 * 60 * 60));
    const minutosDesdeInicio = Math.floor((tempoDesdeInicio % (1000 * 60 * 60)) / (1000 * 60));

    let tempoTotalParticipacao = 0;
    const participantesDetalhados = [];

    // Suportar tanto presenceData (novo) quanto participacaoIndividual (legado)
    const participacoes = evento.participacaoIndividual ||
      (evento.presenceData ? new Map(Object.entries(evento.presenceData.participants || {})) : new Map());

    if (participacoes && participacoes.size > 0) {
      for (const [userId, participacao] of participacoes) {
        const tempoTotal = participacao.tempoTotal || participacao.totalTime || 0;
        tempoTotalParticipacao += tempoTotal;

        const porcentagemParticipacao = duracaoTotalMs > 0
          ? ((tempoTotal / duracaoTotalMs) * 100).toFixed(1)
          : 0;

        const horas = Math.floor(tempoTotal / (1000 * 60 * 60));
        const minutos = Math.floor((tempoTotal % (1000 * 60 * 60)) / (1000 * 60));
        const segundos = Math.floor((tempoTotal % (1000 * 60)) / 1000);
        const tempoFormatado = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;

        participantesDetalhados.push({
          userId,
          nickname: participacao.nickname || 'Desconhecido',
          tempoMs: tempoTotal,
          tempoFormatado,
          porcentagem: porcentagemParticipacao
        });
      }
    }

    // 🆕 MELHORIA: Adicionar participantes que estão na lista mas não têm tempo registrado
    if (evento.participantes && evento.participantes.length > 0) {
      for (const userId of evento.participantes) {
        if (!participantesDetalhados.find(p => p.userId === userId)) {
          participantesDetalhados.push({
            userId,
            nickname: 'Não registrado',
            tempoMs: 0,
            tempoFormatado: '00:00:00',
            porcentagem: '0.0'
          });
        }
      }
    }

    participantesDetalhados.sort((a, b) => b.tempoMs - a.tempoMs);

    // 🆕 MELHORIA: Criar lista formatada com campos individuais para melhor visualização
    const fields = [];
    
    // Adicionar campo de informações gerais
    fields.push({
      name: '📊 INFORMAÇÕES GERAIS',
      value: 
        `🕐 **Duração Total:** ${duracaoFormatada}\n` +
        `⏱️ **Tempo desde Início:** ${horasDesdeInicio}h ${minutosDesdeInicio}m\n` +
        `👥 **Total de Participantes:** ${participantesDetalhados.length}\n` +
        `💸 **Taxa da Guilda:** ${taxaGuilda}%`,
      inline: false
    });

    // 🆕 MELHORIA: Lista de participantes em grupos de 25 (limite do Discord)
    if (participantesDetalhados.length > 0) {
      let descricaoParticipantes = '';
      let contador = 0;
      let numeroCampo = 1;

      for (let i = 0; i < participantesDetalhados.length; i++) {
        const p = participantesDetalhados[i];
        const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        
        const linha = `${medalha} <@${p.userId}> **${p.nickname}**\n   ⏱️ ${p.tempoFormatado} (${p.porcentagem}%)\n\n`;
        
        // Se passar de 1024 caracteres, criar novo campo
        if ((descricaoParticipantes + linha).length > 1024) {
          fields.push({
            name: `👥 PARTICIPANTES ${numeroCampo > 1 ? `(CONT. ${numeroCampo})` : ''}`,
            value: descricaoParticipantes || 'Sem dados',
            inline: false
          });
          descricaoParticipantes = linha;
          numeroCampo++;
        } else {
          descricaoParticipantes += linha;
        }
      }

      // Adicionar último campo se houver conteúdo
      if (descricaoParticipantes) {
        fields.push({
          name: `👥 PARTICIPANTES ${numeroCampo > 1 ? `(CONT. ${numeroCampo})` : ''}`,
          value: descricaoParticipantes,
          inline: false
        });
      }
    } else {
      fields.push({
        name: '👥 PARTICIPANTES',
        value: '*Nenhum participante registrado*',
        inline: false
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`💰 **PAINEL DE LOOTSPLIT - ${evento.nome.toUpperCase()}**`)
      .setDescription(`> Evento encerrado e pronto para divisão de loot!`)
      .setColor(0xF1C40F)
      .setTimestamp();

    // Adicionar todos os campos
    embed.addFields(fields);
    
    embed.setFooter({ 
      text: `Evento ID: ${evento.id} • Taxa: ${taxaGuilda}% • Use os botões abaixo para gerenciar` 
    });

    const botoes = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`simular_loot_${evento.id}`)
          .setLabel('🧮 Simular Lootsplit')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`atualizar_participacao_${evento.id}`)
          .setLabel('📝 Atualizar Participação')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`arquivar_evento_${evento.id}`)
          .setLabel('📁 Arquivar Evento')
          .setStyle(ButtonStyle.Success)
      );

    return { embeds: [embed], components: [botoes] };
  }

  // 🆕 CORREÇÃO: Método deve ser static e retornar o modal diretamente
  static createSimulationModal(eventId) {
    const modal = new ModalBuilder()
      .setCustomId(`modal_simulate_${eventId}`)
      .setTitle('🧮 Simular Divisão de Loot');

    const valorInput = new TextInputBuilder()
      .setCustomId('valor_total')
      .setLabel('💰 Valor total do loot (em silver)')
      .setPlaceholder('Ex: 5000000')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(12);

    const ajusteInput = new TextInputBuilder()
      .setCustomId('ajustes')
      .setLabel('⚖️ Ajustes especiais (opcional)')
      .setPlaceholder('Ex: @usuario:150 (adicionar 150%), @usuario:50 (reduzir para 50%)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(500);

    return modal.addComponents(
      new ActionRowBuilder().addComponents(valorInput),
      new ActionRowBuilder().addComponents(ajusteInput)
    );
  }

  static createUpdateParticipationModal(eventId) {
    const modal = new ModalBuilder()
      .setCustomId(`modal_update_participation_${eventId}`)
      .setTitle('📝 Atualizar Tempo de Participação');

    const dadosInput = new TextInputBuilder()
      .setCustomId('dados_participacao')
      .setLabel('Dados de participação (JSON ou formato texto)')
      .setPlaceholder('@usuario:HH:MM:SS ou [{"userId":"123","tempo":"01:30:00"}]')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    return modal.addComponents(
      new ActionRowBuilder().addComponents(dadosInput)
    );
  }

  static createSimulationResultEmbed(evento, valorTotal, resultado) {
    const config = ConfigHandler.getConfig(evento.guildId) || {};
    const taxaPercentual = config.taxaPadrao || 10;
    const valorTaxa = Math.floor(valorTotal * (taxaPercentual / 100));
    const valorLiquido = valorTotal - valorTaxa;

    const embed = new EmbedBuilder()
      .setTitle(`🧮 **SIMULAÇÃO DE LOOTSPLIT**`)
      .setDescription(
        `**💰 Valor Total:** 🪙 ${valorTotal.toLocaleString()}\n` +
        `**💸 Taxa Guilda (${taxaPercentual}%):** 🪙 ${valorTaxa.toLocaleString()}\n` +
        `**💵 Valor Líquido:** 🪙 ${valorLiquido.toLocaleString()}\n\n` +
        `**📊 DIVISÃO POR PARTICIPANTE:**`
      )
      .setColor(0x2ECC71)
      .setTimestamp();

    const campos = [];
    for (const [userId, dados] of Object.entries(resultado.distribuicao || resultado)) {
      let valorStr = `💰 🪙 ${Math.floor(dados.valor).toLocaleString()}`;
      if (dados.ajuste) {
        valorStr += ` (ajuste: ${dados.ajuste})`;
      }

      campos.push({
        name: `${dados.nickname || 'Desconhecido'}`,
        value: `${valorStr}\n⏱️ ${dados.tempoParticipado || '00:00:00'} (${dados.porcentagem}%)`,
        inline: true
      });
    }

    if (campos.length <= 25) {
      embed.addFields(campos);
    } else {
      embed.addFields(campos.slice(0, 24));
      embed.setFooter({ 
        text: `E mais ${campos.length - 24} participantes... • Total: 🪙 ${valorTotal.toLocaleString()}` 
      });
    }

    return embed;
  }
}

module.exports = LootSplitUI;
