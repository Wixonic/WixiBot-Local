const https = require("https");
const http = require("http");
const fs = require("fs");

const DURATION_MS = 5 * 60 * 1000; // 5 minutes
const INTERVAL_MS = 1000; // 1 second
const LOG_FILE = "network.log";
const HOST = process.env.HOST || "https://server.wixonic.fr/";

console.log(`Starting network monitor for ${DURATION_MS / 60000} minutes...`);
console.log(`Target: ${HOST}`);
console.log(`Logging to ${LOG_FILE}`);

const stream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
const startTime = Date.now();
const stats = {
	total: 0,
	success: 0,
	fail: 0,
	minLatency: Infinity,
	maxLatency: 0,
	totalLatency: 0
};

const log = (msg) => {
	const time = new Date().toISOString();
	const line = `[${time}] ${msg}`;
	console.log(line);
	stream.write(line + "\n");
};

const ping = () => {
	const now = Date.now();
	if (now - startTime > DURATION_MS) {
		finish();
		return;
	}

	stats.total++;
	const reqStart = Date.now();
	const protocol = HOST.startsWith("https") ? https : http;

	const req = protocol.get(HOST, (res) => {
		const latency = Date.now() - reqStart;
		stats.totalLatency += latency;
		stats.minLatency = Math.min(stats.minLatency, latency);
		stats.maxLatency = Math.max(stats.maxLatency, latency);

		if (res.statusCode >= 200 && res.statusCode < 300 || res.statusCode === 404) {
			// 404 is "success" in terms of connectivity (server reached)
			stats.success++;
			log(`SUCCESS - Status: ${res.statusCode} - Latency: ${latency}ms`);
		} else {
			stats.fail++;
			log(`FAIL - Status: ${res.statusCode} - Latency: ${latency}ms`);
		}
	});

	req.on("error", (e) => {
		const latency = Date.now() - reqStart;
		stats.fail++;
		log(`ERROR - ${e.message} - Latency: ${latency}ms`);
	});

	req.setTimeout(5000, () => {
		req.destroy();
		log(`TIMEOUT - Latency: >5000ms`);
	});
};

const finish = () => {
	stream.end();
	console.log("\n--- MONITORING COMPLETE ---");
	console.log(`Total Requests: ${stats.total}`);
	console.log(`Success Rate: ${((stats.success / stats.total) * 100).toFixed(2)}%`);
	console.log(`Failures: ${stats.fail}`);
	console.log(`Avg Latency: ${(stats.totalLatency / stats.success).toFixed(2)}ms`);
	console.log(`Min/Max Latency: ${stats.minLatency}ms / ${stats.maxLatency}ms`);
	console.log(`Full log saved to ${LOG_FILE}`);
	process.exit(0);
};

// Start the loop
setInterval(ping, INTERVAL_MS);
ping(); // First one immediately
