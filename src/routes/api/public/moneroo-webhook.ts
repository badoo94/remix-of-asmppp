import { createFileRoute } from "@tanstack/react-router";

// Moneroo calls this after a payment. We never trust the body: the payment id is
// re-verified against Moneroo's API with the secret key before any change.
export const Route = createFileRoute("/api/public/moneroo-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as { data?: { id?: string } } | null;
        const paymentId = body?.data?.id;
        if (!paymentId || typeof paymentId !== "string" || paymentId.length > 200) {
          return new Response("ignored", { status: 200 });
        }
        try {
          const { verifyAndSyncPayment } = await import("@/lib/moneroo.server");
          await verifyAndSyncPayment(paymentId);
        } catch (e) {
          console.error("moneroo webhook", e);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
