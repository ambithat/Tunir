import requests
import json
import urllib.parse
import io
import csv
import time
import re
import difflib

from requests.adapters import HTTPAdapter
from urllib3 import Retry



import os

class SupersetService:
    def __init__(self, host=None, username=None, password=None):
        host = host or os.getenv("SUPERSET_HOST", "starai.local:8088")
        username = username or os.getenv("SUPERSET_USERNAME", "admin")
        password = password or os.getenv("SUPERSET_PASSWORD", "admin")
        
        clean_host = host.replace("http://", "").replace("https://", "").strip("/")
        
        self.host = clean_host
        self.base_url = f"http://{self.host}/api/v1"
        self.username = username
        self.password = password
        self._token = None
        self._csrf_token = None 
        self.api_session = requests.Session() 
        
        # 🚀 Fix for Connection Aborted: Add retries to the main API session
        retry = Retry(connect=3, backoff_factor=0.5)
        adapter = HTTPAdapter(max_retries=retry)
        self.api_session.mount('http://', adapter)
        self.api_session.mount('https://', adapter)

    def _authenticate(self):
        url = f"{self.base_url}/security/login"
        payload = {
            "username": self.username, 
            "password": self.password, 
            "provider": "db",
            "refresh": True
        }
        
        try:
            response = self.api_session.post(url, json=payload, timeout=10)
            response.raise_for_status()
            self._token = response.json().get('access_token')
            print("✅ Superset API Authentication Successful!")
            
            csrf_url = f"{self.base_url}/security/csrf_token/"
            csrf_resp = self.api_session.get(csrf_url, headers={"Authorization": f"Bearer {self._token}"}, timeout=10)
            if csrf_resp.status_code == 200:
                self._csrf_token = csrf_resp.json().get("result")
                print("✅ API CSRF Token Acquired!")
                
        except Exception as e:
            print(f"❌ Superset Auth Failed: {e}")
            raise e

    def get_headers(self):
        if not self._token:
            self._authenticate()
            
        headers = {
            "Authorization": f"Bearer {self._token}", 
            "Accept": "application/json"
        }
        
        if self._csrf_token:
            headers["X-CSRFToken"] = self._csrf_token
            
        return headers

    # ─────────────────────────────────────────────────────────────────────────
    # 🛰️ DYNAMIC DASHBOARD DISCOVERY
    # ─────────────────────────────────────────────────────────────────────────

    def get_all_dashboards(self) -> list:
        try:
            q = {"page_size": 100}
            url = f"{self.base_url}/dashboard/"
            resp = self.api_session.get(url, headers=self.get_headers(), params={"q": json.dumps(q)}, timeout=15)
            resp.raise_for_status()
            
            return [{
                "id": d["id"],
                "title": d["dashboard_title"],
                "slug": d.get("slug") or str(d["id"])
            } for d in resp.json().get("result", [])]
        except Exception as e:
            print(f"❌ Failed to fetch dynamic dashboard list: {e}")
            return []

    def find_best_dashboard_match(self, user_query: str) -> dict:
        dashboards = self.get_all_dashboards()
        if not dashboards: return None
        
        clean_q = re.sub(r'[^a-zA-Z0-9]', ' ', user_query).lower().strip()
        clean_q = " ".join(clean_q.split())
        if not clean_q: return None

        best_match = None
        highest_score = 0

        for d in dashboards:
            clean_title = re.sub(r'[^a-zA-Z0-9]', ' ', d['title']).lower().strip()
            clean_title = " ".join(clean_title.split())

            score = 0
            if clean_q == clean_title:
                return d
            
            if clean_title in clean_q:
                score += 50 + len(clean_title)
            elif clean_q in clean_title:
                score += 40 + len(clean_q)

            q_words = set(clean_q.split())
            t_words = set(clean_title.split())
            overlap = q_words.intersection(t_words)
            score += len(overlap) * 15
            
            ratio = difflib.SequenceMatcher(None, clean_q, clean_title).ratio()
            score += ratio * 20 

            if score > highest_score:
                highest_score = score
                best_match = d

        if highest_score > 15:
            return best_match
        return None

    # ─────────────────────────────────────────────────────────────────────────
    # 🍪 TRUE UI COOKIE BOUNCE (Form Login)
    # ─────────────────────────────────────────────────────────────────────────

    def get_session_cookie(self):
        # 🚀 ANTI-CONNECTION-RESET FIX: 
        # Add retries and fake browser headers to bypass strict server drops.
        session = requests.Session()
        retry = Retry(connect=3, backoff_factor=0.5)
        adapter = HTTPAdapter(max_retries=retry)
        session.mount('http://', adapter)
        session.mount('https://', adapter)
        
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Connection": "keep-alive"
        })
        
        login_url = f"http://{self.host}/login/"
        
        try:
            resp = session.get(login_url, timeout=10)
            resp.raise_for_status()
            
            csrf_token = ""
            match = re.search(r'name="csrf_token"\s*type="hidden"\s*value="(.*?)"', resp.text)
            if match:
                csrf_token = match.group(1)
            else:
                match = re.search(r'csrf_token:\s*"(.*?)"', resp.text)
                if match:
                    csrf_token = match.group(1)
            
            payload = {
                "username": self.username,
                "password": self.password,
                "csrf_token": csrf_token
            }
            
            post_resp = session.post(login_url, data=payload, headers={"Referer": login_url}, timeout=10)
            post_resp.raise_for_status()
            
            cookies = session.cookies.get_dict()
            
            if "session" in cookies and "login" not in post_resp.url:
                print("✅ True UI cookies captured successfully.")
                return cookies
            else:
                print("❌ ERROR: Form login rejected. Credentials might be wrong.")
                return None
                
        except requests.exceptions.ConnectionError as ce:
            print(f"❌ Connection dropped by Superset during cookie fetch: {ce}. The server might be overloaded or rejecting Python requests.")
            return None
        except Exception as e:
            print(f"❌ Failed to capture true UI cookies: {e}")
            return None

    # ─────────────────────────────────────────────────────────────────────────
    # 🚀 DATA EXTRACTION (EXACT NATIVE DRILL-TO-DETAIL)
    # ─────────────────────────────────────────────────────────────────────────
    
    def _get_chart_data(self, chart_id: int, result_format: str = "json", extra_filters: list = None, fetch_raw_dataset: bool = True) -> requests.Response:
        headers = self.get_headers()
        
        q = {"filters": [{"col": "id", "opr": "eq", "value": chart_id}], "columns": ["id", "params", "datasource_id", "datasource_type"]}
        res = self.api_session.get(f"{self.base_url}/chart/?q={json.dumps(q)}", headers=headers, timeout=10)
        res.raise_for_status()
        
        data = res.json().get("result", [])
        if not data: raise Exception("Chart not found")
        chart_meta = data[0]
        
        try: form_data = json.loads(chart_meta.get("params") or "{}")
        except: form_data = {}
        
        ds_id = chart_meta.get("datasource_id", 0)
        ds_type = chart_meta.get("datasource_type", "table")
        
        query_obj = form_data.copy()
        if "datasource" in query_obj: del query_obj["datasource"]
        
        req_result_type = "full"

        if fetch_raw_dataset and ds_id:
            original_filters = query_obj.get("filters", [])
            original_adhoc = query_obj.get("adhoc_filters", [])
            
            query_obj = {
                "row_limit": 10000,
                "filters": original_filters,
                "adhoc_filters": original_adhoc,
                "metrics": [],
                "groupby": [],
                "orderby": [],
                "columns": [],           
                "post_processing": [],   
                "is_timeseries": False
            }
            
            req_result_type = "samples"  
        else:
            if "all_columns" in query_obj and not query_obj.get("columns"): query_obj["columns"] = query_obj.get("all_columns")
            if not query_obj.get("metrics") and not query_obj.get("columns"): query_obj["columns"] = query_obj.get("groupby", [])
            query_obj["row_limit"] = 10000

        # 🚀 UPGRADED: Smart Fuzzy Filter Sanitization
        if extra_filters:
            valid_cols = []
            if ds_id:
                try:
                    ds_resp = self.api_session.get(f"{self.base_url}/dataset/{ds_id}", headers=headers, timeout=10)
                    valid_cols = [c.get("column_name") for c in ds_resp.json().get("result", {}).get("columns", [])]
                except: pass

            def sanitize_filter_col(c):
                if not c: return ""
                clean_c = str(c).strip().lower().replace(" ", "_")
                for v in valid_cols: 
                    if v.lower() == clean_c: return v
                for v in valid_cols:
                    if clean_c in v.lower() or v.lower() in clean_c: return v
                matches = difflib.get_close_matches(clean_c, [v.lower() for v in valid_cols], n=1, cutoff=0.3)
                if matches:
                    for v in valid_cols:
                        if v.lower() == matches[0]: return v
                return c

            api_filters = query_obj.get("filters", [])
            if not isinstance(api_filters, list): api_filters = []
            
            adhoc_filters = query_obj.get("adhoc_filters", [])
            if not isinstance(adhoc_filters, list): adhoc_filters = []
            
            for f in extra_filters:
                clean_col = sanitize_filter_col(f.get("col"))
                op = f.get("op", "==")
                if op == "=": op = "=="
                val = f.get("val")
                
                api_filters.append({"col": clean_col, "op": op, "val": val})
                adhoc_filters.append({
                    "clause": "WHERE", "subject": clean_col, "operator": op, 
                    "comparator": val, "expressionType": "SIMPLE"
                })
                
            query_obj["filters"] = api_filters
            query_obj["adhoc_filters"] = adhoc_filters
        
        payload = {
            "datasource": {"id": int(ds_id), "type": ds_type},
            "queries": [query_obj],
            "result_format": result_format,
            "result_type": req_result_type
        }
        
        data_resp = self.api_session.post(f"{self.base_url}/chart/data", headers=headers, json=payload, timeout=30)
        
        if data_resp.status_code >= 400 and req_result_type == "samples":
            payload["result_type"] = "full"
            data_resp = self.api_session.post(f"{self.base_url}/chart/data", headers=headers, json=payload, timeout=30)
            
        data_resp.raise_for_status()
        return data_resp

    def get_chart_raw_data(self, chart_id: int, extra_filters: list = None, fetch_raw_dataset: bool = True) -> list:
        try:
            resp = self._get_chart_data(chart_id, result_format="json", extra_filters=extra_filters, fetch_raw_dataset=fetch_raw_dataset)
            result_array = resp.json().get("result", [])
            return result_array[0]["data"] if result_array and "data" in result_array[0] else []
        except Exception as e: 
            print(f"❌ Raw Data Fetch Error: {e}")
            return []

    def download_chart_csv(self, chart_id: int) -> bytes:
        try:
            resp = self._get_chart_data(chart_id, result_format="csv", fetch_raw_dataset=True)
            return resp.content
        except Exception:
            raw_data = self.get_chart_raw_data(chart_id, fetch_raw_dataset=True)
            if not raw_data: return None
            output = io.StringIO()
            dict_writer = csv.DictWriter(output, fieldnames=raw_data[0].keys())
            dict_writer.writeheader(); dict_writer.writerows(raw_data)
            return output.getvalue().encode('utf-8')

    # ─────────────────────────────────────────────────────────────────────────
    # 🎯 ENHANCED SUMMARY & DETAILS 
    # ─────────────────────────────────────────────────────────────────────────

    def get_dashboard_summary(self, dashboard_query: str) -> str:
        try:
            match = self.find_best_dashboard_match(dashboard_query)
            if not match: 
                return f"[Dashboard '{dashboard_query}' not found]"
            
            headers = self.get_headers()
            dash_id = match["id"]
            
            charts_resp = self.api_session.get(f"{self.base_url}/dashboard/{dash_id}/charts", headers=headers, timeout=15)
            charts = charts_resp.json().get("result", [])
            
            lines = [f"Dashboard: {match['title']} (ID: {dash_id})", f"Charts: {len(charts)}", "-"*20]
            for i, c in enumerate(charts): 
                lines.append(f"CHART[{i}]: {c.get('slice_name')} (ID: {c.get('id')}, Viz: {c.get('viz_type')})")
            return "\n".join(lines)
        except Exception as e: 
            return f"[Error: {str(e)}]"
        
    def get_chart_details(self, dashboard_query: str, chart_query: str, extra_filters: list = None) -> dict:
        try:
            match = self.find_best_dashboard_match(dashboard_query)
            if not match: 
                return {"error": f"Dashboard '{dashboard_query}' not found."}
            
            headers = self.get_headers()
            dash_id = match["id"]
            
            c_query = {"columns": ["id", "slice_name", "viz_type", "params"]}
            charts_resp = self.api_session.get(f"{self.base_url}/dashboard/{dash_id}/charts", headers=headers, params={"q": json.dumps(c_query)}, timeout=15)
            charts = charts_resp.json().get("result", [])
            
            clean_q = re.sub(r'[^a-zA-Z0-9]', ' ', chart_query).lower().strip()
            clean_q = " ".join(clean_q.split())
            
            best_match = None
            highest_score = 0
            
            for c in charts:
                c_name = c.get("slice_name", "")
                clean_title = re.sub(r'[^a-zA-Z0-9]', ' ', c_name).lower().strip()
                clean_title = " ".join(clean_title.split())
                
                score = 0
                if clean_q == clean_title:
                    best_match = c
                    break 
                if clean_title in clean_q:
                    score += 50 + len(clean_title)
                elif clean_q in clean_title:
                    score += 40 + len(clean_q)
                    
                q_words = set(clean_q.split())
                t_words = set(clean_title.split())
                score += len(q_words.intersection(t_words)) * 15
                
                ratio = difflib.SequenceMatcher(None, clean_q, clean_title).ratio()
                score += ratio * 20
                
                if score > highest_score:
                    highest_score = score
                    best_match = c

            if not best_match or highest_score < 15: 
                return {"error": "Chart not found in this dashboard."}
                
            session_cookies = self.get_session_cookie()
            chart_id = best_match['id']
            
            full_chart_query = {
                "filters": [{"col": "id", "opr": "eq", "value": chart_id}],
                "columns": ["id", "params", "datasource_id", "datasource_type"]
            }
            full_chart_resp = self.api_session.get(f"{self.base_url}/chart/?q={json.dumps(full_chart_query)}", headers=headers, timeout=10)
            full_chart_data = full_chart_resp.json().get("result", [])
            
            if not full_chart_data:
                return {"error": "Failed to fetch full chart configuration."}
                
            chart_meta = full_chart_data[0]
            
            original_params_str = chart_meta.get("params") or "{}"
            try:
                form_data = json.loads(original_params_str)
            except Exception:
                form_data = {}
                
            form_data["slice_id"] = chart_id
            ds_id = chart_meta.get("datasource_id")
            ds_type = chart_meta.get("datasource_type", "table")
            if ds_id:
                form_data["datasource"] = f"{ds_id}__{ds_type}"

            # 🚀 UPGRADED: Smart Fuzzy Filter Sanitization for UI iframe
            if extra_filters:
                valid_cols = []
                if ds_id:
                    try:
                        ds_resp = self.api_session.get(f"{self.base_url}/dataset/{ds_id}", headers=headers, timeout=10)
                        valid_cols = [c.get("column_name") for c in ds_resp.json().get("result", {}).get("columns", [])]
                    except: pass

                def sanitize_filter_col(c):
                    if not c: return ""
                    clean_c = str(c).strip().lower().replace(" ", "_")
                    for v in valid_cols: 
                        if v.lower() == clean_c: return v
                    for v in valid_cols:
                        if clean_c in v.lower() or v.lower() in clean_c: return v
                    matches = difflib.get_close_matches(clean_c, [v.lower() for v in valid_cols], n=1, cutoff=0.3)
                    if matches:
                        for v in valid_cols:
                            if v.lower() == matches[0]: return v
                    return c

                existing_filters = form_data.get("adhoc_filters", [])
                if not isinstance(existing_filters, list):
                    existing_filters = []
                    
                for f in extra_filters:
                    clean_col = sanitize_filter_col(f.get("col"))
                    op = f.get("op", "==")
                    if op == "=": op = "=="
                    
                    existing_filters.append({
                        "clause": "WHERE",
                        "subject": clean_col,
                        "operator": op,
                        "comparator": f.get("val"),
                        "expressionType": "SIMPLE"
                    })
                form_data["adhoc_filters"] = existing_filters

            encoded_form_data = urllib.parse.quote(json.dumps(form_data))
            url = f"http://{self.host}/superset/explore/?form_data={encoded_form_data}&standalone=2&force=true"
            
            return {
                "id": chart_id,
                "dashboard_id": dash_id,
                "name": best_match['slice_name'],
                "url": url,
                "session_cookie": session_cookies, 
                "status": "CHART_LOADED"
            }
        except Exception as e: 
            return {"error": str(e)}
