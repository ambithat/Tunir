import os
import asyncio
import logging
import tempfile
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any

from sqlalchemy import select, func, text, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.base import get_main_engine, get_main_session_factory
from app.models.sales.leader import Leader
from app.models.sales.lead_register import LeadRegister, ProductRegister
from app.models.sales.lead_activity_register import LeadActivityRegister
from app.models.sales.proposal_sent import ProposalSent
from app.services.o365_service import O365Service

logger = logging.getLogger(__name__)

STAGE_PROGRESSION = {
    "Qualification": "Qualification",
    "Low": "Qualification",
    "Medium": "Low",
    "High": "Medium",
    "Negotiation": "High",
    "Won": "Negotiation",
    "Lost": "Negotiation"
}


async def generate_weekly_report_pdf(
    report_date_str: str,
    period_str: str,
    total_pipeline_val: float,
    deals_won_val: float,
    deals_won_cnt: int,
    total_pending_cnt: int,
    total_overdue_cnt: int,
    executives_data: list,
) -> Optional[str]:
    """
    Renders a compact, high-density Executive PDF using Playwright Chromium.
    Records stage transitions (from_stage -> to_stage) and actual product status.
    """
    try:
        # Build Overview Table Rows
        overview_rows_html = ""
        for idx, exec_info in enumerate(executives_data, 1):
            products = exec_info.get("products", [])
            prod_count = len(products) if products else 1
            pg_num = f"{idx:02d}"

            for p_idx, prod in enumerate(products):
                # Pending tasks list
                pending_tasks = prod.get("pending_tasks", [])
                if pending_tasks:
                    pending_html_items = []
                    for t in pending_tasks:
                        is_overdue = t.get("is_overdue", False)
                        card_class = "task-item-card task-item-overdue" if is_overdue else "task-item-card task-item-pending"
                        overdue_badge = '<span class="badge-mini-overdue">OVERDUE</span>' if is_overdue else ''
                        title_class = 'class="overdue-text"' if is_overdue else ''
                        pending_html_items.append(f"""
                        <div class="{card_class}">
                            <div class="task-title">
                                <span {title_class}>{t['summary']}</span>
                                {overdue_badge}
                            </div>
                            <div class="task-meta {('overdue-text' if is_overdue else '')}">{t['lead_name']} • Due {t['due_date']}</div>
                        </div>
                        """)
                    pending_cell = "".join(pending_html_items)
                else:
                    pending_cell = '<span style="color: #94a3b8; font-style: italic; font-size: 7pt;">None</span>'

                # Completed tasks list
                completed_tasks = prod.get("completed_tasks", [])
                if completed_tasks:
                    comp_html_items = []
                    for t in completed_tasks:
                        comp_html_items.append(f"""
                        <div class="task-item-card task-item-completed">
                            <div class="task-title">{t['summary']}</div>
                            <div class="task-meta">{t['lead_name']} • Done {t['done_date']}</div>
                        </div>
                        """)
                    completed_cell = "".join(comp_html_items)
                else:
                    completed_cell = '<span style="color: #94a3b8; font-style: italic; font-size: 7pt;">None</span>'

                # Outcomes cell
                won_val = prod.get("won_val", 0)
                status_name = prod.get("status_name", "In Progress")
                if won_val > 0 or status_name == "Won":
                    outcomes_cell = f'<span class="outcome-pill-won">🏆 Won: ₹{won_val:,.0f}</span>'
                elif status_name == "Lost":
                    outcomes_cell = f'<span class="outcome-pill-lost">❌ Lost</span>'
                else:
                    outcomes_cell = f'<span style="color: #94a3b8; font-style: italic; font-size: 7pt;">{status_name}</span>'

                tr_class = 'class="executive-border-top"' if p_idx == 0 else 'class="product-row-bg"'
                
                if p_idx == 0:
                    exec_cells = f"""
                    <td rowspan="{prod_count}" style="vertical-align: top; text-align: center; padding-top: 6px;">
                        <a href="#user-{exec_info['emp_id']}" class="page-nav-badge" title="Navigate to Page {pg_num}">
                            <span class="pg-num">PAGE {pg_num}</span>
                            <span class="pg-arrow">↗</span>
                        </a>
                    </td>
                    <td rowspan="{prod_count}" style="vertical-align: top; padding-top: 6px;">
                        <div class="executive-card-box">
                            <span class="executive-name-text">{exec_info['full_name']}</span>
                            <span class="executive-role-text">{exec_info.get('designation', 'Account Executive')}</span>
                        </div>
                    </td>
                    """
                else:
                    exec_cells = ""

                overview_rows_html += f"""
                <tr {tr_class}>
                    {exec_cells}
                    <td><span class="product-chip">📦 {prod['product_name']}</span></td>
                    <td>{pending_cell}</td>
                    <td>{completed_cell}</td>
                    <td>{outcomes_cell}</td>
                </tr>
                """

        # Build Detailed User Sections
        detailed_sections_html = ""
        for idx, exec_info in enumerate(executives_data, 1):
            emp_id = exec_info['emp_id']
            initials = "".join([w[0].upper() for w in exec_info['full_name'].split()[:2]]) or "EX"
            pg_num = f"{idx:02d}"

            products_html = ""
            for prod in exec_info.get("products", []):
                # Lead updates table
                lead_rows = ""
                for ld in prod.get("leads", []):
                    lead_rows += f"""
                    <tr>
                        <td><span class="lead-name">{ld['company']}</span><span class="lead-id">ID: {ld['lead_id']}</span></td>
                        <td>
                            <span class="stage-from">{ld['prev_stage']}</span> <span class="status-arrow">&rarr;</span> <span class="stage-to">{ld['current_stage']}</span>
                            <span class="date-subtext">UPDATED {ld['updated_date']}</span>
                        </td>
                        <td>
                            <span class="pill pill-status">{ld['status_label']}</span>
                            <span class="date-subtext">UPDATED {ld['updated_date']}</span>
                        </td>
                    </tr>
                    """
                
                if not lead_rows:
                    lead_rows = '<tr><td colSpan="3" class="empty-state">No lead stage updates recorded this week.</td></tr>'

                # Pending tasks table
                p_rows = ""
                for pt in prod.get("pending_tasks", []):
                    is_overdue = pt.get("is_overdue", False)
                    overdue_tr = 'class="overdue-row"' if is_overdue else ''
                    overdue_td = 'class="overdue-text"' if is_overdue else 'class="lead-name"'
                    badge = '<span class="overdue-badge">OVERDUE</span>' if is_overdue else ''
                    p_rows += f"""
                    <tr {overdue_tr}>
                        <td {overdue_td}>{pt['lead_name']}</td>
                        <td>{pt['summary']}</td>
                        <td {overdue_td}>{pt['due_date']} {badge}</td>
                    </tr>
                    """
                if not p_rows:
                    p_rows = '<tr><td colSpan="3" class="empty-state">No pending tasks recorded for this product.</td></tr>'

                # Completed tasks table
                c_rows = ""
                for ct in prod.get("completed_tasks", []):
                    c_rows += f"""
                    <tr>
                        <td class="lead-name">{ct['lead_name']}</td>
                        <td>{ct['summary']}</td>
                        <td>{ct['done_date']}</td>
                    </tr>
                    """
                if not c_rows:
                    c_rows = '<tr><td colSpan="3" class="empty-state">No completed tasks recorded for this product.</td></tr>'

                products_html += f"""
                <div class="product-group avoid-break">
                    <div class="product-title">
                        <span>📦 Product: {prod['product_name']}</span>
                        <span style="font-size: 7.5pt; color: #64748b; font-weight: 600;">Active Account Segment</span>
                    </div>

                    <div class="data-block avoid-break">
                        <div class="block-header header-leads">📊 Lead Stage Updates</div>
                        <table>
                            <thead>
                                <tr>
                                    <th width="35%">Lead Name</th>
                                    <th width="35%">Stage Change To & Date</th>
                                    <th width="30%">Status & Date</th>
                                </tr>
                            </thead>
                            <tbody>{lead_rows}</tbody>
                        </table>
                    </div>

                    <div class="data-block avoid-break">
                        <div class="block-header header-pending">⏳ Pending Tasks</div>
                        <table>
                            <thead>
                                <tr>
                                    <th width="35%">Lead Name</th>
                                    <th width="40%">Action Required</th>
                                    <th width="25%">Due Date</th>
                                </tr>
                            </thead>
                            <tbody>{p_rows}</tbody>
                        </table>
                    </div>

                    <div class="data-block avoid-break">
                        <div class="block-header header-completed">✅ Completed Tasks</div>
                        <table>
                            <thead>
                                <tr>
                                    <th width="35%">Lead Name</th>
                                    <th width="40%">Action Taken</th>
                                    <th width="25%">Date Done</th>
                                </tr>
                            </thead>
                            <tbody>{c_rows}</tbody>
                        </table>
                    </div>
                </div>
                """

            detailed_sections_html += f"""
            <div id="user-{emp_id}" class="user-section avoid-break" style="margin-top: 15px;">
                <div class="user-header">
                    <div class="user-initials">{initials}</div>
                    <div class="user-details">
                        <span>Account Executive • Page {pg_num} Detail Overview</span>
                        <h2>{exec_info['full_name']}</h2>
                    </div>
                </div>
                {products_html}
            </div>
            """

        full_html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>Executive Pipeline Report - Senior Board Edition</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@600;700;800;900&display=swap" rel="stylesheet">
          <style>
            @page {{ size: A4 portrait; margin: 6mm; }}
            * {{ box-sizing: border-box; margin: 0; padding: 0; }}
            body {{ background: #ffffff; font-family: 'Inter', sans-serif; color: #1e293b; line-height: 1.35; padding: 0; }}
            .document-page {{ background-color: #ffffff; width: 100%; padding: 4mm; }}
            .avoid-break {{ page-break-inside: avoid; }}

            /* COMPACT MASTHEAD */
            .masthead {{ display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #334155 100%); color: white; padding: 12px 18px; border-radius: 6px; margin-bottom: 12px; }}
            .masthead-left .kicker {{ font-size: 7.5pt; font-weight: 800; color: #60a5fa; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 2px; }}
            .masthead-left h1 {{ font-family: 'Outfit', sans-serif; font-size: 16pt; font-weight: 800; color: #ffffff; margin: 0; }}
            .masthead-right {{ text-align: right; font-size: 7.5pt; color: #94a3b8; line-height: 1.4; }}
            .masthead-right strong {{ color: #f8fafc; font-weight: 700; }}

            /* COMPACT KPI GRID */
            .kpi-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }}
            .kpi-card {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; position: relative; overflow: hidden; }}
            .kpi-card::before {{ content: ""; position: absolute; top: 0; left: 0; width: 3.5px; height: 100%; }}
            .kpi-pipeline::before {{ background: #2563eb; }} .kpi-won::before {{ background: #059669; }} .kpi-pending::before {{ background: #ea580c; }} .kpi-overdue::before {{ background: #dc2626; }}
            .kpi-card .kpi-label {{ font-size: 7pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; margin-bottom: 2px; }}
            .kpi-card .kpi-value {{ font-family: 'Outfit', sans-serif; font-size: 13pt; font-weight: 800; color: #0f172a; line-height: 1; }}

            /* COMPACT SUMMARY TABLE */
            .summary-section {{ margin-bottom: 16px; }}
            .summary-title {{ font-family: 'Outfit', sans-serif; font-size: 10pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #0f172a; margin-bottom: 8px; border-bottom: 2px solid #0f172a; padding-bottom: 3px; }}
            .summary-table {{ width: 100%; border-collapse: separate; border-spacing: 0; font-size: 8pt; margin-bottom: 10px; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1; }}
            .summary-table th {{ background: #0f172a; color: #f8fafc; text-transform: uppercase; font-size: 7pt; font-weight: 800; letter-spacing: 0.6px; padding: 7px 10px; text-align: left; }}
            .summary-table td {{ padding: 6px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; background: #ffffff; }}
            .executive-border-top td {{ border-top: 2px solid #0f172a; }}
            .product-row-bg td {{ background: #f8fafc; }}

            .executive-card-box {{ display: flex; flex-direction: column; gap: 2px; }}
            .executive-name-text {{ font-family: 'Outfit', sans-serif; font-size: 9.5pt; font-weight: 800; color: #0f172a; line-height: 1.1; }}
            .executive-role-text {{ font-size: 7pt; color: #64748b; font-weight: 600; text-transform: uppercase; }}

            .page-nav-badge {{ display: inline-flex; align-items: center; gap: 4px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border: 1px solid #3b82f6; color: #ffffff !important; text-decoration: none; font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 7.5pt; padding: 4px 8px; border-radius: 14px; box-shadow: 0 2px 4px rgba(15, 23, 42, 0.2); }}
            .pg-num {{ color: #60a5fa; font-weight: 900; font-size: 7.5pt; letter-spacing: 0.5px; }}
            .pg-arrow {{ font-size: 8pt; color: #ffffff; }}

            .product-chip {{ display: inline-flex; align-items: center; gap: 4px; background: #eff6ff; color: #1d4ed8; font-weight: 800; font-size: 8pt; padding: 3px 8px; border-radius: 4px; border: 1px solid #bfdbfe; }}

            .task-item-card {{ background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 4px 7px; margin-bottom: 4px; }}
            .task-item-pending {{ border-left: 3px solid #ea580c; }}
            .task-item-overdue {{ border-left: 3px solid #dc2626; background: #fef2f2; border-color: #fecaca; }}
            .task-item-completed {{ border-left: 3px solid #16a34a; background: #f0fdf4; }}

            .task-title {{ font-weight: 800; font-size: 8pt; color: #0f172a; display: flex; align-items: center; justify-content: space-between; }}
            .task-meta {{ font-size: 7pt; color: #64748b; margin-top: 1px; }}

            .badge-mini-overdue {{ background: #dc2626; color: white; font-size: 6pt; font-weight: 800; padding: 1px 4px; border-radius: 2px; letter-spacing: 0.4px; }}
            .overdue-text {{ color: #b91c1c; font-weight: 800; }}

            .outcome-pill-won {{ display: inline-block; background: #d1fae5; color: #047857; border: 1px solid #a7f3d0; font-weight: 800; font-size: 7.5pt; padding: 3px 6px; border-radius: 4px; margin-bottom: 2px; }}
            .outcome-pill-lost {{ display: inline-block; background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; font-weight: 800; font-size: 7.5pt; padding: 3px 6px; border-radius: 4px; }}

            /* DETAILED USER SECTIONS - HIGH DENSITY */
            .user-section {{ margin-bottom: 16px; scroll-margin-top: 10px; }}
            .user-header {{ display: flex; align-items: center; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 8px 14px; border-radius: 6px; margin-bottom: 10px; }}
            .user-initials {{ background: #ffffff; color: #0f172a; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 11pt; margin-right: 10px; }}
            .user-details h2 {{ color: white; font-family: 'Outfit', sans-serif; font-size: 12pt; margin: 0; }}
            .user-details span {{ font-size: 7pt; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }}

            .product-group {{ margin-left: 6px; margin-bottom: 14px; padding-left: 10px; border-left: 2px solid #cbd5e1; }}
            .product-title {{ font-family: 'Outfit', sans-serif; font-size: 9.5pt; font-weight: 800; color: #1e293b; background: #f1f5f9; padding: 6px 12px; border-left: 4px solid #2563eb; border-radius: 4px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; text-transform: uppercase; }}

            .data-block {{ border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 10px; overflow: hidden; background: #ffffff; }}
            .block-header {{ padding: 5px 10px; font-size: 7.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: white; }}
            .header-leads {{ background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); }}
            .header-pending {{ background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); }}
            .header-completed {{ background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); }}

            table {{ width: 100%; border-collapse: collapse; font-size: 8pt; }}
            th {{ text-align: left; padding: 5px 8px; background: #f8fafc; color: #64748b; font-size: 7pt; font-weight: 800; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }}
            td {{ padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }}
            .lead-name {{ font-weight: 800; color: #0f172a; font-size: 8.5pt; }}
            .lead-id {{ display: block; font-size: 7pt; color: #64748b; font-family: monospace; margin-top: 1px; }}

            .stage-from {{ color: #94a3b8; font-size: 7.5pt; }} .stage-to {{ color: #0f172a; font-weight: 800; font-size: 8.5pt; }}
            .status-arrow {{ color: #cbd5e1; margin: 0 3px; font-weight: bold; }} .date-subtext {{ display: block; font-size: 7pt; color: #64748b; margin-top: 2px; font-weight: 600; text-transform: uppercase; }}

            .pill-active {{ background: #2563eb; color: white; padding: 2px 6px; border-radius: 3px; font-size: 7pt; font-weight: 800; text-transform: uppercase; }}
            .pill-status {{ background: #0f172a; color: #ffffff; padding: 2px 6px; border-radius: 3px; font-size: 7pt; font-weight: 800; text-transform: uppercase; border: 1px solid #334155; }}
            .overdue-row td {{ background-color: #fef2f2 !important; border-bottom: 1px solid #fecaca; }}
            .overdue-badge {{ background: #dc2626; color: white; padding: 1px 4px; border-radius: 3px; font-size: 6.5pt; font-weight: 800; margin-left: 6px; }}
            .empty-state {{ padding: 8px; text-align: center; font-size: 7.5pt; font-style: italic; color: #64748b; background: #f8fafc; }}

            .board-footer-box {{ margin-top: 20px; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-size: 7.5pt; color: #64748b; }}
          </style>
        </head>
        <body>
          <div class="document-page">
            <div class="masthead">
              <div class="masthead-left">
                <div class="kicker">⚡ Star AI Sales Intelligence</div>
                <h1>Weekly Executive Pipeline Report</h1>
              </div>
              <div class="masthead-right">
                <div>Reporting Period: <strong>{period_str}</strong></div>
                <div>Issued Date: <strong>{report_date_str}</strong></div>
                <div>Scope: <strong>Global Sales & Pipeline Activity</strong></div>
              </div>
            </div>

            <div class="kpi-grid">
              <div class="kpi-card kpi-pipeline">
                <div class="kpi-label">Active Pipeline Value</div>
                <div class="kpi-value">₹{total_pipeline_val:,.0f}</div>
              </div>
              <div class="kpi-card kpi-won">
                <div class="kpi-label">Deals Closed Won</div>
                <div class="kpi-value">₹{deals_won_val:,.0f}</div>
              </div>
              <div class="kpi-card kpi-pending">
                <div class="kpi-label">Pending Tasks</div>
                <div class="kpi-value">{total_pending_cnt} Tasks</div>
              </div>
              <div class="kpi-card kpi-overdue">
                <div class="kpi-label">Overdue Alerts</div>
                <div class="kpi-value">{total_overdue_cnt} Overdue</div>
              </div>
            </div>

            <div class="summary-section">
              <div class="summary-title">📌 Executive & Product Level Performance Overview</div>
              <table class="summary-table">
                <thead>
                  <tr>
                    <th width="10%" style="text-align: center;">Page No</th>
                    <th width="18%">Executive Name</th>
                    <th width="14%">Product</th>
                    <th width="27%">Pending Tasks</th>
                    <th width="19%">Completed Tasks</th>
                    <th width="12%">Won / Lost</th>
                  </tr>
                </thead>
                <tbody>
                  {overview_rows_html}
                </tbody>
              </table>
            </div>

            {detailed_sections_html}

            <div class="board-footer-box avoid-break">
              <div><strong>Star AI Sales Management System</strong> • Weekly Pipeline Briefing</div>
              <div>Confidential • Generated for <strong>CFO & CEO Executive Review</strong></div>
            </div>
          </div>
        </body>
        </html>
        """

        output_dir = "/tmp/weekly_reports"
        os.makedirs(output_dir, exist_ok=True)
        timestamp_str = datetime.now().strftime("%Y-%m-%d_%H%M%S")
        simple_filename = f"Weekly_Executive_Report_{timestamp_str}.pdf"
        pdf_filename = os.path.join(output_dir, simple_filename)

        # Render Compact HTML to PDF pixel-perfectly with Playwright Chromium
        from playwright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.set_content(full_html, wait_until="networkidle")
            pdf_bytes = await page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "5mm", "bottom": "5mm", "left": "5mm", "right": "5mm"}
            )
            await browser.close()

        # ── SeaweedFS Upload & Database Registration ─────────────────────────────
        pdf_url = None
        try:
            from app.utils.seaweed_client import upload_bytes_to_seaweed
            seaweed_res = await upload_bytes_to_seaweed(
                file_bytes=pdf_bytes,
                filename=simple_filename,
                bucket_name="startai",
                folder_name="weekly_reports"
            )
            pdf_url = seaweed_res.get("file_url")
            logger.info(f"[WeeklyReportService] Weekly PDF successfully uploaded to SeaweedFS: {pdf_url}")
        except Exception as seaweed_err:
            logger.error(f"[WeeklyReportService Error] Failed to upload PDF to SeaweedFS: {seaweed_err}")

        if pdf_url:
            try:
                import uuid
                from app.db.base import get_main_session_factory
                from app.models.sales.weekly_pdf_register import WeeklyPdfRegister
                
                session_factory = get_main_session_factory()
                async with session_factory() as db_sess:
                    record = WeeklyPdfRegister(
                        weekly_pdf_id=f"WPDF-{uuid.uuid4().hex[:8].upper()}",
                        report_date=datetime.now().date(),
                        pdf_url=pdf_url,
                        filename=simple_filename,
                        file_size_bytes=len(pdf_bytes),
                    )
                    db_sess.add(record)
                    await db_sess.commit()
                    logger.info(f"[WeeklyReportService] Recorded weekly PDF in sales.weekly_pdf_register with ID '{record.weekly_pdf_id}' and URL '{pdf_url}'")
            except Exception as db_err:
                logger.error(f"[WeeklyReportService Error] Failed to record weekly PDF in DB: {db_err}")

        # Save temporary file for email attachment dispatch
        with open(pdf_filename, "wb") as f:
            f.write(pdf_bytes)

        return pdf_filename

    except Exception as pdf_err:
        logger.error(f"[WeeklyReportService] Playwright PDF Generation Error: {pdf_err}")
        return None


async def generate_and_send_weekly_sales_report(force: bool = False) -> bool:
    """
    Generates and sends the weekly executive sales report email with attached PDF to CFO and CEO.
    Dispatches both the HTML Email Body and the High-Density Playwright PDF Attachment.
    Includes DB-backed idempotency check to guarantee exactly once per day execution.
    """
    session_factory = get_main_session_factory()
    now = datetime.now()
    today_date = now.date()

    async with session_factory() as session:
        # Idempotency Check: Prevent duplicate PDF report generation on the same day
        if not force:
            from app.models.sales.weekly_pdf_register import WeeklyPdfRegister
            existing_report_stmt = select(WeeklyPdfRegister).where(
                WeeklyPdfRegister.report_date == today_date,
                WeeklyPdfRegister.is_active == True
            )
            ex_res = await session.execute(existing_report_stmt)
            if ex_res.scalars().first():
                logger.info(f"[WeeklyReportService] Executive PDF report for today ({today_date}) already generated and sent. Skipping duplicate run.")
                return True

        # 1. Fetch Recipients (CFO & CEO emails)
        cfo_ceo_stmt = select(Leader).where(
            func.upper(func.trim(Leader.designation)).in_(["CEO", "CFO"]),
            Leader.is_active == True
        )
        res = await session.execute(cfo_ceo_stmt)
        executives = list(res.scalars().all())
        recipient_emails = list(dict.fromkeys([e.email for e in executives if e.email]))

        if not recipient_emails:
            logger.warning("[WeeklyReportService] No active CFO/CEO emails found to send weekly report.")
            return False

        # 2. Gather Leaders with active leads/products
        leaders_stmt = (
            select(Leader)
            .where(Leader.is_active == True)
            .order_by(Leader.first_name, Leader.last_name)
        )
        active_leaders = list((await session.execute(leaders_stmt)).scalars().all())

        executives_data = []
        total_pipeline_val = 0.0
        deals_won_val = 0.0
        deals_won_cnt = 0
        total_pending_cnt = 0
        total_overdue_cnt = 0

        cutoff_date = (now - timedelta(days=7)).date()

        for ldr in active_leaders:
            # Query Leads owned by this leader
            leads_stmt = (
                select(LeadRegister)
                .where(LeadRegister.lead_owner_id == ldr.leader_id)
                .options(
                    selectinload(LeadRegister.products).options(
                        selectinload(ProductRegister.product_type),
                        selectinload(ProductRegister.product_status_type),
                        selectinload(ProductRegister.stage_status_type),
                    ),
                    selectinload(LeadRegister.activities).options(
                        selectinload(LeadActivityRegister.action_status_type),
                        selectinload(LeadActivityRegister.activity_type_status),
                    )
                )
                .order_by(LeadRegister.created_date.desc())
            )
            ldr_leads = list((await session.execute(leads_stmt)).scalars().all())

            # Group by Product
            prod_map = {}
            for ld in ldr_leads:
                created_str = ld.created_date.strftime("%b %d, %Y") if ld.created_date else "N/A"
                ld_date = ld.created_date.date() if isinstance(ld.created_date, datetime) else ld.created_date

                for prd in (ld.products or []):
                    p_name = prd.product_type.product if prd.product_type else "General Product"
                    stage_text = prd.stage_status_type.leader_stage if prd.stage_status_type else "N/A"
                    prev_stage = STAGE_PROGRESSION.get(stage_text, "Qualification")

                    # Priority status resolution:
                    # 1. If Stage is "Lost" or Product Status is "Lost" -> "Lost"
                    # 2. If Stage is "Won", Won Amount > 0, or Product Status is "Won" -> "Won"
                    # 3. Otherwise use Product Status if available, else "In Progress"
                    p_status_lower = (prd.product_status_type.status.lower() if prd.product_status_type and prd.product_status_type.status else "")
                    if stage_text.lower() == "lost" or p_status_lower == "lost":
                        prod_status_text = "Lost"
                    elif stage_text.lower() == "won" or (prd.won and float(prd.won) > 0) or p_status_lower == "won":
                        prod_status_text = "Won"
                    elif prd.product_status_type and prd.product_status_type.status:
                        prod_status_text = prd.product_status_type.status
                    else:
                        prod_status_text = "In Progress"

                    if p_name not in prod_map:
                        prod_map[p_name] = {
                            "product_name": p_name,
                            "stage_name": stage_text,
                            "status_name": prod_status_text,
                            "won_val": float(prd.won or 0),
                            "project_val": float(prd.project_value or 0),
                            "pending_tasks": [],
                            "completed_tasks": [],
                            "leads": []
                        }
                    else:
                        if prod_status_text in ["Lost", "Won"]:
                            prod_map[p_name]["status_name"] = prod_status_text
                        if float(prd.won or 0) > 0:
                            prod_map[p_name]["won_val"] += float(prd.won or 0)
                        prod_map[p_name]["project_val"] += float(prd.project_value or 0)

                    # Append lead stage update ONLY IF created/updated in the past 7 days
                    if ld_date and ld_date >= cutoff_date:
                        prod_map[p_name]["leads"].append({
                            "lead_id": ld.lead_id,
                            "company": ld.company or "N/A",
                            "prev_stage": prev_stage,
                            "current_stage": stage_text,
                            "updated_date": created_str,
                            "status_label": prod_status_text,
                        })

                    total_pipeline_val += float(prd.project_value or 0)
                    if prd.won and float(prd.won) > 0:
                        deals_won_val += float(prd.won)
                        deals_won_cnt += 1

                # Gather activities for this lead - ONLY IF activity_date is in past 7 days
                for act in (ld.activities or []):
                    if not act.activity_date or act.activity_date < cutoff_date:
                        continue

                    act_date = act.activity_date.strftime("%b %d")
                    is_overdue = False
                    if act.action_status_id == 4:  # Pending
                        total_pending_cnt += 1
                        if act.activity_date < now.date():
                            is_overdue = True
                            total_overdue_cnt += 1

                    task_item = {
                        "summary": getattr(act, "meeting_plan", None) or getattr(act, "summary", "Activity"),
                        "lead_name": ld.company or "Lead",
                        "due_date": act_date,
                        "done_date": act_date,
                        "is_overdue": is_overdue
                    }

                    # Assign to first product or general
                    target_pname = ld.products[0].product_type.product if (ld.products and ld.products[0].product_type) else "General"
                    if target_pname in prod_map:
                        if act.action_status_id == 4:
                            prod_map[target_pname]["pending_tasks"].append(task_item)
                        elif act.action_status_id == 2:
                            prod_map[target_pname]["completed_tasks"].append(task_item)

            if prod_map:
                executives_data.append({
                    "emp_id": ldr.emp_id,
                    "full_name": ldr.full_name,
                    "designation": ldr.designation or "Account Executive",
                    "products": list(prod_map.values())
                })

    report_date_str = now.strftime("%b %d, %Y")
    period_str = f"{(now - timedelta(days=7)).strftime('%b %d')} – {now.strftime('%b %d, %Y')}"

    # Generate Compact High-Density Playwright PDF Attachment
    pdf_filepath = await generate_weekly_report_pdf(
        report_date_str=report_date_str,
        period_str=period_str,
        total_pipeline_val=total_pipeline_val,
        deals_won_val=deals_won_val,
        deals_won_cnt=deals_won_cnt,
        total_pending_cnt=total_pending_cnt,
        total_overdue_cnt=total_overdue_cnt,
        executives_data=executives_data,
    )

    # HTML Email Body
    template_path = os.path.join(os.path.dirname(__file__), "templates", "weekly_executive_report_prototype.html")
    email_html = ""
    if os.path.exists(template_path):
        try:
            with open(template_path, "r", encoding="utf-8") as f:
                email_html = f.read()
        except Exception:
            pass

    if not email_html:
        email_html = f"<h2>Executive Weekly Pipeline Report ({period_str})</h2><p>Please find attached the official PDF report.</p>"

    # Queue Email Dispatch in sales.mail_events outbox table
    from app.db.base import get_main_session_factory
    from app.services.sales.mail_event_service import queue_mail_event

    try:
        session_factory = get_main_session_factory()
        from app.services.o365_service import O365Service
        creds = O365Service._fetch_credentials_sync()
        report_sender = creds.get("weekly_report_email_from") or os.getenv("WEEKLY_REPORT_EMAIL_FROM")
        report_payload = {
            "to": recipient_emails,
            "subject": f"[Tunir] Executive Pipeline Report (Senior Edition PDF Attached) - {report_date_str}",
            "body": email_html,
            "attachments": [pdf_filepath] if (pdf_filepath and os.path.exists(pdf_filepath)) else None,
            "html": True
        }
        if report_sender:
            report_payload["sender"] = report_sender

        async with session_factory() as session:
            await queue_mail_event(
                session=session,
                event_type="weekly_executive_report",
                payload=report_payload
            )
            await session.commit()
            logger.info(f"[WeeklyReportService] Queued executive report email in sales.mail_events for {recipient_emails}. PDF stored at {pdf_filepath}")

            # Trigger immediate background mail dispatch
            try:
                from app.services.sales.email.mail_event_service import process_pending_mail_events
                await process_pending_mail_events()
            except Exception as mail_dispatch_err:
                logger.error(f"[WeeklyReportService Error] Immediate mail dispatch failed: {mail_dispatch_err}")
    except Exception as e:
        logger.error(f"[WeeklyReportService Error] Failed to queue executive report email: {e}")

    return True


async def check_missed_job_from_apscheduler_table() -> None:
    """
    Checks sales.apscheduler_jobs table on startup BEFORE or DURING scheduling.
    If the stored next_run_time is in the past (indicating server downtime during a scheduled run),
    it automatically triggers the missed weekly executive report immediately.
    """
    try:
        session_factory = get_main_session_factory()
        now_ts = datetime.now().timestamp()

        async with session_factory() as session:
            table_check = await session.execute(
                text("SELECT to_regclass('sales.apscheduler_jobs');")
            )
            table_name = table_check.scalar()
            if not table_name:
                logger.info("[WeeklyReportService] sales.apscheduler_jobs table not created yet (first run). Will be initialized on scheduler start.")
                return

            result = await session.execute(
                text("SELECT next_run_time FROM sales.apscheduler_jobs WHERE id = 'weekly_executive_pdf_report'")
            )
            row = result.fetchone()

            if row and row[0]:
                stored_next_run_time = row[0]
                if stored_next_run_time < now_ts:
                    missed_dt = datetime.fromtimestamp(stored_next_run_time)
                    logger.info(
                        f"[WeeklyReportService] ⚠️ Detected missed scheduled run from {missed_dt} "
                        f"(stored in sales.apscheduler_jobs). Triggering catch-up report now..."
                    )
                    await generate_and_send_weekly_sales_report(force=True)
                else:
                    logger.info("[WeeklyReportService] No missed scheduled runs found in sales.apscheduler_jobs.")
    except Exception as err:
        logger.warning(f"[WeeklyReportService] Missed job check skipped: {err}")


_weekly_scheduler: Optional[Any] = None


async def start_weekly_report_cron():
    """
    Initializes APScheduler for the weekly executive PDF report.
    Triggers EXACTLY ONCE per week on Saturdays at 5:00 PM IST (17:00 IST).
    Performs a startup check on sales.apscheduler_jobs to catch up on any missed runs during downtime.
    """
    global _weekly_scheduler
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
    from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
    from app.config import settings

    if _weekly_scheduler and _weekly_scheduler.running:
        logger.info("[WeeklyReportService] APScheduler is already running.")
        return _weekly_scheduler

    # AWAIT check for missed jobs in sales.apscheduler_jobs table BEFORE add_job overwrites next_run_time
    try:
        await check_missed_job_from_apscheduler_table()
    except Exception as e:
        logger.warning(f"[WeeklyReportService Warning] Startup missed job check failed: {e}")

    # Construct the synchronous psycopg2 URL for SQLAlchemyJobStore
    sync_db_url = str(settings.asyncpg_url).replace("+asyncpg", "+psycopg2")

    jobstores = {
        'default': SQLAlchemyJobStore(
            url=sync_db_url,
            tablename='apscheduler_jobs',
            tableschema='sales',
            engine_options={
                'pool_size': 5,
                'max_overflow': 10,
                'pool_recycle': 1800,
                'pool_pre_ping': True,
            }
        )
    }

    _weekly_scheduler = AsyncIOScheduler(jobstores=jobstores)
    _weekly_scheduler.add_job(
        generate_and_send_weekly_sales_report,
        CronTrigger(day_of_week='wed', hour=16, minute=25, timezone='Asia/Kolkata'),
        id='weekly_executive_pdf_report',
        replace_existing=True,
        misfire_grace_time=None
    )
    _weekly_scheduler.start()
    logger.info("[WeeklyReportService] 🚀 APScheduler initialized with PostgreSQL JobStore (Scheduled: Saturdays at 5:00 PM IST).")
    return _weekly_scheduler


