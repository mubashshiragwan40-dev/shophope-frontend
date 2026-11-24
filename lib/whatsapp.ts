// lib/whatsapp.ts
import "server-only";

const PHONE_NUMBER_ID: string | undefined = process.env.META_WA_PHONE_NUMBER_ID;
const ACCESS_TOKEN: string | undefined = process.env.META_WA_ACCESS_TOKEN;
const ORDER_CONFIRMED_TEMPLATE: string =
  process.env.META_WA_TEMPLATE_ORDER_CONFIRMED || "order_confirmation_kw";
const TEMPLATE_LANG: string = process.env.META_WA_TEMPLATE_LANG || "en";

export async function sendWhatsAppOrderConfirmation(params: {
  phoneWithCode: string;
  customerName: string;
  orderNumber: string;
  totalKd: string;
  area: string;
}): Promise<boolean> {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    return false;
  }

  const recipientWaId: string = params.phoneWithCode.replace(/\D/g, "");
  if (!recipientWaId) return false;

  const formattedTotal: string = `KD ${Number(params.totalKd).toFixed(3)}`;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipientWaId,
          type: "template",
          template: {
            name: ORDER_CONFIRMED_TEMPLATE,
            language: { code: TEMPLATE_LANG },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: params.customerName },
                  { type: "text", text: `#${params.orderNumber}` },
                  { type: "text", text: formattedTotal },
                  { type: "text", text: params.area },
                ],
              },
            ],
          },
        }),
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const errBody: string = await res.text();
      console.error("[meta-whatsapp] Send failed:", res.status, errBody);
      return false;
    }

    return true;
  } catch (err: unknown) {
    console.error("[meta-whatsapp] Request error:", err);
    return false;
  }
}