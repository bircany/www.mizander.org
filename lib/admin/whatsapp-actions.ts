"use server";

import { revalidatePath } from "next/cache";

import { requireAdminUser } from "@/lib/admin/data";
import {
  connectEvolutionInstance,
  configureEvolutionDeliveryWebhook,
  disconnectEvolutionInstance,
  getEvolutionConnectionStatus,
  getEvolutionWebhookStatus,
  type EvolutionConnectionStatus,
  type EvolutionWebhookStatus,
} from "@/lib/qurbani/evolution";

export type WhatsAppActionState = {
  success: boolean;
  message: string | null;
  updatedAt?: string;
  status?: EvolutionConnectionStatus;
  webhook?: EvolutionWebhookStatus;
};

export async function manageWhatsAppConnection(
  _: WhatsAppActionState,
  formData: FormData,
): Promise<WhatsAppActionState> {
  await requireAdminUser(["admin"]);
  const intent = String(formData.get("intent") || "status");

  try {
    if (intent === "disconnect") {
      if (formData.get("confirm") !== "disconnect") {
        throw new Error("WhatsApp bağlantısını kapatma onayı eksik.");
      }
      await disconnectEvolutionInstance();
    } else if (intent === "webhook") {
      const webhook = await configureEvolutionDeliveryWebhook();
      revalidatePath("/panel/whatsapp");
      return {
        success: true,
        message: webhook.message,
        updatedAt: new Date().toISOString(),
        status: await getEvolutionConnectionStatus(),
        webhook,
      };
    } else if (intent !== "connect" && intent !== "status") {
      throw new Error("WhatsApp bağlantı işlemi geçerli değil.");
    }

    const status =
      intent === "connect"
        ? await connectEvolutionInstance()
        : await getEvolutionConnectionStatus();
    revalidatePath("/panel/whatsapp");

    return {
      success: status.state !== "error" && status.state !== "unconfigured",
      updatedAt: new Date().toISOString(),
      message:
        intent === "disconnect"
          ? "WhatsApp bağlantısı kapatıldı. Yeniden bağlanmak için QR kodu oluşturabilirsiniz."
          : status.message || null,
      status,
      webhook: await getEvolutionWebhookStatus(),
    };
  } catch (error) {
    return {
      success: false,
      updatedAt: new Date().toISOString(),
      message:
        error instanceof Error
          ? error.message
          : "WhatsApp bağlantı işlemi tamamlanamadı.",
      status: await getEvolutionConnectionStatus(),
      webhook: await getEvolutionWebhookStatus(),
    };
  }
}
