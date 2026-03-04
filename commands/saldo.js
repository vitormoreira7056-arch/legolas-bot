const { SlashCommandBuilder } = require('discord.js');
const db = require('../utils/database');
const BankHandler = require('../handlers/bankHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('saldo')
    .setDescription('Visualiza seu extrato bancário'),

  async execute(interaction, client) {
    const user = db.getUser(interaction.user.id);
    const embed = BankHandler.createBalanceEmbed(user, interaction.member);

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
};