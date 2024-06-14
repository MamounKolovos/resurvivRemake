import {
    type ClientToServerTeamMsg,
    type RoomData,
    type ServerToClientTeamMsg,
    type TeamStateMsg,
    type TeamErrorMsg,
    type TeamMenuPlayer
} from "../../shared/net";
import { math } from "../../shared/utils/math";
import { type TeamMenuPlayerContainer, type AbstractServer } from "./abstractServer";

interface RoomPlayer extends TeamMenuPlayer {
    socketData: TeamMenuPlayerContainer
}

export interface Room {
    roomData: RoomData
    id: string
    players: RoomPlayer[]
}

type ErrorType =
    "join_full" |
    "join_not_found" |
    "create_failed" |
    "join_failed" |
    "join_game_failed" |
    "lost_conn" |
    "find_game_error" |
    "find_game_full" |
    "find_game_invalid_protocol" |
    "kicked";

function teamErrorMsg(type: ErrorType): TeamErrorMsg {
    return {
        type: "error",
        data: {
            type
        }
    };
}

const alphanumerics = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
function randomString(len: number) {
    let str = "";
    let i = 0;
    while (i < len) {
        str += alphanumerics.charAt(Math.floor(Math.random() * alphanumerics.length));
        i++;
    }
    return `${str}`;
}

export class TeamMenu {
    rooms = new Map<string, Room>();

    constructor(public server: AbstractServer) {

    }

    addRoom(id: string, roomUrl: string, initialRoomData: RoomData, roomLeader: RoomPlayer) {
        const value = {
            id,
            roomData: {
                roomUrl,
                region: initialRoomData.region,
                gameModeIdx: initialRoomData.gameModeIdx,
                enabledGameModeIdxs: [1, 2],
                autoFill: initialRoomData.autoFill,
                findingGame: initialRoomData.findingGame,
                lastError: initialRoomData.lastError,
                maxPlayers: math.clamp(initialRoomData.gameModeIdx * 2, 2, 4)
            },
            players: [roomLeader]
        };
        this.rooms.set(roomUrl, value);
        return value;
    }

    /**
     * removes player from all necessary data structures (room, idToSocketSend map, id allocator)
     */
    removePlayer(playerContainer: TeamMenuPlayerContainer): void {
        const room = this.rooms.get(playerContainer.roomUrl)!;

        const pToRemove = room.players.find(p => p.socketData === playerContainer)!;
        const pToRemoveIndex = room.players.indexOf(pToRemove);
        room.players.splice(pToRemoveIndex, 1);

        if (room.players.length == 0) {
            this.rooms.delete(playerContainer.roomUrl);
            return;
        }

        // if leader leaves, make next player in array the new leader
        if (pToRemove.isLeader) {
            room.players[0].isLeader = true;
        }

        // send the new room state to all remaining players
        this.sendRoomState(room);
    }

    /**
     * @param player player to send the response to
     */
    sendResponse(response: ServerToClientTeamMsg, player: RoomPlayer): void {
        player.socketData.sendMsg(JSON.stringify(response));
    }

    /**
     * @param players players to send the message to
     */
    sendResponses(response: ServerToClientTeamMsg, players: RoomPlayer[]): void {
        for (const player of players) {
            this.sendResponse(response, player);
        }
    }

    /**
     * the only properties that can change are: region, gameModeIdx, autoFill, and maxPlayers (by virtue of gameModeIdx)
     */
    modifyRoom(newRoomData: RoomData, room: Room): void {
        room.roomData.gameModeIdx = newRoomData.gameModeIdx;
        room.roomData.maxPlayers = math.clamp(room.roomData.gameModeIdx * 2, 2, 4);
        room.roomData.autoFill = newRoomData.autoFill;
        room.roomData.region = newRoomData.region;
    }

    sendRoomState(room: Room) {
        for (let i = 0; i < room.players.length; i++) {
            const player = room.players[i];
            const msg: TeamStateMsg = {
                type: "state",
                data: {
                    localPlayerId: room.players.indexOf(player),
                    room: room.roomData,
                    players: room.players.map((player, id) => {
                        return {
                            name: player.name,
                            playerId: id,
                            isLeader: player.isLeader,
                            inGame: player.inGame
                        };
                    })
                }
            };

            player.socketData.sendMsg(JSON.stringify(msg));
        }
    }

    handleMsg(message: ArrayBuffer, localPlayerData: TeamMenuPlayerContainer): void {
        const parsedMessage: ClientToServerTeamMsg = JSON.parse(new TextDecoder().decode(message));
        const type = parsedMessage.type;
        let response: ServerToClientTeamMsg;

        switch (type) {
        case "create": {
            const name = parsedMessage.data.playerData.name != "" ? parsedMessage.data.playerData.name : "Player";

            const player: RoomPlayer = {
                name,
                isLeader: true,
                inGame: false,
                playerId: 0,
                socketData: localPlayerData
            };

            const activeCodes = new Set(this.rooms.keys());
            let roomUrl = `#${randomString(4)}`;
            while (activeCodes.has(roomUrl)) {
                roomUrl = `#${randomString(4)}`;
            }

            localPlayerData.roomUrl = roomUrl;

            const roomId = randomString(128);

            const room = this.addRoom(roomId, roomUrl, parsedMessage.data.roomData, player);
            if (!room) {
                response = teamErrorMsg("create_failed");
                this.sendResponse(response, player);
                break;
            }

            this.sendRoomState(room);
            break;
        }
        case "join": {
            const roomUrl = `#${parsedMessage.data.roomUrl}`;
            const room = this.rooms.get(roomUrl);
            // join fail if room doesnt exist or if room is already full
            if (!room) {
                response = teamErrorMsg("join_failed");
                localPlayerData.sendMsg(JSON.stringify(response));
                break;
            }
            if (room.roomData.maxPlayers == room.players.length) {
                response = teamErrorMsg("join_full");
                localPlayerData.sendMsg(JSON.stringify(response));
                break;
            }

            let name = parsedMessage.data.playerData.name;
            name = name != "" ? name : "Player";

            const player = {
                name,
                isLeader: false,
                inGame: false,
                playerId: room.players.length - 1,
                socketData: localPlayerData
            } as RoomPlayer;
            room.players.push(player);

            localPlayerData.roomUrl = roomUrl;

            this.sendRoomState(room);
            break;
        }
        case "changeName": {
            const newName = parsedMessage.data.name;
            const room = this.rooms.get(localPlayerData.roomUrl)!;
            const player = room.players.find(p => p.socketData === localPlayerData)!;
            player.name = newName;

            this.sendRoomState(room);
            break;
        }
        case "setRoomProps": {
            const newRoomData = parsedMessage.data;
            const room = this.rooms.get(localPlayerData.roomUrl)!;
            const player = room.players.find(p => p.socketData === localPlayerData)!;
            if (!player.isLeader) {
                return;
            }

            this.modifyRoom(newRoomData, room);
            this.sendRoomState(room);
            break;
        }
        case "kick": {
            const room = this.rooms.get(localPlayerData.roomUrl)!;
            const player = room.players.find(p => p.socketData === localPlayerData)!;
            if (!player.isLeader) {
                return;
            }
            const pToKick = room.players[parsedMessage.data.playerId];
            if (!pToKick || pToKick === player) {
                return;
            }
            this.removePlayer(localPlayerData);

            response = {
                type: "kicked"
            };
            this.sendResponse(response, pToKick);
            break;
        }
        case "keepAlive": {
            const room = this.rooms.get(localPlayerData.roomUrl);
            if (!room) return;
            response = {
                type: "keepAlive",
                data: {}
            };
            this.sendResponses(response, room.players);
            break;
        }
        case "playGame": { // this message can only ever be sent by the leader
            const room = this.rooms.get(localPlayerData.roomUrl)!;
            const player = room.players.find(p => p.socketData === localPlayerData)!;

            if (!player.isLeader) {
                return;
            }

            room.roomData.findingGame = true;
            this.sendRoomState(room);

            const playData = this.server.findGame(parsedMessage.data.region).res[0];

            if ("err" in playData) {
                response = teamErrorMsg("find_game_error");
                this.sendResponse(response, player);
                return;
            }
            const game = this.server.games.find(game => game && game.id === playData.gameId)!;

            if (game.teamMode !== room.roomData.gameModeIdx * 2) {
                response = teamErrorMsg("find_game_error");
                this.sendResponse(response, player);
                return;
            }

            game.addGroup(room.id);

            response = {
                type: "joinGame",
                data: {
                    ...playData,
                    data: room.id
                }
            };
            this.sendResponses(response, room.players);

            room.players.forEach((p) => { p.inGame = true; });
            room.roomData.findingGame = false;
            this.sendRoomState(room);
            break;
        }
        case "gameComplete": { // doesn't necessarily mean game is over, sent when player leaves game and returns to team menu
            const room = this.rooms.get(localPlayerData.roomUrl)!;
            const player = room.players.find(p => p.socketData === localPlayerData)!;
            player.inGame = false;

            this.sendRoomState(room);
            break;
        }
        }
    }
}
