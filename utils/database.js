// Banco de dados simples em memória (substituir por Replit DB ou MongoDB em produção)
class Database {
  constructor() {
    this.users = new Map();
    this.transactions = [];
    this.pendingWithdrawals = new Map();
    this.pendingLoans = new Map();
    // 🆕 NOVO: Rastrear taxas arrecadadas separadamente
    this.taxasArrecadadas = 0;
  }

  getUser(userId) {
    if (!this.users.has(userId)) {
      this.users.set(userId, {
        userId: userId,
        saldo: 0,
        emprestimo: 0,
        totalDepositado: 0,
        totalSacado: 0,
        registros: [],
        xp: 0,
        nivel: 1,
        xpParaProximoNivel: 100,
        eventosParticipados: 0,
        tempoTotalEventos: 0,
        conquistas: [],
        dataRegistro: new Date().toISOString(),
        nickDoJogo: null,
        guilda: null,
        plataforma: null,
        armaPrincipal: null,
        aprovadoPor: null
      });
    }
    return this.users.get(userId);
  }

  updateUser(userId, data) {
    const user = this.getUser(userId);
    Object.assign(user, data);
    this.users.set(userId, user);
    return user;
  }

  getDisplayName(userId, fallbackName = null) {
    const user = this.getUser(userId);
    if (user.nickDoJogo) {
      return user.nickDoJogo;
    }
    return fallbackName || 'Desconhecido';
  }

  addXP(userId, quantidade, motivo = 'Evento') {
    const user = this.getUser(userId);
    const nivelAnterior = user.nivel;
    user.xp += quantidade;

    while (user.xp >= user.xpParaProximoNivel) {
      user.xp -= user.xpParaProximoNivel;
      user.nivel++;
      user.xpParaProximoNivel = Math.floor(user.xpParaProximoNivel * 1.2);
    }

    this.updateUser(userId, user);
    return { user, levelUp: user.nivel > nivelAnterior };
  }

  getPatente(nivel) {
    if (nivel >= 51) return { nome: 'Lenda', emoji: '👑', cor: 0xFFD700 };
    if (nivel >= 26) return { nome: 'Elite', emoji: '💎', cor: 0x9B59B6 };
    if (nivel >= 11) return { nome: 'Veterano', emoji: '🏅', cor: 0x3498DB };
    return { nome: 'Recruta', emoji: '🌱', cor: 0x95A5A6 };
  }

  getProgressoXP(user) {
    const xpAtual = user.xp;
    const xpNecessario = user.xpParaProximoNivel;
    const porcentagem = Math.floor((xpAtual / xpNecessario) * 100);
    const barrasPreenchidas = Math.floor(porcentagem / 10);
    const barrasVazias = 10 - barrasPreenchidas;

    return {
      barra: '█'.repeat(barrasPreenchidas) + '░'.repeat(barrasVazias),
      porcentagem,
      xpAtual,
      xpNecessario
    };
  }

  addTransaction(type, userId, valor, details = {}) {
    const transaction = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      userId,
      valor,
      details,
      timestamp: new Date(),
      status: 'completed'
    };
    this.transactions.push(transaction);
    
    // 🆕 Se for taxa da guilda, adicionar à arrecadação
    if (type === 'taxa_guilda' || type === 'taxa_venda_bau') {
      this.taxasArrecadadas += valor;
    }
    
    return transaction;
  }

  getUserTransactions(userId, limit = 10) {
    return this.transactions
      .filter(t => t.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  createPendingWithdrawal(userId, valor) {
    const user = this.getUser(userId);
    if (user.saldo < valor) return null;

    const id = `wd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const withdrawal = {
      id,
      userId,
      valor,
      status: 'pending',
      timestamp: new Date()
    };

    this.pendingWithdrawals.set(id, withdrawal);
    return withdrawal;
  }

  approveWithdrawal(id) {
    const withdrawal = this.pendingWithdrawals.get(id);
    if (!withdrawal || withdrawal.status !== 'pending') return null;

    const user = this.getUser(withdrawal.userId);
    if (user.saldo < withdrawal.valor) return null;

    user.saldo -= withdrawal.valor;
    user.totalSacado += withdrawal.valor;

    withdrawal.status = 'approved';
    this.pendingWithdrawals.set(id, withdrawal);

    this.addTransaction('saque', withdrawal.userId, withdrawal.valor, { withdrawalId: id });

    return { withdrawal, user };
  }

  rejectWithdrawal(id) {
    const withdrawal = this.pendingWithdrawals.get(id);
    if (!withdrawal) return null;

    withdrawal.status = 'rejected';
    this.pendingWithdrawals.set(id, withdrawal);
    return withdrawal;
  }

  createPendingLoan(userId, valor) {
    const id = `ln_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const loan = {
      id,
      userId,
      valor,
      status: 'pending',
      timestamp: new Date()
    };

    this.pendingLoans.set(id, loan);
    return loan;
  }

  approveLoan(id) {
    const loan = this.pendingLoans.get(id);
    if (!loan || loan.status !== 'pending') return null;

    const user = this.getUser(loan.userId);

    user.saldo += loan.valor;
    user.emprestimo += loan.valor;
    loan.status = 'approved';

    this.pendingLoans.set(id, loan);
    this.addTransaction('emprestimo', loan.userId, loan.valor, { loanId: id, tipo: 'concessao' });

    return { loan, user };
  }

  rejectLoan(id) {
    const loan = this.pendingLoans.get(id);
    if (!loan) return null;

    loan.status = 'rejected';
    this.pendingLoans.set(id, loan);
    return loan;
  }

  deposit(userId, valor, adminId, motivo = 'Depósito manual') {
    const user = this.getUser(userId);
    user.saldo += valor;
    user.totalDepositado += valor;

    this.addTransaction('deposito', userId, valor, {
      adminId,
      tipo: 'manual',
      motivo: motivo
    });
    return user;
  }

  addEventLoot(eventId, totalValor, participants, taxaGuilda = 0) {
    const valorComTaxa = totalValor * (1 - taxaGuilda);
    const valorPorPessoa = Math.floor(valorComTaxa / participants.length);

    const distribuicao = [];

    for (const userId of participants) {
      const user = this.getUser(userId);
      user.saldo += valorPorPessoa;

      this.addTransaction('evento', userId, valorPorPessoa, {
        eventId: eventId,
        tipo: 'lootsplit',
        taxaAplicada: taxaGuilda
      });

      distribuicao.push({
        userId,
        valor: valorPorPessoa
      });
    }

    return distribuicao;
  }

  // 🆕 CORREÇÃO: Retorna soma dos saldos dos membros (o que o bot gerencia)
  getGuildBalance() {
    let total = 0;
    for (const user of this.users.values()) {
      total += user.saldo;
    }
    return total;
  }

  // 🆕 NOVO: Retorna total de taxas arrecadadas
  getTotalTaxasArrecadadas() {
    // Soma de todas as transações do tipo taxa_guilda ou taxa_venda_bau
    let totalTaxas = 0;
    for (const transaction of this.transactions) {
      if (transaction.type === 'taxa_guilda' || transaction.type === 'taxa_venda_bau') {
        totalTaxas += transaction.valor;
      }
    }
    return totalTaxas;
  }

  // 🆕 NOVO: Retorna total de dívidas (empréstimos pendentes)
  getTotalDividas() {
    let total = 0;
    for (const user of this.users.values()) {
      total += user.emprestimo || 0;
    }
    return total;
  }

  // 🆕 NOVO: Adicionar taxa de venda de baú manualmente
  adicionarTaxaBau(valor, local, vendaId) {
    this.taxasArrecadadas += valor;
    this.addTransaction('taxa_venda_bau', 'GUILDA', valor, {
      local: local,
      vendaId: vendaId,
      tipo: 'receita_taxa_bau'
    });
    return this.taxasArrecadadas;
  }
}

module.exports = new Database();
