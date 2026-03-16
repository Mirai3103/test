import { Hono } from "hono";
import { SQL } from "bun";
import os from "os";

const app = new Hono();

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

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.get("/connect-db", async (c) => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return c.json(
      {
        ok: false,
        status: "missing_env",
        message: "DATABASE_URL is not set",
      },
      500,
    );
  }

  let db: SQL | null = null;

  try {
    db = new SQL(databaseUrl);

    const startedAt = Date.now();
    const result = await db`SELECT 1 as ping`;
    const durationMs = Date.now() - startedAt;

    return c.json({
      ok: true,
      status: "connected",
      message: "Database connection successful",
      durationMs,
      database: {
        urlExists: true,
        adapter: detectAdapter(databaseUrl),
      },
      ping: result?.[0]?.ping ?? 1,
    });
  } catch (error) {
    return c.json(
      {
        ok: false,
        status: "connect_failed",
        message:
          error instanceof Error ? error.message : "Unknown database error",
        database: {
          urlExists: true,
          adapter: detectAdapter(databaseUrl),
        },
      },
      500,
    );
  } finally {
    try {
      await db?.close();
    } catch {
      // ignore close error
    }
  }
});

function detectAdapter(databaseUrl: string) {
  const url = databaseUrl.toLowerCase();

  if (url.startsWith("mysql://") || url.startsWith("mysql2://")) {
    return "mysql";
  }

  if (
    url.startsWith("sqlite://") ||
    url === ":memory:" ||
    url.endsWith(".db") ||
    url.endsWith(".sqlite") ||
    url.endsWith(".sqlite3")
  ) {
    return "sqlite";
  }

  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return "postgres";
  }

  return "unknown_or_postgres_fallback";
}

export default app;
