const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const EventEmbeds = require('./eventEmbeds');

class EventModals {
  static createCustomEventModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_evento_custom')
      .setTitle('✨ Criar Evento Personalizado');

    const nomeInput = new TextInputBuilder()
      .setCustomId('evt_nome')
      .setLabel('📋 Nome do Evento')
      .setPlaceholder('Ex: Farm T8, Dungeon Avalone...')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const descInput = new TextInputBuilder()
      .setCustomId('evt_desc')
      .setLabel('📝 Descrição')
      .setPlaceholder('Descreva o objetivo do evento...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(200);

    const reqInput = new TextInputBuilder()
      .setCustomId('evt_req')
      .setLabel('⚔️ Requisitos (Opcional)')
      .setPlaceholder('IP mínimo, builds específicas...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(150);

    const horarioInput = new TextInputBuilder()
      .setCustomId('evt_horario')
      .setLabel('⏰ Horário de Início')
      .setPlaceholder('Ex: Agora, 20:00 BRT...')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(30);

    return modal.addComponents(
      new ActionRowBuilder().addComponents(nomeInput),
      new ActionRowBuilder().addComponents(descInput),
      new ActionRowBuilder().addComponents(reqInput),
      new ActionRowBuilder().addComponents(horarioInput)
    );
  }

  static createPresetEventModal(tipo) {
    const modal = new ModalBuilder()
      .setCustomId(`modal_evento_${tipo}`)
      .setTitle(`🏆 Criar: ${EventEmbeds.getEventTypeName(tipo)}`);

    const descInput = new TextInputBuilder()
      .setCustomId('evt_desc')
      .setLabel('📝 Detalhes adicionais')
      .setPlaceholder('Informações extras sobre o evento...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(200);

    const reqInput = new TextInputBuilder()
      .setCustomId('evt_req')
      .setLabel('⚔️ Requisitos específicos')
      .setPlaceholder('IP, builds, composição...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(150);

    const horarioInput = new TextInputBuilder()
      .setCustomId('evt_horario')
      .setLabel('⏰ Quando começa?')
      .setPlaceholder('Ex: Agora, Em 30 minutos...')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(30);

    const vagasInput = new TextInputBuilder()
      .setCustomId('evt_vagas')
      .setLabel('👥 Limite de vagas (Opcional)')
      .setPlaceholder('Ex: 20, 5, deixe em branco = ilimitado')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(5);

    return modal.addComponents(
      new ActionRowBuilder().addComponents(descInput),
      new ActionRowBuilder().addComponents(reqInput),
      new ActionRowBuilder().addComponents(horarioInput),
      new ActionRowBuilder().addComponents(vagasInput)
    );
  }
}

module.exports = EventModals;
