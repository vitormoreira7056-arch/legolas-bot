const RegistrationActions = require('./registrationActions');
const EventActions = require('./eventActions');

// Compatibilidade com código antigo - removemos configActions daqui
class ActionHandlers {
  // Registration
  static handleIniciarRegistro(...args) { return RegistrationActions.handleIniciarRegistro(...args); }
  static handleApproval(...args) { return RegistrationActions.handleApproval(...args); }
  static handleRejection(...args) { return RegistrationActions.handleRejection(...args); }

  // Events
  static handleCriarEventoCustom(...args) { return EventActions.handleCriarEventoCustom(...args); }
  static handleCriarPresetEvent(...args) { return EventActions.handleCriarPresetEvent(...args); }
  static handleEventAction(...args) { return EventActions.handleEventAction(...args); }
  static handleSimulateLoot(...args) { return EventActions.handleSimulateLoot(...args); }
  static handleResimulateLoot(...args) { return EventActions.handleResimulateLoot(...args); }
  static handleArchiveLoot(...args) { return EventActions.handleArchiveLoot(...args); }
  static handleUpdateParticipation(...args) { return EventActions.handleUpdateParticipation(...args); }
  static handleEventStatsFilter(...args) { return EventActions.handleEventStatsFilter(...args); }

  // Config & Bank - Agora importamos de handlers/, não de actions/
  static handleConfigTaxa(...args) { 
    const ConfigActions = require('../configActions');
    return ConfigActions.handleConfigTaxa(...args); 
  }
  static handleConfigTaxasBau(...args) { 
    const ConfigActions = require('../configActions');
    return ConfigActions.handleConfigTaxasBau(...args); 
  }
  static handleConfigXP(...args) { 
    const ConfigActions = require('../configActions');
    return ConfigActions.handleConfigXP(...args); 
  }
  static handleConfigVerAtual(...args) { 
    const ConfigActions = require('../configActions');
    return ConfigActions.handleConfigVerAtual(...args); 
  }
  static handleXPAtivar(...args) { 
    const ConfigActions = require('../configActions');
    return ConfigActions.handleXPAtivar(...args); 
  }
  static handleXPDesativar(...args) { 
    const ConfigActions = require('../configActions');
    return ConfigActions.handleXPDesativar(...args); 
  }
  static handleVoltarConfig(...args) { 
    const ConfigActions = require('../configActions');
    return ConfigActions.handleVoltarConfig(...args); 
  }
  static handleAtualizarBot(...args) { 
    const ConfigActions = require('../configActions');
    return ConfigActions.handleAtualizarBot(...args); 
  }
  static handleVenderLootButton(...args) { 
    const ConfigActions = require('../configActions');
    return ConfigActions.handleVenderLootButton(...args); 
  }
  static handleConsultarSaldoDM(...args) { 
    const ConfigActions = require('../configActions');
    return ConfigActions.handleConsultarSaldoDM(...args); 
  }
  static handleSacarSaldoButton(...args) { 
    const ConfigActions = require('../configActions');
    return ConfigActions.handleSacarSaldoButton(...args); 
  }
  static handleApproveWithdrawal(...args) { 
    const ConfigActions = require('../configActions');
    return ConfigActions.handleApproveWithdrawal(...args); 
  }
  static handleRejectWithdrawal(...args) { 
    const ConfigActions = require('../configActions');
    return ConfigActions.handleRejectWithdrawal(...args); 
  }
  static handleApproveLoan(...args) { 
    const ConfigActions = require('../configActions');
    return ConfigActions.handleApproveLoan(...args); 
  }
  static handleRejectLoan(...args) { 
    const ConfigActions = require('../configActions');
    return ConfigActions.handleRejectLoan(...args); 
  }

  // 🆕 ADICIONADOS - Métodos de transferência que faltavam
  static handleTransferirSaldoButton(...args) { 
    const ConfigActions = require('../configActions');
    return ConfigActions.handleTransferirSaldoButton(...args); 
  }
  static handleConfirmarTransferencia(...args) { 
    const ConfigActions = require('../configActions');
    return ConfigActions.handleConfirmarTransferencia(...args); 
  }
  static handleRecusarTransferencia(...args) { 
    const ConfigActions = require('../configActions');
    return ConfigActions.handleRecusarTransferencia(...args); 
  }
}

module.exports = ActionHandlers;