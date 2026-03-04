const { Events } = require('discord.js');
const ActionHandlers = require('./actions');
const BankHandler = require('./bank');

class ButtonHandler {
  static async handle(interaction, client) {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    console.log(`[BOTÃO] Clique detectado: ${customId} por ${interaction.user.tag}`);

    try {
      // ========== REGISTRO E RECRUTAMENTO ==========
      if (customId === 'iniciar_registro') {
        await ActionHandlers.handleIniciarRegistro(interaction);
        return;
      }

      if (customId.startsWith('aprovar_')) {
        await ActionHandlers.handleApproval(interaction, customId);
        return;
      }

      if (customId.startsWith('recusar_')) {
        await ActionHandlers.handleRejection(interaction, customId);
        return;
      }

      // ========== EVENTOS ==========
      if (customId === 'criar_evento_custom') {
        await ActionHandlers.handleCriarEventoCustom(interaction);
        return;
      }

      if (customId.startsWith('criar_')) {
        const tipo = customId.replace('criar_', '');
        if (['raid_avalon', 'gank', 'bau_dourado'].includes(tipo)) {
          await ActionHandlers.handleCriarPresetEvent(interaction, tipo);
        }
        return;
      }

      if (customId.startsWith('evt_')) {
        await ActionHandlers.handleEventAction(interaction, customId);
        return;
      }

      // ========== BANCO - SAQUES ==========
      if (customId.startsWith('approve_withdrawal_')) {
        const withdrawalId = customId.replace('approve_withdrawal_', '');
        await ActionHandlers.handleApproveWithdrawal(interaction, withdrawalId);
        return;
      }

      if (customId.startsWith('reject_withdrawal_')) {
        const withdrawalId = customId.replace('reject_withdrawal_', '');
        await ActionHandlers.handleRejectWithdrawal(interaction, withdrawalId);
        return;
      }

      // ========== BANCO - EMPRÉSTIMOS ==========
      if (customId.startsWith('approve_loan_')) {
        const loanId = customId.replace('approve_loan_', '');
        await ActionHandlers.handleApproveLoan(interaction, loanId);
        return;
      }

      if (customId.startsWith('reject_loan_')) {
        const loanId = customId.replace('reject_loan_', '');
        await ActionHandlers.handleRejectLoan(interaction, loanId);
        return;
      }

      // ========== VENDA DE BAÚ ==========
      if (customId === 'vender_loot_button') {
        await ActionHandlers.handleVenderLootButton(interaction);
        return;
      }

      if (customId.startsWith('aprovar_venda_')) {
        const vendaId = customId.replace('aprovar_venda_', '');
        await BankHandler.approveVenda(interaction, vendaId);
        return;
      }

      if (customId.startsWith('recusar_venda_')) {
        const vendaId = customId.replace('recusar_venda_', '');
        await BankHandler.rejectVenda(interaction, vendaId);
        return;
      }

      // ========== LOOTSPLIT ==========
      if (customId.startsWith('simulate_loot_')) {
        const eventId = customId.replace('simulate_loot_', '');
        console.log(`[LOOTSPLIT] Simulando para evento: ${eventId}`);
        
        await interaction.deferUpdate().catch(err => {
          console.log(`[LOOTSPLIT] deferUpdate (normal se já respondeu):`, err.message);
        });
        
        try {
          await ActionHandlers.handleSimulateLoot(interaction, eventId);
        } catch (error) {
          console.error(`[LOOTSPLIT] Erro ao simular:`, error);
          await interaction.followUp({ 
            content: '❌ Erro ao abrir simulação. Tente novamente.', 
            ephemeral: true 
          });
        }
        return;
      }

      if (customId.startsWith('resimulate_loot_')) {
        const eventId = customId.replace('resimulate_loot_', '');
        await interaction.deferUpdate().catch(() => {});
        await ActionHandlers.handleResimulateLoot(interaction, eventId);
        return;
      }

      if (customId.startsWith('archive_loot_')) {
        const eventId = customId.replace('archive_loot_', '');
        await ActionHandlers.handleArchiveLoot(interaction, eventId);
        return;
      }

      if (customId.startsWith('update_participation_')) {
        const eventId = customId.replace('update_participation_', '');
        await ActionHandlers.handleUpdateParticipation(interaction, eventId);
        return;
      }

      if (customId.startsWith('confirmar_split_')) {
        const eventId = customId.replace('confirmar_split_', '');
        await LootSplitHandler.handleConfirmarSplit(interaction, eventId);
        return;
      }

      if (customId.startsWith('resimular_')) {
        const eventId = customId.replace('resimular_', '');
        await LootSplitHandler.handleResimular(interaction, eventId);
        return;
      }

      if (customId.startsWith('cancelar_split_')) {
        const eventId = customId.replace('cancelar_split_', '');
        await LootSplitHandler.handleCancelarSplit(interaction, eventId);
        return;
      }

      // ========== CONFIGURAÇÕES ==========
      if (customId === 'config_taxa_guilda') {
        await ActionHandlers.handleConfigTaxa(interaction);
        return;
      }

      if (customId === 'config_taxas_bau') {
        await ActionHandlers.handleConfigTaxasBau(interaction);
        return;
      }

      if (customId === 'config_sistema_xp') {
        await ActionHandlers.handleConfigXP(interaction);
        return;
      }

      if (customId === 'config_ver_atual') {
        await ActionHandlers.handleConfigVerAtual(interaction);
        return;
      }

      // ========== ATUALIZAR BOT ==========
      if (customId === 'atualizar_bot') {
        await ActionHandlers.handleAtualizarBot(interaction);
        return;
      }

      if (customId === 'xp_ativar') {
        await ActionHandlers.handleXPAtivar(interaction);
        return;
      }

      if (customId === 'xp_desativar') {
        await ActionHandlers.handleXPDesativar(interaction);
        return;
      }

      if (customId === 'xp_voltar_config') {
        await ActionHandlers.handleVoltarConfig(interaction);
        return;
      }

      // ========== SALDO E CONSULTAS ==========
      if (customId === 'consultar_saldo_dm') {
        await ActionHandlers.handleConsultarSaldoDM(interaction);
        return;
      }

      if (customId === 'sacar_saldo') {
        await ActionHandlers.handleSacarSaldoButton(interaction);
        return;
      }

      if (customId === 'transferir_saldo') {
        await ActionHandlers.handleTransferirSaldoButton(interaction);
        return;
      }

      if (customId.startsWith('confirmar_transferencia_')) {
        const transferId = customId.replace('confirmar_transferencia_', '');
        await ActionHandlers.handleConfirmarTransferencia(interaction, transferId);
        return;
      }

      if (customId.startsWith('recusar_transferencia_')) {
        const transferId = customId.replace('recusar_transferencia_', '');
        await ActionHandlers.handleRecusarTransferencia(interaction, transferId);
        return;
      }

    } catch (error) {
      console.error(`[ERRO] No handler de botões (${customId}):`, error);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ 
            content: '❌ Erro ao processar botão. Tente novamente.', 
            ephemeral: true 
          });
        }
      } catch {}
    }
  }
}

module.exports = ButtonHandler;
