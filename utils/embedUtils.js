const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const path = require('path');

class EmbedUtils {
  // Cores modernas
  static colors = {
    primary: 0x5865F2,
    success: 0x57F287,
    danger: 0xED4245,
    warning: 0xFEE75C,
    info: 0x5865F2,
    dark: 0x2C2F33,
    gold: 0xF1C40F,
    event: 0xE74C3C
  };

  // 🆕 MÉTODO PARA CRIAR O PAINEL COM ANEXO
  static createRegistrationPanelWithAttachment() {
    // Criar o embed SEM a imagem primeiro
    const embed = new EmbedBuilder()
      .setTitle('🎮 **REGISTRO DE MEMBRO**')
      .setDescription(
        '> Bem-vindo ao processo de recrutamento da guilda!\n\n' +
        '**📋 Requisitos:**\n' +
        '• Ser ativo no Albion Online\n' +
        '• Ter espírito de equipe\n' +
        '• Participar de eventos guild\n\n' +
        '**📝 Informações necessárias:**\n' +
        '```yaml\n' +
        'Nickname: Seu nome no jogo\n' +
        'Guilda: Atual ou antiga\n' +
        'Plataforma: Mobile ou PC\n' +
        'Arma/Spec: Sua especialização\n' +
        'Print: Link da foto dos atributos (OPCIONAL)\n' +
        '```\n\n' +
        '📸 **Como enviar prints?**\n' +
        '• Upload sua imagem em: https://imgur.com/upload\n' +
        '• Ou use: https://prnt.sc/ (Lightshot)\n' +
        '• Ou: https://postimages.org/\n\n' +
        '*Clique no botão abaixo para iniciar seu registro*'
      )
      .setColor(this.colors.primary)
      .setImage('attachment://recrutamento.png') // 🆕 USA ATTACHMENT
      .setThumbnail('https://i.imgur.com/JRX6b0G.png')
      .setFooter({
        text: 'Sistema de Recrutamento • Albion Guild',
        iconURL: 'https://i.imgur.com/JRX6b0G.png'
      })
      .setTimestamp();

    // Criar o anexo do arquivo local
    const attachment = new AttachmentBuilder(path.join(__dirname, '..', 'png', 'recrutamento.png'));

    return { embed, attachment };
  }

  // Método antigo mantido para compatibilidade (sem imagem)
  static createRegistrationPanel() {
    return new EmbedBuilder()
      .setTitle('🎮 **REGISTRO DE MEMBRO**')
      .setDescription(
        '> Bem-vindo ao processo de recrutamento da guilda!\n\n' +
        '**📋 Requisitos:**\n' +
        '• Ser ativo no Albion Online\n' +
        '• Ter espírito de equipe\n' +
        '• Participar de eventos guild\n\n' +
        '**📝 Informações necessárias:**\n' +
        '```yaml\n' +
        'Nickname: Seu nome no jogo\n' +
        'Guilda: Atual ou antiga\n' +
        'Plataforma: Mobile ou PC\n' +
        'Arma/Spec: Sua especialização\n' +
        'Print: Link da foto dos atributos (OPCIONAL)\n' +
        '```\n\n' +
        '📸 **Como enviar prints?**\n' +
        '• Upload sua imagem em: https://imgur.com/upload\n' +
        '• Ou use: https://prnt.sc/ (Lightshot)\n' +
        '• Ou: https://postimages.org/\n\n' +
        '*Clique no botão abaixo para iniciar seu registro*'
      )
      .setColor(this.colors.primary)
      .setThumbnail('https://i.imgur.com/JRX6b0G.png')
      .setFooter({
        text: 'Sistema de Recrutamento • Albion Guild',
        iconURL: 'https://i.imgur.com/JRX6b0G.png'
      })
      .setTimestamp();
  }

  static createRegisterButton() {
    return new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('iniciar_registro')
          .setLabel('🚀 Iniciar Registro')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📝')
      );
  }

  static createStaffRequestEmbed(userData, member) {
    const embed = new EmbedBuilder()
      .setTitle('🎯 **NOVA SOLICITAÇÃO DE REGISTRO**')
      .setDescription(`Solicitação recebida de ${member}`)
      .setColor(this.colors.warning)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        {
          name: '👤 **Nickname**',
          value: `\`\`\`${userData.nickname}\`\`\``,
          inline: true
        },
        {
          name: '🏰 **Guilda Atual/Antiga**',
          value: `\`\`\`${userData.guilda}\`\`\``,
          inline: true
        },
        {
          name: '💻 **Plataforma**',
          value: `\`\`\`${userData.plataforma}\`\`\``,
          inline: true
        },
        {
          name: '⚔️ **Arma/Spec Principal**',
          value: `\`\`\`${userData.arma}\`\`\``,
          inline: false
        },
        {
          name: '📊 **Print dos Atributos**',
          value: userData.printLink !== 'Não fornecido'
            ? `[Clique para ver](${userData.printLink})`
            : '*Não fornecido*',
          inline: false
        },
        {
          name: '🆔 **ID do Usuário**',
          value: `\`${member.id}\``,
          inline: true
        },
        {
          name: '📅 **Data**',
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true
        }
      )
      .setFooter({
        text: 'Aguardando aprovação da staff',
        iconURL: 'https://i.imgur.com/8N1WvGK.png'
      })
      .setTimestamp();

    return embed;
  }

  static createApprovalButtons(userId) {
    return new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`aprovar_${userId}`)
          .setLabel('Aprovar')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`recusar_${userId}`)
          .setLabel('Recusar')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );
  }

  static createUserConfirmationEmbed(approved, cargoNome = null, motivo = null) {
    if (approved) {
      return new EmbedBuilder()
        .setTitle('✅ **REGISTRO APROVADO!**')
        .setDescription(
          `> Parabéns! Sua solicitação foi **APROVADA**.\n\n` +
          `**🎭 Cargo atribuído:** \`${cargoNome}\`\n\n` +
          `**📋 Próximos passos:**\n` +
          `• Leia as regras do servidor\n` +
          `• Apresente-se no canal adequado\n` +
          `• Aguarde instruções dos Callers\n\n` +
          `*Bem-vindo à guilda! ⚔️*`
        )
        .setColor(this.colors.success)
        .setThumbnail('https://i.imgur.com/57FMAF7.png')
        .setFooter({ text: 'Sistema de Recrutamento • Albion Guild' })
        .setTimestamp();
    } else {
      return new EmbedBuilder()
        .setTitle('❌ **REGISTRO RECUSADO**')
        .setDescription(
          `> Infelizmente sua solicitação foi **RECUSADA**.\n\n` +
          `${motivo ? `**Motivo:** ${motivo}\n\n` : ''}` +
          `*Você pode tentar novamente em 7 dias ou entrar em contato com um Recrutador para mais informações.*`
        )
        .setColor(this.colors.danger)
        .setFooter({ text: 'Sistema de Recrutamento • Albion Guild' })
        .setTimestamp();
    }
  }

  static createEventPanelEmbed() {
    return new EmbedBuilder()
      .setTitle('⚔️ **CENTRAL DE EVENTOS**')
      .setDescription(
        '> Bem-vindo à central de criação de eventos!\n\n' +
        '**🎯 Tipos de Eventos:**\n' +
        '```yaml\n' +
        'Criar Evento: Evento personalizado\n' +
        'Raid Avalon: Dungeon endgame PvE\n' +
        'GANK: Caçada PvP em grupo\n' +
        'Baú Dourado: Conteúdo PvP massivo\n' +
        '```\n\n' +
        '*Selecione um tipo abaixo para criar*'
      )
      .setColor(this.colors.event)
      .setThumbnail('https://i.imgur.com/8N1WvGK.png')
      .setFooter({ text: 'Sistema de Eventos • Albion Guild' })
      .setTimestamp();
  }

  static createEventPanelButtons() {
    return [
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('criar_evento_custom')
            .setLabel('✨ Criar Evento')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⚔️'),
          new ButtonBuilder()
            .setCustomId('criar_raid_avalon')
            .setLabel('🏰 Raid Avalon')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🐉'),
          new ButtonBuilder()
            .setCustomId('criar_gank')
            .setLabel('🔪 GANK')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('⚔️'),
          new ButtonBuilder()
            .setCustomId('criar_bau_dourado')
            .setLabel('💰 Baú Dourado')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🏆')
        )
    ];
  }
}

module.exports = EmbedUtils;
