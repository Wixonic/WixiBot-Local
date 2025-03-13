const url = "ws://localhost:1000/";

let currentPlayer = "w";
let currentBoard = null;
let best = {
	from: null,
	to: null
};
let lastMove = {
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

									const newBoard = {};
									for (const piece of message.data.board) {
										const key = `${piece.column}-${piece.line}`;
										newBoard[key] = piece;
										const pieceEl = document.createElement("div");
										pieceEl.classList.add("piece", piece.color + piece.type);
										pieceEl.style.gridColumn = piece.column;
										pieceEl.style.gridRow = 9 - piece.line;
										boardEl.append(pieceEl);
									}

									if (currentBoard && Object.keys(currentBoard).length) {
										let origin = null, destination = null;
										for (const key in currentBoard) {
											if (!newBoard[key]) {
												origin = key;
												break;
											}
										}
										for (const key in newBoard) {
											if (!currentBoard[key]) {
												destination = key;
												break;
											}
										}
										if (origin && destination) {
											lastMove = { from: origin, to: destination };
										}
									}

									document.querySelectorAll(".last-move-highlight").forEach(el => el.remove());

									if (lastMove.from) {
										const [col, line] = lastMove.from.split("-").map(Number);
										const originHighlight = document.createElement("div");
										originHighlight.classList.add("last-move-highlight");
										originHighlight.style.gridColumn = col;
										originHighlight.style.gridRow = 9 - line;
										boardEl.append(originHighlight);
									}

									if (lastMove.to) {
										const [col, line] = lastMove.to.split("-").map(Number);
										const destHighlight = document.createElement("div");
										destHighlight.classList.add("last-move-highlight");
										destHighlight.style.gridColumn = col;
										destHighlight.style.gridRow = 9 - line;
										boardEl.append(destHighlight);
									}

									currentBoard = newBoard;

									document.querySelector("#best").innerHTML = document.querySelector("#depth").innerHTML = document.querySelector("#score-value").innerHTML = document.querySelector("#mate").innerHTML = "";

									updateSVG();

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
											updateSVG();
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
											let mate = 0;

											if (currentPlayer == "w") mate = Number(entry[1]);
											else mate = -Number(entry[1]);

											document.querySelector("#mate").innerHTML = `Mate in ${Math.abs(mate)}`;
											document.querySelector("#score-bar .bar").style.height = `${Math.min(100, Math.max(0, 50 + Math.sign(mate) * 50))}%`;
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

const updateSVG = () => {
	const board = document.querySelector("#board");
	const svgns = "http://www.w3.org/2000/svg";

	let svg = document.querySelector("svg");

	if (!svg) {
		svg = document.createElementNS(svgns, "svg");
		board.append(svg);
	}

	svg.innerHTML = "";

	if (!best.from || !best.to) return;

	const algebraicToGrid = (alg) => {
		const col = alg.charCodeAt(0) - "a".charCodeAt(0) + 1;
		const row = parseInt(alg[1]);
		return { col, row: 9 - row };
	};

	const start = algebraicToGrid(best.from);
	const end = algebraicToGrid(best.to);

	const boardRect = board.getBoundingClientRect();
	const cellWidth = boardRect.width / 8;
	const cellHeight = boardRect.height / 8;

	const startX = (start.col - 0.5) * cellWidth;
	const startY = (start.row - 0.5) * cellHeight;
	const endX = (end.col - 0.5) * cellWidth;
	const endY = (end.row - 0.5) * cellHeight;

	let defs = svg.querySelector("defs");

	if (!defs) {
		defs = document.createElementNS(svgns, "defs");
		svg.appendChild(defs);
	}

	const marker = document.createElementNS(svgns, "marker");
	marker.setAttribute("id", "arrowhead");
	marker.setAttribute("markerWidth", "5");
	marker.setAttribute("markerHeight", "5");
	marker.setAttribute("refX", "0");
	marker.setAttribute("refY", "2.5");
	marker.setAttribute("orient", "auto");

	const markerPath = document.createElementNS(svgns, "polygon");
	markerPath.setAttribute("points", "0 0, 5 2.5, 0 5");
	markerPath.setAttribute("fill", `#${currentPlayer == "w" ? "FFF" : "000"}A`);
	marker.appendChild(markerPath);
	defs.appendChild(marker);

	const line = document.createElementNS(svgns, "line");
	line.setAttribute("x1", startX);
	line.setAttribute("y1", startY);
	line.setAttribute("x2", endX);
	line.setAttribute("y2", endY);
	line.setAttribute("stroke", `#${currentPlayer == "w" ? "FFF" : "000"}A`);
	line.setAttribute("stroke-width", "4");
	line.setAttribute("marker-end", "url(#arrowhead)");
	svg.appendChild(line);

	for (let i = 0; i < 8; i++) {
		const letter = String.fromCharCode("a".charCodeAt(0) + i);
		const text = document.createElementNS(svgns, "text");
		const x = (i + 0.5) * cellWidth;
		const y = boardRect.height - 5;

		text.setAttribute("x", x);
		text.setAttribute("y", y);
		text.setAttribute("paint-order", "stroke fill");
		text.setAttribute("fill", "#FFF");
		text.setAttribute("stroke", "#000");
		text.setAttribute("stroke-width", "2");
		text.setAttribute("font-size", "14");
		text.setAttribute("font-family", `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue"`);
		text.setAttribute("font-weight", "bold");
		text.setAttribute("text-anchor", "middle");
		text.textContent = letter;
		svg.appendChild(text);
	}

	for (let i = 0; i < 8; i++) {
		const number = 8 - i;
		const text = document.createElementNS(svgns, "text");
		const x = 5;
		const y = (i + 0.5) * cellHeight + 3;

		text.setAttribute("x", x);
		text.setAttribute("y", y);
		text.setAttribute("paint-order", "stroke fill");
		text.setAttribute("fill", "#FFF");
		text.setAttribute("stroke", "#000");
		text.setAttribute("stroke-width", "2");
		text.setAttribute("font-family", `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue"`);
		text.setAttribute("font-size", "14");
		text.setAttribute("font-weight", "bold");
		text.setAttribute("text-anchor", "start");
		text.textContent = number;
		svg.appendChild(text);
	}
};


const wait = (milliseconds) => new Promise((resolve) => setTimeout(() => resolve(), milliseconds));

connectWebSocket();