const fs = require('fs');
const path = require('path');

class LootSplitCore {
  static calcularDivisao(evento, valorTotal, ajustes = {}) {
    const ConfigHandler = require('./configHandler');
    const config = ConfigHandler.getConfig(evento.guildId) || {};
    const taxaPercentual = config.taxaPadrao || 10;
    const valorTaxa = Math.floor(valorTotal * (taxaPercentual / 100));
    const valorDistribuir = valorTotal - valorTaxa;

    // Suportar tanto presenceData quanto participacaoIndividual
    const participacoes = evento.participacaoIndividual || 
      (evento.presenceData ? new Map(Object.entries(evento.presenceData.participants || {})) : new Map());

    if (!participacoes || participacoes.size === 0) {
      const numParticipantes = evento.participants?.length || evento.participantes?.length || 1;
      const valorPorPessoa = Math.floor(valorDistribuir / numParticipantes);
      
      const resultado = {};
      const participants = evento.participants || evento.participantes || [];
      for (const userId of participants) {
        resultado[userId] = {
          userId,
          nickname: 'Desconhecido',
          valor: valorPorPessoa,
          porcentagem: (100 / numParticipantes).toFixed(1),
          tempoParticipado: '00:00:00',
          ajuste: null
        };
      }
      return { 
        taxa: valorTaxa, 
        taxaPercentual: taxaPercentual,
        valorTotal: valorTotal,
        valorDistribuir: valorDistribuir,
        distribuicao: resultado 
      };
    }

    let tempoTotalValido = 0;
    const participantesValidos = [];

    for (const [userId, participacao] of participacoes) {
      const tempoTotal = participacao.tempoTotal || participacao.totalTime || 0;
      const ajuste = ajustes[userId] || 100;
      const tempoAjustado = tempoTotal * (ajuste / 100);
      
      tempoTotalValido += tempoAjustado;
      participantesValidos.push({
        userId,
        nickname: participacao.nickname || 'Desconhecido',
        tempoOriginal: tempoTotal,
        tempoAjustado,
        ajuste
      });
    }

    const resultado = {};
    for (const p of participantesValidos) {
      const proporcao = tempoTotalValido > 0 ? p.tempoAjustado / tempoTotalValido : 0;
      const valor = valorDistribuir * proporcao;
      const porcentagem = (proporcao * 100).toFixed(1);

      resultado[p.userId] = {
        userId: p.userId,
        nickname: p.nickname,
        valor: Math.floor(valor),
        porcentagem: porcentagem,
        tempoParticipado: this.formatarTempo(p.tempoOriginal),
        ajuste: p.ajuste !== 100 ? `${p.ajuste}%` : null
      };
    }

    return {
      taxa: valorTaxa,
      taxaPercentual: taxaPercentual,
      valorTotal: valorTotal,
      valorDistribuir: valorDistribuir,
      distribuicao: resultado
    };
  }

  static formatarTempo(ms) {
    const horas = Math.floor(ms / (1000 * 60 * 60));
    const minutos = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const segundos = Math.floor((ms % (1000 * 60)) / 1000);
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
  }

  static async salvarSimulacao(evento, resultado) {
    const arquivo = path.join(__dirname, '..', 'data', 'lootsplits.json');
    let dados = {};
    
    try {
      if (fs.existsSync(arquivo)) {
        dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      }
    } catch (error) {
      console.error('Erro ao ler arquivo de lootsplits:', error);
    }

    if (!dados[evento.guildId]) dados[evento.guildId] = {};
    
    dados[evento.guildId][evento.id] = {
      nome: evento.nome,
      data: new Date().toISOString(),
      resultado: resultado,
      finalizado: false
    };

    try {
      fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
    } catch (error) {
      console.error('Erro ao salvar simulação:', error);
    }
  }

  static async finalizarSplit(evento, resultado, interaction) {
    const arquivo = path.join(__dirname, '..', 'data', 'lootsplits.json');
    let dados = {};
    
    try {
      if (fs.existsSync(arquivo)) {
        dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
        if (dados[evento.guildId]?.[evento.id]) {
          dados[evento.guildId][evento.id].finalizado = true;
          dados[evento.guildId][evento.id].dataFinalizacao = new Date().toISOString();
          fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
        }
      }
    } catch (error) {
      console.error('Erro ao finalizar split:', error);
    }

    const db = require('../utils/database');
    for (const [userId, dadosUser] of Object.entries(resultado.distribuicao)) {
      try {
        const user = db.getUser(userId);
        user.saldo += dadosUser.valor;
        db.updateUser(userId, user);

        db.addTransaction('loot_split', userId, dadosUser.valor, {
          evento: evento.nome,
          eventoId: evento.id
        });
      } catch (error) {
        console.error(`Erro ao processar pagamento para ${userId}:`, error);
      }
    }

    return true;
  }

  static async carregarSimulacao(guildId, eventId) {
    const arquivo = path.join(__dirname, '..', 'data', 'lootsplits.json');
    
    try {
      if (fs.existsSync(arquivo)) {
        const dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
        return dados[guildId]?.[eventId] || null;
      }
    } catch (error) {
      console.error('Erro ao carregar simulação:', error);
    }
    
    return null;
  }
}

module.exports = LootSplitCore;
