const BankCore = require('./bankCore');
const bankVendas = require('./bankVendas');
const bankEmbeds = require('./bankEmbeds');

// 🆕 CORREÇÃO: Adicionados métodos de venda que estavam faltando
module.exports = {
  // Métodos do BankCore
  getUser: BankCore.getUser,
  updateUser: BankCore.updateUser,
  addTransaction: BankCore.addTransaction,
  requestWithdrawal: BankCore.requestWithdrawal,
  approveWithdrawal: BankCore.approveWithdrawal,
  rejectWithdrawal: BankCore.rejectWithdrawal,
  requestLoan: BankCore.requestLoan,
  approveLoan: BankCore.approveLoan,
  rejectLoan: BankCore.rejectLoan,
  transfer: BankCore.transfer,
  getBalance: BankCore.getBalance,
  deposit: BankCore.deposit,
  addGuildBalance: BankCore.addGuildBalance,
  getGuildBalance: BankCore.getGuildBalance,
  
  // 🆕 ADICIONADO: Métodos de venda do bankVendas
  approveVenda: bankVendas.approveVenda,
  rejectVenda: bankVendas.rejectVenda,
  processVenda: bankVendas.processVenda,
  
  // Embeds
  createWithdrawalEmbed: bankEmbeds.createWithdrawalEmbed,
  createLoanEmbed: bankEmbeds.createLoanEmbed,
  createBalanceEmbed: bankEmbeds.createBalanceEmbed
};
