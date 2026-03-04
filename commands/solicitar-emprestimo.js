const { SlashCommandBuilder } = require('discord.js');
const BankHandler = require('../handlers/bankHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('solicitar-emprestimo')
    .setDescription('Solicita um empréstimo com a guilda')
    .addIntegerOption(option =>
      option.setName('valor')
        .setDescription('Valor que deseja pegar emprestado')
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

    await BankHandler.requestLoan(interaction, valor);
  }
};