const EventActions = require('./eventActions');
const ConfigActions = require('../configActions');
const RegistrationActions = require('../registrationActions');

// Exportar todos os handlers de ações
module.exports = {
  // Eventos
  handleCriarEventoCustom: EventActions.handleCriarEventoCustom.bind(EventActions),
  handleCriarPresetEvent: EventActions.handleCriarPresetEvent.bind(EventActions),
  handleEventAction: EventActions.handleEventAction.bind(EventActions),
  handleSimulateLoot: EventActions.handleSimulateLoot.bind(EventActions),
  handleResimulateLoot: EventActions.handleResimulateLoot.bind(EventActions),
  handleArchiveLoot: EventActions.handleArchiveLoot.bind(EventActions),
  handleUpdateParticipation: EventActions.handleUpdateParticipation.bind(EventActions), // 🆕 GARANTIR QUE ESTÁ EXPORTADO
  
  // Configurações
  handleConfigTaxa: ConfigActions.handleConfigTaxa.bind(ConfigActions),
  handleConfigTaxasBau: ConfigActions.handleConfigTaxasBau.bind(ConfigActions),
  handleConfigXP: ConfigActions.handleConfigXP.bind(ConfigActions),
  handleConfigVerAtual: ConfigActions.handleConfigVerAtual.bind(ConfigActions),
  handleXPAtivar: ConfigActions.handleXPAtivar.bind(ConfigActions),
  handleXPDesativar: ConfigActions.handleXPDesativar.bind(ConfigActions),
  handleVoltarConfig: ConfigActions.handleVoltarConfig.bind(ConfigActions),
  handleAtualizarBot: ConfigActions.handleAtualizarBot.bind(ConfigActions),
  
  // Banco
  handleVenderLootButton: ConfigActions.handleVenderLootButton.bind(ConfigActions),
  handleConsultarSaldoDM: ConfigActions.handleConsultarSaldoDM.bind(ConfigActions),
  handleSacarSaldoButton: ConfigActions.handleSacarSaldoButton.bind(ConfigActions),
  handleApproveWithdrawal: ConfigActions.handleApproveWithdrawal.bind(ConfigActions),
  handleRejectWithdrawal: ConfigActions.handleRejectWithdrawal.bind(ConfigActions),
  handleApproveLoan: ConfigActions.handleApproveLoan.bind(ConfigActions),
  handleRejectLoan: ConfigActions.handleRejectLoan.bind(ConfigActions),
  
  // Transferências
  handleTransferirSaldoButton: ConfigActions.handleTransferirSaldoButton.bind(ConfigActions),
  handleConfirmarTransferencia: ConfigActions.handleConfirmarTransferencia.bind(ConfigActions),
  handleRecusarTransferencia: ConfigActions.handleRecusarTransferencia.bind(ConfigActions),
  
  // Registro
  handleIniciarRegistro: RegistrationActions.handleIniciarRegistro.bind(RegistrationActions),
  handleApproval: RegistrationActions.handleApproval.bind(RegistrationActions),
  handleRejection: RegistrationActions.handleRejection.bind(RegistrationActions)
};
