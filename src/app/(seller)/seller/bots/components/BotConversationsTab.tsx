"use client";

import React from "react";
import ConversasCenter, { CustomerItem, MessageItem } from "./ConversasCenter";

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
}

export default function BotConversationsTab({
  botId,
  botUsername,
  initialCustomers,
  initialMessages = [],
  showNotification,
  bot,
}: BotConversationsTabProps) {
  const resolvedBot = bot || {
    id: botId,
    botId,
    username: botUsername,
    displayName: botUsername,
    photoUrl: null,
    status: "active",
  };

  return (
    <ConversasCenter
      bot={resolvedBot}
      initialCustomers={initialCustomers}
      initialMessages={initialMessages}
      showNotification={showNotification}
      isModal={false}
    />
  );
}
