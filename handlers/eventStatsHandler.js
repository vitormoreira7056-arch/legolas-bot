const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class EventStatsHandler {
  static async initializePanel(guild, channel) {
    const embed = new EmbedBuilder()
      .setTitle('📊 **ESTATÍSTICAS DE EVENTOS**')
      .setDescription('Aqui você pode acompanhar as estatísticas de participação em eventos.')
      .setColor(0x3498DB)
      .addFields(
        { name: '📅 Período', value: 'Últimos 30 dias', inline: true },
        { name: '🔥 Eventos Realizados', value: '0', inline: true },
        { name: '👥 Total de Participações', value: '0', inline: true }
      )
      .setTimestamp();

    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('stats_filter_7d')
          .setLabel('7 dias')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('stats_filter_2w')
          .setLabel('2 semanas')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('stats_filter_1m')
          .setLabel('1 mês')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('stats_filter_all')
          .setLabel('Tudo')
          .setStyle(ButtonStyle.Secondary)
      );

    const msg = await channel.send({ embeds: [embed], components: [buttons] });
    
    // Salvar ID da mensagem do painel
    const arquivo = path.join(__dirname, '..', 'data', 'eventStats.json');
    let dados = {};
    
    try {
      if (fs.existsSync(arquivo)) {
        dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      }
    } catch (error) {
      console.error('Erro ao ler stats:', error);
    }

    if (!dados[guild.id]) {
      dados[guild.id] = { historico: [], painel: null };
    }
    
    dados[guild.id].painel = {
      channelId: channel.id,
      messageId: msg.id,
      lastUpdate: Date.now()
    };

    try {
      fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
    } catch (error) {
      console.error('Erro ao salvar painel:', error);
    }

    return msg;
  }

  static async saveEventStats(evento, guild) {
    const arquivo = path.join(__dirname, '..', 'data', 'eventStats.json');
    let dados = {};
    
    try {
      if (fs.existsSync(arquivo)) {
        dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      }
    } catch (error) {
      console.error('Erro ao ler stats:', error);
    }

    if (!dados[guild.id]) {
      dados[guild.id] = { historico: [], painel: null };
    }

    const participacaoSerializada = {};
    if (evento.participacaoIndividual) {
      if (evento.participacaoIndividual instanceof Map) {
        for (const [userId, part] of evento.participacaoIndividual) {
          participacaoSerializada[userId] = {
            userId: part.userId,
            nickname: part.nickname,
            tempos: part.tempos || [],
            tempoTotal: part.tempoTotal,
            entradaAtual: null
          };
        }
      } else {
        Object.assign(participacaoSerializada, evento.participacaoIndividual);
      }
    }

    const statsEvento = {
      id: evento.id,
      nome: evento.nome,
      tipo: evento.tipo,
      criadorId: evento.criadorId,
      iniciadoEm: evento.iniciadoEm,
      finalizadoEm: evento.finalizadoEm,
      duracaoTotal: evento.duracaoTotal,
      participantes: evento.participantes || [],
      participacaoIndividual: participacaoSerializada,
      status: 'encerrado',
      canalTextoId: evento.textChannelId,
      dataRegistro: new Date().toISOString()
    };

    const indexExistente = dados[guild.id].historico.findIndex(e => e.id === evento.id);
    if (indexExistente >= 0) {
      dados[guild.id].historico[indexExistente] = statsEvento;
    } else {
      dados[guild.id].historico.push(statsEvento);
    }
    
    if (dados[guild.id].historico.length > 100) {
      dados[guild.id].historico = dados[guild.id].historico.slice(-100);
    }

    try {
      fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
    } catch (error) {
      console.error('Erro ao salvar stats:', error);
    }
    
    await this.updatePanel(guild);
  }

  static async updatePanel(guild) {
    const arquivo = path.join(__dirname, '..', 'data', 'eventStats.json');
    
    try {
      if (!fs.existsSync(arquivo)) return;
      
      const dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      const guildData = dados[guild.id];
      
      if (!guildData?.painel) return;

      const channel = guild.channels.cache.get(guildData.painel.channelId);
      if (!channel) return;

      const message = await channel.messages.fetch(guildData.painel.messageId).catch(() => null);
      if (!message) return;

      // Calcular estatísticas
      const historico = guildData.historico || [];
      const totalEventos = historico.length;
      const totalParticipacoes = historico.reduce((acc, evt) => acc + (evt.participantes?.length || 0), 0);
      
      // Participantes únicos
      const participantesUnicos = new Set();
      historico.forEach(evt => {
        evt.participantes?.forEach(p => participantesUnicos.add(p));
      });

      const embed = new EmbedBuilder()
        .setTitle('📊 **ESTATÍSTICAS DE EVENTOS**')
        .setDescription(`Estatísticas atualizadas em <t:${Math.floor(Date.now() / 1000)}:R>`)
        .setColor(0x3498DB)
        .addFields(
          { name: '🔥 Eventos Realizados', value: totalEventos.toString(), inline: true },
          { name: '👥 Total de Participações', value: totalParticipacoes.toString(), inline: true },
          { name: '🎮 Participantes Únicos', value: participantesUnicos.size.toString(), inline: true }
        )
        .setTimestamp();

      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('stats_filter_7d')
            .setLabel('7 dias')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('stats_filter_2w')
            .setLabel('2 semanas')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('stats_filter_1m')
            .setLabel('1 mês')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('stats_filter_all')
            .setLabel('Tudo')
            .setStyle(ButtonStyle.Secondary)
        );

      await message.edit({ embeds: [embed], components: [buttons] });
      
    } catch (error) {
      console.error('Erro ao atualizar painel:', error);
    }
  }

  static async handleFilterChange(interaction) {
    const customId = interaction.customId;
    const dias = customId === 'stats_filter_7d' ? 7 : 
                 customId === 'stats_filter_2w' ? 14 : 
                 customId === 'stats_filter_1m' ? 30 : null;

    await interaction.reply({
      content: `Filtro aplicado: ${dias ? `Últimos ${dias} dias` : 'Todos os eventos'}`,
      ephemeral: true
    });
  }

  static async registerEventParticipation(userId, eventId, eventName) {
    // Método para registrar participação (chamado quando usuário entra em evento)
    // Pode ser expandido para sistema de XP/ranking
    console.log(`Participação registrada: ${userId} no evento ${eventName} (${eventId})`);
  }

  static getEventStats(guildId, eventId) {
    const arquivo = path.join(__dirname, '..', 'data', 'eventStats.json');
    
    try {
      if (fs.existsSync(arquivo)) {
        const dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
        const evento = dados[guildId]?.historico?.find(e => e.id === eventId);
        if (evento) {
          return {
            ...evento,
            participacaoIndividual: new Map(Object.entries(evento.participacaoIndividual || {}))
          };
        }
      }
    } catch (error) {
      console.error('Erro ao buscar stats:', error);
    }
    
    return null;
  }

  static getAllStats(guildId, filtroDias = null) {
    const arquivo = path.join(__dirname, '..', 'data', 'eventStats.json');
    
    try {
      if (fs.existsSync(arquivo)) {
        const dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
        let historico = dados[guildId]?.historico || [];
        
        if (filtroDias) {
          const limite = new Date();
          limite.setDate(limite.getDate() - filtroDias);
          historico = historico.filter(e => new Date(e.dataRegistro) >= limite);
        }
        
        return historico;
      }
    } catch (error) {
      console.error('Erro ao buscar stats:', error);
    }
    
    return [];
  }
}

module.exports = EventStatsHandler;
