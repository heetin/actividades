require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const axios = require('axios');

const TOKEN = process.env.DISCORD_TOKEN;
const TEXT_CHANNEL_ID = process.env.TEXT_CHANNEL_ID;


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const activities = new Map(); // Usar canal de voz como clave y actividad como valor
let activityCounter = 0; // Contador para las actividades

// Almacenar loot de miembros que se han ido
const closedAccounts = new Map();

client.once('ready', () => {
  console.log(`Bot conectado como ${client.user.tag}`);

  // Obtén el canal de texto usando su ID
  const textChannel = client.channels.cache.get(TEXT_CHANNEL_ID);

  if (textChannel) {
    // Envía el mensaje de bienvenida con los comandos
    textChannel.send(
      `¡Hola a todos! El bot está conectado y listo para usarse.\n\n` +
      `¡Atención! Para abrir una actividad de split loot deben estar en un canal de voz y sus compañeros también.\n` +
      `Aquí tienes los comandos disponibles:\n` +
      `- **!abrir**: Inicia una nueva actividad de split loot en tu canal de voz.\n` +
      `- **!estado**: Muestra el estado actual de la actividad.\n` +
      `- **!agregar <cantidad>**: Agrega loot a la actividad (solo el iniciador puede usarlo).\n` +
      `- **!cerrar**: Cierra la actividad actual y muestra un resumen.`
    );
  } else {
    console.log("No se encontró el canal de texto especificado.");
  }
});

// Manejar el mensaje para abrir, ver estado y cerrar actividad
client.on('messageCreate', async (message) => {
  if (message.content === '!abrir') {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message.reply('Debes estar en un canal de voz para iniciar la actividad.');
    }

    if (activities.has(voiceChannel.id)) {
      return message.reply('Ya hay una actividad en curso en este canal. Usa el comando !cerrar para finalizarla.');
    }

    activityCounter += 1;
    const activityName = `ACTIVIDAD ${activityCounter}`;
  // Registrar la hora de inicio (cuando se abre la actividad)
  const startTime = new Date(); // Hora de inicio
  const startTimeFormatted = startTime.toLocaleTimeString(); // Formato de hora
    // Configurar la actividad
    const newActivity = {
      name: activityName,
      channel: voiceChannel,
      startTime: startTime, // Guardar la hora de inicio en el objeto de actividad
      originalChannelName: voiceChannel.name,
      caller: message.member.id,
      members: new Map(),
      loot: 0
    };

    // Guardar la actividad en el mapa
    activities.set(voiceChannel.id, newActivity);

    // Cambiar el nombre del canal de voz para incluir el emoji de banderita
    voiceChannel.setName(`${voiceChannel.name} 🏁 ${activityCounter}`).catch(console.error);
    
    // Registrar los miembros actuales en la actividad
    voiceChannel.members.forEach(member => {
      newActivity.members.set(member.id, 0);
    });
    

    // Enviar un mensaje de inicio de actividad con la lista de miembros y su loot
    const memberList = Array.from(newActivity.members.keys()).map(id => `<@${id}>: 0 loot`).join('\n');
    message.channel.send(`**${newActivity.name}**\n\n**Iniciada por:** <@${newActivity.caller}>\n\n**Miembros Activos:**\n${memberList}`);
  }

  // Comando para mostrar el estado de la actividad
  if (message.content === '!estado') {
    const voiceChannel = message.member.voice.channel;
    const currentActivity = activities.get(voiceChannel.id);

    if (!currentActivity) {
      return message.reply('No hay ninguna actividad en curso en este canal.');
    }

    const activeLootList = Array.from(currentActivity.members.keys()).map(id => `<@${id}>: ${currentActivity.members.get(id)} loot`).join('\n');
    const closedLootList = Array.from(closedAccounts.keys()).map(id => `<@${id}>: ${closedAccounts.get(id)} loot`).join('\n');

    message.channel.send(`**${currentActivity.name}**\n\n**Iniciada por:** <@${currentActivity.caller}>\n\n**Miembros Activos:**\n${activeLootList}\n\n**Cuentas Cerradas:**\n${closedLootList}`);
  }

  // Comando para cerrar la actividad
  


  if (message.content === '!cerrar') {
    const voiceChannel = message.member.voice.channel;
  
    // Verificar que el usuario está en un canal de voz
    if (!voiceChannel) {
      return message.reply('Debes estar en un canal de voz para cerrar la actividad.');
    }
  
    console.log(`Canal de voz actual: ${voiceChannel.id}`);
  
    // Verificar si existe una actividad en este canal de voz
    const currentActivity = activities.get(voiceChannel.id);
  
    if (!currentActivity) {
      console.log(`No hay actividad en curso en el canal de voz con ID ${voiceChannel.id}`);
      return message.reply('No hay ninguna actividad en curso en este canal de voz.');
    }
  
    // Verificar que solo el iniciador puede cerrar la actividad
    if (message.member.id !== currentActivity.caller) {
      return message.reply('Solo el iniciador de la actividad puede cerrarla.');
    }
  
    // Obtener el nombre del caller (iniciador)
    const caller = message.guild.members.cache.get(currentActivity.caller).displayName;
  
    // Detalle de loot de miembros activos y cuentas cerradas (usando displayName para los apodos)
    const activeLootList = Array.from(currentActivity.members.keys()).map(id => {
      const memberName = message.guild.members.cache.get(id)?.displayName || 'Miembro Desconocido';
      return `${memberName}: ${currentActivity.members.get(id)} loot`;
    }).join('\n');
  
    const closedLootList = Array.from(closedAccounts.keys()).map(id => {
      const memberName = message.guild.members.cache.get(id)?.displayName || 'Miembro Desconocido';
      return `${memberName}: ${closedAccounts.get(id)} loot`;
    }).join('\n');
  
    // Cantidad de jugadores activos y cuentas cerradas
    const activeCount = currentActivity.members.size;
    const closedCount = closedAccounts.size;
  
    // Calcular el total de jugadores
    const totalPlayers = activeCount + closedCount;
  
    const totalLoot = currentActivity.loot;
  
    // Calcular la hora de inicio y la hora de fin
    const startTime = new Date(currentActivity.startTime).toLocaleTimeString(); // Hora de inicio
    const endTime = new Date().toLocaleTimeString(); // Hora de fin
  
    // Obtener la fecha sin hora
    const dateWithoutTime = new Date().toISOString().split('T')[0]; // Solo la fecha (YYYY-MM-DD)
  
    // Mensaje final de la actividad
    message.channel.send(`**Actividad Cerrada**\n\n**Total Loot Acumulado:** ${totalLoot}\n\n**Miembros Activos (${activeCount}) y su Loot:**\n${activeLootList}\n\n**Cuentas Cerradas (${closedCount}):**\n${closedLootList}\n\n**Total de Jugadores Participantes (${totalPlayers})**\n\n**Hora de Inicio:** ${startTime}\n**Hora de Cierre:** ${endTime}\n**Fecha de la Actividad:** ${dateWithoutTime}`);
  
    // Cambiar el nombre del canal de voz al nombre original
    currentActivity.channel.setName(currentActivity.originalChannelName).catch(console.error);
  
    // Eliminar las cuentas cerradas relacionadas con la actividad actual
    for (let memberId of currentActivity.members.keys()) {
      closedAccounts.delete(memberId);
    }
  
    // Confirmación antes de eliminar
    console.log(`Preparando para eliminar la actividad: ${currentActivity.name} en el canal ${voiceChannel.id}`);
    
    // Eliminar la actividad del mapa activities
    const deleteResult = activities.delete(voiceChannel.id);
    console.log(`Resultado de eliminación de actividad: ${deleteResult}`); // Verificar si devuelve true
  
    // Confirmar si se eliminó correctamente
    if (activities.has(voiceChannel.id)) {
      console.log(`La actividad aún existe después de intentar eliminarla: ${activities.get(voiceChannel.id)}`);
    } else {
      console.log('La actividad ha sido eliminada correctamente.');
    }
  
    // Mensaje final de confirmación para el usuario
    await message.channel.send(`La actividad ${currentActivity.name} ha sido cerrada y eliminada correctamente.`);
  
    // Enviar los datos a un webhook
    const webhookUrl = 'https://n8n1.elegisprepaga.com.ar/webhook/38c3a80f-d560-4ad0-90cf-6a40845e089a';
  
    const data = {
      activityName: currentActivity.name,
      caller: caller,  // Nombre del iniciador (caller)
      totalLoot: totalLoot,
      activeLootList: activeLootList,
      closedLootList: closedLootList,
      activeCount: activeCount,  // Cantidad de jugadores activos
      closedCount: closedCount,  // Cantidad de cuentas cerradas
      totalPlayers: totalPlayers, // Total de jugadores participantes
      startTime: startTime, // Hora de inicio
      endTime: endTime, // Hora de fin
      date: dateWithoutTime, // Fecha sin hora
    };
  
    try {
      const response = await axios.post(webhookUrl, data);
      console.log('Datos enviados al webhook exitosamente:', response.data);
    } catch (error) {
      console.error('Error al enviar datos al webhook:', error.response ? error.response.data : error.message);
    }
  }  
});

// Evento cuando alguien entra o sale del canal de voz
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const voiceChannelId = newState.channel ? newState.channel.id : oldState.channel.id;
  const currentActivity = activities.get(voiceChannelId);

  if (!currentActivity) return;

  const textChannel = client.channels.cache.get(TEXT_CHANNEL_ID);

  if (!oldState.channel && newState.channel.id === currentActivity.channel.id) {
    if (currentActivity.caller) {
      textChannel.send({
        content: `${newState.member.displayName} se ha unido al canal de voz. ¿Deseas agregarlo al split de loot?`,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`add_${newState.member.id}`)
              .setLabel('Agregar al loot split')
              .setStyle(ButtonStyle.Primary)
          )
        ]
      });
    }
  }

  if (oldState.channel && oldState.channel.id === currentActivity.channel.id && !newState.channel) {
    const memberLoot = currentActivity.members.get(oldState.member.id);
    if (memberLoot !== undefined) {
      closedAccounts.set(oldState.member.id, memberLoot);
      currentActivity.members.delete(oldState.member.id);

      if (currentActivity.caller) {
        textChannel.send({
          content: `${oldState.member.displayName} ha dejado el canal. ¿Quieres cerrar su cuenta en la actividad?`,
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`close_${oldState.member.id}`)
                .setLabel('Cerrar cuenta')
                .setStyle(ButtonStyle.Danger)
            )
          ]
        });
      }
    }
  }
});
  
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const textChannel = client.channels.cache.get(TEXT_CHANNEL_ID);
  const oldChannelId = oldState.channel ? oldState.channel.id : null;
  const newChannelId = newState.channel ? newState.channel.id : null;

  // Obtener la actividad actual usando el canal antiguo
  const currentActivity = activities.get(oldChannelId);

  // Si un miembro se va del canal de voz
  if (oldChannelId && currentActivity) {
    const memberLoot = currentActivity.members.get(oldState.member.id);
    if (memberLoot !== undefined) {
      closedAccounts.set(oldState.member.id, memberLoot);
      currentActivity.members.delete(oldState.member.id);

      if (currentActivity.caller) {
        textChannel.send({
          content: `${oldState.member.displayName} ha dejado el canal. ¿Quieres cerrar su cuenta en la actividad?`,
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`close_${oldState.member.id}`)
                .setLabel('Cerrar cuenta')
                .setStyle(ButtonStyle.Danger)
            )
          ]
        });
      }
    }
  }

  // Si un miembro entra a un canal de voz
  if (newChannelId && newChannelId !== oldChannelId) {
    const newActivity = activities.get(newChannelId);
    
    // Si el miembro viene de otro canal de voz
    if (newActivity) {
      // Solo el caller puede ver el botón para agregar al loot split
      if (newActivity.caller) {
        textChannel.send({
          content: `${newState.member.displayName} se ha unido al canal de voz. ¿Deseas agregarlo al split de loot?`,
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`add_${newState.member.id}`)
                .setLabel('Agregar al loot split')
                .setStyle(ButtonStyle.Primary)
            )
          ]
        });
      }
    }
  }
});


// Manejar interacciones de botones
client.on(Events.InteractionCreate, async (interaction) => {
  // Asegurarse de que el miembro esté en un canal de voz
  if (!interaction.member || !interaction.member.voice || !interaction.member.voice.channel) {
      return interaction.reply({ content: 'Debes estar en un canal de voz para usar este comando.', ephemeral: true });
  }

  // Obtener la actividad actual usando el canal de voz
  const activity = activities.get(interaction.member.voice.channel.id); 

  if (interaction.isButton()) {
      const [action, userId] = interaction.customId.split('_');

      if (!activity) {
          return interaction.reply({ content: 'No hay actividad activa en este canal de voz.', ephemeral: true });
      }

      if (action === 'add') {
          // Solo el caller puede agregar miembros
          if (interaction.member.id !== activity.caller) {
              return interaction.reply({ content: `No tienes permiso para agregar miembros al loot split, solo el que creó la actividad.`, ephemeral: true });
          }

          // Agregar miembro si está en el canal de voz
          if (activity.channel.members.has(userId)) {
              let memberLoot = 0;

              // Verificar si el usuario tenía una cuenta cerrada
              if (closedAccounts.has(userId)) {
                  memberLoot = closedAccounts.get(userId); // Recuperar el loot anterior
                  closedAccounts.delete(userId); // Limpiar el mapa de cuentas cerradas
              }

              // Agregar nuevo miembro al loot split con su loot restaurado o 0
              activity.members.set(userId, memberLoot);

              await interaction.update({
                  content: `${interaction.member.displayName} ha sido agregado al loot split con ${memberLoot} loot.`,
                  components: []
              });
          } else {
              await interaction.reply({ content: 'Este usuario ya está en el split o no se encuentra en el canal de voz.', ephemeral: true });
          }
      } else if (action === 'close') {
          // Solo el caller puede cerrar cuentas
          if (interaction.member.id !== activity.caller) {
              return interaction.reply({ content: 'No tienes permiso para cerrar cuentas.', ephemeral: true });
          }

          const memberLoot = activity.members.get(userId);
          if (memberLoot !== undefined) {
              // Guardar el loot en cuentas cerradas
              closedAccounts.set(userId, memberLoot);
              activity.members.delete(userId);

              await interaction.update({
                  content: `La cuenta de ${interaction.member.displayName} ha sido cerrada con un total de loot de ${memberLoot}.`,
                  components: []
              });
          } else {
              await interaction.reply({ content: 'No se encontró ninguna cuenta asociada a este usuario.', ephemeral: true });
          }
      }
  }
});

// Manejar el comando "!agregar"
client.on('messageCreate', message => {
  if (message.channel.id !== TEXT_CHANNEL_ID) return;

  const args = message.content.split(' ');
  if (args[0] === '!agregar' && args[1] && !isNaN(args[1])) {
      const newLoot = parseFloat(args[1]);
      const activity = activities.get(message.member.voice.channel.id); // Obtener la actividad actual

      if (!activity) {
          return message.reply('No hay actividad activa en este canal de voz.');
      }

      // Solo el Caller puede agregar loot
      if (message.member.id !== activity.caller) {
          return message.reply('Solo el iniciador de la actividad puede agregar loot.');
      }

      // Sumar el nuevo loot al total
      activity.loot += newLoot;

      // Calcular el loot adicional por miembro para los miembros activos actualmente
      const activeMembers = Array.from(activity.members.keys());
      const lootPerMember = newLoot / activeMembers.length;

      activeMembers.forEach(memberId => {
          const currentLoot = activity.members.get(memberId);
          // Actualizar solo con la nueva distribución de loot, sin reiniciar el loot acumulado previo
          activity.members.set(memberId, currentLoot + lootPerMember);
      });

      // Enviar el mensaje de la nueva distribución
      const memberList = Array.from(activity.members.keys()).map(id => `<@${id}>: ${activity.members.get(id)} loot`).join('\n');
      message.channel.send(`El loot acumulado ahora es de ${activity.loot}. Distribución actual:\n${memberList}`);
  }
});

// Iniciar sesión con el token del bot
client.login(TOKEN);
