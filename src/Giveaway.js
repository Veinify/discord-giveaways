const Discord = require('discord.js');
const { EventEmitter } = require('events');
const {
    GiveawayEditOptions,
    GiveawayData,
    GiveawayMessages,
    GiveawayRerollOptions
} = require('./Constants.js');
const GiveawaysManager = require('./Manager.js');
/**
 * Represents a Giveaway
 */
class Giveaway extends EventEmitter {
    /**
     * @param {GiveawaysManager} manager The Giveaway Manager
     * @param {GiveawayData} options The giveaway data
     */
    constructor(manager, options) {
        super();
        /**
         * The Giveaway manager
         * @type {GiveawaysManager}
         */
        this.manager = manager;
        /**
         * The Discord Client
         * @type {Discord.Client}
         */
        this.client = manager.client;
        /**
         * The giveaway prize
         * @type {string}
         */
        this.prize = options.prize;
        /**
         * The start date of the giveaway
         * @type {Number}
         */
        this.startAt = options.startAt;
        /**
         * The end date of the giveaway
         * @type {Number}
         */
        this.endAt = options.endAt;
        /**
         * Whether the giveaway is ended
         * @type {Boolean}
         */
        this.ended = options.ended;
        /**
         * The channel ID of the giveaway
         * @type {Discord.Snowflake}
         */
        this.channelID = options.channelID;
        /**
         * The message ID of the giveaway
         * @type {Discord.Snowflake?}
         */
        this.messageID = options.messageID;
        /**
         * The guild ID of the giveaway
         * @type {Discord.Snowflake}
         */
        this.guildID = options.guildID;
        /**
         * The number of winners for this giveaway
         * @type {number}
         */
        this.winnerCount = options.winnerCount;
        /**
         * The mention of the user who hosts this giveaway
         * @type {?string}
         */
        this.hostedBy = options.hostedBy;
        /**
         * The giveaway messages
         * @type {GiveawayMessages}
         */
        this.messages = options.messages;
        /**
         * The giveaway data
         * @type {GiveawayData}
         */
        this.options = options;
        /**
         * The message instance of the embed of this giveaway
         * @type {Discord.Message?}
         */
        this.message = null;
        /**
         * Role requirement
         * @type {booelan}
         */
        this.rolereq = options.rolereq;
        /**
         * @type {snowflake}
         * @type {Collection}
         */
         this.roleid = options.roleid;
         /**
          * Member#joinedAt requirement
          * @type {booelan} timereq
          * @type {snowflake} time
          */
          this.joinedreq = options.joinedreq;
          this.joinedtime = options.joinedtime;
          /**
           * Member#createdAt requirement
           * @type {booelan} agereq
           * @type {snowflake} agetime
           */
           this.agereq = options.agereq;
           this.agetime = options.agetime;
           /**
            * Guild#fetchInvites requirement
            * @type {booelan} invitereq
            * @type {Collection}
            */
            this.messagereq = options.messagereq;
            this.messageamount = options.messageamount;
            /**
             * Mark the giveaway as drop
             * @type {booelan} 
             */
             this.isdrop = options.isdrop;
            /**
             * Server Requirement
             * @type {booelan}
             * @type {string} server link
             * @type {Collection} because we allow multiple server.
             */
             this.serverreq = options.serverreq;
             this.serverlink = options.serverlink;
             this.serverslist = options.serverslist;
             /** Bypasses role
              * Users that has these roles can bypass the Requirement
              * @type {collection}
              * @type {string}
              */
             this.bypassrole = options.bypassrole;
    }

    /**
     * The remaining time before the end of the giveaway
     * @type {Number}
     * @readonly
     */
    get remainingTime() {
        return this.endAt - Date.now();
    }

    /**
     * The total duration of the giveaway
     * @type {Number}
     * @readonly
     */
    get giveawayDuration() {
        return this.endAt - this.startAt;
    }

    /**
     * The color of the giveaway embed
     * @type {Discord.ColorResolvable}
     */
    get embedColor() {
        return this.options.embedColor || this.manager.options.default.embedColor;
    }

    /**
     * The color of the giveaway embed when it's ended
     * @type {Discord.ColorResolvable}
     */
    get embedColorEnd() {
        return this.options.embedColorEnd || this.manager.options.default.embedColorEnd;
    }

    /**
     * The reaction on the giveaway message
     * @type {string}
     */
    get reaction() {
        return this.options.reaction || this.manager.options.default.reaction;
    }

    /**
     * Whether the bots are able to win the giveaway
     * @type {Boolean}
     */
    get botsCanWin() {
        return this.options.botsCanWin || this.manager.options.default.botsCanWin;
    }

    /**
     * Members with any of these permissions won't be able to win a giveaway.
     * @type {Discord.PermissionResolvable[]}
     */
    get exemptPermissions() {
        return this.options.exemptPermissions || this.manager.options.default.exemptPermissions;
    }

    /**
     * Function to filter members. If true is returned, the member won't be able to win the giveaway.
     * @type {Function}
     */
    async exemptMembers(member) {
        if(this.options.exemptMembers && typeof this.options.exemptMembers === 'function') {
            try {
                const result = await this.options.exemptMembers(member);
                return result;
            } catch(error) {
                console.error(error);
                return false;
            }
        }
        if(this.manager.options.default.exemptMembers && typeof this.manager.options.default.exemptMembers === 'function') {
            return await this.manager.options.default.exemptMembers(member);
        }
        return false;
    }

    /**
     * The channel of the giveaway
     * @type {Discord.TextChannel}
     * @readonly
     */
    get channel() {
        return this.manager.v12 ? this.client.channels.cache.get(this.channelID) : this.client.channels.get(this.channelID);
    }

    /**
     * Gets the content of the giveaway
     * @type {string}
     * @readonly
     */
    get content() {
        let roundTowardsZero = this.remainingTime > 0 ? Math.floor : Math.ceil;
        // Gets weeks, days, hours, minutes and seconds
        let weeks = roundTowardsZero(this.remainingTime / 604800000),
            days = roundTowardsZero(this.remainingTime / 86400000) % 7,
            hours = roundTowardsZero(this.remainingTime / 3600000) % 24,
            minutes = roundTowardsZero(this.remainingTime / 60000) % 60,
            seconds = roundTowardsZero(this.remainingTime / 1000) % 60;
        // Increment seconds if equal to zero
        if (seconds === 0) seconds++;
        // Whether values are inferior to zero
        let isWeek = weeks > 0,
            isDay = days > 0,
            isHour = hours > 0,
            isMinute = minutes > 0;
        let weekUnit = weeks < 2 && (this.messages.units.pluralS || this.messages.units.weeks.endsWith('s'))
                    ? this.messages.units.weeks.substr(0, this.messages.units.weeks.length -1 )
                    : this.messages.units.weeks,
            dayUnit =
                days < 2 && (this.messages.units.pluralS || this.messages.units.days.endsWith('s'))
                    ? this.messages.units.days.substr(0, this.messages.units.days.length - 1)
                    : this.messages.units.days,
            hourUnit =
                hours < 2 && (this.messages.units.pluralS || this.messages.units.hours.endsWith('s'))
                    ? this.messages.units.hours.substr(0, this.messages.units.hours.length - 1)
                    : this.messages.units.hours,
            minuteUnit =
                minutes < 2 && (this.messages.units.pluralS || this.messages.units.minutes.endsWith('s'))
                    ? this.messages.units.minutes.substr(0, this.messages.units.minutes.length - 1)
                    : this.messages.units.minutes,
            secondUnit =
                seconds < 2 && (this.messages.units.pluralS || this.messages.units.seconds.endsWith('s'))
                    ? this.messages.units.seconds.substr(0, this.messages.units.seconds.length - 1)
                    : this.messages.units.seconds;
        // Generates a first pattern
        let pattern =
            (!isWeek ? '' : `{weeks} ${weekUnit}, `) +
            (!isDay ? '' : `{days} ${dayUnit}, `) +
            (!isHour ? '' : `{hours} ${hourUnit}, `) +
            (!isMinute ? '' : `{minutes} ${minuteUnit}, `) +
            `{seconds} ${secondUnit}`;
        // Format the pattern with the right values
        let content = this.messages.timeRemaining
            .replace('{duration}', pattern)
            .replace('{weeks}', weeks.toString())
            .replace('{days}', days.toString())
            .replace('{hours}', hours.toString())
            .replace('{minutes}', minutes.toString())
            .replace('{seconds}', seconds.toString());
        return content;
    }

    /**
     * The raw giveaway object for this giveaway
     * @type {GiveawayData}
     */
    get data(){
        let baseData = {
            messageID: this.messageID,
            channelID: this.channelID,
            guildID: this.guildID,
            startAt: this.startAt,
            endAt: this.endAt,
            ended: this.ended,
            winnerCount: this.winnerCount,
            prize: this.prize,
            messages: this.messages,
            hostedBy: this.options.hostedBy,
            embedColor: this.options.embedColor,
            embedColorEnd: this.options.embedColorEnd,
            botsCanWin: this.options.botsCanWin,
            exemptPermissions: this.options.exemptPermissions,
            exemptMembers: this.options.exemptMembers,
            reaction: this.options.reaction,
            rolereq: this.options.rolereq,
            roleid: this.options.roleid,
            joinedreq: this.options.joinedreq,
            joinedtime: this.options.joinedtime,
            agereq: this.options.agereq,
            agetime: this.options.agetime,
            messagereq: this.options.messagereq,
            messageamount: this.options.messageamount,
            isdrop: this.options.isdrop,
            serverreq: this.options.serverreq,
            serverlink: this.options.serverlink,
            serverslist: this.options.serverslist,
            bypassrole: this.options.bypassrole,
        };
        return baseData;
    }

    /**
     * Fetches the giveaway message in its channel
     * @returns {Promise<Discord.Message>} The Discord message
     */
    async fetchMessage() {
        return new Promise(async (resolve, reject) => {
            if(!this.messageID) return;
            let message = null;
            if (this.manager.v12) {
                message = await this.channel.messages.fetch(this.messageID).catch(() => {});
            } else {
                message = await this.channel.fetchMessage(this.messageID).catch(() => {});
            }
            if (!message) {
                this.manager.giveaways = this.manager.giveaways.filter((g) => g.messageID !== this.messageID);
                this.manager.deleteGiveaway(this.messageID);
                return reject('Unable to fetch message with ID ' + this.messageID + '.');
            }
            this.message = message;
            resolve(message);
        });
    }

    /**
     * Gets the giveaway winner(s)
     * @param {number} [winnerCount=this.winnerCount] The number of winners to pick
     * @returns {Promise<Discord.GuildMember[]>} The winner(s)
     */
    async ValidEntry() {
        if(!this.message) return [];
        // Pick the winner
        const reactions = (this.manager.v12 ? this.message.reactions.cache :  this.message.reactions);
        const reaction = reactions.get(this.reaction) || reactions.find(r => r.emoji.name === this.reaction);
        if (!reaction) return new Discord.Collection().array();
        const guild = this.manager.v12 ? await this.channel.guild.fetch() : await this.channel.guild.fetchMembers();
        let users = (this.manager.v12 ? await reaction.users.fetch() : await reaction.fetchUsers())
            .filter(u => u.id !== this.message.client.user.id)
            .size;
        return users;
    }
    async roll(winnerCount) {
        if(!this.message) return [];
        // Pick the winner
        const reactions = (this.manager.v12 ? this.message.reactions.cache :  this.message.reactions);
        const reaction = reactions.get(this.reaction) || reactions.find(r => r.emoji.name === this.reaction);
        if (!reaction) return new Discord.Collection().array();
        const guild = this.manager.v12 ? await this.channel.guild.fetch() : await this.channel.guild.fetchMembers();
        let users = (this.manager.v12 ? await reaction.users.fetch() : await reaction.fetchUsers())
            .filter(u => u.bot === this.botsCanWin)
            .filter(u => u.id !== this.message.client.user.id)
            .filter(u => guild.member(u.id));
        
        for(let u of users.array()){
            const exemptMember = await this.exemptMembers(guild.member(u.id));
            if(exemptMember){
                users.delete(u.id);
            }
        }

        users = users.filter(u => !this.exemptPermissions.some(p => guild.member(u.id).hasPermission(p)))
            .random(winnerCount || this.winnerCount)
            .filter(u => u)
            .map(u => guild.member(u));
        return users;
    }

    /**
     * Edits the giveaway
     * @param {GiveawayEditOptions} options The edit options
     * @returns {Promise<Giveaway>} The edited giveaway
     */
    edit(options = {}) {
        return new Promise(async (resolve, reject) => {
            if (this.ended) {
                return reject('Giveaway with message ID ' + this.messageID + ' is already ended.');
            }
            if (!this.channel) {
                return reject('Unable to get the channel of the giveaway with message ID ' + this.messageID + '.');
            }
            await this.fetchMessage().catch(() => {});
            if (!this.message) {
                return reject('Unable to fetch message with ID ' + this.messageID + '.');
            }
            // Update data
            if (options.newWinnerCount) this.winnerCount = options.newWinnerCount;
            if (options.newPrize) this.prize = options.newPrize;
            if (options.addTime) this.endAt = this.endAt + options.addTime;
            if (options.setEndTimestamp) this.endAt = options.setEndTimestamp;
            // Call the db method
            await this.manager.editGiveaway(this.messageID, this.data);
            resolve(this);
        });
    }

    /**
     * Ends the giveaway
     * @returns {Promise<Discord.GuildMember[]>} The winner(s)
     */
    end(){
        return new Promise(async (resolve, reject) => {
            if (this.ended) {
                return reject('Giveaway with message ID ' + this.messageID + ' is already ended');
            }
            if (!this.channel) {
                return reject('Unable to get the channel of the giveaway with message ID ' + this.messageID + '.');
            }
            this.ended = true;
            await this.fetchMessage().catch(() => {});
            if (!this.message) {
                return reject('Unable to fetch message with ID ' + this.messageID + '.');
            }
            let winners = await this.roll();
            let entries = await this.ValidEntry();
            this.manager.emit('giveawayEnded', this, winners);
            this.manager.editGiveaway(this.messageID, this.data);
            if (winners.length > 0) {
                let formattedWinners = winners.map(w => `<@${w.id}>`).join(', ');
                let str =
                    this.messages.winners.substr(0, 1).toUpperCase() +
                    this.messages.winners.substr(1, this.messages.winners.length) +
                    ': ' +
                    formattedWinners;
                 let timerwebsite = `https://aestetikmod.mirzabhakti.repl.co/timer/?started=${this.startAt}&ended=${this.endAt}`
                let embed = this.manager.v12 ? new Discord.MessageEmbed() : new Discord.RichEmbed();
                embed
                    .setColor(this.embedColorEnd)
                    .setFooter(this.messages.endedAt)
                    .setDescription(`🎁 • **${this.prize}**\n🏅 • ${str}\n🏆 • ${
                        this.hostedBy ? this.messages.hostedBy.replace('{user}', this.hostedBy) : ''
                    }\n🎊 • Total Participants: **${entries}**`)
                    .setTimestamp(new Date(this.endAt).toISOString());
                let endembed = new Discord.MessageEmbed()
                .setColor(this.embedColorEnd)
                .setDescription(`[GIVEAWAY LINK](https://discord.com/channels/${this.message.guild.id}/${this.message.channel.id}/${this.messageID})`)
                .setFooter(`Giveaway ID: ${this.messageID}`)
                .setTimestamp()
                this.message.edit(this.isdrop ? this.messages.dropEnded : this.messages.giveawayEnded, { embed });
                this.message.channel.send(
                    this.messages.winMessage
                        .replace('{winners}', formattedWinners)
                        .replace('{prize}', this.prize), endembed);
                resolve(winners);
            } else {
                let entries = await this.ValidEntry();
                let embed = this.manager.v12 ? new Discord.MessageEmbed() : new Discord.RichEmbed();
                embed
                    .setColor(this.embedColorEnd)
                    .setFooter(this.messages.endedAt)
                    .setDescription(`🎁 • **${this.prize}**\n🏅 • ${this.messages.winners}: ${this.messages.noWinner}\n🏆 • ${
                        this.hostedBy ? this.messages.hostedBy.replace('{user}', this.hostedBy) : ''
                    }\n🎊 • Total Participants: **${entries}**`)
                    .setTimestamp(this.endAt);
                    this.message.edit(this.isdrop ? this.messages.dropEnded : this.messages.giveawayEnded, { embed });
                resolve();
            }
        });
    }
    
    /**
     * Rerolls the giveaway
     * @param {GiveawayRerollOptions} options
     * @returns {Promise<Discord.GuildMember[]>}
     */
    reroll(options){
        return new Promise(async (resolve, reject) => {
            if (!this.ended) {
                return reject('Giveaway with message ID ' + this.messageID + ' is not ended.');
            }
            if (!this.channel) {
                return reject('Unable to get the channel of the giveaway with message ID ' + this.messageID + '.');
            }
            await this.fetchMessage().catch(() => {});
            if (!this.message) {
                return reject('Unable to fetch message with ID ' + this.messageID + '.');
            }
            let winners = await this.roll(options.winnerCount);
            if (winners.length > 0) {
                let formattedWinners = winners.map(w => '<@' + w.id + '>').join(', ');
                this.channel.send(options.messages.congrat.replace('{winners}', formattedWinners));
                resolve(winners);
            } else {
                this.channel.send(options.messages.error);
                resolve(new Array());
            }
        });
    }

}

module.exports = Giveaway;
