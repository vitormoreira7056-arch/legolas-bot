const { EmbedBuilder } = require('discord.js');
const BankEmbeds = require('./bankEmbeds');
const BankCore = require('./bankCore');
const db = require('../../utils/database');

class BankVendas {
  static async approveVenda(interaction, vendaId) {
    const venda = global.vendasPendentes?.get(vendaId);
    if (!venda) {
      return interaction.reply({
        content: '❌ Venda não encontrada ou já processada!',
        ephemeral: true
      });
    }

    const member = await interaction.guild.members.fetch(venda.userId).catch(() => null);
    const user = db.getUser(venda.userId);

    // Depositar valor líquido
    user.saldo += venda.valorLiquido;
    user.totalDepositado += venda.valorLiquido;
    db.updateUser(venda.userId, user);

    db.addTransaction('deposito', venda.userId, venda.valorLiquido, {
      tipo: 'venda_bau',
      local: venda.local,
      valorTotal: venda.valor,
      taxa: venda.taxa,
      vendaId: vendaId
    });

    // Atualizar mensagem original
    const embed = new EmbedBuilder()
      .setColor(BankEmbeds.colors.success)
      .setTitle('✅ **VENDA APROVADA**')
      .setDescription(`Aprovada por ${interaction.user}`)
      .addFields(
        { name: '👤 **Vendedor**', value: `${member || 'Desconhecido'}`, inline: true },
        { name: '📍 **Local**', value: `${venda.local}`, inline: true },
        { name: '💰 **Valor Total**', value: `🪙 ${venda.valor.toLocaleString()}`, inline: true },
        { name: '💸 **Taxa**', value: `${venda.taxa}%`, inline: true },
        { name: '💵 **Valor Líquido**', value: `🪙 ${venda.valorLiquido.toLocaleString()}`, inline: true },
        { name: '💳 **Novo Saldo**', value: `🪙 ${user.saldo.toLocaleString()}`, inline: false }
      )
      .setFooter({ text: `Aprovado em: ${new Date().toLocaleString('pt-BR')}` });

    await interaction.update({ embeds: [embed], components: [] });

    // Notificar vendedor
    if (member) {
      await member.send({
        embeds: [
          BankEmbeds.createSuccessEmbed(
            '✅ **VENDA APROVADA!**',
            `> Sua venda de baú foi **APROVADA**!\n\n**📍 Local:** ${venda.local}\n**💰 Valor Total:** 🪙 ${venda.valor.toLocaleString()}\n**💸 Taxa (${venda.taxa}%):** 🪙 ${Math.floor(venda.valor * (venda.taxa / 100)).toLocaleString()}\n**💵 Valor Líquido:** 🪙 ${venda.valorLiquido.toLocaleString()}\n**💳 Novo Saldo:** 🪙 ${user.saldo.toLocaleString()}\n\n*O valor já foi depositado na sua conta.*`
          )
        ]
      }).catch(() => {});
    }

    global.vendasPendentes.delete(vendaId);
  }

  static async rejectVenda(interaction, vendaId) {
    const venda = global.vendasPendentes?.get(vendaId);
    if (!venda) {
      return interaction.reply({
        content: '❌ Venda não encontrada!',
        ephemeral: true
      });
    }

    const member = await interaction.guild.members.fetch(venda.userId).catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(BankEmbeds.colors.danger)
      .setTitle('❌ **VENDA RECUSADA**')
      .setDescription(`Recusada por ${interaction.user}`)
      .addFields(
        { name: '👤 **Vendedor**', value: `${member || 'Desconhecido'}`, inline: true },
        { name: '📍 **Local**', value: `${venda.local}`, inline: true },
        { name: '💰 **Valor**', value: `🪙 ${venda.valor.toLocaleString()}`, inline: true }
      )
      .setFooter({ text: `Recusado em: ${new Date().toLocaleString('pt-BR')}` });

    await interaction.update({ embeds: [embed], components: [] });

    if (member) {
      await member.send({
        embeds: [
          BankEmbeds.createSuccessEmbed(
            '❌ **VENDA RECUSADA**',
            `> Sua solicitação de venda foi **RECUSADA**.\n\n**📍 Local:** ${venda.local}\n**💰 Valor:** 🪙 ${venda.valor.toLocaleString()}\n\n*Entre em contato com um ADM para mais informações.*`,
            BankEmbeds.colors.danger
          )
        ]
      }).catch(() => {});
    }

    global.vendasPendentes.delete(vendaId);
  }
}

module.exports = BankVendas;
