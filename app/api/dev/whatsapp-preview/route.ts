import { NextRequest, NextResponse } from 'next/server'
import {
  WHATSAPP_TEMPLATES,
  type WhatsAppTemplateKey,
} from '@/lib/consumer/whatsapp/templates'
import { isWhatsAppEnabled, sendWhatsAppMessage } from '@/lib/consumer/whatsapp/send'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' }

/**
 * Dev-only WhatsApp template preview / send-test endpoint.
 *
 * Hard-404s in production.
 *
 *   GET ?template=booking_confirmation_nl
 *     → returns the Meta submission text + the JSON payload that would
 *       be sent to the Graph API on a real send
 *
 *   GET ?template=booking_confirmation_nl&send=+31612345678
 *     → if WHATSAPP_ENABLED=true, fires an actual send
 *     → if WHATSAPP_ENABLED!=true, returns feature_disabled
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404, headers: NO_STORE })
  }

  const url = new URL(request.url)
  const templateKey = (url.searchParams.get('template') ?? '') as WhatsAppTemplateKey
  const sendTo = url.searchParams.get('send')

  const template = WHATSAPP_TEMPLATES[templateKey]
  if (!template) {
    return NextResponse.json(
      {
        ok: false,
        error: `Unknown template: ${templateKey}`,
        available: Object.keys(WHATSAPP_TEMPLATES),
      },
      { status: 400, headers: NO_STORE }
    )
  }

  // Mock parameter values per template.
  const mocks: Partial<Record<WhatsAppTemplateKey, { body: string[]; buttons?: string[][] }>> = {
    booking_confirmation_nl: {
      body: ['Jan', 'Test EMZ Dagobert', '4', 'zaterdag 27 juni 2026 om 16:57', 'TT-A7K9P3'],
      buttons: [['draft-0abe63c4270d4e6e', 'dev_preview_token']],
    },
    booking_confirmation_en: {
      body: ['Jan', 'Test EMZ Dagobert', '4', 'Saturday 27 June 2026 at 16:57', 'TT-A7K9P3'],
      buttons: [['draft-0abe63c4270d4e6e', 'dev_preview_token']],
    },
    booking_reminder_nl: {
      body: ['Jan', 'Test EMZ Dagobert', '16:57'],
      buttons: [['draft-0abe63c4270d4e6e', 'dev_preview_token']],
    },
    booking_reminder_en: {
      body: ['Jan', 'Test EMZ Dagobert', '16:57'],
      buttons: [['draft-0abe63c4270d4e6e', 'dev_preview_token']],
    },
    order_ready_nl: {
      body: ['Jan', 'Test EMZ Dagobert', 'TF-X9K2'],
    },
    order_ready_en: {
      body: ['Jan', 'Test EMZ Dagobert', 'TF-X9K2'],
    },
  }
  const mock = mocks[templateKey] ?? { body: [] }

  if (sendTo) {
    const result = await sendWhatsAppMessage({
      to: sendTo,
      templateKey,
      bodyParameters: mock.body,
      buttonParameters: mock.buttons,
      restaurantId: '288b0437-81da-4089-98e4-d89227a98004',
    })
    return NextResponse.json(
      {
        action: 'whatsapp_preview_send',
        templateKey,
        to: sendTo.replace(/^(\+\d{2,3})\d+(\d{4})$/, '$1***$2'),
        whatsAppEnabled: isWhatsAppEnabled(),
        result,
      },
      { headers: NO_STORE }
    )
  }

  // Preview mode — show submission text + Graph API payload.
  return NextResponse.json(
    {
      action: 'whatsapp_preview',
      templateKey,
      whatsAppEnabled: isWhatsAppEnabled(),
      submission: {
        name: template.name,
        language: template.metaLanguageCode,
        category: template.category,
        header: template.submissionHeader,
        body: template.submissionBody,
        footer: template.submissionFooter,
        buttons: template.buttons,
        notes:
          'Paste exactly this content into Meta Business Manager → Message Templates → Create. Approval takes 1-2 weeks.',
      },
      mockParameters: mock,
      graphApiPayload: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '+31612345678',
        type: 'template',
        template: {
          name: template.name,
          language: { code: template.metaLanguageCode },
          components: [
            ...(template.bodyParameterCount > 0
              ? [
                  {
                    type: 'body',
                    parameters: mock.body.map((text) => ({ type: 'text', text })),
                  },
                ]
              : []),
            ...template.buttons.map((_btn, idx) => ({
              type: 'button',
              sub_type: 'url',
              index: String(idx),
              parameters: (mock.buttons?.[idx] ?? []).map((text) => ({
                type: 'text',
                text,
              })),
            })),
          ],
        },
      },
    },
    { headers: NO_STORE }
  )
}
