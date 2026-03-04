const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../../utils/database');

class BankEmbeds {
  static colors = {
    success: 0x57F287,
    danger: 0xED4245,
    warning: 0xFEE75C,
    info: 0x5865F2,
    gold: 0xF1C40F
  };

  static createWithdrawalRequestEmbed(withdrawal, member) {
    const user = db.getUser(withdrawal.userId);

    return new EmbedBuilder()
      .setTitle('💸 **SOLICITAÇÃO DE SAQUE**')
      .setDescription(`Nova solicitação de saque recebida`)
      .setColor(this.colors.warning)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 **Usuário**', value: `${member} (\`${member.id}\`)`, inline: true },
        { name: '💰 **Valor Solicitado**', value: `🪙 ${withdrawal.valor.toLocaleString()}`, inline: true },
        { name: '💵 **Saldo Atual**', value: `🪙 ${user.saldo.toLocaleString()}`, inline: true },
        { name: '📅 **Data**', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
      )
      .setFooter({ text: `ID: ${withdrawal.id} • Aguardando aprovação` })
      .setTimestamp();
  }

  static createWithdrawalButtons(withdrawalId) {
    return new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_withdrawal_${withdrawalId}`)
          .setLabel('✅ Aprovar Saque')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject_withdrawal_${withdrawalId}`)
          .setLabel('❌ Recusar')
          .setStyle(ButtonStyle.Danger)
      );
  }

  static createLoanRequestEmbed(loan, member) {
    const user = db.getUser(loan.userId);

    return new EmbedBuilder()
      .setTitle('🏦 **SOLICITAÇÃO DE EMPRÉSTIMO**')
      .setDescription(`Nova solicitação de empréstimo recebida`)
      .setColor(this.colors.info)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 **Usuário**', value: `${member} (\`${member.id}\`)`, inline: true },
        { name: '💰 **Valor Solicitado**', value: `🪙 ${loan.valor.toLocaleString()}`, inline: true },
        { name: '💳 **Empréstimo Atual**', value: `🪙 ${user.emprestimo.toLocaleString()}`, inline: true },
        { name: '💵 **Saldo Atual**', value: `🪙 ${user.saldo.toLocaleString()}`, inline: true },
        { name: '📅 **Data**', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
      )
      .setFooter({ text: `ID: ${loan.id} • Aguardando aprovação` })
      .setTimestamp();
  }

  static createLoanButtons(loanId) {
    return new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`approve_loan_${loanId}`)
          .setLabel('✅ Aprovar Empréstimo')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject_loan_${loanId}`)
          .setLabel('❌ Recusar')
          .setStyle(ButtonStyle.Danger)
      );
  }

  static createBalanceEmbed(user, member) {
    const transacoes = db.getUserTransactions(user.userId, 5);

    const historico = transacoes.length > 0 
      ? transacoes.map(t => {
          const emoji = t.type === 'deposito' ? '➕' : t.type === 'saque' ? '➖' : t.type === 'emprestimo' ? '💳' : '🎮';
          return `${emoji} ${t.type.toUpperCase()}: 🪙 ${t.valor.toLocaleString()} - <t:${Math.floor(t.timestamp.getTime() / 1000)}:R>`;
        }).join('\n')
      : '*Nenhuma transação recente*';

    return new EmbedBuilder()
      .setTitle('🏦 **SEU EXTRATO BANCÁRIO**')
      .setDescription(`Extrato de ${member}`)
      .setColor(this.colors.gold)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '💰 **Saldo Disponível**', value: `🪙 **${user.saldo.toLocaleString()}**`, inline: false },
        { name: '💳 **Empréstimo Ativo**', value: `🪙 ${user.emprestimo.toLocaleString()}`, inline: true },
        { name: '💵 **Total Depositado**', value: `🪙 ${user.totalDepositado.toLocaleString()}`, inline: true },
        { name: '💸 **Total Sacado**', value: `🪙 ${user.totalSacado.toLocaleString()}`, inline: true },
        { name: '📋 **Últimas Transações**', value: historico, inline: false }
      )
      .setFooter({ text: 'Sistema Bancário • Albion Guild' })
      .setTimestamp();
  }

  static createVendaEmbed(venda, member) {
    return new EmbedBuilder()
      .setTitle('💰 **SOLICITAÇÃO DE VENDA DE BAÚ**')
      .setDescription(`Nova solicitação de venda recebida`)
      .setColor(this.colors.warning)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 **Vendedor**', value: `${member} (\`${member.id}\`)`, inline: true },
        { name: '📍 **Local**', value: `${venda.local}`, inline: true },
        { name: '💰 **Valor do Baú**', value: `🪙 ${venda.valor.toLocaleString()}`, inline: true },
        { name: '💸 **Taxa da Guilda**', value: `${venda.taxa}% (🪙 ${Math.floor(venda.valor * (venda.taxa / 100)).toLocaleString()})`, inline: true },
        { name: '💵 **Valor Líquido**', value: `🪙 ${venda.valorLiquido.toLocaleString()}`, inline: true },
        { name: '📅 **Data**', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
      );
  }

  static createVendaButtons(vendaId) {
    return new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`aprovar_venda_${vendaId}`)
          .setLabel('✅ Aprovar Compra')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`recusar_venda_${vendaId}`)
          .setLabel('❌ Recusar')
          .setStyle(ButtonStyle.Danger)
      );
  }

  static createSuccessEmbed(title, description, color = this.colors.success) {
    return new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp();
  }
}

module.exports = BankEmbeds;
