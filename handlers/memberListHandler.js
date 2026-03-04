const { EmbedBuilder } = require('discord.js');

class MemberListHandler {
  static listMessageId = null;
  static listChannelId = null;

  static colors = {
    notag: 0x95A5A6,
    evento: 0x9B59B6,
    alianca: 0x2ECC71,
    total: 0x3498DB
  };

  static createMemberListEmbed(guild) {
    // Buscar membros por cargo
    const notagRole = guild.roles.cache.find(r => r.name === 'NOTAG');
    const eventoRole = guild.roles.cache.find(r => r.name === 'Member Evento');
    const aliancaRole = guild.roles.cache.find(r => r.name === 'ALIANÇA');

    const notagMembers = notagRole ? notagRole.members.map(m => m).sort((a, b) => a.user.username.localeCompare(b.user.username)) : [];
    const eventoMembers = eventoRole ? eventoRole.members.map(m => m).sort((a, b) => a.user.username.localeCompare(b.user.username)) : [];
    const aliancaMembers = aliancaRole ? aliancaRole.members.map(m => m).sort((a, b) => a.user.username.localeCompare(b.user.username)) : [];

    // Formatar listas
    const formatList = (members) => {
      if (members.length === 0) return '*Nenhum membro*';
      return members.map((m, i) => `${i + 1}. ${m.user.username} (${m.user.tag})`).join('\n').substring(0, 1024) || '*Lista muito longa*';
    };

    const embed = new EmbedBuilder()
      .setTitle('📋 **LISTA DE MEMBROS DA GUILDA**')
      .setDescription(`> Total de membros registrados: **${notagMembers.length + eventoMembers.length + aliancaMembers.length}**\n> Atualizado: <t:${Math.floor(Date.now() / 1000)}:R>`)
      .setColor(this.colors.total)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        {
          name: `🛡️ NOTAG (${notagMembers.length})`,
          value: formatList(notagMembers),
          inline: true
        },
        {
          name: `🎉 Member Event (${eventoMembers.length})`,
          value: formatList(eventoMembers),
          inline: true
        },
        {
          name: `🤝 Aliança (${aliancaMembers.length})`,
          value: formatList(aliancaMembers),
          inline: true
        }
      )
      .setFooter({ text: 'Atualiza automaticamente • Albion Guild Bot' })
      .setTimestamp();

    return embed;
  }

  static async initializeList(channel) {
    try {
      const embed = this.createMemberListEmbed(channel.guild);
      const msg = await channel.send({ embeds: [embed] });

      this.listMessageId = msg.id;
      this.listChannelId = channel.id;

      // Salvar globalmente para acesso em outros lugares
      global.memberListMessageId = msg.id;
      global.memberListChannelId = channel.id;

      console.log(`✅ Lista de membros inicializada em ${channel.name}`);
      return msg;
    } catch (error) {
      console.error('Erro ao inicializar lista:', error);
    }
  }

  static async updateList(guild) {
    try {
      const channelId = global.memberListChannelId || this.listChannelId;
      const messageId = global.memberListMessageId || this.listMessageId;

      if (!channelId || !messageId) {
        console.log('⚠️ IDs da lista não encontrados, procurando canal...');
        const channel = guild.channels.cache.find(c => c.name === '📋╠lista-membros');
        if (channel) {
          await this.initializeList(channel);
        }
        return;
      }

      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        console.log('⚠️ Canal lista-membros não encontrado');
        return;
      }

      const message = await channel.messages.fetch(messageId).catch(() => null);
      if (!message) {
        console.log('⚠️ Mensagem da lista não encontrada, criando nova...');
        await this.initializeList(channel);
        return;
      }

      const embed = this.createMemberListEmbed(guild);
      await message.edit({ embeds: [embed] });
      console.log(`🔄 Lista de membros atualizada - ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      console.error('Erro ao atualizar lista:', error);
    }
  }
}

module.exports = MemberListHandler;
