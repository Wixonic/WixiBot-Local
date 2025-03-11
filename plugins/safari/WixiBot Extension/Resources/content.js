const chess = {
	regexp: /^https:\/\/www\.chess\.com\/game\/(\d+)/m, // https://www.chess.com/game/:id
	previousBoard: null,

	fetchBoard: () => {
		const boardEl = document.querySelector("wc-chess-board");
		const pieceEls = boardEl?.querySelectorAll(".piece");

		const board = [];

		for (const pieceEl of (pieceEls ?? [])) {
			const piece = {};

			for (const value of pieceEl.classList.values()) {
				const pre = "square-";
				if (value.startsWith(pre)) {
					piece.column = value.at(pre.length);
					piece.line = value.at(pre.length + 1);
				} else if (value.length == 2) {
					piece.color = value[0];
					piece.type = value[1];
				}
			}

			board.push(piece);
		}

		return board;
	},

	generateFEN: (board) => {
		const emptyBoard = Array.from({ length: 8 }, () => Array(8).fill(null));

		for (const { column, line, color, type } of board) {
			const symbol = color === "w" ? type.toUpperCase() : type.toLowerCase();
			emptyBoard[8 - parseInt(line)][parseInt(column) - 1] = symbol;
		}

		const boardFEN = emptyBoard.map((row) => {
			let emptyCount = 0;
			return row.map((cell) => {
				if (cell === null) {
					emptyCount++;
					return "";
				} else {
					const res = (emptyCount > 0 ? emptyCount : "") + cell;
					emptyCount = 0;
					return res;
				}
			}).join("") + (emptyCount > 0 ? emptyCount : "");
		}).join("/");

		return `${boardFEN} ${document.querySelector(".clock-black").classList.contains("clock-player-turn") ? "b" : "w"} - - 0 1`;
	},

	update: () => {
		const regexpResults = chess.regexp.exec(location.href);

		if (regexpResults?.length > 0) {
			const board = chess.fetchBoard();

			if (JSON.stringify(board) != JSON.stringify(chess.previousBoard)) {
				const FEN = chess.generateFEN(board);

				console.log(FEN);

				send("POST", "/chess/", {
					board,
					FEN,
					url: `https://www.chess.com/game/${regexpResults[1]}`
				});

				chess.previousBoard = board;
			}
		}

		setTimeout(() => chess.update(), 250);
	}
};

const onUnload = {
	data: null,
	path: null
};

const extensions = [
	{ // https://github.com/:owner/:repository[:anything]
		matches: [
			/^https:\/\/github\.com\/([\w-]+)\/([\w-]+)/m
		],
		run: (_, owner, repository) => {
			send("POST", "/rpc/github/", {
				type: "repository",
				owner,
				repository
			});

			onUnload.path = "/rpc/github/";
			onUnload.data = {
				type: "repository"
			};
		}
	}, { // https://github.com/:profile[:anything]
		matches: [
			/^https:\/\/github\.com\/([\w-]+)/m
		],
		run: (_, profile) => {
			send("POST", "/rpc/github/", {
				type: "profile",
				profile
			});

			onUnload.path = "/rpc/github/";
			onUnload.data = {
				type: "profile"
			};
		}
	}, { // https://[*.]youtube.com/watch[:anything]
		matches: [
			/^https:\/\/(?:[\w-]+\.)*youtube.com\/watch/m
		],
		run: (_) => {
			const dataScripts = document.querySelectorAll(`script[type="application/ld+json"]`);
			let data = {};

			for (let x = 0; x < (dataScripts ?? []).length; ++x) {
				try {
					const dataScript = JSON.parse(dataScripts[x].innerHTML);

					if (dataScript["@type"] == "VideoObject") {
						data = dataScript;
						break;
					}
				} catch { }
			}

			if (data != {}) {
				send("POST", "/rpc/youtube/", {
					type: "video",
					author: data.author,
					name: data.name,
					thumbnail: (data.thumbnailUrl ?? [])[0],
					url: `https://www.youtube.com/watch?v=${data.embedUrl.slice("https://www.youtube.com/embed/".length)}`
				});

				onUnload.path = "/rpc/youtube/";
				onUnload.data = {
					type: "video"
				};
			}
		}
	}, {
		// https://www.chess.com/game/:id
		matches: [chess.regexp],

		run: (_, id) => {
			send("POST", "/rpc/chess/", {
				url: `https://www.chess.com/game/${id}`
			});

			onUnload.path = "/rpc/chess/";
		}
	}
];

const send = async (method = "POST", path = "/", data = {}) => {
	const response = await browser.runtime.sendMessage({
		action: "send",
		method,
		url: new URL(path, "http://localhost:1000").toString(),
		data
	});

	if (response) {
		if (response.error) console.error("Error:", response.error);
		else console.log("Response:", response.data);
	}
};

const check = () => {
	const url = location.href;

	for (const extension of extensions) {
		for (const match of extension.matches) {
			const results = match.exec(url);

			if (results?.length > 0) {
				try {
					extension.run(...results);
				} catch (e) {
					console.warn(e);
				}

				break;
			}
		}
	}

	setTimeout(check, 10000);
};

window.addEventListener("load", () => {
	check();
	chess.update();
});

window.addEventListener("beforeunload", async () => {
	if (onUnload.path) {
		const response = await browser.runtime.sendMessage({
			action: "send",
			method: "DELETE",
			url: new URL(onUnload.path, "http://localhost:1000").toString(),
			data: onUnload.data
		});

		if (response) {
			if (response.error) console.error("Error:", response.error);
			else console.log("Response:", response.data);
		}
	}
});