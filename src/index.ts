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
const OLDEST_SF = process.env.OLDEST_SF;
const fmt = (ms?: number) => ms && new Date(ms).toLocaleString();

if (!TOKEN || !CHANNEL_SF || !OLDEST_SF) {
  console.error('Missing DISCORD_TOKEN or CHANNEL_ID or OLDEST_SF in .env');
} else {
  client.once('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}!`);
    const channel = await client.channels.fetch(CHANNEL_SF);
    if (!channel || channel.type !== ChannelType.GuildText) {
      console.error('Could not find text channel');
      return;
    }

    while (true) {
      const oldestMessages = [
        ...(await channel.messages
          .fetch({ limit: 100, around: OLDEST_SF })
          .then(messages => messages.filter(m => m.id !== OLDEST_SF).values())),
      ];
        await new Promise(resolve => setTimeout(resolve, 1_000));
      const olderThanThirtyDays = oldestMessages.filter(
        m => Date.now() - m.createdTimestamp > thirtyDaysInMilliseconds,
      );
      for (const m of olderThanThirtyDays) {
        try {
          const messageToDelete = await channel.messages.fetch(m.id.toString());
          if (messageToDelete) {
            await messageToDelete.delete();
            console.log(`Deleted ${fmt(messageToDelete.createdTimestamp)}`);
          }
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 2_000));
      }
    }
  });

  client.login(TOKEN).catch(console.error);
}
