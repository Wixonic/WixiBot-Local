const url = "ws://localhost:1000/";

let currentPlayer = "w";
let best = {
	from: null,
	to: null
};

const connectWebSocket = () => {
	/** @type {WebSocket?} */
	let ws = null;

	const connect = () => {
		console.log("Connecting WebSocket...");

		ws = new WebSocket(url);

		ws.addEventListener("open", () => {
			console.log("WebSocket connected");

			ws.addEventListener("message", (event) => {
				if (event.data == "0x00") {
					console.log("Server answered");

					ws.addEventListener("message", async (event) => {
						const message = JSON.parse(event.data);

						switch (message.type) {
							case "board":
								if (message.data?.board) {
									const boardEl = document.querySelector("#board");
									boardEl.innerHTML = "";

									for (const piece of message.data.board) {
										const pieceEl = document.createElement("div");
										pieceEl.classList.add("piece", piece.color + piece.type);
										pieceEl.style.gridColumn = piece.column;
										pieceEl.style.gridRow = 9 - piece.line;
										boardEl.append(pieceEl);
									}

									document.querySelector("#best").innerHTML = document.querySelector("#depth").innerHTML = document.querySelector("#score-value").innerHTML = "";
									document.querySelector("#score-bar .bar").style.height = "50%";

									await wait(100);

									ws.send(JSON.stringify({
										type: "predict"
									}));
								}

								if (message.data?.FEN) currentPlayer = message.data.FEN.split(" ")[1];
								break;

							default:
								for (const entry of Object.entries(message)) {
									switch (entry[0]) {
										case "best":
											best = {
												from: entry[1].slice(0, 2),
												to: entry[1].slice(2, 4)
											};
											document.querySelector("#best").innerHTML = `${best.from} &rarr; ${best.to}`;
											break;

										case "depth":
											document.querySelector("#depth").innerHTML = `Depth: ${entry[1]}`;
											break;

										case "score":
											let score = 0;

											if (currentPlayer == "w") score = Number(entry[1]);
											else score = -Number(entry[1]);
											score /= 100;


											document.querySelector("#score-value").innerHTML = `Score: ${Math.abs(score)}${score == 0 ? "" : ` for ${score > 0 ? "whites" : "blacks"}`}`;

											document.querySelector("#score-bar .bar").style.height = `${Math.min(100, Math.max(0, 50 + score * 7))}%`;
											break;

										case "mate":
											document.querySelector("#mate").innerHTML = `Mate in ${Math.abs(entry[1])}`;
											document.querySelector("#score-bar .bar").style.height = `${Math.min(100, Math.max(0, 50 + Math.sign(entry[1]) * 50))}%`;
											break;

										default:
											console.log("Unhandled message key:", entry[0], entry[1]);
											break;
									}
								}
								break;
						}
					});
				} else console.log("Server didn't answer properly");
			}, {
				once: true
			});

			ws.send(new Uint8Array([0x01]));
		});

		ws.addEventListener("error", (e) => {
			console.log("WebSocket error:", e);
			ws.close();
		});

		ws.addEventListener("close", () => {
			console.log("WebSocket closed, attempting to reconnect...");
			setTimeout(connect, 1000);
		});
	};

	connect();
	return ws;
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(() => resolve(), milliseconds));

connectWebSocket();