import { Webhook } from "svix";
import { headers } from "next/headers";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmailTemplate } from "@/lib/email/templates";
import { log } from "@/lib/logger";

interface ClerkEmailAddress {
  email_address: string;
}

interface ClerkUserCreatedEvent {
  type: "user.created";
  data: {
    id: string;
    first_name: string | null;
    email_addresses: ClerkEmailAddress[];
  };
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return new Response("CLERK_WEBHOOK_SECRET not set", { status: 500 });
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: ClerkUserCreatedEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as ClerkUserCreatedEvent;
  } catch (err) {
    log.error({ err }, "Clerk webhook signature verification failed");
    return new Response("Invalid signature", { status: 400 });
  }

  if (evt.type === "user.created") {
    const email = evt.data.email_addresses[0]?.email_address;
    const firstName = evt.data.first_name ?? "";
    if (email) {
      await sendEmail({
        to: email,
        subject: "¡Bienvenido/a a ListWise! Tu primer listing en 60 segundos 🚀",
        html: welcomeEmailTemplate({ firstName }),
      });
    }
  }

  return new Response("OK", { status: 200 });
}
