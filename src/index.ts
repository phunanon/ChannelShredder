import { ChannelType, Client, GatewayIntentBits, Message } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const thirtyDaysInMilliseconds = 30 * 24 * 60 * 60_000;
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_SF = process.env.CHANNEL_SF;
const messageSfsInOrder: { id: BigInt; ms: number }[] = [];
const fmt = (ms?: number) => ms && new Date(ms).toLocaleString();

async function ScanToTopOfChannel(channelSf: string) {
  const channel = client.channels.cache.get(channelSf);
  if (channel?.type !== ChannelType.GuildText) {
    console.error('Invalid channel ID or not a text channel');
    return;
  }

  const limit = 100;
  let oldestMessage: Message | undefined;
  while (true) {
    const messages = await channel.messages.fetch({
      limit,
      before: oldestMessage?.id,
    });
    if (!messages.size) break;
    const messagesEarliestFirst = messages.sorted(
      (a, b) => a.createdTimestamp - b.createdTimestamp,
    );
    oldestMessage = messagesEarliestFirst.first();
    const time = fmt(oldestMessage?.createdTimestamp);
    console.log(`${messages.size} messages fetched; ${time}`);
    messageSfsInOrder.unshift(
      ...messagesEarliestFirst.map(m => ({
        id: BigInt(m.id),
        ms: m.createdTimestamp,
      })),
    );
    //Sleep two seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  console.log(`Oldest: ${fmt(oldestMessage?.createdTimestamp)}`);

  client.on('messageCreate', async message => {
    if (message.channelId !== channelSf) return;
    messageSfsInOrder.push({
      id: BigInt(message.id),
      ms: message.createdTimestamp,
    });
    const oldestTwo = messageSfsInOrder.slice(0, 2);
    const olderThanThirtyDays = oldestTwo.filter(
      m => Date.now() - m.ms > thirtyDaysInMilliseconds,
    );
    for (const m of olderThanThirtyDays) {
      try {
        const messageToDelete = await channel.messages.fetch(m.id.toString());
        if (messageToDelete) {
          await messageToDelete.delete();
          messageSfsInOrder.splice(
            messageSfsInOrder.findIndex(m => m.id === m.id),
            1,
          );
          console.log(`Deleted ${fmt(messageToDelete.createdTimestamp)}`);
        }
      } catch {
      }
    }
  });
}

if (!TOKEN || !CHANNEL_SF) {
  console.error('Missing DISCORD_TOKEN or CHANNEL_ID in .env file');
} else {
  client.once('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}!`);
    await ScanToTopOfChannel(CHANNEL_SF);
  });

  client.login(TOKEN).catch(console.error);
}
