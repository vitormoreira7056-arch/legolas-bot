const fs = require('fs');
const path = require('path');

class EventStatsHandler {
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
      participantes: evento.participantes,
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
    // Implementação do painel de estatísticas gerais (se existir)
    // Esta função pode ser expandida para atualizar um painel fixo de estatísticas da guilda
  }

  static async handleFilterChange(interaction) {
    // Implementação para filtros de estatísticas (7d, 2w, 1m, etc)
    // Placeholder para funcionalidade futura
    await interaction.reply({
      content: 'Filtro atualizado!',
      ephemeral: true
    });
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
