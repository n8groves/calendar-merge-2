const https = require("https");
const http = require("http");
const fs = require("fs");

const urls = [
  { name: "SCREAMING SQUIRRELS", url: "https://api.myleaguehero.com/v1/calendar/eca05ccead6eecba0112b5e0ad0a5e8f9fcbd572c6c5b5a8517d48e81aaccfff.ics" },
  { name: "MASTODONS PINEY #1", url: "https://ics.benchapp.com/eyJwbGF5ZXJJZCI6MTEzODE0NjAsInRlYW1JZCI6WzkzNTU0M119" },
  { name: "MASTODONS LAUREL", url: "https://api.myleaguehero.com/v1/calendar/938b26bbadb36ea0e587723ffda514a122d9bcc774bd8307485338b18de6b9a3.ics" },
  { name: "BULLETS LAUREL", url: "https://api.myleaguehero.com/v1/calendar/30f4c8d62b32c989c2bf03f12de83f3729b428862e036b1eab766a9b9b0353c2.ics" }
];

// 🔁 Fetch ICS with redirect + timeout + safety
function fetchICS(url, redirects = 5) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;

    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/calendar,*/*"
      },
      timeout: 10000
    };

    const req = lib.get(url, options, (res) => {
      // Handle redirects
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
    });

    req.on("timeout", () => {
      req.destroy();
      console.log(`Timeout: ${url}`);
      resolve("");
    });

    req.on("error", (err) => {
      console.log(`Error: ${url} -> ${err.message}`);
      resolve("");
    });
  });
}

// 🧹 Extract ONLY VEVENT blocks (fixes Google Calendar issue)
function extractEvents(content) {
  return content
    .replace(/BEGIN:VCALENDAR/g, "")
    .replace(/END:VCALENDAR/g, "")
    .split("BEGIN:VEVENT")
    .slice(1)
    .map(e => "BEGIN:VEVENT" + e);
}

// 🏷 Tag each event with team name
function tagEvents(events, label) {
  return events.map(event => {
    return event.replace(/SUMMARY:(.*)/, `SUMMARY:[${label}] $1`);
  });
}

(async () => {
  console.log("Fetching calendars...");

  const files = await Promise.all(
    urls.map(async (u) => {
      const data = await fetchICS(u.url);
      console.log(`${u.name}: ${data.length} chars`);
      return data;
    })
  );

  const events = files
    .map((file, i) => {
      if (!file) return [];

      const extracted = extractEvents(file);
      return tagEvents(extracted, urls[i].name);
    })
    .flat();

  console.log(`Total events merged: ${events.length}`);

  const merged = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR"
  ].join("\n");

  fs.writeFileSync("merged.ics", merged);

  console.log("merged.ics updated successfully");
})();
