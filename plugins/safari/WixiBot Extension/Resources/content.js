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
			 sendStatus("POST", "/rpc/github/", {
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
			 sendStatus("POST", "/rpc/github/", {
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

			 for (let x = 0; x < dataScripts.length; ++x) {
				 try {
					 const dataScript = JSON.parse(dataScripts[x].innerHTML);

					 if (dataScript["@type"] == "VideoObject") {
						 data = dataScript;
						 break;
					 }
				 } catch { }
			 }

			 sendStatus("POST", "/rpc/youtube/", {
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
	 }, { // https://[*.]twitch.tv
		 matches: [
			 /^https:\/\/(?:[\w-]+\.)*twitch\.tv/m
		 ],
		 run: (_) => {
			 sendStatus("POST", "/rpc/twitch/", {
				 type: "desktop"
			 });

			 onUnload.path = "/rpc/twitch/";
			 onUnload.data = {
				 type: "desktop"
			 };
		 }
	 }
 ];

 const sendStatus = (method = "POST", path = "/", data = {}) => {
	 browser.runtime.sendMessage({
		 action: "sendStatus",
		 method: method,
		 url: new URL(path, "http://localhost:1000").toString(),
		 data: data
	 }, (response) => {
		 if (response && response.error) {
			 console.error("Error:", response.error);
		 } else {
			 console.log("Response:", response.data);
		 }
	 });
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
				 return;
			 }
		 }
	 }
 };

 check();
 setInterval(check, 10000);
 window.addEventListener("beforeunload", () => {
	 if (onUnload.path) {
		 if (navigator.sendBeacon) {
			 const url = new URL(onUnload.path, "http://localhost:1000");
			 const blob = new Blob([JSON.stringify(onUnload.data)], {
				 type: "application/json"
			 });
			 navigator.sendBeacon(url, blob);
		 } else {
			 sendStatus("DELETE", onUnload.path, onUnload.data);
		 }
	 }
});