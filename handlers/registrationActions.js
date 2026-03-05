const { EmbedBuilder } = require('discord.js');
const db = require('../utils/database');

class RegistrationActions {
  static async handleIniciarRegistro(interaction) {
    const ModalHandler = require('./modalHandler');
    const modal = ModalHandler.createRegistrationModal();
    await interaction.showModal(modal);
  }

  static async handleApproval(interaction, customId) {
    const userId = customId.replace('aprovar_', '');
    
    const isRecrutador = interaction.member.roles.cache.some(r => r.name === 'Recrutador');
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    
    if (!isRecrutador && !isADM) {
      return interaction.reply({ 
        content: '❌ Apenas Recrutadores ou ADMs podem aprovar registros!', 
        ephemeral: true 
      });
    }

    try {
      const message = interaction.message;
      const embedOriginal = message.embeds[0];
      
      if (!embedOriginal) {
        return interaction.reply({ 
          content: '❌ Não foi possível encontrar os dados do registro!', 
          ephemeral: true 
        });
      }

      const fields = embedOriginal.data.fields || [];
      const nicknameField = fields.find(f => f.name.includes('Nickname'));
      const guildaField = fields.find(f => f.name.includes('Guilda'));
      const plataformaField = fields.find(f => f.name.includes('Plataforma'));
      const armaField = fields.find(f => f.name.includes('Arma'));

      const nickDoJogo = nicknameField ? nicknameField.value.replace(/`/g, '').trim() : 'Desconhecido';
      const guilda = guildaField ? guildaField.value : 'N/A';
      const plataforma = plataformaField ? plataformaField.value : 'N/A';
      const arma = armaField ? armaField.value : 'N/A';

      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return interaction.reply({ 
          content: '❌ Usuário não encontrado no servidor!', 
          ephemeral: true 
        });
      }

      let nicknameAlterado = false;
      try {
        await member.setNickname(nickDoJogo, `Registro aprovado por ${interaction.user.tag}`);
        nicknameAlterado = true;
      } catch (nickError) {
        console.error(`[REGISTRO] Erro ao alterar nickname:`, nickError);
      }

      const userData = db.getUser(userId);
      userData.nickDoJogo = nickDoJogo;
      userData.guilda = guilda;
      userData.plataforma = plataforma;
      userData.armaPrincipal = arma;
      userData.dataRegistro = new Date().toISOString();
      userData.aprovadoPor = interaction.user.id;
      db.updateUser(userId, userData);

      const cargoMembro = interaction.guild.roles.cache.find(r => r.name === 'Membro');
      const cargoNotag = interaction.guild.roles.cache.find(r => r.name === 'NOTAG');
      
      if (cargoMembro) await member.roles.add(cargoMembro).catch(() => {});
      if (cargoNotag) await member.roles.remove(cargoNotag).catch(() => {});

      const embedAprovado = new EmbedBuilder()
        .setTitle('✅ REGISTRO APROVADO')
        .setDescription(`Aprovado por ${interaction.user}`)
        .setColor(0x57F287)
        .addFields(
          { name: '👤 Usuário', value: `<@${userId}>`, inline: true },
          { name: '🎮 Nick do Jogo', value: `\`${nickDoJogo}\``, inline: true },
          { name: '🏰 Guilda', value: guilda, inline: true },
          { name: '💻 Plataforma', value: plataforma, inline: true },
          { name: '⚔️ Arma', value: arma, inline: true },
          { name: '📅 Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      await message.edit({ 
        embeds: [embedAprovado], 
        components: [] 
      });

      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('🎉 **REGISTRO APROVADO!**')
          .setDescription(
            `> Parabéns! Seu registro foi aprovado por ${interaction.user}!\n\n` +
            `**🎮 Nick do Jogo:** \`${nickDoJogo}\`\n` +
            `**👤 Nome no Discord:** ${member.user.tag}\n` +
            `${nicknameAlterado ? '✅ Seu nickname foi atualizado automaticamente!\n' : ''}` +
            `\n*Bem-vindo à guilda!*`
          )
          .setColor(0x57F287)
          .setTimestamp();

        await member.send({ embeds: [dmEmbed] });
      } catch (dmError) {
        console.log(`[REGISTRO] Não foi possível enviar DM para ${member.user.tag}`);
      }

      await interaction.reply({ 
        content: `✅ Registro de <@${userId}> (${nickDoJogo}) aprovado!${nicknameAlterado ? ' (Nickname alterado)' : ''}`, 
        ephemeral: true 
      });

    } catch (error) {
      console.error('[REGISTRO] Erro na aprovação:', error);
      await interaction.reply({ 
        content: '❌ Erro ao aprovar registro: ' + error.message, 
        ephemeral: true 
      });
    }
  }

  static async handleRejection(interaction, customId) {
    const userId = customId.replace('recusar_', '');
    
    const isRecrutador = interaction.member.roles.cache.some(r => r.name === 'Recrutador');
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    
    if (!isRecrutador && !isADM) {
      return interaction.reply({ 
        content: '❌ Apenas Recrutadores ou ADMs podem recusar registros!', 
        ephemeral: true 
      });
    }

    try {
      const message = interaction.message;
      const embedOriginal = message.embeds[0];
      const fields = embedOriginal.data.fields || [];
      const nicknameField = fields.find(f => f.name.includes('Nickname'));
      const nickDoJogo = nicknameField ? nicknameField.value.replace(/`/g, '').trim() : 'Desconhecido';

      const member = await interaction.guild.members.fetch(userId).catch(() => null);

      const embedRecusado = new EmbedBuilder()
        .setTitle('❌ REGISTRO RECUSADO')
        .setDescription(`Recusado por ${interaction.user}`)
        .setColor(0xED4245)
        .addFields(
          { name: '👤 Usuário', value: `<@${userId}>`, inline: true },
          { name: '🎮 Nick do Jogo', value: `\`${nickDoJogo}\``, inline: true },
          { name: '📅 Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setTimestamp();

      await message.edit({ 
        embeds: [embedRecusado], 
        components: [] 
      });

      if (member) {
        try {
          await member.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('❌ **REGISTRO RECUSADO**')
                .setDescription('> Seu registro foi analisado e recusado.\n> Entre em contato com um recrutador para mais informações.')
                .setColor(0xED4245)
                .setTimestamp()
            ]
          });
        } catch {}
      }

      await interaction.reply({ 
        content: `❌ Registro de <@${userId}> recusado.`, 
        ephemeral: true 
      });

    } catch (error) {
      console.error('[REGISTRO] Erro na recusa:', error);
      await interaction.reply({ 
        content: '❌ Erro ao recusar registro.', 
        ephemeral: true 
      });
    }
  }
}

module.exports = RegistrationActions;
