const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  Events
} = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Importar handlers
const ModalHandler = require('./handlers/modalHandler');
const ButtonHandler = require('./handlers/buttonHandler');
const ConfigHandler = require('./handlers/configHandler');
const MemberListHandler = require('./handlers/memberListHandler');
const LootSplitHandler = require('./handlers/lootSplitHandler');
const EventStatsHandler = require('./handlers/eventStatsHandler');
const ActionHandlers = require('./handlers/actionHandlers');
const db = require('./utils/database');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: ['CHANNEL']
});

// Global para acesso em handlers
global.client = client;

client.commands = new Collection();

// Carregar comandos com verificações de segurança
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commands = [];
const comandosComErro = [];

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);

  try {
    const command = require(filePath);

    if (!command) {
      console.warn(`⚠️ Arquivo ${file} não exporta nada`);
      comandosComErro.push(file);
      continue;
    }

    if (!command.data) {
      console.warn(`⚠️ Arquivo ${file} não tem propriedade 'data'`);
      comandosComErro.push(file);
      continue;
    }

    if (!command.data.name) {
      console.warn(`⚠️ Arquivo ${file} não tem 'data.name'`);
      comandosComErro.push(file);
      continue;
    }

    if (!command.execute) {
      console.warn(`⚠️ Arquivo ${file} não tem método 'execute'`);
      comandosComErro.push(file);
      continue;
    }

    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
    console.log(`✅ Comando carregado: ${command.data.name}`);

  } catch (error) {
    console.error(`❌ Erro ao carregar ${file}:`, error.message);
    comandosComErro.push(file);
  }
}

if (comandosComErro.length > 0) {
  console.warn(`\n⚠️ ${comandosComErro.length} arquivo(s) com erro: ${comandosComErro.join(', ')}`);
}

// Registrar comandos no Discord
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log(`🔄 Registrando ${commands.length} comandos...`);

    if (commands.length === 0) {
      console.error('❌ Nenhum comando válido para registrar!');
      return;
    }

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log(`✅ ${commands.length} comandos registrados com sucesso!`);
  } catch (error) {
    console.error('❌ Erro ao registrar comandos:', error.message);
  }
})();

// Atualização automática do saldo guilda
async function atualizarSaldoGuilda() {
  try {
    if (!global.saldoGuildaChannelId || !global.saldoGuildaMessageId) return;

    const channel = await client.channels.fetch(global.saldoGuildaChannelId).catch(() => null);
    if (!channel) return;

    const message = await channel.messages.fetch(global.saldoGuildaMessageId).catch(() => null);
    if (!message) return;

    const guildId = channel.guild.id;
    const config = ConfigHandler.getConfig(guildId);

    const embed = ConfigHandler.createSaldoGuildaEmbed(db, config);

    await message.edit({ embeds: [embed] });
    console.log(`🔄 Saldo da guilda atualizado em ${new Date().toLocaleTimeString()}`);
  } catch (error) {
    console.error('Erro ao atualizar saldo da guilda:', error.message);
  }
}

// Atualizar a cada 5 minutos
setInterval(atualizarSaldoGuilda, 300000);
global.atualizarSaldoGuilda = atualizarSaldoGuilda;

client.once(Events.ClientReady, async () => {
  // CARREGAR DADOS PERSISTIDOS
  try {
    await LootSplitHandler.loadSimulations();
    EventStatsHandler.loadStats();
  } catch (error) {
    console.error('Erro ao carregar dados persistidos:', error);
  }

  console.log(`\n✅ Bot logado como ${client.user.tag}`);
  console.log('🎮 Sistema de Recrutamento ativo!');
  console.log('⚔️ Sistema de Eventos ativo!');
  console.log('💰 Sistema Bancário ativo!');
  console.log('🏆 Sistema de Lootsplit ativo!');
  console.log('⚙️ Sistema de Configurações ativo!');
  console.log('📋 Sistema de Lista de Membros ativo!');
  console.log('📊 Sistema de Estatísticas de Eventos ativo!');
  console.log(`📊 Servidores: ${client.guilds.cache.size}`);
  console.log('🔄 Atualização automática de saldo: a cada 5 minutos');
  console.log('💾 Persistência de dados: ativada');
});

// EVENTO: Membro sai do servidor
client.on(Events.GuildMemberRemove, async (member) => {
  console.log(`👋 Membro saiu: ${member.user.tag}`);

  // Atualizar lista de membros
  await MemberListHandler.updateList(member.guild);

  // Log no canal de saída
  const saidaChannel = member.guild.channels.cache.find(c => c.name === '🚪╠saída-membros');
  if (saidaChannel) {
    const embed = new (require('discord.js').EmbedBuilder)()
      .setTitle('🚪 **MEMBRO SAIU**')
      .setDescription(`${member.user.tag} saiu do servidor`)
      .setColor(0xE74C3C)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 Usuário', value: `${member} (${member.id})`, inline: true },
        { name: '📅 Entrou em', value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:F>` : 'Desconhecido', inline: true },
        { name: '📊 Cargos', value: member.roles.cache.size > 1 ? member.roles.cache.filter(r => r.name !== '@everyone').map(r => r.name).join(', ') : 'Nenhum', inline: false }
      )
      .setTimestamp();

    await saidaChannel.send({ embeds: [embed] });
  }
});

// Handler de Interações
client.on(Events.InteractionCreate, async interaction => {
  // HANDLER PARA SELECT MENUS (Estatísticas)
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'event_stats_filter') {
      try {
        await ActionHandlers.handleEventStatsFilter(interaction);
      } catch (error) {
        console.error('Erro no select menu:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ Erro ao processar filtro!',
            ephemeral: true
          }).catch(() => {});
        }
      }
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    try {
      await ModalHandler.processModalSubmit(interaction, client);
    } catch (error) {
      console.error('Erro no modal:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Erro ao processar formulário!',
          ephemeral: true
        }).catch(() => {});
      }
    }
    return;
  }

  if (interaction.isButton()) {
    try {
      await ButtonHandler.handle(interaction, client);
    } catch (error) {
      console.error('Erro no botão:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Erro ao processar ação!',
          ephemeral: true
        }).catch(() => {});
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.log(`Comando não encontrado: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction, client);

    if (['sacar', 'depositar', 'solicitar-emprestimo', 'pagar-emprestimo'].includes(interaction.commandName)) {
      await atualizarSaldoGuilda();
    }
  } catch (error) {
    console.error('Erro no comando:', error);
    const errorMessage = '❌ Ocorreu um erro ao executar este comando!';

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: errorMessage,
        ephemeral: true
      }).catch(() => {});
    } else {
      await interaction.reply({
        content: errorMessage,
        ephemeral: true
      }).catch(() => {});
    }
  }
});

client.on(Events.Error, error => {
  console.error('Erro do cliente Discord:', error);
});

client.on(Events.Warn, warning => {
  console.warn('Aviso do cliente Discord:', warning);
});

client.login(process.env.TOKEN).catch(error => {
  console.error('❌ Falha ao fazer login:', error);
  process.exit(1);
});
