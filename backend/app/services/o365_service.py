"""
=============================================================
  Microsoft 365 Unified Service
  Covers: Email + Calendar via Microsoft Graph API
  Auth  : App-Only (Client Credentials — no user login)
  Config: Reads from .env file
=============================================================

Azure App Permissions Required:
  - Mail.Send              → Send emails
  - Mail.ReadWrite         → Read / reply / forward / delete mails
  - Calendars.ReadWrite    → Create / update / delete calendar events
"""

import os
import base64
import mimetypes
import requests
import msal
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / "assets" / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()


class O365Service:
    """
    Single entry point for all Microsoft 365 operations.
    Reads active credentials from sales.emailenv database table (Fernet decrypted with expunge).
    """

    def __init__(
        self,
        client_id: str = None,
        tenant_id: str = None,
        client_secret: str = None,
        email_from: str = None
    ):
        self.client_id     = client_id
        self.client_secret = client_secret
        self.tenant_id     = tenant_id
        self.default_sender = email_from

        # Fetch active decrypted credentials from sales.emailenv database table if not explicitly provided
        if not all([self.client_id, self.client_secret, self.tenant_id]):
            db_creds = self._fetch_credentials_sync()
            if db_creds:
                self.client_id     = self.client_id or db_creds.get("client_id")
                self.tenant_id     = self.tenant_id or db_creds.get("tenant_id")
                self.client_secret = self.client_secret or db_creds.get("client_secret")
                self.default_sender = self.default_sender or db_creds.get("email_from")

        # Fallback to env vars if available
        self.client_id     = self.client_id or os.getenv("O365_CLIENT_ID")
        self.client_secret = self.client_secret or os.getenv("O365_CLIENT_SECRET")
        self.tenant_id     = self.tenant_id or os.getenv("O365_TENANT_ID")
        self.default_sender = self.default_sender or os.getenv("EMAIL_FROM") or "sales@tardidtech.com"

        if not all([self.client_id, self.client_secret, self.tenant_id]):
            raise EnvironmentError(
                "Missing one or more required M365 credentials in sales.emailenv database table: "
                "O365_CLIENT_ID, O365_CLIENT_SECRET, O365_TENANT_ID"
            )

        self._msal_app = msal.ConfidentialClientApplication(
            client_id=self.client_id,
            client_credential=self.client_secret,
            authority=f"https://login.microsoftonline.com/{self.tenant_id}"
        )

    @staticmethod
    def _fetch_credentials_sync() -> dict:
        """Fetch active decrypted credentials from sales.emailenv database table."""
        try:
            import psycopg2
            from app.config import settings
            from app.security.security_utils import decrypt_password as fernet_decrypt

            raw_url = settings.asyncpg_url.unicode_string().replace("postgresql+asyncpg://", "postgresql://")
            conn = psycopg2.connect(raw_url)
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT client_id, tenant_id, client_secret, email_from, otp_email_from, weekly_report_email_from 
                    FROM sales.emailenv 
                    WHERE is_active = True 
                    ORDER BY id DESC LIMIT 1;
                """)
                row = cur.fetchone()
                if row:
                    c_id, t_id, c_sec, e_from, otp_from, report_from = row
                    dec_cid = fernet_decrypt(c_id) if c_id else ""
                    dec_tid = fernet_decrypt(t_id) if t_id else ""
                    dec_sec = fernet_decrypt(c_sec) if c_sec else ""
                    return {
                        "client_id": dec_cid,
                        "tenant_id": dec_tid,
                        "client_secret": dec_sec,
                        "email_from": e_from or "sales@tardidtech.com",
                        "otp_email_from": otp_from or os.getenv("OTP_EMAIL_FROM") or "no-reply@tardidtech.com",
                        "weekly_report_email_from": report_from or os.getenv("WEEKLY_REPORT_EMAIL_FROM") or "sales@tardidtech.com"
                    }
            conn.close()
        except Exception as err:
            print(f"[O365Service Sync DB Fetch Warning] {err}", flush=True)
        return {}

    def _get_token(self) -> str:
        """Fetch a fresh OAuth2 access token (app-only)."""
        result = self._msal_app.acquire_token_for_client(
            scopes=["https://graph.microsoft.com/.default"]
        )
        if "access_token" in result:
            return result["access_token"]
        raise RuntimeError(
            f"Token error: {result.get('error')} — {result.get('error_description')}"
        )

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._get_token()}",
            "Content-Type": "application/json"
        }

    def _raise_error(self, action: str, response: requests.Response):
        try:
            err  = response.json()
            code = err.get("error", {}).get("code", "Unknown")
            msg  = err.get("error", {}).get("message", response.text)
        except Exception:
            code = str(response.status_code)
            msg  = response.text
        raise RuntimeError(
            f"[{action}] Failed — HTTP {response.status_code}\n"
            f"Code: {code}\nMessage: {msg}"
        )

    def _build_attachment(self, file_path: str) -> dict:
        """Read a file and encode it as a Graph API attachment object."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Attachment not found: {file_path}")
        content_type, _ = mimetypes.guess_type(str(path))
        if not content_type:
            content_type = "application/octet-stream"
        with open(path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("utf-8")
        return {
            "@odata.type": "#microsoft.graph.fileAttachment",
            "name": path.name,
            "contentType": content_type,
            "contentBytes": encoded
        }

    def send_email(
        self,
        to: list[str],
        subject: str,
        body: str,
        sender: str = None,
        cc: list[str] = None,
        bcc: list[str] = None,
        html: bool = False,
        attachments: list[str] = None,
        inline_attachments: list[dict] = None,
        importance: str = "normal",
        save_to_sent: bool = True,
    ) -> dict:
        from_address = sender or self.default_sender

        to_recipients  = [{"emailAddress": {"address": a}} for a in to if a]
        cc_recipients  = [{"emailAddress": {"address": a}} for a in (cc or []) if a]
        bcc_recipients = [{"emailAddress": {"address": a}} for a in (bcc or []) if a]
        attachment_list = [self._build_attachment(f) for f in (attachments or [])]
        
        if inline_attachments:
            for inline_att in inline_attachments:
                # Expecting dicts with "name", "contentType", "contentBytes"
                inline_att["@odata.type"] = "#microsoft.graph.fileAttachment"
                attachment_list.append(inline_att)

        payload = {
            "message": {
                "subject": subject,
                "importance": importance,
                "body": {
                    "contentType": "HTML" if html else "Text",
                    "content": body
                },
                "from": {"emailAddress": {"address": from_address}},
                "toRecipients": to_recipients,
                "ccRecipients": cc_recipients,
                "bccRecipients": bcc_recipients,
                "attachments": attachment_list
            },
            "saveToSentItems": save_to_sent
        }

        response = requests.post(
            f"https://graph.microsoft.com/v1.0/users/{from_address}/sendMail",
            headers=self._headers(),
            json=payload
        )

        if response.status_code == 202:
            return {
                "status": "sent",
                "from": from_address,
                "to": to,
                "cc": cc or [],
                "bcc": bcc or [],
                "attachments_sent": len(attachment_list)
            }
        self._raise_error("send_email", response)

    def create_event(
        self,
        subject: str,
        start: datetime,
        end: datetime,
        body: str = "",
        organizer_email: str = None,
        attendees: list[str] = None,
        location: str = "",
        is_online_meeting: bool = False,
        reminder_minutes: int = 15,
        html_body: bool = False,
        importance: str = "normal",
        is_all_day: bool = False,
    ) -> dict:
        owner = organizer_email or self.default_sender

        attendee_list = [
            {"emailAddress": {"address": a}, "type": "required"}
            for a in (attendees or []) if a
        ]

        payload = {
            "subject": subject,
            "importance": importance,
            "isAllDay": is_all_day,
            "body": {
                "contentType": "HTML" if html_body else "Text",
                "content": body
            },
            "start": {
                "dateTime": start.strftime("%Y-%m-%dT%H:%M:%S"),
                "timeZone": "India Standard Time"
            },
            "end": {
                "dateTime": end.strftime("%Y-%m-%dT%H:%M:%S"),
                "timeZone": "India Standard Time"
            },
            "location": {"displayName": location},
            "attendees": attendee_list,
            "isOnlineMeeting": is_online_meeting,
            "onlineMeetingProvider": "teamsForBusiness" if is_online_meeting else "unknown",
            "reminderMinutesBeforeStart": reminder_minutes,
            "isReminderOn": True,
        }

        response = requests.post(
            f"https://graph.microsoft.com/v1.0/users/{owner}/events",
            headers=self._headers(),
            json=payload
        )

        if response.status_code == 201:
            data = response.json()
            result = {
                "status": "created",
                "event_id": data["id"],
                "subject": data["subject"],
                "start": data["start"]["dateTime"],
                "end": data["end"]["dateTime"],
                "organizer": owner,
                "web_link": data.get("webLink", ""),
            }
            if is_online_meeting and data.get("onlineMeeting"):
                result["teams_join_url"] = data["onlineMeeting"].get("joinUrl", "")
            return result
        self._raise_error("create_event", response)

    def list_upcoming_events(
        self,
        days: int = 30,
        organizer_email: str = None
    ) -> list[dict]:
        owner  = organizer_email or self.default_sender
        now    = datetime.utcnow()
        future = now + timedelta(days=days)

        params = {
            "$filter": (
                f"start/dateTime ge '{now.strftime('%Y-%m-%dT%H:%M:%S')}' "
                f"and start/dateTime le '{future.strftime('%Y-%m-%dT%H:%M:%S')}'"
            ),
            "$orderby": "start/dateTime",
            "$select": "id,subject,start,end,location,attendees,webLink,isOnlineMeeting"
        }

        response = requests.get(
            f"https://graph.microsoft.com/v1.0/users/{owner}/events",
            headers=self._headers(),
            params=params
        )

        if response.status_code == 200:
            return [
                {
                    "event_id": e["id"],
                    "subject": e["subject"],
                    "start": e["start"]["dateTime"],
                    "end": e["end"]["dateTime"],
                    "location": e.get("location", {}).get("displayName", ""),
                    "is_online": e.get("isOnlineMeeting", False),
                    "web_link": e.get("webLink", ""),
                    "attendees": [
                        a["emailAddress"]["address"]
                        for a in e.get("attendees", [])
                    ]
                }
                for e in response.json().get("value", [])
            ]
        self._raise_error("list_upcoming_events", response)

    def delete_event(
        self,
        event_id: str,
        organizer_email: str = None
    ) -> dict:
        owner = organizer_email or self.default_sender
        response = requests.delete(
            f"https://graph.microsoft.com/v1.0/users/{owner}/events/{event_id}",
            headers=self._headers()
        )
        if response.status_code in [204, 404]:
            return {"status": "deleted", "event_id": event_id, "organizer": owner}
        self._raise_error("delete_event", response)
