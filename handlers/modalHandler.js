const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const EmbedUtils = require('../utils/embedUtils');
const EventHandler = require('./eventHandler');
const ConfigHandler = require('./configHandler');
const LootSplitHandler = require('./lootSplitHandler');
const BankHandler = require('./bank');
const db = require('../utils/database');

class ModalHandler {
  static createRegistrationModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_registro')
      .setTitle('📝 Formulário de Registro');

    const nicknameInput = new TextInputBuilder()
      .setCustomId('reg_nickname')
      .setLabel('🎮 Seu Nickname no Albion')
      .setPlaceholder('Ex: TTV_SeuNome')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(32);

    const guildaInput = new TextInputBuilder()
      .setCustomId('reg_guilda')
      .setLabel('🏰 Guilda Atual ou Antiga')
      .setPlaceholder('Ex: Guilda Atual: Nenhuma | Antiga: OldGuild')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const plataformaInput = new TextInputBuilder()
      .setCustomId('reg_plataforma')
      .setLabel('💻 Mobile ou PC?')
      .setPlaceholder('Ex: PC (Steam)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const armaInput = new TextInputBuilder()
      .setCustomId('reg_arma')
      .setLabel('⚔️ Arma que mais joga / Spec')
      .setPlaceholder('Ex: Arco 700/700, Frost 600/700...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(200);

    const printInput = new TextInputBuilder()
      .setCustomId('reg_print')
      .setLabel('📊 Link do Print dos Atributos (Opcional)')
      .setPlaceholder('Use: imgur.com/upload | prnt.sc | postimages.org')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(200);

    const row1 = new ActionRowBuilder().addComponents(nicknameInput);
    const row2 = new ActionRowBuilder().addComponents(guildaInput);
    const row3 = new ActionRowBuilder().addComponents(plataformaInput);
    const row4 = new ActionRowBuilder().addComponents(armaInput);
    const row5 = new ActionRowBuilder().addComponents(printInput);

    modal.addComponents(row1, row2, row3, row4, row5);
    return modal;
  }

  static createVenderLootModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_vender_loot')
      .setTitle('💰 Vender Loot/Baú');

    const localInput = new TextInputBuilder()
      .setCustomId('venda_local')
      .setLabel('📍 Local (brecilien/royal/ho_ava/ho_black)')
      .setPlaceholder('Ex: brecilien')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(20);

    const valorInput = new TextInputBuilder()
      .setCustomId('venda_valor')
      .setLabel('💎 Valor Total do Baú')
      .setPlaceholder('Ex: 5000000')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(12);

    const printInput = new TextInputBuilder()
      .setCustomId('venda_print')
      .setLabel('📸 Link do Print do Baú (imgur, prnt.sc, etc)')
      .setPlaceholder('imgur.com/upload | prnt.sc | postimages.org')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(200);

    return modal.addComponents(
      new ActionRowBuilder().addComponents(localInput),
      new ActionRowBuilder().addComponents(valorInput),
      new ActionRowBuilder().addComponents(printInput)
    );
  }

  static async processModalSubmit(interaction, client) {
    if (interaction.customId === 'modal_registro') {
      return await this.processRegistration(interaction);
    }

    if (interaction.customId === 'modal_vender_loot') {
      return await this.processVenderLoot(interaction);
    }

    if (interaction.customId === 'modal_evento_custom') {
      return await this.processCustomEvent(interaction);
    }

    if (interaction.customId.startsWith('modal_evento_')) {
      const tipo = interaction.customId.replace('modal_evento_', '');
      return await this.processPresetEvent(interaction, tipo);
    }

    if (interaction.customId.startsWith('modal_simulate_')) {
      const eventId = interaction.customId.replace('modal_simulate_', '');
      await LootSplitHandler.processSimulation(interaction, eventId);
      return true;
    }

    if (interaction.customId.startsWith('modal_update_participation_')) {
      const eventId = interaction.customId.replace('modal_update_participation_', '');
      await LootSplitHandler.processUpdateParticipation(interaction, eventId);
      return true;
    }

    if (interaction.customId === 'modal_config_taxa') {
      await ConfigHandler.processTaxaConfig(interaction, interaction.guild.id);
      return true;
    }

    if (interaction.customId === 'modal_config_taxas_bau') {
      await ConfigHandler.processTaxasBauConfig(interaction, interaction.guild.id);
      return true;
    }

    if (interaction.customId === 'modal_sacar_saldo') {
      return await this.processSacarSaldo(interaction);
    }

    if (interaction.customId === 'modal_transferir_saldo') {
      return await this.processTransferirSaldo(interaction);
    }

    return false;
  }

  static async processVenderLoot(interaction) {
    try {
      const local = interaction.fields.getTextInputValue('venda_local').toLowerCase().trim();
      const valor = parseInt(interaction.fields.getTextInputValue('venda_valor'));
      const printLink = interaction.fields.getTextInputValue('venda_print') || null;

      const locaisValidos = ['brecilien', 'royal', 'ho_ava', 'ho_black'];
      if (!locaisValidos.includes(local)) {
        return interaction.reply({
          content: '❌ Local inválido! Use: brecilien, royal, ho_ava ou ho_black',
          ephemeral: true
        });
      }

      if (isNaN(valor) || valor <= 0) {
        return interaction.reply({
          content: '❌ Valor inválido! Digite um número maior que 0.',
          ephemeral: true
        });
      }

      const config = ConfigHandler.getConfig(interaction.guild.id);
      const taxaPercentual = config.taxasBau[local] || 0;
      const valorTaxa = Math.floor(valor * (taxaPercentual / 100));
      const valorLiquido = valor - valorTaxa;

      const localNomes = {
        'brecilien': 'Brecilien',
        'royal': 'Royal',
        'ho_ava': 'HO Ava',
        'ho_black': 'HO Black'
      };

      const vendaId = `venda_${Date.now()}_${interaction.user.id}`;

      const embedFinanceiro = new EmbedBuilder()
        .setTitle('💰 **SOLICITAÇÃO DE VENDA DE BAÚ**')
        .setDescription(`Nova solicitação de venda recebida`)
        .setColor(0xF39C12)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤 **Vendedor**', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
          { name: '📍 **Local**', value: `${localNomes[local]}`, inline: true },
          { name: '💰 **Valor do Baú**', value: `🪙 ${valor.toLocaleString()}`, inline: true },
          { name: '💸 **Taxa da Guilda**', value: `${taxaPercentual}% (🪙 ${valorTaxa.toLocaleString()})`, inline: true },
          { name: '💵 **Valor Líquido**', value: `🪙 ${valorLiquido.toLocaleString()}`, inline: true },
          { name: '📅 **Data**', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        );

      if (printLink) {
        embedFinanceiro.addFields({
          name: '📸 **Print do Baú**',
          value: `[Clique para ver](${printLink})`,
          inline: false
        });
      }

      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
      const buttons = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`aprovar_venda_${vendaId}`)
            .setLabel('✅ Aprovar Compra')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`recusar_venda_${vendaId}`)
            .setLabel('❌ Recusar')
            .setStyle(ButtonStyle.Danger)
        );

      const financeiroChannel = interaction.guild.channels.cache.find(c => c.name === '📊╠financeiro');

      if (!financeiroChannel) {
        return interaction.reply({
          content: '❌ Canal financeiro não encontrado! Contate um ADM.',
          ephemeral: true
        });
      }

      const msgFinanceiro = await financeiroChannel.send({
        content: `🔔 <@&${interaction.guild.roles.cache.find(r => r.name === 'ADM')?.id}> Nova solicitação de venda de baú!`,
        embeds: [embedFinanceiro],
        components: [buttons]
      });

      global.vendasPendentes = global.vendasPendentes || new Map();
      global.vendasPendentes.set(vendaId, {
        userId: interaction.user.id,
        valor: valor,
        valorLiquido: valorLiquido,
        taxa: taxaPercentual,
        local: localNomes[local],
        messageId: msgFinanceiro.id,
        channelId: financeiroChannel.id,
        printLink: printLink
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('⏳ **VENDA SOLICITADA**')
            .setDescription(
              `> Sua solicitação de venda foi enviada para análise!\n\n` +
              `**📍 Local:** ${localNomes[local]}\n` +
              `**💰 Valor do Baú:** 🪙 ${valor.toLocaleString()}\n` +
              `**💸 Taxa (${taxaPercentual}%):** 🪙 ${valorTaxa.toLocaleString()}\n` +
              `**💵 Valor Líquido a Receber:** 🪙 ${valorLiquido.toLocaleString()}\n\n` +
              `${printLink ? '**📸 Print enviado:** Sim\n' : '**📸 Print:** Não enviado\n'}` +
              `*Aguarde a aprovação de um ADM.*`
            )
            .setColor(0xF39C12)
            .setTimestamp()
        ],
        ephemeral: true
      });

      return true;

    } catch (error) {
      console.error('Erro ao processar venda:', error);
      await interaction.reply({
        content: '❌ Erro ao processar solicitação de venda. Tente novamente.',
        ephemeral: true
      });
      return true;
    }
  }

  static async processRegistration(interaction) {
    const userData = {
      nickname: interaction.fields.getTextInputValue('reg_nickname'),
      guilda: interaction.fields.getTextInputValue('reg_guilda'),
      plataforma: interaction.fields.getTextInputValue('reg_plataforma'),
      arma: interaction.fields.getTextInputValue('reg_arma'),
      printLink: interaction.fields.getTextInputValue('reg_print') || 'Não fornecido'
    };

    try {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('⏳ **REGISTRO ENVIADO!**')
            .setDescription(
              '> Seu formulário foi enviado para análise!\n\n' +
              '**📋 Resumo:**\n' +
              `• Nickname: \`${userData.nickname}\`\n` +
              `• Plataforma: \`${userData.plataforma}\`\n\n` +
              '*Você receberá uma mensagem na DM quando for analisado.*'
            )
            .setColor(EmbedUtils.colors.info)
            .setFooter({ text: 'Aguarde a aprovação da staff' })
        ],
        ephemeral: true
      });

      const guild = interaction.guild;
      const solicitacaoChannel = guild.channels.cache.find(
        ch => ch.name === '📨╠solicitação-registro'
      );

      if (!solicitacaoChannel) {
        console.error('Canal de solicitação não encontrado!');
        return true;
      }

      const embed = EmbedUtils.createStaffRequestEmbed(userData, interaction.member);
      const buttons = EmbedUtils.createApprovalButtons(interaction.user.id);

      await solicitacaoChannel.send({
        content: `📢 <@&${guild.roles.cache.find(r => r.name === 'Recrutador')?.id}> <@&${guild.roles.cache.find(r => r.name === 'ADM')?.id}> Nova solicitação!`,
        embeds: [embed],
        components: [buttons]
      });

      return true;
    } catch (error) {
      console.error('Erro ao processar modal:', error);
      await interaction.reply({
        content: '❌ Erro ao enviar registro. Tente novamente!',
        ephemeral: true
      });
      return true;
    }
  }

  static async processCustomEvent(interaction) {
    const eventData = {
      tipo: 'custom',
      nome: interaction.fields.getTextInputValue('evt_nome'),
      descricao: interaction.fields.getTextInputValue('evt_desc'),
      requisitos: interaction.fields.getTextInputValue('evt_req') || null,
      horario: interaction.fields.getTextInputValue('evt_horario'),
      vagas: null
    };

    try {
      await interaction.deferReply({ ephemeral: true });
      const result = await EventHandler.createEvent(interaction, eventData);

      await interaction.editReply({
        content: `✅ Evento **${eventData.nome}** criado com sucesso!\n📢 Canal de voz: <#${result.voiceChannel.id}>`
      });
      return true;
    } catch (error) {
      console.error('Erro ao criar evento:', error);
      await interaction.editReply({
        content: `❌ Erro ao criar evento: ${error.message}`
      });
      return true;
    }
  }

  static async processPresetEvent(interaction, tipo) {
    const vagasRaw = interaction.fields.getTextInputValue('evt_vagas');
    const vagas = vagasRaw ? parseInt(vagasRaw) : null;

    const eventData = {
      tipo: tipo,
      nome: EventHandler.getEventTypeName(tipo),
      descricao: interaction.fields.getTextInputValue('evt_desc') || `Evento ${EventHandler.getEventTypeName(tipo)}`,
      requisitos: interaction.fields.getTextInputValue('evt_req') || null,
      horario: interaction.fields.getTextInputValue('evt_horario'),
      vagas: vagas && !isNaN(vagas) ? vagas : null
    };

    try {
      await interaction.deferReply({ ephemeral: true });
      const result = await EventHandler.createEvent(interaction, eventData);

      await interaction.editReply({
        content: `✅ **${eventData.nome}** criado!\n🔊 Canal: <#${result.voiceChannel.id}>`
      });
      return true;
    } catch (error) {
      console.error('Erro ao criar evento:', error);
      await interaction.editReply({
        content: `❌ Erro: ${error.message}`
      });
      return true;
    }
  }

  static async processSacarSaldo(interaction) {
    const valorInput = interaction.fields.getTextInputValue('saque_valor');
    const valor = parseInt(valorInput);

    if (isNaN(valor) || valor <= 0) {
      return interaction.reply({
        content: '❌ O valor deve ser um número maior que 0!',
        ephemeral: true
      });
    }

    await BankHandler.requestWithdrawal(interaction, valor);
  }

  static async processTransferirSaldo(interaction) {
    const targetInput = interaction.fields.getTextInputValue('transfer_user');
    const valorInput = interaction.fields.getTextInputValue('transfer_valor');
    const valor = parseInt(valorInput);

    if (isNaN(valor) || valor <= 0) {
      return interaction.reply({
        content: '❌ Valor inválido!',
        ephemeral: true
      });
    }

    let targetId = targetInput.replace(/[<@!>]/g, '');

    if (!/^\d{17,19}$/.test(targetId)) {
      return interaction.reply({
        content: '❌ ID de usuário inválido! Use @menção ou ID numérico.',
        ephemeral: true
      });
    }

    if (targetId === interaction.user.id) {
      return interaction.reply({
        content: '❌ Você não pode transferir para si mesmo!',
        ephemeral: true
      });
    }

    const remetente = db.getUser(interaction.user.id);

    if (remetente.saldo < valor) {
      return interaction.reply({
        content: `❌ Saldo insuficiente!\n💰 Seu saldo: 🪙 ${remetente.saldo.toLocaleString()}\n💸 Valor a transferir: 🪙 ${valor.toLocaleString()}`,
        ephemeral: true
      });
    }

    const transferId = `transfer_${Date.now()}_${interaction.user.id}_${targetId}`;

    global.transferenciasPendentes = global.transferenciasPendentes || new Map();
    global.transferenciasPendentes.set(transferId, {
      id: transferId,
      remetenteId: interaction.user.id,
      destinatarioId: targetId,
      valor: valor,
      status: 'pendente',
      timestamp: Date.now()
    });

    const embedConfirmacao = new EmbedBuilder()
      .setTitle('💱 **NOVA TRANSFERÊNCIA RECEBIDA**')
      .setDescription(
        `> Você recebeu uma solicitação de transferência!\n\n` +
        `**👤 De:** ${interaction.user}\n` +
        `**💰 Valor:** 🪙 ${valor.toLocaleString()}\n` +
        `**📅 Data:** <t:${Math.floor(Date.now() / 1000)}:F>\n\n` +
        `*Aceite ou recuse a transferência abaixo:*`
      )
      .setColor(0xF1C40F)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    const botoesConfirmacao = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`confirmar_transferencia_${transferId}`)
          .setLabel('✅ Aceitar Transferência')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`recusar_transferencia_${transferId}`)
          .setLabel('❌ Recusar')
          .setStyle(ButtonStyle.Danger)
      );

    try {
      const targetUser = await interaction.client.users.fetch(targetId);
      await targetUser.send({
        embeds: [embedConfirmacao],
        components: [botoesConfirmacao]
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('⏳ **TRANSFERÊNCIA ENVIADA**')
            .setDescription(
              `> Solicitação de transferência enviada!\n\n` +
              `**👤 Para:** <@${targetId}>\n` +
              `**💰 Valor:** 🪙 ${valor.toLocaleString()}\n` +
              `**📊 Seu Saldo Atual:** 🪙 ${remetente.saldo.toLocaleString()}\n\n` +
              `*Aguardando confirmação do destinatário...*\n` +
              `*O valor será debitado apenas após a confirmação.*`
            )
            .setColor(0xF39C12)
            .setTimestamp()
        ],
        ephemeral: true
      });
    } catch (error) {
      global.transferenciasPendentes.delete(transferId);
      await interaction.reply({
        content: `❌ Não foi possível enviar a solicitação para <@${targetId}>.\nVerifique se o usuário tem DMs abertas!`,
        ephemeral: true
      });
    }
  }
}

module.exports = ModalHandler;
