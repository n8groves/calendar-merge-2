const https = require("https");
const http = require("http");

const urls = [
  { name: "SCREAMING SQUIRRELS", url: "https://ics.benchapp.com/eyJwbGF5ZXJJZCI6MTEzODE0NjAsInRlYW1JZCI6WzcwMzA5OV19" },
  { name: "MASTODONS PINEY #1", url: "https://ics.benchapp.com/eyJwbGF5ZXJJZCI6MTEzODE0NjAsInRlYW1JZCI6WzkzNTU0M119" },
  { name: "2 FOR HOOKING PINEY (SUB)", url: "https://ics.benchapp.com/eyJwbGF5ZXJJZCI6MTEzODE0NjAsInRlYW1JZCI6WzExMDMzNjldfQ==" },
  { name: "MASTODONS LAUREL (SUB)", url: "https://ics.benchapp.com/eyJwbGF5ZXJJZCI6MTEzODE0NjAsInRlYW1JZCI6WzExOTU1NDFdfQ==" },
  { name: "BULLETS LAUREL", url: "http://ical-cdn.teamsnap.com/team_schedule/77ba7c90-06b5-0132-3ecf-3c764e05ae1d.ics" }
];

// 🔁 Fetch with redirect support + safety
function fetchICS(url, redirects = 5) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;

    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/calendar,*/*"
      }
    };

    lib.get(url, options, (res) => {
      // Handle redirects (301/302)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (redirects === 0) return resolve("");

        const nextUrl = res.headers.location.startsWith("http")
          ? res.headers.location
          : new URL(res.headers.location, url).href;

        return resolve(fetchICS(nextUrl, redirects - 1));
      }

      let data = "";

      res.on("data", chunk => data += chunk);

      res.on("end", () => {
        if (res.statusCode !== 200) {
          console.log(`Failed (${res.statusCode}): ${url}`);
          return resolve("");
        }
        resolve(data);
      });
    }).on("error", (err) => {
      console.log(`Error: ${url} -> ${err.message}`);
      resolve("");
    });
  });
}

// Tag events so you can see source team
function tagEvents(content, label) {
  return content
    .split("BEGIN:VEVENT")
    .slice(1)
    .map(event => {
      let e = "BEGIN:VEVENT" + event;
      e = e.replace(/SUMMARY:(.*)/, `SUMMARY:[${label}] $1`);
      return e;
    });
}

(async () => {
  const files = await Promise.all(urls.map(u => fetchICS(u.url)));

  const events = files
    .map((file, i) => {
      if (!file) return [];
      return tagEvents(file, urls[i].name);
    })
    .flat();

  const merged = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR"
  ].join("\n");

  require("fs").writeFileSync("merged.ics", merged);
})();
