const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const EventActions = require('../handlers/actions/eventActions');
const EventStatsHandler = require('../handlers/eventStatsHandler');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('limpar-eventos')
    .setDescription('🗑️ Limpa todo o histórico de eventos (Apenas ADMs)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');

    if (!isADM) {
      return interaction.reply({
        content: '❌ Apenas ADMs podem usar este comando!',
        ephemeral: true
      });
    }

    // Embed de confirmação
    const embedConfirmacao = new EmbedBuilder()
      .setTitle('⚠️ Confirmação Necessária')
      .setDescription(
        'Você está prestes a **limpar todo o histórico de eventos** do bot!\n\n' +
        'Isso irá:\n' +
        '🗑️ Limpar eventos ativos\n' +
        '🗑️ Limpar estatísticas de eventos\n' +
        '🗑️ Limpar simulações de lootsplit\n' +
        '🗑️ Limpar dados de participação\n\n' +
        '**Esta ação não pode ser desfeita!**'
      )
      .setColor(0xE74C3C)
      .setFooter({ text: 'Clique em "Confirmar Limpeza" para prosseguir' });

    const botoes = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('confirmar_limpar_eventos')
          .setLabel('✅ Confirmar Limpeza')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancelar_limpar_eventos')
          .setLabel('❌ Cancelar')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.reply({
      embeds: [embedConfirmacao],
      components: [botoes],
      ephemeral: true
    });

    // Criar collector para aguardar resposta
    const collector = interaction.channel.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 30000,
      max: 1
    });

    collector.on('collect', async i => {
      if (i.customId === 'confirmar_limpar_eventos') {
        await i.deferUpdate();
        
        try {
          console.log(`[LIMPAR-EVENTOS] Limpeza iniciada por ${interaction.user.tag}`);

          // 1. Limpar eventos ativos
          const eventosAtivos = EventActions.activeEvents.size;
          EventActions.activeEvents.clear();

          // 2. Limpar estatísticas de eventos
          const statsFile = path.join(__dirname, '..', 'data', 'eventStats.json');
          const statsBackup = path.join(__dirname, '..', 'data', 'eventStats_backup.json');
          
          // Backup antes de limpar
          if (fs.existsSync(statsFile)) {
            fs.copyFileSync(statsFile, statsBackup);
            fs.writeFileSync(statsFile, JSON.stringify({}, null, 2));
          }
          EventStatsHandler.stats = new Map();

          // 3. Limpar simulações de lootsplit
          const lootsplitFile = path.join(__dirname, '..', 'data', 'lootsplits.json');
          const lootsplitBackup = path.join(__dirname, '..', 'data', 'lootsplits_backup.json');
          
          if (fs.existsSync(lootsplitFile)) {
            fs.copyFileSync(lootsplitFile, lootsplitBackup);
            fs.writeFileSync(lootsplitFile, JSON.stringify({}, null, 2));
          }

          // 4. Limpar dados de eventStatsMessage (mensagens do painel)
          const messageIdFile = path.join(__dirname, '..', 'data', 'eventStatsMessage.json');
          if (fs.existsSync(messageIdFile)) {
            fs.unlinkSync(messageIdFile);
          }

          // 5. Atualizar painel de estatísticas se existir
          try {
            await EventStatsHandler.updatePanel(interaction.guild);
          } catch (e) {
            console.log('[LIMPAR-EVENTOS] Painel não pôde ser atualizado:', e.message);
          }

          console.log(`[LIMPAR-EVENTOS] Limpeza concluída por ${interaction.user.tag}`);

          const embedSucesso = new EmbedBuilder()
            .setTitle('✅ Limpeza Concluída')
            .setDescription(
              'Todo o histórico de eventos foi limpo com sucesso!\n\n' +
              `📊 **Eventos ativos removidos:** ${eventosAtivos}\n` +
              `🗑️ **Arquivos limpos:**\n` +
              '• eventStats.json\n' +
              '• lootsplits.json\n' +
              '• eventStatsMessage.json\n\n' +
              '💾 **Backups criados:**\n' +
              '• eventStats_backup.json\n' +
              '• lootsplits_backup.json'
            )
            .setColor(0x57F287)
            .setTimestamp();

          await i.editReply({
            embeds: [embedSucesso],
            components: []
          });

        } catch (error) {
          console.error('[LIMPAR-EVENTOS] Erro:', error);
          await i.editReply({
            content: `❌ Erro ao limpar eventos: ${error.message}`,
            embeds: [],
            components: []
          });
        }

      } else {
        await i.update({
          content: '❌ Operação cancelada.',
          embeds: [],
          components: []
        });
      }
    });

    collector.on('end', async collected => {
      if (collected.size === 0) {
        await interaction.editReply({
          content: '⏱️ Tempo esgotado. Operação cancelada.',
          embeds: [],
          components: []
        });
      }
    });
  }
};
