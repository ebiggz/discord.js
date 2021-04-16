'use strict';

const Action = require('./Action');
const { Events } = require('../../util/Constants');
const SnowflakeUtil = require('../../util/Snowflake');

const EPHEMERAL_FLAG_ID = 64;

const parseContent = options => {
  let content = '';
  options.forEach(element => (content += element.value));
  return content;
};

const buildInteractionReplyData = input => {
  if (typeof input === 'object') {
    if (Array.isArray(input)) {
      return {
        embeds: input,
      };
    } else {
      return {
        content: input.content,
        embeds: input.embeds,
      };
    }
  } else if (typeof input === 'string') {
    return {
      content: input,
    };
  }
  return null;
};

class InteractionCreateAction extends Action {
  async handle(data) {
    const client = this.client;
    const guild = client.guilds.cache.get(data.guild_id);
    let sentInitial = false;
    const interaction = {
      id: data.id,
      token: data.token,
      channel: client.channels.cache.get(data.channel_id),
      guild: guild,
      member: guild
        ? guild.members.cache.get(data.member.user.id) || (await guild.members.fetch(data.member.user.id)) || null
        : null,
      author: client.users.cache.get(data.member.user.id) || (await client.users.fetch(data.member.user.id)) || null,
      name: data.data.name,
      content: data.data.options ? parseContent(data.data.options) : '',
      createdTimestamp: SnowflakeUtil.deconstruct(data.id).timestamp,
      options: data.data.options ? data.data.options : null,
      reply(input, ephemeral = false) {
        const replyData = buildInteractionReplyData(input);
        if (!input) {
          throw new Error('Message content or embeds must be provided');
        }

        const body = {
          data: {
            type: 4,
            data: {
              ...replyData,
              flags: ephemeral ? EPHEMERAL_FLAG_ID : null,
            },
          },
        };

        const replyRequest = !sentInitial
          ? client.api.interactions(interaction.id, interaction.token).callback.post(body)
          : client.api.webhooks(client.user.id, interaction.token).post(body.data);

        sentInitial = true;

        return replyRequest.then(response => response.id ?? '@original');
      },
      edit(input, messageId = '@original') {
        const replyData = buildInteractionReplyData(input);
        if (!input) {
          throw new Error('Message content or embeds must be provided');
        }
        client.api.webhooks(client.user.id, interaction.token).messages(messageId).patch({
          data: replyData,
        });
      },
      delete(messageId = '@original') {
        client.api.webhooks(client.user.id, interaction.token).messages(messageId).delete();
      },
      thinking(ephemeral = false) {
        if (sentInitial) return;
        client.api.interactions(interaction.id, interaction.token).callback.post({
          data: {
            type: 5,
            data: {
              content: '',
              flags: ephemeral ? EPHEMERAL_FLAG_ID : null,
            },
          },
        });
      },
    };
    client.emit(Events.INTERACTION_CREATE, interaction);
    return { interaction };
  }
}

module.exports = InteractionCreateAction;
