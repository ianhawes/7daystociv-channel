let _ = require('lodash');
let telnet = require('telnet-client');
let decoder = new (require('string_decoder').StringDecoder)('ascii');
let telnet_client = new telnet();
let Player = require('./player');
let Players = new Array();

/*
    Discord Config
 */
let Discord = require('discord.js');
let discord_client = new Discord.Client();
let discord_token = 'MjYzMzMxNDQ0ODU0NjIwMTgw.C0QeSg.SJbTc5eA-0EzXRnRhAnS5MbFGo4';
let discord_channel = 'general';
let telnet_params = {
    host: 'play.7daystociv.com',
    port: 8081,
    loginPrompt:/password[: ]*$/i,
    shellPrompt: /Logon successful/i,
    username:'VN39LTbXMIWjeRN067ZWFYqGJe8Q78oN',
    timeout:10000,
    execTimeout:5000,
    sendTimeout:5000,
    negotiationMandatory:false,
    debug:true
};

// Telnet Client
telnet_client.on('ready', function(prompt) {
});

telnet_client.on('timeout', function() {

});

telnet_client.on('close', function() {
    console.log('[Telnet Connection Closed]');
    process.exit(1);
});

telnet_client.on('data', function(buffer) {
    let response = decoder.end(buffer);
    if (_.includes(response,'Player connected')) {
        Server.parseIncoming(response, 'player_connected');
    }
    if (_.includes(response,'Player disconnected:')) {
        Server.parseIncoming(response, 'player_disconnected');
    }
    //console.log(response);
});
telnet_client.connect(telnet_params);



// Discord Bot
discord_client.login(discord_token);
discord_client.on('ready', () => {
});

discord_client.on('disconnect', () => {
    console.log('[Discord Connection Closed]');
    process.exit(1);
});

discord_client.on('error', () => {
    console.log('[Discord Error - Connection Closed]');
    process.exit(1);
});

discord_client.on('message', message => {
    if (message.content.startsWith('!ping')) {
        message.reply('pong');
    }

    if (message.content.startsWith('!whoson')) {
        Server.refreshPlayers().then((players) => {
            if (players.length == 0) {
                message.reply(`There are no players currently online.`);
            } else {
                if (players.length == 1) {
                    message.reply(`There is 1 player online: ${players[0].name}`);
                } else {
                    let player_string = players.map((el) => {
                        return el.name;
                    }).join(', ');
                    message.reply(`There are ${players.length} players online: ${player_string}`);
                }
            }
        });
    }

    if (message.channel.name == 'dev') {
        // Only dev commands are allowed here
        if (message.content.startsWith('!announce')) {
            let announcementMessage = message.content.substr('!announce'.length+1);
            Server.say(announcementMessage);
            message.reply(`that announcement was displayed to the server.`);
        }

        if (message.content.startsWith('!help')) {
            let helpBanner = [];
            helpBanner.push(`Available Commands: `);
            helpBanner.push(`   !whoson`);
            helpBanner.push(`       Displays who is online on the game server`);
            helpBanner.push(`   !announce`);
            helpBanner.push(`       Displays a global message to the server (only available to users in #dev)`);
            message.channel.sendMessage(helpBanner.join("\n"));
        }
    } else {
        if (message.content.startsWith('!help')) {
            let helpBanner = [];
            helpBanner.push(`Available Commands: `);
            helpBanner.push(`   !whoson`);
            helpBanner.push(`       Displays who is online on the game server`);
            message.channel.sendMessage(helpBanner.join("\n"));
        }


    }


});

// Server Tasks
let Server = {
    refreshPlayers: () => {
        return new Promise((resolve,reject) => {
            Players = [];
            telnet_client.send('listplayers',telnet_params,(err, response) => {
                if (err) {
                    reject('An error occurred!');
                }
                if (_.includes(response, 'Total of 0 in the game')) {
                    resolve(Players);
                } else {
                    let lines = response.split("\r\n");
                    let parsed_lines = Server.parseResponse(lines, 'listplayers');
                    for (line of parsed_lines) {
                        let p = new Player();
                        let attributes = line.split(", ");
                        p.name = attributes[1];
                        Players.push(p);
                    }
                    resolve(Players);
                }
            });
        });
    },

    say: (message) => {
        telnet_client.send(`say "${message}"`,telnet_params,(err, response) => {
            console.log(`[Announcement] ${message}`);
        });
    },

    parseIncoming: (line, trigger) => {
        switch (trigger) {
            case 'player_connected':
                // 2016-12-27T17:41:13 53676.631 INF Player connected, entityid=171, name=Wergo20, steamid=76561198114662210, steamOwner=76561198114662210, ip=::ffff:73.16.29.185
                var name_pattern = new RegExp("name=(.*?),");
                var name = name_pattern.exec(line)[1];
                console.log(`${name} connected to the server.`);
                discord_client.channels.find("name",discord_channel).sendMessage(`${name} connected to the server.`);
            break;

            case 'player_disconnected':
                var name_pattern = new RegExp("PlayerName=\\'(\\S+)\\'");
                var name = name_pattern.exec(line)[1];
                discord_client.channels.find("name",discord_channel).sendMessage(`${name} disconnected from the server.`);
                console.log(`${name} disconnected from the server.`);
            break;

            case 'player_died':
                var name_pattern = new RegExp("INF GMSG: (\\S+): /.*");
                var name = name_pattern.exec(line)[1];
                discord_client.channels.find("name",discord_channel).sendMessage(`${name} died.`);
                console.log(`${name} died.`);
            break;
        }
    },

    parseResponse: (response_lines, command) => {
        switch (command) {
            case 'listplayers':
                let start = false;
                let parsed_lines = [];
                for (line of response_lines) {
                    if (_.includes(line, 'Total of ')) {
                        start = false;
                    }

                    if (start) {
                        if (_.includes(line, 'health=') && _.includes(line, 'steamid=')) {
                            parsed_lines.push(line);
                        }
                    }

                    if (_.includes(line, "INF Executing command 'listplayers' by Telnet ")) {
                        start = true;
                    }
                }

                return parsed_lines;
            break;
        }
    }
};