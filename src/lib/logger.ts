// Server-only — do not import in client components
import pino from "pino";

const isDev = process.env.NODE_ENV === "development";
const logtailToken = process.env.LOGTAIL_SOURCE_TOKEN;

function makeTransport(): ReturnType<typeof pino.transport> | undefined {
  if (isDev) {
    return pino.transport({
      target: "pino-pretty",
      options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
    });
  }
  if (logtailToken) {
    return pino.transport({
      targets: [
        { target: "pino/file", options: { destination: 1 }, level: "info" },
        { target: "@logtail/pino", options: { sourceToken: logtailToken }, level: "info" },
      ],
    });
  }
  return undefined;
}

export const log = pino({ level: process.env.LOG_LEVEL ?? "info" }, makeTransport());
