const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pagar-emprestimo')
    .setDescription('Paga parte ou todo o seu empréstimo com a guilda')
    .addIntegerOption(option =>
      option.setName('valor')
        .setDescription('Valor que deseja pagar (deixe em branco para pagar tudo)')
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction, client) {
    const userId = interaction.user.id;
    const user = db.getUser(userId);
    const valorInput = interaction.options.getInteger('valor');

    // Se não informar valor, paga tudo
    const valor = valorInput || user.emprestimo;

    // Verificações
    if (user.emprestimo <= 0) {
      return interaction.reply({
        content: '✅ Você não tem empréstimos pendentes!',
        ephemeral: true
      });
    }

    if (valor > user.emprestimo) {
      return interaction.reply({
        content: `❌ O valor excede sua dívida!\n💳 Dívida: 🪙 ${user.emprestimo.toLocaleString()}\n💸 Valor informado: 🪙 ${valor.toLocaleString()}`,
        ephemeral: true
      });
    }

    if (valor > user.saldo) {
      return interaction.reply({
        content: `❌ Saldo insuficiente para pagar!\n💰 Seu saldo: 🪙 ${user.saldo.toLocaleString()}\n💳 Dívida: 🪙 ${user.emprestimo.toLocaleString()}\n💸 Valor a pagar: 🪙 ${valor.toLocaleString()}`,
        ephemeral: true
      });
    }

    // Executar pagamento
    user.saldo -= valor;
    user.emprestimo -= valor;

    db.updateUser(userId, user);
    db.addTransaction('pagamento', userId, valor, { 
      tipo: 'emprestimo',
      dividaRestante: user.emprestimo 
    });

    const embed = new EmbedBuilder()
      .setTitle('✅ **PAGAMENTO REALIZADO**')
      .setDescription(`> Pagamento de empréstimo efetuado com sucesso!`)
      .setColor(0x57F287)
      .addFields(
        { name: '💸 **Valor Pago**', value: `🪙 ${valor.toLocaleString()}`, inline: true },
        { name: '💳 **Dívida Restante**', value: `🪙 ${user.emprestimo.toLocaleString()}`, inline: true },
        { name: '💰 **Saldo Atual**', value: `🪙 ${user.saldo.toLocaleString()}`, inline: true }
      )
      .setFooter({ text: 'Sistema Bancário • Albion Guild' })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });

    // Notificar ADMs se quitou a dívida
    if (user.emprestimo === 0) {
      const financeiroChannel = interaction.guild.channels.cache.find(c => c.name === '📊╠financeiro');
      if (financeiroChannel) {
        await financeiroChannel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('🎉 **DÍVIDA QUITADA**')
              .setDescription(`${interaction.user} quitou completamente seu empréstimo com a guilda!`)
              .setColor(0x57F287)
              .setTimestamp()
          ]
        });
      }
    }
  }
};
