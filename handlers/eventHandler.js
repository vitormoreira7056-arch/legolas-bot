const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const EventActions = require('./actions/eventActions');
const EventStatsHandler = require('./eventStatsHandler');
const LootSplitUI = require('./lootSplitUI');

class EventHandler {
  static getEventTypeName(tipo) {
    const nomes = {
      'avalog': '🏰 Avalog',
      'gank': '⚔️ Gank',
      'pvp': '⚔️ PvP',
      'pve': '🐉 PvE',
      'misto': '🔄 Misto',
      'dungeon': '🏚️ Dungeon',
      'corrompida': '💀 Corrompida',
      'outro': '📌 Outro'
    };
    return nomes[tipo] || '📌 Evento';
  }

  static createCustomEventModal() {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

    const modal = new ModalBuilder()
      .setCustomId('modal_evento_custom')
      .setTitle('📝 Criar Evento Personalizado');

    const nomeInput = new TextInputBuilder()
      .setCustomId('evt_nome')
      .setLabel('Nome do Evento')
      .setPlaceholder('Ex: Gank de Brecilien')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const descInput = new TextInputBuilder()
      .setCustomId('evt_desc')
      .setLabel('Descrição')
      .setPlaceholder('Descreva o evento...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(500);

    const reqInput = new TextInputBuilder()
      .setCustomId('evt_req')
      .setLabel('Requisitos')
      .setPlaceholder('Ex: IP 1300+, Montaria 8.3')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(200);

    const horarioInput = new TextInputBuilder()
      .setCustomId('evt_horario')
      .setLabel('Horário de Início')
      .setPlaceholder('Ex: 21:00 BRT')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(nomeInput);
    const row2 = new ActionRowBuilder().addComponents(descInput);
    const row3 = new ActionRowBuilder().addComponents(reqInput);
    const row4 = new ActionRowBuilder().addComponents(horarioInput);

    modal.addComponents(row1, row2, row3, row4);
    return modal;
  }

  static createPresetEventModal(tipo) {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

    const modal = new ModalBuilder()
      .setCustomId(`modal_evento_${tipo}`)
      .setTitle(`📝 ${this.getEventTypeName(tipo)}`);

    const descInput = new TextInputBuilder()
      .setCustomId('evt_desc')
      .setLabel('Descrição/Detalhes')
      .setPlaceholder('Detalhes específicos do evento...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(500);

    const reqInput = new TextInputBuilder()
      .setCustomId('evt_req')
      .setLabel('Requisitos Específicos')
      .setPlaceholder('Requisitos adicionais...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(200);

    const horarioInput = new TextInputBuilder()
      .setCustomId('evt_horario')
      .setLabel('Horário')
      .setPlaceholder('Ex: 21:00')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const vagasInput = new TextInputBuilder()
      .setCustomId('evt_vagas')
      .setLabel('Limite de Vagas (opcional)')
      .setPlaceholder('Ex: 20 (deixe em branco para ilimitado)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const row1 = new ActionRowBuilder().addComponents(descInput);
    const row2 = new ActionRowBuilder().addComponents(reqInput);
    const row3 = new ActionRowBuilder().addComponents(horarioInput);
    const row4 = new ActionRowBuilder().addComponents(vagasInput);

    modal.addComponents(row1, row2, row3, row4);
    return modal;
  }

  static async createEvent(interaction, eventData) {
    const guild = interaction.guild;

    // Buscar categoria de eventos ativos
    const categoriaEventos = guild.channels.cache.find(c => c.name === '⚔️ EVENTOS ATIVOS' && c.type === 4);

    // Buscar canal "👋╠participar" na categoria "💰 BANCO DA GUILDA"
    const canalParticipar = guild.channels.cache.find(c => c.name === '👋╠participar');

    if (!categoriaEventos) {
      throw new Error('Categoria ⚔️ EVENTOS ATIVOS não encontrada! Execute /instalar primeiro.');
    }

    if (!canalParticipar) {
      throw new Error('Canal 👋╠participar não encontrado na categoria BANCO DA GUILDA! Execute /instalar primeiro.');
    }

    const eventId = `evt_${Date.now()}_${interaction.user.id}`;

    // Criar apenas o canal de voz na categoria "EVENTOS ATIVOS"
    const voiceChannel = await guild.channels.create({
      name: `🔊 ${eventData.nome}`,
      type: 2,
      parent: categoriaEventos.id,
      userLimit: eventData.vagas || 0
    });

    const evento = {
      id: eventId,
      nome: eventData.nome,
      tipo: eventData.tipo,
      descricao: eventData.descricao,
      requisitos: eventData.requisitos,
      horario: eventData.horario,
      vagas: eventData.vagas,
      criadorId: interaction.user.id,
      textChannelId: canalParticipar.id,
      voiceChannelId: voiceChannel.id,
      participantes: [], // Array de IDs dos participantes
      participacaoIndividual: new Map(),
      status: 'aguardando',
      trancado: false,
      criadoEm: Date.now(),
      guildId: guild.id,
      painelMessageId: null
    };

    EventActions.activeEvents.set(eventId, evento);

    const embed = this.createEventEmbed(evento, interaction.member);
    // 🆕 CORREÇÃO: Usar botões condicionais baseados no status
    const buttons = this.createEventButtonsByStatus(evento);

    const membroRole = guild.roles.cache.find(r => r.name === 'Membro');
    const mentionText = membroRole ? `<@&${membroRole.id}>` : '@everyone';

    const painelMessage = await canalParticipar.send({
      content: `📢 ${mentionText} Novo evento criado!`,
      embeds: [embed],
      components: buttons
    });

    evento.painelMessageId = painelMessage.id;

    return { textChannel: canalParticipar, voiceChannel, eventId, painelMessage };
  }

  static createEventEmbed(evento, criador) {
    const statusEmojis = {
      'aguardando': '⏳',
      'em_andamento': '🔥',
      'pausado': '⏸️',
      'encerrado': '✅',
      'cancelado': '❌'
    };

    const statusColors = {
      'aguardando': 0x3498DB,      // Azul
      'em_andamento': 0xE74C3C,    // Vermelho
      'pausado': 0xF39C12,         // Laranja
      'encerrado': 0x2ECC71,       // Verde
      'cancelado': 0x95A5A6         // Cinza
    };

    const embed = new EmbedBuilder()
      .setTitle(`${statusEmojis[evento.status] || '⏳'} **${evento.nome}**`)
      .setDescription(evento.descricao || 'Sem descrição')
      .setColor(statusColors[evento.status] || 0x3498DB)
      .addFields(
        { name: '👤 Criador', value: `<@${evento.criadorId}>`, inline: true },
        { name: '🕐 Horário', value: evento.horario, inline: true },
        { name: '👥 Participantes', value: `${evento.participantes.length}${evento.vagas ? `/${evento.vagas}` : ''}`, inline: true },
        { name: '🔊 Canal de Voz', value: `<#${evento.voiceChannelId}>`, inline: false }
      );

    if (evento.requisitos) {
      embed.addFields({ name: '📋 Requisitos', value: evento.requisitos, inline: false });
    }

    if (evento.participantes.length > 0) {
      const lista = evento.participantes.map(id => `<@${id}>`).join(', ');
      embed.addFields({ name: '🎮 Participantes', value: lista.substring(0, 1024) || 'Nenhum', inline: false });
    }

    embed.setFooter({ text: `ID: ${evento.id} • Status: ${evento.status.replace('_', ' ').toUpperCase()}${evento.trancado ? ' 🔒' : ''}` });
    embed.setTimestamp();

    return embed;
  }

  // 🆕 NOVO: Criar botões baseados no status do evento
  static createEventButtonsByStatus(evento) {
    const eventId = evento.id;
    const status = evento.status;
    const trancado = evento.trancado;
    const rows = [];

    // Linha 1: Ações de participação (sempre visível se não estiver trancado ou encerrado/cancelado)
    if (status !== 'encerrado' && status !== 'cancelado') {
      const row1 = new ActionRowBuilder();
      
      if (!trancado) {
        row1.addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_participar_${eventId}`)
            .setLabel('✅ Participar')
            .setStyle(ButtonStyle.Success)
        );
      }

      // Botão Pausar/Sair ou Retomar dependendo do status
      if (status === 'em_andamento') {
        row1.addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_voltar_${eventId}`)
            .setLabel('⏸️ Pausar/Sair')
            .setStyle(ButtonStyle.Secondary)
        );
      } else if (status === 'pausado') {
        row1.addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_iniciar_${eventId}`) // Reusa o iniciar para retomar
            .setLabel('▶️ Retomar Evento')
            .setStyle(ButtonStyle.Primary)
        );
      }

      if (row1.components.length > 0) {
        rows.push(row1);
      }
    }

    // Linha 2: Controles de Admin/Caller (só aparece se não estiver encerrado/cancelado)
    if (status !== 'encerrado' && status !== 'cancelado') {
      const row2 = new ActionRowBuilder();

      // Iniciar só aparece se estiver aguardando
      if (status === 'aguardando') {
        row2.addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_iniciar_${eventId}`)
            .setLabel('▶️ Iniciar')
            .setStyle(ButtonStyle.Primary)
        );
      }

      // Pausar Evento só aparece se estiver em_andamento
      if (status === 'em_andamento') {
        row2.addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_pausar_${eventId}`)
            .setLabel('⏸️ Pausar Evento')
            .setStyle(ButtonStyle.Secondary)
        );
      }

      // Finalizar aparece se estiver em_andamento ou pausado
      if (status === 'em_andamento' || status === 'pausado') {
        row2.addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_finalizar_${eventId}`)
            .setLabel('🏁 Finalizar')
            .setStyle(ButtonStyle.Danger)
        );
      }

      if (row2.components.length > 0) {
        rows.push(row2);
      }
    }

    // Linha 3: Trancar/Destrancar e Cancelar (só se não estiver encerrado/cancelado)
    if (status !== 'encerrado' && status !== 'cancelado') {
      const row3 = new ActionRowBuilder();

      // Se estiver trancado, mostra Destrancar, senão mostra Trancar
      row3.addComponents(
        new ButtonBuilder()
          .setCustomId(trancado ? `evt_destrancar_${eventId}` : `evt_trancar_${eventId}`)
          .setLabel(trancado ? '🔓 Destrancar' : '🔒 Trancar')
          .setStyle(trancado ? ButtonStyle.Success : ButtonStyle.Secondary)
      );

      // Cancelar sempre disponível para admins/criador
      row3.addComponents(
        new ButtonBuilder()
          .setCustomId(`evt_cancelar_${eventId}`)
          .setLabel('❌ Cancelar')
          .setStyle(ButtonStyle.Danger)
      );

      rows.push(row3);
    }

    return rows;
  }

  // Método antigo mantido para compatibilidade, mas não usado na criação
  static createEventButtons(eventId, trancado) {
    return this.createEventButtonsByStatus({ id: eventId, status: 'aguardando', trancado });
  }

  static async atualizarEmbedEvento(interaction, evento) {
    // 🆕 CORREÇÃO: Verificar se evento existe
    if (!evento) {
      console.error('Evento não encontrado para atualizar embed');
      return;
    }

    const channel = interaction.guild.channels.cache.get(evento.textChannelId);
    if (!channel) return;

    try {
      const painelMessage = await channel.messages.fetch(evento.painelMessageId).catch(() => null);
      
      if (painelMessage) {
        const criador = await interaction.guild.members.fetch(evento.criadorId).catch(() => null);
        const embed = this.createEventEmbed(evento, criador);
        // 🆕 CORREÇÃO: Usar botões condicionais
        const buttons = this.createEventButtonsByStatus(evento);
        await painelMessage.edit({ embeds: [embed], components: buttons });
      }
    } catch (error) {
      console.error('Erro ao atualizar painel do evento:', error);
    }
  }

  static async handleParticipar(interaction, eventId) {
    const evento = EventActions.activeEvents.get(eventId);
    if (!evento) {
      return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });
    }

    if (evento.trancado) {
      return interaction.reply({ content: '🔒 Evento trancado! Aguarde a liberação.', ephemeral: true });
    }

    if (evento.vagas && evento.participantes.length >= evento.vagas) {
      return interaction.reply({ content: '❌ Evento lotado!', ephemeral: true });
    }

    if (!evento.participantes.includes(interaction.user.id)) {
      evento.participantes.push(interaction.user.id);

      if (!evento.participacaoIndividual) {
        evento.participacaoIndividual = new Map();
      }

      evento.participacaoIndividual.set(interaction.user.id, {
        userId: interaction.user.id,
        nickname: interaction.member.nickname || interaction.user.username,
        tempos: [],
        tempoTotal: 0,
        entradaAtual: null
      });
    }

    const participacao = evento.participacaoIndividual.get(interaction.user.id);

    if (evento.status === 'em_andamento' && !participacao.entradaAtual) {
      participacao.entradaAtual = Date.now();
    }

    if (evento.status === 'em_andamento' && interaction.member.voice.channel) {
      try {
        await interaction.member.voice.setChannel(evento.voiceChannelId);
      } catch (error) {
        console.log(`Não foi possível mover ${interaction.user.tag}:`, error.message);
      }
    }

    await this.atualizarEmbedEvento(interaction, evento);
    await interaction.reply({ content: '✅ Você entrou no evento!', ephemeral: true });
  }

  static async handleVoltar(interaction, eventId) {
    const evento = EventActions.activeEvents.get(eventId);
    if (!evento) {
      return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });
    }

    if (!evento.participantes.includes(interaction.user.id)) {
      return interaction.reply({ content: '❌ Você não está participando deste evento!', ephemeral: true });
    }

    const participacao = evento.participacaoIndividual?.get(interaction.user.id);

    if (participacao && participacao.entradaAtual) {
      const agora = Date.now();
      const tempoSessao = agora - participacao.entradaAtual;

      participacao.tempos.push({
        entrada: participacao.entradaAtual,
        saida: agora,
        duracao: tempoSessao
      });

      participacao.tempoTotal += tempoSessao;
      participacao.entradaAtual = null;
    }

    await this.atualizarEmbedEvento(interaction, evento);
    await interaction.reply({ content: '⏸️ Você saiu do evento (pausa). Seu tempo foi registrado.', ephemeral: true });
  }

  static async handleIniciar(interaction, eventId) {
    const evento = EventActions.activeEvents.get(eventId);
    if (!evento) {
      return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });
    }

    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isADM && !isCaller && evento.criadorId !== interaction.user.id) {
      return interaction.reply({
        content: '❌ Apenas ADMs, Callers ou o criador podem iniciar!',
        ephemeral: true
      });
    }

    // Se estava pausado, retoma. Se estava aguardando, inicia.
    const estavaPausado = evento.status === 'pausado';
    evento.status = 'em_andamento';
    
    if (!evento.iniciadoEm) {
      evento.iniciadoEm = Date.now();
    }

    if (!evento.participacaoIndividual) {
      evento.participacaoIndividual = new Map();
    }

    const canalVoz = interaction.guild.channels.cache.get(evento.voiceChannelId);
    const membrosNoCanal = canalVoz?.members || new Map();

    // Se estava pausado, retoma o tempo dos participantes que estavam presentes
    if (estavaPausado) {
      const agora = Date.now();
      for (const userId of evento.participantes) {
        const participacao = evento.participacaoIndividual.get(userId);
        if (participacao && membrosNoCanal.has(userId)) {
          participacao.entradaAtual = agora;
        }
      }
    } else {
      // Iniciando pela primeira vez
      for (const userId of evento.participantes) {
        let participacao = evento.participacaoIndividual.get(userId);

        if (!participacao) {
          const membro = await interaction.guild.members.fetch(userId).catch(() => null);
          participacao = {
            userId: userId,
            nickname: membro?.nickname || membro?.user?.username || 'Desconhecido',
            tempos: [],
            tempoTotal: 0,
            entradaAtual: null
          };
          evento.participacaoIndividual.set(userId, participacao);
        }

        if (membrosNoCanal.has(userId)) {
          participacao.entradaAtual = Date.now();
        }
      }
    }

    let movidos = 0;
    let naoMovidos = 0;

    for (const userId of evento.participantes) {
      const membro = await interaction.guild.members.fetch(userId).catch(() => null);
      if (membro && membro.voice.channel && membro.voice.channel.id !== evento.voiceChannelId) {
        try {
          await membro.voice.setChannel(evento.voiceChannelId);
          movidos++;

          const part = evento.participacaoIndividual.get(userId);
          if (part && !part.entradaAtual) part.entradaAtual = Date.now();

        } catch (error) {
          naoMovidos++;
        }
      }
    }

    await this.atualizarEmbedEvento(interaction, evento);

    let msg = estavaPausado ? '▶️ Evento retomado!' : '✅ Evento iniciado!';
    if (movidos > 0) msg += `\n🔄 ${movidos} participante(s) movido(s) para o canal.`;
    if (naoMovidos > 0) msg += `\n⚠️ ${naoMovidos} não puderam ser movidos (verifiquem se estão em canal de voz).`;

    await interaction.reply({ content: msg, ephemeral: true });
  }

  static async handlePausar(interaction, eventId) {
    const evento = EventActions.activeEvents.get(eventId);
    if (!evento) {
      return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });
    }

    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isADM && !isCaller && evento.criadorId !== interaction.user.id) {
      return interaction.reply({ content: '❌ Sem permissão!', ephemeral: true });
    }

    evento.status = 'pausado';

    if (evento.participacaoIndividual) {
      const agora = Date.now();
      for (const participacao of evento.participacaoIndividual.values()) {
        if (participacao.entradaAtual) {
          const tempoSessao = agora - participacao.entradaAtual;
          participacao.tempos.push({
            entrada: participacao.entradaAtual,
            saida: agora,
            duracao: tempoSessao
          });
          participacao.tempoTotal += tempoSessao;
          participacao.entradaAtual = null;
        }
      }
    }

    await this.atualizarEmbedEvento(interaction, evento);
    await interaction.reply({ content: '⏸️ Evento pausado! Contagem de tempo interrompida.', ephemeral: true });
  }

  static async handleTrancar(interaction, eventId) {
    const evento = EventActions.activeEvents.get(eventId);
    if (!evento) {
      return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });
    }

    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isADM && !isCaller && evento.criadorId !== interaction.user.id) {
      return interaction.reply({ content: '❌ Sem permissão!', ephemeral: true });
    }

    evento.trancado = true;
    await this.atualizarEmbedEvento(interaction, evento);
    await interaction.reply({
      content: '🔒 Evento trancado! Novos participantes não podem entrar.',
      ephemeral: true
    });
  }

  static async handleDestrancar(interaction, eventId) {
    const evento = EventActions.activeEvents.get(eventId);
    if (!evento) {
      return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });
    }

    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isADM && !isCaller && evento.criadorId !== interaction.user.id) {
      return interaction.reply({ content: '❌ Sem permissão!', ephemeral: true });
    }

    evento.trancado = false;
    await this.atualizarEmbedEvento(interaction, evento);
    await interaction.reply({
      content: '🔓 Evento destrancado! Novos participantes podem entrar.',
      ephemeral: true
    });
  }

  static async handleCancelar(interaction, eventId) {
    const evento = EventActions.activeEvents.get(eventId);
    if (!evento) {
      return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });
    }

    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    if (!isADM && evento.criadorId !== interaction.user.id) {
      return interaction.reply({ content: '❌ Apenas ADMs ou o criador podem cancelar!', ephemeral: true });
    }

    const voiceChannel = interaction.guild.channels.cache.get(evento.voiceChannelId);

    // Deletar a mensagem do painel no canal 👋╠participar
    try {
      const canalParticipar = interaction.guild.channels.cache.get(evento.textChannelId);
      if (canalParticipar && evento.painelMessageId) {
        const painelMessage = await canalParticipar.messages.fetch(evento.painelMessageId).catch(() => null);
        if (painelMessage) await painelMessage.delete();
      }
    } catch (error) {
      console.log('Erro ao deletar painel:', error.message);
    }

    if (voiceChannel) await voiceChannel.delete().catch(() => {});

    evento.status = 'cancelado';
    EventActions.activeEvents.delete(eventId);
    
    await interaction.reply({ content: '❌ Evento cancelado!', ephemeral: true });
  }

  static async handleFinalizar(interaction, eventId) {
    const evento = EventActions.activeEvents.get(eventId);
    if (!evento) {
      return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });
    }

    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
    const isCaller = interaction.member.roles.cache.some(r => r.name === 'Caller');

    if (!isADM && !isCaller && evento.criadorId !== interaction.user.id) {
      return interaction.reply({
        content: '❌ Apenas ADMs, Callers ou o criador podem finalizar!',
        ephemeral: true
      });
    }

    const categoriaEncerrados = interaction.guild.channels.cache.find(
      c => c.name === '📁 EVENTOS ENCERRADOS' && c.type === 4
    );

    const canalAguardando = interaction.guild.channels.cache.find(
      c => c.name === '🔊╠Aguardando-Evento' && c.type === 2
    );

    if (!canalAguardando) {
      return interaction.reply({
        content: '❌ Canal "🔊╠Aguardando-Evento" não encontrado na categoria "banco da guilda"!',
        ephemeral: true
      });
    }

    if (evento.participacaoIndividual) {
      const agora = Date.now();
      for (const participacao of evento.participacaoIndividual.values()) {
        if (participacao.entradaAtual) {
          const tempoSessao = agora - participacao.entradaAtual;
          participacao.tempos.push({
            entrada: participacao.entradaAtual,
            saida: agora,
            duracao: tempoSessao
          });
          participacao.tempoTotal += tempoSessao;
          participacao.entradaAtual = null;
        }
      }
    }

    const voiceChannel = interaction.guild.channels.cache.get(evento.voiceChannelId);

    if (voiceChannel) {
      for (const [memberId, member] of voiceChannel.members) {
        try {
          await member.voice.setChannel(canalAguardando.id);
        } catch (error) {
          console.log(`Não foi possível mover ${member.user.tag}:`, error.message);
        }
      }
    }

    const duracaoTotal = evento.iniciadoEm ? Date.now() - evento.iniciadoEm : 0;

    // Deletar o painel antigo do canal 👋╠participar
    try {
      const canalParticipar = interaction.guild.channels.cache.get(evento.textChannelId);
      if (canalParticipar && evento.painelMessageId) {
        const painelMessage = await canalParticipar.messages.fetch(evento.painelMessageId).catch(() => null);
        if (painelMessage) await painelMessage.delete();
      }
    } catch (error) {
      console.log('Erro ao deletar painel antigo:', error.message);
    }

    let textChannel;
    try {
      textChannel = await interaction.guild.channels.create({
        name: `💰-${evento.nome}`,
        type: 0,
        parent: categoriaEncerrados ? categoriaEncerrados.id : null,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            allow: ['ViewChannel', 'ReadMessageHistory'],
            deny: ['SendMessages']
          }
        ]
      });

      if (voiceChannel) {
        await voiceChannel.delete('Evento finalizado - convertido para canal de loot').catch(console.error);
      }

    } catch (error) {
      console.error('Erro ao criar canal:', error);
      return interaction.reply({ content: '❌ Erro ao criar canal de loot!', ephemeral: true });
    }

    evento.status = 'encerrado';
    evento.finalizadoEm = Date.now();
    evento.duracaoTotal = duracaoTotal;
    evento.textChannelId = textChannel.id;

    await EventStatsHandler.saveEventStats(evento, interaction.guild);

    const painelLoot = LootSplitUI.createFinishedEventPanel(evento, duracaoTotal);
    await textChannel.send(painelLoot);

    EventActions.activeEvents.delete(eventId);

    await interaction.reply({
      content: `✅ Evento **${evento.nome}** finalizado!\n📁 Canal de loot criado: ${textChannel}\n🔊 Participantes movidos para Aguardando-Evento.`,
      ephemeral: true
    });
  }
}

module.exports = EventHandler;
