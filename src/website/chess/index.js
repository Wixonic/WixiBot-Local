const url = "ws://localhost:1000/";

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

					ws.addEventListener("message", (event) => {
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

									ws.send(JSON.stringify({
										type: "predict"
									}));
								}
								break;

							default:
								console.log(message);
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

connectWebSocket();