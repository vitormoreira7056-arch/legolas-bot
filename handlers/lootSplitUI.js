const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const ConfigHandler = require('./configHandler');

class LootSplitUI {
  static colors = {
    pending: 0xF39C12,
    simulated: 0x3498DB,
    archived: 0x2ECC71,
    gold: 0xF1C40F
  };

  // 🆕 NOVO: Formatar tempo em HH:MM:SS
  static formatTime(ms) {
    if (!ms || ms <= 0) return '00:00:00';

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  // 🆕 NOVO: Formatar tempo detalhado com horas, minutos e segundos
  static formatTimeDetailed(ms) {
    if (!ms || ms <= 0) return '00:00:00 (0h 0min 0s)';

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const hhmmss = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    if (hours > 0) {
      return `${hhmmss} (${hours}h ${minutes}min ${seconds}s)`;
    } else if (minutes > 0) {
      return `${hhmmss} (${minutes}min ${seconds}s)`;
    } else {
      return `${hhmmss} (${seconds}s)`;
    }
  }

  static createLootPanelEmbed(event, participantsData, simulation = null, guildId) {
    const statusEmojis = {
      pending: '⏳',
      simulated: '🔢',
      archived: '✅'
    };

    const status = simulation ? (simulation.archived ? 'archived' : 'simulated') : 'pending';
    const statusText = {
      pending: 'Aguardando simulação',
      simulated: 'Simulado - Aguardando arquivamento',
      archived: 'Arquivado - Valores depositados'
    };

    // Buscar taxa da guilda configurada
    const config = ConfigHandler.getConfig(guildId);
    const taxaGuilda = config.taxaGuilda || 0;

    const participantsList = participantsData.map((p, index) => {
      const presenceEmoji = p.presence >= 80 ? '🟢' : p.presence >= 50 ? '🟡' : '🔴';
      const valorReceber = simulation ? `→ 🪙 ${Math.floor(simulation.valorPorPessoa * (p.presence / 100)).toLocaleString()}` : '';

      // 🆕 CORREÇÃO: Mostrar tempo em HH:MM:SS
      const tempoInfo = p.tempoReal ? `(${this.formatTime(p.tempoReal)})` : '';

      return `${index + 1}. <@${p.userId}> ${presenceEmoji} **${p.presence}%** ${tempoInfo} ${valorReceber}`;
    }).join('\n');

    // Calcular valores com taxa
    let valorComTaxa = null;
    let taxaValor = null;
    let taxaCalculadaText = '';

    if (simulation) {
      taxaValor = Math.floor(simulation.valorBau * (taxaGuilda / 100));
      valorComTaxa = simulation.valorBau - taxaValor;
      taxaCalculadaText = `(🪙 ${taxaValor.toLocaleString()})`;
    }

    let description = `> Evento finalizado - Distribuição de recompensas\n\n`;
    description += `**📊 Status:** ${statusText[status]}\n`;
    description += `**💸 Taxa Guilda Configurada:** ${taxaGuilda}% ${taxaCalculadaText}\n`;

    // 🆕 NOVO: Mostrar horários de início, fim e duração do evento
    if (simulation?.presenceData?.startTime && simulation?.presenceData?.endTime) {
      const startTime = simulation.presenceData.startTime;
      const endTime = simulation.presenceData.endTime;
      const duration = endTime - startTime;

      description += `\n**⏰ Horário de Início:** <t:${Math.floor(startTime / 1000)}:F>\n`;
      description += `**🏁 Horário de Término:** <t:${Math.floor(endTime / 1000)}:F>\n`;
      description += `**⏱️ Duração Total do Evento:** ${this.formatTimeDetailed(duration)}\n`;
    } else if (simulation?.presenceData?.totalDuration) {
      description += `**⏱️ Duração do Evento:** ${this.formatTimeDetailed(simulation.presenceData.totalDuration)}\n`;
    }

    if (simulation) {
      description += `\n**💰 Valor do Baú:** 🪙 ${simulation.valorBau.toLocaleString()}\n`;
      description += `**📦 Valor Líquido (após taxa):** 🪙 ${valorComTaxa ? valorComTaxa.toLocaleString() : simulation.valorLiquido.toLocaleString()}\n`;
      description += `**🔧 Reparo:** 🪙 ${simulation.reparo.toLocaleString()}\n`;
      description += `**👤 Base por Pessoa (100%):** 🪙 ${simulation.valorPorPessoa.toLocaleString()}\n`;

      if (taxaGuilda > 0) {
        description += `\n**📐 Cálculo da Taxa:**\n`;
        description += `\`\`\`yaml\n`;
        description += `Valor Total: 🪙 ${simulation.valorBau.toLocaleString()}\n`;
        description += `Taxa Guilda (${taxaGuilda}%): -🪙 ${taxaValor.toLocaleString()}\n`;
        description += `Reparo: -🪙 ${simulation.reparo.toLocaleString()}\n`;
        description += `Valor Líquido: 🪙 ${valorComTaxa.toLocaleString()}\n`;
        description += `Por Pessoa (100%): 🪙 ${simulation.valorPorPessoa.toLocaleString()}\n`;
        description += `\`\`\``;
      }

      description += `\n🕐 *A presença é calculada automaticamente pelo tempo no evento*\n`;
      description += `*Você pode ajustar manualmente se necessário*`;
    } else {
      if (taxaGuilda > 0) {
        description += `\n**📐 Exemplo com taxa atual (${taxaGuilda}%):**\n`;
        description += `Se o baú tiver 🪙 1.000.000, a guilda retém 🪙 ${Math.floor(1000000 * (taxaGuilda / 100)).toLocaleString()}\n`;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`${statusEmojis[status]} **LOOTSPLIT - ${event.nome}**`)
      .setDescription(description)
      .setColor(this.colors[status])
      .addFields({
        name: `🎮 Participantes (${participantsData.length}) - Presença (Tempo HH:MM:SS)`,
        value: participantsList || '*Nenhum participante*',
        inline: false
      })
      .setFooter({ text: `ID: ${event.id} • Criado por <@${event.criador}>` })
      .setTimestamp();

    return embed;
  }

  static createLootPanelButtons(eventId, status = 'pending') {
    const rows = [];

    if (status === 'pending') {
      rows.push(
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`simulate_loot_${eventId}`)
              .setLabel('🔢 Simular Evento')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🧮'),
            new ButtonBuilder()
              .setCustomId(`update_participation_${eventId}`)
              .setLabel('📝 Atualizar Participação')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('👥')
          )
      );
    } else if (status === 'simulated') {
      rows.push(
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`archive_loot_${eventId}`)
              .setLabel('📁 Arquivar Evento')
              .setStyle(ButtonStyle.Success)
              .setEmoji('💰'),
            new ButtonBuilder()
              .setCustomId(`resimulate_loot_${eventId}`)
              .setLabel('🔢 Recalcular')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('🔄'),
            new ButtonBuilder()
              .setCustomId(`update_participation_${eventId}`)
              .setLabel('📝 Atualizar Participação')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('👥')
          )
      );
    } else if (status === 'archived') {
      rows.push(
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`archived_${eventId}`)
              .setLabel('✅ Arquivado')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          )
      );
    }

    return rows;
  }

  static createSimulationModal(eventId) {
    const modal = new ModalBuilder()
      .setCustomId(`modal_simulate_${eventId}`)
      .setTitle('🔢 Simular Distribuição de Loot');

    const valorBauInput = new TextInputBuilder()
      .setCustomId('loot_valor_bau')
      .setLabel('💰 Valor Total do Baú')
      .setPlaceholder('Ex: 5000000')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(12);

    const reparoInput = new TextInputBuilder()
      .setCustomId('loot_reparo')
      .setLabel('🔧 Valor do Reparo (deduzir)')
      .setPlaceholder('Ex: 500000 ou 0')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(12);

    return modal.addComponents(
      new ActionRowBuilder().addComponents(valorBauInput),
      new ActionRowBuilder().addComponents(reparoInput)
    );
  }

  static createUpdateParticipationModal(eventId) {
    const modal = new ModalBuilder()
      .setCustomId(`modal_update_participation_${eventId}`)
      .setTitle('📝 Atualizar Participação');

    const addMembersInput = new TextInputBuilder()
      .setCustomId('add_members')
      .setLabel('➕ Adicionar membros (IDs ou @menções)')
      .setPlaceholder('Ex: @usuario1 @usuario2 ou 123456789 987654321')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(500);

    const updatePresenceInput = new TextInputBuilder()
      .setCustomId('update_presence')
      .setLabel('📊 Ajustar presença manual (ID:% novo)')
      .setPlaceholder('Ex: 123456789:50 (para 50%)\n987654321:100 (para 100%)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(1000);

    const removeMembersInput = new TextInputBuilder()
      .setCustomId('remove_members')
      .setLabel('➖ Remover membros (IDs)')
      .setPlaceholder('Ex: 123456789 987654321')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(500);

    return modal.addComponents(
      new ActionRowBuilder().addComponents(addMembersInput),
      new ActionRowBuilder().addComponents(updatePresenceInput),
      new ActionRowBuilder().addComponents(removeMembersInput)
    );
  }
}

module.exports = LootSplitUI;
