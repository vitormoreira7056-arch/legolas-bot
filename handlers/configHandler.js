const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

// Configurações globais do bot (em memória - usar banco em produção)
const guildConfig = new Map();

class ConfigHandler {
  static colors = {
    config: 0x9B59B6,
    success: 0x2ECC71,
    info: 0x3498DB
  };

  static getConfig(guildId) {
    if (!guildConfig.has(guildId)) {
      guildConfig.set(guildId, {
        taxaGuilda: 0,
        taxasBau: {
          brecilien: 10,
          royal: 5,
          ho_ava: 15,
          ho_black: 15
        },
        sistemaXP: false,
        ultimaAtualizacao: new Date()
      });
    }
    return guildConfig.get(guildId);
  }

  static updateConfig(guildId, data) {
    const config = this.getConfig(guildId);
    Object.assign(config, data, { ultimaAtualizacao: new Date() });
    guildConfig.set(guildId, config);
    return config;
  }

  static createConfigPanelEmbed(guildId) {
    const config = this.getConfig(guildId);

    return new EmbedBuilder()
      .setTitle('⚙️ **PAINEL DE CONFIGURAÇÕES**')
      .setDescription(
        '> Configure as opções do bot para sua guilda\n\n' +
        '**📊 Configurações Atuais:**\n' +
        '```yaml\n' +
        `Taxa da Guilda: ${config.taxaGuilda}%\n` +
        `Sistema de XP: ${config.sistemaXP ? 'ATIVADO ✅' : 'DESATIVADO ❌'}\n` +
        `Última atualização: ${config.ultimaAtualizacao.toLocaleString('pt-BR')}\n` +
        '```\n\n' +
        '**💰 Taxas de Venda de Baú:**\n' +
        '```yaml\n' +
        `Brecilien: ${config.taxasBau?.brecilien || 10}%\n` +
        `Royal: ${config.taxasBau?.royal || 5}%\n` +
        `HO Ava: ${config.taxasBau?.ho_ava || 15}%\n` +
        `HO Black: ${config.taxasBau?.ho_black || 15}%\n` +
        '```'
      )
      .setColor(this.colors.config)
      .setThumbnail('https://i.imgur.com/JRX6b0G.png')
      .setFooter({ text: 'Apenas ADMs podem alterar configurações' })
      .setTimestamp();
  }

  static createConfigButtons() {
    return [
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('config_taxa_guilda')
            .setLabel('💰 Taxa Guilda')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💸'),
          new ButtonBuilder()
            .setCustomId('config_taxas_bau')
            .setLabel('💎 Taxas de Baú')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💰'),
          new ButtonBuilder()
            .setCustomId('config_sistema_xp')
            .setLabel('✨ Sistema XP')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📊')
        ),
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('atualizar_bot')
            .setLabel('🔄 Atualizar Bot')
            .setStyle(ButtonStyle.Success)
            .setEmoji('⚡'),
          new ButtonBuilder()
            .setCustomId('config_ver_atual')
            .setLabel('👁️ Ver Atual')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📋')
        )
    ];
  }

  static createTaxaModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_config_taxa')
      .setTitle('💰 Configurar Taxa da Guilda');

    const taxaInput = new TextInputBuilder()
      .setCustomId('taxa_valor')
      .setLabel('Taxa em % (0 a 100)')
      .setPlaceholder('Ex: 10, 15, 20...')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(3);

    return modal.addComponents(
      new ActionRowBuilder().addComponents(taxaInput)
    );
  }

  static createTaxasBauModal(config) {
    const modal = new ModalBuilder()
      .setCustomId('modal_config_taxas_bau')
      .setTitle('💎 Configurar Taxas de Baú');

    const brecilienInput = new TextInputBuilder()
      .setCustomId('taxa_brecilien')
      .setLabel('Brecilien (%)')
      .setPlaceholder('Ex: 10')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(3)
      .setValue(String(config.taxasBau?.brecilien || 10));

    const royalInput = new TextInputBuilder()
      .setCustomId('taxa_royal')
      .setLabel('Royal (%)')
      .setPlaceholder('Ex: 5')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(3)
      .setValue(String(config.taxasBau?.royal || 5));

    const hoAvaInput = new TextInputBuilder()
      .setCustomId('taxa_ho_ava')
      .setLabel('HO Ava (%)')
      .setPlaceholder('Ex: 15')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(3)
      .setValue(String(config.taxasBau?.ho_ava || 15));

    const hoBlackInput = new TextInputBuilder()
      .setCustomId('taxa_ho_black')
      .setLabel('HO Black (%)')
      .setPlaceholder('Ex: 15')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(3)
      .setValue(String(config.taxasBau?.ho_black || 15));

    return modal.addComponents(
      new ActionRowBuilder().addComponents(brecilienInput),
      new ActionRowBuilder().addComponents(royalInput),
      new ActionRowBuilder().addComponents(hoAvaInput),
      new ActionRowBuilder().addComponents(hoBlackInput)
    );
  }

  static async processTaxasBauConfig(interaction, guildId) {
    try {
      const brecilien = parseInt(interaction.fields.getTextInputValue('taxa_brecilien'));
      const royal = parseInt(interaction.fields.getTextInputValue('taxa_royal'));
      const hoAva = parseInt(interaction.fields.getTextInputValue('taxa_ho_ava'));
      const hoBlack = parseInt(interaction.fields.getTextInputValue('taxa_ho_black'));

      const taxas = { brecilien, royal, ho_ava: hoAva, ho_black: hoBlack };
      for (const [local, valor] of Object.entries(taxas)) {
        if (isNaN(valor) || valor < 0 || valor > 100) {
          return interaction.reply({
            content: `❌ Taxa inválida para ${local}! Digite um valor entre 0 e 100.`,
            ephemeral: true
          });
        }
      }

      this.updateConfig(guildId, { taxasBau: taxas });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ **TAXAS DE BAÚ ATUALIZADAS**')
            .setDescription(
              '> Taxas de venda de baú configuradas com sucesso!\n\n' +
              '**📍 Novas Taxas:**\n' +
              `• Brecilien: ${brecilien}%\n` +
              `• Royal: ${royal}%\n` +
              `• HO Ava: ${hoAva}%\n` +
              `• HO Black: ${hoBlack}%`
            )
            .setColor(this.colors.success)
            .setTimestamp()
        ],
        ephemeral: true
      });

    } catch (error) {
      console.error('Erro ao processar taxas de baú:', error);
      await interaction.reply({
        content: '❌ Erro ao processar configurações. Verifique os valores numéricos.',
        ephemeral: true
      });
    }
  }

  static createXPEmbed(guildId) {
    const config = this.getConfig(guildId);

    return new EmbedBuilder()
      .setTitle('✨ **CONFIGURAR SISTEMA DE XP**')
      .setDescription(
        `> Sistema de XP atualmente: **${config.sistemaXP ? 'ATIVADO ✅' : 'DESATIVADO ❌'}**\n\n` +
        '**📊 O que é o Sistema de XP?**\n' +
        '• Ganhe XP participando de eventos\n' +
        '• Suba de nível e desbloqueie benefícios\n' +
        '• Ranking de membros mais ativos\n\n' +
        '*Selecione uma opção abaixo:*'
      )
      .setColor(this.colors.info)
      .setFooter({ text: 'Configuração de XP' })
      .setTimestamp();
  }

  static createXPButtons(guildId) {
    const config = this.getConfig(guildId);

    return [
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('xp_ativar')
            .setLabel('Ativar XP')
            .setStyle(config.sistemaXP ? ButtonStyle.Success : ButtonStyle.Primary)
            .setEmoji('✅')
            .setDisabled(config.sistemaXP),
          new ButtonBuilder()
            .setCustomId('xp_desativar')
            .setLabel('Desativar XP')
            .setStyle(!config.sistemaXP ? ButtonStyle.Danger : ButtonStyle.Secondary)
            .setEmoji('❌')
            .setDisabled(!config.sistemaXP)
        ),
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('xp_voltar_config')
            .setLabel('🔙 Voltar')
            .setStyle(ButtonStyle.Secondary)
        )
    ];
  }

  static async processTaxaConfig(interaction, guildId) {
    const taxaInput = interaction.fields.getTextInputValue('taxa_valor');
    const taxa = parseInt(taxaInput);

    if (isNaN(taxa) || taxa < 0 || taxa > 100) {
      return interaction.reply({
        content: '❌ Taxa inválida! Digite um valor entre 0 e 100.',
        ephemeral: true
      });
    }

    this.updateConfig(guildId, { taxaGuilda: taxa });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ **TAXA ATUALIZADA**')
          .setDescription(
            `> Taxa da guilda configurada com sucesso!\n\n` +
            `**💰 Nova taxa:** ${taxa}%\n` +
            `**📊 Exemplo:** Em um evento de 🪙 1.000.000, a guilda retém 🪙 ${Math.floor(1000000 * (taxa/100)).toLocaleString()}`
          )
          .setColor(this.colors.success)
          .setTimestamp()
      ],
      ephemeral: true
    });

    try {
      const mensagem = interaction.message;
      if (mensagem) {
        const novoEmbed = this.createConfigPanelEmbed(guildId);
        await mensagem.edit({ embeds: [novoEmbed] });
      }
    } catch (e) {
      // Ignora se não conseguir atualizar
    }
  }

  static async toggleXP(interaction, guildId, ativar) {
    this.updateConfig(guildId, { sistemaXP: ativar });

    await interaction.update({
      embeds: [this.createXPEmbed(guildId)],
      components: this.createXPButtons(guildId)
    });

    await interaction.followUp({
      content: `✅ Sistema de XP ${ativar ? 'ativado' : 'desativado'} com sucesso!`,
      ephemeral: true
    });
  }

  static createConsultarSaldoEmbed() {
    return new EmbedBuilder()
      .setTitle('🏦 **CONSULTAR SALDO**')
      .setDescription(
        '> Verifique seu saldo bancário\n\n' +
        '**📋 Informações disponíveis:**\n' +
        '• Saldo atual\n' +
        '• Empréstimos pendentes\n' +
        '• Histórico de transações\n' +
        '• Transferências para outros membros\n\n' +
        '*Clique nos botões abaixo para acessar as funções*'
      )
      .setColor(0xF1C40F)
      .setThumbnail('https://i.imgur.com/57FMAF7.png')
      .setFooter({ text: 'Privacidade garantida - DM segura' })
      .setTimestamp();
  }

  static createConsultarSaldoButton() {
    return new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('consultar_saldo_dm')
          .setLabel('📊 Consultar Saldo')
          .setStyle(ButtonStyle.Success)
          .setEmoji('💰'),
        new ButtonBuilder()
          .setCustomId('sacar_saldo')
          .setLabel('💸 Sacar Saldo')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🏧'),
        new ButtonBuilder()
          .setCustomId('transferir_saldo')
          .setLabel('💱 Transferir Saldo')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔄')
      );
  }

  static createSaldoGuildaEmbed(db, config) {
    const saldoTotalGuilda = db.getGuildBalance();
    const taxaAtual = config ? config.taxaGuilda : 0;

    const arrecadacaoTaxas = Math.floor(saldoTotalGuilda * (taxaAtual / 100));

    let dividaTotal = 0;
    for (const user of db.users.values()) {
      dividaTotal += user.emprestimo;
    }

    return new EmbedBuilder()
      .setTitle('🏦 **SALDO DA GUILDA**')
      .setDescription(
        '> Resumo financeiro completo da guilda\n\n' +
        `**⏰ Atualizado:** `
      )
      .setColor(0x2ECC71)
      .setThumbnail('https://i.imgur.com/57FMAF7.png')
      .addFields(
        {
          name: '💰 **Saldo Geral no Bot**',
          value: `🪙 ${saldoTotalGuilda.toLocaleString()}`,
          inline: true
        },
        {
          name: '💸 **Arrecadação (Taxas)**',
          value: `🪙 ${arrecadacaoTaxas.toLocaleString()} (${taxaAtual}%)`,
          inline: true
        },
        {
          name: '💳 **Dívida com Membros**',
          value: `🪙 ${dividaTotal.toLocaleString()}`,
          inline: true
        },
        {
          name: '📊 **Patrimônio Líquido**',
          value: `🪙 ${(saldoTotalGuilda - dividaTotal).toLocaleString()}`,
          inline: false
        }
      )
      .setFooter({ text: 'Atualiza a cada 5 minutos ou após transações' })
      .setTimestamp();
  }
}

module.exports = ConfigHandler;
