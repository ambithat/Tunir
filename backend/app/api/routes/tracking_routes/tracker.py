
import uuid

from typing import Optional

from fastapi import (Depends, FastAPI, HTTPException, WebSocketDisconnect, status, APIRouter, Query,
                     Body, Form, File, UploadFile, Request, WebSocket)
from fastapi.responses import JSONResponse
# from app.config  import settings as global_settings


from app.schemas.tracking.tracker_schema import RequestRaiseModel, TrackerHistoryModel, ApproveRaiseModel, RejectRaiseModel
from app.schemas.tracking.notification_schema import NotificationModel

from app.dependency.auth_dependency import verify_access_token_dep

from app.dependency.tracking.notification_dependency import get_notification_service
from app.dependency.tracking.tracker_dependency import get_tracker_service, get_tracker_history_service
from app.dependency.dashboard_dependency import get_dashboard_service

from app.services.tracking.notification_service import NotificationService
from app.services.tracking.tracker_service import TrackerService, TrackerHistoryService
from app.services.dashboard_service import DashboardService

from app.exceptions.tracking.tracker_exception import TrackerNotFound, TrackerHistoryNotFound


tracker_router = APIRouter()


############################################   Tracker INFO     ########################################################################################






FORM_CONFIG = {
    ("MANUFACTURING_PURCHASE_REQUEST", "PRODUCTION_MANAGER"): {
        "title": "Add Vendor Quotes",
        "component": "ADD_VENDORS_FORM",
        "action": "add_vendors"
    },
    ("MANUFACTURING_PURCHASE_REQUEST", "PRODUCT_HEAD"): {
        "title": "Select Preferred Vendor",
        "component": "SELECT_VENDOR_FORM",
        "action": "select_vendor"
    },
    ("MANUFACTURING_PURCHASE_REQUEST", "DELIVERY_HEAD"): {
        "title": "Approve Delivery",
        "component": "APPROVE_FORM",
        "action": "approve_or_reject"
    },
    ("MANUFACTURING_PURCHASE_REQUEST", "CFO"): {
        "title": "Create Purchase Order",
        "component": "CREATE_PO_FORM",
        "action": "create_po"
    },
    ("MANUFACTURING_PURCHASE_ORDER", "CEO"): {
        "title": "Final PO Approval",
        "component": "APPROVE_PO_FORM",
        "action": "approve_po"
    },
    
    ("OPERATIONAL_PURCHASE_REQUEST", "IT_MANAGER"): {
        "title": "Finalize Vendor & Price",
        "component": "FINALIZE_VENDOR_FORM",
        "action": "finalize_vendor"
    },
    ("OPERATIONAL_PURCHASE_REQUEST", "DELIVERY_HEAD"): {
        "title": "Approve Delivery",
        "component": "APPROVE_FORM",
        "action": "approve_or_reject"
    },
    ("OPERATIONAL_PURCHASE_REQUEST", "CFO"): {
        "title": "Create Purchase Order",
        "component": "CREATE_PO_FORM",
        "action": "create_po"
    },
    ("OPERATIONAL_PURCHASE_ORDER", "CEO"): {
        "title": "Final PO Approval",
        "component": "APPROVE_PO_FORM",
        "action": "approve_po"
    },
    
    ("PRODUCTION_REQUEST", "PRODUCT_HEAD"): {
        "title": "Approve Production Request",
        "component": "APPROVE_FORM",
        "action": "approve_or_reject"
    },
    ("PRODUCTION_REQUEST", "CEO"): {
        "title": "Final Approval",
        "component": "APPROVE_FORM",
        "action": "approve_or_reject"
    },
    ("PRODUCTION_REQUEST", "PRODUCTION_MANAGER"): {
        "title": "Create Production Order",
        "component": "CREATE_PRO_FORM",
        "action": "create_production_order"
    },
    
    ("OPERATIONAL_ASSET_REQUEST", "IT_MANAGER"): {
        "title": "Verify Asset Details",
        "component": "VERIFY_FORM",
        "action": "verify_or_reject"
    },
    ("OPERATIONAL_ASSET_REQUEST", "DELIVERY_HEAD"): {
        "title": "Approve Assignment",
        "component": "APPROVE_FORM",
        "action": "approve_or_reject"
    },
    ("OPERATIONAL_ASSET_REQUEST", "CEO"): {
        "title": "Final Approval",
        "component": "APPROVE_FORM",
        "action": "approve_or_reject"
    }
}


@tracker_router.get("/api/v1/tracker/request/approval/data")
async def get_request_approval(
    request:Request,
    tracker_service:TrackerService = Depends(get_tracker_service),
    tracker_history_service:TrackerHistoryService = Depends(get_tracker_history_service),
    notification_service:NotificationService = Depends(get_notification_service),
):
    try:
        employee_id: str = request.state.employee_id  # employee_id (str) from token
        
        # Get designation directly from the database using approval_order and user level
        level = await user_service.get_level(employee_id)
        if not level:
            return []
            
        approval_order_res = await approval_order_service.get_approval_order_profile_by_id(level_id=level)
        designation = approval_order_res.get("approval_order_data", {}).get("designation")
        print(designation,"desigggggggggggg")
        tracker_data = await tracker_service.get_pending_trackers_by_user_and_id(
            employee_id,
            status_type=["PENDING","VENDOR_QUOTES_ADDED"]) 
        if not tracker_data:
            return []
        
        response_data = []

        for tracker in tracker_data:
            print(f"inside the tracker for loop {tracker}")
            req_id = tracker.get("id")
            tracker_id = tracker.get("tracker_id")
            
            # Fetch notification for this specific request
            notif = await notification_service.get_notification_by_approver_and_request_id(employee_id, req_id)
            if not notif:
                continue
                
            notif_type = notif.notification_type.value if hasattr(notif.notification_type, 'value') else str(notif.notification_type)
            print(f"notify type here {notif_type}")
            # Normalize designation (e.g. "PRODUCTHEAD" -> "PRODUCT_HEAD")
            norm_designation = designation
            if norm_designation:
                norm_designation = norm_designation.upper().replace(" ", "")
                if norm_designation == "PRODUCTHEAD":
                    norm_designation = "PRODUCT_HEAD"
                elif norm_designation == "DELIVERYHEAD":
                    norm_designation = "DELIVERY_HEAD"
                elif norm_designation == "PRODUCTIONMANAGER":
                    norm_designation = "PRODUCTION_MANAGER"
                elif norm_designation == "CFO":
                    norm_designation = "CFO"
            
            form_config = FORM_CONFIG.get((notif_type, norm_designation))
            
            service_data = None
            if "PURCHASE_REQUEST" in notif_type:
                # fetch PR details
                pr_response = await purchase_request_service.get_purchase_request_by_id(req_id)
                pr_data = pr_response.get("data", {}) if pr_response else {}
                
                # apply UI visibility rules based on designation
                if pr_data and designation == "PRODUCTIONMANAGER":
                    for item in pr_data.get("purchase_request_items", []):
                        if "vendors_options" in item:
                            for vendor in item["vendors_options"]:
                                # strip is_selected flag so it's not shown as already selected
                                vendor["is_selected"] = None
                                
                elif pr_data and designation == "DELIVERYHEAD":
                    for item in pr_data.get("purchase_request_items", []):
                        if "vendors_options" in item:
                            # keep only selected vendors
                            item["vendors_options"] = [
                                v for v in item["vendors_options"] if v.get("is_selected") is True
                            ]

                elif pr_data and designation == "CFO":
                    finalized_item_data = []
                    for item in pr_data.get("purchase_request_items", []):
                        if "vendors_options" in item:
                            # keep only selected vendors
                            item["vendors_options"] = [
                                v for v in item["vendors_options"] if v.get("is_selected") is True
                            ]
                            
                            # find first selected vendor
                            for vendor in item["vendors_options"]:
                                if vendor.get("qty") :
                                    vendor.pop("qty")
                                vendor_id = vendor.get("vendor_id")
                                if vendor_id:
                                    try:
                                        vendor_res = await vendor_service.get_vendor_profile_by_id(vendor_id)
                                        if vendor_res and vendor_res.get("vendor_data"):
                                            v_data = vendor_res["vendor_data"][0]
                                            vendor["vendor_name"] = v_data.get("vendor_name")
                                            vendor["email"] = v_data.get("email")
                                            vendor["phone"] = v_data.get("phone")
                                            vendor["address"] = v_data.get("address")
                                    except Exception as e:
                                        print(f"Failed to fetch extra vendor info for {vendor_id}: {e}")
                            finalized_item_data.append(item)
                    pr_data["purchase_request_items"] = finalized_item_data

                elif pr_data and designation == "CEO":
                    po_list = await po_service.get_purchase_orders_by_pr_id(req_id)
                    po_data_list = []
                    raised_by = pr_data.get("raised_by")
                    raised_by_name = pr_data.get("name")
                    created_at = pr_data.get("created_at")
                    for po in po_list:
                        vendor_name = None
                        email = None
                        phone = None
                        address = None
                        vendor_id = None
                        if po.pri_vendor and po.pri_vendor.vendor_id:
                            vendor_id = po.pri_vendor.vendor_id
                            try:
                                vendor_res = await vendor_service.get_vendor_profile_by_id(vendor_id)
                                if vendor_res and vendor_res.get("vendor_data"):
                                    v_data = vendor_res["vendor_data"][0]
                                    vendor_name = v_data.get("vendor_name")
                                    email = v_data.get("email")
                                    phone = v_data.get("phone")
                                    address = v_data.get("address")
                            except Exception as e:
                                print(f"Failed to fetch extra vendor info for {vendor_id}: {e}")

                        po_dict = {
                            "po_id": po.po_id,
                            "pr_id": po.pr_id,
                            "raised_by": raised_by,
                            "raised_by_name": raised_by_name,
                            "created_at": created_at,
                            "pri_vendor_id": po.pri_vendor_id,
                            "total_qty": po.total_qty,
                            "amount_currency": po.amount_currency,
                            "total_taxable_value": float(po.total_taxable_value) if po.total_taxable_value else 0.0,
                            "total_amount_payable": float(po.total_amount_payable) if po.total_amount_payable else 0.0,
                            "total_amount_in_words": po.total_amount_in_words,
                            "vendor_details": {
                                "vendor_id": vendor_id,
                                "name": vendor_name,
                                "email": email,
                                "phone": phone,
                                "address": address
                            },
                            "items": [
                                {
                                    "po_item_id": item.po_item_id,
                                    "pr_item_id": item.pr_item_id,
                                    "part_number": next((pr_item.get("part_number") for pr_item in pr_data.get("purchase_request_items", []) if pr_item.get("pr_item_id") == item.pr_item_id), None),
                                    "part_name": next((pr_item.get("part_name") for pr_item in pr_data.get("purchase_request_items", []) if pr_item.get("pr_item_id") == item.pr_item_id), None),
                                    "quantity": item.quantity,
                                    "unit_price": float(item.unit_price) if item.unit_price else 0.0,
                                    "taxable_value": float(item.taxable_value) if item.taxable_value else 0.0,
                                    "total_amount": float(item.amount_payable) if item.amount_payable else 0.0
                                } for item in po.items
                            ]
                        }
                        po_data_list.append(po_dict)
                    
                    pr_data["purchase_orders"] = po_data_list

                service_data = pr_data
                
            if "PURCHASE_ORDER" in notif_type:
                # fetch PR details
                pr_response = await purchase_request_service.get_purchase_request_by_id(req_id)
                pr_data = pr_response.get("data", {}) if pr_response else {}
                
                # Remove top-level redundant fields
                pr_data.pop("status", None)
                pr_data.pop("assigned_to", None)
                pr_data.pop("assigned_to_name", None)
                pr_data.pop("location_id", None)
                
                # Remove item-level redundant fields
                for item in pr_data.get("purchase_request_items", []):
                    item.pop("assigned_to", None)
                    item.pop("assigned_to_name", None)
                    item.pop("location_id", None)
                    item.pop("preferred_vendor_id", None)
                    item.pop("preferred_vendor_name", None)
                    item.pop("preferred_price", None)
                    item.pop("quantity_pending", None)
                    item.pop("quantity_approved", None)
                    item.pop("vendors_options", None)
                    item.pop("item_status", None)
                    
                po_list = await po_service.get_purchase_orders_by_pr_id(req_id)
                po_data_list = []
                raised_by = pr_data.get("raised_by")
                raised_by_name = pr_data.get("name")
                created_at = pr_data.get("created_at")
                for po in po_list:
                    vendor_name = None
                    email = None
                    phone = None
                    address = None
                    vendor_id = None
                    if po.pri_vendor and po.pri_vendor.vendor_id:
                        vendor_id = po.pri_vendor.vendor_id
                        try:
                            vendor_res = await vendor_service.get_vendor_profile_by_id(vendor_id)
                            if vendor_res and vendor_res.get("vendor_data"):
                                v_data = vendor_res["vendor_data"][0]
                                vendor_name = v_data.get("vendor_name")
                                email = v_data.get("email")
                                phone = v_data.get("phone")
                                address = v_data.get("address")
                        except Exception as e:
                            print(f"Failed to fetch extra vendor info for {vendor_id}: {e}")

                    po_dict = {
                        "po_id": po.po_id,
                        "pr_id": po.pr_id,
                        "raised_by": raised_by,
                        "raised_by_name": raised_by_name,
                        "created_at": created_at,
                        "pri_vendor_id": po.pri_vendor_id,
                        "total_qty": po.total_qty,
                        "amount_currency": po.amount_currency,
                        "total_taxable_value": float(po.total_taxable_value) if po.total_taxable_value else 0.0,
                        "total_amount_payable": float(po.total_amount_payable) if po.total_amount_payable else 0.0,
                        "total_amount_in_words": po.total_amount_in_words,
                        "vendor_details": {
                            "vendor_id": vendor_id,
                            "name": vendor_name,
                            "email": email,
                            "phone": phone,
                            "address": address
                        },
                        "items": [
                            {
                                "po_item_id": item.po_item_id,
                                "pr_item_id": item.pr_item_id,
                                "part_number": next((pr_item.get("part_number") for pr_item in pr_data.get("purchase_request_items", []) if pr_item.get("pr_item_id") == item.pr_item_id), None),
                                "part_name": next((pr_item.get("part_name") for pr_item in pr_data.get("purchase_request_items", []) if pr_item.get("pr_item_id") == item.pr_item_id), None),
                                "quantity": item.quantity,
                                "unit_price": float(item.unit_price) if item.unit_price else 0.0,
                                "taxable_value": float(item.taxable_value) if item.taxable_value else 0.0,
                                "total_amount": float(item.amount_payable) if item.amount_payable else 0.0
                            } for item in po.items
                        ]
                    }
                    po_data_list.append(po_dict)
                
                pr_data["purchase_orders"] = po_data_list

                service_data = pr_data




            response_data.append({
                "tracker_id": tracker_id,
                "request_id": req_id,
                "notification_type": notif_type,
                "designation": designation,
                "form_config": form_config,
                "service_data": service_data
            })
            
        return response_data      
   
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))


@tracker_router.get("/api/v1/tracker/data")
async def get_tracker_data(
    tracker_id: str,
    tracker_service: TrackerService = Depends(get_tracker_service),
    tracker_history_service: TrackerHistoryService = Depends(get_tracker_history_service),
):
    try:
        tracker_data = await tracker_service.get_tracker_full_data(
            tracker_id=tracker_id,
            tracker_history_service=tracker_history_service,
        )
        return tracker_data
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))

@tracker_router.get("/api/v1/tracker/id")
async def get_tracker_id(
                            tracker_service:TrackerService = Depends(get_tracker_service)):
                     
    try:
        #here the tracker is global so feteched all the pending tracker ids                    
        tracker_data = await tracker_service.get_pending_tracker_id()
        return tracker_data
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=str(e))



