const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const SetupManager = require('../handlers/setupManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('instalar')
    .setDescription('Instala a estrutura completa do servidor da guilda')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const setup = new SetupManager(interaction.guild, interaction);

    try {
      const result = await setup.update();

      const embedResumo = new EmbedBuilder()
        .setTitle('✅ Instalação/Atualização Concluída!')
        .setDescription(result.message)
        .setColor(0x2ecc71)
        .addFields(
          { 
            name: '🎭 Cargos (' + (result.createdRoles.length + result.existingRoles.length) + '):', 
            value: [
              ...(result.createdRoles.length > 0 ? ['**🆕 Criados:**', ...result.createdRoles.map(r => `• ${r}`)] : []),
              ...(result.existingRoles.length > 0 ? ['**✅ Existentes:**', ...result.existingRoles.slice(0, 5).map(r => `• ${r}`)] : [])
            ].join('\n') || 'Nenhum'
          },
          { 
            name: '📢 Canais/Categorias (' + (result.createdChannels.length + result.existingChannels.length) + '):', 
            value: result.createdChannels.length > 0 
              ? `**🆕 Criados:** ${result.createdChannels.slice(0, 10).map(c => `• ${c}`).join('\n')}${result.createdChannels.length > 10 ? `\n... e mais ${result.createdChannels.length - 10}` : ''}`
              : 'Nenhum canal novo criado (todos já existiam)'
          }
        )
        .setFooter({ text: 'Use /desinstalar para remover tudo ou "🔄 Atualizar Bot" para adicionar novidades' })
        .setTimestamp();

      await interaction.editReply({ 
        content: null,
        embeds: [embedResumo] 
      });

    } catch (error) {
      console.error('Erro na instalação:', error);
      await interaction.editReply({ 
        content: `❌ **Erro durante a instalação:**\n\`\`\`${error.message}\`\`\`` 
      });
    }
  }
};