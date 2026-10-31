import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { io as createClient } from "socket.io-client";
import { createGameServer } from "../server/index.js";

const questionBank = [
	{ it: "Chi diventerebbe famoso?", en: "Who would become famous?" },
];

function request(socket, eventName, payload = {}) {
	return new Promise((resolve) => socket.emit(eventName, payload, resolve));
}

async function connect(url) {
	const socket = createClient(url, { reconnection: false });
	await once(socket, "connect");
	return socket;
}

test("shares a room, protects host actions, and uses queued questions next", async (t) => {
	const server = createGameServer({ questionBank });
	await server.listen(0, "127.0.0.1");
	t.after(() => server.close());

	const address = server.httpServer.address();
	const url = `http://127.0.0.1:${address.port}`;
	const host = await connect(url);
	const player = await connect(url);
	t.after(() => host.disconnect());
	t.after(() => player.disconnect());

	const created = await request(host, "room:create", { hostName: "Host", language: "it" });
	assert.equal(created.ok, true);
	const joined = await request(player, "room:join", { roomCode: created.roomCode, name: "Alex" });
	assert.equal(joined.ok, true);

	const started = await request(host, "host:start");
	assert.equal(started.ok, true);
	const hiddenState = await request(player, "room:state:get");
	assert.equal(hiddenState.state.results, null);
	assert.equal("votes" in hiddenState.state, false);

	const queued = await request(player, "question:submit", { text: "Chi inventerebbe un gioco?" });
	assert.equal(queued.ok, true);
	const forbiddenReveal = await request(player, "host:reveal");
	assert.equal(forbiddenReveal.ok, false);

	assert.equal((await request(host, "host:reveal")).ok, true);
	const next = await request(host, "host:next");
	assert.equal(next.ok, true);
	assert.equal(next.state.currentPrompt.it, "Chi inventerebbe un gioco?");
});
