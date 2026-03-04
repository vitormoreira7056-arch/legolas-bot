const BankEmbeds = require('./bankEmbeds');
const BankCore = require('./bankCore');
const BankVendas = require('./bankVendas');

// Compatibilidade com código antigo - exporta tudo junto
class BankHandler {
  // Embeds
  static createWithdrawalRequestEmbed(...args) { return BankEmbeds.createWithdrawalRequestEmbed(...args); }
  static createWithdrawalButtons(...args) { return BankEmbeds.createWithdrawalButtons(...args); }
  static createLoanRequestEmbed(...args) { return BankEmbeds.createLoanRequestEmbed(...args); }
  static createLoanButtons(...args) { return BankEmbeds.createLoanButtons(...args); }
  static createBalanceEmbed(...args) { return BankEmbeds.createBalanceEmbed(...args); }
  static createVendaEmbed(...args) { return BankEmbeds.createVendaEmbed(...args); }
  static createVendaButtons(...args) { return BankEmbeds.createVendaButtons(...args); }

  // Core
  static requestWithdrawal(...args) { return BankCore.requestWithdrawal(...args); }
  static requestLoan(...args) { return BankCore.requestLoan(...args); }
  static approveWithdrawal(...args) { return BankCore.approveWithdrawal(...args); }
  static rejectWithdrawal(...args) { return BankCore.rejectWithdrawal(...args); }
  static approveLoan(...args) { return BankCore.approveLoan(...args); }
  static rejectLoan(...args) { return BankCore.rejectLoan(...args); }
  static depositManual(...args) { return BankCore.depositManual(...args); }

  // Vendas
  static approveVenda(...args) { return BankVendas.approveVenda(...args); }
  static rejectVenda(...args) { return BankVendas.rejectVenda(...args); }

  // Cores
  static get colors() { return BankEmbeds.colors; }
}

module.exports = BankHandler;
