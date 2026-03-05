const BankEmbeds = require('./bankEmbeds');
const db = require('../../utils/database');
const { EmbedBuilder } = require('discord.js');

class BankCore {
  static async requestWithdrawal(interaction, valor) {
    const userId = interaction.user.id;
    const user = db.getUser(userId);

    if (user.saldo < valor) {
      return interaction.reply({
        content: `❌ Saldo insuficiente!\n💰 Seu saldo: 🪙 ${user.saldo.toLocaleString()}\n💸 Valor solicitado: 🪙 ${valor.toLocaleString()}`,
        ephemeral: true
      });
    }

    const withdrawal = db.createPendingWithdrawal(userId, valor);
    if (!withdrawal) {
      return interaction.reply({
        content: '❌ Erro ao criar solicitação de saque!',
        ephemeral: true
      });
    }

    const guild = interaction.guild;
    const financeiroChannel = guild.channels.cache.find(c => c.name === '📊╠financeiro');

    if (!financeiroChannel) {
      return interaction.reply({
        content: '❌ Canal financeiro não encontrado! Contate um ADM.',
        ephemeral: true
      });
    }

    const embed = BankEmbeds.createWithdrawalRequestEmbed(withdrawal, interaction.member);
    const buttons = BankEmbeds.createWithdrawalButtons(withdrawal.id);

    await financeiroChannel.send({
      content: `🔔 <@&${guild.roles.cache.find(r => r.name === 'ADM')?.id}> Nova solicitação de saque!`,
      embeds: [embed],
      components: [buttons]
    });

    await interaction.reply({
      embeds: [
        BankEmbeds.createSuccessEmbed(
          '⏳ **SAQUE SOLICITADO**',
          `\> Sua solicitação de saque foi enviada para aprovação!\n\n**💰 Valor:** 🪙 ${valor.toLocaleString()}\n**📊 Saldo atual:** 🪙 ${user.saldo.toLocaleString()}\n\n*Aguarde a aprovação de um ADM.*`,
          BankEmbeds.colors.warning
        )
      ],
      ephemeral: true
    });
  }

  static async requestLoan(interaction, valor) {
    const userId = interaction.user.id;
    const user = db.getUser(userId);

    const loan = db.createPendingLoan(userId, valor);
    if (!loan) {
      return interaction.reply({
        content: '❌ Erro ao criar solicitação de empréstimo!',
        ephemeral: true
      });
    }

    const guild = interaction.guild;
    const financeiroChannel = guild.channels.cache.find(c => c.name === '📊╠financeiro');

    if (!financeiroChannel) {
      return interaction.reply({
        content: '❌ Canal financeiro não encontrado! Contate um ADM.',
        ephemeral: true
      });
    }

    const embed = BankEmbeds.createLoanRequestEmbed(loan, interaction.member);
    const buttons = BankEmbeds.createLoanButtons(loan.id);

    await financeiroChannel.send({
      content: `🔔 <@&${guild.roles.cache.find(r => r.name === 'ADM')?.id}> Nova solicitação de empréstimo!`,
      embeds: [embed],
      components: [buttons]
    });

    await interaction.reply({
      embeds: [
        BankEmbeds.createSuccessEmbed(
          '⏳ **EMPRÉSTIMO SOLICITADO**',
          `\> Sua solicitação de empréstimo foi enviada para análise!\n\n**💰 Valor:** 🪙 ${valor.toLocaleString()}\n**📊 Saldo atual:** 🪙 ${user.saldo.toLocaleString()}\n\n*Aguarde a aprovação de um ADM.*`,
          BankEmbeds.colors.info
        )
      ],
      ephemeral: true
    });
  }

  static async approveWithdrawal(interaction, withdrawalId) {
    const result = db.approveWithdrawal(withdrawalId);

    if (!result) {
      return interaction.reply({
        content: '❌ Saque não encontrado ou já processado!',
        ephemeral: true
      });
    }

    const { withdrawal, user } = result;
    const member = await interaction.guild.members.fetch(withdrawal.userId).catch(() => null);

    const embed = BankEmbeds.createWithdrawalRequestEmbed(withdrawal, member || interaction.member);
    const updatedEmbed = embed
      .setColor(BankEmbeds.colors.success)
      .setTitle('✅ **SAQUE APROVADO**')
      .setDescription(`Aprovado por ${interaction.user}`)
      .addFields(
        { name: '💰 **Valor Liberado**', value: `🪙 ${withdrawal.valor.toLocaleString()}`, inline: true },
        { name: '💵 **Novo Saldo**', value: `🪙 ${user.saldo.toLocaleString()}`, inline: true }
      )
      .setFooter({ text: `Aprovado em: ${new Date().toLocaleString('pt-BR')}` });

    await interaction.update({ embeds: [updatedEmbed], components: [] });

    if (member) {
      await member.send({
        embeds: [
          BankEmbeds.createSuccessEmbed(
            '✅ **SAQUE APROVADO!**',
            `\> Seu saque foi **APROVADO**!\n\n**💰 Valor:** 🪙 ${withdrawal.valor.toLocaleString()}\n**💵 Saldo restante:** 🪙 ${user.saldo.toLocaleString()}\n\n*Entre em contato com um ADM para receber o valor.*`
          )
        ]
      }).catch(() => {});
    }
  }

  static async rejectWithdrawal(interaction, withdrawalId) {
    const withdrawal = db.rejectWithdrawal(withdrawalId);

    if (!withdrawal) {
      return interaction.reply({
        content: '❌ Saque não encontrado!',
        ephemeral: true
      });
    }

    const member = await interaction.guild.members.fetch(withdrawal.userId).catch(() => null);

    const embed = BankEmbeds.createWithdrawalRequestEmbed(withdrawal, member || interaction.member)
      .setColor(BankEmbeds.colors.danger)
      .setTitle('❌ **SAQUE RECUSADO**')
      .setDescription(`Recusado por ${interaction.user}`)
      .setFooter({ text: `Recusado em: ${new Date().toLocaleString('pt-BR')}` });

    await interaction.update({ embeds: [embed], components: [] });

    if (member) {
      await member.send({
        embeds: [
          BankEmbeds.createSuccessEmbed(
            '❌ **SAQUE RECUSADO**',
            `\> Seu saque foi **RECUSADO**.\n\n**💰 Valor:** 🪙 ${withdrawal.valor.toLocaleString()}\n\n*Entre em contato com um ADM para mais informações.*`,
            BankEmbeds.colors.danger
          )
        ]
      }).catch(() => {});
    }
  }

  static async approveLoan(interaction, loanId) {
    const result = db.approveLoan(loanId);

    if (!result) {
      return interaction.reply({
        content: '❌ Empréstimo não encontrado ou já processado!',
        ephemeral: true
      });
    }

    const { loan, user } = result;
    const member = await interaction.guild.members.fetch(loan.userId).catch(() => null);

    const embed = BankEmbeds.createLoanRequestEmbed(loan, member || interaction.member)
      .setColor(BankEmbeds.colors.success)
      .setTitle('✅ **EMPRÉSTIMO APROVADO**')
      .setDescription(`Aprovado por ${interaction.user}`)
      .addFields(
        { name: '💰 **Valor Liberado**', value: `🪙 ${loan.valor.toLocaleString()}`, inline: true },
        { name: '💵 **Novo Saldo**', value: `🪙 ${user.saldo.toLocaleString()}`, inline: true },
        { name: '💳 **Dívida Total**', value: `🪙 ${user.emprestimo.toLocaleString()}`, inline: true }
      )
      .setFooter({ text: `Aprovado em: ${new Date().toLocaleString('pt-BR')}` });

    await interaction.update({ embeds: [embed], components: [] });

    if (member) {
      await member.send({
        embeds: [
          BankEmbeds.createSuccessEmbed(
            '✅ **EMPRÉSTIMO APROVADO!**',
            `\> Seu empréstimo foi **APROVADO**!\n\n**💰 Valor liberado:** 🪙 ${loan.valor.toLocaleString()}\n**💵 Saldo atual:** 🪙 ${user.saldo.toLocaleString()}\n**💳 Dívida total:** 🪙 ${user.emprestimo.toLocaleString()}\n\n*Use /saldo para ver seu extrato.*`
          )
        ]
      }).catch(() => {});
    }
  }

  static async rejectLoan(interaction, loanId) {
    const loan = db.rejectLoan(loanId);

    if (!loan) {
      return interaction.reply({
        content: '❌ Empréstimo não encontrado!',
        ephemeral: true
      });
    }

    const member = await interaction.guild.members.fetch(loan.userId).catch(() => null);

    const embed = BankEmbeds.createLoanRequestEmbed(loan, member || interaction.member)
      .setColor(BankEmbeds.colors.danger)
      .setTitle('❌ **EMPRÉSTIMO RECUSADO**')
      .setDescription(`Recusado por ${interaction.user}`)
      .setFooter({ text: `Recusado em: ${new Date().toLocaleString('pt-BR')}` });

    await interaction.update({ embeds: [embed], components: [] });

    if (member) {
      await member.send({
        embeds: [
          BankEmbeds.createSuccessEmbed(
            '❌ **EMPRÉSTIMO RECUSADO**',
            `\> Seu pedido de empréstimo foi **RECUSADO**.\n\n**💰 Valor solicitado:** 🪙 ${loan.valor.toLocaleString()}\n\n*Entre em contato com um ADM para mais informações.*`,
            BankEmbeds.colors.danger
          )
        ]
      }).catch(() => {});
    }
  }

  // 🆕 MÉTODO ATUALIZADO: Depósito manual com motivo
  static async depositManual(interaction, targetMember, valor, motivo = 'Depósito manual') {
    const user = db.deposit(targetMember.id, valor, interaction.user.id, motivo);

    // Embed de confirmação no canal
    const embedConfirmacao = new EmbedBuilder()
      .setTitle('✅ **DEPÓSITO REALIZADO**')
      .setDescription(`> Depósito manual efetuado com sucesso!`)
      .setColor(BankEmbeds.colors.success)
      .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 **Beneficiário**', value: `${targetMember} (\`${targetMember.id}\`)`, inline: true },
        { name: '💰 **Valor Depositado**', value: `🪙 ${valor.toLocaleString()}`, inline: true },
        { name: '📝 **Motivo**', value: motivo, inline: false },
        { name: '💵 **Novo Saldo**', value: `🪙 ${user.saldo.toLocaleString()}`, inline: true },
        { name: '🏦 **Depositado por**', value: `${interaction.user}`, inline: true }
      )
      .setFooter({ text: 'Sistema Bancário • Albion Guild' })
      .setTimestamp();

    await interaction.reply({
      embeds: [embedConfirmacao]
    });

    // Notificar usuário na DM
    try {
      await targetMember.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('💰 **DEPÓSITO RECEBIDO!**')
            .setDescription(
              `\> Você recebeu um depósito na sua conta!\n\n` +
              `**💰 Valor:** 🪙 ${valor.toLocaleString()}\n` +
              `**📝 Motivo:** ${motivo}\n` +
              `**💵 Novo Saldo:** 🪙 ${user.saldo.toLocaleString()}\n` +
              `**🏦 Depositado por:** ${interaction.user}\n\n` +
              `*Use /saldo para ver seu extrato completo.*`
            )
            .setColor(BankEmbeds.colors.success)
            .setTimestamp()
        ]
      });
    } catch (error) {
      // Usuário tem DMs fechadas, ignorar
      console.log(`Não foi possível notificar ${targetMember.user.tag} na DM`);
    }

    // Log no canal de logs do banco
    const logsChannel = interaction.guild.channels.cache.find(c => c.name === '📜╠logs-banco');
    if (logsChannel) {
      await logsChannel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('📝 **LOG DE DEPÓSITO MANUAL**')
            .setDescription(`Depósito realizado por ${interaction.user}`)
            .setColor(BankEmbeds.colors.info)
            .addFields(
              { name: '👤 **Para**', value: `${targetMember}`, inline: true },
              { name: '💰 **Valor**', value: `🪙 ${valor.toLocaleString()}`, inline: true },
              { name: '📝 **Motivo**', value: motivo, inline: false }
            )
            .setTimestamp()
        ]
      });
    }

    return user;
  }

  // 🆕 MÉTODO ADICIONADO: Aprovação de venda de baú
  static async approveVenda(interaction, vendaId) {
    const venda = global.vendasPendentes?.get(vendaId);
    
    if (!venda) {
      return interaction.reply({
        content: '❌ Venda não encontrada ou já processada!',
        ephemeral: true
      });
    }

    // Verificar permissões
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isStaff = interaction.member.roles.cache.some(r => r.name === 'Staff');
    
    if (!isADM && !isStaff) {
      return interaction.reply({
        content: '❌ Apenas ADMs ou Staff podem aprovar vendas!',
        ephemeral: true
      });
    }

    try {
      const user = db.getUser(venda.userId);
      
      // Creditar valor líquido
      user.saldo += venda.valorLiquido;
      user.totalDepositado += venda.valorLiquido;
      db.updateUser(venda.userId, user);

      // Registrar taxa se houver
      if (venda.taxa > 0) {
        const valorTaxa = venda.valor - venda.valorLiquido;
        db.adicionarTaxaBau(valorTaxa, venda.local, vendaId);
      }

      // Criar transação
      db.addTransaction('venda_bau', venda.userId, venda.valorLiquido, {
        vendaId: vendaId,
        local: venda.local,
        valorTotal: venda.valor,
        taxa: venda.taxa,
        aprovadoPor: interaction.user.id
      });

      // Remover da lista de pendentes
      global.vendasPendentes.delete(vendaId);

      // Atualizar mensagem original
      const embedAprovado = new EmbedBuilder()
        .setTitle('✅ **VENDA APROVADA**')
        .setDescription(`Aprovado por ${interaction.user}`)
        .setColor(0x57F287)
        .setThumbnail(interaction.guild.members.cache.get(venda.userId)?.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤 **Vendedor**', value: `<@${venda.userId}>`, inline: true },
          { name: '📍 **Local**', value: venda.local, inline: true },
          { name: '💰 **Valor Total**', value: `🪙 ${venda.valor.toLocaleString()}`, inline: true },
          { name: '💸 **Taxa**', value: `${venda.taxa}% (🪙 ${(venda.valor - venda.valorLiquido).toLocaleString()})`, inline: true },
          { name: '💵 **Valor Líquido**', value: `🪙 ${venda.valorLiquido.toLocaleString()}`, inline: true },
          { name: '💳 **Novo Saldo**', value: `🪙 ${user.saldo.toLocaleString()}`, inline: true }
        )
        .setTimestamp();

      await interaction.update({ 
        embeds: [embedAprovado], 
        components: [] 
      });

      // Notificar vendedor
      try {
        const vendedor = await interaction.client.users.fetch(venda.userId);
        await vendedor.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('💰 **VENDA APROVADA!**')
              .setDescription(`> Sua venda de baú foi **APROVADA**!`)
              .setColor(0x57F287)
              .addFields(
                { name: '📍 Local', value: venda.local, inline: true },
                { name: '💰 Valor Recebido', value: `🪙 ${venda.valorLiquido.toLocaleString()}`, inline: true },
                { name: '💵 Saldo Atual', value: `🪙 ${user.saldo.toLocaleString()}`, inline: true }
              )
              .setTimestamp()
          ]
        });
      } catch (e) {
        console.log(`[BANK] Não foi possível notificar vendedor ${venda.userId}`);
      }

      // Atualizar painel de saldo
      if (global.atualizarSaldoGuilda) {
        await global.atualizarSaldoGuilda();
      }

    } catch (error) {
      console.error('[BANK] Erro ao aprovar venda:', error);
      await interaction.reply({
        content: '❌ Erro ao processar aprovação!',
        ephemeral: true
      });
    }
  }

  // 🆕 MÉTODO ADICIONADO: Rejeição de venda de baú
  static async rejectVenda(interaction, vendaId) {
    const venda = global.vendasPendentes?.get(vendaId);
    
    if (!venda) {
      return interaction.reply({
        content: '❌ Venda não encontrada!',
        ephemeral: true
      });
    }

    // Verificar permissões
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isStaff = interaction.member.roles.cache.some(r => r.name === 'Staff');
    
    if (!isADM && !isStaff) {
      return interaction.reply({
        content: '❌ Apenas ADMs ou Staff podem recusar vendas!',
        ephemeral: true
      });
    }

    try {
      // Remover da lista de pendentes
      global.vendasPendentes.delete(vendaId);

      // Atualizar mensagem original
      const embedRecusado = new EmbedBuilder()
        .setTitle('❌ **VENDA RECUSADA**')
        .setDescription(`Recusado por ${interaction.user}`)
        .setColor(0xED4245)
        .setThumbnail(interaction.guild.members.cache.get(venda.userId)?.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤 **Vendedor**', value: `<@${venda.userId}>`, inline: true },
          { name: '📍 **Local**', value: venda.local, inline: true },
          { name: '💰 **Valor**', value: `🪙 ${venda.valor.toLocaleString()}`, inline: true }
        )
        .setTimestamp();

      await interaction.update({ 
        embeds: [embedRecusado], 
        components: [] 
      });

      // Notificar vendedor
      try {
        const vendedor = await interaction.client.users.fetch(venda.userId);
        await vendedor.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ **VENDA RECUSADA**')
              .setDescription(`> Sua venda de baú foi **RECUSADA**.`)
              .setColor(0xED4245)
              .addFields(
                { name: '📍 Local', value: venda.local, inline: true },
                { name: '💰 Valor', value: `🪙 ${venda.valor.toLocaleString()}`, inline: true }
              )
              .setTimestamp()
          ]
        });
      } catch (e) {
        console.log(`[BANK] Não foi possível notificar vendedor ${venda.userId}`);
      }

    } catch (error) {
      console.error('[BANK] Erro ao recusar venda:', error);
      await interaction.reply({
        content: '❌ Erro ao processar recusa!',
        ephemeral: true
      });
    }
  }

  static createBalanceEmbed(user, member) {
    return BankEmbeds.createBalanceEmbed(user, member);
  }
}

module.exports = BankCore;
