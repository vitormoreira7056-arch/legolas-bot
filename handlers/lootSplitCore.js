const fs = require('fs');
const path = require('path');
const ConfigHandler = require('./configHandler');
const db = require('../utils/database'); // 🆕 ADICIONADO para acesso ao banco

class LootSplitCore {
  static calcularDivisao(evento, valorTotal, valorReparo = 0, ajustes = {}) {
    const config = ConfigHandler.getConfig(evento.guildId) || {};
    const taxaPercentual = config.taxaGuilda || 10;

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
      valorReparo,
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
      valorReparo,
      finalizado: false,
      pago: false, // 🆕 NOVO: Flag para controle de pagamento
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

  // 🆕 MELHORADO: Agora realiza o pagamento aos participantes
  static async finalizarSplit(evento, resultado, interaction) {
    const arquivo = path.join(__dirname, '..', 'data', 'lootsplits.json');

    try {
      const dados = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
      const simulacao = dados[evento.guildId]?.[evento.id];

      if (!simulacao) {
        throw new Error('Simulação não encontrada');
      }

      // Verificar se já foi pago para evitar duplicidade
      if (simulacao.pago) {
        console.log(`[LOOTSPLIT] Split ${evento.id} já foi pago anteriormente`);
        return { sucesso: false, jaPago: true };
      }

      const { distribuicao, taxa, valorReparo } = resultado;

      console.log(`[LOOTSPLIT] Iniciando pagamentos para evento ${evento.id}`);
      console.log(`[LOOTSPLIT] Total a distribuir: ${Object.values(distribuicao).reduce((a, b) => a + (b.valor || 0), 0)}`);
      console.log(`[LOOTSPLIT] Taxa guilda: ${taxa}`);

      // 🆕 PAGAR CADA PARTICIPANTE
      const pagamentosRealizados = [];
      const erros = [];

      for (const [userId, dadosDistribuicao] of Object.entries(distribuicao)) {
        try {
          const valor = Math.floor(dadosDistribuicao.valor || 0);
          
          if (valor > 0) {
            // Adicionar saldo ao usuário
            const user = db.getUser(userId);
            user.saldo += valor;
            user.totalDepositado = (user.totalDepositado || 0) + valor;
            db.updateUser(userId, user);

            // Registrar transação
            db.addTransaction('loot_split', userId, valor, {
              eventoId: evento.id,
              eventoNome: evento.nome,
              porcentagem: dadosDistribuicao.porcentagem,
              tempoParticipado: dadosDistribuicao.tempoParticipado
            });

            pagamentosRealizados.push({
              userId,
              valor,
              nickname: dadosDistribuicao.nickname
            });

            console.log(`[LOOTSPLIT] Pago ${valor} para ${dadosDistribuicao.nickname} (${userId})`);
          }
        } catch (error) {
          console.error(`[LOOTSPLIT] Erro ao pagar ${userId}:`, error);
          erros.push({ userId, erro: error.message });
        }
      }

      // 🆕 DEPOSITAR TAXA DA GUILDA NO BANCO DA GUILDA
      if (taxa > 0) {
        try {
          const guildBalance = db.getGuildBalance(evento.guildId);
          const novoSaldo = guildBalance + taxa;
          db.addEventLoot(evento.guildId, taxa); // Usa o método do database.js
          
          console.log(`[LOOTSPLIT] Taxa de ${taxa} depositada no banco da guilda`);
        } catch (error) {
          console.error('[LOOTSPLIT] Erro ao depositar taxa da guilda:', error);
        }
      }

      // 🆕 REGISTRAR REPARO SE HOUVER
      if (valorReparo > 0) {
        try {
          db.addTransaction('reparo_guilda', 'SISTEMA', valorReparo, {
            eventoId: evento.id,
            eventoNome: evento.nome,
            descricao: 'Valor descontado para reparo de itens'
          });
          console.log(`[LOOTSPLIT] Reparo de ${valorReparo} registrado`);
        } catch (error) {
          console.error('[LOOTSPLIT] Erro ao registrar reparo:', error);
        }
      }

      // Marcar como finalizado e pago
      dados[evento.guildId][evento.id].finalizado = true;
      dados[evento.guildId][evento.id].pago = true;
      dados[evento.guildId][evento.id].dataFinalizacao = new Date().toISOString();
      dados[evento.guildId][evento.id].pagamentos = pagamentosRealizados;
      dados[evento.guildId][evento.id].erros = erros;

      fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));

      console.log(`[LOOTSPLIT] Split finalizado. ${pagamentosRealizados.length} pagamentos realizados, ${erros.length} erros`);

      return {
        sucesso: true,
        pagamentos: pagamentosRealizados,
        erros,
        taxaGuilda: taxa,
        valorReparo
      };

    } catch (e) {
      console.error('[LOOTSPLIT] Erro ao finalizar split:', e);
      throw e;
    }
  }

  // 🆕 NOVO: Verificar se split já foi pago
  static async verificarPagamento(guildId, eventId) {
    const simulacao = await this.carregarSimulacao(guildId, eventId);
    return simulacao?.pago === true;
  }

  // 🆕 NOVO: Obter resumo do split para exibição
  static async obterResumoSplit(guildId, eventId) {
    const simulacao = await this.carregarSimulacao(guildId, eventId);
    if (!simulacao) return null;

    return {
      nome: simulacao.evento.nome,
      valorTotal: simulacao.resultado.valorTotal,
      valorReparo: simulacao.valorReparo,
      taxa: simulacao.resultado.taxa,
      finalizado: simulacao.finalizado,
      pago: simulacao.pago,
      data: simulacao.data,
      totalParticipantes: Object.keys(simulacao.resultado.distribuicao).length
    };
  }
}

module.exports = LootSplitCore;
