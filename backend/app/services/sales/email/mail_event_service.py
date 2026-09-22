import logging
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy import select, update, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_main_engine
from app.models.sales.mail_event import MailEvent
from app.services.o365_service import O365Service

logger = logging.getLogger(__name__)


async def queue_mail_event(
    session: AsyncSession,
    event_type: str,
    payload: Dict[str, Any]
) -> MailEvent:
    """
    Helper function to insert an email or calendar event request into sales.mail_events queue.
    Inserts event into database queue for FastAPI BackgroundTasks worker to process post-response.
    """
    # Ensure subject has [Tunir] prefix
    if payload and isinstance(payload, dict) and payload.get("subject"):
        subj = str(payload["subject"]).strip()
        if not (subj.startswith("[Tunir]") or subj.startswith("Tunir")):
            payload["subject"] = f"[Tunir] {subj}"

    event = MailEvent(
        event_type=event_type,
        payload=payload,
        status="pending",
        retry_count=0,
        created_at=datetime.now()
    )
    session.add(event)
    await session.flush()
    logger.info(f"[MailEvent] Queued '{event_type}' event ID {event.id}")
    return event




async def process_pending_mail_events(max_batch_size: int = 20) -> List[dict]:
    """
    Background worker loop function with concurrency safety.
    Uses asyncio.Lock and FOR UPDATE SKIP LOCKED to prevent race conditions.
    Immediately commits 'processing' status to database BEFORE dispatching slow M365 network calls.
    """
    engine = get_main_engine()
    processed_results = []

    async with AsyncSession(engine) as session:
        # Normal mail events: max 3 retries (moves to dead_letter).
        # Weekly report events: retries on every worker cycle/startup until done.
        stmt = (
            select(MailEvent)
            .where(
                or_(
                    MailEvent.status == "pending",
                    (MailEvent.status == "failed") & (MailEvent.retry_count < 3),
                    (MailEvent.event_type == "weekly_executive_report") & (MailEvent.status.in_(["pending", "failed", "dead_letter"]))
                )
            )
            .with_for_update(skip_locked=True)
            .order_by(MailEvent.id.asc())
            .limit(max_batch_size)
        )
        res = await session.execute(stmt)
        events = list(res.scalars().all())

        if not events:
            return processed_results

        logger.info(f"[MailEvent Worker] Processing {len(events)} mail event(s)...")

        # Mark all fetched events as processing and COMMIT IMMEDIATELY to prevent concurrent workers from claiming them
        event_targets = []
        for event in events:
            event.status = "processing"
            event.updated_at = datetime.now()
            event_targets.append({
                "id": event.id,
                "event_type": event.event_type,
                "payload": event.payload or {}
            })
        await session.commit()

    async def _process_single_target(item: dict) -> dict:
        ev_id = item["id"]
        event_type = item["event_type"]
        payload = item["payload"]
        success = False
        error_msg = None

        # Process SeaweedFS attachments if any
        seaweed_atts = payload.get("seaweed_attachments")
        if seaweed_atts:
            try:
                from app.utils.seaweed_client import download_file_from_seaweed
                import base64
                import mimetypes
                    
                inline_atts = payload.get("inline_attachments") or []
                    
                for satt in seaweed_atts:
                    rel_path = satt.get("relative_path")
                    fname = satt.get("filename") or "document.pdf"
                    if rel_path:
                        file_bytes = await download_file_from_seaweed(rel_path)
                        encoded = base64.b64encode(file_bytes).decode("utf-8")
                        ctype, _ = mimetypes.guess_type(fname)
                        inline_atts.append({
                            "name": fname,
                            "contentType": ctype or "application/octet-stream",
                            "contentBytes": encoded
                        })
                payload["inline_attachments"] = inline_atts
            except Exception as att_err:
                logger.error(f"[MailEvent] Failed to process seaweed_attachments for event {ev_id}: {att_err}")

        def _dispatch_o365():
            svc = O365Service()
            if event_type in ["send_email", "weekly_executive_report"]:
                to_val = payload.get("to")
                if isinstance(to_val, str):
                    to_val = [to_val]
                try:
                    svc.send_email(
                        to=to_val,
                        subject=payload.get("subject", "No Subject"),
                        body=payload.get("body", ""),
                        sender=payload.get("sender"),
                        html=payload.get("html", True),
                        attachments=payload.get("attachments"),
                        inline_attachments=payload.get("inline_attachments")
                    )
                except Exception as mail_err:
                    if "404" in str(mail_err) or "ErrorInvalidUser" in str(mail_err):
                        logger.warning(f"[MailEvent Fallback] Sender '{payload.get('sender')}' invalid in M365 tenant. Retrying with default sender '{svc.default_sender}'...")
                        svc.send_email(
                            to=to_val,
                            subject=payload.get("subject", "No Subject"),
                            body=payload.get("body", ""),
                            sender=svc.default_sender,
                            html=payload.get("html", True),
                            attachments=payload.get("attachments"),
                            inline_attachments=payload.get("inline_attachments")
                        )
                    else:
                        raise mail_err
            elif event_type == "create_calendar_event":
                start_dt = datetime.fromisoformat(payload["start"]) if isinstance(payload.get("start"), str) else payload.get("start")
                end_dt = datetime.fromisoformat(payload["end"]) if isinstance(payload.get("end"), str) else payload.get("end")
                try:
                    return svc.create_event(
                        subject=payload.get("subject"),
                        start=start_dt,
                        end=end_dt,
                        body=payload.get("body"),
                        organizer_email=payload.get("organizer_email"),
                        attendees=payload.get("attendees"),
                        reminder_minutes=payload.get("reminder_minutes", 15)
                    )
                except Exception as cal_err:
                    if "404" in str(cal_err) or "ErrorInvalidUser" in str(cal_err):
                        logger.warning(f"[MailEvent Fallback] Organizer '{payload.get('organizer_email')}' invalid in M365 tenant. Retrying with default organizer '{svc.default_sender}'...")
                        return svc.create_event(
                            subject=payload.get("subject"),
                            start=start_dt,
                            end=end_dt,
                            body=payload.get("body"),
                            organizer_email=svc.default_sender,
                            attendees=payload.get("attendees"),
                            reminder_minutes=payload.get("reminder_minutes", 15)
                        )
                    else:
                        raise cal_err
            elif event_type == "delete_calendar_event":
                event_id_to_del = payload.get("event_id")
                organizer_email = payload.get("organizer_email")
                if not event_id_to_del and (payload.get("subject") or payload.get("activity_id") or payload.get("lead_id")):
                    try:
                        try:
                            events = svc.list_upcoming_events(days=60, organizer_email=organizer_email)
                        except Exception as search_err:
                            if "404" in str(search_err) or "ErrorInvalidUser" in str(search_err):
                                logger.warning(f"[delete_calendar_event search fallback] Organizer '{organizer_email}' invalid. Searching with default sender '{svc.default_sender}'...")
                                events = svc.list_upcoming_events(days=60, organizer_email=svc.default_sender)
                            else:
                                raise search_err

                        target_subj = payload.get("subject", "")
                        target_aid = payload.get("activity_id", "")
                        target_lid = payload.get("lead_id", "")
                        for ev in events:
                            ev_subj = ev.get("subject", "")
                            if (target_subj and target_subj in ev_subj) or (target_aid and target_aid in ev_subj) or (target_lid and target_lid in ev_subj):
                                event_id_to_del = ev.get("event_id")
                                break
                    except Exception as search_err:
                        logger.warning(f"[delete_calendar_event search fallback error] {search_err}")

                if event_id_to_del:
                    try:
                        return svc.delete_event(event_id=event_id_to_del, organizer_email=organizer_email)
                    except Exception as del_err:
                        if "404" in str(del_err) or "ErrorInvalidUser" in str(del_err):
                            logger.warning(f"[MailEvent Delete Fallback] Retrying delete_event with default organizer '{svc.default_sender}'...")
                            return svc.delete_event(event_id=event_id_to_del, organizer_email=svc.default_sender)
                        else:
                            raise del_err
                return {"status": "skipped", "reason": "No event_id provided or found"}
            else:
                raise ValueError(f"Unsupported event_type '{event_type}'")

        resp_payload = None
        try:
            resp_payload = await asyncio.to_thread(_dispatch_o365)
            success = True
        except Exception as e:
            error_msg = str(e)
            logger.error(f"[MailEvent Worker Error] Event ID {ev_id} ({event_type}) failed: {error_msg}")

        final_status = "failed"
        async with AsyncSession(engine) as session:
            ev_res = await session.execute(select(MailEvent).where(MailEvent.id == ev_id))
            event = ev_res.scalar_one_or_none()
            if event:
                if success:
                    event.status = "done"
                    event.last_error = None
                    if resp_payload:
                        event.response_payload = resp_payload
                    final_status = "done"
                else:
                    event.retry_count += 1
                    event.last_error = error_msg
                    if event.event_type != "weekly_executive_report" and event.retry_count >= 3:
                        event.status = "dead_letter"
                        final_status = "dead_letter"
                    else:
                        event.status = "failed"
                        final_status = "failed"

                event.updated_at = datetime.now()
                await session.commit()

        return {
            "id": ev_id,
            "event_type": event_type,
            "status": final_status,
            "error": error_msg
        }

    # Process all locked events CONCURRENTLY in parallel
    results = await asyncio.gather(*[_process_single_target(item) for item in event_targets])
    processed_results = list(results)

    return processed_results


def trigger_process_pending_mail_events(delay_seconds: float = 1.0):

    """
    Schedules process_pending_mail_events asynchronously with a short delay (e.g. 1s).
    Ensures calling HTTP endpoints have completed and committed their database transactions
    before the background worker reads pending mail events from PostgreSQL.
    """
    async def _delayed_worker():
        if delay_seconds > 0:
            await asyncio.sleep(delay_seconds)
        await process_pending_mail_events()

    try:
        asyncio.create_task(_delayed_worker())
    except Exception as err:
        logger.warning(f"[trigger_process_pending_mail_events error] {err}")
# =============================================================================
# REFERENCE SCRIPT — Delete a specific M365 Calendar Event by Outlook Event ID
# =============================================================================
# """
# Steps:
#   1. Paste your Outlook Event ID in EVENT_ID below.
#   2. Set the calendar owner's email in ORGANIZER_EMAIL.
#   3. Run: python delete_calendar_event.py
# 
# To find your Event ID:
#   - From a previous create_event() call  → event["event_id"]
#   - From list_upcoming_events()          → event["event_id"]
#   - Run this script with LIST_FIRST=True to print all upcoming events first.
# """
# 
# # CONFIGURATION — Edit these values before running
# LIST_FIRST = True
# EVENT_ID = ""  # e.g. "AAMkAGI2jkHgT5zNpO..."
# ORGANIZER_EMAIL = "rahul.p@tardidtech.com"
# 
# def delete_calendar_event_script():
#     svc = O365Service()
#     if LIST_FIRST:
#         print("=" * 60)
#         print("UPCOMING EVENTS (next 30 days)")
#         print("=" * 60)
#         events = svc.list_upcoming_events(days=30, organizer_email=ORGANIZER_EMAIL)
# 
#         if not events:
#             print("No upcoming events found.")
#         else:
#             print(f"Found {len(events)} event(s):\n")
#             for i, e in enumerate(events, start=1):
#                 print(f"  [{i}] Subject  : {e['subject']}")
#                 print(f"       Start    : {e['start'][:16]}")
#                 print(f"       End      : {e['end'][:16]}")
#                 print(f"       Location : {e['location']}")
#                 print(f"       Event ID : {e['event_id']}")
#                 print()
# 
#         if not EVENT_ID:
#             print("-" * 60)
#             print("Copy an Event ID above, paste it into EVENT_ID, and re-run.")
#             print("Set LIST_FIRST = False to skip listing next time.")
#             return
# 
#     if not EVENT_ID:
#         print("ERROR: EVENT_ID is empty. Please set a valid Outlook Event ID.")
#         return
# 
#     print("=" * 60)
#     print("DELETING EVENT")
#     print("=" * 60)
#     print(f"  Event ID  : {EVENT_ID}")
#     print(f"  Calendar  : {ORGANIZER_EMAIL}")
#     print()
# 
#     result = svc.delete_event(event_id=EVENT_ID, organizer_email=ORGANIZER_EMAIL)
# 
#     if result.get("status") == "deleted":
#         print("Event deleted successfully!")
#         print(f"  Event ID : {result['event_id']}")
#     else:
#         print(f"Unexpected result: {result}")
# 
# if __name__ == "__main__":
#     delete_calendar_event_script()

