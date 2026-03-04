const { SlashCommandBuilder } = require('discord.js');
const BankHandler = require('../handlers/bankHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sacar')
    .setDescription('Solicita um saque do seu saldo bancário')
    .addIntegerOption(option =>
      option.setName('valor')
        .setDescription('Valor que deseja sacar')
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction, client) {
    const valor = interaction.options.getInteger('valor');

    if (valor <= 0) {
      return interaction.reply({
        content: '❌ O valor deve ser maior que 0!',
        ephemeral: true
      });
    }

    await BankHandler.requestWithdrawal(interaction, valor);
  }
};