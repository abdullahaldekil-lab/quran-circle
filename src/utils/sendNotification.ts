import { supabase } from "@/integrations/supabase/client";

interface SendNotificationParams {
  templateCode: string;
  recipientIds: string[];
  variables?: Record<string, string>;
  metaData?: Record<string, unknown>;
}

export const sendNotification = async (params: SendNotificationParams) => {
  try {
    const { data, error } = await supabase.functions.invoke("send-notification", {
      body: params,
    });
    if (error) {
      console.error("Notification send error:", error);
      return { success: false, error };
    }
    return { success: true, data };
  } catch (err) {
    console.error("Notification send exception:", err);
    return { success: false, error: err };
  }
};
