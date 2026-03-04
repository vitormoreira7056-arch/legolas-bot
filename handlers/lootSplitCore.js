const fs = require('fs');
const path = require('path');
const ConfigHandler = require('./configHandler');

class LootSplitCore {
  // 🆕 ATUALIZADO: Aceita valorReparo como parâmetro
  static calcularDivisao(evento, valorTotal, valorReparo = 0, ajustes = {}) {
    const config = ConfigHandler.getConfig(evento.guildId) || {};
    const taxaPercentual = config.taxaGuilda || 10;
    
    // 🆕 NOVO: Subtrair reparo do valor total antes de calcular taxa e divisão
    const valorAposReparo = Math.max(0, valorTotal - valorReparo);
    const valorTaxa = Math.floor(valorAposReparo * (taxaPercentual / 100));
    const valorLiquido = valorAposReparo - valorTaxa;

    const participantes = [];
    let tempoTotal = 0;

    const participacoes = evento.participacaoIndividual || new Map();
    
    for (const [userId, part] of participacoes) {
      const tempo = part.tempoTotal || part.totalTime || 0;
      participantes.push({
        userId,
        nickname: part.nickname || 'Desconhecido',
        tempo,
        tempoParticipado: this.formatarTempo(tempo)
      });
      tempoTotal += tempo;
    }

    const distribuicao = {};
    for (const p of participantes) {
      const porcentagem = tempoTotal > 0 ? (p.tempo / tempoTotal) : (1 / participantes.length);
      const ajuste = ajustes[p.userId] || 100;
      const valorBase = valorLiquido * porcentagem;
      const valorAjustado = Math.floor(valorBase * (ajuste / 100));
      
      distribuicao[p.userId] = {
        userId: p.userId,
        nickname: p.nickname,
        valor: valorAjustado,
        porcentagem: (porcentagem * 100).toFixed(1),
        tempoParticipado: p.tempoParticipado,
        ajuste: ajuste !== 100 ? `${ajuste}%` : null
      };
    }

    return {
      valorTotal,
      valorReparo, // 🆕 NOVO: Retornar valor do reparo
      taxa: valorTaxa,
      taxaPercentual,
      valorDistribuir: valorLiquido,
      distribuicao,
      tempoTotal
    };
  }

  static formatarTempo(ms) {
    const horas = Math.floor(ms / (1000 * 60 * 60));
    const minutos = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((ms % (1000 * 60)) / 1000);
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
  }

  // 🆕 ATUALIZADO: Aceita valorReparo
  static async salvarSimulacao(evento, resultado, valorReparo = 0) {
    const arquivo = path.join(__dirname, '..', 'data', 'lootsplits.json');
    let dados = {};
    
    try {
      if (fs.existsSync(arquivo)) {
        dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      }
    } catch (e) {
      console.error('Erro ao ler arquivo:', e);
    }

    if (!dados[evento.guildId]) dados[evento.guildId] = {};
    
    dados[evento.guildId][evento.id] = {
      evento: {
        id: evento.id,
        nome: evento.nome,
        guildId: evento.guildId,
        participantes: Array.from(evento.participacaoIndividual?.entries() || [])
      },
      resultado,
      valorReparo, // 🆕 NOVO: Salvar reparo
      finalizado: false,
      data: new Date().toISOString()
    };

    fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
  }

  static async carregarSimulacao(guildId, eventId) {
    const arquivo = path.join(__dirname, '..', 'data', 'lootsplits.json');
    
    try {
      if (fs.existsSync(arquivo)) {
        const dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
        return dados[guildId]?.[eventId] || null;
      }
    } catch (e) {
      console.error('Erro ao carregar simulação:', e);
    }
    
    return null;
  }

  static async finalizarSplit(evento, resultado, interaction) {
    const arquivo = path.join(__dirname, '..', 'data', 'lootsplits.json');
    
    try {
      const dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      if (dados[evento.guildId]?.[evento.id]) {
        dados[evento.guildId][evento.id].finalizado = true;
        dados[evento.guildId][evento.id].dataFinalizacao = new Date().toISOString();
        fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
      }
    } catch (e) {
      console.error('Erro ao finalizar:', e);
    }

    return true;
  }
}

module.exports = LootSplitCore;
