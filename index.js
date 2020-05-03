const Discord = require("discord.js");
const { Client, Util } = require("discord.js");
const { TOKEN, PREFIX, GOOGLE_API_KEY } = require("./config");
const YouTube = require("simple-youtube-api");
const ytdl = require("ytdl-core");
require("./server.js")

const bot = new Client({ disableEveryone: true });

const youtube = new YouTube(GOOGLE_API_KEY);

const queue = new Map();

bot.on("warn", console.warn);

bot.on("error", console.error);

bot.on("ready", () => console.log(`${bot.user.tag} has been successfully turned on!`));

bot.on("disconnect", () => console.log("An error occurred, trying to reconnect!"));

bot.on("reconnecting", () => console.log("I am reconnecting now..."));

bot.on("message", async msg => { // eslint-disable-line
    if (msg.author.bot) return undefined;
    if (!msg.content.startsWith(PREFIX)) return undefined;

    const args = msg.content.split(" ");
    const searchString = args.slice(1).join(" ");
    const url = args[1] ? args[1].replace(/<(.+)>/g, "$1") : "";
    const serverQueue = queue.get(msg.guild.id);

    let command = msg.content.toLowerCase().split(" ")[0];
    command = command.slice(PREFIX.length)

    if (command === "muzica" || command == "cmd") {
        const helpembed = new Discord.RichEmbed()
            .setColor("#7289DA")
            .setAuthor(bot.user.tag, bot.user.displayAvatarURL)
            .setDescription(`
__**KUZO MUSIC**__
> \`?kz-play\` > **\`?kz-play [titlu/link]\`**
> \`?kz-skip\`, \`?kz-stop\`,  \`?kz-pauza\`, \`?kz-reporneste\``)
            .setFooter("© KuZo Bot \`| Created by Kuzo | machiamakuzo#3755", "https://cdn.discordapp.com/attachments/609056766184914958/698548256661307502/download.png")
        msg.channel.send(helpembed);
    }

    if (command === "play" || command === "p") {
        const voiceChannel = msg.member.voiceChannel;
        if (!voiceChannel) return msg.channel.send("Trebuie sa fi intr-un Voice Channel!");
        const permissions = voiceChannel.permissionsFor(msg.client.user);
        if (!permissions.has("CONNECT")) {
            return msg.channel.send("Sorry, but i need **`CONNECT`** permissions to proceed!");
        }
        if (!permissions.has("SPEAK")) {
            return msg.channel.send("Sorry, but i need **`SPEAK`** permissions to proceed!");
        }

        if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playlist = await youtube.getPlaylist(url);
            const videos = await playlist.getVideos();
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
                await handleVideo(video2, msg, voiceChannel, true); // eslint-disable-line no-await-in-loop
            }
            return msg.channel.send(`:musical_note:   **|**  Playlist-ul: **\`${playlist.title}\`** a fost adaugat la coada !`);
        } else {
            try {
                var video = await youtube.getVideo(url);
            } catch (error) {
                try {
                    var videos = await youtube.searchVideos(searchString, 10);
                    let index = 0;
                    msg.channel.send(`
__**ALEGE MELODIA**__

${videos.map(video2 => `**\`${++index}\`  |**  ${video2.title}`).join("\n")}

**ALEGE O MELODIE DE LA 1-10**
					`);
                    // eslint-disable-next-line max-depth
                    try {
                        var response = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {
                            maxMatches: 1,
                            time: 10000,
                            errors: ["time"]
                        });
                    } catch (err) {
                        console.error(err);
                        return msg.channel.send("Eroare ! Melodia va fi anulata..");
                    }
                    const videoIndex = parseInt(response.first().content);
                    var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
                } catch (err) {
                    console.error(err);
                    return msg.channel.send("🆘  **|**  Boss-ule nu gasesc niciun rezultat..");
                }
            }
            return handleVideo(video, msg, voiceChannel);
        }

    } else if (command === "skip") {
        if (!msg.member.voiceChannel) return msg.channel.send("Trebuie sa fi intr-un Voice Channel!");
        if (!serverQueue) return msg.channel.send("Nicio melodie nu este in desfasurare , o sa dau **\`skip\`** pentru tine");
        serverQueue.connection.dispatcher.end("Skip command has been used!");
        msg.channel.send("⏭️  **|**  Comanda pentru skip a fost folosita");
        return undefined;

    } else if (command === "stop") {
        if (!msg.member.voiceChannel) return msg.channel.send("Trebuie sa fi intr-un Voice Channel!");
        if (!serverQueue) return msg.channel.send("Nicio melodie nu este in desfasurare, o sa dau **\`stop\`** pentru tine");
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end("Stop command has been used!");
        msg.channel.send("⏹️  **|**  Comanda stop a fost folosita");
        return undefined;

    } else if (command === "easda" || command === "eas") {
        if (!msg.member.voiceChannel) return msg.channel.send("Trebuie sa fi intr-un Voice Channel!");
        if (!serverQueue) return msg.channel.send("Nicio melodie nu este in desfasurare");
        if (!args[1]) return msg.channel.send(`Volumul curent este: **\`${serverQueue.volume}%\`**`);
        serverQueue.volume = args[1];
        serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
        return msg.channel.send(`Am setat volumul la: **\`${args[1]}%\`**`);

    } else if (command === "nasdawd" || command === "ed") {
        if (!serverQueue) return msg.channel.send("Nicio melodie nu este in desfasurare");
        return msg.channel.send(`🎶  **|**  Acum porneste melodia: **\`${serverQueue.songs[0].title}\`**`);

    } else if (command === "sadsa" || command === "asdwa") {
        if (!serverQueue) return msg.channel.send("Nicio melodie nu este in desfasurare");
        return msg.channel.send(`
__**Song Queue:**__

${serverQueue.songs.map(song => `**-** ${song.title}`).join("\n")}

**Now Playing: \`${serverQueue.songs[0].title}\`**
        `);

    } else if (command === "pauza") {
        if (serverQueue && serverQueue.playing) {
            serverQueue.playing = false;
            serverQueue.connection.dispatcher.pause();
            return msg.channel.send("⏸  **|**  Am pus pauza la muzica");
        }
        return msg.channel.send("Nicio melodie nu este in desfasurare");

    } else if (command === "reporneste") {
        if (serverQueue && !serverQueue.playing) {
            serverQueue.playing = true;
            serverQueue.connection.dispatcher.resume();
            return msg.channel.send("▶  **|**  Am repornit melodia");
        }
        return msg.channel.send("Nicio melodie nu este in desfasurare");
    }
    return undefined;
});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
    const serverQueue = queue.get(msg.guild.id);
    const song = {
        id: video.id,
        title: Util.escapeMarkdown(video.title),
        url: `https://www.youtube.com/watch?v=${video.id}`
    };
    if (!serverQueue) {
        const queueConstruct = {
            textChannel: msg.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        };
        queue.set(msg.guild.id, queueConstruct);

        queueConstruct.songs.push(song);

        try {
            var connection = await voiceChannel.join();
            queueConstruct.connection = connection;
            play(msg.guild, queueConstruct.songs[0]);
        } catch (error) {
            console.error(`Nu pot intra pe acest Voice Channel: ${error}`);
            queue.delete(msg.guild.id);
            return msg.channel.send(`Nu pot intra pe acest Voice Channel: **\`${error}\`**`);
        }
    } else {
        serverQueue.songs.push(song);
        console.log(serverQueue.songs);
        if (playlist) return undefined;
        else return msg.channel.send(`:musical_note:   **|** Melodia **\`${song.title}\`** a fost adaugata la coada !`);
    }
    return undefined;
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
        .on("end", reason => {
            if (reason === "Stream is not generating quickly enough.") console.log("Song Ended.");
            else console.log(reason);
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

    serverQueue.textChannel.send(`🎶  **|**  Acum porneste melodia: **\`${song.title}\`**`);
};

bot.login(TOKEN);
