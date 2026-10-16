import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getEnv, getServerConfig } from "./config";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

function headerValue(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(headerValue(value), "utf8").toString("base64")}?=`;
}

/**
 * Yerel kurulumda e-postalar gonderilmez; RFC 5322 bicimindeki .eml dosyalari olarak giden kutusu
 * klasorune yazilir. Bir SMTP saglayicisi baglandiginda yalnizca bu fonksiyon degisir.
 */
export async function sendMail(message: MailMessage) {
  const { mailOutboxDir } = getServerConfig();
  const from = headerValue(getEnv("MAIL_FROM") ?? "Operasyon Portali <no-reply@localhost>");
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const eml = [
    `From: ${from}`,
    `To: ${headerValue(message.to)}`,
    `Subject: ${encodeHeader(message.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${id}@operations-portal.local>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    message.text.replace(/\r?\n/g, "\r\n")
  ].join("\r\n");

  await mkdir(mailOutboxDir, { recursive: true });
  const file = join(mailOutboxDir, `${id}.eml`);
  await writeFile(file, eml, { encoding: "utf8", mode: 0o600 });
  console.info(JSON.stringify({ level: "info", event: "mail_written_to_outbox", file }));
  return { id, file };
}
