# Security notes for inbound mail

## Deleted attachments stay in the original message

Deleting an attachment removes its stored file and its row, so it can no longer be
downloaded, previewed or shared. The message's original MIME (`rawR2Key`) is a faithful
copy of what arrived and is not rewritten, so **Download original** and the JMAP raw
blob still contain the attachment bytes. Delete the whole message to remove the original.

Public shared-file links stop working as soon as the message is moved to trash or spam
or its mailbox is disabled; they also expire on their own.

## Authentication results

* Cloudflare receiving: SPF, DKIM and DMARC come from the `Authentication-Results`
  header Cloudflare writes (authserv-id `mx.cloudflare.net`). A failure in any such clause
  wins over a pass.
* SES and Resend receiving: the provider's own verdicts are used.
* Self-hosted SMTP: the listener verifies nothing, so no authentication signal exists and
  the DMARC/SPF/DKIM policy does not apply. Put a verifying filter in front of it or receive
  through a provider.

Sender-written `Authentication-Results`, `Received-SPF` and `Received` headers are never
trusted on the SMTP path.

## Webhooks

Webhook URLs must be `https://` on a public host. Redirects are not followed, and hooks
saved before this rule are re-checked at delivery. Mail filed as spam or trash does not
trigger `message.inbound`.

## Forwarding loop guard

Mail Mailflare forwards carries `X-Mailflare-Forwarded`, an HMAC keyed with a server secret
(`CF_TOKEN`, `CF_API_KEY` or `INBOUND_WEBHOOK_SECRET`). A sender cannot switch forwarding
off by adding the header. With none of those set the header falls back to `1`.
