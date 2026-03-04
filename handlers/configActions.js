const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ConfigHandler = require('./configHandler');
const BankCore = require('./bank/bankCore');
const db = require('../utils/database');
const SetupManager = require('./setupManager');

class ConfigActions {
  static async handleConfigTaxa(interaction) {
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    if (!isADM) {
      return interaction.reply({
        content: '❌ Apenas ADMs podem alterar configurações!',
        ephemeral: true
      });
    }

    const modal = ConfigHandler.createTaxaModal();
    await interaction.showModal(modal);
  }

  static async handleConfigTaxasBau(interaction) {
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    if (!isADM) {
      return interaction.reply({
        content: '❌ Apenas ADMs podem alterar configurações!',
        ephemeral: true
      });
    }

    const config = ConfigHandler.getConfig(interaction.guild.id);
    const modal = ConfigHandler.createTaxasBauModal(config);
    await interaction.showModal(modal);
  }

  static async handleConfigXP(interaction) {
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    if (!isADM) {
      return interaction.reply({
        content: '❌ Apenas ADMs podem alterar configurações!',
        ephemeral: true
      });
    }

    const embed = ConfigHandler.createXPEmbed(interaction.guild.id);
    const buttons = ConfigHandler.createXPButtons(interaction.guild.id);

    await interaction.reply({
      embeds: [embed],
      components: buttons,
      ephemeral: true
    });
  }

  static async handleConfigVerAtual(interaction) {
    const embed = ConfigHandler.createConfigPanelEmbed(interaction.guild.id);
    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  static async handleXPAtivar(interaction) {
    await ConfigHandler.toggleXP(interaction, interaction.guild.id, true);
  }

  static async handleXPDesativar(interaction) {
    await ConfigHandler.toggleXP(interaction, interaction.guild.id, false);
  }

  static async handleVoltarConfig(interaction) {
    const embed = ConfigHandler.createConfigPanelEmbed(interaction.guild.id);
    const buttons = ConfigHandler.createConfigButtons();

    await interaction.update({
      embeds: [embed],
      components: buttons
    });
  }

  static async handleAtualizarBot(interaction) {
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    if (!isADM) {
      return interaction.reply({
        content: '❌ Apenas ADMs podem atualizar o bot!',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const setup = new SetupManager(interaction.guild, interaction);
      const result = await setup.update();

      const embedResumo = new EmbedBuilder()
        .setTitle('🔄 **ATUALIZAÇÃO CONCLUÍDA**')
        .setDescription(result.message)
        .setColor(result.novosCanais > 0 || result.novosCargos > 0 ? 0x2ECC71 : 0x3498DB)
        .setTimestamp();

      if (result.createdChannels.length > 0) {
        embedResumo.addFields({
          name: '🆕 Novos Canais Criados',
          value: result.createdChannels.slice(0, 15).map(c => `• ${c}`).join('\n') +
                 (result.createdChannels.length > 15 ? `\n... e mais ${result.createdChannels.length - 15}` : ''),
          inline: false
        });
      }

      if (result.createdRoles.length > 0) {
        embedResumo.addFields({
          name: '🎭 Novos Cargos Criados',
          value: result.createdRoles.map(r => `• ${r}`).join('\n'),
          inline: false
        });
      }

      if (result.existingChannels.length > 0) {
        embedResumo.addFields({
          name: '✅ Canais Existentes (mantidos)',
          value: `${result.existingChannels.length} canais/categorias já existiam`,
          inline: true
        });
      }

      await interaction.editReply({
        content: null,
        embeds: [embedResumo]
      });

      console.log(`🔄 Bot atualizado por ${interaction.user.tag}: ${result.message}`);

    } catch (error) {
      console.error('Erro ao atualizar bot:', error);
      await interaction.editReply({
        content: `❌ Erro ao atualizar o bot:\n\`\`\`${error.message}\`\`\``,
        embeds: []
      });
    }
  }

  static async handleVenderLootButton(interaction) {
    const ModalHandler = require('./modalHandler');
    const modal = ModalHandler.createVenderLootModal();
    await interaction.showModal(modal);
  }

  static async handleConsultarSaldoDM(interaction) {
    const user = db.getUser(interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle('🏦 **SEU EXTRATO BANCÁRIO**')
      .setDescription(`Extrato de ${interaction.user}`)
      .setColor(0xF1C40F)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '💰 **Saldo Disponível**', value: `🪙 **${user.saldo.toLocaleString()}**`, inline: false },
        { name: '💳 **Empréstimo Ativo**', value: `🪙 ${user.emprestimo.toLocaleString()}`, inline: true },
        { name: '💵 **Total Depositado**', value: `🪙 ${user.totalDepositado.toLocaleString()}`, inline: true },
        { name: '💸 **Total Sacado**', value: `🪙 ${user.totalSacado.toLocaleString()}`, inline: true }
      )
      .setFooter({ text: 'Sistema Bancário • Albion Guild' })
      .setTimestamp();

    try {
      await interaction.user.send({ embeds: [embed] });
      await interaction.reply({
        content: '✅ Seu extrato foi enviado na DM!',
        ephemeral: true
      });
    } catch (error) {
      await interaction.reply({
        content: '❌ Não foi possível enviar DM. Verifique se suas DMs estão abertas!',
        ephemeral: true
      });
    }
  }

  static async handleSacarSaldoButton(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('modal_sacar_saldo')
      .setTitle('💸 Solicitar Saque');

    const valorInput = new TextInputBuilder()
      .setCustomId('saque_valor')
      .setLabel('Valor que deseja sacar')
      .setPlaceholder('Ex: 100000')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(12);

    const row = new ActionRowBuilder().addComponents(valorInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  }

  static async handleApproveWithdrawal(interaction, withdrawalId) {
    await BankCore.approveWithdrawal(interaction, withdrawalId);
  }

  static async handleRejectWithdrawal(interaction, withdrawalId) {
    await BankCore.rejectWithdrawal(interaction, withdrawalId);
  }

  static async handleApproveLoan(interaction, loanId) {
    await BankCore.approveLoan(interaction, loanId);
  }

  static async handleRejectLoan(interaction, loanId) {
    await BankCore.rejectLoan(interaction, loanId);
  }

  // Métodos para transferência de saldo
  static async handleTransferirSaldoButton(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('modal_transferir_saldo')
      .setTitle('💱 Transferir Saldo');

    const userInput = new TextInputBuilder()
      .setCustomId('transfer_user')
      .setLabel('ID ou @ do usuário destinatário')
      .setPlaceholder('Ex: @usuario ou 123456789...')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const valorInput = new TextInputBuilder()
      .setCustomId('transfer_valor')
      .setLabel('Valor a transferir')
      .setPlaceholder('Ex: 10000')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(userInput),
      new ActionRowBuilder().addComponents(valorInput)
    );

    await interaction.showModal(modal);
  }

  static async handleConfirmarTransferencia(interaction, transferId) {
    const transferencia = global.transferenciasPendentes?.get(transferId);

    if (!transferencia) {
      return interaction.reply({
        content: '❌ Transferência não encontrada ou expirada!',
        ephemeral: true
      });
    }

    if (transferencia.destinatarioId !== interaction.user.id) {
      return interaction.reply({
        content: '❌ Você não é o destinatário desta transferência!',
        ephemeral: true
      });
    }

    if (transferencia.status !== 'pendente') {
      return interaction.reply({
        content: '❌ Esta transferência já foi processada!',
        ephemeral: true
      });
    }

    const remetente = db.getUser(transferencia.remetenteId);
    const destinatario = db.getUser(transferencia.destinatarioId);

    if (remetente.saldo < transferencia.valor) {
      global.transferenciasPendentes.delete(transferId);
      return interaction.reply({
        content: '❌ O remetente não tem saldo suficiente para completar a transferência!',
        ephemeral: true
      });
    }

    // Executar transferência
    remetente.saldo -= transferencia.valor;
    destinatario.saldo += transferencia.valor;
    transferencia.status = 'concluida';

    db.updateUser(transferencia.remetenteId, remetente);
    db.updateUser(transferencia.destinatarioId, destinatario);

    db.addTransaction('transferencia_enviada', transferencia.remetenteId, transferencia.valor, {
      destinatarioId: transferencia.destinatarioId,
      transferId: transferId
    });

    db.addTransaction('transferencia_recebida', transferencia.destinatarioId, transferencia.valor, {
      remetenteId: transferencia.remetenteId,
      transferId: transferId
    });

    global.transferenciasPendentes.delete(transferId);

    await interaction.update({
      content: `✅ **Transferência aceita!**\n💰 Você recebeu 🪙 ${transferencia.valor.toLocaleString()} de <@${transferencia.remetenteId}>`,
      embeds: [],
      components: []
    });

    // Notificar remetente
    try {
      const remetenteUser = await interaction.client.users.fetch(transferencia.remetenteId);
      await remetenteUser.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Transferência Concluída')
            .setDescription(`> Seu envio de 🪙 ${transferencia.valor.toLocaleString()} para <@${transferencia.destinatarioId}> foi aceito!\n> Seu novo saldo: 🪙 ${remetente.saldo.toLocaleString()}`)
            .setColor(0x57F287)
            .setTimestamp()
        ]
      });
    } catch (e) {}
  }

  static async handleRecusarTransferencia(interaction, transferId) {
    const transferencia = global.transferenciasPendentes?.get(transferId);

    if (!transferencia) {
      return interaction.reply({
        content: '❌ Transferência não encontrada ou expirada!',
        ephemeral: true
      });
    }

    if (transferencia.destinatarioId !== interaction.user.id) {
      return interaction.reply({
        content: '❌ Você não é o destinatário desta transferência!',
        ephemeral: true
      });
    }

    transferencia.status = 'recusada';
    global.transferenciasPendentes.delete(transferId);

    await interaction.update({
      content: `❌ **Transferência recusada!**\nVocê recusou o recebimento de 🪙 ${transferencia.valor.toLocaleString()} de <@${transferencia.remetenteId}>`,
      embeds: [],
      components: []
    });

    // Notificar remetente
    try {
      const remetenteUser = await interaction.client.users.fetch(transferencia.remetenteId);
      await remetenteUser.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Transferência Recusada')
            .setDescription(`> <@${interaction.user.id}> recusou seu envio de 🪙 ${transferencia.valor.toLocaleString()}`)
            .setColor(0xED4245)
            .setTimestamp()
        ]
      });
    } catch (e) {}
  }
}

module.exports = ConfigActions;