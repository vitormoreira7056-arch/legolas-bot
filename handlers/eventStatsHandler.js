const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('../utils/database');

class EventStatsHandler {
  static statsFile = path.join(__dirname, '..', 'data', 'eventStats.json');
  static messageIdFile = path.join(__dirname, '..', 'data', 'eventStatsMessage.json');
  static eventsFile = path.join(__dirname, '..', 'data', 'eventStats.json');

  static stats = new Map();
  static currentFilter = 'total';

  static loadStats() {
    try {
      if (fs.existsSync(this.statsFile)) {
        const data = JSON.parse(fs.readFileSync(this.statsFile, 'utf8'));
        this.stats = new Map(Object.entries(data));
        console.log('✅ Estatísticas de eventos carregadas');
      }
    } catch (error) {
      console.error('Erro ao carregar stats:', error);
      this.stats = new Map();
    }
  }

  static saveStats() {
    try {
      const dir = path.dirname(this.statsFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.statsFile, JSON.stringify(Object.fromEntries(this.stats), null, 2));
    } catch (error) {
      console.error('Erro ao salvar stats:', error);
    }
  }

  static saveMessageId(channelId, messageId) {
    try {
      const dir = path.dirname(this.messageIdFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.messageIdFile, JSON.stringify({ channelId, messageId, filter: this.currentFilter }));
    } catch (error) {
      console.error('Erro ao salvar messageId:', error);
    }
  }

  static loadMessageId() {
    try {
      if (fs.existsSync(this.messageIdFile)) {
        return JSON.parse(fs.readFileSync(this.messageIdFile, 'utf8'));
      }
    } catch (error) {
      console.error('Erro ao carregar messageId:', error);
    }
    return null;
  }

  static getEventStats(guildId, eventId) {
    try {
      for (const [userId, userData] of this.stats.entries()) {
        const event = userData.events?.find(e => e.eventId === eventId);
        if (event) {
          return {
            id: eventId,
            eventId: eventId,
            nome: event.name || 'Evento Desconhecido',
            name: event.name || 'Evento Desconhecido',
            guildId: guildId,
            participantes: [],
            participacaoIndividual: new Map(),
            iniciadoEm: new Date(event.date).getTime(),
            finalizadoEm: new Date(event.date).getTime(),
            status: 'encerrado',
            duracaoTotal: 0
          };
        }
      }

      const eventsFile = path.join(__dirname, '..', 'data', 'events.json');
      if (fs.existsSync(eventsFile)) {
        const eventsData = JSON.parse(fs.readFileSync(eventsFile, 'utf8'));
        if (eventsData[eventId]) {
          return eventsData[eventId];
        }
      }

      return null;
    } catch (error) {
      console.error('[EventStatsHandler] Erro ao buscar stats do evento:', error);
      return null;
    }
  }

  static async saveEventStats(evento, guild) {
    try {
      if (!evento.participantes || evento.participantes.length === 0) return;

      for (const userId of evento.participantes) {
        const userData = db.getUser(userId);
        const nickDoJogo = userData.nickDoJogo || 'Desconhecido';
        
        if (!this.stats.has(userId)) {
          this.stats.set(userId, { events: [], totalParticipated: 0 });
        }

        const stats = this.stats.get(userId);
        
        const alreadyRegistered = stats.events.some(e => e.eventId === evento.id);
        if (alreadyRegistered) continue;

        stats.events.push({
          eventId: evento.id,
          date: new Date().toISOString(),
          name: evento.nome,
          nickDoJogo: nickDoJogo
        });
        stats.totalParticipated = stats.events.length;
        stats.nickDoJogo = nickDoJogo;
      }

      this.saveStats();
      console.log(`[EventStats] Evento ${evento.nome} salvo com ${evento.participantes.length} participantes`);
      
      if (guild) {
        await this.updatePanel(guild);
      }
    } catch (error) {
      console.error('[EventStats] Erro ao salvar:', error);
    }
  }

  static registerEventParticipation(userId, eventId, eventName) {
    if (!this.stats.has(userId)) {
      this.stats.set(userId, { events: [], totalParticipated: 0 });
    }

    const userStats = this.stats.get(userId);
    const userData = db.getUser(userId);

    const alreadyRegistered = userStats.events.some(e => e.eventId === eventId);
    if (alreadyRegistered) return;

    userStats.events.push({
      eventId,
      date: new Date().toISOString(),
      name: eventName,
      nickDoJogo: userData.nickDoJogo
    });
    userStats.totalParticipated = userStats.events.length;
    userStats.nickDoJogo = userData.nickDoJogo;

    this.saveStats();
  }

  static getEventsInPeriod(userId, period) {
    const userStats = this.stats.get(userId);
    if (!userStats) return { participated: 0, total: this.getTotalEvents() };

    const now = Date.now();
    const periods = {
      '7d': 7 * 24 * 60 * 60 * 1000,
      '2w': 14 * 24 * 60 * 60 * 1000,
      '1m': 30 * 24 * 60 * 60 * 1000,
      '3m': 90 * 24 * 60 * 60 * 1000,
      '8m': 240 * 24 * 60 * 60 * 1000,
      '1y': 365 * 24 * 60 * 60 * 1000,
      'total': Infinity
    };

    const timeLimit = periods[period] || Infinity;

    const participatedInPeriod = userStats.events.filter(e => {
      const eventDate = new Date(e.date).getTime();
      return (now - eventDate) <= timeLimit;
    }).length;

    const totalInPeriod = this.getTotalEventsInPeriod(timeLimit);

    return {
      participated: participatedInPeriod,
      total: totalInPeriod === 0 ? participatedInPeriod : totalInPeriod
    };
  }

  static getTotalEvents() {
    const allEventIds = new Set();
    for (const userData of this.stats.values()) {
      userData.events.forEach(e => allEventIds.add(e.eventId));
    }
    return allEventIds.size;
  }

  static getTotalEventsInPeriod(timeLimit) {
    const now = Date.now();
    const allEventIds = new Set();

    for (const userData of this.stats.values()) {
      userData.events.forEach(e => {
        const eventDate = new Date(e.date).getTime();
        if ((now - eventDate) <= timeLimit) {
          allEventIds.add(e.eventId);
        }
      });
    }
    return allEventIds.size;
  }

  static createFilterSelectMenu() {
    const options = [
      new StringSelectMenuOptionBuilder().setLabel('Últimos 7 dias').setValue('7d').setDescription('Eventos dos últimos 7 dias').setEmoji('📅'),
      new StringSelectMenuOptionBuilder().setLabel('Últimas 2 semanas').setValue('2w').setDescription('Eventos das últimas 2 semanas').setEmoji('📆'),
      new StringSelectMenuOptionBuilder().setLabel('Último mês').setValue('1m').setDescription('Eventos do último mês').setEmoji('🗓️'),
      new StringSelectMenuOptionBuilder().setLabel('Últimos 3 meses').setValue('3m').setDescription('Eventos dos últimos 3 meses').setEmoji('📊'),
      new StringSelectMenuOptionBuilder().setLabel('Últimos 8 meses').setValue('8m').setDescription('Eventos dos últimos 8 meses').setEmoji('📈'),
      new StringSelectMenuOptionBuilder().setLabel('Último ano').setValue('1y').setDescription('Eventos do último ano').setEmoji('📉'),
      new StringSelectMenuOptionBuilder().setLabel('Total (Todos)').setValue('total').setDescription('Todos os eventos').setEmoji('🔢'),
    ];

    return new StringSelectMenuBuilder()
      .setCustomId('event_stats_filter')
      .setPlaceholder('Selecione o período para filtrar...')
      .addOptions(options);
  }

  static async generateStatsEmbed(guild, filter = 'total') {
    this.currentFilter = filter;

    const filterNames = {
      '7d': 'Últimos 7 dias',
      '2w': 'Últimas 2 semanas',
      '1m': 'Último mês',
      '3m': 'Últimos 3 meses',
      '8m': 'Últimos 8 meses',
      '1y': 'Último ano',
      'total': 'Total Geral'
    };

    const embed = new EmbedBuilder()
      .setTitle('📊 **PAINEL DE EVENTOS - ESTATÍSTICAS**')
      .setDescription(`> Participação dos membros em eventos da guilda\n> **Período:** ${filterNames[filter]}\n\n\u200B`)
      .setColor(0x3498DB)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .setFooter({ text: 'Atualizado automaticamente • Use o menu abaixo para filtrar' })
      .setTimestamp();

    const relevantRoles = ['NOTAG', 'Member Evento', 'Staff', 'ADM', 'Caller', 'ALIANÇA'];
    const trackedMembers = [];

    for (const member of guild.members.cache.values()) {
      const hasRelevantRole = member.roles.cache.some(r => relevantRoles.includes(r.name));
      if (hasRelevantRole && !member.user.bot) {
        const stats = this.getEventsInPeriod(member.id, filter);
        const userData = db.getUser(member.id);
        
        trackedMembers.push({
          member,
          participated: stats.participated,
          total: stats.total,
          percentage: stats.total > 0 ? Math.round((stats.participated / stats.total) * 100) : 0,
          nickDoJogo: userData.nickDoJogo
        });
      }
    }

    trackedMembers.sort((a, b) => b.participated - a.participated);

    if (trackedMembers.length === 0) {
      embed.addFields({ name: '👥 Membros', value: '*Nenhum membro registrado ainda*', inline: false });
    } else {
      let currentField = '';
      let fieldCount = 0;

      for (let i = 0; i < trackedMembers.length; i++) {
        const tm = trackedMembers[i];
        const displayName = tm.nickDoJogo || tm.member.displayName;
        const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        
        const line = `${medalha} **${displayName}**: **${tm.participated}/${tm.total}** (${tm.percentage}%)\n`;

        if ((currentField + line).length > 1024) {
          embed.addFields({
            name: fieldCount === 0 ? `👥 Membros (${trackedMembers.length})` : '\u200B',
            value: currentField || '*Dados...*',
            inline: false
          });
          currentField = line;
          fieldCount++;
        } else {
          currentField += line;
        }
      }

      if (currentField) {
        embed.addFields({
          name: fieldCount === 0 ? `👥 Membros (${trackedMembers.length})` : '\u200B',
          value: currentField,
          inline: false
        });
      }
    }

    const totalEvents = this.getTotalEventsInPeriod(
      filter === 'total' ? Infinity : {
        '7d': 7 * 24 * 60 * 60 * 1000,
        '2w': 14 * 24 * 60 * 60 * 1000,
        '1m': 30 * 24 * 60 * 60 * 1000,
        '3m': 90 * 24 * 60 * 60 * 1000,
        '8m': 240 * 24 * 60 * 60 * 1000,
        '1y': 365 * 24 * 60 * 60 * 1000
      }[filter]
    );

    embed.addFields(
      { name: '\u200B', value: '\u200B', inline: false },
      { name: '📈 Estatísticas Gerais', value: `Total de eventos: **${totalEvents}**\nMembros ativos: **${trackedMembers.filter(m => m.participated > 0).length}**`, inline: false }
    );

    return embed;
  }

  static async initializePanel(channel) {
    if (!channel) {
      console.error('❌ Canal não fornecido para initializePanel');
      return;
    }

    try {
      const embed = await this.generateStatsEmbed(channel.guild, 'total');
      const row = new ActionRowBuilder().addComponents(this.createFilterSelectMenu());

      const msg = await channel.send({
        content: '📊 **Painel de Estatísticas de Eventos**\n*Selecione um período abaixo para filtrar os dados:*',
        embeds: [embed],
        components: [row]
      });

      this.saveMessageId(channel.id, msg.id);
      console.log(`✅ Painel de eventos inicializado em ${channel.name}`);
      return msg;
    } catch (error) {
      console.error('Erro ao inicializar painel:', error);
    }
  }

  static async updatePanel(guild, filter = null) {
    try {
      const saved = this.loadMessageId();
      if (!saved) return;

      if (filter) this.currentFilter = filter;

      const channel = await guild.channels.fetch(saved.channelId).catch(() => null);
      if (!channel) return;

      const message = await channel.messages.fetch(saved.messageId).catch(() => null);
      if (!message) {
        await this.initializePanel(channel);
        return;
      }

      const embed = await this.generateStatsEmbed(guild, this.currentFilter);
      const row = new ActionRowBuilder().addComponents(this.createFilterSelectMenu());

      await message.edit({ embeds: [embed], components: [row] });
      this.saveMessageId(saved.channelId, saved.messageId, this.currentFilter);
    } catch (error) {
      console.error('Erro ao atualizar painel:', error);
    }
  }

  static async handleFilterChange(interaction) {
    const filter = interaction.values[0];
    await this.updatePanel(interaction.guild, filter);

    await interaction.reply({
      content: `✅ Filtro atualizado para: **${{
        '7d': 'Últimos 7 dias',
        '2w': 'Últimas 2 semanas',
        '1m': 'Último mês',
        '3m': 'Últimos 3 meses',
        '8m': 'Últimos 8 meses',
        '1y': 'Último ano',
        'total': 'Total Geral'
      }[filter]}**`,
      ephemeral: true
    });
  }
}

module.exports = EventStatsHandler;
