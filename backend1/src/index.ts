import { Hono } from "hono";
const app = new Hono();

import os from "os";

app.get("/info", (c) => {
  const network = os.networkInterfaces();

  const ips: string[] = [];

  for (const name of Object.keys(network)) {
    const net = network[name];
    if (!net) continue;

    for (const n of net) {
      if (n.family === "IPv4" && !n.internal) {
        ips.push(n.address);
      }
    }
  }

  const info = {
    hostname: os.hostname(),
    pid: process.pid,
    platform: process.platform,
    arch: process.arch,
    uptime: process.uptime(),
    cpu: os.cpus().length,
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
    },
    ips,
  };

  return c.json(info);
});

app.get("/ping-to/:ip", async (c) => {
  const ip = c.req.param("ip");

  const proc = Bun.spawn(["ping", "-c", "3", ip], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  const error = await new Response(proc.stderr).text();

  const exitCode = await proc.exited;

  return c.json({
    target: ip,
    exitCode,
    success: exitCode === 0,
    output,
    error: error || null,
  });
});

export default app;
