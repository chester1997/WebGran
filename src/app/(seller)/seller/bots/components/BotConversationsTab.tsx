"use client";

import React from "react";
import ConversasCenter, { CustomerItem, MessageItem } from "./ConversasCenter";
import ConversasCenterV2 from "./ConversasCenterV2";

export type { CustomerItem, MessageItem };

interface BotConversationsTabProps {
  botId: string;
  botUsername: string;
  initialCustomers: CustomerItem[];
  initialMessages?: MessageItem[];
  showNotification: (type: "success" | "error", message: string) => void;
  bot?: {
    id: string;
    botId: string;
    username: string;
    displayName: string;
    photoUrl?: string | null;
    status: string;
  };
  /** Redesign V2: true apenas para a conta proprietária (decidido no servidor). */
  useRedesignV2?: boolean;
}

export default function BotConversationsTab({
  botId,
  botUsername,
  initialCustomers,
  initialMessages = [],
  showNotification,
  bot,
  useRedesignV2 = false,
}: BotConversationsTabProps) {
  const resolvedBot = bot || {
    id: botId,
    botId,
    username: botUsername,
    displayName: botUsername,
    photoUrl: null,
    status: "active",
  };

  const Center = useRedesignV2 ? ConversasCenterV2 : ConversasCenter;

  return (
    <Center
      bot={resolvedBot}
      initialCustomers={initialCustomers}
      initialMessages={initialMessages}
      showNotification={showNotification}
      isModal={false}
    />
  );
}
