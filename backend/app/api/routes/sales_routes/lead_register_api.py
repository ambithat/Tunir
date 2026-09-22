from datetime import date
from typing import Optional, Union, List
from fastapi import APIRouter, Depends, Query, File, Form, UploadFile, status, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from app.services.sales.email.mail_event_service import process_pending_mail_events

from app.dependency.sales.lead_register_dependency import get_lead_register_service
from app.dependency.auth_dependency import verify_access_token_dep
from app.models.sales.leader import Leader
from app.services.sales.lead_register_service import LeadRegisterService
from app.schemas.sales.lead_register_schema import (
    LeadRegisterCreate,
    LeadRegisterUpdate,
    LeadRegisterResponse,
    LeadDropdownSchema,
    ProductRegisterCreate,
    ProductRegisterUpdate,
    ProductRegisterResponse,
)
from app.schemas.sales.proposal_sent_schema import ProposalSentCreate, ProposalSentResponse

lead_register_router = APIRouter(prefix="/api/v1/leads", tags=["Lead Register"])


# ── LeadRegister Endpoints ────────────────────────────────────────────────────────

@lead_register_router.get("/dropdown", status_code=status.HTTP_200_OK, response_model=List[LeadDropdownSchema])
async def get_leads_dropdown(
    service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Get dropdown list of active leads with lead_id, company, contact_name, email, and leader_id."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin", "ceo", "cfo"] or user_desig in ["CEO", "CFO"]
    leads = await service.get_leads_dropdown(leader_id=current_user.leader_id, is_executive=is_executive)
    dropdown_list = [LeadDropdownSchema.model_validate(lead) for lead in leads]
    return JSONResponse(content=jsonable_encoder(dropdown_list), status_code=status.HTTP_200_OK)


@lead_register_router.post("", status_code=status.HTTP_201_CREATED, response_model=Union[LeadRegisterResponse, List[LeadRegisterResponse]])
async def create_lead(
    payload: LeadRegisterCreate,
    service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """
    Create new lead(s) with optional products.
    - Each product entry is created as a separate lead register with a unique lead_id.
    - Products are auto-assigned probability, risk_matrix and pipeline based on stage.
    - Contact details are automatically inserted into the contacts table.
    """
    result = await service.create_lead(payload, current_user=current_user)
    if isinstance(result, list):
        encoded = [LeadRegisterResponse.model_validate(item).model_dump() for item in result]
    else:
        encoded = LeadRegisterResponse.model_validate(result).model_dump()
    return JSONResponse(
        content=jsonable_encoder(encoded),
        status_code=status.HTTP_201_CREATED,
    )


@lead_register_router.get("", status_code=status.HTTP_200_OK)
async def list_leads(
    limit: int = Query(50, ge=1, le=100),
    cursor: Optional[str] = Query(None, description="Cursor for keyset pagination (lead_id)"),
    is_active: Optional[bool] = Query(None, description="Filter by active status (executives only)"),
    search: Optional[str] = Query(None, description="Search term for company, contact_name, designation, phone_no, email, country, lead_source, lead_id"),
    status_id: Optional[int] = Query(None, description="Filter leads by product status ID"),
    stage_id: Optional[int] = Query(None, description="Filter leads by leader stage status ID"),
    from_date: Optional[date] = Query(None, description="Filter leads created on or after from_date (YYYY-MM-DD)"),
    to_date: Optional[date] = Query(None, description="Filter leads created on or before to_date (YYYY-MM-DD)"),
    service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """List all leads with keyset pagination, status/stage filtering, date range filtering, and multi-field search filtering."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin", "ceo", "cfo"] or user_desig in ["CEO", "CFO"]
    result = await service.get_all_leads(
        limit=limit, 
        cursor=cursor, 
        leader_id=current_user.leader_id, 
        is_executive=is_executive,
        is_active=is_active,
        search=search,
        status_id=status_id,
        stage_id=stage_id,
        from_date=from_date,
        to_date=to_date
    )
    result["data"] = [
        LeadRegisterResponse.model_validate(item).model_dump()
        for item in result["data"]
    ]
    return JSONResponse(content=jsonable_encoder(result), status_code=status.HTTP_200_OK)


from app.schemas.common.bulk_delete_schema import BulkDeleteRequest


@lead_register_router.delete("/bulk", status_code=status.HTTP_200_OK)
async def bulk_delete_leads(
    payload: BulkDeleteRequest,
    background_tasks: BackgroundTasks,
    service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Delete multiple selected lead records."""
    count = await service.bulk_delete_leads(lead_ids=[str(i) for i in payload.ids], current_user=current_user)
    background_tasks.add_task(process_pending_mail_events)
    return JSONResponse(
        content={"message": f"Successfully deleted {count} lead records.", "deleted_count": count},
        status_code=status.HTTP_200_OK,
    )


@lead_register_router.delete("/proposals/bulk", status_code=status.HTTP_200_OK)
async def bulk_delete_proposals(
    payload: BulkDeleteRequest,
    service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Delete multiple selected proposal records."""
    count = await service.bulk_delete_proposals(proposal_ids=[str(i) for i in payload.ids], current_user=current_user)
    return JSONResponse(
        content={"message": f"Successfully deleted {count} proposal records.", "deleted_count": count},
        status_code=status.HTTP_200_OK,
    )


@lead_register_router.delete("/products/bulk", status_code=status.HTTP_200_OK)
async def bulk_delete_products(
    payload: BulkDeleteRequest,
    service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Delete multiple selected product records."""
    count = await service.bulk_delete_products(product_ids=[str(i) for i in payload.ids], current_user=current_user)
    return JSONResponse(
        content={"message": f"Successfully deleted {count} product records.", "deleted_count": count},
        status_code=status.HTTP_200_OK,
    )


@lead_register_router.delete("/delete-all", status_code=status.HTTP_200_OK)
async def delete_all_leads(
    background_tasks: BackgroundTasks,
    service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Delete all lead register records (Super Admin / Executive only)."""
    count = await service.delete_all_leads(current_user=current_user)
    background_tasks.add_task(process_pending_mail_events)
    return JSONResponse(
        content={"message": f"Successfully deleted all leads ({count} records).", "deleted_count": count},
        status_code=status.HTTP_200_OK,
    )


@lead_register_router.delete("/proposals/delete-all", status_code=status.HTTP_200_OK)
async def delete_all_proposals(
    service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Delete all proposal sent records (Super Admin / Executive only)."""
    count = await service.delete_all_proposals(current_user=current_user)
    return JSONResponse(
        content={"message": f"Successfully deleted all proposals ({count} records).", "deleted_count": count},
        status_code=status.HTTP_200_OK,
    )


@lead_register_router.delete("/products/delete-all", status_code=status.HTTP_200_OK)
async def delete_all_products(
    service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Delete all product register records (Super Admin / Executive only)."""
    count = await service.delete_all_products(current_user=current_user)
    return JSONResponse(
        content={"message": f"Successfully deleted all products ({count} records).", "deleted_count": count},
        status_code=status.HTTP_200_OK,
    )


@lead_register_router.get("/{lead_id}", status_code=status.HTTP_200_OK, response_model=LeadRegisterResponse)
async def get_lead(
    lead_id: str,
    service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Get a single lead by lead_id."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin", "ceo", "cfo"] or user_desig in ["CEO", "CFO"]
    lead = await service.get_lead_by_id(lead_id, leader_id=current_user.leader_id, is_executive=is_executive)
    return JSONResponse(
        content=jsonable_encoder(LeadRegisterResponse.model_validate(lead)),
        status_code=status.HTTP_200_OK,
    )


@lead_register_router.patch("/{lead_id}", status_code=status.HTTP_200_OK, response_model=LeadRegisterResponse)
async def update_lead(
    lead_id: str,
    payload: LeadRegisterUpdate,
    service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Update a lead record."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin", "ceo", "cfo"] or user_desig in ["CEO", "CFO"]
    lead = await service.update_lead(
        lead_id, payload, leader_id=current_user.leader_id, is_executive=is_executive, current_user=current_user
    )
    return JSONResponse(
        content=jsonable_encoder(LeadRegisterResponse.model_validate(lead)),
        status_code=status.HTTP_200_OK,
    )


@lead_register_router.delete("/{lead_id}", status_code=status.HTTP_200_OK)
async def delete_lead(
    lead_id: str,
    background_tasks: BackgroundTasks,
    service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Delete a lead record."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin", "ceo", "cfo"] or user_desig in ["CEO", "CFO"]
    await service.delete_lead(lead_id, is_executive=is_executive, leader_id=current_user.leader_id, current_user=current_user)
    background_tasks.add_task(process_pending_mail_events)
    return JSONResponse(
        content={"message": f"Lead '{lead_id}' deleted successfully."},
        status_code=status.HTTP_200_OK,
    )


# ── ProductRegister Endpoints (nested under lead) ─────────────────────────────────

@lead_register_router.post(
    "/{lead_id}/products",
    status_code=status.HTTP_201_CREATED,
    response_model=ProductRegisterResponse,
)
async def add_product_to_lead(
    lead_id: str,
    payload: ProductRegisterCreate,
    service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """
    Add a product to a lead.
    - probability, risk_matrix and pipeline are auto-computed from the stage.
    """
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin", "ceo", "cfo"] or user_desig in ["CEO", "CFO"]
    product = await service.add_product_to_lead(lead_id, payload, leader_id=current_user.leader_id, is_executive=is_executive)
    return JSONResponse(
        content=jsonable_encoder(ProductRegisterResponse.model_validate(product)),
        status_code=status.HTTP_201_CREATED,
    )


@lead_register_router.get(
    "/{lead_id}/products",
    status_code=status.HTTP_200_OK,
    response_model=list[ProductRegisterResponse],
)
async def get_products_for_lead(
    lead_id: str,
    service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """List all products for a given lead."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin", "ceo", "cfo"] or user_desig in ["CEO", "CFO"]
    products = await service.get_products_for_lead(lead_id, leader_id=current_user.leader_id, is_executive=is_executive)
    return JSONResponse(
        content=jsonable_encoder(
            [ProductRegisterResponse.model_validate(p).model_dump() for p in products]
        ),
        status_code=status.HTTP_200_OK,
    )




@lead_register_router.delete(
    "/{lead_id}/products/{product_register_id}",
    status_code=status.HTTP_200_OK,
)
async def delete_product(
    lead_id: str,
    product_register_id: str,
    service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Delete a product from a lead."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin", "ceo", "cfo"] or user_desig in ["CEO", "CFO"]
    await service.delete_product(lead_id, product_register_id, leader_id=current_user.leader_id, is_executive=is_executive)
    return JSONResponse(
        content={"message": f"Product {product_register_id} deleted from lead '{lead_id}'."},
        status_code=status.HTTP_200_OK,
    )


@lead_register_router.post("/reminders/check", status_code=status.HTTP_200_OK)
async def check_today_action_reminders(
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Trigger SSE notifications for today's lead action reminders."""
    from app.services.sales.lead_reminder_service import fetch_and_push_today_lead_action_reminders
    notifications = await fetch_and_push_today_lead_action_reminders(user_id=current_user.emp_id)
    return JSONResponse(
        content={
            "message": f"Sent {len(notifications)} action reminder notification(s).",
            "notifications": notifications,
        },
        status_code=status.HTTP_200_OK,
    )


# ── ProposalSent Endpoints (nested under lead) ───────────────────────────────────

@lead_register_router.post(
    "/{lead_id}/proposals",
    status_code=status.HTTP_201_CREATED,
    response_model=ProposalSentResponse,
)
async def create_proposal_for_lead(
    lead_id: str,
    payload: ProposalSentCreate,
    service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Create a proposal sent entry for a lead."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin", "ceo", "cfo"] or user_desig in ["CEO", "CFO"]
    await service.get_lead_by_id(lead_id, leader_id=current_user.leader_id, is_executive=is_executive)

    proposal = await service.create_proposal_for_lead(lead_id, payload, current_user=current_user)
    return JSONResponse(
        content=jsonable_encoder(ProposalSentResponse.model_validate(proposal)),
        status_code=status.HTTP_201_CREATED,
    )


@lead_register_router.get(
    "/{lead_id}/proposals",
    status_code=status.HTTP_200_OK,
    response_model=List[ProposalSentResponse],
)
async def get_proposals_for_lead(
    lead_id: str,
    service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """List all proposal sent entries for a given lead."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin", "ceo", "cfo"] or user_desig in ["CEO", "CFO"]
    await service.get_lead_by_id(lead_id, leader_id=current_user.leader_id, is_executive=is_executive)

    proposals = await service.get_proposals_for_lead(lead_id)
    return JSONResponse(
        content=jsonable_encoder([ProposalSentResponse.model_validate(p) for p in proposals]),
        status_code=status.HTTP_200_OK,
    )


@lead_register_router.delete(
    "/{lead_id}/proposals/{proposal_sent_id}",
    status_code=status.HTTP_200_OK,
)
async def delete_proposal(
    lead_id: str,
    proposal_sent_id: str,
    service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Delete a proposal sent entry from a lead."""
    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin", "ceo", "cfo"] or user_desig in ["CEO", "CFO"]
    await service.get_lead_by_id(lead_id, leader_id=current_user.leader_id, is_executive=is_executive)

    await service.delete_proposal_from_lead(lead_id, proposal_sent_id)
    return JSONResponse(
        content={"message": f"Proposal '{proposal_sent_id}' deleted from lead '{lead_id}'."},
        status_code=status.HTTP_200_OK,
    )


async def _process_proposal_upload(
    file: UploadFile,
    lead_id: Optional[str],
    proposal_type: Optional[str],
    remarks: Optional[str],
    service: LeadRegisterService,
    current_user: Leader,
):
    if not lead_id or not lead_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="lead_id is required for uploading proposal document."
        )
    clean_lead_id = lead_id.strip()

    user_role = (getattr(current_user, "role", "") or "").strip().lower().replace("_", " ")
    user_desig = (getattr(current_user, "designation", "") or "").strip().upper()
    is_executive = user_role in ["super admin", "admin", "ceo", "cfo"] or user_desig in ["CEO", "CFO"]
    lead = await service.get_lead_by_id(clean_lead_id, leader_id=current_user.leader_id, is_executive=is_executive)

    from app.utils.seaweed_client import upload_file_to_seaweed
    import tempfile
    import os

    tmp_path = None
    try:
        suffix = f"_{file.filename}" if file.filename else ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            file_bytes = await file.read()
            tmp.write(file_bytes)
            tmp_path = tmp.name
        await file.seek(0)
    except Exception as tmp_err:
        print(f"[Proposal Upload] Temp file warning: {tmp_err}", flush=True)

    upload_res = await upload_file_to_seaweed(
        file=file,
        bucket_name="startai",
        folder_name="proposal_sent",
        sub_folder=proposal_type or "general"
    )

    relative_path = upload_res["relative_path"]
    filename = upload_res["filename"]

    create_payload = ProposalSentCreate(
        lead_id=clean_lead_id,
        url=relative_path,
        remarks=remarks,
        proposal_type=proposal_type,
        created_by=current_user.leader_id or current_user.emp_id,
    )

    proposal = await service.create_proposal_for_lead(clean_lead_id, create_payload, current_user=current_user)

    # ── Trigger O365 Email with Attached Proposal Document to Super Admin & Admin ONLY if uploaded by normal user ──
    try:
        if not is_executive:
            from sqlalchemy import select, func, or_
            admin_stmt = select(Leader).where(
                or_(
                    func.lower(func.replace(func.trim(Leader.role), '_', ' ')).in_(["super admin", "admin", "ceo", "cfo"]),
                    func.upper(func.trim(Leader.designation)).in_(["CEO", "CFO"])
                )
            )
            admin_res = await service.repo.session.execute(admin_stmt)
            recipients = admin_res.scalars().all()
            admin_emails = [r.email for r in recipients if r.email]

            if admin_emails:
                import asyncio
                from app.services.sales.mail_event_service import queue_mail_event

                sender_email = getattr(current_user, "email", None)
                lead_owner_name = f"{current_user.first_name} {current_user.last_name}" if current_user else "N/A"

                email_subject = f"Proposal Sent - Document Attached ({clean_lead_id})"
                email_body = f"""
                <h3>Proposal Document Uploaded / Proposal Sent</h3>
                <p><b>Lead Owner:</b> {lead_owner_name}</p>
                <p><b>Lead ID:</b> {clean_lead_id}</p>
                <p><b>Company:</b> {lead.company}</p>
                <p><b>Proposal Type:</b> {proposal_type or 'N/A'}</p>
                <p><b>Remarks:</b> {remarks or 'None'}</p>
                <p><b>Attached Document:</b> {filename}</p>
                <p>Please find the attached proposal document.</p>
                """

                # Simply pass the SeaweedFS path; background worker will download it
                seaweed_attachments = [{
                    "relative_path": relative_path,
                    "filename": filename or "proposal_document.pdf"
                }] if relative_path else None

                await queue_mail_event(
                    session=service.repo.session,
                    event_type="send_email",
                    payload={
                        "to": admin_emails,
                        "subject": email_subject,
                        "body": email_body,
                        "sender": sender_email,
                        "html": True,
                        "seaweed_attachments": seaweed_attachments
                    }
                )
                if tmp_path and os.path.exists(tmp_path):
                    try:
                        os.remove(tmp_path)
                    except Exception:
                        pass
        else:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
    except Exception as email_err:
        print(f"[Proposal Upload] Email trigger warning: {email_err}", flush=True)

    return JSONResponse(
        content=jsonable_encoder(ProposalSentResponse.model_validate(proposal)),
        status_code=status.HTTP_201_CREATED,
    )


@lead_register_router.post("/{lead_id}/proposals/upload", summary="Upload Proposal Document for Lead", status_code=status.HTTP_201_CREATED, response_model=ProposalSentResponse)
async def upload_proposal_document_for_lead(
    lead_id: str,
    file: UploadFile = File(...),
    proposal_type: Optional[str] = Form(None, description="Proposal sub-type e.g. 'Technical Proposal Sent' or 'Techno Commercial Proposal Sent'"),
    remarks: Optional[str] = Form(None, description="Optional remarks"),
    service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Upload proposal document where lead_id is provided in path parameter."""
    return await _process_proposal_upload(
        file=file, lead_id=lead_id, proposal_type=proposal_type, remarks=remarks, service=service, current_user=current_user
    )


@lead_register_router.post("/proposal/upload", summary="Upload Proposal Document to SeaweedFS Bucket", status_code=status.HTTP_201_CREATED, response_model=ProposalSentResponse)
async def upload_proposal_document_form(
    file: UploadFile = File(...),
    lead_id: Optional[str] = Form(None, description="Parent Lead ID"),
    proposal_type: Optional[str] = Form(None, description="Proposal sub-type e.g. 'Technical Proposal Sent' or 'Techno Commercial Proposal Sent'"),
    remarks: Optional[str] = Form(None, description="Optional remarks"),
    service: LeadRegisterService = Depends(get_lead_register_service),
    current_user: Leader = Depends(verify_access_token_dep),
):
    """Upload proposal document where lead_id is provided in form field."""
    return await _process_proposal_upload(
        file=file, lead_id=lead_id, proposal_type=proposal_type, remarks=remarks, service=service, current_user=current_user
    )
