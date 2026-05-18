'use client';

import type { ReactNode } from 'react';

import { MarkdownMessage } from './MarkdownMessage';
import { RobustaAvatar } from './RobustaAvatar';

export type ChatMessageItem = {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  children?: ReactNode;
  streaming?: boolean;
};

export function RobustaChatMessage({ message }: { message: ChatMessageItem }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isUser && <RobustaAvatar />}
      <div
        className={[
          'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'glass-button-primary ml-auto rounded-br-sm text-white'
            : 'glass-card rounded-bl-sm text-foreground',
        ].join(' ')}
      >
        {message.content ? (
          isUser ? (
            <span className="whitespace-pre-wrap">{message.content}</span>
          ) : (
            <MarkdownMessage content={message.content} isStreaming={message.streaming} />
          )
        ) : null}
        {message.children}
      </div>
    </div>
  );
}
