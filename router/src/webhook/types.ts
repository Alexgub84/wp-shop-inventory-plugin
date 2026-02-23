import { z } from 'zod'

export const incomingMessageSchema = z.object({
  typeWebhook: z.string(),
  instanceData: z.object({
    idInstance: z.number(),
    wid: z.string()
  }),
  senderData: z.object({
    chatId: z.string(),
    sender: z.string()
  }),
  messageData: z.object({
    typeMessage: z.string(),
    textMessageData: z.object({
      textMessage: z.string()
    }).optional(),
    extendedTextMessageData: z.object({
      text: z.string()
    }).optional()
  }),
  idMessage: z.string()
})

export type IncomingMessage = z.infer<typeof incomingMessageSchema>

export interface ExtractedMessage {
  type: 'text'
  content: string
}

export function extractMessageContent(payload: IncomingMessage): ExtractedMessage | null {
  const { typeMessage } = payload.messageData

  if (typeMessage === 'textMessage') {
    const text = payload.messageData.textMessageData?.textMessage ?? null
    if (!text) return null
    return { type: 'text', content: text }
  }

  if (typeMessage === 'extendedTextMessage') {
    const text = payload.messageData.extendedTextMessageData?.text ?? null
    if (!text) return null
    return { type: 'text', content: text }
  }

  return null
}
