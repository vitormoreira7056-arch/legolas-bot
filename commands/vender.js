const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ConfigHandler = require('../handlers/configHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vender')
    .setDescription('Solicita venda de loot/baú para a guilda')
    .addStringOption(option =>
      option.setName('local')
        .setDescription('Local onde está o loot')
        .setRequired(true)
        .addChoices(
          { name: 'Brecilien', value: 'brecilien' },
          { name: 'Royal', value: 'royal' },
          { name: 'HO Ava (Avalon)', value: 'ho_ava' },
          { name: 'HO Black (Cidades Pretas)', value: 'ho_black' }
        )
    )
    .addIntegerOption(option =>
      option.setName('valor')
        .setDescription('Valor total do loot/baú')
        .setRequired(true)
        .setMinValue(1)
    )
    .addAttachmentOption(option =>
      option.setName('print')
        .setDescription('Print do valor do baú (opcional, mas recomendado)')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const local = interaction.options.getString('local');
    const valor = interaction.options.getInteger('valor');
    const print = interaction.options.getAttachment('print');

    const config = ConfigHandler.getConfig(interaction.guild.id);

    // Pegar taxa do local
    const taxas = config.taxasBau || {};
    const taxaPercentual = taxas[local] || 0;
    const valorTaxa = Math.floor(valor * (taxaPercentual / 100));
    const valorLiquido = valor - valorTaxa;

    const localNomes = {
      'brecilien': 'Brecilien',
      'royal': 'Royal',
      'ho_ava': 'HO Ava',
      'ho_black': 'HO Black'
    };

    // Criar embed da solicitação
    const embed = new EmbedBuilder()
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

    // Se tiver print, adicionar no embed (visível apenas para ADMs depois)
    let files = [];
    if (print) {
      embed.addFields({ 
        name: '📸 **Print do Baú**', 
        value: `[Clique para ver](${print.url})`, 
        inline: false 
      });
      // O print será enviado como anexo visível para todos, mas pode ser restrito via permissões do canal
    }

    // Botões de aprovação
    const vendaId = `venda_${Date.now()}_${interaction.user.id}`;

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

    // Enviar para canal financeiro
    const financeiroChannel = interaction.guild.channels.cache.find(c => c.name === '📊╠financeiro');

    if (!financeiroChannel) {
      return interaction.reply({
        content: '❌ Canal financeiro não encontrado! Contate um ADM.',
        ephemeral: true
      });
    }

    // Mensagem no financeiro mencionando ADMs
    const msgFinanceiro = await financeiroChannel.send({
      content: `🔔 <@&${interaction.guild.roles.cache.find(r => r.name === 'ADM')?.id}> Nova solicitação de venda de baú!`,
      embeds: [embed],
      components: [buttons],
      files: print ? [print] : []
    });

    // Responder ao usuário
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
            `*Aguarde a aprovação de um ADM.*`
          )
          .setColor(0xF39C12)
          .setTimestamp()
      ],
      ephemeral: true
    });

    // Guardar dados temporariamente para quando aprovar
    global.vendasPendentes = global.vendasPendentes || new Map();
    global.vendasPendentes.set(vendaId, {
      userId: interaction.user.id,
      valor: valor,
      valorLiquido: valorLiquido,
      taxa: taxaPercentual,
      local: localNomes[local],
      messageId: msgFinanceiro.id,
      channelId: financeiroChannel.id
    });
  }
};
