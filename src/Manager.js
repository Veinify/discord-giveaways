const {
	EventEmitter
} = require('events');
const merge = require('deepmerge');
const {
	writeFile,
	readFile,
	exists
} = require('fs');
const {
	promisify
} = require('util');
const writeFileAsync = promisify(writeFile);
const existsAsync = promisify(exists);
const readFileAsync = promisify(readFile);
const ms = require("ms");
const pms = require('pretty-ms');
const Discord = require('discord.js');
const wait = promisify((a, f) => setTimeout(f, a));
const {
	defaultGiveawayMessages,
	defaultManagerOptions,
	defaultRerollOptions,
	GiveawayEditOptions,
	GiveawayData,
	GiveawayRerollOptions,
	GiveawaysManagerOptions,
	GiveawayStartOptions
} = require('./Constants.js');
const Giveaway = require('./Giveaway.js');

/**
 * Giveaways Manager
 */
class GiveawaysManager extends EventEmitter {
	/**
	 * @param {Discord.Client} client The Discord Client
	 * @param {GiveawaysManagerOptions} options The manager options
	 */
	constructor(client, options) {
		super();
		if (!client) throw new Error('Client is a required option.');
		/**
		 * The Discord Client
		 * @type {Discord.Client}
		 */
		this.client = client;
		/**
		 * Whether the manager is ready
		 * @type {Boolean}
		 */
		this.ready = false;
		/**
		 * The giveaways managed by this manager
		 * @type {Giveaway[]}
		 */
		this.giveaways = [];
		/**
		 * The manager options
		 * @type {GiveawaysManagerOptions}
		 */
		this.options = merge(defaultManagerOptions, options);
		/**
		 * Whether the Discord.js library version is the v12 one
		 * @type {boolean}
		 */
		this.v12 = this.options.DJSlib === 'v12';
		this._init();
		this.client.on('raw', async (packet) => {
			if (!['MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE'].includes(packet.t)) return;
			const giveaway = this.giveaways.find((g) => g.messageID === packet.d.message_id);
			if (!giveaway) return;
			if (giveaway.ended) return;
			const guild = (this.v12 ? this.client.guilds.cache : this.client.guilds).get(packet.d.guild_id);
			if (!guild) return;
			const member =
				(this.v12 ? guild.members.cache : guild.members).get(packet.d.user_id) ||
				(await guild.members.fetch(packet.d.user_id).catch(() => {}));
			if (!member) return;
			const channel = (this.v12 ? guild.channels.cache : guild.channels).get(packet.d.channel_id);
			if (!channel) return;
			const message =
				(this.v12 ? channel.messages.cache : channel.messages).get(packet.d.message_id) ||
				(await channel.messages.fetch(packet.d.message_id));
			if (!message) return;
			const reaction = (this.v12 ? message.reactions.cache : message.reactions).get(
				giveaway.reaction || this.options.default.reaction
			);
			if (!reaction) return;
			if (reaction.emoji.name !== packet.d.emoji.name) return;
			if (reaction.emoji.id && reaction.emoji.id !== packet.d.emoji.id) return;
			if (packet.t === 'MESSAGE_REACTION_ADD') {
				this.emit('giveawayReactionAdded', giveaway, member, reaction);
			}
			else {
				this.emit('giveawayReactionRemoved', giveaway, member, reaction);
			}
		});
	}

	/**
	 * Ends a giveaway. This method is automatically called when a giveaway ends.
	 * @param {Discord.Snowflake} messageID The message ID of the giveaway
	 * @returns {Promise<Discord.GuildMember[]>} The winners
	 *
	 * @example
	 * manager.end("664900661003157510");
	 */
	end(messageID) {
		return new Promise(async (resolve, reject) => {
			const giveaway = this.giveaways.find((g) => g.messageID === messageID);
			if (!giveaway) {
				return reject('No giveaway found with ID ' + messageID + '.');
			}
			giveaway.end().then(resolve).catch(reject);
		});
	}

	/**
	 * Starts a new giveaway
	 *
	 * @param {Discord.TextChannel} channel The channel in which the giveaway will be created
	 * @param {GiveawayStartOptions} options The options for the giveaway
	 *
	 * @returns {Promise<Giveaway>}
	 *
	 * @example
	 * manager.start(message.channel, {
	 *      prize: "Free Steam Key",
	 *      // Giveaway will last 10 seconds
	 *      time: 10000,
	 *      // One winner
	 *      winnerCount: 1,
	 *      // Limit the giveaway to members who have the Nitro Boost role
	 *      exemptMembers: (member) => !member.roles.some((r) => r.name === "Nitro Boost")
	 * });
	 */
	start(channel, options) {
		return new Promise(async (resolve, reject) => {
			if (!this.ready) {
				return reject('The manager is not ready yet.');
			}
			if (!options.messages) {
				options.messages = defaultGiveawayMessages;
			}
			if (!channel || !channel.id) {
				return reject(`channel is not a valid guildchannel. (val=${channel})`);
			}
			if (!options.time || isNaN(options.time)) {
				return reject(`options.time is not a number. (val=${options.time})`);
			}
			if (!options.prize) {
				return reject(`options.prize is not a string. (val=${options.prize})`);
			}
			if (!options.winnerCount || isNaN(options.winnerCount)) {
				return reject(`options.winnerCount is not a number. (val=${options.winnerCount})`);
			}
			let giveaway = new Giveaway(this, {
				startAt: Date.now(),
				endAt: Date.now() + options.time,
				winnerCount: options.winnerCount,
				channelID: channel.id,
				guildID: channel.guild.id,
				ended: false,
				threeSecondsRemaining: false,
				threeSecondsRemaining2: false,
				prize: options.prize,
				hostedBy: options.hostedBy ? options.hostedBy.toString() : null,
				messages: options.messages,
				reaction: options.reaction,
				botsCanWin: options.botsCanWin,
				exemptPermissions: options.exemptPermissions,
				exemptMembers: options.exemptMembers,
				embedColor: options.embedColor,
				embedColorEnd: options.embedColorEnd,
				rolereq: options.rolereq,
				roleid: options.roleid,
				joinedreq: options.joinedreq,
				joinedtime: options.joinedtime,
				agereq: options.agereq,
				agetime: options.agetime,
				messagereq: options.messagereq,
				messageamount: options.messageamount,
				isdrop: options.isdrop,
				serverreq: options.serverreq,
				serverlink: options.serverlink,
				serverslist: options.serverslist,
				bypassrole: options.bypassrole,
				giveawayMessageWinner: options.giveawayMessageWinner,
				winnerRole: options.winnerRole
			});
			let chance = await giveaway.winningChance();
			let timerwebsite = `https://aestetikmod.mirzabhakti.repl.co/timer/?started=${giveaway.startAt}&ended=${giveaway.endAt}&prize=${encodePrize(giveaway.prize)}`
			let bypassroleslist = '';
			let cc = 0;
			if (Array.isArray(giveaway.bypassrole) && giveaway.bypassrole.length > 1) {
				giveaway.bypassrole.forEach(function(role) {
					bypassroleslist += (c === 0 ? `📣 Users with <@&${role}> role can bypass.` : `\n📣 Users with <@&${role}> role can bypass.`)
					cc++
				})
			}
			else if (Array.isArray(giveaway.bypassrole) && giveaway.bypassrole.length === 1) {
				bypassroleslist += `📣 Users with <@&${giveaway.bypassrole}> role can bypass.`
			}
			let roleslist = '';
			let c = 0;
			if (Array.isArray(giveaway.roleid) && giveaway.roleid.length > 1) {
				giveaway.roleid.forEach(function(role) {
					roleslist += (c === 0 ? `📣 Must have the <@&${role}> role.` : `\n📣 Must have the <@&${role}> role.`)
					c++
				})
			}
			else if (Array.isArray(giveaway.roleid) && giveaway.roleid.length === 1) {
				roleslist += `📣 Must have the <@&${giveaway.roleid}> role.`
			}
			let embed = this.v12 ? new Discord.MessageEmbed() : new Discord.RichEmbed();
			embed
				.setColor(giveaway.embedColor)
				.setDescription(
					`🎁 • ${giveaway.prize}\n🏅 • ${giveaway.messages.winners}: ${giveaway.winnerCount}\n${giveaway.content}\n🎲 • Winning Chances: **${chance}**\nLive Timer: [Click Here!](${timerwebsite})\n${
                        giveaway.hostedBy ? giveaway.messages.hostedBy.replace('{user}', giveaway.hostedBy) : ''
                    }\n${options.messages.inviteToParticipate} \n\n\n${bypassroleslist}${giveaway.serverreq === true ? `\n${giveaway.serverslist}` : ''}${giveaway.rolereq === true ? `\n${roleslist}` : ''}${giveaway.joinedreq === true ? `\n📣 Must have been in this server for atleast **${pms(giveaway.joinedtime, {verbose: true})}**.` : ''}${giveaway.agereq === true ? `\n📣 Your account age must be older than **${pms(giveaway.agetime, {verbose: true})}**.` : ''}${giveaway.messagereq === true ? `\n📣 You need to send **${giveaway.messageamount}** ${(giveaway.messageamount > 1) ? `messages` : `message`} to this server.` : ''}`
				)
				.setFooter('Ended At:')
				.setTimestamp(giveaway.endAt);
			let message = await channel.send(options.isdrop ? options.messages.drop : options.messages.giveaway, {
				embed
			})
			roleslist = '';
			c = 0;
			bypassroleslist = '';
			cc = 0;
			message.react(giveaway.reaction);
			giveaway.messageID = message.id;
			this.giveaways.push(giveaway);
			await this.saveGiveaway(giveaway.messageID, giveaway.data);
			await this._updateGiveaway(giveaway)
			resolve(giveaway);
		});
	}

	ValidEntries(messageID) {
		return new Promise(async (resolve, reject) => {
			const giveaway = this.giveaways.find((g) => g.messageID === messageID);
			if (!giveaway) {
				return reject('No giveaway found with ID ' + messageID + '.');
			}
			giveaway.ValidEntry().then(resolve).catch(reject);
		});
	}
	winningChance(messageID) {
		return new Promise(async (resolve, reject) => {
			const giveaway = this.giveaways.find((g) => g.messageID === messageID);
			if (!giveaway) {
				return reject('No giveaway found with ID ' + messageID + '.');
			}
			giveaway.winningChance().then(resolve).catch(reject);
		});
	}
	timeRemaining(messageID) {
		return new Promise(async (resolve, reject) => {
			const giveaway = this.giveaways.find((g) => g.messageID === messageID);
			if (!giveaway) {
				return reject('No giveaway found with ID ' + messageID + '.');
			}
			resolve(giveaway.content)
		});
	}

	/**
	 * Choose new winner(s) for the giveaway
	 * @param {Discord.Snowflake} messageID The message ID of the giveaway to reroll
	 * @param {GiveawayRerollOptions} options The reroll options
	 * @returns {Promise<Discord.GuildMember[]>} The new winners
	 *
	 * @example
	 * manager.reroll("664900661003157510");
	 */
	reroll(messageID, options = {}) {
		return new Promise(async (resolve, reject) => {
			options = merge(defaultRerollOptions, options);
			let giveawayData = this.giveaways.find((g) => g.messageID === messageID);
			if (!giveawayData) {
				return reject('No giveaway found with ID ' + messageID + '.');
			}
			let giveaway = new Giveaway(this, giveawayData);
			giveaway.reroll(options).then((winners) => {
				this.emit('giveawayRerolled', giveaway, winners)
				resolve();
			}).catch(reject);
		});
	}

	/**
	 * Edits a giveaway. The modifications will be applicated when the giveaway will be updated.
	 * @param {Discord.Snowflake} messageID The message ID of the giveaway to edit
	 * @param {GiveawayEditOptions} options The edit options
	 * @returns {Promise<Giveaway>} The edited giveaway
	 *
	 * @example
	 * manager.edit("664900661003157510", {
	 *      newWinnerCount: 2,
	 *      newPrize: "Something new!",
	 *      addTime: -10000 // The giveaway will end 10 seconds earlier
	 * });
	 */
	edit(messageID, options = {}) {
		return new Promise(async (resolve, reject) => {
			const giveaway = this.giveaways.find((g) => g.messageID === messageID);
			if (!giveaway) {
				return reject('No giveaway found with ID ' + messageID + '.');
			}
			giveaway.edit(options).then(resolve).catch(reject);
		});
	}

	/**
	 * Deletes a giveaway. It will delete the message and all the giveaway data.
	 * @param {Discord.Snowflake} messageID  The message ID of the giveaway
	 * @param {boolean} doNotDeleteMessage Whether the giveaway message shouldn't be deleted
	 * @returns {Promise<void>}
	 */
	delete(messageID, doNotDeleteMessage) {
		return new Promise(async (resolve, reject) => {
			const giveaway = this.giveaways.find((g) => g.messageID === messageID);
			if (!giveaway) {
				return reject('No giveaway found with ID ' + messageID + '.');
			}
			if (!giveaway.channel) {
				return reject('Unable to get the channel of the giveaway with message ID ' + giveaway.messageID + '.');
			}
			if (!doNotDeleteMessage) {
				await giveaway.fetchMessage().catch(() => {});
				if (giveaway.message) {
					// Delete the giveaway message
					giveaway.message.delete();
				}
			}
			this.giveaways = this.giveaways.filter((g) => g.messageID !== messageID);
			await this.deleteGiveaway(messageID);
			resolve();
		});
	}

	/**
	 * Delete a giveaway from the database
	 * @param {Discord.Snowflake} messageID The message ID of the giveaway to delete
	 * @returns {Promise<void>}
	 */
	async deleteGiveaway(messageID) {
		await writeFileAsync(
			this.options.storage,
			JSON.stringify(this.giveaways.map((giveaway) => giveaway.data)),
			'utf-8'
		);
		this.refreshStorage();
		return;
	}

	/**
	 * Refresh the cache to support shards.
	 * @ignore
	 */
	async refreshStorage() {
		return true;
	}

	/**
	 * Gets the giveaways from the storage file, or create it
	 * @ignore
	 * @returns {Promise<GiveawayData[]>}
	 */
	async getAllGiveaways() {
		// Whether the storage file exists, or not
		let storageExists = await existsAsync(this.options.storage);
		// If it doesn't exists
		if (!storageExists) {
			// Create the file with an empty array
			await writeFileAsync(this.options.storage, '[]', 'utf-8');
			return [];
		}
		else {
			// If the file exists, read it
			let storageContent = await readFileAsync(this.options.storage);
			try {
				let giveaways = await JSON.parse(storageContent.toString());
				if (Array.isArray(giveaways)) {
					return giveaways;
				}
				else {
					console.log(storageContent, giveaways);
					throw new SyntaxError('The storage file is not properly formatted (giveaways is not an array).');
				}
			}
			catch (e) {
				if (e.message === 'Unexpected end of JSON input') {
					throw new SyntaxError('The storage file is not properly formatted (Unexpected end of JSON input).');
				}
				else {
					throw e;
				}
			}
		}
	}

	/**
	 * Edit the giveaway in the database
	 * @ignore
	 * @param {Discord.Snowflake} messageID The message ID identifying the giveaway
	 * @param {GiveawayData} giveawayData The giveaway data to save
	 */
	async editGiveaway(messageID, giveawayData) {
		await writeFileAsync(
			this.options.storage,
			JSON.stringify(this.giveaways.map((giveaway) => giveaway.data)),
			'utf-8'
		);
		this.refreshStorage();
		return;
	}

	/**
	 * Save the giveaway in the database
	 * @ignore
	 * @param {Discord.Snowflake} messageID The message ID identifying the giveaway
	 * @param {GiveawayData} giveawayData The giveaway data to save
	 */
	async saveGiveaway(messageID, giveawayData) {
		await writeFileAsync(
			this.options.storage,
			JSON.stringify(this.giveaways.map((giveaway) => giveaway.data)),
			'utf-8'
		);
		this.refreshStorage();
		return;
	}

	/**
	 * Checks each giveaway and update it if needed
	 * @ignore
	 * @private
	 */
	async _updateGiveaway(giveaway) {
		if (!giveaway) return;
		if (giveaway.ended) return;
		if (!giveaway.channel) return;
		if (giveaway.remainingTime <= 0) {
			return this.end(giveaway.messageID).catch(() => {});
		}
		await giveaway.fetchMessage().catch(() => {});
		if (!giveaway.message) {
			giveaway.ended = true;
			await this.editGiveaway(giveaway.messageID, giveaway.data);
			return;
		}
		let chance = await giveaway.winningChance();
		let timerwebsite = `https://aestetikmod.mirzabhakti.repl.co/timer/?started=${giveaway.startAt}&ended=${giveaway.endAt}&prize=${encodePrize(giveaway.prize)}`
		await this.updateServerRequirement(giveaway);
		let bypassroleslist = '';
		let cc = 0;
		if (Array.isArray(giveaway.bypassrole) && giveaway.bypassrole.length > 1) {
			giveaway.bypassrole.forEach(function(role) {
				bypassroleslist += (c === 0 ? `📣 Users with <@&${role}> role can bypass.` : `\n📣 Users with <@&${role}> role can bypass.`)
				cc++
			})
		}
		else if (Array.isArray(giveaway.bypassrole) && giveaway.bypassrole.length === 1) {
			bypassroleslist += `📣 Users with <@&${giveaway.bypassrole}> role can bypass.`
		}
		let roleslist = '';
		let c = 0;
		if (Array.isArray(giveaway.roleid) && giveaway.roleid.length > 1) {
			giveaway.roleid.forEach(function(role) {
				roleslist += (c === 0 ? `📣 Must have the <@&${role}> role.` : `\n📣 Must have the <@&${role}> role.`)
				c++
			})
		}
		else if (Array.isArray(giveaway.roleid) && giveaway.roleid.length === 1) {
			roleslist += `📣 Must have the <@&${giveaway.roleid}> role.`
		}
		let embed = this.v12 ? new Discord.MessageEmbed() : new Discord.RichEmbed();
		(this.options.default.lastChance.enabled && giveaway.remainingTime < this.options.default.lastChance.secondsBeforeLastChance ? embed.setColor(this.options.default.lastChance.lastEmbedColor) : embed.setColor(giveaway.embedColor))
		embed
			.setDescription(
				`🎁 • ${giveaway.prize}\n🏅 • ${giveaway.messages.winners}: ${giveaway.winnerCount}\n🎲 • Winning Chances: **${chance}**\n${giveaway.content}\nLive Timer: [Click Here!](${timerwebsite})\n${
                        giveaway.hostedBy ? giveaway.messages.hostedBy.replace('{user}', giveaway.hostedBy) : ''
                    }\n${giveaway.options.messages.inviteToParticipate} \n\n\n${bypassroleslist}${giveaway.serverreq ? `\n${giveaway.serverslist}` : ''}${giveaway.rolereq === true ? `\n${roleslist}` : ''}${giveaway.joinedreq === true ? `\n📣 Must have been in this server for atleast **${pms(giveaway.joinedtime, {verbose: true})}**.` : ''}${giveaway.agereq === true ? `\n📣 Your account age must be older than **${pms(giveaway.agetime, {verbose: true})}**.` : ''}${giveaway.messagereq === true ? `\n📣 You need to send **${giveaway.messageamount}** ${(giveaway.messageamount > 1) ? `messages` : `message`} to this server.` : ''}`
			)
			.setFooter('Ended At:')
			.setTimestamp(giveaway.endAt)
		roleslist = '';
		c = 0;
		bypassroleslist = '';
		cc = 0;
		giveaway.message.edit((this.options.default.lastChance.enabled && giveaway.remainingTime < this.options.default.lastChance.secondsBeforeLastChance ? this.options.default.lastChance.title : giveaway.isdrop ? giveaway.messages.drop : giveaway.messages.giveaway), {
			embed
		});
		if (giveaway.remainingTime < this.options.updateCountdownEvery) {
			setTimeout(() => this.end.call(this, giveaway.messageID), giveaway.remainingTime);
		}
	}
	async updateServerRequirement(giveaway) {
		if (!giveaway) return;
		if (giveaway.ended) return;
		if (!giveaway.channel) return;
		if (giveaway.remainingTime <= 0) {
			return this.end(giveaway.messageID).catch(() => {});
		}
		await giveaway.fetchMessage().catch(() => {})
		giveaway.serverslist = '';
		let linec = 0;

		function addserver(invite) {
			let guildname = invite.guild.name;
			giveaway.serverslist += (linec === 0 ? `⚠️ Should be in [${guildname}](https://discord.gg/${invite.code}).` : `\n⚠️ Should be in [${guildname}](https://discord.gg/${invite.code}).`)
			linec++
			return giveaway.serverslist && linec;
		}

		function adderror(err) {
			giveaway.serverslist += (linec === 0 ? `⚠️ Some of the server requirements doesn't work properly. Please make sure that the invite links are permanent.` : `\n⚠️ Some of the server requirements doesn't work properly. Please make sure that the invite links are permanent.`)
			return giveaway.serverslist;
		}
		if (Array.isArray(giveaway.serverlink) && giveaway.serverlink.length > 1) {
			giveaway.serverlink.forEach(function(invitelink) {
				giveaway.message.client.fetchInvite(invitelink).then(function(invite) {
					addserver(invite)
				}).catch(function(err) {
					adderror(err)
				})
			})
		}
		else if (Array.isArray(giveaway.serverlink) && giveaway.serverlink.length === 1) {
			giveaway.message.client.fetchInvite(giveaway.serverlink).then(function(invite) {
				addserver(invite)
			}).catch(function(err) {
				adderror(err)
			})
		}
		await this.editGiveaway(giveaway.messageID, giveaway.data)
	}
	_updateServerRequirement() {
		if (this.giveaways.length <= 0) return;
		this.giveaways.forEach(async (giveaway) => {
			if (giveaway.ended) return;
			if (!giveaway.channel) return;
			await giveaway.fetchMessage().catch(() => {})
			giveaway.serverslist = ''
			let linec = 0;

			function addserver(invite) {
				let guildname = invite.guild.name;
				giveaway.serverslist += (linec === 0 ? `⚠️ Should be in [${guildname}](https://discord.gg/${invite.code}).` : `\n⚠️ Should be in [${guildname}](https://discord.gg/${invite.code}).`)
				linec++
				return giveaway.serverslist && linec;
			}

			function adderror(err) {
				giveaway.serverslist += (linec === 0 ? `⚠️ Some of the server requirements doesn't work properly. Please make sure that the invite links are permanent.` : `\n⚠️ Some of the server requirements doesn't work properly. Please make sure that the invite links are permanent.`)
				return giveaway.serverslist;
			}
			if (Array.isArray(giveaway.serverlink) && giveaway.serverlink.length > 1) {
				giveaway.serverlink.forEach(function(invitelink) {
					giveaway.message.client.fetchInvite(invitelink).then(function(invite) {
						addserver(invite)
					}).catch(function(err) {
						adderror(err)
					})
				})
			}
			else if (Array.isArray(giveaway.serverlink) && giveaway.serverlink.length === 1) {
				giveaway.message.client.fetchInvite(giveaway.serverlink).then(function(invite) {
					addserver(invite)
				}).catch(function(err) {
					adderror(err)
				})
			}
			await this.editGiveaway(giveaway.messageID, giveaway.data)
		})
	}
	async lastGiveaway() {
		if (this.giveaways.length <= 0) return;
		this.giveaways.forEach(async (giveaway) => {
			if (!giveaway) return;
			if (giveaway.ended) return;
			if (!giveaway.channel) return;
			if (giveaway.remainingTime <= 0) {
				return this.end(giveaway.messageID).catch(() => {});
			}
			await giveaway.fetchMessage().catch(() => {});
			if (giveaway.remainingTime < 4000) giveaway.threeSecondsRemaining = true
			if (!giveaway.message) return;
			if (giveaway.threeSecondsRemaining && !giveaway.threeSecondsRemaining2) {
				giveaway.threeSecondsRemaining2 = true;
				await this.editGiveaway(giveaway.messageID, giveaway.data)
				let threeSeconds = 3;

				async function embed() {
					let chance = await giveaway.winningChance();
					let timerwebsite = `https://aestetikmod.mirzabhakti.repl.co/timer/?started=${giveaway.startAt}&ended=${giveaway.endAt}&prize=${encodePrize(giveaway.prize)}`
					let bypassroleslist = '';
					let cc = 0;
					if (Array.isArray(giveaway.bypassrole) && giveaway.bypassrole.length > 1) {
						giveaway.bypassrole.forEach(function(role) {
							bypassroleslist += (c === 0 ? `📣 Users with <@&${role}> role can bypass.` : `\n📣 Users with <@&${role}> role can bypass.`)
							cc++
						})
					}
					else if (Array.isArray(giveaway.bypassrole) && giveaway.bypassrole.length === 1) {
						bypassroleslist += `📣 Users with <@&${giveaway.bypassrole}> role can bypass.`
					}
					let roleslist = '';
					let c = 0;
					if (Array.isArray(giveaway.roleid) && giveaway.roleid.length > 1) {
						giveaway.roleid.forEach(function(role) {
							roleslist += (c === 0 ? `📣 Must have the <@&${role}> role.` : `\n📣 Must have the <@&${role}> role.`)
							c++
						})
					}
					else if (Array.isArray(giveaway.roleid) && giveaway.roleid.length === 1) {
						roleslist += `📣 Must have the <@&${giveaway.roleid}> role.`
					}
					let embed = new Discord.MessageEmbed();
					embed
						.setColor('RED')
						.setDescription(
							`🎁 • ${giveaway.prize}\n🏅 • ${giveaway.messages.winners}: ${giveaway.winnerCount}\n🎲 • Winning Chances: **${chance}**\n**Time remaining: ${threeSeconds} ${(threeSeconds > 1) ? 'seconds' : 'second'}**!\nLive Timer: [Click Here!](${timerwebsite})\n${
                        giveaway.hostedBy ? giveaway.messages.hostedBy.replace('{user}', giveaway.hostedBy) : ''
                    }\n${giveaway.options.messages.inviteToParticipate} \n\n\n${bypassroleslist}${giveaway.serverreq ? `\n${giveaway.serverslist}` : ''}${giveaway.rolereq === true ? `\n${roleslist}` : ''}${giveaway.joinedreq === true ? `\n📣 Must have been in this server for atleast **${pms(giveaway.joinedtime, {verbose: true})}**.` : ''}${giveaway.agereq === true ? `\n📣 Your account age must be older than **${pms(giveaway.agetime, {verbose: true})}**.` : ''}${giveaway.messagereq === true ? `\n📣 You need to send **${giveaway.messageamount}** ${(giveaway.messageamount > 1) ? `messages` : `message`} to this server.` : ''}`
						)
						.setFooter('Ended At:')
						.setTimestamp(giveaway.endAt)
					roleslist = '';
					c = 0;
					bypassroleslist = '';
					cc = 0;
					return embed;
				}
				if (!giveaway.ended) giveaway.message.edit((this.options.default.lastChance.enabled && giveaway.remainingTime < this.options.default.lastChance.secondsBeforeLastChance ? this.options.default.lastChance.title : giveaway.isdrop ? giveaway.messages.drop : giveaway.messages.giveaway), await embed());
				await wait(1000)
				if (!giveaway.ended) {
					threeSeconds -= 1
					giveaway.message.edit((this.options.default.lastChance.enabled && giveaway.remainingTime < this.options.default.lastChance.secondsBeforeLastChance ? this.options.default.lastChance.title : giveaway.isdrop ? giveaway.messages.drop : giveaway.messages.giveaway), await embed());
				}
				await wait(1000)
				if (!giveaway.ended) {
					threeSeconds -= 1
					giveaway.message.edit((this.options.default.lastChance.enabled && giveaway.remainingTime < this.options.default.lastChance.secondsBeforeLastChance ? this.options.default.lastChance.title : giveaway.isdrop ? giveaway.messages.drop : giveaway.messages.giveaway), await embed());
				}
				await wait(1000)
				if (!giveaway.ended) {
					threeSeconds -= 1
					giveaway.message.edit((this.options.default.lastChance.enabled && giveaway.remainingTime < this.options.default.lastChance.secondsBeforeLastChance ? this.options.default.lastChance.title : giveaway.isdrop ? giveaway.messages.drop : giveaway.messages.giveaway), await embed());
					this.end.call(this, giveaway.messageID)
					//await this.editGiveaway(giveaway.messageID, giveaway.data)
				}
			}
		})
	}
	_checkGiveaway() {
		if (this.giveaways.length <= 0) return;
		this.giveaways.forEach(async (giveaway) => {
			if (giveaway.ended) return;
			if (giveaway.threeSecondsRemaining) return;
			if (!giveaway.channel) return;
			if (giveaway.remainingTime <= 0) {
				return this.end(giveaway.messageID).catch(() => {});
				if (giveaway.remainingTime < 5000) return;
			}
			await giveaway.fetchMessage().catch(() => {});
			if (!giveaway.message) {
				giveaway.ended = true;
				await this.editGiveaway(giveaway.messageID, giveaway.data);
				return;
			}
			let chance = await giveaway.winningChance();
			let timerwebsite = `https://aestetikmod.mirzabhakti.repl.co/timer/?started=${giveaway.startAt}&ended=${giveaway.endAt}&prize=${encodePrize(giveaway.prize)}`
			let bypassroleslist = '';
			let cc = 0;
			if (Array.isArray(giveaway.bypassrole) && giveaway.bypassrole.length > 1) {
				giveaway.bypassrole.forEach(function(role) {
					bypassroleslist += (c === 0 ? `📣 Users with <@&${role}> role can bypass.` : `\n📣 Users with <@&${role}> role can bypass.`)
					cc++
				})
			}
			else if (Array.isArray(giveaway.bypassrole) && giveaway.bypassrole.length === 1) {
				bypassroleslist += `📣 Users with <@&${giveaway.bypassrole}> role can bypass.`
			}
			let roleslist = '';
			let c = 0;
			if (Array.isArray(giveaway.roleid) && giveaway.roleid.length > 1) {
				giveaway.roleid.forEach(function(role) {
					roleslist += (c === 0 ? `📣 Must have the <@&${role}> role.` : `\n📣 Must have the <@&${role}> role.`)
					c++
				})
			}
			else if (Array.isArray(giveaway.roleid) && giveaway.roleid.length === 1) {
				roleslist += `📣 Must have the <@&${giveaway.roleid}> role.`
			}
			let embed = this.v12 ? new Discord.MessageEmbed() : new Discord.RichEmbed();
			(this.options.default.lastChance.enabled && giveaway.remainingTime < this.options.default.lastChance.secondsBeforeLastChance ? embed.setColor(this.options.default.lastChance.lastEmbedColor) : embed.setColor(giveaway.embedColor))
			embed
				.setDescription(
					`🎁 • ${giveaway.prize}\n🏅 • ${giveaway.messages.winners}: ${giveaway.winnerCount}\n🎲 • Winning Chances: **${chance}**\n${giveaway.content}\nLive Timer: [Click Here!](${timerwebsite})\n${
                        giveaway.hostedBy ? giveaway.messages.hostedBy.replace('{user}', giveaway.hostedBy) : ''
                    }\n${giveaway.options.messages.inviteToParticipate} \n\n\n${bypassroleslist}${giveaway.serverreq ? `\n${giveaway.serverslist}` : ''}${giveaway.rolereq === true ? `\n${roleslist}` : ''}${giveaway.joinedreq === true ? `\n📣 Must have been in this server for atleast **${pms(giveaway.joinedtime, {verbose: true})}**.` : ''}${giveaway.agereq === true ? `\n📣 Your account age must be older than **${pms(giveaway.agetime, {verbose: true})}**.` : ''}${giveaway.messagereq === true ? `\n📣 You need to send **${giveaway.messageamount}** ${(giveaway.messageamount > 1) ? `messages` : `message`} to this server.` : ''}`
				)
				.setFooter('Ended At:')
				.setTimestamp(giveaway.endAt)
			roleslist = '';
			c = 0;
			bypassroleslist = '';
			cc = 0;
			giveaway.message.edit((this.options.default.lastChance.enabled && giveaway.remainingTime < this.options.default.lastChance.secondsBeforeLastChance ? this.options.default.lastChance.title : giveaway.isdrop ? giveaway.messages.drop : giveaway.messages.giveaway), {
				embed
			});
			/* if (giveaway.remainingTime < this.options.updateCountdownEvery) {
			     setTimeout(() => this.end.call(this, giveaway.messageID), giveaway.remainingTime);
			 }*/
		});
	}

	/**
	 * Inits the manager
	 * @ignore
	 * @private
	 */
	async _init() {
		const rawGiveaways = await this.getAllGiveaways();
		rawGiveaways.forEach((giveaway) => {
			this.giveaways.push(new Giveaway(this, giveaway));
		});
		setInterval(() => {
			if (this.client.readyAt) this.lastGiveaway();
		}, 1000)
		setInterval(() => {
			if (this.client.readyAt) this._checkGiveaway.call(this);
		}, this.options.updateCountdownEvery);
		setInterval(() => {
			if (this.client.readyAt) this._updateServerRequirement.call(this);
		}, 500000)
		setTimeout(() => {
			if (this.client.readyAt) this._updateServerRequirement.call(this)
		}, 10000)
		this.ready = true;
	}
}

/**
 * Emitted when a giveaway ends.
 * @event GiveawaysManager#giveawayEnded
 * @param {Giveaway} giveaway The giveaway instance
 * @param {Discord.GuildMember[]} winners The giveaway winners
 *
 * @example
 * // This can be used to add features such as a congratulatory message in DM
 * manager.on('giveawayEnded', (giveaway, winners) => {
 *      winners.forEach((member) => {
 *          member.send('Congratulations, '+member.user.username+', you won: '+giveaway.prize);
 *      });
 * });
 */

/**
 * Emitted when someone entered a giveaway.
 * @event GiveawaysManager#giveawayReactionAdded
 * @param {Giveaway} giveaway The giveaway instance
 * @param {Discord.GuildMember} member The member who entered the giveaway
 * @param {Discord.MessageReaction} reaction The reaction to enter the giveaway
 *
 * @example
 * // This can be used to add features like removing the user reaction
 * manager.on('giveawayReactionAdded', (giveaway, member, reaction) => {
 *     const hasJoinedAnotherServer = client.guilds.cache.get('39803980830938').members.has(member.id);
 *     if(!hasJoinedAnotherServer){
 *          reaction.users.remove(member.user);
 *          member.send('You must join this server to participate to the giveaway: https://discord.gg/discord-api');
 *     }
 * });
 */

/**
 * Emitted when someone remove their reaction to a giveaway.
 * @event GiveawaysManager#giveawayReactionRemoved
 * @param {Giveaway} giveaway The giveaway instance
 * @param {Discord.GuildMember} member The member who remove their reaction giveaway
 * @param {Discord.MessageReaction} reaction The reaction to enter the giveaway
 *
 * @example
 * manager.on('giveawayReactionRemoved', (giveaway, member, reaction) => {
 *      return member.send('That's sad, you won\'t be able to win the super cookie!');
 * });
 */

/**
 * Emitted when a giveaway is rerolled.
 * @event GiveawaysManager#giveawayRerolled
 * @param {Giveaway} giveaway The giveaway instance
 * @param {Discord.GuildMember[]} winners The winners of the giveaway
 * 
 * @example
 * // This can be used to add features such as a congratulatory message in DM
 * manager.on('giveawayRerolled', (giveaway, winners) => {
 *      winners.forEach((member) => {
 *          member.send('Congratulations, '+member.user.username+', you won: '+giveaway.prize);
 *      });
 * });
 */

module.exports = GiveawaysManager;

function encodePrize(prize) {
	return encodeURIComponent(prize)
}