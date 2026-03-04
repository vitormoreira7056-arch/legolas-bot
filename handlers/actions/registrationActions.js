const { EmbedBuilder } = require('discord.js');
const EmbedUtils = require('../../utils/embedUtils');
const MemberListHandler = require('../memberListHandler');
const ModalHandler = require('../modalHandler');

class RegistrationActions {
  static async handleIniciarRegistro(interaction) {
    const modal = ModalHandler.createRegistrationModal();
    await interaction.showModal(modal);
  }

  static async handleApproval(interaction, customId) {
    const member = interaction.member;
    const isRecrutador = member.roles.cache.some(r => r.name === 'Recrutador');
    const isADM = member.roles.cache.some(r => r.name === 'ADM');

    if (!isRecrutador && !isADM) {
      return interaction.reply({
        content: '❌ Você não tem permissão para aprovar registros!',
        ephemeral: true
      });
    }

    const parts = customId.split('_');
    const tipo = parts[1];
    const userId = parts[2];

    const cargoMap = {
      'notag': 'NOTAG',
      'evento': 'Member Evento',
      'alianca': 'ALIANÇA'
    };

    const cargoNome = cargoMap[tipo];
    const guild = interaction.guild;
    const targetMember = await guild.members.fetch(userId).catch(() => null);

    if (!targetMember) {
      return interaction.reply({
        content: '❌ Usuário não encontrado no servidor!',
        ephemeral: true
      });
    }

    try {
      const role = guild.roles.cache.find(r => r.name === cargoNome);
      if (!role) {
        return interaction.reply({
          content: `❌ Cargo ${cargoNome} não encontrado!`,
          ephemeral: true
        });
      }

      await targetMember.roles.add(role);

      // Alterar nickname - com tratamento de erro melhorado
      try {
        const embed = interaction.message.embeds[0];
        let nicknameJogo = null;

        if (embed && embed.fields) {
          const nicknameField = embed.fields.find(f => f.name.includes('Nickname'));
          if (nicknameField) {
            nicknameJogo = nicknameField.value.replace(/```/g, '').trim();
          }
        }

        if (nicknameJogo && nicknameJogo.length > 0 && nicknameJogo !== 'Não informado') {
          // 🆕 VERIFICAÇÃO: Verificar se o bot pode alterar o nickname (hierarquia de cargos)
          const botMember = guild.members.cache.get(interaction.client.user.id);
          if (botMember.roles.highest.position > targetMember.roles.highest.position) {
            await targetMember.setNickname(nicknameJogo);
            console.log(`✅ Nickname de ${targetMember.user.tag} alterado para: ${nicknameJogo}`);
          } else {
            console.log(`⚠️ Não foi possível alterar nickname de ${targetMember.user.tag}: cargo do bot é inferior`);
          }
        }
      } catch (nickError) {
        // Silenciar erro de nickname - não é crítico
        console.log(`ℹ️ Nickname não alterado para ${targetMember.user.tag}: ${nickError.message}`);
      }

      const embedAprovado = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(EmbedUtils.colors.success)
        .setTitle('✅ **SOLICITAÇÃO APROVADA**')
        .setDescription(`Aprovado por ${interaction.user} como **${cargoNome}**`)
        .setFooter({ text: `Aprovado em: ${new Date().toLocaleString('pt-BR')}` });

      await interaction.update({
        embeds: [embedAprovado],
        components: []
      });

      await MemberListHandler.updateList(guild);

      const dmEmbed = EmbedUtils.createUserConfirmationEmbed(true, cargoNome);
      await targetMember.send({ embeds: [dmEmbed] }).catch(() => {
        interaction.followUp({
          content: `⚠️ Não foi possível enviar DM para ${targetMember}. Aprovação realizada com sucesso!`,
          ephemeral: true
        });
      });

    } catch (error) {
      console.error('Erro na aprovação:', error);
      interaction.reply({
        content: '❌ Erro ao aprovar registro!',
        ephemeral: true
      });
    }
  }

  static async handleRejection(interaction, customId) {
    const member = interaction.member;
    const isRecrutador = member.roles.cache.some(r => r.name === 'Recrutador');
    const isADM = member.roles.cache.some(r => r.name === 'ADM');

    if (!isRecrutador && !isADM) {
      return interaction.reply({
        content: '❌ Você não tem permissão para recusar registros!',
        ephemeral: true
      });
    }

    const userId = customId.split('_')[1];
    const guild = interaction.guild;
    const targetMember = await guild.members.fetch(userId).catch(() => null);

    if (!targetMember) {
      return interaction.reply({
        content: '❌ Usuário não encontrado!',
        ephemeral: true
      });
    }

    try {
      const embedRecusado = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(EmbedUtils.colors.danger)
        .setTitle('❌ **SOLICITAÇÃO RECUSADA**')
        .setDescription(`Recusado por ${interaction.user}`)
        .setFooter({ text: `Recusado em: ${new Date().toLocaleString('pt-BR')}` });

      await interaction.update({
        embeds: [embedRecusado],
        components: []
      });

      const dmEmbed = EmbedUtils.createUserConfirmationEmbed(false);
      await targetMember.send({ embeds: [dmEmbed] }).catch(() => {
        interaction.followUp({
          content: `⚠️ Não foi possível enviar DM para ${targetMember}. Recusa registrada!`,
          ephemeral: true
        });
      });

    } catch (error) {
      console.error('Erro na recusa:', error);
      interaction.reply({
        content: '❌ Erro ao recusar registro!',
        ephemeral: true
      });
    }
  }
}

module.exports = RegistrationActions;