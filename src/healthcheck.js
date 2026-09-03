import http from "node:http";

const port = Number(process.env.PORT || 3000);
const request = http.get({ host: "127.0.0.1", port, path: "/health", timeout: 2000 }, (response) => {
  response.resume();
  process.exitCode = response.statusCode === 200 ? 0 : 1;
});

request.on("timeout", () => request.destroy(new Error("Health check timed out")));
request.on("error", () => {
  process.exitCode = 1;
});
