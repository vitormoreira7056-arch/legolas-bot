const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const EmbedUtils = require('../utils/embedUtils');
const ConfigHandler = require('./configHandler');
const MemberListHandler = require('./memberListHandler');
const EventStatsHandler = require('./eventStatsHandler');

class SetupManager {
  constructor(guild, interaction) {
    this.guild = guild;
    this.interaction = interaction;
    this.createdChannels = [];
    this.createdRoles = {};
    this.existingChannels = [];
    this.existingRoles = {};
    this.roles = {};
  }

  async log(message) {
    console.log(message);
    try {
      if (this.interaction) {
        await this.interaction.editReply({ content: message });
      }
    } catch (e) {}
  }

  // 🆕 NOVO: Verificar se canal já existe
  async checkExistingChannels() {
    // Verificar categorias
    const categorias = [
      '🛡️ RECRUTAMENTO',
      '⚙️ CONFIG',
      '💰 BANCO DA GUILDA',
      '⚔️ EVENTOS ATIVOS',
      '📁 EVENTOS ENCERRADOS',
      '👥 GESTÃO DE MEMBROS',
      '👑 GESTÃO DE GUILDA',
      '🎓 ALBION ACADEMY'
    ];

    for (const catName of categorias) {
      const exists = this.guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === catName
      );
      if (exists) {
        this.existingChannels.push(catName);
      }
    }

    // Verificar canais específicos
    const canais = [
      '📋╠registrar',
      '🎤╠Recrutamento',
      '📅╠agendamentos',
      '🔧╠configurações',
      '➕╠criar-evento',
      '👋╠participar',
      '🔍╠consultar-saldo',
      '💰╠venda-de-baú',
      '📊╠financeiro',
      '💵╠depósitos',
      '📜╠logs-banco',
      '🔊╠Aguardando-Evento',
      '📨╠solicitação-registro',
      '🚪╠saída-membros',
      '📋╠lista-membros',
      '📊╠painel-de-eventos',
      '🏦╠saldo-guilda',
      '👤╠perfil',
      '⭐╠xp-event',
      '📜╠log-xp',
      '🔮╠orb-xp',
      '📊╠painel-xp'
    ];

    for (const canalName of canais) {
      const exists = this.guild.channels.cache.find(c => c.name === canalName);
      if (exists) {
        this.existingChannels.push(canalName);
      }
    }

    // Verificar cargos
    const cargos = ['NOTAG', 'Recrutador', 'ADM', 'Staff', 'Caller', 'Member Evento', 'ALIANÇA'];
    for (const cargoName of cargos) {
      const exists = this.guild.roles.cache.find(r => r.name === cargoName);
      if (exists) {
        this.existingRoles[cargoName] = exists;
        this.roles[cargoName] = exists.id;
      }
    }
  }

  async createRoles() {
    await this.log('🔧 Criando cargos...');

    const rolesConfig = [
      { name: 'NOTAG', color: 0x95a5a6, reason: 'Membros da guilda' },
      { name: 'Recrutador', color: 0x3498db, reason: 'Responsáveis por recrutamento' },
      { name: 'ADM', color: 0xe74c3c, reason: 'Administradores do bot' },
      { name: 'Staff', color: 0xe67e22, reason: 'Equipe de apoio - pagamentos e eventos' },
      { name: 'Caller', color: 0xf1c40f, reason: 'Responsáveis por puxar conteúdo' },
      { name: 'Member Evento', color: 0x9b59b6, reason: 'Jogadores externos em eventos' },
      { name: 'ALIANÇA', color: 0x2ecc71, reason: 'Membros da aliança' }
    ];

    for (const roleData of rolesConfig) {
      // Pular se já existe
      if (this.existingRoles[roleData.name]) {
        console.log(`⏭️ Cargo ${roleData.name} já existe, pulando...`);
        continue;
      }

      const role = await this.guild.roles.create({
        name: roleData.name,
        color: roleData.color,
        reason: roleData.reason,
        permissions: []
      });
      this.roles[roleData.name] = role.id;
      this.createdRoles[roleData.name] = role;
    }
  }

  getPermissions() {
    const everyone = this.guild.id;
    const adm = this.roles['ADM'] || this.existingRoles['ADM']?.id;
    const staff = this.roles['Staff'] || this.existingRoles['Staff']?.id;
    const recrutador = this.roles['Recrutador'] || this.existingRoles['Recrutador']?.id;
    const caller = this.roles['Caller'] || this.existingRoles['Caller']?.id;

    return {
      everyone,
      adm,
      staff,
      recrutador,
      caller
    };
  }

  // 🆕 NOVO: Verificar se categoria existe
  async getOrCreateCategory(name, permissions = []) {
    // Verificar se já existe
    const existing = this.guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name === name
    );

    if (existing) {
      console.log(`⏭️ Categoria ${name} já existe, usando existente...`);
      return existing;
    }

    // Criar nova
    const perms = this.getPermissions();
    const overwrites = [
      {
        id: perms.everyone,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: perms.adm,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
      },
      ...permissions
    ].filter(Boolean);

    const category = await this.guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      permissionOverwrites: overwrites
    });

    this.createdChannels.push(name);
    return category;
  }

  // 🆕 NOVO: Verificar se canal existe
  async getOrCreateChannel(name, type, parent, permissions = []) {
    // Verificar se já existe
    const existing = this.guild.channels.cache.find(c => c.name === name);
    if (existing) {
      console.log(`⏭️ Canal ${name} já existe, pulando...`);
      return existing;
    }

    const perms = this.getPermissions();

    // Construir permission overwrites corretamente
    const overwrites = [
      {
        id: perms.everyone,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: perms.adm,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
      }
    ];

    // Adicionar permissões extras corretamente
    for (const perm of permissions) {
      if (perm.id && (perm.allow || perm.deny)) {
        overwrites.push(perm);
      }
    }

    const channel = await this.guild.channels.create({
      name,
      type,
      parent: parent?.id,
      permissionOverwrites: type === ChannelType.GuildVoice ? [
        { id: perms.everyone, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }
      ] : overwrites
    });

    this.createdChannels.push(channel.name);
    return channel;
  }

  // Métodos antigos mantidos para compatibilidade
  async createCategory(name, permissions = []) {
    return this.getOrCreateCategory(name, permissions);
  }

  async createChannel(name, type, parent, permissions = []) {
    return this.getOrCreateChannel(name, type, parent, permissions);
  }

  async setupRecrutamento() {
    await this.log('🛡️ Verificando categoria de Recrutamento...');
    const perms = this.getPermissions();

    const cat = await this.getOrCreateCategory('🛡️ RECRUTAMENTO', [
      {
        id: perms.recrutador,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]
      },
      {
        id: perms.staff,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages]
      }
    ]);

    // Canal registrar
    const chRegistrar = await this.getOrCreateChannel('📋╠registrar', ChannelType.GuildText, cat, [
      { id: perms.everyone, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
      { id: perms.recrutador, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] }
    ]);

    // Só envia painel se o canal foi criado agora
    if (this.createdChannels.includes('📋╠registrar')) {
      await chRegistrar.send({
        embeds: [EmbedUtils.createRegistrationPanel()],
        components: [EmbedUtils.createRegisterButton()]
      });
    }

    // Canal Recrutamento (voz)
    await this.getOrCreateChannel('🎤╠Recrutamento', ChannelType.GuildVoice, cat, [
      { id: perms.recrutador, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }
    ]);

    // Canal Agendamentos
    await this.getOrCreateChannel('📅╠agendamentos', ChannelType.GuildText, cat, [
      { id: perms.recrutador, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] }
    ]);
  }

  async setupConfig() {
    await this.log('⚙️ Verificando categoria de Configurações...');

    const cat = await this.getOrCreateCategory('⚙️ CONFIG');

    const chConfig = await this.getOrCreateChannel('🔧╠configurações', ChannelType.GuildText, cat);

    // Só envia painel se o canal foi criado agora
    if (this.createdChannels.includes('🔧╠configurações')) {
      await chConfig.send({
        embeds: [ConfigHandler.createConfigPanelEmbed(this.guild.id)],
        components: ConfigHandler.createConfigButtons()
      });
    }
  }

  async setupBanco() {
    await this.log('💰 Verificando categoria do Banco da Guilda...');
    const perms = this.getPermissions();

    const cat = await this.getOrCreateCategory('💰 BANCO DA GUILDA', [
      { id: perms.everyone, allow: [PermissionFlagsBits.ViewChannel] },
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
      { id: perms.caller, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
    ]);

    // Criar-evento
    const chCriarEvento = await this.getOrCreateChannel('➕╠criar-evento', ChannelType.GuildText, cat, [
      { id: perms.caller, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] }
    ]);

    if (this.createdChannels.includes('➕╠criar-evento')) {
      await chCriarEvento.send({
        embeds: [EmbedUtils.createEventPanelEmbed()],
        components: EmbedUtils.createEventPanelButtons()
      });
    }

    // Participar
    await this.getOrCreateChannel('👋╠participar', ChannelType.GuildText, cat, [
      { id: perms.everyone, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] }
    ]);

    // Consultar-saldo
    const chConsultar = await this.getOrCreateChannel('🔍╠consultar-saldo', ChannelType.GuildText, cat, [
      { id: perms.everyone, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] }
    ]);

    if (this.createdChannels.includes('🔍╠consultar-saldo')) {
      await chConsultar.send({
        embeds: [ConfigHandler.createConsultarSaldoEmbed()],
        components: [ConfigHandler.createConsultarSaldoButton()]
      });
    }

    // Venda de baú
    const chVenda = await this.getOrCreateChannel('💰╠venda-de-baú', ChannelType.GuildText, cat, [
      { id: perms.everyone, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] }
    ]);

    if (this.createdChannels.includes('💰╠venda-de-baú')) {
      await chVenda.send({
        embeds: [this.createVendaEmbed()],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('vender_loot_button').setLabel('🛒 Vender Loot').setStyle(ButtonStyle.Success).setEmoji('💰')
        )]
      });
    }

    // Financeiro
    await this.getOrCreateChannel('📊╠financeiro', ChannelType.GuildText, cat, [
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] }
    ]);

    // Depósitos
    await this.getOrCreateChannel('💵╠depósitos', ChannelType.GuildText, cat, [
      { id: perms.everyone, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
    ]);

    // Logs-banco
    await this.getOrCreateChannel('📜╠logs-banco', ChannelType.GuildText, cat, [
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] }
    ]);

    // Aguardando-Evento (voz)
    const existingVoice = this.guild.channels.cache.find(c => c.name === '🔊╠Aguardando-Evento');
    if (!existingVoice) {
      await this.guild.channels.create({
        name: '🔊╠Aguardando-Evento',
        type: ChannelType.GuildVoice,
        parent: cat.id,
        permissionOverwrites: [
          { id: perms.everyone, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }
        ]
      });
      this.createdChannels.push('🔊╠Aguardando-Evento');
    }
  }

  createVendaEmbed() {
    return new EmbedBuilder()
      .setTitle('💰 **VENDA DE BAÚ**')
      .setDescription(
        '> Venda seu loot/baú para a guilda!\n\n' +
        '**📋 Como funciona:**\n' +
        '1. Clique no botão abaixo\n' +
        '2. Informe o local e valor\n' +
        '3. Anexe o print (opcional)\n' +
        '4. Aguarde aprovação da **Staff**\n\n' +
        '**📍 Locais:** Brecilien, Royal, HO Ava, HO Black'
      )
      .setColor(0xF1C40F)
      .setFooter({ text: 'Clique no botão abaixo para iniciar' });
  }

  async setupEventos() {
    await this.log('⚔️ Verificando categorias de Eventos...');
    const perms = this.getPermissions();

    // Eventos Ativos
    const catAtivos = await this.getOrCreateCategory('⚔️ EVENTOS ATIVOS', [
      { id: perms.everyone, allow: [PermissionFlagsBits.ViewChannel] }
    ]);

    // Eventos Encerrados
    await this.getOrCreateCategory('📁 EVENTOS ENCERRADOS', [
      { id: perms.everyone, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }
    ]);
  }

  async setupGestaoMembros() {
    await this.log('👥 Verificando categoria de Gestão de Membros...');
    const perms = this.getPermissions();

    const cat = await this.getOrCreateCategory('👥 GESTÃO DE MEMBROS', [
      { id: perms.recrutador, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] }
    ]);

    // Solicitação de registro
    await this.getOrCreateChannel('📨╠solicitação-registro', ChannelType.GuildText, cat, [
      { id: perms.recrutador, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] }
    ]);

    // Saída de membros
    await this.getOrCreateChannel('🚪╠saída-membros', ChannelType.GuildText, cat, [
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] }
    ]);

    // Lista de membros
    const chLista = await this.getOrCreateChannel('📋╠lista-membros', ChannelType.GuildText, cat, [
      { id: perms.everyone, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] }
    ]);

    if (this.createdChannels.includes('📋╠lista-membros')) {
      await MemberListHandler.initializeList(chLista);
    }
  }

  async setupGestaoGuilda() {
    await this.log('👑 Verificando categoria de Gestão da Guilda...');
    const perms = this.getPermissions();

    const cat = await this.getOrCreateCategory('👑 GESTÃO DE GUILDA', [
      { id: perms.recrutador, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] }
    ]);

    // Painel de Eventos (Estatísticas)
    const chPainelEventos = await this.getOrCreateChannel('📊╠painel-de-eventos', ChannelType.GuildText, cat, [
      { id: perms.everyone, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] }
    ]);

    // 🆕 CORREÇÃO: Verificar se canal existe antes de inicializar painel
    if (this.createdChannels.includes('📊╠painel-de-eventos') && chPainelEventos) {
      await EventStatsHandler.initializePanel(chPainelEventos);
    }

    // Saldo-guilda
    const chSaldo = await this.getOrCreateChannel('🏦╠saldo-guilda', ChannelType.GuildText, cat, [
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
      { id: perms.recrutador, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] }
    ]);

    if (this.createdChannels.includes('🏦╠saldo-guilda')) {
      const db = require('../utils/database');
      const config = ConfigHandler.getConfig(this.guild.id);
      const embedSaldo = ConfigHandler.createSaldoGuildaEmbed(db, config);

      const msgSaldo = await chSaldo.send({ embeds: [embedSaldo] });
      global.saldoGuildaMessageId = msgSaldo.id;
      global.saldoGuildaChannelId = chSaldo.id;
    }
  }

  // 🆕 NOVO: Método para criar Albion Academy
  async setupAlbionAcademy() {
    await this.log('🎓 Verificando categoria Albion Academy...');
    const perms = this.getPermissions();

    const cat = await this.getOrCreateCategory('🎓 ALBION ACADEMY', [
      { id: perms.everyone, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
      { id: perms.adm, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.EmbedLinks] },
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] }
    ]);

    // Perfil - Canal para visualizar perfil dos jogadores
    const chPerfil = await this.getOrCreateChannel('👤╠perfil', ChannelType.GuildText, cat, [
      { id: perms.everyone, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
      { id: perms.adm, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] }
    ]);

    if (this.createdChannels.includes('👤╠perfil')) {
      await chPerfil.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('👤 **PERFIL DOS JOGADORES**')
            .setDescription(
              '> Visualize o perfil e estatísticas dos membros da guilda\n\n' +
              '**📊 Informações disponíveis:**\n' +
              '• Nível de XP\n' +
              '• Eventos participados\n' +
              '• Especializações\n' +
              '• Conquistas\n\n' +
              '*Sistema em desenvolvimento*'
            )
            .setColor(0x9B59B6)
            .setFooter({ text: 'Albion Academy' })
            .setTimestamp()
        ]
      });
    }

    // XP-Event - Canal para ganhar XP em eventos
    const chXpEvent = await this.getOrCreateChannel('⭐╠xp-event', ChannelType.GuildText, cat, [
      { id: perms.everyone, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
      { id: perms.adm, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
      { id: perms.caller, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
    ]);

    if (this.createdChannels.includes('⭐╠xp-event')) {
      await chXpEvent.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('⭐ **XP EVENT**')
            .setDescription(
              '> Ganhe XP participando de eventos da guilda!\n\n' +
              '**🎮 Como funciona:**\n' +
              '• Participe de eventos marcados\n' +
              '• Ganhe XP baseado no tempo de participação\n' +
              '• Suba de nível e desbloqueie recompensas\n\n' +
              '**📈 Sistema de Níveis:**\n' +
              '• Nível 1-10: Recruta\n' +
              '• Nível 11-25: Veterano\n' +
              '• Nível 26-50: Elite\n' +
              '• Nível 51+: Lenda\n\n' +
              '*Participe dos eventos para ganhar XP!*'
            )
            .setColor(0xF1C40F)
            .setFooter({ text: 'Albion Academy' })
            .setTimestamp()
        ]
      });
    }

    // Log-XP - Canal de logs de XP
    const chLogXp = await this.getOrCreateChannel('📜╠log-xp', ChannelType.GuildText, cat, [
      { id: perms.everyone, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
      { id: perms.adm, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
    ]);

    if (this.createdChannels.includes('📜╠log-xp')) {
      await chLogXp.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('📜 **LOG DE XP**')
            .setDescription(
              '> Registro de todas as transações de XP\n\n' +
              '**📝 Logs registrados:**\n' +
              '• Ganho de XP em eventos\n' +
              '• Bônus de XP\n' +
              '• Penalidades\n' +
              '• Ajustes manuais (ADM/Staff)\n\n' +
              '*Apenas ADMs e Staff podem enviar mensagens aqui*'
            )
            .setColor(0x3498DB)
            .setFooter({ text: 'Albion Academy' })
            .setTimestamp()
        ]
      });
    }

    // Orb-XP - Canal para trocar XP por recompensas
    const chOrbXp = await this.getOrCreateChannel('🔮╠orb-xp', ChannelType.GuildText, cat, [
      { id: perms.everyone, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
      { id: perms.adm, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] }
    ]);

    if (this.createdChannels.includes('🔮╠orb-xp')) {
      await chOrbXp.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('🔮 **ORB XP - LOJA DE RECOMPENSAS**')
            .setDescription(
              '> Troque seu XP por recompensas exclusivas!\n\n' +
              '**🎁 Recompensas disponíveis:**\n' +
              '• Itens especiais\n' +
              '• Acesso a eventos VIP\n' +
              '• Títulos exclusivos\n' +
              '• Bônus em lootsplit\n\n' +
              '**💰 Como funciona:**\n' +
              '• Acumule XP participando de eventos\n' +
              '• Visite este canal para ver as ofertas\n' +
              '• Troque XP por orbs e recompensas\n\n' +
              '*Em breve: Sistema de loja automático*'
            )
            .setColor(0xE74C3C)
            .setFooter({ text: 'Albion Academy' })
            .setTimestamp()
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('ver_loja_xp')
              .setLabel('🛒 Ver Loja')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🔮')
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('trocar_xp')
              .setLabel('💱 Trocar XP')
              .setStyle(ButtonStyle.Success)
              .setEmoji('⭐')
              .setDisabled(true)
          )
        ]
      });
    }

    // Painel-XP - Painel de controle de XP
    const chPainelXp = await this.getOrCreateChannel('📊╠painel-xp', ChannelType.GuildText, cat, [
      { id: perms.everyone, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
      { id: perms.adm, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
      { id: perms.staff, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
    ]);

    if (this.createdChannels.includes('📊╠painel-xp')) {
      await chPainelXp.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('📊 **PAINEL DE XP**')
            .setDescription(
              '> Controle e gerenciamento do sistema de XP\n\n' +
              '**⚙️ Funções do Painel:**\n' +
              '• Ativar/Desativar sistema de XP\n' +
              '• Ajustar ganho de XP por evento\n' +
              '• Configurar multiplicadores\n' +
              '• Gerenciar recompensas\n\n' +
              '**👥 Ranking:**\n' +
              '• Top jogadores por XP\n' +
              '• Maior participação em eventos\n' +
              '• Conquistas desbloqueadas\n\n' +
              '*Apenas ADMs e Staff podem gerenciar*'
            )
            .setColor(0x2ECC71)
            .setFooter({ text: 'Albion Academy' })
            .setTimestamp()
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('ativar_xp_sistema')
              .setLabel('✅ Ativar XP')
              .setStyle(ButtonStyle.Success)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('desativar_xp_sistema')
              .setLabel('❌ Desativar XP')
              .setStyle(ButtonStyle.Danger)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId('config_xp')
              .setLabel('⚙️ Configurar')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true)
          )
        ]
      });
    }
  }

  // 🆕 NOVO: Método de atualização (chamado pelo botão)
  async update() {
    await this.log('🔄 Iniciando atualização da estrutura...');

    // Verificar o que já existe
    await this.checkExistingChannels();

    // Criar/atualizar cada seção
    await this.createRoles();
    await this.setupRecrutamento();
    await this.setupConfig();
    await this.setupBanco();
    await this.setupEventos();
    await this.setupGestaoMembros();
    await this.setupGestaoGuilda();
    await this.setupAlbionAcademy();

    const novosCanais = this.createdChannels.length;
    const novosCargos = Object.keys(this.createdRoles).length;

    return {
      success: true,
      createdChannels: this.createdChannels,
      createdRoles: Object.keys(this.createdRoles),
      existingChannels: this.existingChannels,
      existingRoles: Object.keys(this.existingRoles),
      novosCanais,
      novosCargos,
      message: novosCanais > 0 || novosCargos > 0
        ? `✅ Atualização concluída! ${novosCanais} novos canais e ${novosCargos} novos cargos criados.`
        : '✅ Estrutura já está atualizada! Nenhuma alteração necessária.'
    };
  }

  // Método de instalação completa (mantido para compatibilidade)
  async execute() {
    return this.update();
  }
}

module.exports = SetupManager;
