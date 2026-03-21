"""
notification_service.py — Zenith ERP | Omnichannel Notification Engine

Provides async stubs for WhatsApp, Email, and automated IVR calls.
In production, replace the stub bodies with real SDK calls
(e.g. Twilio, SendGrid, WATI).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class NotificationResult:
    channel: str
    recipient: str
    success: bool
    provider_message_id: str | None = None
    error: str | None = None


class NotificationService:
    """Omnichannel notification dispatcher.

    Each method is an async stub.  Wire up real provider SDKs here and
    inject credentials via environment variables / Vault.
    """

    # ------------------------------------------------------------------
    # WhatsApp
    # ------------------------------------------------------------------

    async def send_whatsapp(self, phone: str, msg: str) -> NotificationResult:
        """Send a WhatsApp message via the configured provider (e.g. Twilio/WATI).

        Args:
            phone: E.164-formatted phone number (+971XXXXXXXXX).
            msg:   Message body (max 4096 chars for WhatsApp).

        Returns:
            NotificationResult with provider acknowledgement details.
        """
        logger.info("[WhatsApp] → %s | %s", phone, msg[:60])
        # TODO: replace with real SDK call, e.g.:
        #   client = TwilioClient(ACCOUNT_SID, AUTH_TOKEN)
        #   message = client.messages.create(
        #       from_="whatsapp:+14155238886",
        #       body=msg,
        #       to=f"whatsapp:{phone}",
        #   )
        #   return NotificationResult("whatsapp", phone, True, message.sid)
        return NotificationResult(
            channel="whatsapp",
            recipient=phone,
            success=True,
            provider_message_id="STUB_WA_12345",
        )

    # ------------------------------------------------------------------
    # Email
    # ------------------------------------------------------------------

    async def send_email(
        self, email: str, subject: str, body: str
    ) -> NotificationResult:
        """Send a transactional email via SendGrid / SES.

        Args:
            email:   Recipient address.
            subject: Email subject line.
            body:    HTML or plain-text body.

        Returns:
            NotificationResult with provider acknowledgement details.
        """
        logger.info("[Email] → %s | %s", email, subject)
        # TODO: replace with real SDK call
        return NotificationResult(
            channel="email",
            recipient=email,
            success=True,
            provider_message_id="STUB_EMAIL_67890",
        )

    # ------------------------------------------------------------------
    # Automated IVR Call
    # ------------------------------------------------------------------

    async def trigger_automated_ivr_call(
        self, phone: str, script: str
    ) -> NotificationResult:
        """Initiate an outbound IVR call using a TTS script (e.g. Twilio Voice).

        Args:
            phone:  E.164-formatted phone number.
            script: Text-to-speech script for the IVR system.

        Returns:
            NotificationResult with call SID.
        """
        logger.info("[IVR] → %s | script_len=%d", phone, len(script))
        # TODO: replace with real Twilio Voice call
        return NotificationResult(
            channel="ivr",
            recipient=phone,
            success=True,
            provider_message_id="STUB_CALL_ABCDE",
        )
