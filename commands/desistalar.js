const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('desinstalar')
    .setDescription('Remove toda a estrutura criada pelo bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    const guild = interaction.guild;

    // Embed de confirmação
    const embed = new EmbedBuilder()
      .setTitle('⚠️ Confirmação de Desinstalação')
      .setDescription('**ATENÇÃO:** Esta ação irá deletar todas as categorias, canais e cargos criados pelo bot!\n\n**Esta ação não pode ser desfeita!**')
      .setColor(0xe74c3c);

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('confirmar_desinstalar')
          .setLabel('✅ Confirmar Desinstalação')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('cancelar_desinstalar')
          .setLabel('❌ Cancelar')
          .setStyle(ButtonStyle.Secondary)
      );

    const reply = await interaction.reply({ 
      embeds: [embed], 
      components: [row],
      ephemeral: true,
      fetchReply: true
    });

    const collector = reply.createMessageComponentCollector({ 
      filter: i => i.user.id === interaction.user.id,
      time: 60000 
    });

    collector.on('collect', async i => {
      if (i.customId === 'cancelar_desinstalar') {
        await i.update({ content: '❌ Desinstalação cancelada.', embeds: [], components: [] });
        return collector.stop();
      }

      if (i.customId === 'confirmar_desinstalar') {
        await i.update({ content: '🗑️ Iniciando desinstalação...', embeds: [], components: [] });

        const deletados = { categorias: [], canais: [], cargos: [] };
        const errors = [];

        try {
          // ========== DELETAR CANAIS E CATEGORIAS ==========
          const categoriasParaDeletar = [
            '🛡️ RECRUTAMENTO',
            '⚙️ CONFIG',
            '💰 BANCO DA GUILDA',
            '⚔️ EVENTOS ATIVOS',
            '📁 EVENTOS ENCERRADOS',
            '👥 GESTÃO DE MEMBROS',
            '👑 GESTÃO DE GUILDA',
            '🎓 ALBION ACADEMY'  // 🆕 ADICIONADO
          ];

          const canaisParaDeletar = [
            '📋╠registrar',
            '🎤╠Recrutamento',
            '📅╠agendamentos',
            '🔧╠configurações',
            '➕╠criar-evento',
            '👋╠participar',
            '📊╠financeiro',
            '💵╠depósitos',
            '📜╠logs-banco',
            '🔊╠Aguardando-Evento',
            '📨╠solicitação-registro',
            '🚪╠saída-membros',
            '📋╠lista-membros',
            '🏦╠saldo-guilda',
            '💰╠venda-de-baú',
            '🔍╠consultar-saldo',
            '📊╠painel-de-eventos',
            // 🆕 ADICIONADOS - Canais da Albion Academy
            '👤╠perfil',
            '⭐╠xp-event',
            '📜╠log-xp',
            '🔮╠orb-xp',
            '📊╠painel-xp'
          ];

          // Deletar canais específicos
          for (const canalNome of canaisParaDeletar) {
            const canal = guild.channels.cache.find(c => c.name === canalNome);
            if (canal) {
              try {
                await canal.delete('Desinstalação do bot');
                deletados.canais.push(canalNome);
              } catch (err) {
                errors.push(`Canal ${canalNome}: ${err.message}`);
              }
            }
          }

          // Deletar categorias e canais restantes
          for (const catNome of categoriasParaDeletar) {
            const categoria = guild.channels.cache.find(c => 
              c.type === ChannelType.GuildCategory && c.name === catNome
            );
            if (categoria) {
              try {
                // Deletar canais na categoria
                const canaisNaCategoria = guild.channels.cache.filter(c => c.parentId === categoria.id);
                for (const [, canal] of canaisNaCategoria) {
                  try {
                    await canal.delete('Desinstalação do bot');
                    if (!deletados.canais.includes(canal.name)) {
                      deletados.canais.push(canal.name);
                    }
                  } catch (err) {
                    errors.push(`Canal ${canal.name}: ${err.message}`);
                  }
                }

                await categoria.delete('Desinstalação do bot');
                deletados.categorias.push(catNome);
              } catch (err) {
                errors.push(`Categoria ${catNome}: ${err.message}`);
              }
            }
          }

          // ========== DELETAR CARGOS ==========
          await i.editReply({ content: '🗑️ Deletando cargos...' });

          const cargosParaDeletar = ['NOTAG', 'Recrutador', 'ADM', 'Staff', 'Caller', 'Member Evento', 'ALIANÇA'];

          for (const cargoNome of cargosParaDeletar) {
            const cargo = guild.roles.cache.find(r => r.name === cargoNome);
            if (cargo) {
              try {
                await cargo.delete('Desinstalação do bot');
                deletados.cargos.push(cargoNome);
              } catch (err) {
                errors.push(`Cargo ${cargoNome}: ${err.message}`);
              }
            }
          }

          // ========== RESUMO ==========
          const embedResumo = new EmbedBuilder()
            .setTitle('🗑️ Desinstalação Concluída')
            .setColor(errors.length > 0 ? 0xf39c12 : 0x2ecc71)
            .addFields(
              { 
                name: '📁 Categorias', 
                value: deletados.categorias.length > 0 ? deletados.categorias.map(c => `• ${c}`).join('\n') : 'Nenhuma', 
                inline: true 
              },
              { 
                name: '💬 Canais', 
                value: deletados.canais.length > 0 ? `${deletados.canais.length} canais` : 'Nenhum', 
                inline: true 
              },
              { 
                name: '🎭 Cargos', 
                value: deletados.cargos.length > 0 ? deletados.cargos.map(c => `• ${c}`).join('\n') : 'Nenhum', 
                inline: true 
              }
            );

          if (errors.length > 0) {
            embedResumo.addFields({
              name: '⚠️ Erros:',
              value: errors.slice(0, 5).join('\n').substring(0, 1024)
            });
          }

          await i.editReply({ content: '✅ Processo finalizado!', embeds: [embedResumo] });

        } catch (error) {
          console.error('Erro na desinstalação:', error);
          await i.editReply({ 
            content: `❌ Erro crítico:\n\`\`\`${error.message}\`\`\`` 
          });
        }

        collector.stop();
      }
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        interaction.editReply({ 
          content: '⏱️ Tempo esgotado. Desinstalação cancelada.', 
          embeds: [], 
          components: [] 
        });
      }
    });
  }
};