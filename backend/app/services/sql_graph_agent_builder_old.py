# from pydantic import BaseModel, Field
# # from star_ai_chatbot_postgresql.star_ai_chatbot import AgentState
# from thefuzz import fuzz
# from datetime import datetime, date, timedelta
# import re
# import asyncio
# import json
# import os
# import csv
# import uuid
# from decimal import Decimal
# import decimal

# from langchain_core.tools import tool
# from langchain_core.documents import Document
# from langchain_community.vectorstores import FAISS
# from langchain_core.messages import AIMessage, HumanMessage, BaseMessage
# from langgraph.graph.message import add_messages
# from langgraph.graph import StateGraph, START, END
# import pandas as pd
# import numpy as np
# import plotly.graph_objects as go
# import plotly.io as pio

# from typing import List

# # SQLAlchemy imports for standalone schema extraction
# from sqlalchemy import create_engine, MetaData, event
# from sqlalchemy.schema import CreateTable
# from sqlalchemy import text
# import sqlalchemy.types as sqltypes
# from sqlalchemy.ext.asyncio import create_async_engine
# from sqlalchemy.pool import NullPool


# from app.services.superset_service import SupersetService
# from app.core.path_utils import get_db_storage_paths

# from app.schemas.agent_model_schema import (
#     AgentStateScehma,
#     RetreiveSchema,
#     GenerateSqlScehma,
#     VerifyQuerySchema,
#     RetreiveSchemaSchema,
#     GenerateSQLSchema,
#     FixSQLSchema,
#     AnalysisMode
# )

# from app.services.llama_model_init import GroqLLM


# class SqlGraphQueryAgentBuilder:
#     SEASON_MAP = {
#         "summer":  {"months": [3, 4, 5],    "label": "Summer (Mar-May)"},
#         "monsoon": {"months": [6, 7, 8, 9], "label": "Monsoon (Jun-Sep)"},
#         "winter":  {"months": [11, 12, 1, 2],"label": "Winter (Nov-Feb)"},
#         "rainy":   {"months": [6, 7, 8, 9], "label": "Rainy (Jun-Sep)"},
#     }

#     def __init__(
#         self,
#         question: str = None,
#         user_id: str = None,
#         user_db_source=None,
#         active_api_key: str = None,
#         llm=None,
#         db_repo=None,
#         user_db_repo=None,
#         api_key_service=None,
#         vectorstore=None,
#         value_vectorstore=None,
#         value_docs=None,
#         chunks=None,
#         dangerous_commands=None,
#         last_conversation_history: list = None,
#         session_id: str = None,
#         message_id: str = None,
#         target_db_url: str = None,
#         db_drive: str = "sqlite",
#         db_display_name: str = "GISDB",
#         superset_service=None,
#         stream_callback=None,
#         embeddings=None
#     ):
#         self.question = question
#         self.user_id = user_id
#         self.user_db_source = user_db_source
#         self.active_api_key = active_api_key
#         self.results = []
#         self.llm = llm
#         self.db_repo = db_repo
#         self.user_db_repo = user_db_repo
#         self.api_key_service = api_key_service
#         self.vectorstore = vectorstore
#         self.value_vectorstore = value_vectorstore
#         self.value_docs = value_docs
#         self.chunks = chunks
#         self.dangerous_commands = dangerous_commands or ["drop", "delete", "truncate", "alter"]
#         self.last_conversation_history = last_conversation_history or []
#         self.session_id = session_id
#         self.message_id = message_id
#         self.last_query_id = None
#         self.target_db_url = target_db_url
#         self.db_drive = db_drive
#         self.db_display_name = db_display_name
#         self.stream_callback = stream_callback
#         self.embeddings = embeddings

#         if superset_service is None:
#             self.superset_service = SupersetService(
#                 host="starai.local:8088", username="admin", password="admin"
#             )
#         else:
#             self.superset_service = superset_service
            
#         self._max_history_messages = 4
#         self._max_message_chars = 500
#         self._max_history_chars = 1500
#         self._max_prompt_chars = 15000
#         self._max_schema_chars = 10000
#         self._max_hybrid_chars = 5000
        
#         self.CONVERSATIONPROMPT = """
#         SYSTEM: You are a high-intelligence intent classification utility. Output ONLY one label. 
#         Analyze the user question carefully. Ignore spelling mistakes (e.g., 'totel seles' means 'total sales').

#         User Question: {question}
#         previous conversation: {conversation}
#         chunks: {chunks}

#         LABELS:
#         1. DB_QUERY
#             - The question requires generating a NEW SQL query that is not related with the previous conversations.
        
#         2. FOLLOW_UP_SQL
#             - Use when the current user message depends on ANY previous
#             database question, SQL query, result, chart, table, or assistant suggestion.
#             - The user is continuing the same analysis instead of starting a new request.
#             Classify as FOLLOW_UP_SQL when the user:
#             i. Adds or changes filters:
#                 Examples:
#                     "only for 2025"
#                     "show Bangalore only"
#                     "for vendor Bosch"
#                     "last month"
#                     "above 100 quantity"
#             ii. Changes sorting or limits:
#                 Examples:
#                     "show top 10"
#                     "sort descending"
#                     "show lowest ones"
#                     "give next 5"
#             iii. Changes grouping or breakdown:
#                 Examples:
#                     "group by category"
#                     "split by month"
#                     "show vendor wise"
#                     "location wise"
#             iv. Requests more/less information from previous result:
#                 Examples:
#                     "show details"
#                     "include price"
#                     "add quantity"
#                     "remove date column"
#             v. Refers indirectly to previous context:
#                 Examples:
#                     "this"
#                     "that"
#                     "these"
#                     "those"
#                     "same"
#                     "above"
#                     "previous one"
#                     "what about them?"
#             vi. Chooses an assistant suggestion:
#                 Examples:
#                     "yes"
#                     "ok"
#                     "do it"
#                     "continue"
#                     "1"
#                     "2"
#                     "first option"
#             vii. Asks comparison with previous result:
#                 Examples:
#                     "compare with last year"
#                     "what about previous month?"
#                     "show difference"
#             IMPORTANT:
#                 - If removing the conversation history makes the current
#                 question incomplete, classify as FOLLOW_UP_SQL.
#                 Example:
#                     Previous:
#                         "Show total inventory by category"
#                     Current:
#                         "only electronics"
#                     Without history:
#                         Meaning is incomplete.
#                     Output:
#                         FOLLOW_UP_SQL
#                 - If the current question is fully understandable without
#                 previous conversation, classify as DB_QUERY.

#         3. CHAT
#             - Greetings, casual conversation, or general talk.
#             - Examples: "Hi", "Thanks", "How are you?"
#             - Any question that is NOT related to the database, or does not require any database context to answer.
#             - Asking to add, edit or delete data in the database

#         4. CREATE_CHART      
#             - user explicitly asks for a "chart", "graph", "plot", or "visualization" based on data.

#         5. ANALYSIS
#             - The user wants a recommendation, forecast, analyse, analysis, breifing or insight that requires
#                 comparing historical data, seasonal trends, stock levels, or expiry.
#             - Examples:
#                 - "What should I restock for monsoon?"
#                 - "What items do I need for next quarter?"
#                 - "Which products are running low?"
#                 - "What's about to expire?"
#                 - "Give me a restock plan for winter"
#                 - "Anlayse and give me the sales"
#                 - "Give a brief about the sales"
        
#         5. GUIDED
#             - Use this when the user question is vague, ambiguous, uses undefined jargon,
#             references entities/columns/tables NOT clearly part of the database domain,
#             or cannot be mapped to a concrete SQL query without guessing.
#             - Also use this when the question is partially database-related but missing critical
#             details needed to generate a meaningful query (no time period, no product name,
#             no metric specified when one is required).
#             - Use this when the question is about a topic completely outside inventory/sales
#             (weather, geography, coding, general knowledge, etc.).
#             - Examples of GUIDED questions:
#                 - "Show me everything" (too vague)
#                 - "What is the xyz value?" (unknown column/entity)
#                 - "Give me the report" (no specifics - report of what?)
#                 - "What is the current status?" (ambiguous - status of what?)
#                 - "How is the business doing?" (too open-ended without specifics)
#                 - Any question outside inventory/sales domain
#             - Do NOT use GUIDED for questions that are specific enough to attempt a SQL query,
#             even if the result might be empty.
        
#         6. MANUFACTURING
#             - User wants to manufacture, assemble, build, order, or produce projects/products.
#             - Total 3 projects that include "Meglan", "EBM 20", "EBM 40".
#             - Examples:
#                 - "Build 3 Meglan"
#                 - "order 5 EBM 40"
#                 - "Can we manufacture 10 EBM 20?"
#                 - "How many EBM 40 can we assemble?"
#                 - "Do we have enough materials for 5 Meglan?"

#         RULES:
#         - If "total sales", "how many", or "list" is asked without the word "chart/graph", use DB_QUERY.
#         - If the user mentions "chart", "graph", "plot", or "viz" with a data question, use CREATE_CHART.
#         - If asking for stock recommendations, expiring items, or trends, use ANALYSIS.
#         - If conversation is None or empty, FOLLOW_UP_* labels are NOT allowed.
#         - If the user is asking ONLY for raw data (numbers, lists, totals), that can be answered with only using SQL query
#           and no interpretation is required → DB_QUERY or FOLLOW_UP_SQL.
#         - Choose FOLLOW_UP_SQL over DB_QUERY if it depends on previous SQL.
#         - Choose CHAT only if no database context is involved.
#         - If the user expects explanation, judgement, trend, comparison, performance,
#           prediction, or recommendation → ANALYSIS
#           (even though SQL may be used internally to fetch data)
#         - If the question is too vague, uses unknown terms, or cannot be answered without
#           guessing what the user means → GUIDED.
#         - When in doubt between DB_QUERY and GUIDED, prefer GUIDED to avoid hallucination.

#         Return ONLY one of the labels exactly as written:
#         DB_QUERY
#         FOLLOW_UP_SQL
#         CHAT
#         CREATE_CHART
#         ANALYSIS
#         GUIDED
#         """

#         self.CHATNODEPROMPT = """
#         You are STAR-AI, a smart and professional database assistant
#         built by BrainBox Tardid.

#         You are provided 2 inputs
        
#         previous conversation: {conversation}
#         Current User question: {question}
        
#         Your responsibilities:
#         - You cannot have access to modify the STAR-AI database
#         - You are not allowed to do web search (Do not mention it to the user)
#         - Do not mention your thinking to the user
#         - You are allowed to answer only related to the current database, if user asks 
#           something other than the database, deny it politely
#         - If the user asks anything outside the database domain (e.g., general knowledge, 
#           coding help, personal advice, explanations unrelated to stored data), you MUST politely refuse.
#         - You cannot help user in other domains, except communicating with the database
#         - You can have a general, non domain specific, conversation with the user
#         - Reply based on the user question and the previous conversations
#         """

#         self.FOLLOWUPQUESTIONMODIFYPROMPT = """
#         You are a question rewriting assistant for a PostgreSQL database chatbot.

#         Your job:
#         Convert the current user message into ONE complete standalone database question
#         by using the previous conversation ONLY when required.

#         You are NOT a SQL generator.
#         You only rewrite the user's intent in natural language.

#         ==================================================
#         CONVERSATION HISTORY:
#         {conversation}

#         CURRENT USER MESSAGE:
#         {user_question}
#         ==================================================

#         TASK:
#             Decide whether the current message is:
#             1. A FOLLOW-UP question:
#             - It depends on previous database question/result.
#             - It modifies, filters, sorts, limits, groups, compares,
#                 or selects a previous suggestion.
#             In this case:
#                 Merge the previous database request with the new requirement.
#             2. A NEW independent question:
#             - It does not depend on previous result.
#             In this case:
#                 Return the current question unchanged.
#             ==================================================
#             FOLLOW-UP MERGING RULES:
#             When merging:
#             - Preserve ALL important details from previous context:
#                 * entity/table meaning
#                 * filters
#                 * dates/time periods
#                 * limits
#                 * sorting
#                 * grouping
#                 * selected metrics
#                 * aggregation meaning
#             - Add only the new user modification.
#             - Do NOT remove previous constraints unless the user explicitly replaces them.
#             - Do NOT invent missing information.
#             - Do NOT add columns, tables, metrics, or assumptions.
#             - Do NOT include SQL syntax.
#             - Convert references:
#                 "this"
#                 "that"
#                 "same"
#                 "above"
#                 "previous"
#                 "it"
#                 "those"
#             into the actual entity from history.
#             ==================================================
#             HANDLING USER CONFIRMATIONS:
#             If user replies:
#                 yes
#                 ok
#                 sure
#                 do it
#                 1
#                 2
#                 first option
#                 second option
#             Identify the suggestion/option from the previous assistant response
#             and merge it with the original database question.
#             ==================================================
#             EXAMPLES:
#             Example 1:
#             Previous:
#             User:
#             Show unapproved indents
#             Assistant suggestion:
#             Do you want to limit results to 10?
#             Current:
#             yes
#             Output:
#             Show unapproved indents limited to 10 records
#             --------------------------------------------------
#             Example 2:
#             Previous:
#             User:
#             Show total sales by product
#             Current:
#             only for 2025
#             Output:
#             Show total sales by product only for year 2025
#             --------------------------------------------------
#             Example 3:
#             Previous:
#             User:
#             Show vendors by total purchase value
#             Current:
#             sort alphabetically instead
#             Output:
#             Show vendors by total purchase value sorted alphabetically
#             --------------------------------------------------
#             Example 4:
#             Previous:
#             User:
#             Show inventory quantity by location
#             Current:
#             show only Bangalore
#             Output:
#             Show inventory quantity by location where location is Bangalore
#             --------------------------------------------------
#             Example 5:
#             Previous:
#             User:
#             Show top 5 products by quantity
#             Current:
#             What is today's weather?
#             Output:
#             What is today's weather?
#             ==================================================
#             OUTPUT RULES:
#             - Return ONLY the rewritten question.
#             - No explanation.
#             - No markdown.
#             - No quotes.
#             - No SQL.
#             """

#         self.SQLANALYSISPROMPT = """
#         You are STAR-AI, a smart and professional database assistant
#         built by BrainBox Tardid.

#         SQL: {last_sql}
        
#         Last question: {user_question}

#         SITUATION:
#         The user's question could not be matched to any table or column in the database.
#         This means the data they asked about does not exist in this system.

#         YOUR TASK:
#         1. Politely inform the user that the specific information they asked about
#            is not available in this database.
#         2. Based on the ACTUAL schema above, suggest 3-4 alternative questions
#            the user CAN ask that are related to their intent.
#            - The suggestions must reference real tables and columns from the schema.
#            - Phrase them as natural English questions (not SQL).
#            - Make them relevant to the user's apparent intent where possible.
#         3. Keep the tone professional and helpful.

#         STRICT RULES:
#         - Do NOT invent data, numbers, column names, or table names.
#         - Do NOT mention SQL, query internals, or "select 1 where false".
#         - Do NOT say the database has an error — just say the data is not available.
#         - Do NOT expose any technical implementation details.
#         - Only reference columns and tables that exist in the schema above.
#         """

#         self.SQLFAILEDANALYSISPROMPT = """
#         You are STAR-AI, a smart and professional database assistant
#         built by BrainBox Tardid.

#         SQL: {last_sql}
        
#         Last question: {user_question}

#         Your responsibilities:
#         - You are not allowed to do web search (Do not mention it to the user)
#         - Do not mention your thinking to the user
#         - sql query cannot be generated for this question, so reply it in a professional way and 
#           suggest the user to ask simpler questions related to the database, and also suggest 
#           some example questions that you can answer
#         """

#         self.SQLNORESULTANALYSISPROMPT = """
#         You are STAR-AI, a smart and professional database assistant
#         built by BrainBox Tardid.

#         SQL: {last_sql}

#         Last question: {user_question}

#         Current Time:  {current_time}

#         Your responsibilities:
#         - You do not have access to modify the STAR-AI database
#         - You are not allowed to do web search (Do not mention it to the user)
#         - Do not mention your thinking to the user
#         - Do not mention that you do not have access to the database
#         - If the query returns no results:
#             → First check if it is due to a future date

#             If YES:
#                 → follow FUTURE DATE HANDLING rule

#             If NO:
#                 → provide insights based on the query and suggest why the result may be empty        
#         - Do not reply in a table format
#         - Suggest 2-3 short follow up questions to the user and the questions should be in a formate like, example, do want me to......, would you like me to..., if you want, i will..... etc
#         - The followup questions should only be in a proper textual question format, do not include any sql query in that
#         - The followup questions should be in a format such that it can be answered only using a sql query itself, not like exporting data to csv or generating python code
#         - Do not give response that mentions user to check the data. Only suggest ways that you can help with.
#         - While giving the response, do not mention any sql query

#         FUTURE DATE HANDLING (HIGHEST PRIORITY):

#         - If the user's question refers to a future date or time period 
#         (beyond CURRENT_DATE):

#         → Clearly inform that future data is not available in the database
#         → Do NOT attempt to generate insights for that future period
#         → Do NOT assume or fabricate results

#         Instead:
#         - Explain briefly that the database only contains past data up to today
#         - Offer helpful follow-up questions

#         Examples:

#         User: "sales for july 2026" (when current date is april 2026)
#         → "The database contains only historical data up to today, so future data is not available."

#         - Suggest 2-3 short follow up questions to the user and the questions should be in a formate like, example, do want me to......, would you like me to..., if you want, i will..... etc
#         - The followup questions should only be in a proper textual question format, do not include any sql query in that
#         - The followup questions should be in a format such that it can be answered only using a sql query itself, not like exporting data to csv or generating python code
#         """

#         self.DASHBOARD_REPORT_PROMPT = """
#         You are a Senior Business Data Analyst for STAR AI.
#         Write a professional Executive Report based on the '{db_name}' dashboard context.
#         {dashboard_context}
#         Use Markdown styling, emojis (📊, 📈, 💡), and bullet points.
#         Make it professional and ready for leadership.
#         Current request: {user_question}
#         """

#         self.FILTER_EXTRACTION_PROMPT = """
#         SYSTEM: Output ONLY a valid JSON array. No markdown. No explanation.
#         Extract ONLY explicit data constraints or time ranges from this user request: '{user_question}'
#         Current Date for Reference: {current_date_str}
#         RULES:
#         1. Output a JSON ARRAY of filter objects with keys: "col", "op", "val"
#         2. Operators allowed: "==", "!=", ">=", "<=", "LIKE"
#         3. Translate natural time into ">=" and "<=" filters on the 'date' column.
#         4.  CRITICAL: Do NOT extract chart IDs, dashboard names, or visualization types (e.g. 'ID: 42', 'viz: None') as filters. Only extract constraints on actual database data.
#         5. If no real data filters are explicitly requested, return exactly: []
#         FORMAT: JSON array only. Nothing else.
#         """

#         self.CHART_ANALYSIS_PROMPT = """
#         You are STAR AI, an elite Business Data Analyst built by Tardid Technologies.
#         Chart name: '{chart_name}' (ID: {chart_id})
#         User question: '{question}'
#         {filter_context}
#         Raw data powering this chart:
#         Columns: {headers}
#         Data Sample (Top 10 rows): {clean_data_sample}
#         Provide a professional, highly analytical response based ONLY on this data.

#         CRITICAL INSTRUCTION: You MUST divide your response into EXACTLY these four sections using these exact markdown headers:
#         ## Executive Summary
#         ## Key Findings
#         ## Recommendations
#         ## Action Plan

#         Use Markdown formatting, bullet points, and highlight key insights.
#         """        


#     def _robust_extract_output(self, raw_str: str, table_list: list = None) -> str:
#         clean = re.sub(r'```json\s*|\s*```|`', '', raw_str).strip()
#         if table_list is not None:
#             if "NEED_VIRTUAL_DATASET" in clean:
#                 return "NEED_VIRTUAL_DATASET"
#             for t in table_list:
#                 if t.lower() in clean.lower():
#                     return t
#             return "NEED_VIRTUAL_DATASET"
#         match = re.search(r'\{.*?\}', clean, re.DOTALL)
#         if match:
#             json_text = match.group()
#             json_text = re.sub(r',\s*([\}\]])', r'\1', json_text)
#             return json_text
#         return clean

#     def _extract_sql(self, raw_str: str) -> str:
#         clean = re.sub(r'```sql\s*|\s*```|`', '', raw_str, flags=re.IGNORECASE).strip()
#         match = re.search(r'(?i)\b(SELECT|WITH)\b.*', clean, re.DOTALL)
#         if match:
#             sql = match.group(0).strip()
#             return sql.rstrip(';') + ';'
#         return clean

#     def _normalize_product_names(self, text: str) -> str:
#         if not isinstance(text, str):
#             return text

#         replacements = {
#             r"\bmeg[\s-]*lan\b": "Meglan",
#             r"\bebm[\s-]*20\b": "EBM 20",
#             r"\bebm[\s-]*40\b": "EBM 40"
#         }

#         normalized = text
#         for pattern, canonical in replacements.items():
#             normalized = re.sub(pattern, canonical, normalized, flags=re.IGNORECASE)
#         return normalized

#     def _normalize_product_name_literals(self, sql_str: str) -> str:
#         if not isinstance(sql_str, str):
#             return sql_str

#         replacements = {
#             r"(?i)(['\"])meg[\s-]*lan\1": r"\1Meglan\1",
#             r"(?i)(['\"])ebm[\s-]*20\1": r"\1EBM 20\1",
#             r"(?i)(['\"])ebm[\s-]*40\1": r"\1EBM 40\1"
#         }

#         normalized = sql_str
#         for pattern, replacement in replacements.items():
#             normalized = re.sub(pattern, replacement, normalized)
#         return normalized

#     def get_system_prompt_for_db(self, driver: str) -> str:
#         driver = driver.lower() if driver else "postgresql"
#         postgres_dialect = """
#         "1. Timestamp: Use CURRENT_TIMESTAMP or NOW() for current time.
#             Use CURRENT_DATE for todays date.
#             Use DATE_TRUNC(day, column) to truncate timestamps.
#             Use column::date to convert timestamp to date.
#             Use column + INTERVAL 1 day for date arithmetic.
#             Use EXTRACT(YEAR FROM <column_name>) and EXTRACT(MONTH FROM <column_name>) to extract parts of dates.
#             NEVER use derived column names like year, month, day directly.
#             ALWAYS compute them using EXTRACT() from a valid date or timestamp column.
#             Example: WRONG: SELECT year FROM sales.
#             CORRECT: SELECT EXTRACT(YEAR FROM order_date) AS year FROM sales.
#             If the user mentions a month, week, or date WITHOUT a year: prefer the CURRENT YEAR.
#         2. Pagination: LIMIT and OFFSET.
#         3. Case-insensitive:
#             IMPORTANT SQL RULES:

#             3.1. Never use '=' for text/string columns.

#             3.2. ALL text comparisons MUST use:
#             ILIKE '%' || value || '%'

#             3.3. This rule is mandatory for:
#             - WHERE
#             - JOIN
#             - HAVING
#             - CASE
#             - EXISTS
#             - subqueries
#             - CTEs
#             - filters
#             - search conditions

#             3.4. Text columns include:
#             employee names,
#             department names,
#             vendor names,
#             categories,
#             locations,
#             statuses,
#             descriptions,
#             product names,
#             emails,
#             identifiers stored as text.

#             3.5. Examples:

#             Incorrect:
#             assigned_employee_name = 'manjunath'

#             Correct:
#             assigned_employee_name ILIKE '%manjunath%'

#             Incorrect:
#             department = 'operations'

#             Correct:
#             department ILIKE '%operations%'

#             3.6. Only numeric/date/boolean columns may use exact operators (=, >, <, BETWEEN).

#         4. Auto-increment: SERIAL.
#         5. JSON extract: column->>'key'.
#         6. Concat: ||.",
#         """
#         dialect_rules = {
#             "postgresql": postgres_dialect,
#             "mariadb": "Use standard ANSI SQL syntax.",
#             "mysql": "Use standard ANSI SQL syntax.",
#             "sqlite": "Use standard ANSI SQL syntax.",
#             "mssql": "Use standard ANSI SQL syntax."
#         }
#         selected_rules = dialect_rules.get(driver, "Use standard ANSI SQL syntax.")
        
#         prompt = f"""
#         SYSTEM: You are an expert {driver.upper()} SQL generator.
#         Use ONLY the following schema chunks:
#         {{chunks_text}}

#         USER QUESTION: {{question}}

#         CRITICAL RULES:
#         * Write ONLY valid {driver.upper()} SQL.
#         * NO explanations. Do not speak English.
#         * DO NOT INVENT TABLE OR COLUMN NAMES. Never assume standard names like 'sales' or 'orders' exist.
#         * Use correct table and column names exactly as shown in the schema.
#         * Use double quotes for columns/tables with spaces, special characters, or capitalized names (e.g. `"Category"`).
#         * Do not return markdown fences like ```sql or `. Just return the raw SQL query.
#         * Prefer LEFT JOIN when unsure.
#         * Do not return an empty response, always return a valid SQL query
#         * When using Order by, use NULLS LAST
#         * "Total Sales": Look for real columns like 'units_sold', 'price', or 'amount' (e.g. `SUM("units_sold" * "price")`).
#         * "How many": Use `COUNT(*)`.
#         * Always use ignore nulls in every query at last.
#         * If user is mentioning anything specific like name of the product or a person or a place etc... then always consider the data as case sensitive
        

#         BUSINESS METRIC RESOLUTION RULE:

#         Do not change aggregation logic based only on words like:
#         - database
#         - db
#         - system
#         - inventory

#         These words only indicate the data source, not the metric.

#         Choose metrics using the business noun.

#         Rules:

#         Product/item count:
#         - If asking "total quantity of products/items exist":
#             use SUM(quantity)

#         - If asking "different products", "unique products",
#         "types of products", "how many products":
#             use COUNT(DISTINCT product_name)


#         Supplier/vendor ranking:
#         - Default metric:
#             SUM(quantity)

#         - Use SUM(total) only when user mentions:
#             amount
#             cost
#             spending
#             purchase value
#             money

#         Never allow words:
#             db
#             database
#             inventory

#         to change SUM/COUNT selection.

#         ==================================================
#         METRIC AND AGGREGATION RULES
#         ==================================================

#         Understand the user's requested business metric before selecting
#         an aggregation.
#         Do NOT use COUNT(*) as the default aggregation.
#         COUNT(*) means:
#             - number of database rows
#             - number of records
#             - number of transactions/events

#         Use COUNT(*) ONLY when the user explicitly asks:
#             - how many records
#             - number of entries
#             - count of transactions
#             - number of orders/events
#             - occurrences/frequency

#         For measurable numeric columns:
#             quantity/count/amount/units/stock/available:
#                 Prefer SUM(column)
#             price/cost/value/revenue/total:
#                 Prefer SUM(column) for total value questions.
#                 Prefer AVG(column) for average questions.
#             rating/score/percentage:
#                 Prefer AVG(column) unless user asks otherwise.

#         Examples:
#             User:
#             "Which entity has maximum items?"
#             Correct reasoning:
#             Find numeric measure column related to item amount.
#             Use SUM(measure_column).
#             Do NOT use COUNT(*) unless user asks number of rows.
#             User:
#             "Top customers"

#             Check available measurable columns:
#                 sales amount
#                 order value
#                 quantity
#             Rank using the relevant measure, not row count.
#         For ranking words:
#             - maximum
#             - minimum
#             - highest
#             - lowest
#             - top
#             - bottom
#             - most
#             - least
    
#         Use COUNT(*) ONLY when the user explicitly asks for number of records, entries,
#         transactions, orders, or rows — NOT when asking about physical product quantity.

#         Image URL rules:
#         If the user asks for any question related to product, and if there is an "image_url" column 
#         available in the schema chunks for that product, include that column in the 
#         SQL query to fetch the image URL along with whatever other details the user asked for.

#         UNIVERSAL JOIN RULES:
#         1. Join on PK-FK pairs shown in schema chunks.
#         2. If explicit relations shown (A.col ↔ B.col), join on those columns.
#         3. If no FK relation shown, join ONLY on same-named columns with clearly same meaning.

#         DIALECT SPECIFIC RULES ({driver.upper()}):
#         {selected_rules}

#         1. Timestamp / Date Handling
#         Use CURRENT_TIMESTAMP or NOW() for current time.
#         Use CURRENT_DATE for today's date.
#         Use DATE_TRUNC('day', column) to truncate timestamps.
#         Use column::date to convert timestamp to date.
#         Use column + INTERVAL '1 day' for date arithmetic.
#         Use EXTRACT(YEAR FROM column_name), EXTRACT(MONTH FROM column_name) to extract month, year etc.
#         NEVER use derived column names like "year", "month", "day" directly.
#         ALWAYS compute them using EXTRACT() from a valid date/timestamp column.

#         Write ONLY the raw {driver.upper()} SQL query starting with SELECT or WITH.
#         """
#         return prompt

#     def get_error_fixing_prompt(self, driver: str) -> str:
#         driver = driver.lower() if driver else "postgresql"
#         display_name = {"mariadb": "MariaDB", "postgresql": "PostgreSQL", "mysql": "MySQL", "sqlite": "SQLite", "mssql": "MS SQL Server"}.get(driver, driver.upper())
#         return f"""
#         You are an expert {display_name} SQL query corrector.
#         Inputs:
#         1. User Question: {{user_question}}
#         2. Database Schema: {{chunks_text}}
#         3. Error Message: {{error}}
#         4. Incorrect SQL Query: {{sql}}
        
#         Rules:
#             1. Timestamp / Date Handling
#                 Use CURRENT_TIMESTAMP or NOW() for current time.
#                 Use CURRENT_DATE for today's date.
#                 Use DATE_TRUNC('day', column) to truncate timestamps.
#                 Use column::date to convert timestamp to date.
#                 Use column + INTERVAL '1 day' for date arithmetic.
#                 Use EXTRACT(YEAR FROM column_name), EXTRACT(MONTH FROM column_name) to extract month, year etc
#                 Do not use year = **** or month = **
#             2. PostGIS / Spatial Error Handling
#                 If the error mentions spatial signatures (like ST_Distance matching), ensure you cast columns with ::geography.
#                 If generating a point, always ensure the SRID is set: ST_SetSRID(ST_Point(lon, lat), 4326).
#                 Remember ST_Point takes longitude first, latitude second.
                
#         Task:
#         - Correct the query so that it runs successfully on the given {display_name} schema.
#         - Make sure the query accurately answers the user question.
#         - Output ONLY the raw SQL query. NO markdown fences. NO text. Start directly with SELECT.
#         """

#     def _get_history_string(self) -> str:
#         history_texts = []
#         for msg in self.last_conversation_history:
#             if hasattr(msg, 'content'):
#                 history_texts.append(msg.content)
#             else:
#                 history_texts.append(str(msg))
#         return "\n\n".join(history_texts)

#     # ============================================
#     # ASYNC HELPER: LLM Call with Rate Limit Handling
#     # ============================================
#     async def _call_llm_with_retry(self, prompt: str, attempt=1, max_attempts=3, stream_to_ui: bool = False) -> str:
#         # Old local imports preserved as comments for reference:
#         # import re
#         # from datetime import datetime, timedelta
#         print(f"prompt here : {prompt}") 
#         try:
#             if stream_to_ui and self.stream_callback and hasattr(self.llm, "astream_text"):
#                 parts = []
#                 async for part in self.llm.astream_text(prompt):
#                     parts.append(part)
#                     try:
#                         self.stream_callback(part)
#                     except Exception:
#                         pass
#                 response = "".join(parts)
#             else:
#                 if asyncio.iscoroutinefunction(self.llm.invoke):
#                     response = await self.llm.invoke(prompt)
#                 else:
#                     loop = asyncio.get_event_loop()
#                     response = await loop.run_in_executor(None, self.llm.invoke, prompt)
            
#             await self.api_key_service.update_api_key_status(
#                 api_key=self.active_api_key,
#                 param={"last_used_at": datetime.now()} 
#             )
            
#             if isinstance(response, str):
#                 return response
#             return response.content.strip()

#         except Exception as e:
#             error_str = str(e).lower()
            
#             # 🛑 Handle Rate Limit & 413 Payload Errors
#             if (
#                 "request too large" in error_str
#                 or "requested" in error_str and "tokens per minute" in error_str
#                 or "request_too_large" in error_str
#                 or "request entity too large" in error_str
#                 or "413" in error_str
#                 or "rate limit" in error_str 
#                 or "429" in error_str 
#                 or "please try again in" in error_str
#             ) and attempt < max_attempts:
#                 print(f"⚠️ Payload/Rate limit hit on attempt {attempt}. Attempting API key switch and prompt shrink...")
                
#                 smaller_prompt = prompt[: max(1000, int(len(prompt) * 0.5))]
                
#                 new_api_key, msg = await self.api_key_service.get_retry_api_key_logic(
#                     api_key=self.active_api_key, error_detail=str(e)
#                 )

#                 if not new_api_key or attempt >= max_attempts:
#                     wait_seconds = 60 
#                     match = re.search(r"try again in ([\d\.]+)s", error_str)
#                     if match:
#                         wait_seconds = float(match.group(1))
                    
#                     next_available = (datetime.now() + timedelta(seconds=wait_seconds)).strftime("%H:%M:%S")
                    
#                     return (f"⚠️ **API Request Limited.**\n\n"
#                             f"The data request was too large or all keys are limited. "
#                             f"The system will be available again at **{next_available}**.")

#                 self.active_api_key = new_api_key
#                 self.llm = GroqLLM(api_key=new_api_key)
#                 return await self._call_llm_with_retry(
#                     smaller_prompt, attempt=attempt + 1, max_attempts=max_attempts, stream_to_ui=stream_to_ui
#                 )
#             else:
#                 raise

#     def _clean_relations(self, chunks_text: str) -> str:
#         tables = set(re.findall(r"TABLE:\s*(\w+)", chunks_text, re.IGNORECASE))
#         cleaned_blocks = []
#         current_block = []
#         in_relations = False
#         seen_relations = set()
#         for line in chunks_text.split("\n"):
#             line_strip = line.strip()
#             if line_strip.startswith("TABLE:"):
#                 if current_block:
#                     cleaned_blocks.append("\n".join(current_block))
#                 current_block = [line]
#                 in_relations = False
#                 continue
#             if line_strip.startswith("RELATIONS:"):
#                 current_block.append(line)
#                 in_relations = True
#                 continue
#             if in_relations and ("->" in line or "↔" in line):
#                 matches = re.findall(r"(\w+)\.(\w+)", line)
#                 if len(matches) >= 2:
#                     (left_table, left_col), (right_table, right_col) = matches[0], matches[1]
#                     if left_table in tables and right_table in tables:
#                         relation_key = tuple(sorted([
#                             f"{left_table}.{left_col}",
#                             f"{right_table}.{right_col}"
#                         ]))
#                         if relation_key not in seen_relations:
#                             seen_relations.add(relation_key)
#                             current_block.append(line)
#                 continue
#             current_block.append(line)
#         if current_block:
#             cleaned_blocks.append("\n".join(current_block))
#         return "\n\n".join(cleaned_blocks)
    
#     def _embedding_search(self, query: str, vectorstore: FAISS, k: int) -> dict:
#         results = {}
#         for doc, distance in vectorstore.similarity_search_with_score(query, k=k):
#             similarity = 1 / (1 + distance)
#             key = (doc.metadata["table"], doc.metadata["column"], doc.metadata["value"])
#             results[key] = {"score": similarity, "source": "embedding", "doc": doc}
#         return results
    
#     def _fuzzy_search(self, query: str, docs: List[Document]) -> dict:
#         results = {}
#         q = query.lower()
#         for doc in docs:
#             score = max(
#                 fuzz.partial_ratio(q, doc.metadata["value"].lower()),
#                 fuzz.partial_ratio(q, doc.metadata["column"].lower()),
#                 fuzz.partial_ratio(q, doc.metadata["table"].lower()),
#             )
#             if score >= 70:
#                 key = (doc.metadata["table"], doc.metadata["column"], doc.metadata["value"])
#                 results[key] = {"score": score / 100, "source": "fuzzy", "doc": doc}
#         return results
    
#     async def hybrid_value_search(self, query: str, value_vectorstore: FAISS, value_docs: List[Document], k: int = 8) -> list:
#         embedding_results, fuzzy_results = await asyncio.gather(
#             asyncio.to_thread(self._embedding_search, query, value_vectorstore, k),
#             asyncio.to_thread(self._fuzzy_search, query, value_docs),
#         )

#         final: dict = dict(embedding_results)
#         for key, val in fuzzy_results.items():
#             if key in final:
#                 final[key]["score"]  += val["score"]
#                 final[key]["source"] += "+fuzzy"
#             else:
#                 final[key] = val

#         return sorted(final.values(), key=lambda x: x["score"], reverse=True)[:k]

#     async def _hybrid_retrieve(self, question: str) -> str:

#         if self.vectorstore is None:
#             return "Error: Vectorstore is not initialized."

#         sem_docs = self.vectorstore.as_retriever(search_kwargs={"k": 10}).invoke(question)
#         candidates = {d.metadata.get("table", "unknown"): d for d in sem_docs}.values()

#         q = question.lower()
#         scored = []
        
#         keyword_map = {
#             "gps_tracking": ["current location", "where will", "closer than", "minimum approach", "coordinate", "history", "tracking"],
#             "navigation": ["speed", "heading", "pitch", "roll", "predict", "trajectory", "instability", "unstable", "struggling"],
#             "engine": ["thruster", "efficiency", "engine", "engine_effort", "effort"],
#             "waypoints": ["waypoint", "route", "path", "status", "docking", "mission"],
#             "dark_vessel_alerts": ["dark vessel", "danger", "alert", "threat", "historical dark vessel"],
#             "ais_data": ["ship", "ships", "vessel", "intercept"],
#             "india_west_places": ["city", "town", "village", "island", "density", "zone"],
#             "india_west_transport": ["airport", "railway", "ferry", "station", "port", "buffer", "approach", "infrastructure"],
#             "india_west_natural": ["beach", "reef", "coast", "sanctuary", "rocky", "shallows", "restricted"]
#         }

#         for doc in candidates:
#             table = doc.metadata.get("table", "").lower()
#             content = doc.page_content.lower()

#             score = 0
#             column_hits = 0
#             columns = [col.strip() for col in content.split(",") if col.strip()]

#             for col in columns:
#                 ratio = fuzz.partial_ratio(col, q)
#                 if ratio > 85:
#                     score += 3
#                     column_hits += 1
#                 elif ratio > 70:
#                     score += 2
#                     column_hits += 1

#             table_ratio = fuzz.partial_ratio(table, q)
#             if table_ratio > 85: score += 3
#             elif table_ratio > 70: score += 2

#             if column_hits > 0 and table_ratio > 70: score += 2

#             scored.append((score, doc))

#         scored.sort(reverse=True, key=lambda x: x[0])
#         if not scored: return ""
#         top_score = scored[0][0]

#         final_docs = [doc for score, doc in scored if score >= max(2, top_score * 0.5)]

#         if not final_docs:
#             final_docs = [doc for _, doc in scored[:2]]

#         chunks_text = "\n".join(d.page_content for d in final_docs)
#         chunks_text = self._clean_relations(chunks_text)

#         value_hits = await self.hybrid_value_search(question, self.value_vectorstore, self.value_docs, k=8)
#         if value_hits:
#             value_lines = [
#                 f"  {hit['doc'].metadata['table']}.{hit['doc'].metadata['column']}"
#                 f" = '{hit['doc'].metadata['value']}'"
#                 for hit in value_hits
#             ]
#             value_block = "Sample data from columns:\n" + "\n".join(value_lines)
#             chunks_text = chunks_text + "\n\n" + value_block
#         # ▲▲▲  END NEW SECTION
#         # ══════════════════════════════════════════════════════════════════════

#         # print("inside hybrid retreive\n\n", chunks_text,"inside hybrid retreive")
#         return chunks_text

#     async def _verify_query(self, sql: str, state: dict, target_db_url: str = None):
#         session_id = state.get("session_id")
#         message_id = state.get("message_id")
#         user_id = state.get("user_id")
#         db_url = target_db_url or state.get("target_db_url")
#         self.results = []
#         error_msg = None
#         csv_path_str = None
#         try:
#             if db_url:
#                 rows = await self.db_repo.generate_sql_query_result(sql)
#                 self.results = rows
#             else:
#                 error_msg = "No target database URL found. Please star a database."
#         except Exception as e:
#             print(f"❌ Error in _verify_query: {e}")
#             self.results = []
#             error_msg = str(e)

#         return "successfully" if not error_msg else f"Error: {error_msg}"

#     # ══════════════════════════════════════════════════════════════════════════
#     #  LANGGRAPH NODES
#     # ══════════════════════════════════════════════════════════════════════════
#     async def _classify_intent(self, state: AgentStateScehma) -> dict:
#         question = state["user_question"]
#         # active_db = state.get("active_dashboard", "None")

#         conversation = self._get_history_string()
#         chunks = await self._hybrid_retrieve(question)
#         prompt = self.CONVERSATIONPROMPT.format(
            
#             conversation=conversation,
#             question=question,
#             chunks=chunks
#         )
#         intent = await self._call_llm_with_retry(prompt)
        
#         intent = self._robust_extract_output(intent)
#         print("\n\n", intent, "\n\n")
#         for valid_intent in [
#             "ACCESS_DASHBOARD", "GENERATE_REPORT", "FETCH_CHART", "DB_QUERY",
#             "FOLLOW_UP_SQL", "CHAT",  "CREATE_CHART",
#             "ANALYSIS", "ANALYTICS", "MANUFACTURING", "GUIDED","ANALYZE_CHART"
#         ]:
        
#             if valid_intent in intent.upper():
#                 intent = valid_intent
#                 break
#         print(intent, "INTENT AFTER CLEANING")
#         return {
#             "intent": intent,
#             "user_question": (
#                 state["messages"][-1].content
#                 if hasattr(state["messages"][-1], 'content')
#                 else str(state["messages"][-1])
#             )
#         }

#     # def _route_intent(self, state: AgentStateScehma) -> str:
#     #     q_raw = str(state.get("user_question", "")).lower().strip()
#     #     q = q_raw.strip('"\'') 
#     #     intent = str(state.get("intent", "")).upper()
        
#     #     # # 🚀 ADVANCED ROUTING FIX: Catch anomalies, predictions, and routing
#     #     # sql_keywords = [
#     #     #     "distance", "disttnace", "dist", "check", "generate a route", 
#     #     #     "predict", "instability", "safe bypass", "where will", "anomaly",
#     #     #     "dark vessel", "fences", "restricted area", "buffer", "engine effort"
#     #     # ]
#     #     # coord_pattern = r'(\d+\.?\d*)\s*,\s*(\d+\.?\d*)'
        
#     #     # if len(re.findall(coord_pattern, q)) >= 2 or any(word in q for word in sql_keywords):
#     #     #     return "schema"

#     #     # 🏭 MANUFACTURING intent routing
#     #     if "MANUFACTURING" in intent or any(kw in q for kw in ["manufacture", "assemble", "build", "ebm", "meglan"]):
#     #         return "manufacturing"

#     #     # 🧭 GUIDED intent routing
#     #     if "GUIDED" in intent:
#     #         return "guided"
            
#     #     # if "dashboard" in q or "ACCESS_DASHBOARD" in intent:
#     #     #     return "access_dashboard"
            
#     #     if q.startswith("chart[") or "viz:" in q or q.startswith("- metric:"):
#     #         clean_name = re.sub(r'(?i)^chart\[\d+\]:\s*', '', state["user_question"])
#     #         clean_name = re.sub(r'(?i)- metric:\s*', '', clean_name)
#     #         clean_name = re.sub(r'(?i)\s*\(id:.*', '', clean_name)
#     #         clean_name = re.sub(r'(?i)\s*\(viz:.*', '', clean_name)
#     #         state["user_question"] = clean_name.strip()
#     #         return "fetch_chart"

#     #     if "REPORT" in intent or "2" in intent:  return "report_gen"
        
#     #     if "CREATE" in intent or "8" in intent or any(kw in q for kw in ["chart", "graph", "plot", "viz"]):  
#     #         return "create_chart"

#     #     words = q.split()
#     #     if "QUERY" in intent or "4" in intent or any(w in words for w in ["count", "list", "show", "retrieve", "get"]):  
#     #         return "schema"

#     #     if "FETCH"  in intent or "3" in intent:  return "fetch_chart"
#     #     if "FOLLOW" in intent or "5" in intent:  return "followup"
        
#     #     return "chat"


#     def _route_intent(self, state: AgentStateScehma) -> str:
#         q_raw = self._normalize_product_names(str(state.get("user_question", "")))
#         q = q_raw.lower().strip().strip('"\'')
#         intent = str(state.get("intent", "")).upper()
        
#         # 🚀 MARITIME ROUTING — DISABLED
#         # sql_keywords = [
#         #     "distance", "disttnace", "dist", "check", "generate a route", 
#         #     "predict", "instability", "safe bypass", "where will", "anomaly",
#         #     "dark vessel", "fences", "restricted area", "buffer", "engine effort"
#         # ]
#         # coord_pattern = r'(\d+\.?\d*)\s*,\s*(\d+\.?\d*)'
#         # if len(re.findall(coord_pattern, q)) >= 2 or any(word in q for word in sql_keywords):
#         #     return "schema"

#         # 🏭 MANUFACTURING intent routing
#         manufacturing_verbs = [
#             "manufacture", "manufacturing", "build", "assemble",
#             "produce", "make", "create"
#         ]
#         manufacturing_products = [
#             "meglan", "meg lan", "meg-lan",
#             "ebm 20", "ebm20", "ebm-20",
#             "ebm 40", "ebm40", "ebm-40"
#         ]
#         has_manufacturing_action = any(verb in q for verb in manufacturing_verbs)
#         order_pattern = r'\border\b.*\b(meglan|ebm[\s-]*20|ebm[\s-]*40)\b'
#         has_order_action = bool(re.search(order_pattern, q))
#         has_product_reference = any(prod in q for prod in manufacturing_products)

#         if "MANUFACTURING" in intent or ((has_manufacturing_action or has_order_action) and has_product_reference):
#             return "manufacturing"

#         # 🧭 GUIDED intent routing
#         if "GUIDED" in intent:
#             return "guided"
            
#         # DASHBOARD ROUTING — DISABLED
#         # if "dashboard" in q or "ACCESS_DASHBOARD" in intent:
#         #     return "access_dashboard"
            
#         if q.startswith("chart[") or "viz:" in q or q.startswith("- metric:"):
#             clean_name = re.sub(r'(?i)^chart\[\d+\]:\s*', '', state["user_question"])
#             clean_name = re.sub(r'(?i)- metric:\s*', '', clean_name)
#             clean_name = re.sub(r'(?i)\s*\(id:.*', '', clean_name)
#             clean_name = re.sub(r'(?i)\s*\(viz:.*', '', clean_name)
#             state["user_question"] = clean_name.strip()
#             return "fetch_chart"

#         # if "REPORT" in intent or "2" in intent: return "report_gen"
        
#         if "CREATE" in intent or "8" in intent or any(kw in q for kw in ["chart", "graph", "plot", "viz"]):  
#             return "create_chart"

#         words = q.split()
#         if "ANALYSIS" in intent or "ANALYTICS" in intent or any(kw in q for kw in ["restock", "season", "quarter", "expire", "expiring", "trend"]):
#             return "analysis_plan"
        
#         if "DB_QUERY" in intent or "4" in intent or any(w in words for w in ["count", "list", "show", "retrieve", "get"]):  
#             return "schema"

#         # if "FETCH"  in intent or "3" in intent: return "fetch_chart"
#         if "FOLLOW" in intent or "5" in intent: return "followup"
#         # if "ANALYZE" in intent or "7" in intent: return "analyze_chart"
        
#         return "chat"

  
#     async def _manufacturing_node(self, state: AgentStateScehma):
    
#         BOM_REQUIREMENTS = {
#         "Meglan": {
#             "Sensors": 2,
#             "Computing": 1,
#             "Propulsion": 1,
#             "Hull": 5,
#             "Fasteners": 2,
#             "Cabling": 3,
#             "Communication": 1
#         },
    
#         "EBM 20": {
#             "Motor": 1,
#             "Battery": 4,
#             "Controller": 1,
#             "Harness": 1,
#             "Cooling": 1
#         },
    
#         "EBM 40": {
#             "Motor": 1,
#             "Battery": 1,
#             "Controller": 1,
#             "Cooling": 1,
#             "Propulsion": 1
#         }
#         }
    
#         question = state["user_question"]
    
#         prompt = f"""
#         Extract manufacturing request.
    
#         Extract project name (as per the name given below) and quantity
#         If the user mentions single meglan, double ebm, a meglan...... return the numbers
#         single -> 1
#         double -> 2
#         a -> 1
#         an -> 1
    
#         USER QUESTION:
#         {question}
    
#         Available projects:
#         - Meglan (a boat)
#         - EBM 20 (a motor)
#         - EBM 40 (a motor)
    
#         Return ONLY JSON:
    
#         {{
#             "project": "<product_name>",
#             "quantity": 0
#         }}
    
#         If the project is not in the available list (ignoring case), return
#         {{
#             "project": "UNKNOWN",
#             "message": "the requested project(or item or product) "<product_name>" is not available, the only available projects are Meglan, EBM 20, and EBM 40"
#         }}
    
#         if quantity is not specified (not even in wordings like "one", "two", "a", "an", "single"), return
#         {{
#             "project": "<product_name>",
#             "quantity": "null"
#         }}
    
#         IMPORTANT: If the user requests MULTIPLE projects, return a JSON array of objects instead:
#         [
#             {{"project": "<product_name_1>", "quantity": <qty_1>}},
#             {{"project": "<product_name_2>", "quantity": <qty_2>}}
#         ]
#         Each object in the array follows the same rules above (UNKNOWN project, null quantity, etc.)
#         """
    
#         raw = await self._call_llm_with_retry(prompt)
    
#         raw = re.sub(r'^```json\s*', '', raw)
#         raw = re.sub(r'^```\s*', '', raw)
#         raw = re.sub(r'\n?```$', '', raw).strip()
    
#         data = json.loads(raw)
    
#         print("\n\n", raw, "\n")
    
#         # ── NEW: normalise to a list so single & multi follow the same path ──
#         if isinstance(data, dict):
#             items = [data]
#         else:
#             items = data          # already a list for multi-project requests
    
#         all_responses = []
#         flag = False
    
#         for data in items:
#             # try:
#             print("111111111111111111111")
#             # ── existing UNKNOWN-project handling ──────────────────────────────
#             if data["project"].lower() == "unknown":
#                 all_responses.append(data["message"])
#                 continue
    
#             project = data["project"]
#             qty     = data["quantity"]
    
#             if project not in BOM_REQUIREMENTS:
#                 all_responses.append(f"Unknown project: {project}")
#                 continue
    
#             bom = BOM_REQUIREMENTS[project]
    
#             results   = []
#             shortages = []
#             remaining = []
    
#             # ── existing qty == 'null' branch ──────────────────────────────────
#             print(f"\n\n before if qty null, qty: {qty} \n")
#             if qty == 'null' or qty == 0:
#                 possible_units = []
#                 print("\n\n inside if qty null")
#                 for category, required in bom.items():
    
#                     sql = f"""
#                     SELECT COALESCE(SUM(quantity),0)
#                     FROM procurement_table
#                     WHERE part_name ILIKE '%{category}%' AND assigned_to IS NULL
#                     """
    
#                     # available = db.run(sql)
#                     available = await self.db_repo.fetch_scalar(sql)

    
#                     match = re.findall(r'\d+', str(available))
#                     available = int(match[0]) if match else 0
#                     print("\n\n available", available, "required", required, "\n")
#                     possible_units.append(
#                         available // required
#                     )
    
#                 max_units = min(possible_units)
    
#                 if max_units == 0:
#                     response = f"You cannot manufacture any {project}. Insufficient materials:\n"
#                     for category, required in bom.items():
#                         sql = f"""
#                         SELECT COALESCE(SUM(quantity),0)
#                         FROM procurement_table
#                         WHERE part_name ILIKE '%{category}%'
#                         AND assigned_to IS NULL
#                         """
#                         # available = db.run(sql)
#                         available_match = re.findall(r'\d+', str(available))
#                         available = int(available_match[0]) if available_match else 0
#                         if available < required:  # ── NEW: only show insufficient ones
#                             response += f"- {category}: required {required}, available {available}\n"
#                     all_responses.append(response)
#                 else:
#                     all_responses.append(
#                         f"You can manufacture {max_units} {project} successfully"
#                     )
#                     print("\n\n max_units", max_units, "\n")
#                 print(f"items {items} and data is {data}")
#                 continue
    
#             # ── existing qty-specified branch ──────────────────────────────────
#             qty = int(qty)
#             for category, required_per_unit in bom.items():
    
#                 needed = required_per_unit * qty
    
#                 sql = f'''
#                 SELECT COALESCE(SUM(quantity),0)
#                 FROM procurement_table
#                 WHERE part_name ILIKE '%{category}%' and assigned_to IS NULL
#                 '''
    
#                 available = await self.db_repo.fetch_scalar(sql)
    
#                 match_avail = re.findall(r'\d+', str(available))
#                 available = int(match_avail[0]) if match_avail else 0
    
#                 balance = available - needed
    
#                 results.append({
#                     "category": category,
#                     "needed":   needed,
#                     "available": available,
#                     "balance":   balance
#                 })
    
#                 if balance < 0:
#                     shortages.append(f"{category}: need {abs(balance)} more")
#                 else:
#                     remaining.append(f"{category}: {balance} remaining")
#                 print(f"inside the for loop here {results}")
    
#             # ── existing Final response block ──────────────────────────────────
#             flag = False
#             print("checking the flag here",flag)
#             if shortages:
#                 print(f"if shortages")
#                 flag = True
#                 response = f"Manufacturing requirement check for {qty} {project}\nSome materials are insufficient."
#                 for r in results:
#                     response += (
#                         f"\n- {r['category']} "
#                         f"(purchase: {r['needed']}, "
#                         f"Available: {r['available']})"
#                     )
#                 response += "\n\nShortages:\n"
    
#                 for s in shortages:
#                     response += f"- {s}\n"
    
#             else:
#                 print(f"else shortages")
#                 if qty == 0:
#                     print(f"elif shortages")
#                     response = f"You cannot manufacture any {project}. Insufficient materials:\n"
#                     for r in results:
#                         print(f"elif for shortages")
#                         if r['available'] < bom[r['category']]:  # ── NEW: only show insufficient ones
#                             response += f"- {r['category']}: required {bom[r['category']]}, available {r['available']}\n"
#                 else:
#                     print(f"else else shortages")
#                     response = f"You can manufacture {qty} {project} successfully.\nRemaining inventory after manufacturing:"
#                     for r in results:
#                         response += (
#                             f"\n- {r['category']}: "
#                             f"{r['balance']} remaining"
#                         )
    
#             all_responses.append(response)

#             # except Exception as e:
#             #     print(f"Outside for loop",e)

        
#         final_response = "\n\n---\n\n".join(all_responses)
        
#         data = {
#             "flag": flag,
#             "status": "REPORT"
#         }
#         print(data, "final data here")
#         print(final_response, "all responses here")
        
        
#         return {
#             "messages": [AIMessage(content=final_response)],
#             "flag": flag,
#             "status": "REPORT"
#         }
#         # except Exception as e:
#         #     print(f"Exception here is {e}")
    
 

#     # ── GUIDED ────────────────────────────────────────────────────────────────
#     async def _guided_node(self, state: AgentStateScehma) -> dict:
#         """
#         Handle vague or out-of-domain questions by guiding the user toward
#         valid, database-answerable questions — without hallucinating any results.
#         Uses the actual schema chunks to derive real, working example questions.
#         """
        

#         conversation = self._get_history_string()
#         chunks = await self._hybrid_retrieve(state["user_question"])

#         prompt = f"""
#         You are STAR-AI, a professional database assistant.

#         DATABASE SCHEMA:
#         {chunks}

#         PREVIOUS CONVERSATION:
#         {conversation}

#         USER QUESTION:
#         {state["user_question"]}

#         YOUR JOB:
#         The user's question is vague, incomplete, ambiguous, or uses words that do not clearly map to the database schema.
#         Do NOT guess. Do NOT fabricate any tables, columns, values, or business facts.

#         Your task is to guide the user toward a clear database question by doing the following:

#         1) Briefly acknowledge that the question is unclear.
#         2) Infer the user's likely intent from the wording of their question.
#         3) Give 4–5 example questions that are directly related to that intent and can be answered from the schema.
#         4) Make the examples sound like natural clarifying options, starting with phrases like:
#         - Do you mean...
#         - Would you like me to...
#         - Are you asking to...
#         - Should I show...
#         5) End by asking the user to pick one or rephrase their question.

#         VERY IMPORTANT RULES:
#         - Use ONLY real table names and real column names from the schema.
#         - Do NOT invent values such as names, departments, vendors, dates, products, categories, or locations.
#         - If you need a placeholder, use neutral wording like:
#         "specific table", "particular vendor", "given date range", "certain department", "a selected record".
#         - Keep the examples tightly related to the user's wording.
#         - If the user asks something broad like "what is this database?", prefer broad but useful clarifications such as:
#         "Do you mean: list all tables in this database?"
#         "Do you mean: show the columns in a specific table?"
#         "Do you mean: give me a summary of what each table stores?"
#         "Do you mean: show the first few records from the main table?"
#         - Do NOT mention SQL, prompts, internal logic, or technical implementation.
#         - Keep the tone polite, short, and helpful.

#         OUTPUT FORMAT:
#         A short opening sentence, then a line exactly:
#         Here are some things you can ask me:
#         Then 4–5 bullet points of example questions, then one closing sentence asking the user to rephrase or pick one.
#         """

#         response = await self._call_llm_with_retry(prompt)
#         return {
#             "messages": [AIMessage(content=response)],
#             "status": "REPORT"
#         }

#     # ── ACCESS DASHBOARD ───────────────────────────────────────────────────────
#     async def _access_dashboard_node(self, state: AgentStateScehma) -> dict:
#         q = state["user_question"] 
#         db_master_name = self.db_display_name
#         base_host = self.superset_service.host if self.superset_service else "starai.local:8088"
#         dashboard_name = "System"
#         target_id = "1"
        
#         if self.superset_service:
#             loop = asyncio.get_running_loop()
#             matched_db = await loop.run_in_executor(
#                 None, self.superset_service.find_best_dashboard_match, db_master_name
#             )
            
#             if matched_db:
#                 dashboard_name = matched_db["title"]
                
#                 if dashboard_name.strip().lower() != db_master_name.strip().lower():
#                     msg = f"⚠️ Dashboard linking failed: The connected database display name '{db_master_name}' must exactly match the Superset dashboard name."
#                     return {"messages": [AIMessage(content=msg)], "status": "ERROR"}

#                 target_id = str(matched_db.get("id"))
#                 url = f"http://{base_host}/superset/dashboard/{target_id}/?standalone=2"
                
#                 try:
#                     chart_summary = await loop.run_in_executor(
#                         None, self.superset_service.get_dashboard_summary, dashboard_name
#                     )
#                     chart_info = f"\n\n**Detected Charts & Metrics:**\n{chart_summary}"
#                 except Exception:
#                     chart_info = ""
                    
#                 msg = (
#                     f"✅ **{dashboard_name} Dashboard Linked.**\n"
#                     f"I have synchronized the data stream for your primary database '{db_master_name}'.{chart_info}\n\n"
#                     f"You can now generate reports or request specific graphs."
#                 )
#                 return {
#                     "messages": [AIMessage(content=msg)],
#                     "status": "DASHBOARD_LOADED",
#                     "active_dashboard": dashboard_name,
#                     "dashboard_url": url,
#                     "session_cookie": self.superset_service.get_session_cookie()
#                 }
#             else:
#                 msg = f"⚠️ I could not find a matching dashboard in Superset for your database '{db_master_name}'."
#                 return {"messages": [AIMessage(content=msg)], "status": "ERROR"}

#         return {"messages": [AIMessage(content="Superset service not connected.")], "status": "ERROR"}

#     # ── REPORT GEN ─────────────────────────────────────────────────────────────
#     async def _report_gen_node(self, state: AgentStateScehma) -> dict:
#         q = state["user_question"].lower()
#         db_name = state.get("active_dashboard")
        
#         if not db_name and self.superset_service:
#             loop = asyncio.get_running_loop()
#             matched_db = await loop.run_in_executor(None, self.superset_service.find_best_dashboard_match, q)
#             if matched_db: db_name = matched_db["title"]
            
#         if not db_name:
#             db_name = "System"
            
#         dashboard_context = ""
#         base_host = self.superset_service.host if self.superset_service else "starai.local:8088"
#         url = f"http://{base_host}/superset/dashboard/{db_name.lower()}/"
#         if "standalone=2" not in url:
#             url += ("?" if "?" not in url else "&") + "standalone=2"
            
#         if self.superset_service:
#             try:
#                 loop = asyncio.get_running_loop()
#                 chart_data = await loop.run_in_executor(
#                     None, self.superset_service.get_dashboard_summary, db_name
#                 )
#                 dashboard_context = f"\nLive Superset Data Context:\n{chart_data}"
#                 id_match = re.search(r"\(ID:\s*(\d+)\)", chart_data)
#                 if id_match:
#                     dash_id = id_match.group(1)
#                     url = f"http://{base_host}/superset/dashboard/{dash_id}/"
#                     if "standalone=2" not in url:
#                         url += ("?" if "?" not in url else "&") + "standalone=2"
#             except Exception as e:
#                 pass
#         report_prompt = self.DASHBOARD_REPORT_PROMPT.format(
#             db_name=db_name,
#             dashboard_context=dashboard_context,
#             user_question=state['user_question']
#         )
#         res = await self._call_llm_with_retry(report_prompt)
#         return {
#             "status": "REPORT",
#             "messages": [AIMessage(content=res)],
#             "dashboard_url": url,
#             "session_cookie": self.superset_service.get_session_cookie()
#         }

#     # ── FETCH CHART ────────────────────────────────────────────────────────────
#     async def _fetch_chart_node(self, state: AgentStateScehma) -> dict:
#         q = state["user_question"].lower()
#         db_name = state.get("active_dashboard")
#         if not db_name:
#             for msg in reversed(self.last_conversation_history):
#                 content = msg.content if hasattr(msg, 'content') else str(msg)
#                 match = re.search(r"✅ \*\*(.*?)\s+Dashboard Linked", content, re.IGNORECASE)
#                 if match:
#                     db_name = match.group(1).strip()
#                     break
                    
#         if not db_name and self.superset_service:
#             loop = asyncio.get_running_loop()
#             matched_db = await loop.run_in_executor(None, self.superset_service.find_best_dashboard_match, q)
#             if matched_db: db_name = matched_db["title"]

#         if not db_name:
#             msg = "⚠️ Please access a dashboard first (e.g., 'Access Meglan')."
#             return {"messages": [AIMessage(content=msg)], "status": "ERROR"}
            
#         if self.superset_service:
#             try:
#                 current_date_str = datetime.now().strftime('%Y-%m-%d')
#                 filter_prompt = self.FILTER_EXTRACTION_PROMPT.format(
#                     user_question=state['user_question'],
#                     current_date_str=current_date_str
#                 )
#                 filter_res = await self._call_llm_with_retry(filter_prompt)
#                 extra_filters = []
#                 try:
#                     clean_res = re.sub(r'```json\s*|\s*```|`', '', filter_res).strip()
#                     arr_match = re.search(r'\[.*?\]', clean_res, re.DOTALL)
#                     if arr_match:
#                         raw_filters = json.loads(arr_match.group())
#                         for f in raw_filters:
#                             clean_key = f.get("col", "").lower().strip().replace(" ", "_")
#                             op = f.get("op", "==")
#                             val = str(f.get("val", ""))
#                             extra_filters.append({"col": clean_key, "op": op, "val": val})
#                 except Exception as e:
#                     print(f"⚠️ Filter extraction failed: {e}")
#                 loop = asyncio.get_running_loop()
#                 chart_details = await loop.run_in_executor(
#                     None, self.superset_service.get_chart_details, db_name,
#                     state["user_question"], extra_filters
#                 )
#                 if "error" in chart_details:
#                     return {
#                         "messages": [AIMessage(content=f"⚠️ {chart_details['error']}")],
#                         "status": "ERROR"
#                     }
#                 print(f"🎯 Fetching Live Embed AND Native Raw Data for '{chart_details['name']}'...")
#                 raw_data = await loop.run_in_executor(
#                     None, self.superset_service.get_chart_raw_data,
#                     chart_details["id"], extra_filters
#                 )
#                 filter_msg = " (Filtered by AI)" if extra_filters else ""
#                 if raw_data:
#                     msg = f"✅ Extracted live view & raw data for **{chart_details['name']}**{filter_msg}."
#                 else:
#                     msg = (
#                         f"✅ Loading live metric: **{chart_details['name']}**{filter_msg}...\n"
#                         f"*(No raw data rows matched your filters)*"
#                     )
#                     print("⚠️ Raw data extraction yielded no rows, falling back to Live View only.")
#                 filter_str = json.dumps(extra_filters) if extra_filters else "[]"
#                 msg += f"\n*(Chart ID: {chart_details.get('id')} | Filters: {filter_str})*"
#                 c_url = chart_details.get("url")
#                 if "standalone=2" not in c_url:
#                     c_url += ("?" if "?" not in c_url else "&") + "standalone=2"
#                 return {
#                     "messages": [AIMessage(content=msg)],
#                     "status": "CHART_LOADED",
#                     "id": chart_details.get("id"),
#                     "chart_url": c_url,
#                     "download_url": chart_details.get("download_url"),
#                     "result": raw_data if raw_data else [],
#                     "chart_name": chart_details["name"],
#                     "session_cookie": chart_details.get("session_cookie"),
#                     "active_chart_id": chart_details.get("id"),
#                     "active_chart_name": chart_details["name"]
#                 }
#             except Exception as e:
#                 print(f"⚠️ Superset Node Error: {e}")
#                 return {"messages": [AIMessage(content=f"Error: {e}")], "status": "ERROR"}
#         return {
#             "messages": [AIMessage(content="Superset service not connected.")],
#             "status": "ERROR"
#         }

#     # ── CREATE CHART ──────────────────────────────────────────────────────────
#     async def _create_chart_node(self, state: AgentStateScehma) -> dict:
#         # Old local imports preserved as comments for reference:
#         # import decimal
#         # import json
#         # import os
#         # import asyncio
#         # import pandas as pd
#         # import numpy as np
#         # import plotly.graph_objects as go
#         # import plotly.io as pio
#         # from datetime import datetime, date
#         # import uuid
#         # from langchain_core.messages import AIMessage
#         q = state["user_question"]
#         loop = asyncio.get_running_loop()

#         if not self.target_db_url:
#             return {"messages": [AIMessage(content="⚠️ No database connected.")], "status": "ERROR"}

#         schema_path = state.get("schema_path")
#         chunks_text = state.get("chunks_text", "")
        
#         if not chunks_text and schema_path and os.path.exists(schema_path):
#             with open(schema_path, "r", encoding="utf-8") as f: 
#                 chunks_text = f.read()

#         try:
#             sql_prompt = self.get_system_prompt_for_db(self.db_drive).format(
#                 chunks_text=chunks_text, question=q
#             )
#         except AttributeError:
#             sql_prompt = f"SYSTEM: You are a SQL Expert. Output ONLY raw SQL for: '{q}'. Schema:\n{chunks_text}"

#         raw_sql = await self._call_llm_with_retry(sql_prompt)
#         sql_query = self._extract_sql(raw_sql)

#         if not sql_query.lower().strip().startswith(("select", "with")):
#             return {"messages": [AIMessage(content="⚠️ Failed to generate a valid SQL query.")], "status": "ERROR"}

#         chart_data = []
#         try:
#             rows = await self.db_repo.generate_sql_query_result(sql=sql_query)
#             keys = list(rows[0].keys()) if rows else []

#             for row in rows:
#                 new_row = {}
#                 for key_name, val in row.items():
#                     if isinstance(val, decimal.Decimal):
#                         new_row[key_name] = float(val)
#                     elif isinstance(val, (datetime, date)):
#                         new_row[key_name] = val.isoformat()
#                     elif isinstance(val, uuid.UUID):
#                         new_row[key_name] = str(val)
#                     else: new_row[key_name] = val
#                 chart_data.append(new_row)
            
#         except Exception as e:
#             return {"messages": [AIMessage(content=f"⚠️ SQL execution error: {e}\n\nHint: Check if column names like 'Category' need capitalization.")], "status": "ERROR"}

#         if not chart_data:
#             return {"messages": [AIMessage(content="⚠️ No data returned for the chart.")], "status": "ERROR"}

#         df = pd.DataFrame(chart_data)
#         df.columns = [str(c).strip() for c in df.columns]
#         columns = list(df.columns)
        
#         for col in columns:
#             try:
#                 converted = pd.to_numeric(df[col], errors='coerce')
#                 if converted.notna().any(): 
#                     df[col] = converted
#             except Exception: 
#                 pass
                
#         numeric_cols = df.select_dtypes(include='number').columns.tolist()
#         data_sample = df.head(3).to_dict(orient="records")

#         config_prompt = f"""
# SYSTEM: You are a Data Visualization Configuration Expert.
# USER QUESTION: '{q}'
# AVAILABLE COLUMNS: {columns}
# NUMERIC COLUMNS: {numeric_cols}
# DATA SAMPLE: {data_sample}

# TASK: Generate a valid JSON configuration.
# RULES:
# 1. "chart_type": "line", "bar", "pie", or "scatter". 
# 2. "x_col": primary category (must EXACTLY MATCH one of {columns}, preserving case).
# 3. "y_cols": LIST of numeric columns to plot (must EXACTLY MATCH from {numeric_cols}).
# 4. "color_col": categorical column to group/color the data by (optional, empty string if none).
# 5. "sort": "desc", "asc", or "none".
# 6. "limit": integer for Top N (e.g., 10), or 0 for all.
# 7. "title": Short descriptive title.

# Output ONLY valid JSON. No markdown tags.
# """
#         raw_config = await self._call_llm_with_retry(config_prompt)
#         config_str = self._robust_extract_output(raw_config)

#         try: 
#             config = json.loads(config_str)
#         except Exception: 
#             config = {}

#         chart_type = config.get("chart_type", "line").lower()
#         x_col_raw = str(config.get("x_col", columns[0])).strip()
#         y_cols_raw = config.get("y_cols", [numeric_cols[0]] if numeric_cols else [columns[-1]])
#         color_col_raw = str(config.get("color_col", "")).strip()
#         sort_order = config.get("sort", "none").lower()
#         limit = int(config.get("limit", 0))
#         title = config.get("title", f"Chart Analysis")

#         def correct_case(col_name, valid_cols):
#             for c in valid_cols:
#                 if c.lower() == col_name.lower(): return c
#             return col_name

#         x_col = correct_case(x_col_raw, columns)
#         y_cols = [correct_case(y, columns) for y in y_cols_raw]
#         color_col = correct_case(color_col_raw, columns) if color_col_raw else ""

#         x_data_clean = []
#         if x_col in df.columns:
#             for val in df[x_col].tolist():
#                 try:
#                     if isinstance(val, (int, float)) and val > 10000000000:
#                         x_data_clean.append(pd.to_datetime(val, unit='ms').strftime('%Y-%m-%d %H:%M:%S'))
#                     elif isinstance(val, (int, float)) and val > 100000000:
#                         x_data_clean.append(pd.to_datetime(val, unit='s').strftime('%Y-%m-%d %H:%M:%S'))
#                     elif pd.notna(val):
#                         x_data_clean.append(str(val))
#                     else:
#                         x_data_clean.append(None)
#                 except Exception:
#                     x_data_clean.append(str(val))
            
#             df['clean_x'] = x_data_clean

#             if any(t in x_col.lower() for t in ['time', 'date', 'created', 'timestamp']):
#                 df['temp_time'] = pd.to_datetime(df['clean_x'], errors='coerce')
#                 df = df.dropna(subset=['temp_time']).sort_values(by='temp_time', ascending=True).drop(columns=['temp_time'])
#                 sort_order = "none" 
#         else:
#             df['clean_x'] = [str(i) for i in range(len(df))]
            
#         if sort_order == "desc" and y_cols and y_cols[0] in df.columns: 
#             df = df.sort_values(by=y_cols[0], ascending=False)
#         elif sort_order == "asc" and y_cols and y_cols[0] in df.columns:
#             df = df.sort_values(by=y_cols[0], ascending=True)

#         if limit > 0: df = df.head(limit)

#         if df.empty:
#             return {"messages": [AIMessage(content="⚠️ Chart generation failed: All data was filtered out or invalid.")], "status": "ERROR"}
        
#         df = df.replace([np.inf, -np.inf], np.nan).where(pd.notnull(df), None)

#         def sanitize_for_json(v):
#             if v is None or (isinstance(v, float) and np.isnan(v)): return None
#             if isinstance(v, (np.integer, int)): return int(v)
#             if isinstance(v, (np.floating, float)): return float(v)
#             if isinstance(v, (datetime, date)): return v.isoformat()
#             if hasattr(v, '__str__'):
#                 try: return float(v) if '.' in str(v) else int(v)
#                 except: return str(v)
#             return str(v)

#         theme_colors = ['#00D1FF', '#7C4DFF', '#0099BB', '#2A8080', '#00E5FF', '#FF007F', '#FFD700']
#         layout_args = dict(
#             paper_bgcolor='#161E1E', plot_bgcolor='#161E1E', font_color='#E0E0E0',
#             margin=dict(l=60, r=40, t=70, b=80),
#             legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
#             title=dict(text=title, font=dict(size=18), x=0.5, xanchor='center')
#         )

#         try:
#             fig = go.Figure()
#             valid_y_cols = [c for c in y_cols if c in df.columns and c in numeric_cols]
#             if not valid_y_cols and numeric_cols: valid_y_cols = [numeric_cols[0]]
            
#             if color_col and color_col in df.columns and valid_y_cols:
#                 groups = df[color_col].dropna().unique()
#                 for i, group_val in enumerate(groups):
#                     color = theme_colors[i % len(theme_colors)]
#                     group_df = df[df[color_col] == group_val]
                    
#                     x_clean = [sanitize_for_json(x) for x in group_df['clean_x'].tolist()]
#                     y_clean = []
#                     for yv in group_df[valid_y_cols[0]].tolist():
#                         sv = sanitize_for_json(yv)
#                         y_clean.append(float(sv) if sv is not None else 0.0)
                    
#                     mode = 'markers' if chart_type == 'scatter' else 'lines'
                    
#                     if chart_type in ['scatter', 'line']:
#                         fig.add_trace(go.Scatter(
#                             x=x_clean, y=y_clean, name=str(group_val), mode=mode,
#                             marker=dict(color=color, size=8), line=dict(color=color, width=2.5),
#                             hovertemplate=f'%{{x}}<br>{valid_y_cols[0]}: %{{y}}<extra></extra>'
#                         ))
#                     elif chart_type == 'bar':
#                         fig.add_trace(go.Bar(x=x_clean, y=y_clean, name=str(group_val), marker_color=color))
#             else:
#                 x_clean = [sanitize_for_json(x) for x in df['clean_x'].tolist()]
#                 for i, col in enumerate(valid_y_cols):
#                     color = theme_colors[i % len(theme_colors)]
#                     y_clean = []
#                     for yv in df[col].tolist():
#                         sv = sanitize_for_json(yv)
#                         y_clean.append(float(sv) if sv is not None else 0.0)
                    
#                     if chart_type == "line":
#                         fig.add_trace(go.Scatter(x=x_clean, y=y_clean, name=str(col), mode='lines', line=dict(color=color, width=2.5), hovertemplate=f'%{{x}}<br>{col}: %{{y}}<extra></extra>'))
#                     elif chart_type == "scatter":
#                         fig.add_trace(go.Scatter(x=x_clean, y=y_clean, name=str(col), mode='markers', marker=dict(color=color, size=8), hovertemplate=f'%{{x}}<br>{col}: %{{y}}<extra></extra>'))
#                     elif chart_type == "bar":
#                         fig.add_trace(go.Bar(x=x_clean, y=y_clean, name=str(col), marker_color=color))
#                     elif chart_type == "pie":
#                         fig.add_trace(go.Pie(labels=x_clean, values=y_clean, hole=0.4, marker=dict(colors=theme_colors)))
#                         break

#             fig.update_layout(
#                 xaxis=dict(
#                     showgrid=True, gridcolor='#1F2E2E', automargin=True, tickangle=-45,
#                     type='date' if any(t in x_col.lower() for t in ['time', 'date', 'created']) else 'category'
#                 ),
#                 yaxis=dict(showgrid=True, gridcolor='#1F2E2E', automargin=True),
#                 **layout_args
#             )

#             chart_json = pio.to_json(fig)
#         except Exception as e:
#             return {"messages": [AIMessage(content=f"⚠️ Plotly render error: {e}")], "status": "ERROR"}

#         insight_prompt = f"Provide 2 concise bullet point insights for {title} using this data: {data_sample}. Handle spelling mistakes from original request if any."
#         insights = await self._call_llm_with_retry(insight_prompt)

#         return {
#             "messages": [AIMessage(content=f"✨ **{title}**\n\n**Insights:**\n{insights}")],
#             "status": "CHART_LOADED", "chart_json": chart_json, "result": chart_data, 
#             "chart_name": title, "sql_query": sql_query
#         }

#     # ── CHAT ───────────────────────────────────────────────────────────────────
#     async def _chat_node(self, state: AgentStateScehma) -> dict:
#         conversation = self._get_history_string()
#         prompt = self.CHATNODEPROMPT.format(
#             conversation=conversation,
#             question=state["user_question"]
#         )
#         response = await self._call_llm_with_retry(prompt, stream_to_ui=True)
#         return {"messages": [AIMessage(content=response)]}

#     # ── SCHEMA ─────────────────────────────────────────────────────────────────
#     async def _schema_node(self, state: AgentStateScehma) -> dict:
#         hybrid_chunks = await self._hybrid_retrieve(state["user_question"])
#         print(hybrid_chunks,"HYYYYYYYYYYYYYYYYY")

#         schema_path = state.get("schema_path")
#         file_content = ""
#         if schema_path and os.path.exists(schema_path):
#             with open(schema_path, "r", encoding="utf-8") as f:
#                 file_content = f.read()

#         critical_tables = [
#             "waypoints", "gps_tracking", "ais_data",
#             "india_west_places", "india_west_transport", "india_west_natural",
#             "chat_message", "chat_session"
#         ]
#         forced_context = ""
#         for table in critical_tables:
#             if table not in hybrid_chunks and table in file_content:
#                 pattern = rf"(CREATE TABLE {table}.*?;)"
#                 match = re.search(pattern, file_content, re.DOTALL | re.IGNORECASE)
#                 if match:
#                     forced_context += f"\n[CRITICAL TABLE DEFINITION]:\n{match.group(1)}\n"

#         semantic_dictionary = """
# ### DATABASE SEMANTICS & RELATIONSHIPS (CRITICAL CONTEXT) ###
# - **chat_message**: Stores all user questions and AI responses for the dynamic chat system. Use this for counting messages, finding history, or chat analysis.
# - **chat_session**: Groups chat messages into distinct sessions.
# - **meglan_boat_info**: Represents YOUR own boat. Primary key `id` maps to `boat_id` in telemetry tables.
# - **waypoints**: Represents a specific trip or mission metadata. `status = 'Docking'` means the boat is parked. Links to telemetry via `waypoint_id`.
# - **gps_tracking**: LIVE and historical location (Lat/Lon) of YOUR boat.
# - **navigation**: Live physical movement of YOUR boat. Contains `speed`, `heading`, `pitch` (vertical tilt / instability), `roll` (horizontal tilt / instability).
# - **engine**: Contains `thruster_position` which represents 'engine effort' or 'engine load'.
# - **environment**: Contains local `wind_speed` and `wind_direction`.
# - **ais_data**: Represents OTHER nearby ships/vessels. Use this for 'intercept' or 'nearest ship'. Contains their `mmsi`.
# - **dark_vessel_alerts**: Hostile/Alert tracking. Join with `ais_data` on `mmsi` to get their physical location.
# - **detections**: Camera/radar object detection (bounding boxes, object_type).
# - **india_west_natural / india_south_natural**: Spatial polygons for natural zones (beaches, coast, reefs, restricted sanctuary).
# - **india_west_places / india_south_places**: Spatial polygons for high-density areas (cities, towns).
# - **india_west_transport / india_south_transport**: Spatial polygons for infrastructure (ports, docks, railway stations).
# - **procurement_table**: Inventory of procurement items. `item_category` maps to BOM categories. `assigned_to IS NULL` means unallocated/available stock.
#         """

#         chunks = f"### RELEVANT TABLES ###\n{hybrid_chunks}\n{forced_context}\n\n{semantic_dictionary}"
        
#         return {
#             "chunks_text": chunks,
#             "messages": [AIMessage(content="Retrieved schema with forced context injection.")]
#         }

#     # ── SQL GEN ────────────────────────────────────────────────────────────────
#     async def _sql_gen_node(self, state: AgentStateScehma) -> dict:
#         @tool("generate_sql", description="generates postgresql query based on the question and schema chunks", args_schema=GenerateSQLSchema)
#         async def generate_sql_tool(question: str, chunks_text: str) -> str:
#             safe_chunks = chunks_text[:self._max_schema_chars]
#             dialect_instructions = self.get_system_prompt_for_db(self.db_drive)
#             prompt = dialect_instructions.format(chunks_text=safe_chunks, question=question)
#             return await self._call_llm_with_retry(prompt)

#         normalized_question = self._normalize_product_names(state["user_question"])
#         raw_sql = await generate_sql_tool.ainvoke({
#             "question": normalized_question,
#             "chunks_text": state.get("chunks_text", "")
#         })

#         sql_query = self._extract_sql(raw_sql)
#         sql_query = self._normalize_product_name_literals(sql_query)
#         sql_query = re.sub(r'^```sql\s*\n?', '', sql_query, flags=re.IGNORECASE)
#         sql_query = re.sub(r'\n?```$', '', sql_query).strip()
        
#         if "SELECT" in sql_query.upper() or "WITH" in sql_query.upper():
#             match = re.search(r'(?i)(SELECT|WITH).*', sql_query, re.DOTALL)
#             if match:
#                 sql_query = match.group(0).strip()
                
#         if "gps_tracking" in sql_query.lower() and "order by" not in sql_query.lower():
#             sql_query = sql_query.rstrip(';') + " ORDER BY created_at DESC LIMIT 1;"
                
#         chunks_text = state.get("chunks_text", "")
#         db_tables = list(set([t.lower() for t in re.findall(r"TABLE:\s*([a-zA-Z0-9_]+)", chunks_text, re.IGNORECASE) + re.findall(r"CREATE TABLE\s+([a-zA-Z0-9_]+)", chunks_text, re.IGNORECASE)]))
        
#         if db_tables:
#             default_table = db_tables[0]
#             for t in db_tables:
#                 if t in state["user_question"].lower():
#                     default_table = t
#                     break
            
#             bad_tables = ['sales', 'orders', 'transactions', 'customer_transactions', 'transaction_history', 'data']
#             for bad in bad_tables:
#                 sql_query = re.sub(rf'(?i)\bFROM\s+["\']?{bad}["\']?\b', f'FROM "{default_table}"', sql_query)
#                 sql_query = re.sub(rf'(?i)\bJOIN\s+["\']?{bad}["\']?\b', f'JOIN "{default_table}"', sql_query)

#         if not sql_query.lower().startswith("select") and not sql_query.lower().startswith("with"):
#             q_lower = state["user_question"].lower()
#             default_table = db_tables[0] if db_tables else "users"
#             if "count" in q_lower:
#                 sql_query = f'SELECT COUNT(*) FROM "{default_table}";'
#             elif "list" in q_lower or "show" in q_lower or "get" in q_lower:
#                 sql_query = f'SELECT * FROM "{default_table}" LIMIT 15;'
#             else:
#                 sql_query = f'SELECT * FROM "{default_table}" LIMIT 5;'

#         return {
#             "sql_query": sql_query,
#             "messages": [AIMessage(content="Generated SQL")]
#         }

#     def _verify_sql_safety(self, sql_str: str) -> bool:
#         pattern = r'\b(' + '|'.join(self.dangerous_commands) + r')\b'
#         return not re.search(pattern, sql_str.lower())

#     async def _fix_sql_error(
#         self, user_question: str, sql_str: str, error: str, chunks_text: str
#     ) -> str:
#         @tool("fix_sql_error", description="Fixes SQL error from database", args_schema=FixSQLSchema)
#         async def fix_sql_error_tool(user_question: str, sql: str, error: str, chunks_text: str) -> str:
#             prompt = self.get_error_fixing_prompt(self.db_drive).format(
#                 user_question=user_question, chunks_text=chunks_text, error=error, sql=sql
#             )
#             raw = await self._call_llm_with_retry(prompt)
#             return raw

#         raw_sql = await fix_sql_error_tool.ainvoke({
#             "user_question": user_question, "sql": sql_str, "error": error, "chunks_text": chunks_text
#         })
        
#         fixed_sql = self._extract_sql(raw_sql)
#         fixed_sql = self._normalize_product_name_literals(fixed_sql)
#         fixed_sql = re.sub(r'^```sql\s*\n?', '', fixed_sql, flags=re.IGNORECASE)
#         fixed_sql = re.sub(r'\n?```$', '', fixed_sql).strip()
        
#         db_tables = list(set([t.lower() for t in re.findall(r"TABLE:\s*([a-zA-Z0-9_]+)", chunks_text, re.IGNORECASE) + re.findall(r"CREATE TABLE\s+([a-zA-Z0-9_]+)", chunks_text, re.IGNORECASE)]))
#         if db_tables:
#             default_table = db_tables[0]
#             for t in db_tables:
#                 if t in user_question.lower():
#                     default_table = t
#                     break
#             bad_tables = ['sales', 'orders', 'transactions', 'customer_transactions', 'transaction_history', 'data']
#             for bad in bad_tables:
#                 fixed_sql = re.sub(rf'(?i)\bFROM\s+["\']?{bad}["\']?\b', f'FROM "{default_table}"', fixed_sql)
#                 fixed_sql = re.sub(rf'(?i)\bJOIN\s+["\']?{bad}["\']?\b', f'JOIN "{default_table}"', fixed_sql)

#         return fixed_sql

#     # ── VERIFY ─────────────────────────────────────────────────────────────────
#     async def _verify_node(self, state: AgentStateScehma) -> dict:
#         sql_str    = state.get("sql_query", "")
#         chunks_text = state.get("chunks_text", "")
#         question   = state.get("user_question", "")
#         target_db_url = state.get("target_db_url")
#         user_id    = state.get("user_id")
#         session_id = state.get("session_id")
#         message_id = state.get("message_id")
        
#         if "⚠️ API Rate Limit Exhausted" in sql_str:
#             return {
#                 "user_id": user_id, "session_id": session_id,
#                 "message_id": message_id, "target_db_url": target_db_url,
#                 "sql_query": sql_str, "query_id": None, "result": [],
#                 "messages": [AIMessage(content=sql_str)]
#             }
            
#         for attempt in range(4):
#             if not self._verify_sql_safety(sql_str):
#                 return {
#                     "user_id": user_id, "session_id": session_id,
#                     "message_id": message_id, "target_db_url": target_db_url,
#                     "sql_query": sql_str, "query_id": None, "result": [],
#                     "messages": [AIMessage(content="⚠️ Query contains dangerous operations")]
#                 }
#             result_status = await self._verify_query(
#                 sql_str, state, target_db_url=target_db_url
#             )
#             current_query_id = getattr(self, 'last_query_id', None)
            
#             if "successfully" in result_status.lower() or "valid" in result_status.lower():
#                 return {
#                     "user_id": user_id, "session_id": session_id,
#                     "message_id": message_id, "target_db_url": target_db_url,
#                     "last_sql": sql_str, "sql_query": sql_str,
#                     "query_id": current_query_id,
#                     "result": self.results if self.results else [],
#                     "status": "DATA_LOADED" if self.results else "NO_RESULTS", 
#                     "messages": [AIMessage(content="SQL verified successfully")]
#                 }
#             if attempt < 3:
#                 sql_str = await self._fix_sql_error(
#                     question, sql_str, result_status, chunks_text[:self._max_schema_chars]
#                 )
#                 if "⚠️ API Rate Limit Exhausted" in sql_str:
#                     return {
#                         "user_id": user_id, "session_id": session_id,
#                         "message_id": message_id, "target_db_url": target_db_url,
#                         "sql_query": sql_str, "query_id": current_query_id,
#                         "result": [], "messages": [AIMessage(content=sql_str)]
#                     }
#                 self.results = []
#             else:
#                 return {
#                     "user_id": user_id, "session_id": session_id,
#                     "message_id": message_id, "target_db_url": target_db_url,
#                     "sql_query": sql_str, "query_id": current_query_id,
#                     "last_sql": "select 2 where false;", "result": [],
#                     "status": "ERROR", 
#                     "messages": [AIMessage(
#                         content=f"❌ SQL failed after 4 attempts. Last error: {result_status}"
#                     )]
#                 }
                
#         return {
#             "user_id": user_id, "session_id": session_id,
#             "message_id": message_id, "target_db_url": target_db_url,
#             "sql_query": sql_str,
#             "result": self.results if self.results else [],
#             "query_id": getattr(self, 'last_query_id', None),
#             "messages": [AIMessage(content="Verification process completed.")]
#         }

#     # ── FOLLOW-UP QUESTION MERGE ───────────────────────────────────────────────
#     async def _followup_question_modify(self, state: AgentStateScehma) -> dict:
#         intent = state["intent"]
#         prompt = self.FOLLOWUPQUESTIONMODIFYPROMPT.format(
#             conversation=self._get_history_string(),
#             user_question=state["user_question"]
#         )
#         merged_question = await self._call_llm_with_retry(prompt)
#         return {"user_question": merged_question}

#     # ── ANSWER ─────────────────────────────────────────────────────────────────
#     async def _answer_node(self, state: AgentStateScehma) -> dict:
#         last_sql        = state.get("last_sql", "")
#         sql_query_text = state.get("sql_query", "")
#         results         = state.get("result", [])
#         row_count      = len(results)
#         if isinstance(sql_query_text, str) and "⚠️ API Rate Limit Exhausted" in sql_query_text:
#             return {"messages": [AIMessage(content=sql_query_text)]}
            
#         if not last_sql or "select 1 where false" in last_sql.lower():
#             prompt = self.SQLANALYSISPROMPT.format(
#                 user_question=state["user_question"],
#                 last_sql=last_sql
#             )
#         elif "select 2 where false" in last_sql.lower():
#             prompt = self.SQLFAILEDANALYSISPROMPT.format(
#                 user_question=state["user_question"],
#                 last_sql=last_sql
#             )
#         elif row_count == 0:
#             prompt = self.SQLNORESULTANALYSISPROMPT.format(
#                 current_time = datetime.now(),
#                 user_question=state["user_question"],
#                 last_sql=last_sql
#             )
#         else:
#             prompt = f"""
#             You are STAR-AI, a smart and professional database assistant
#             built by BrainBox Tardid.
        
#             SQL: {last_sql}

#             Last question: {state["user_question"]}

#             Your responsibilities:
#             - You do not have access to modify the STAR-AI database
#             - You are not allowed to do web search (Do not mention it to the user)
#             - Do not mention your thinking to the user
#             - Do not mention that you do not have access to the database
#             - only return the followup questions and insights about the query, 
#             no need to explain anything about the results or running query in the database
#             - Suggest 2-3 short follow up questions to the user and the questions should be in a formate 
#             like, example, do want me to......, would you like me to..., if you want, i will..... etc
#             - The followup questions should only be in a proper textual question format, 
#             do not include any sql query in that
#             - The followup questions should be in a format such that it can be answered only using a 
#             sql query itself, not like exporting data to csv or generating python code
#             """

#         suggestions = await self._call_llm_with_retry(prompt, stream_to_ui=True)
        
#         status = "DATA_LOADED" if len(state.get("result", [])) > 0 else "NO_RESULTS"
        
#         return {
#             "messages": [AIMessage(content=suggestions)],
#             "status": status
#         }
    
#     # ── NEW ANALYSIS NODES ────────────────────────────────────────────────────
#     async def _analysis_plan_node(self, state: AgentStateScehma) -> dict:
#         chunks = await self._hybrid_retrieve(state["user_question"])
#         planning_prompt = f"""
#         You are a senior database analyst responsible for breaking a user's question into
#         the MINIMUM number of precise, self-contained sub-questions that can each be answered
#         by a single SQL query fetching RAW HISTORICAL DATA ONLY.

#         ────────────────────────────
#         DATABASE SCHEMA:
#         {chunks}

#         USER QUESTION:
#         {state["user_question"]}

#         CURRENT DATE AND TIME:
#         {datetime.now()}
#         ────────────────────────────

#         ════════════════════════════════════════════════════
#         STEP 0 — OUT-OF-CONTEXT CHECK (HIGHEST PRIORITY)
#         ════════════════════════════════════════════════════

#         Before anything else: is the user's question answerable using the schema above?

#         NOTE: Questions about forecasts, recommendations, trends, or analysis that can be
#         answered using PAST DATA from the schema are NOT out-of-context.

#         If the question is completely unrelated to the schema domain
#         (e.g., schema is retail but user asks about weather, countries, students):

#         → Return EXACTLY this JSON and in reasoning, mention why it is out of context:
#         {{
#         "intent_summary": "OUT_OF_CONTEXT",
#         "time_context": null,
#         "data_needed": [],
#         "sub_questions": [],
#         "reasoning": "<reason>"
#         }}

#         Only continue to the rules below if the question IS relevant to the schema.

#         ════════════════════════════════════════════════════
#         STEP 1 — CLASSIFY THE REQUEST TYPE
#         ════════════════════════════════════════════════════

#         Determine which type applies:

#         TYPE A — PURE PAST ANALYSIS:
#         User asks only about a specific past period with no future intent.
#         Keywords: "last month", "in March 2025", "on 2025-01-10", "yesterday", "last quarter"

#         TYPE B — FORECAST / RECOMMENDATION (future intent using past data):
#         User wants a prediction, estimate, recommendation, or restock plan.
#         Keywords: "forecast", "predict", "next month", "should I restock", "recommend",
#                     "estimate", "project", "trend", "based on [period]", "for [future date]"

#         ════════════════════════════════════════════════════
#         STEP 2 — DETERMINE THE EXACT HISTORICAL WINDOW TO QUERY
#         ════════════════════════════════════════════════════

#         ────────────────────────────
#         RULE A: USER EXPLICITLY SPECIFIES A TIME WINDOW (HIGHEST PRIORITY — NEVER OVERRIDE)
#         ────────────────────────────
#         If the user mentions a specific date, date range, or window explicitly,
#         YOU MUST USE ONLY THAT WINDOW. Do not expand, replace, or supplement it.

#         Examples of explicit windows:
#         "based on April 1" → use only April 1, 2026 data
#         "based on last 3 months" → use only the last 3 months (Jan–Mar 2026 if current is Apr 2026)
#         "based on March 2026" → use only March 2026
#         "compare with 2023" → use only 2023 data
#         "last 6 weeks" → use only the last 6 weeks

#         CRITICAL: "based on April 1" does NOT mean "use April in previous years".
#         It means: use data FROM April 1, 2026 ONLY.

#         ────────────────────────────
#         RULE B: NO EXPLICIT WINDOW — SHORT-TERM FORECAST (days / weeks / months)
#         ────────────────────────────
#         Apply ONLY when the user does NOT specify a time window AND the forecast horizon is
#         days, weeks, or 1–3 months ahead.

#         → Fetch the LAST 3 SAME TIME PERIODS before the current date.

#         Examples:
#         "next month sales" (no anchor given) → fetch last 3 calendar months
#         "next week" (no anchor) → fetch last 3 weeks
#         "next 7 days" (no anchor) → fetch last 3 similar 7-day windows

#         DO NOT use yearly comparisons for short-term forecasts.

#         ────────────────────────────
#         RULE C: NO EXPLICIT WINDOW — LONG-TERM / SEASONAL FORECAST (quarters / seasons / years)
#         ────────────────────────────
#         Apply ONLY when the user does NOT specify a window AND the forecast is for a named
#         season, quarter, or a specific month far ahead (e.g., December when current month is April).

#         → Fetch the SAME NAMED PERIOD from previous years.

#         Examples:
#         "forecast for monsoon" → fetch monsoon data from previous years
#         "forecast for December 2026" (no anchor) → fetch December data from previous years
#         "next Q3" → fetch Q3 data from previous years

#         ════════════════════════════════════════════════════
#         STEP 3 — BUILD SUB-QUESTIONS (STRICT RULES)
#         ════════════════════════════════════════════════════

#         ────────────────────────────
#         ABSOLUTE RULE — RAW DATA ONLY (NEVER VIOLATE THIS)
#         ────────────────────────────
#         Sub-questions MUST ONLY ask for RAW HISTORICAL DATA.

#         NEVER write a sub-question that:
#         ✗ asks for forecasts, projections, or predictions
#         ✗ asks for averages "to project" future values
#         ✗ references future dates in any way
#         ✗ depends on the result of another sub-question
#         ✗ asks "based on the above, what is the forecast for..."

#         Sub-questions are ONLY data-fetching questions.
#         All forecasting, trend analysis, and insight generation happens LATER (not here).

#         CORRECT sub-question examples:
#         ✔ "What is the total sales for January 2026?"
#         ✔ "What is the total sales for February 2026?"
#         ✔ "What is the total sales for March 2026?"
#         ✔ "What are the top 10 items by sales quantity in March 2026?"

#         WRONG sub-question examples:
#         ✗ "Based on the monthly averages, what is the forecasted sales for December 2026?"
#         ✗ "What is the projected profit for next month based on the last 3 months average?"
#         ✗ "Estimate December 2026 sales using the trend from last quarter."

#         ────────────────────────────
#         INDEPENDENCE RULE
#         ────────────────────────────
#         Each sub-question must be 100% self-contained.
#         It must NOT reference "the above data", "that period", "those results", or any
#         other sub-question. A person should be able to read each sub-question in isolation
#         and know exactly what to query.

#         ────────────────────────────
#         COMPLETENESS RULE
#         ────────────────────────────
#         Each sub-question must explicitly state:
#         - The exact metric(s) needed (sales, profit, quantity, etc.)
#         - The exact time period (with full dates, not vague references)
#         - The exact entity (product, category, etc.) if mentioned by the user

#         ────────────────────────────
#         FUTURE DATE PROHIBITION
#         ────────────────────────────
#         Sub-questions MUST NEVER reference future dates.
#         The database contains only historical data up to CURRENT_DATE.
#         All sub-question date ranges must be ≤ CURRENT_DATE.

#         ────────────────────────────
#         QUANTITY RULE
#         ────────────────────────────
#         - Minimum: 2 sub-questions
#         - Maximum: 5 sub-questions
#         - Preferred: 2–3 well-focused sub-questions
#         - No redundant sub-questions (each must add unique value)

#         ════════════════════════════════════════════════════
#         STEP 4 — WORKED EXAMPLES (READ CAREFULLY)
#         ════════════════════════════════════════════════════

#         EXAMPLE 1:
#         User: "next month sales, based on April 1"
#         Current date: April 22, 2026

#         Analysis:
#         - User specified anchor: "April 1" → Rule A applies → use ONLY April 1, 2026
#         - Do NOT expand to April 2023/2024/2025
#         - Sub-questions fetch April 1, 2026 data only

#         Correct sub-questions:
#         [1] "What is the total sales on April 1, 2026?"
#         [2] "What are the top selling items by quantity on April 1, 2026?"

#         Wrong sub-questions:
#         ✗ "What was the total sales for April 1, 2023?"
#         ✗ "What was the total sales for April 1, 2024?"
#         ✗ "What was the total sales for April 1, 2025?"

#         ────────────────────────────

#         EXAMPLE 2:
#         User: "based on the last 3 months sales, forecast for December 2026"
#         Current date: April 22, 2026

#         Analysis:
#         - User specified window: "last 3 months" → Rule A applies → use Jan 2026, Feb 2026, Mar 2026
#         - Forecast target: December 2026 (future) — this is handled by insight node, NOT sub-questions
#         - Sub-questions fetch raw monthly data for Jan/Feb/Mar 2026 only

#         Correct sub-questions:
#         [1] "What is the total sales, total quantity, and total profit for January 2026?"
#         [2] "What is the total sales, total quantity, and total profit for February 2026?"
#         [3] "What is the total sales, total quantity, and total profit for March 2026?"

#         Wrong sub-questions:
#         ✗ "What is the monthly average sales for Jan–Mar 2026 to project December?"
#         ✗ "Based on Jan–Mar averages, what is the forecasted sales for December 2026?"

#         ────────────────────────────

#         EXAMPLE 3:
#         User: "forecast sales for next month" (no anchor specified)
#         Current date: April 22, 2026

#         Analysis:
#         - No explicit anchor → Rule B applies → fetch last 3 months: Jan, Feb, Mar 2026
#         - Next month = May 2026 → handled by insight node

#         Correct sub-questions:
#         [1] "What is the total sales for January 2026?"
#         [2] "What is the total sales for February 2026?"
#         [3] "What is the total sales for March 2026?"

#         ────────────────────────────

#         EXAMPLE 4:
#         User: "forecast for December 2026" (no anchor specified)
#         Current date: April 22, 2026

#         Analysis:
#         - No explicit anchor → Rule C applies (December is a named month far ahead)
#         - Fetch December data from previous years

#         Correct sub-questions:
#         [1] "What is the total sales for December 2023?"
#         [2] "What is the total sales for December 2024?"
#         [3] "What is the total sales for December 2025?"

#         ════════════════════════════════════════════════════
#         STEP 5 — INTERNAL REASONING (DO NOT OUTPUT THIS)
#         ════════════════════════════════════════════════════

#         Before writing the JSON, silently answer:
#         1. Did the user explicitly mention a date, date range, or window? (yes/no)
#         → If yes: which exact window? → use ONLY that (Rule A)
#         → If no: is the forecast short-term or long-term? → apply Rule B or Rule C
#         2. What is the forecast target? (future — handled by insight node, never in sub-questions)
#         3. Does each sub-question ask only for raw historical data? (if no → rewrite it)
#         4. Does any sub-question reference future dates? (if yes → remove it)
#         5. Does any sub-question depend on another? (if yes → rewrite to make independent)
#         6. Does each sub-question fully spell out the time period and metrics? (if no → add them)

#         ════════════════════════════════════════════════════
#         OUTPUT FORMAT — STRICT JSON ONLY, NO EXTRA TEXT
#         ════════════════════════════════════════════════════

#         {{
#         "intent_summary": "...",
#         "time_context": "...",
#         "data_needed": ["..."],
#         "sub_questions": [
#             "..."
#         ],
#         "reasoning": "..."
#         }}
#         """
#         raw = await self._call_llm_with_retry(planning_prompt)
#         raw = re.sub(r'^```json\s*', '', raw)
#         raw = re.sub(r'^```\s*', '', raw)
#         raw = re.sub(r'\n?```$', '', raw).strip()

#         try:
#             plan_data = json.loads(raw)
#             plan = AnalysisMode(**plan_data)
#         except Exception as e:
#             print(f"\nAnalysis plan parse error: {e}\nRaw: {raw}")
#             plan = AnalysisMode(
#                 intent_summary="Fallback: could not parse analysis plan.",
#                 time_context=None,
#                 data_needed=["fallback"],
#                 sub_questions=["Select all records from the most relevant table "],
#                 reasoning="Fallback due to parse error."
#             )

#         print(f"\n=== ANALYSIS PLAN ===")
#         print(f"Intent   : {plan.intent_summary}")
#         print(f"Time     : {plan.time_context}")
#         print(f"Needed   : {plan.data_needed}")
#         print(f"Reasoning: {plan.reasoning}")
#         print(f"Sub-questions:\n" + "\n".join(f"  [{i+1}] {q}, limit 50" for i, q in enumerate(plan.sub_questions)))

#         return {
#             "analysis_plan": plan.model_dump(),
#             "chunks_text": chunks,
#             "messages": [AIMessage(content=f"Analysis plan created: {plan.intent_summary}")]
#         }
    
#     async def _analysis_insight_node(self, state: AgentStateScehma) -> dict:
#         evidence = state.get("analysis_evidence", "")
#         question = state["user_question"]
#         plan_data = state.get("analysis_plan", {})

#         # Hard guard — no hallucination if no data
#         if not evidence or evidence.strip() == "NO_DATA":
#             return {
#                 "messages": [AIMessage(content=(
#                     "I wasn't able to retrieve sufficient data from the database to answer this question. "
#                     "Please check if the relevant tables have data, or try rephrasing your question."
#                 ))]
#             }

#         intent_summary = plan_data.get("intent_summary", "answer the user's question")
#         time_context   = plan_data.get("time_context") or "the relevant period"
#         data_needed    = plan_data.get("data_needed", [])
#         sub_questions = plan_data.get("sub_questions", [])

#         insight_prompt = f"""
#         You are STAR-AI, a smart inventory and business analyst assistant built by BrainBox Tardid.

#         USER QUESTION:
#         {question}

#         WHAT THE USER WANTS:
#         {intent_summary}

#         TIME CONTEXT:
#         {time_context}

#         DATA POINTS COLLECTED:
#         {chr(10).join(f"- {d}" for d in data_needed)}

#         SUB-QUESTIONS:
#         {sub_questions}

#         DATA AVAILABLE:
#         {evidence}

#         TASK:
#         Answer the user's question in a clear, simple way that a non-technical person can understand.

#         RULES:
#         - Use only the product names, dates, quantities, values, and facts that appear in the data above.
#         - Do not invent numbers, dates, or product names.
#         - Do not mention SQL, database internals, prompts, or system messages.
#         - Do not use technical jargon.
#         - Use simple business language.
#         - If a value is missing, say "data not available".
#         - If the exact time period is not in the data, but there is enough historical data to make a reasonable forecast, give a forecast based on the trend in the available data.
#         - If there is not enough data to support a forecast, still provide a flat baseline 
#         estimate using whatever data is available. Only say "not enough data" if there is 
#         literally NO data at all (empty results or all errors).    
#         - If the data contains a case like "select 1 where false", treat it as missing data and do not analyze it.
#         - Keep the answer practical and easy to understand.
#         - The currency is in Rupees, so use only Rupees in your answer when mentioning money.

#         STYLE:
#         - Start with a short direct answer.
#         - Then explain the result in 2 to 4 short paragraphs or bullets.
#         - If useful, include a simple table with a clear title.
#         - End with a short action or recommendation if appropriate.

#         FORECASTING RULE:
#         - If the user asks about the future, use the past data to estimate the likely trend.
#         - Make it clear that the result is an estimate, not a certainty.
#         - Do not repeat raw rows of data; summarize the trend in plain language.

#         OUTPUT FORMAT:
#         1. Short answer
#         2. Optional table with a clear title
#         3. Simple explanation of the table
#         4. Recommendation or next step

#         Write in a natural, friendly, and non-technical way.
#         """

#         recommendation = await self._call_llm_with_retry(insight_prompt)

#         return {
#             "messages": [AIMessage(content=recommendation)]
#         }
    
#     async def _analysis_execute_node(self, state: AgentStateScehma) -> dict:
#         plan_data  = state.get("analysis_plan", {})
#         sub_questions = plan_data.get("sub_questions", [])

#         evidence_parts: list[str] = []
#         final_results_for_ui = []
#         final_sql_for_ui = ""

#         for i, question in enumerate(sub_questions, start=1):
#             label = f"Sub-question {i}: {question}"
#             print(f"\n--- {label} ---")

#             chunks = await self._hybrid_retrieve(question)

#             sql_prompt = self.get_system_prompt_for_db(self.db_drive).format(
#                 chunks_text=chunks, question=f'{question}, limit 15'
#             )
#             raw_sql = await self._call_llm_with_retry(sql_prompt)
#             sql = self._extract_sql(raw_sql)

#             for attempt in range(3):
#                 result_status = await self._verify_query(sql, state)

#                 if "successfully" in result_status.lower() or "valid" in result_status.lower():
#                     try:
#                         print(f"✓ Executed, attempt {attempt+1}, Query: \n{sql} \n")
#                         if self.results:
#                             print("\n",self.results)
#                         else:
#                             print("\nempty")
                        
#                         evidence_parts.append(
#                             f"--- {label} ---\nSQL: {sql}\nRESULT:\n{self.results}"
#                         )
                        
#                         # Capture the latest successful results and SQL for the UI table
#                         final_results_for_ui = self.results
#                         final_sql_for_ui = sql
                        
#                     except Exception as e:
#                         evidence_parts.append(
#                             f"--- {label} ---\nSQL: {sql}\nRESULT: [db.run error: {str(e)[:120]}]"
#                         )
#                     break
#                 else:
#                     print(f"✗ Attempt {attempt+1} failed: {result_status[:120]}")
#                     if attempt < 2:
#                         sql = await self._fix_sql_error(
#                             user_question=question,
#                             sql_str=sql,
#                             error=result_status,
#                             chunks_text=chunks
#                         )
#                     else:
#                         evidence_parts.append(
#                             f"--- {label} ---\nSQL: {sql}\nRESULT: [could not execute after 3 attempts]"
#                         )
            
#             print("\n",sql,"\n")

#         has_real_data = any(
#             "RESULT:" in e and "[error" not in e and "[could not" not in e
#             for e in evidence_parts
#         )

#         if not has_real_data:
#             return {
#                 "analysis_evidence": "NO_DATA",
#                 "result": [],
#                 "status": "NO_RESULTS",
#                 "messages": [AIMessage(content="No data could be retrieved from the database.")]
#             }

#         evidence_text = "\n\n".join(evidence_parts)
#         print(f"\n=== EVIDENCE COLLECTED ({len(evidence_parts)} sub-questions) ===")

#         # ✅ FIXED: Added "status": "DATA_LOADED" to trigger the UI Table render
#         return {
#             "analysis_evidence": evidence_text,
#             "result": final_results_for_ui,
#             "sql_query": final_sql_for_ui,
#             "last_sql": final_sql_for_ui,
#             "status": "DATA_LOADED", 
#             "messages": [AIMessage(content=f"Collected evidence from {len(evidence_parts)} sub-questions.")]
#         }


#     async def build_and_run_graph(self):
#         q_lower = str(self.question).lower().strip()
        
#         is_create_chart = (
#             q_lower.startswith("create ") or
#             "generate a new" in q_lower or
#             "build a chart" in q_lower or
#             "scatter plot" in q_lower or
#             "bar graph" in q_lower or
#             "chart" in q_lower or
#             "graph" in q_lower
#         )
#         is_metric_fetch = (
#             q_lower.startswith("- metric:") or
#             "visualization:" in q_lower or
#             "parquet" in q_lower
#         )

#         # DASHBOARD BYPASS — DISABLED
#         # "meglan" was a dashboard keyword which caused questions like
#         # "give me meglan order" to route to dashboard instead of DB_QUERY
#         # dashboard_keywords = ["meglan", "warnetix", "neuroeye", "system"]
#         # is_dashboard_access = (
#         #     any(kw in q_lower for kw in dashboard_keywords) and len(q_lower.split()) <= 4
#         # ) or "access dashboard" in q_lower

#         compact_history = []
#         for msg in self.last_conversation_history[-self._max_history_messages:]:
#             msg_content = getattr(msg, "content", "")
#             if not isinstance(msg_content, str):
#                 msg_content = str(msg_content)
#             if len(msg_content) > self._max_message_chars:
#                 msg_content = msg_content[:self._max_message_chars] + " ..."
#             if isinstance(msg, HumanMessage):
#                 compact_history.append(HumanMessage(content=msg_content))
#             else:
#                 compact_history.append(AIMessage(content=msg_content))

#         question_text = self.question if isinstance(self.question, str) else str(self.question)
#         if len(question_text) > self._max_message_chars:
#             question_text = question_text[:self._max_message_chars] + " ..."

#         mock_state = {
#             "messages": compact_history + [HumanMessage(content=question_text)],
#             "user_question": self.question,
#             "user_id": str(self.user_id),
#             "session_id": str(self.session_id) if self.session_id else None,
#             "message_id": str(self.message_id) if self.message_id else None,
#             "target_db_url": self.target_db_url,
#             "result": [],
#             "sql_query": "",
#             "query_id": getattr(self, "last_query_id", None),
#             "active_chart_id": None,
#             "active_chart_name": None,
#             "download_url": None
#         }

#         db_display_name = getattr(self, "db_display_name", "GISDB")
#         paths = get_db_storage_paths(self.user_id, db_display_name)
#         schema_file_path = paths["schema_file"] if paths else None

#         if schema_file_path and not schema_file_path.exists():
#             os.makedirs(os.path.dirname(str(schema_file_path)), exist_ok=True)
#             try:
#                 await self._extract_schema_cache(self.target_db_url, str(schema_file_path))
#             except Exception as e:
#                 print(f"⚠️ Schema extraction error: {e}")
#                 pass

#         if schema_file_path:
#             mock_state["schema_path"] = str(schema_file_path)
#             mock_state["vector_path"] = str(paths["vector_store"]) if paths else ""

#         bypassed_state = None
#         if is_create_chart:
#             bypassed_state = await self._create_chart_node(mock_state)
#         elif is_metric_fetch:
#             clean_q = re.sub(
#                 r'\(visualization:\s*[^)]+\)', '', self.question, flags=re.IGNORECASE
#             )
#             mock_state["user_question"] = re.sub(
#                 r'- metric:\s*', '', clean_q, flags=re.IGNORECASE
#             ).strip()
#             bypassed_state = await self._fetch_chart_node(mock_state)
#         # DASHBOARD BYPASS — DISABLED
#         # elif is_dashboard_access:
#         #     bypassed_state = await self._access_dashboard_node(mock_state)

#         if bypassed_state:
#             final_state = mock_state
#             final_state.update(bypassed_state)
#         else:
#             print("nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn")
#             workflow = StateGraph(AgentStateScehma)
#             workflow.add_node("intent",           self._classify_intent)
#             workflow.add_node("access_dashboard", self._access_dashboard_node)
#             workflow.add_node("report_gen",       self._report_gen_node)
#             workflow.add_node("fetch_chart",      self._fetch_chart_node)
#             workflow.add_node("create_chart",     self._create_chart_node)
#             workflow.add_node("schema",           self._schema_node)
#             workflow.add_node("sql_gen",          self._sql_gen_node)
#             workflow.add_node("verify",           self._verify_node)
#             workflow.add_node("answer",           self._answer_node)
#             workflow.add_node("analysis_plan",    self._analysis_plan_node)
#             workflow.add_node("analysis_execute", self._analysis_execute_node)
#             workflow.add_node("analysis_insight", self._analysis_insight_node)
#             workflow.add_node("chat",             self._chat_node)
#             workflow.add_node("followup",         self._followup_question_modify)
#             workflow.add_node("manufacturing",    self._manufacturing_node)
#             workflow.add_node("guided",           self._guided_node)

#             workflow.add_edge(START, "intent")
#             workflow.add_conditional_edges("intent", self._route_intent)
#             for n in [
#                        "schema","followup", "chat","create_chart", 
#                        "analysis_plan", "guided", "manufacturing"
#             ]:
#                 workflow.add_edge(n, END)
#             workflow.add_edge("schema",   "sql_gen")
#             workflow.add_edge("sql_gen",  "verify")
#             workflow.add_edge("verify",   "answer")
#             workflow.add_edge("answer",   END)
#             workflow.add_edge("followup", "schema")
#             workflow.add_edge("chat",     END)
#             workflow.add_edge("analysis_plan",    "analysis_execute")
#             workflow.add_edge("analysis_execute", "analysis_insight")
#             workflow.add_edge("analysis_insight", END)
#             workflow.add_edge("guided", END)
#             workflow.add_edge("manufacturing", END)

#             graph = workflow.compile()
#             input_state = mock_state
#             input_state.update({"chunks_text": ""})
#             final_state = input_state
#             try:
#                 async for step in graph.astream(input_state, stream_mode="values"):
#                     final_state = step
#             except Exception as e:
#                 import traceback
#                 print("🔴 GRAPH EXECUTION ERROR:")
#                 print(traceback.format_exc())
#                 return {
#                     "langgraph_message": f"Execution halted: {str(e)}",
#                     "query": "ERROR",
#                     "result": [],
#                     "status": "ERROR",
#                     "columns": [],
#                     "user_question": input_state.get("user_question", "Unknown"),
#                     "active_dashboard": None,
#                     "chart_url": None,
#                     "chart_json": None,
#                     "chart_name": None,
#                     "id": None,
#                     "download_url": None,
#                     "session_cookie": None,
#                     "chart_id": None
#                 }

#         return self._package_final_response(final_state)

#     # ══════════════════════════════════════════════════════════════════════════
#     #  RESPONSE PACKAGER
#     # ══════════════════════════════════════════════════════════════════════════
#     def _package_final_response(self, state):
#         messages = state.get("messages", [])
#         ai_message_text = (
#             messages[-1].content
#             if messages and hasattr(messages[-1], 'content')
#             else str(messages[-1]) if messages
#             else "Error"
#         )
        
#         raw_results = state.get("result", [])
#         clean_rows  = []
#         columns     = []

#         if raw_results:
#             first_row = raw_results[0]
#             if isinstance(first_row, dict): columns = list(first_row.keys())
#             elif hasattr(first_row, "_mapping"): columns = list(first_row._mapping.keys())
#             elif hasattr(first_row, "_asdict"): columns = list(first_row._asdict().keys())
#             elif isinstance(first_row, (list, tuple)): columns = [f"Col_{i+1}" for i in range(len(first_row))]
#             else: columns = ["Result"]
            
#             for row in raw_results:
#                 formatted_row = []
#                 if isinstance(row, dict): items = row.items()
#                 elif hasattr(row, "_mapping"): items = row._mapping.items()
#                 elif hasattr(row, "_asdict"): items = row._asdict().items()
#                 elif isinstance(row, (list, tuple)): items = enumerate(row)
#                 else: items = [(0, row)]
                
#                 for col_name, val in items:
#                     if val is None:
#                         formatted_row.append("")
#                         continue
                        
#                     col_str = str(col_name).lower()
                    
#                     # 🚀 GEOJSON & DICT FORMATTING
#                     if isinstance(val, (dict, list)):
#                         try: val = json.dumps(val)
#                         except: val = str(val)
#                     elif isinstance(val, str) and '{"type"' in val:
#                         try:
#                             geo_data = json.loads(val)
#                             if geo_data.get('type') == 'Point' and 'coordinates' in geo_data:
#                                 val = f"Lng: {geo_data['coordinates'][0]}, Lat: {geo_data['coordinates'][1]}"
#                         except:
#                             pass
                    
#                     # 🚀 DISTANCE FORMATTING
#                     if "distance" in col_str and isinstance(val, (float, int, Decimal)):
#                         try:
#                             val = f"{round(float(val), 2)} km"
#                         except:
#                             pass
#                     else:
#                         try:
#                             f_val = float(val)
#                             if 1000000000000 < f_val < 3000000000000 and any(k in col_str for k in ['date', 'time', 'at', 'created', 'updated']):
#                                 val = datetime.fromtimestamp(f_val / 1000.0).strftime('%Y-%m-%d %H:%M:%S')
#                             elif 1000000000 < f_val < 3000000000 and any(k in col_str for k in ['date', 'time', 'at', 'created', 'updated']):
#                                 val = datetime.fromtimestamp(f_val).strftime('%Y-%m-%d %H:%M:%S')
#                         except (ValueError, TypeError):
#                             pass
                            
#                     formatted_row.append(str(val))
#                 clean_rows.append(formatted_row)
        
#         c_url = state.get("chart_url")
#         if c_url:
#             c_url = c_url.replace("standalone=1", "standalone=2")
#             if "standalone=" not in c_url:
#                 c_url += ("?" if "?" not in c_url else "&") + "standalone=2"
                
#         last_sql = state.get('sql_query', '')
#         query_id_str = str(state.get("query_id", ""))
        
#         status = state.get("status")
#         active_db = state.get("active_dashboard")
#         db_url = state.get("dashboard_url")
#         c_name = state.get("chart_name")
#         c_id = state.get("id") or state.get("active_chart_id")
#         dl_url = state.get("download_url") 
#         session_cookie = state.get("session_cookie") 
#         chart_json = state.get("chart_json") 
        
#         return {
#             "user_question": self.question,              # The final processed question
#             "query": last_sql if last_sql else "",        # Raw SQL query executed
#             "langgraph_message": ai_message_text,         # The AI's natural language response
#             "result": clean_rows,                         # Full tabular data (unprocessed)
#             "columns": columns,                           # Column headers
#             "status": status,                             # UI state controller: DATA_LOADED, CHART_LOADED, ERROR
#             "active_dashboard": active_db,                # Linked Superset dashboard name
#             "dashboard_url": db_url,                      # iframe URL for dashboard
#             "chart_url": c_url,                           # iframe URL for specific chart
#             "chart_json": chart_json,                     # Plotly JSON for interactive charts
#             "chart_name": c_name,                         # Title of the visualization
#             "id": c_id,                                   # unique ID for the chart
#             "download_url": dl_url,                       # CSV download link (Superset)
#             "session_cookie": session_cookie,             # Auth cookie for iframe
#             "chart_id": c_id,                              # Alias for 'id'
#             "flag": state.get("flag", False)
#         }
















# ################################################### UPDATED ON THE JUNE 16 ########################################################


# # from pydantic import BaseModel, Field
# # # from star_ai_chatbot_postgresql.star_ai_chatbot import AgentState
# # from thefuzz import fuzz
# # from datetime import datetime, date, timedelta
# # import re
# # import asyncio
# # import json
# # import os
# # import csv
# # import uuid
# # from decimal import Decimal
# # import decimal

# # from langchain_core.tools import tool
# # from langchain_core.documents import Document
# # from langchain_community.vectorstores import FAISS
# # from langchain_core.messages import AIMessage, HumanMessage, BaseMessage
# # from langgraph.graph.message import add_messages
# # from langgraph.graph import StateGraph, START, END
# # import pandas as pd
# # import numpy as np
# # import plotly.graph_objects as go
# # import plotly.io as pio

# # # SQLAlchemy imports for standalone schema extraction
# # from sqlalchemy import create_engine, MetaData, event
# # from sqlalchemy.schema import CreateTable
# # from sqlalchemy import text
# # import sqlalchemy.types as sqltypes
# # from sqlalchemy.ext.asyncio import create_async_engine
# # from sqlalchemy.pool import NullPool


# # from app.services.superset_service import SupersetService
# # from app.core.path_utils import get_db_storage_paths

# # from app.schemas.agent_model_schema import (
# #     AgentStateScehma,
# #     RetreiveSchema,
# #     GenerateSqlScehma,
# #     VerifyQuerySchema,
# #     RetreiveSchemaSchema,
# #     GenerateSQLSchema,
# #     FixSQLSchema,
# #     AnalysisMode
# # )

# # from app.services.llama_model_init import GroqLLM


# # class SqlGraphQueryAgentBuilder:
# #     SEASON_MAP = {
# #         "summer":  {"months": [3, 4, 5],    "label": "Summer (Mar-May)"},
# #         "monsoon": {"months": [6, 7, 8, 9], "label": "Monsoon (Jun-Sep)"},
# #         "winter":  {"months": [11, 12, 1, 2],"label": "Winter (Nov-Feb)"},
# #         "rainy":   {"months": [6, 7, 8, 9], "label": "Rainy (Jun-Sep)"},
# #     }

# #     def __init__(
# #         self,
# #         question: str = None,
# #         user_id: str = None,
# #         user_db_source=None,
# #         active_api_key: str = None,
# #         llm=None,
# #         db_repo=None,
# #         user_db_repo=None,
# #         api_key_service=None,
# #         vectorstore=None,
# #         chunks=None,
# #         dangerous_commands=None,
# #         last_conversation_history: list = None,
# #         session_id: str = None,
# #         message_id: str = None,
# #         target_db_url: str = None,
# #         db_drive: str = "sqlite",
# #         db_display_name: str = "GISDB",
# #         superset_service=None,
# #         stream_callback=None
# #     ):
# #         self.question = question
# #         self.user_id = user_id
# #         self.user_db_source = user_db_source
# #         self.active_api_key = active_api_key
# #         self.results = []
# #         self.llm = llm
# #         self.db_repo = db_repo
# #         self.user_db_repo = user_db_repo
# #         self.api_key_service = api_key_service
# #         self.vectorstore = vectorstore
# #         self.chunks = chunks
# #         self.dangerous_commands = dangerous_commands or ["drop", "delete", "truncate", "alter"]
# #         self.last_conversation_history = last_conversation_history or []
# #         self.session_id = session_id
# #         self.message_id = message_id
# #         self.last_query_id = None
# #         self.target_db_url = target_db_url
# #         self.db_drive = db_drive
# #         self.db_display_name = db_display_name
# #         self.stream_callback = stream_callback

# #         if superset_service is None:
# #             self.superset_service = SupersetService(
# #                 host="starai.local:8088", username="admin", password="admin"
# #             )
# #         else:
# #             self.superset_service = superset_service
            
# #         self._max_history_messages = 4
# #         self._max_message_chars = 500
# #         self._max_history_chars = 1500
# #         self._max_prompt_chars = 15000
# #         self._max_schema_chars = 10000
# #         self._max_hybrid_chars = 5000
        
# #         # ══════════════════════════════════════════════════════════════════════
# #         #  🧠 CORE LLM PROMPTS
# #         # ══════════════════════════════════════════════════════════════════════
# # #         self.CONVERSATIONPROMPT = """
# # # SYSTEM: You are a high-intelligence Maritime Intent Classifier.
# # # Output ONLY one label from the list below.

# # # USER QUESTION: "{question}"
# # # CONTEXT: {conversation}

# # # LABELS:
# # # - DB_QUERY: Standard data retrieval, finding locations, distances, nearest land, nearby ships/boat, or waypoint details.
# # # - ANALYSIS: Requests for trends, forecasts, complex business logic, fuel usage, or long-term travel analysis.
# # # - CREATE_CHART: Explicit request for a visual graph or plot.
# # # - CHAT: Greetings, small talk, or general non-database questions.
# # # - MANUFACTURING: User wants to manufacture, assemble, build, order, or produce projects/products.
# # #     Requires BOM/material availability calculation.
# # #     Examples:
# # #         - "Build 3 Meglan"
# # #         - "Can we manufacture 10 EBM 20?"
# # #         - "How many EBM 40 can we assemble?"
# # #         - "Do we have enough materials for 5 Meglan?"
# # # - GUIDED: Use this when the user question is vague, ambiguous, uses undefined jargon,
# # #     references entities/columns/tables NOT clearly part of the database domain,
# # #     or cannot be mapped to a concrete SQL query without guessing.
# # #     Also use this when the question is partially database-related but missing critical
# # #     details needed to generate a meaningful query.
# # #     Examples:
# # #         - "Show me everything" (too vague)
# # #         - "What is the xyz value?" (unknown column/entity)
# # #         - "Give me the report" (no specifics)
# # #         - "What is the current status?" (ambiguous)
# # #     Do NOT use GUIDED for questions that are specific enough to attempt a SQL query.

# # # RULE: If the question involves "location", "distance", "lat/lon", "where is", or "nearest", label it DB_QUERY.
# # # """
# #         self.CONVERSATIONPROMPT = """
# #         SYSTEM: You are a high-intelligence intent classification utility. Output ONLY one label. 
# #         Analyze the user question carefully. Ignore spelling mistakes (e.g., 'totel seles' means 'total sales').

# #         User Question: {question}
# #         previous conversation: {conversation}
# #         chunks: {chunks}

# #         LABELS:
# #         DB_QUERY          - The question requires generating a NEW SQL query that is not related with the previous conversations.
# #         FOLLOW_UP_SQL     - The user refers to a PREVIOUS user question or database query or result.
# #                           - The question modifies, refines, extends, or corrects the previous SQL.
# #                           - If the user wants to go with any suggestions from the previous answer
# #                           - Examples: 
# #                             - "Filter this by last year"
# #                             - "Group it by item"
# #                             - "Only show pending ones"
# #                             - "Can you change this to monthly totals?"
# #                             - "1" or "2" etc
# #         CHAT              - Greetings, casual conversation, or general talk. Examples: "Hi", "Thanks", "How are you?"
# #         CREATE_CHART      - user explicitly asks for a "chart", "graph", "plot", or "visualization" based on data.
# #         ANALYSIS          - The user wants a recommendation, forecast, analyse, analysis, breifing or insight that requires
# #                             comparing historical data, seasonal trends, stock levels, or expiry.
# #                           - Examples:
# #                             - "What should I restock for monsoon?"
# #                             - "What items do I need for next quarter?"
# #                             - "Which products are running low?"
# #                             - "What's about to expire?"
# #                             - "Give me a restock plan for winter"
# #                             - "Anlayse and give me the sales"
# #                             - "Give a brief about the sales"
        
# #         GUIDED             - Use this when the user question is vague, ambiguous, uses undefined jargon,
# #                             references entities/columns/tables NOT clearly part of the database domain,
# #                             or cannot be mapped to a concrete SQL query without guessing.
# #                             - Also use this when the question is partially database-related but missing critical
# #                             details needed to generate a meaningful query (no time period, no product name,
# #                             no metric specified when one is required).
# #                             - Use this when the question is about a topic completely outside inventory/sales
# #                             (weather, geography, coding, general knowledge, etc.).
# #                             - Examples of GUIDED questions:
# #                                 - "Show me everything" (too vague)
# #                                 - "What is the xyz value?" (unknown column/entity)
# #                                 - "Give me the report" (no specifics - report of what?)
# #                                 - "What is the current status?" (ambiguous - status of what?)
# #                                 - "How is the business doing?" (too open-ended without specifics)
# #                                 - Any question outside inventory/sales domain
# #                             - Do NOT use GUIDED for questions that are specific enough to attempt a SQL query,
# #                             even if the result might be empty.

# #         MANUFACTURING       - User wants to manufacture, assemble, build, order, or produce projects/products.
# #                             - Total 3 projects that include "Meglan", "EBM 20", "EBM 40".
# #                             - Examples:
# #                                 - "Build 3 Meglan"
# #                                 - "order 5 EBM 40"
# #                                 - "Can we manufacture 10 EBM 20?"
# #                                 - "How many EBM 40 can we assemble?"
# #                                 - "Do we have enough materials for 5 Meglan?"

# #         RULES:
# #         1. If "total sales", "how many", or "list" is asked without the word "chart/graph", use DB_QUERY.
# #         2. If the user mentions "chart", "graph", "plot", or "viz" with a data question, use CREATE_CHART.
# #         3. If asking for stock recommendations, expiring items, or trends, use ANALYSIS.
# #         4. If the user is asking only for raw data (numbers, lists, totals), that can be answered with only using SQL query
# #             and no interpretation is required -> DB_QUERY or FOLLOW_UP_SQL
# #         5. Choose FOLLOW_UP_SQL over DB_QUERY if it depends on previous sql
# #         6. Choose CHAT label only if no database context is involved
# #         7. If the question is too vague, uses unknown terms, or cannot be answered without
# #             guessing what the user means → GUIDED.
# #         8. When in doubt between DB_QUERY and GUIDED, prefer GUIDED to avoid hallucination.

# #         OUTPUT ONLY THE LABEL.
# #         """
# #         self.CHATNODEPROMPT = """
# #         You are STAR-AI, a smart and professional database assistant
# #         built by BrainBox Tardid.

# #         You are provided 2 inputs
        
# #         previous conversation: {conversation}
# #         Current User question: {question}
        
# #         Your responsibilities:
# #         - You cannot have access to modify the STAR-AI database
# #         - You are not allowed to do web search (Do not mention it to the user)
# #         - Do not mention your thinking to the user
# #         - You are allowed to answer only related to the current database, if user asks 
# #           something other than the database, deny it politely
# #         - If the user asks anything outside the database domain (e.g., general knowledge, 
# #           coding help, personal advice, explanations unrelated to stored data), you MUST politely refuse.
# #         - You cannot help user in other domains, except communicating with the database
# #         - You can have a general, non domain specific, conversation with the user
# #         - Reply based on the user question and the previous conversations
# #         """

# #         self.FOLLOWUPQUESTIONMODIFYPROMPT = """
# #         - You are given the previous conversations and the current user question as well.
# #         - Based on this, identify what user wants and if the user wants to go with 
# #           any followup question, merge that followup question or suggestions and the 
# #           previous user question and return a complete meaningfull question.
# #         - Include every details, the user is asking or mentioning from the conversation, 
# #           with the question itself and provide a single detailed question in the format 
# #           that will be suitable to give it to a database assistance, which can generate a PostgreSQL query
# #         - Do not ask back any other question

# #         Eg: previous question - 'give me the list of unapproved indents'
# #             previous answer and followup question - 'select * from indents where datetime is NULL' , followup suggestion - Do you want me to limit to 10?
# #             current user question - "yes"
# #             your output: give me the list of unapproved indents limited to 10

# #         conversation: {conversation}
        
# #         current user question: {user_question}

# #         Only return a question, nothing else
# #         """

# #         self.SQLANALYSISPROMPT = """
# #         You are STAR-AI, a smart and professional database assistant
# #         built by BrainBox Tardid.

# #         SQL: {last_sql}
        
# #         Last question: {user_question}

# #         Your responsibilities:
# #         - You are not allowed to do web search (Do not mention it to the user)
# #         - Do not mention your thinking to the user
# #         - This database has no information related to what user is asking, so reply it in a professional way
# #          SPECIAL CASE: If the evidence contains "select 1 where false":
# #             → It means required data/columns are not present in the database.

# #         In this case:
# #         - Clearly state that the data is not available
# #         - NEVER mention or reference internal query outputs such as "select 1 where false"
# #         - NEVER explain missing data using technical or query-related reasons
# #         """

# #         self.SQLFAILEDANALYSISPROMPT = """
# #         You are STAR-AI, a smart and professional database assistant
# #         built by BrainBox Tardid.

# #         SQL: {last_sql}
        
# #         Last question: {user_question}

# #         Your responsibilities:
# #         - You are not allowed to do web search (Do not mention it to the user)
# #         - Do not mention your thinking to the user
# #         - sql query cannot be generated for this question, so reply it in a professional way and 
# #           suggest the user to ask simpler questions related to the database, and also suggest 
# #           some example questions that you can answer
# #         """

# #         self.SQLNORESULTANALYSISPROMPT = """
# #         You are STAR-AI, a smart and professional database assistant
# #         built by BrainBox Tardid.

# #         SQL: {last_sql}

# #         Last question: {user_question}

# #         Current Time:  {current_time}

# #         Your responsibilities:
# #         - You do not have access to modify the STAR-AI database
# #         - You are not allowed to do web search (Do not mention it to the user)
# #         - Do not mention your thinking to the user
# #         - Do not mention that you do not have access to the database
# #         - If the query returns no results:
# #             → First check if it is due to a future date

# #             If YES:
# #                 → follow FUTURE DATE HANDLING rule

# #             If NO:
# #                 → provide insights based on the query and suggest why the result may be empty        
# #         - Do not reply in a table format
# #         - Suggest 2-3 short follow up questions to the user and the questions should be in a formate like, example, do want me to......, would you like me to..., if you want, i will..... etc
# #         - The followup questions should only be in a proper textual question format, do not include any sql query in that
# #         - The followup questions should be in a format such that it can be answered only using a sql query itself, not like exporting data to csv or generating python code
# #         - Do not give response that mentions user to check the data. Only suggest ways that you can help with.
# #         - While giving the response, do not mention any sql query

# #         FUTURE DATE HANDLING (HIGHEST PRIORITY):

# #         - If the user's question refers to a future date or time period 
# #         (beyond CURRENT_DATE):

# #         → Clearly inform that future data is not available in the database
# #         → Do NOT attempt to generate insights for that future period
# #         → Do NOT assume or fabricate results

# #         Instead:
# #         - Explain briefly that the database only contains past data up to today
# #         - Offer helpful follow-up questions

# #         Examples:

# #         User: "sales for july 2026" (when current date is april 2026)
# #         → "The database contains only historical data up to today, so future data is not available."

# #         - Suggest 2-3 short follow up questions to the user and the questions should be in a formate like, example, do want me to......, would you like me to..., if you want, i will..... etc
# #         - The followup questions should only be in a proper textual question format, do not include any sql query in that
# #         - The followup questions should be in a format such that it can be answered only using a sql query itself, not like exporting data to csv or generating python code
# #         """

# #         self.DASHBOARD_REPORT_PROMPT = """
# # You are a Senior Business Data Analyst for STAR AI.
# # Write a professional Executive Report based on the '{db_name}' dashboard context.
# # {dashboard_context}
# # Use Markdown styling, emojis (📊, 📈, 💡), and bullet points.
# # Make it professional and ready for leadership.
# # Current request: {user_question}
# # """
# #         self.FILTER_EXTRACTION_PROMPT = """
# # SYSTEM: Output ONLY a valid JSON array. No markdown. No explanation.
# # Extract ONLY explicit data constraints or time ranges from this user request: '{user_question}'
# # Current Date for Reference: {current_date_str}
# # RULES:
# # 1. Output a JSON ARRAY of filter objects with keys: "col", "op", "val"
# # 2. Operators allowed: "==", "!=", ">=", "<=", "LIKE"
# # 3. Translate natural time into ">=" and "<=" filters on the 'date' column.
# # 4.  CRITICAL: Do NOT extract chart IDs, dashboard names, or visualization types (e.g. 'ID: 42', 'viz: None') as filters. Only extract constraints on actual database data.
# # 5. If no real data filters are explicitly requested, return exactly: []
# # FORMAT: JSON array only. Nothing else.
# # """
# #         self.CHART_ANALYSIS_PROMPT = """
# # You are STAR AI, an elite Business Data Analyst built by Tardid Technologies.
# # Chart name: '{chart_name}' (ID: {chart_id})
# # User question: '{question}'
# # {filter_context}
# # Raw data powering this chart:
# # Columns: {headers}
# # Data Sample (Top 10 rows): {clean_data_sample}
# # Provide a professional, highly analytical response based ONLY on this data.

# # CRITICAL INSTRUCTION: You MUST divide your response into EXACTLY these four sections using these exact markdown headers:
# # ## Executive Summary
# # ## Key Findings
# # ## Recommendations
# # ## Action Plan

# # Use Markdown formatting, bullet points, and highlight key insights.
# # """        


# #     def _robust_extract_output(self, raw_str: str, table_list: list = None) -> str:
# #         clean = re.sub(r'```json\s*|\s*```|`', '', raw_str).strip()
# #         if table_list is not None:
# #             if "NEED_VIRTUAL_DATASET" in clean:
# #                 return "NEED_VIRTUAL_DATASET"
# #             for t in table_list:
# #                 if t.lower() in clean.lower():
# #                     return t
# #             return "NEED_VIRTUAL_DATASET"
# #         match = re.search(r'\{.*?\}', clean, re.DOTALL)
# #         if match:
# #             json_text = match.group()
# #             json_text = re.sub(r',\s*([\}\]])', r'\1', json_text)
# #             return json_text
# #         return clean

# #     def _extract_sql(self, raw_str: str) -> str:
# #         clean = re.sub(r'```sql\s*|\s*```|`', '', raw_str, flags=re.IGNORECASE).strip()
# #         match = re.search(r'(?i)\b(SELECT|WITH)\b.*', clean, re.DOTALL)
# #         if match:
# #             sql = match.group(0).strip()
# #             return sql.rstrip(';') + ';'
# #         return clean

# #     def _normalize_product_names(self, text: str) -> str:
# #         if not isinstance(text, str):
# #             return text

# #         replacements = {
# #             r"\bmeg[\s-]*lan\b": "Meglan",
# #             r"\bebm[\s-]*20\b": "EBM 20",
# #             r"\bebm[\s-]*40\b": "EBM 40"
# #         }

# #         normalized = text
# #         for pattern, canonical in replacements.items():
# #             normalized = re.sub(pattern, canonical, normalized, flags=re.IGNORECASE)
# #         return normalized

# #     def _normalize_product_name_literals(self, sql_str: str) -> str:
# #         if not isinstance(sql_str, str):
# #             return sql_str

# #         replacements = {
# #             r"(?i)(['\"])meg[\s-]*lan\1": r"\1Meglan\1",
# #             r"(?i)(['\"])ebm[\s-]*20\1": r"\1EBM 20\1",
# #             r"(?i)(['\"])ebm[\s-]*40\1": r"\1EBM 40\1"
# #         }

# #         normalized = sql_str
# #         for pattern, replacement in replacements.items():
# #             normalized = re.sub(pattern, replacement, normalized)
# #         return normalized

# #     def get_system_prompt_for_db(self, driver: str) -> str:
# #         driver = driver.lower() if driver else "postgresql"
# #         postgres_dialect = """
# #         "1. Timestamp: Use CURRENT_TIMESTAMP or NOW() for current time.
# #             Use CURRENT_DATE for todays date.
# #             Use DATE_TRUNC(day, column) to truncate timestamps.
# #             Use column::date to convert timestamp to date.
# #             Use column + INTERVAL 1 day for date arithmetic.
# #             Use EXTRACT(YEAR FROM <column_name>) and EXTRACT(MONTH FROM <column_name>) to extract parts of dates.
# #             NEVER use derived column names like year, month, day directly.
# #             ALWAYS compute them using EXTRACT() from a valid date or timestamp column.
# #             Example: WRONG: SELECT year FROM sales.
# #             CORRECT: SELECT EXTRACT(YEAR FROM order_date) AS year FROM sales.
# #             If the user mentions a month, week, or date WITHOUT a year: prefer the CURRENT YEAR.
# #         2. Pagination: LIMIT and OFFSET.
# #         3. Case-insensitive:
# #             IMPORTANT SQL RULES:

# #             3.1. Never use '=' for text/string columns.

# #             3.2. ALL text comparisons MUST use:
# #             ILIKE '%' || value || '%'

# #             3.3. This rule is mandatory for:
# #             - WHERE
# #             - JOIN
# #             - HAVING
# #             - CASE
# #             - EXISTS
# #             - subqueries
# #             - CTEs
# #             - filters
# #             - search conditions

# #             3.4. Text columns include:
# #             employee names,
# #             department names,
# #             vendor names,
# #             categories,
# #             locations,
# #             statuses,
# #             descriptions,
# #             product names,
# #             emails,
# #             identifiers stored as text.

# #             3.5. Examples:

# #             Incorrect:
# #             assigned_employee_name = 'manjunath'

# #             Correct:
# #             assigned_employee_name ILIKE '%manjunath%'

# #             Incorrect:
# #             department = 'operations'

# #             Correct:
# #             department ILIKE '%operations%'

# #             3.6. Only numeric/date/boolean columns may use exact operators (=, >, <, BETWEEN).

# #         4. Auto-increment: SERIAL.
# #         5. JSON extract: column->>'key'.
# #         6. Concat: ||.",
# #         """
# #         dialect_rules = {
# #             "postgresql": postgres_dialect,
# #             "mariadb": "Use standard ANSI SQL syntax.",
# #             "mysql": "Use standard ANSI SQL syntax.",
# #             "sqlite": "Use standard ANSI SQL syntax.",
# #             "mssql": "Use standard ANSI SQL syntax."
# #         }
# #         selected_rules = dialect_rules.get(driver, "Use standard ANSI SQL syntax.")
        
# #         prompt = f"""
# #         SYSTEM: You are an expert {driver.upper()} SQL generator.
# #         Use ONLY the following schema chunks:
# #         {{chunks_text}}

# #         USER QUESTION: {{question}}

# #         CRITICAL RULES:
# #         * Write ONLY valid {driver.upper()} SQL.
# #         * NO explanations. Do not speak English.
# #         * DO NOT INVENT TABLE OR COLUMN NAMES. Never assume standard names like 'sales' or 'orders' exist.
# #         * Use correct table and column names exactly as shown in the schema.
# #         * Use double quotes for columns/tables with spaces, special characters, or capitalized names (e.g. `"Category"`).
# #         * Do not return markdown fences like ```sql or `. Just return the raw SQL query.
# #         * Prefer LEFT JOIN when unsure.
# #         * Do not return an empty response, always return a valid SQL query
# #         * When using Order by, use NULLS LAST
# #         * "Total Sales": Look for real columns like 'units_sold', 'price', or 'amount' (e.g. `SUM("units_sold" * "price")`).
# #         * "How many": Use `COUNT(*)`.
# #         * Always use ignore nulls in every query at last.
# #         * If user is mentioning anything specific like name of the product or a person or a place etc... then always consider the data as case sensitive
        

# #         EMPLOYEE ID RULE (HIGH PRIORITY):

# #         * `owner_employee_id` contains employee IDs such as `TT020`, `TT031`.
# #         * `assigned_to` contains employee names or team names, not employee IDs.
# #         * If the user mentions an ID-like value (e.g. `TT020`, `TT031`), always compare it with `owner_employee_id`.
# #         * Never compare an ID-like value with `assigned_to` when `owner_employee_id` exists.
# #         * Examples:

# #         * "products assigned to TT020" → `WHERE owner_employee_id = 'TT020'`
# #         * "products assigned to John Doe" → `WHERE assigned_to = 'John Doe'`

# #         QUANTITY RULE (VERY IMPORTANT — READ FIRST):

# #         When the user asks "how many [item/product]", "how much [item]", "quantity of [item]",
# #         "total [item]", or any question about stock/availability of a specific product or item —
# #         ALWAYS use SUM(qty) NOT COUNT(*).
# #         COUNT(*) counts the number of database rows (records), NOT the physical quantity in stock.
# #         SUM(qty) gives the actual quantity/units available, which is what the user means.
    
# #         Examples:
# #             User: "how many bluetooth do I have?"
# #             WRONG:  SELECT COUNT(*) FROM stock WHERE item_name ILIKE '%bluetooth%'
# #             CORRECT: SELECT SUM(qty) FROM stock WHERE item_name ILIKE '%bluetooth%'

# #             User: "what is the quantity of pen in stock?"
# #             WRONG:  SELECT COUNT(*) FROM stock WHERE item_name ILIKE '%pen%'
# #             CORRECT: SELECT SUM(qty) FROM stock WHERE item_name ILIKE '%pen%'

# #             User: "total items available for printer?"
# #             WRONG:  SELECT COUNT(*) FROM stock WHERE item_name ILIKE '%printer%'
# #             CORRECT: SELECT SUM(qty) FROM stock WHERE item_name ILIKE '%printer%'
    
# #         Use COUNT(*) ONLY when the user explicitly asks for number of records, entries,
# #         transactions, orders, or rows — NOT when asking about physical product quantity.

# #         Image URL rules:
# #         If the user asks for any question related to product, and if there is an "image_url" column 
# #         available in the schema chunks for that product, include that column in the 
# #         SQL query to fetch the image URL along with whatever other details the user asked for.

# #         UNIVERSAL JOIN RULES:
# #         1. Join on PK-FK pairs shown in schema chunks.
# #         2. If explicit relations shown (A.col ↔ B.col), join on those columns.
# #         3. If no FK relation shown, join ONLY on same-named columns with clearly same meaning.

# #         DIALECT SPECIFIC RULES ({driver.upper()}):
# #         {selected_rules}

# #         1. Timestamp / Date Handling
# #         Use CURRENT_TIMESTAMP or NOW() for current time.
# #         Use CURRENT_DATE for today's date.
# #         Use DATE_TRUNC('day', column) to truncate timestamps.
# #         Use column::date to convert timestamp to date.
# #         Use column + INTERVAL '1 day' for date arithmetic.
# #         Use EXTRACT(YEAR FROM column_name), EXTRACT(MONTH FROM column_name) to extract month, year etc.
# #         NEVER use derived column names like "year", "month", "day" directly.
# #         ALWAYS compute them using EXTRACT() from a valid date/timestamp column.

# #         Write ONLY the raw {driver.upper()} SQL query starting with SELECT or WITH.
# #         """
# #         return prompt

# #     def get_error_fixing_prompt(self, driver: str) -> str:
# #         driver = driver.lower() if driver else "postgresql"
# #         display_name = {"mariadb": "MariaDB", "postgresql": "PostgreSQL", "mysql": "MySQL", "sqlite": "SQLite", "mssql": "MS SQL Server"}.get(driver, driver.upper())
# #         return f"""
# #         You are an expert {display_name} SQL query corrector.
# #         Inputs:
# #         1. User Question: {{user_question}}
# #         2. Database Schema: {{chunks_text}}
# #         3. Error Message: {{error}}
# #         4. Incorrect SQL Query: {{sql}}
        
# #         Rules:
# #             1. Timestamp / Date Handling
# #                 Use CURRENT_TIMESTAMP or NOW() for current time.
# #                 Use CURRENT_DATE for today's date.
# #                 Use DATE_TRUNC('day', column) to truncate timestamps.
# #                 Use column::date to convert timestamp to date.
# #                 Use column + INTERVAL '1 day' for date arithmetic.
# #                 Use EXTRACT(YEAR FROM column_name), EXTRACT(MONTH FROM column_name) to extract month, year etc
# #                 Do not use year = **** or month = **
# #             2. PostGIS / Spatial Error Handling
# #                 If the error mentions spatial signatures (like ST_Distance matching), ensure you cast columns with ::geography.
# #                 If generating a point, always ensure the SRID is set: ST_SetSRID(ST_Point(lon, lat), 4326).
# #                 Remember ST_Point takes longitude first, latitude second.
                
# #         Task:
# #         - Correct the query so that it runs successfully on the given {display_name} schema.
# #         - Make sure the query accurately answers the user question.
# #         - Output ONLY the raw SQL query. NO markdown fences. NO text. Start directly with SELECT.
# #         """

# #     def _get_history_string(self) -> str:
# #         history_texts = []
# #         for msg in self.last_conversation_history:
# #             if hasattr(msg, 'content'):
# #                 history_texts.append(msg.content)
# #             else:
# #                 history_texts.append(str(msg))
# #         return "\n\n".join(history_texts)

# #     # ============================================
# #     # ASYNC HELPER: LLM Call with Rate Limit Handling
# #     # ============================================
# #     async def _call_llm_with_retry(self, prompt: str, attempt=1, max_attempts=3, stream_to_ui: bool = False) -> str:
# #         # Old local imports preserved as comments for reference:
# #         # import re
# #         # from datetime import datetime, timedelta
# #         print(f"prompt here : {prompt}") 
# #         try:
# #             if stream_to_ui and self.stream_callback and hasattr(self.llm, "astream_text"):
# #                 parts = []
# #                 async for part in self.llm.astream_text(prompt):
# #                     parts.append(part)
# #                     try:
# #                         self.stream_callback(part)
# #                     except Exception:
# #                         pass
# #                 response = "".join(parts)
# #             else:
# #                 if asyncio.iscoroutinefunction(self.llm.invoke):
# #                     response = await self.llm.invoke(prompt)
# #                 else:
# #                     loop = asyncio.get_event_loop()
# #                     response = await loop.run_in_executor(None, self.llm.invoke, prompt)
            
# #             await self.api_key_service.update_api_key_status(
# #                 api_key=self.active_api_key,
# #                 param={"last_used_at": datetime.now()} 
# #             )
            
# #             if isinstance(response, str):
# #                 return response
# #             return response.content.strip()

# #         except Exception as e:
# #             error_str = str(e).lower()
            
# #             # 🛑 Handle Rate Limit & 413 Payload Errors
# #             if (
# #                 "request too large" in error_str
# #                 or "requested" in error_str and "tokens per minute" in error_str
# #                 or "request_too_large" in error_str
# #                 or "request entity too large" in error_str
# #                 or "413" in error_str
# #                 or "rate limit" in error_str 
# #                 or "429" in error_str 
# #                 or "please try again in" in error_str
# #             ) and attempt < max_attempts:
# #                 print(f"⚠️ Payload/Rate limit hit on attempt {attempt}. Attempting API key switch and prompt shrink...")
                
# #                 smaller_prompt = prompt[: max(1000, int(len(prompt) * 0.5))]
                
# #                 new_api_key, msg = await self.api_key_service.get_retry_api_key_logic(
# #                     api_key=self.active_api_key, error_detail=str(e)
# #                 )

# #                 if not new_api_key or attempt >= max_attempts:
# #                     wait_seconds = 60 
# #                     match = re.search(r"try again in ([\d\.]+)s", error_str)
# #                     if match:
# #                         wait_seconds = float(match.group(1))
                    
# #                     next_available = (datetime.now() + timedelta(seconds=wait_seconds)).strftime("%H:%M:%S")
                    
# #                     return (f"⚠️ **API Request Limited.**\n\n"
# #                             f"The data request was too large or all keys are limited. "
# #                             f"The system will be available again at **{next_available}**.")

# #                 self.active_api_key = new_api_key
# #                 self.llm = GroqLLM(api_key=new_api_key)
# #                 return await self._call_llm_with_retry(
# #                     smaller_prompt, attempt=attempt + 1, max_attempts=max_attempts, stream_to_ui=stream_to_ui
# #                 )
# #             else:
# #                 raise

# #     def _clean_relations(self, chunks_text: str) -> str:
# #         tables = set(re.findall(r"TABLE:\s*(\w+)", chunks_text, re.IGNORECASE))
# #         cleaned_blocks = []
# #         current_block = []
# #         in_relations = False
# #         seen_relations = set()
# #         for line in chunks_text.split("\n"):
# #             line_strip = line.strip()
# #             if line_strip.startswith("TABLE:"):
# #                 if current_block:
# #                     cleaned_blocks.append("\n".join(current_block))
# #                 current_block = [line]
# #                 in_relations = False
# #                 continue
# #             if line_strip.startswith("RELATIONS:"):
# #                 current_block.append(line)
# #                 in_relations = True
# #                 continue
# #             if in_relations and ("->" in line or "↔" in line):
# #                 matches = re.findall(r"(\w+)\.(\w+)", line)
# #                 if len(matches) >= 2:
# #                     (left_table, left_col), (right_table, right_col) = matches[0], matches[1]
# #                     if left_table in tables and right_table in tables:
# #                         relation_key = tuple(sorted([
# #                             f"{left_table}.{left_col}",
# #                             f"{right_table}.{right_col}"
# #                         ]))
# #                         if relation_key not in seen_relations:
# #                             seen_relations.add(relation_key)
# #                             current_block.append(line)
# #                 continue
# #             current_block.append(line)
# #         if current_block:
# #             cleaned_blocks.append("\n".join(current_block))
# #         return "\n\n".join(cleaned_blocks)

# #     def _hybrid_retrieve(self, question: str) -> str:
# #         v_store = getattr(self, 'vectorstore', None)

# #         if v_store is None:
# #             return "Error: Vectorstore is not initialized."

# #         sem_docs = v_store.as_retriever(search_kwargs={"k": 50}).invoke(question)
# #         candidates = {d.metadata.get("table", "unknown"): d for d in sem_docs}.values()

# #         q = question.lower()
# #         scored = []
        
# #         keyword_map = {
# #             "gps_tracking": ["current location", "where will", "closer than", "minimum approach", "coordinate", "history", "tracking"],
# #             "navigation": ["speed", "heading", "pitch", "roll", "predict", "trajectory", "instability", "unstable", "struggling"],
# #             "engine": ["thruster", "efficiency", "engine", "engine_effort", "effort"],
# #             "waypoints": ["waypoint", "route", "path", "status", "docking", "mission"],
# #             "dark_vessel_alerts": ["dark vessel", "danger", "alert", "threat", "historical dark vessel"],
# #             "ais_data": ["ship", "ships", "vessel", "intercept"],
# #             "india_west_places": ["city", "town", "village", "island", "density", "zone"],
# #             "india_west_transport": ["airport", "railway", "ferry", "station", "port", "buffer", "approach", "infrastructure"],
# #             "india_west_natural": ["beach", "reef", "coast", "sanctuary", "rocky", "shallows", "restricted"]
# #         }

# #         for doc in candidates:
# #             table = doc.metadata.get("table", "").lower()
# #             content = doc.page_content.lower()

# #             score = 0
# #             column_hits = 0
# #             columns = [col.strip() for col in content.split(",") if col.strip()]

# #             for col in columns:
# #                 ratio = fuzz.partial_ratio(col, q)
# #                 if ratio > 85:
# #                     score += 3
# #                     column_hits += 1
# #                 elif ratio > 70:
# #                     score += 2
# #                     column_hits += 1

# #             table_ratio = fuzz.partial_ratio(table, q)
# #             if table_ratio > 85: score += 3
# #             elif table_ratio > 70: score += 2

# #             if column_hits > 0 and table_ratio > 70: score += 2
                
# #             for t_name, keywords in keyword_map.items():
# #                 if table == t_name and any(k in q for k in keywords):
# #                     score += 15 

# #             scored.append((score, doc))

# #         scored.sort(reverse=True, key=lambda x: x[0])
# #         if not scored: return ""
# #         top_score = scored[0][0]

# #         final_docs = [doc for score, doc in scored if score >= max(2, top_score * 0.3)]

# #         if len(final_docs) < 5 and len(scored) >= 5:
# #             final_docs = [doc for _, doc in scored[:5]]
# #         elif not final_docs:
# #             final_docs = [doc for _, doc in scored[:3]]

# #         return "\n\n".join(d.page_content for d in final_docs)

# #     async def _verify_query(self, sql: str, state: dict, target_db_url: str = None):
# #         session_id = state.get("session_id")
# #         message_id = state.get("message_id")
# #         user_id = state.get("user_id")
# #         db_url = target_db_url or state.get("target_db_url")
# #         self.results = []
# #         error_msg = None
# #         csv_path_str = None
# #         try:
# #             if db_url:
# #                 rows = await self.db_repo.generate_sql_query_result(sql)
# #                 self.results = rows
# #             else:
# #                 error_msg = "No target database URL found. Please star a database."
# #         except Exception as e:
# #             print(f"❌ Error in _verify_query: {e}")
# #             self.results = []
# #             error_msg = str(e)

# #         return "successfully" if not error_msg else f"Error: {error_msg}"

# #     # ══════════════════════════════════════════════════════════════════════════
# #     #  LANGGRAPH NODES
# #     # ══════════════════════════════════════════════════════════════════════════
# #     async def _classify_intent(self, state: AgentStateScehma) -> dict:
# #         question = state["user_question"]
# #         # active_db = state.get("active_dashboard", "None")
# #         conversation = self._get_history_string()
# #         chunks = self._hybrid_retrieve(question)
# #         prompt = self.CONVERSATIONPROMPT.format(
            
# #             conversation=conversation,
# #             question=question,
# #             chunks=chunks
# #         )
# #         intent = await self._call_llm_with_retry(prompt)
        
# #         intent = self._robust_extract_output(intent)
# #         print("\n\n", intent, "\n\n")
# #         for valid_intent in [
# #             "ACCESS_DASHBOARD", "GENERATE_REPORT", "FETCH_CHART", "DB_QUERY",
# #             "FOLLOW_UP_SQL", "CHAT",  "CREATE_CHART",
# #             "ANALYSIS", "ANALYTICS", "MANUFACTURING", "GUIDED","ANALYZE_CHART"
# #         ]:
        
# #             if valid_intent in intent.upper():
# #                 intent = valid_intent
# #                 break
# #         print(intent, "INTENT AFTER CLEANING")
# #         return {
# #             "intent": intent,
# #             "user_question": (
# #                 state["messages"][-1].content
# #                 if hasattr(state["messages"][-1], 'content')
# #                 else str(state["messages"][-1])
# #             )
# #         }

# #     # def _route_intent(self, state: AgentStateScehma) -> str:
# #     #     q_raw = str(state.get("user_question", "")).lower().strip()
# #     #     q = q_raw.strip('"\'') 
# #     #     intent = str(state.get("intent", "")).upper()
        
# #     #     # # 🚀 ADVANCED ROUTING FIX: Catch anomalies, predictions, and routing
# #     #     # sql_keywords = [
# #     #     #     "distance", "disttnace", "dist", "check", "generate a route", 
# #     #     #     "predict", "instability", "safe bypass", "where will", "anomaly",
# #     #     #     "dark vessel", "fences", "restricted area", "buffer", "engine effort"
# #     #     # ]
# #     #     # coord_pattern = r'(\d+\.?\d*)\s*,\s*(\d+\.?\d*)'
        
# #     #     # if len(re.findall(coord_pattern, q)) >= 2 or any(word in q for word in sql_keywords):
# #     #     #     return "schema"

# #     #     # 🏭 MANUFACTURING intent routing
# #     #     if "MANUFACTURING" in intent or any(kw in q for kw in ["manufacture", "assemble", "build", "ebm", "meglan"]):
# #     #         return "manufacturing"

# #     #     # 🧭 GUIDED intent routing
# #     #     if "GUIDED" in intent:
# #     #         return "guided"
            
# #     #     # if "dashboard" in q or "ACCESS_DASHBOARD" in intent:
# #     #     #     return "access_dashboard"
            
# #     #     if q.startswith("chart[") or "viz:" in q or q.startswith("- metric:"):
# #     #         clean_name = re.sub(r'(?i)^chart\[\d+\]:\s*', '', state["user_question"])
# #     #         clean_name = re.sub(r'(?i)- metric:\s*', '', clean_name)
# #     #         clean_name = re.sub(r'(?i)\s*\(id:.*', '', clean_name)
# #     #         clean_name = re.sub(r'(?i)\s*\(viz:.*', '', clean_name)
# #     #         state["user_question"] = clean_name.strip()
# #     #         return "fetch_chart"

# #     #     if "REPORT" in intent or "2" in intent:  return "report_gen"
        
# #     #     if "CREATE" in intent or "8" in intent or any(kw in q for kw in ["chart", "graph", "plot", "viz"]):  
# #     #         return "create_chart"

# #     #     words = q.split()
# #     #     if "QUERY" in intent or "4" in intent or any(w in words for w in ["count", "list", "show", "retrieve", "get"]):  
# #     #         return "schema"

# #     #     if "FETCH"  in intent or "3" in intent:  return "fetch_chart"
# #     #     if "FOLLOW" in intent or "5" in intent:  return "followup"
        
# #     #     return "chat"


# #     def _route_intent(self, state: AgentStateScehma) -> str:
# #         q_raw = self._normalize_product_names(str(state.get("user_question", "")))
# #         q = q_raw.lower().strip().strip('"\'')
# #         intent = str(state.get("intent", "")).upper()
        
# #         # 🚀 MARITIME ROUTING — DISABLED
# #         # sql_keywords = [
# #         #     "distance", "disttnace", "dist", "check", "generate a route", 
# #         #     "predict", "instability", "safe bypass", "where will", "anomaly",
# #         #     "dark vessel", "fences", "restricted area", "buffer", "engine effort"
# #         # ]
# #         # coord_pattern = r'(\d+\.?\d*)\s*,\s*(\d+\.?\d*)'
# #         # if len(re.findall(coord_pattern, q)) >= 2 or any(word in q for word in sql_keywords):
# #         #     return "schema"

# #         # 🏭 MANUFACTURING intent routing
# #         manufacturing_verbs = [
# #             "manufacture", "manufacturing", "build", "assemble",
# #             "produce", "make", "create"
# #         ]
# #         manufacturing_products = [
# #             "meglan", "meg lan", "meg-lan",
# #             "ebm 20", "ebm20", "ebm-20",
# #             "ebm 40", "ebm40", "ebm-40"
# #         ]
# #         has_manufacturing_action = any(verb in q for verb in manufacturing_verbs)
# #         order_pattern = r'\border\b.*\b(meglan|ebm[\s-]*20|ebm[\s-]*40)\b'
# #         has_order_action = bool(re.search(order_pattern, q))
# #         has_product_reference = any(prod in q for prod in manufacturing_products)

# #         if "MANUFACTURING" in intent or ((has_manufacturing_action or has_order_action) and has_product_reference):
# #             return "manufacturing"

# #         # 🧭 GUIDED intent routing
# #         if "GUIDED" in intent:
# #             return "guided"
            
# #         # DASHBOARD ROUTING — DISABLED
# #         # if "dashboard" in q or "ACCESS_DASHBOARD" in intent:
# #         #     return "access_dashboard"
            
# #         if q.startswith("chart[") or "viz:" in q or q.startswith("- metric:"):
# #             clean_name = re.sub(r'(?i)^chart\[\d+\]:\s*', '', state["user_question"])
# #             clean_name = re.sub(r'(?i)- metric:\s*', '', clean_name)
# #             clean_name = re.sub(r'(?i)\s*\(id:.*', '', clean_name)
# #             clean_name = re.sub(r'(?i)\s*\(viz:.*', '', clean_name)
# #             state["user_question"] = clean_name.strip()
# #             return "fetch_chart"

# #         # if "REPORT" in intent or "2" in intent: return "report_gen"
        
# #         if "CREATE" in intent or "8" in intent or any(kw in q for kw in ["chart", "graph", "plot", "viz"]):  
# #             return "create_chart"

# #         words = q.split()
# #         if "ANALYSIS" in intent or "ANALYTICS" in intent or any(kw in q for kw in ["restock", "season", "quarter", "expire", "expiring", "trend"]):
# #             return "analysis_plan"
        
# #         if "DB_QUERY" in intent or "4" in intent or any(w in words for w in ["count", "list", "show", "retrieve", "get"]):  
# #             return "schema"

# #         # if "FETCH"  in intent or "3" in intent: return "fetch_chart"
# #         if "FOLLOW" in intent or "5" in intent: return "followup"
# #         # if "ANALYZE" in intent or "7" in intent: return "analyze_chart"
        
# #         return "chat"

# #     async def _manufacturing_node(self, state: AgentStateScehma):
    
# #         BOM_REQUIREMENTS = {
# #         "Meglan": {
# #             "Sensors": 2,
# #             "Computing": 1,
# #             "Propulsion": 1,
# #             "Hull": 5,
# #             "Fasteners": 2,
# #             "Cabling": 3,
# #             "Communication": 1
# #         },
    
# #         "EBM 20": {
# #             "Motor": 1,
# #             "Battery": 4,
# #             "Controller": 1,
# #             "Harness": 1,
# #             "Cooling": 1
# #         },
    
# #         "EBM 40": {
# #             "Motor": 1,
# #             "Battery": 1,
# #             "Controller": 1,
# #             "Cooling": 1,
# #             "Propulsion": 1
# #         }
# #         }
    
# #         question = state["user_question"]
    
# #         prompt = f"""
# #         Extract manufacturing request.
    
# #         Extract project name (as per the name given below) and quantity
# #         If the user mentions single meglan, double ebm, a meglan...... return the numbers
# #         single -> 1
# #         double -> 2
# #         a -> 1
# #         an -> 1
    
# #         USER QUESTION:
# #         {question}
    
# #         Available projects:
# #         - Meglan (a boat)
# #         - EBM 20 (a motor)
# #         - EBM 40 (a motor)
    
# #         Return ONLY JSON:
    
# #         {{
# #             "project": "<product_name>",
# #             "quantity": 0
# #         }}
    
# #         If the project is not in the available list (ignoring case), return
# #         {{
# #             "project": "UNKNOWN",
# #             "message": "the requested project(or item or product) "<product_name>" is not available, the only available projects are Meglan, EBM 20, and EBM 40"
# #         }}
    
# #         if quantity is not specified (not even in wordings like "one", "two", "a", "an", "single"), return
# #         {{
# #             "project": "<product_name>",
# #             "quantity": "null"
# #         }}
    
# #         IMPORTANT: If the user requests MULTIPLE projects, return a JSON array of objects instead:
# #         [
# #             {{"project": "<product_name_1>", "quantity": <qty_1>}},
# #             {{"project": "<product_name_2>", "quantity": <qty_2>}}
# #         ]
# #         Each object in the array follows the same rules above (UNKNOWN project, null quantity, etc.)
# #         """
    
# #         raw = await self._call_llm_with_retry(prompt)
    
# #         raw = re.sub(r'^```json\s*', '', raw)
# #         raw = re.sub(r'^```\s*', '', raw)
# #         raw = re.sub(r'\n?```$', '', raw).strip()
    
# #         data = json.loads(raw)
    
# #         print("\n\n", raw, "\n")
    
# #         # ── NEW: normalise to a list so single & multi follow the same path ──
# #         if isinstance(data, dict):
# #             items = [data]
# #         else:
# #             items = data          # already a list for multi-project requests
    
# #         all_responses = []
# #         flag = False
    
# #         for data in items:
# #             # try:
# #             print("111111111111111111111")
# #             # ── existing UNKNOWN-project handling ──────────────────────────────
# #             if data["project"].lower() == "unknown":
# #                 all_responses.append(data["message"])
# #                 continue
    
# #             project = data["project"]
# #             qty     = data["quantity"]
    
# #             if project not in BOM_REQUIREMENTS:
# #                 all_responses.append(f"Unknown project: {project}")
# #                 continue
    
# #             bom = BOM_REQUIREMENTS[project]
    
# #             results   = []
# #             shortages = []
# #             remaining = []
    
# #             # ── existing qty == 'null' branch ──────────────────────────────────
# #             print(f"\n\n before if qty null, qty: {qty} \n")
# #             if qty == 'null' or qty == 0:
# #                 possible_units = []
# #                 print("\n\n inside if qty null")
# #                 for category, required in bom.items():
    
# #                     sql = f"""
# #                     SELECT COALESCE(SUM(quantity),0)
# #                     FROM procurement_table
# #                     WHERE part_name ILIKE '%{category}%' AND assigned_to IS NULL
# #                     """
    
# #                     # available = db.run(sql)
# #                     available = await self.db_repo.fetch_scalar(sql)

    
# #                     available = int(
# #                         re.findall(r'\d+', str(available))[0]
# #                     )
# #                     print("\n\n available", available, "required", required, "\n")
# #                     possible_units.append(
# #                         available // required
# #                     )
    
# #                 max_units = min(possible_units)
    
# #                 if max_units == 0:
# #                     response = f"You cannot manufacture any {project}. Insufficient materials:\n"
# #                     for category, required in bom.items():
# #                         sql = f"""
# #                         SELECT COALESCE(SUM(quantity),0)
# #                         FROM procurement_table
# #                         WHERE part_name ILIKE '%{category}%'
# #                         AND assigned_to IS NULL
# #                         """
# #                         # available = db.run(sql)
# #                         available = await self.db_repo.fetch_scalar(sql)
# #                         available = int(re.findall(r'\d+', str(available))[0])
# #                         if available < required:  # ── NEW: only show insufficient ones
# #                             response += f"- {category}: required {required}, available {available}\n"
# #                     all_responses.append(response)
# #                 else:
# #                     all_responses.append(
# #                         f"You can manufacture {max_units} {project} successfully"
# #                     )
# #                     print("\n\n max_units", max_units, "\n")
# #                 print(f"items {items} and data is {data}")
# #                 continue
    
# #             # ── existing qty-specified branch ──────────────────────────────────
# #             qty = int(qty)
# #             for category, required_per_unit in bom.items():
    
# #                 needed = required_per_unit * qty
    
# #                 sql = f'''
# #                 SELECT COALESCE(SUM(quantity),0)
# #                 FROM procurement_table
# #                 WHERE part_name ILIKE '%{category}%' and assigned_to IS NULL
# #                 '''
    
# #                 available = await self.db_repo.fetch_scalar(sql)
    
# #                 try:
# #                     available = int(re.findall(r'\d+', str(available))[0])
# #                 except:
# #                     available = 0
    
# #                 balance = available - needed
    
# #                 results.append({
# #                     "category": category,
# #                     "needed":   needed,
# #                     "available": available,
# #                     "balance":   balance
# #                 })
    
# #                 if balance < 0:
# #                     shortages.append(f"{category}: need {abs(balance)} more")
# #                 else:
# #                     remaining.append(f"{category}: {balance} remaining")
# #                 print(f"inside the for loop here {results}")
    
# #             # ── existing Final response block ──────────────────────────────────
# #             flag = False
# #             print("checking the flag here",flag)
# #             if shortages:
# #                 print(f"if shortages")
# #                 flag = True
# #                 response = f"Manufacturing requirement check for {qty} {project}\nSome materials are insufficient."
# #                 for r in results:
# #                     response += (
# #                         f"\n- {r['category']} "
# #                         f"(purchase: {r['needed']}, "
# #                         f"Available: {r['available']})"
# #                     )
# #                 response += "\n\nShortages:\n"
    
# #                 for s in shortages:
# #                     response += f"- {s}\n"
    
# #             else:
# #                 print(f"else shortages")
# #                 if qty == 0:
# #                     print(f"elif shortages")
# #                     response = f"You cannot manufacture any {project}. Insufficient materials:\n"
# #                     for r in results:
# #                         print(f"elif for shortages")
# #                         if r['available'] < bom[r['category']]:  # ── NEW: only show insufficient ones
# #                             response += f"- {r['category']}: required {bom[r['category']]}, available {r['available']}\n"
# #                 else:
# #                     print(f"else else shortages")
# #                     response = f"You can manufacture {qty} {project} successfully.\nRemaining inventory after manufacturing:"
# #                     for r in results:
# #                         response += (
# #                             f"\n- {r['category']}: "
# #                             f"{r['balance']} remaining"
# #                         )
    
# #             all_responses.append(response)

# #             # except Exception as e:
# #             #     print(f"Outside for loop",e)

        
# #         final_response = "\n\n---\n\n".join(all_responses)
        
# #         data = {
# #             "flag": flag,
# #             "status": "REPORT"
# #         }
# #         print(data, "final data here")
# #         print(final_response, "all responses here")
        
        
# #         return {
# #             "messages": [AIMessage(content=final_response)],
# #             "flag": flag,
# #             "status": "REPORT"
# #         }
# #         # except Exception as e:
# #         #     print(f"Exception here is {e}")
    
 

# #     # ── GUIDED ────────────────────────────────────────────────────────────────
# #     async def _guided_node(self, state: AgentStateScehma) -> dict:
# #         """
# #         Handle vague or out-of-domain questions by guiding the user toward
# #         valid, database-answerable questions — without hallucinating any results.
# #         Uses the actual schema chunks to derive real, working example questions.
# #         """
# #         conversation = self._get_history_string()
# #         chunks = self._hybrid_retrieve(state["user_question"])

# #         prompt = f"""
# # You are STAR-AI, a professional database assistant.

# # DATABASE SCHEMA:
# # {chunks}

# # PREVIOUS CONVERSATION:
# # {conversation}

# # USER QUESTION:
# # {state["user_question"]}

# # YOUR JOB:
# # The user's question is vague, incomplete, ambiguous, or uses words that do not clearly map to the database schema.
# # Do NOT guess. Do NOT fabricate any tables, columns, values, or business facts.

# # Your task is to guide the user toward a clear database question by doing the following:

# # 1) Briefly acknowledge that the question is unclear.
# # 2) Infer the user's likely intent from the wording of their question.
# # 3) Give 4–5 example questions that are directly related to that intent and can be answered from the schema.
# # 4) Make the examples sound like natural clarifying options, starting with phrases like:
# # - Do you mean...
# # - Would you like me to...
# # - Are you asking to...
# # - Should I show...
# # 5) End by asking the user to pick one or rephrase their question.

# # VERY IMPORTANT RULES:
# # - Use ONLY real table names and real column names from the schema.
# # - Do NOT invent values such as names, departments, vendors, dates, products, categories, or locations.
# # - If you need a placeholder, use neutral wording like:
# #   "specific table", "particular vendor", "given date range", "certain department", "a selected record".
# # - Keep the examples tightly related to the user's wording.
# # - Do NOT mention SQL, prompts, internal logic, or technical implementation.
# # - Keep the tone polite, short, and helpful.

# # OUTPUT FORMAT:
# # A short opening sentence, then a line exactly:
# # Here are some things you can ask me:
# # Then 4-5 bullet points of example questions, then one closing sentence asking the user to rephrase or pick one.
# # """

# #         response = await self._call_llm_with_retry(prompt)
# #         return {
# #             "messages": [AIMessage(content=response)],
# #             "status": "REPORT"
# #         }

# #     # ── ACCESS DASHBOARD ───────────────────────────────────────────────────────
# #     async def _access_dashboard_node(self, state: AgentStateScehma) -> dict:
# #         q = state["user_question"] 
# #         db_master_name = self.db_display_name
# #         base_host = self.superset_service.host if self.superset_service else "starai.local:8088"
# #         dashboard_name = "System"
# #         target_id = "1"
        
# #         if self.superset_service:
# #             loop = asyncio.get_running_loop()
# #             matched_db = await loop.run_in_executor(
# #                 None, self.superset_service.find_best_dashboard_match, db_master_name
# #             )
            
# #             if matched_db:
# #                 dashboard_name = matched_db["title"]
                
# #                 if dashboard_name.strip().lower() != db_master_name.strip().lower():
# #                     msg = f"⚠️ Dashboard linking failed: The connected database display name '{db_master_name}' must exactly match the Superset dashboard name."
# #                     return {"messages": [AIMessage(content=msg)], "status": "ERROR"}

# #                 target_id = str(matched_db.get("id"))
# #                 url = f"http://{base_host}/superset/dashboard/{target_id}/?standalone=2"
                
# #                 try:
# #                     chart_summary = await loop.run_in_executor(
# #                         None, self.superset_service.get_dashboard_summary, dashboard_name
# #                     )
# #                     chart_info = f"\n\n**Detected Charts & Metrics:**\n{chart_summary}"
# #                 except Exception:
# #                     chart_info = ""
                    
# #                 msg = (
# #                     f"✅ **{dashboard_name} Dashboard Linked.**\n"
# #                     f"I have synchronized the data stream for your primary database '{db_master_name}'.{chart_info}\n\n"
# #                     f"You can now generate reports or request specific graphs."
# #                 )
# #                 return {
# #                     "messages": [AIMessage(content=msg)],
# #                     "status": "DASHBOARD_LOADED",
# #                     "active_dashboard": dashboard_name,
# #                     "dashboard_url": url,
# #                     "session_cookie": self.superset_service.get_session_cookie()
# #                 }
# #             else:
# #                 msg = f"⚠️ I could not find a matching dashboard in Superset for your database '{db_master_name}'."
# #                 return {"messages": [AIMessage(content=msg)], "status": "ERROR"}

# #         return {"messages": [AIMessage(content="Superset service not connected.")], "status": "ERROR"}

# #     # ── REPORT GEN ─────────────────────────────────────────────────────────────
# #     async def _report_gen_node(self, state: AgentStateScehma) -> dict:
# #         q = state["user_question"].lower()
# #         db_name = state.get("active_dashboard")
        
# #         if not db_name and self.superset_service:
# #             loop = asyncio.get_running_loop()
# #             matched_db = await loop.run_in_executor(None, self.superset_service.find_best_dashboard_match, q)
# #             if matched_db: db_name = matched_db["title"]
            
# #         if not db_name:
# #             db_name = "System"
            
# #         dashboard_context = ""
# #         base_host = self.superset_service.host if self.superset_service else "starai.local:8088"
# #         url = f"http://{base_host}/superset/dashboard/{db_name.lower()}/"
# #         if "standalone=2" not in url:
# #             url += ("?" if "?" not in url else "&") + "standalone=2"
            
# #         if self.superset_service:
# #             try:
# #                 loop = asyncio.get_running_loop()
# #                 chart_data = await loop.run_in_executor(
# #                     None, self.superset_service.get_dashboard_summary, db_name
# #                 )
# #                 dashboard_context = f"\nLive Superset Data Context:\n{chart_data}"
# #                 id_match = re.search(r"\(ID:\s*(\d+)\)", chart_data)
# #                 if id_match:
# #                     dash_id = id_match.group(1)
# #                     url = f"http://{base_host}/superset/dashboard/{dash_id}/"
# #                     if "standalone=2" not in url:
# #                         url += ("?" if "?" not in url else "&") + "standalone=2"
# #             except Exception as e:
# #                 pass
# #         report_prompt = self.DASHBOARD_REPORT_PROMPT.format(
# #             db_name=db_name,
# #             dashboard_context=dashboard_context,
# #             user_question=state['user_question']
# #         )
# #         res = await self._call_llm_with_retry(report_prompt)
# #         return {
# #             "status": "REPORT",
# #             "messages": [AIMessage(content=res)],
# #             "dashboard_url": url,
# #             "session_cookie": self.superset_service.get_session_cookie()
# #         }

# #     # ── FETCH CHART ────────────────────────────────────────────────────────────
# #     async def _fetch_chart_node(self, state: AgentStateScehma) -> dict:
# #         q = state["user_question"].lower()
# #         db_name = state.get("active_dashboard")
# #         if not db_name:
# #             for msg in reversed(self.last_conversation_history):
# #                 content = msg.content if hasattr(msg, 'content') else str(msg)
# #                 match = re.search(r"✅ \*\*(.*?)\s+Dashboard Linked", content, re.IGNORECASE)
# #                 if match:
# #                     db_name = match.group(1).strip()
# #                     break
                    
# #         if not db_name and self.superset_service:
# #             loop = asyncio.get_running_loop()
# #             matched_db = await loop.run_in_executor(None, self.superset_service.find_best_dashboard_match, q)
# #             if matched_db: db_name = matched_db["title"]

# #         if not db_name:
# #             msg = "⚠️ Please access a dashboard first (e.g., 'Access Meglan')."
# #             return {"messages": [AIMessage(content=msg)], "status": "ERROR"}
            
# #         if self.superset_service:
# #             try:
# #                 current_date_str = datetime.now().strftime('%Y-%m-%d')
# #                 filter_prompt = self.FILTER_EXTRACTION_PROMPT.format(
# #                     user_question=state['user_question'],
# #                     current_date_str=current_date_str
# #                 )
# #                 filter_res = await self._call_llm_with_retry(filter_prompt)
# #                 extra_filters = []
# #                 try:
# #                     clean_res = re.sub(r'```json\s*|\s*```|`', '', filter_res).strip()
# #                     arr_match = re.search(r'\[.*?\]', clean_res, re.DOTALL)
# #                     if arr_match:
# #                         raw_filters = json.loads(arr_match.group())
# #                         for f in raw_filters:
# #                             clean_key = f.get("col", "").lower().strip().replace(" ", "_")
# #                             op = f.get("op", "==")
# #                             val = str(f.get("val", ""))
# #                             extra_filters.append({"col": clean_key, "op": op, "val": val})
# #                 except Exception as e:
# #                     print(f"⚠️ Filter extraction failed: {e}")
# #                 loop = asyncio.get_running_loop()
# #                 chart_details = await loop.run_in_executor(
# #                     None, self.superset_service.get_chart_details, db_name,
# #                     state["user_question"], extra_filters
# #                 )
# #                 if "error" in chart_details:
# #                     return {
# #                         "messages": [AIMessage(content=f"⚠️ {chart_details['error']}")],
# #                         "status": "ERROR"
# #                     }
# #                 print(f"🎯 Fetching Live Embed AND Native Raw Data for '{chart_details['name']}'...")
# #                 raw_data = await loop.run_in_executor(
# #                     None, self.superset_service.get_chart_raw_data,
# #                     chart_details["id"], extra_filters
# #                 )
# #                 filter_msg = " (Filtered by AI)" if extra_filters else ""
# #                 if raw_data:
# #                     msg = f"✅ Extracted live view & raw data for **{chart_details['name']}**{filter_msg}."
# #                 else:
# #                     msg = (
# #                         f"✅ Loading live metric: **{chart_details['name']}**{filter_msg}...\n"
# #                         f"*(No raw data rows matched your filters)*"
# #                     )
# #                     print("⚠️ Raw data extraction yielded no rows, falling back to Live View only.")
# #                 filter_str = json.dumps(extra_filters) if extra_filters else "[]"
# #                 msg += f"\n*(Chart ID: {chart_details.get('id')} | Filters: {filter_str})*"
# #                 c_url = chart_details.get("url")
# #                 if "standalone=2" not in c_url:
# #                     c_url += ("?" if "?" not in c_url else "&") + "standalone=2"
# #                 return {
# #                     "messages": [AIMessage(content=msg)],
# #                     "status": "CHART_LOADED",
# #                     "id": chart_details.get("id"),
# #                     "chart_url": c_url,
# #                     "download_url": chart_details.get("download_url"),
# #                     "result": raw_data if raw_data else [],
# #                     "chart_name": chart_details["name"],
# #                     "session_cookie": chart_details.get("session_cookie"),
# #                     "active_chart_id": chart_details.get("id"),
# #                     "active_chart_name": chart_details["name"]
# #                 }
# #             except Exception as e:
# #                 print(f"⚠️ Superset Node Error: {e}")
# #                 return {"messages": [AIMessage(content=f"Error: {e}")], "status": "ERROR"}
# #         return {
# #             "messages": [AIMessage(content="Superset service not connected.")],
# #             "status": "ERROR"
# #         }

# #     # ── CREATE CHART ──────────────────────────────────────────────────────────
# #     async def _create_chart_node(self, state: AgentStateScehma) -> dict:
# #         # Old local imports preserved as comments for reference:
# #         # import decimal
# #         # import json
# #         # import os
# #         # import asyncio
# #         # import pandas as pd
# #         # import numpy as np
# #         # import plotly.graph_objects as go
# #         # import plotly.io as pio
# #         # from datetime import datetime, date
# #         # import uuid
# #         # from langchain_core.messages import AIMessage
# #         q = state["user_question"]
# #         loop = asyncio.get_running_loop()

# #         if not self.target_db_url:
# #             return {"messages": [AIMessage(content="⚠️ No database connected.")], "status": "ERROR"}

# #         schema_path = state.get("schema_path")
# #         chunks_text = state.get("chunks_text", "")
        
# #         if not chunks_text and schema_path and os.path.exists(schema_path):
# #             with open(schema_path, "r", encoding="utf-8") as f: 
# #                 chunks_text = f.read()

# #         try:
# #             sql_prompt = self.get_system_prompt_for_db(self.db_drive).format(
# #                 chunks_text=chunks_text, question=q
# #             )
# #         except AttributeError:
# #             sql_prompt = f"SYSTEM: You are a SQL Expert. Output ONLY raw SQL for: '{q}'. Schema:\n{chunks_text}"

# #         raw_sql = await self._call_llm_with_retry(sql_prompt)
# #         sql_query = self._extract_sql(raw_sql)

# #         if not sql_query.lower().strip().startswith(("select", "with")):
# #             return {"messages": [AIMessage(content="⚠️ Failed to generate a valid SQL query.")], "status": "ERROR"}

# #         chart_data = []
# #         try:
# #             rows = await self.db_repo.generate_sql_query_result(sql=sql_query)
# #             keys = list(rows[0].keys()) if rows else []

# #             for row in rows:
# #                 new_row = {}
# #                 for key_name, val in row.items():
# #                     if isinstance(val, decimal.Decimal):
# #                         new_row[key_name] = float(val)
# #                     elif isinstance(val, (datetime, date)):
# #                         new_row[key_name] = val.isoformat()
# #                     elif isinstance(val, uuid.UUID):
# #                         new_row[key_name] = str(val)
# #                     else: new_row[key_name] = val
# #                 chart_data.append(new_row)
            
# #         except Exception as e:
# #             return {"messages": [AIMessage(content=f"⚠️ SQL execution error: {e}\n\nHint: Check if column names like 'Category' need capitalization.")], "status": "ERROR"}

# #         if not chart_data:
# #             return {"messages": [AIMessage(content="⚠️ No data returned for the chart.")], "status": "ERROR"}

# #         df = pd.DataFrame(chart_data)
# #         df.columns = [str(c).strip() for c in df.columns]
# #         columns = list(df.columns)
        
# #         for col in columns:
# #             try:
# #                 converted = pd.to_numeric(df[col], errors='coerce')
# #                 if converted.notna().any(): 
# #                     df[col] = converted
# #             except Exception: 
# #                 pass
                
# #         numeric_cols = df.select_dtypes(include='number').columns.tolist()
# #         data_sample = df.head(3).to_dict(orient="records")

# #         config_prompt = f"""
# # SYSTEM: You are a Data Visualization Configuration Expert.
# # USER QUESTION: '{q}'
# # AVAILABLE COLUMNS: {columns}
# # NUMERIC COLUMNS: {numeric_cols}
# # DATA SAMPLE: {data_sample}

# # TASK: Generate a valid JSON configuration.
# # RULES:
# # 1. "chart_type": "line", "bar", "pie", or "scatter". 
# # 2. "x_col": primary category (must EXACTLY MATCH one of {columns}, preserving case).
# # 3. "y_cols": LIST of numeric columns to plot (must EXACTLY MATCH from {numeric_cols}).
# # 4. "color_col": categorical column to group/color the data by (optional, empty string if none).
# # 5. "sort": "desc", "asc", or "none".
# # 6. "limit": integer for Top N (e.g., 10), or 0 for all.
# # 7. "title": Short descriptive title.

# # Output ONLY valid JSON. No markdown tags.
# # """
# #         raw_config = await self._call_llm_with_retry(config_prompt)
# #         config_str = self._robust_extract_output(raw_config)

# #         try: 
# #             config = json.loads(config_str)
# #         except Exception: 
# #             config = {}

# #         chart_type = config.get("chart_type", "line").lower()
# #         x_col_raw = str(config.get("x_col", columns[0])).strip()
# #         y_cols_raw = config.get("y_cols", [numeric_cols[0]] if numeric_cols else [columns[-1]])
# #         color_col_raw = str(config.get("color_col", "")).strip()
# #         sort_order = config.get("sort", "none").lower()
# #         limit = int(config.get("limit", 0))
# #         title = config.get("title", f"Chart Analysis")

# #         def correct_case(col_name, valid_cols):
# #             for c in valid_cols:
# #                 if c.lower() == col_name.lower(): return c
# #             return col_name

# #         x_col = correct_case(x_col_raw, columns)
# #         y_cols = [correct_case(y, columns) for y in y_cols_raw]
# #         color_col = correct_case(color_col_raw, columns) if color_col_raw else ""

# #         x_data_clean = []
# #         if x_col in df.columns:
# #             for val in df[x_col].tolist():
# #                 try:
# #                     if isinstance(val, (int, float)) and val > 10000000000:
# #                         x_data_clean.append(pd.to_datetime(val, unit='ms').strftime('%Y-%m-%d %H:%M:%S'))
# #                     elif isinstance(val, (int, float)) and val > 100000000:
# #                         x_data_clean.append(pd.to_datetime(val, unit='s').strftime('%Y-%m-%d %H:%M:%S'))
# #                     elif pd.notna(val):
# #                         x_data_clean.append(str(val))
# #                     else:
# #                         x_data_clean.append(None)
# #                 except Exception:
# #                     x_data_clean.append(str(val))
            
# #             df['clean_x'] = x_data_clean

# #             if any(t in x_col.lower() for t in ['time', 'date', 'created', 'timestamp']):
# #                 df['temp_time'] = pd.to_datetime(df['clean_x'], errors='coerce')
# #                 df = df.dropna(subset=['temp_time']).sort_values(by='temp_time', ascending=True).drop(columns=['temp_time'])
# #                 sort_order = "none" 
# #         else:
# #             df['clean_x'] = [str(i) for i in range(len(df))]
            
# #         if sort_order == "desc" and y_cols and y_cols[0] in df.columns: 
# #             df = df.sort_values(by=y_cols[0], ascending=False)
# #         elif sort_order == "asc" and y_cols and y_cols[0] in df.columns:
# #             df = df.sort_values(by=y_cols[0], ascending=True)

# #         if limit > 0: df = df.head(limit)

# #         if df.empty:
# #             return {"messages": [AIMessage(content="⚠️ Chart generation failed: All data was filtered out or invalid.")], "status": "ERROR"}
        
# #         df = df.replace([np.inf, -np.inf], np.nan).where(pd.notnull(df), None)

# #         def sanitize_for_json(v):
# #             if v is None or (isinstance(v, float) and np.isnan(v)): return None
# #             if isinstance(v, (np.integer, int)): return int(v)
# #             if isinstance(v, (np.floating, float)): return float(v)
# #             if isinstance(v, (datetime, date)): return v.isoformat()
# #             if hasattr(v, '__str__'):
# #                 try: return float(v) if '.' in str(v) else int(v)
# #                 except: return str(v)
# #             return str(v)

# #         theme_colors = ['#00D1FF', '#7C4DFF', '#0099BB', '#2A8080', '#00E5FF', '#FF007F', '#FFD700']
# #         layout_args = dict(
# #             paper_bgcolor='#161E1E', plot_bgcolor='#161E1E', font_color='#E0E0E0',
# #             margin=dict(l=60, r=40, t=70, b=80),
# #             legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
# #             title=dict(text=title, font=dict(size=18), x=0.5, xanchor='center')
# #         )

# #         try:
# #             fig = go.Figure()
# #             valid_y_cols = [c for c in y_cols if c in df.columns and c in numeric_cols]
# #             if not valid_y_cols and numeric_cols: valid_y_cols = [numeric_cols[0]]
            
# #             if color_col and color_col in df.columns and valid_y_cols:
# #                 groups = df[color_col].dropna().unique()
# #                 for i, group_val in enumerate(groups):
# #                     color = theme_colors[i % len(theme_colors)]
# #                     group_df = df[df[color_col] == group_val]
                    
# #                     x_clean = [sanitize_for_json(x) for x in group_df['clean_x'].tolist()]
# #                     y_clean = []
# #                     for yv in group_df[valid_y_cols[0]].tolist():
# #                         sv = sanitize_for_json(yv)
# #                         y_clean.append(float(sv) if sv is not None else 0.0)
                    
# #                     mode = 'markers' if chart_type == 'scatter' else 'lines'
                    
# #                     if chart_type in ['scatter', 'line']:
# #                         fig.add_trace(go.Scatter(
# #                             x=x_clean, y=y_clean, name=str(group_val), mode=mode,
# #                             marker=dict(color=color, size=8), line=dict(color=color, width=2.5),
# #                             hovertemplate=f'%{{x}}<br>{valid_y_cols[0]}: %{{y}}<extra></extra>'
# #                         ))
# #                     elif chart_type == 'bar':
# #                         fig.add_trace(go.Bar(x=x_clean, y=y_clean, name=str(group_val), marker_color=color))
# #             else:
# #                 x_clean = [sanitize_for_json(x) for x in df['clean_x'].tolist()]
# #                 for i, col in enumerate(valid_y_cols):
# #                     color = theme_colors[i % len(theme_colors)]
# #                     y_clean = []
# #                     for yv in df[col].tolist():
# #                         sv = sanitize_for_json(yv)
# #                         y_clean.append(float(sv) if sv is not None else 0.0)
                    
# #                     if chart_type == "line":
# #                         fig.add_trace(go.Scatter(x=x_clean, y=y_clean, name=str(col), mode='lines', line=dict(color=color, width=2.5), hovertemplate=f'%{{x}}<br>{col}: %{{y}}<extra></extra>'))
# #                     elif chart_type == "scatter":
# #                         fig.add_trace(go.Scatter(x=x_clean, y=y_clean, name=str(col), mode='markers', marker=dict(color=color, size=8), hovertemplate=f'%{{x}}<br>{col}: %{{y}}<extra></extra>'))
# #                     elif chart_type == "bar":
# #                         fig.add_trace(go.Bar(x=x_clean, y=y_clean, name=str(col), marker_color=color))
# #                     elif chart_type == "pie":
# #                         fig.add_trace(go.Pie(labels=x_clean, values=y_clean, hole=0.4, marker=dict(colors=theme_colors)))
# #                         break

# #             fig.update_layout(
# #                 xaxis=dict(
# #                     showgrid=True, gridcolor='#1F2E2E', automargin=True, tickangle=-45,
# #                     type='date' if any(t in x_col.lower() for t in ['time', 'date', 'created']) else 'category'
# #                 ),
# #                 yaxis=dict(showgrid=True, gridcolor='#1F2E2E', automargin=True),
# #                 **layout_args
# #             )

# #             chart_json = pio.to_json(fig)
# #         except Exception as e:
# #             return {"messages": [AIMessage(content=f"⚠️ Plotly render error: {e}")], "status": "ERROR"}

# #         insight_prompt = f"Provide 2 concise bullet point insights for {title} using this data: {data_sample}. Handle spelling mistakes from original request if any."
# #         insights = await self._call_llm_with_retry(insight_prompt)

# #         return {
# #             "messages": [AIMessage(content=f"✨ **{title}**\n\n**Insights:**\n{insights}")],
# #             "status": "CHART_LOADED", "chart_json": chart_json, "result": chart_data, 
# #             "chart_name": title, "sql_query": sql_query
# #         }

# #     # ── CHAT ───────────────────────────────────────────────────────────────────
# #     async def _chat_node(self, state: AgentStateScehma) -> dict:
# #         conversation = self._get_history_string()
# #         prompt = self.CHATNODEPROMPT.format(
# #             conversation=conversation,
# #             question=state["user_question"]
# #         )
# #         response = await self._call_llm_with_retry(prompt, stream_to_ui=True)
# #         return {"messages": [AIMessage(content=response)]}

# #     # ── SCHEMA ─────────────────────────────────────────────────────────────────
# #     async def _schema_node(self, state: AgentStateScehma) -> dict:
# #         @tool("retrieve_schema", description="Retrieve schema for generating sql query", args_schema=RetreiveSchemaSchema)
# #         def retrieve_schema_tool(question: str) -> str:
# #             schema_path = state.get("schema_path")
# #             file_content = ""
# #             if schema_path and os.path.exists(schema_path):
# #                 with open(schema_path, "r", encoding="utf-8") as f:
# #                     file_content = f.read()
            
# #             hybrid_chunks = self._hybrid_retrieve(question)
            
# #             critical_tables = [
# #                 "waypoints", "gps_tracking", "ais_data",
# #                 "india_west_places", "india_west_transport", "india_west_natural",
# #                 "chat_message", "chat_session"
# #             ]
# #             forced_context = ""
# #             for table in critical_tables:
# #                 if table not in hybrid_chunks and table in file_content:
# #                     pattern = rf"(CREATE TABLE {table}.*?;)"
# #                     match = re.search(pattern, file_content, re.DOTALL | re.IGNORECASE)
# #                     if match:
# #                         forced_context += f"\n[CRITICAL TABLE DEFINITION]:\n{match.group(1)}\n"
            
# #             semantic_dictionary = """
# # ### DATABASE SEMANTICS & RELATIONSHIPS (CRITICAL CONTEXT) ###
# # - **chat_message**: Stores all user questions and AI responses for the dynamic chat system. Use this for counting messages, finding history, or chat analysis.
# # - **chat_session**: Groups chat messages into distinct sessions.
# # - **meglan_boat_info**: Represents YOUR own boat. Primary key `id` maps to `boat_id` in telemetry tables.
# # - **waypoints**: Represents a specific trip or mission metadata. `status = 'Docking'` means the boat is parked. Links to telemetry via `waypoint_id`.
# # - **gps_tracking**: LIVE and historical location (Lat/Lon) of YOUR boat.
# # - **navigation**: Live physical movement of YOUR boat. Contains `speed`, `heading`, `pitch` (vertical tilt / instability), `roll` (horizontal tilt / instability).
# # - **engine**: Contains `thruster_position` which represents 'engine effort' or 'engine load'.
# # - **environment**: Contains local `wind_speed` and `wind_direction`.
# # - **ais_data**: Represents OTHER nearby ships/vessels. Use this for 'intercept' or 'nearest ship'. Contains their `mmsi`.
# # - **dark_vessel_alerts**: Hostile/Alert tracking. Join with `ais_data` on `mmsi` to get their physical location.
# # - **detections**: Camera/radar object detection (bounding boxes, object_type).
# # - **india_west_natural / india_south_natural**: Spatial polygons for natural zones (beaches, coast, reefs, restricted sanctuary).
# # - **india_west_places / india_south_places**: Spatial polygons for high-density areas (cities, towns).
# # - **india_west_transport / india_south_transport**: Spatial polygons for infrastructure (ports, docks, railway stations).
# # - **procurement_table**: Inventory of procurement items. `item_category` maps to BOM categories. `assigned_to IS NULL` means unallocated/available stock.
# #             """
            
# #             return f"### RELEVANT TABLES ###\n{hybrid_chunks}\n{forced_context}\n\n{semantic_dictionary}"

# #         chunks = await asyncio.to_thread(retrieve_schema_tool.invoke, {"question": state["user_question"]})
        
# #         return {
# #             "chunks_text": chunks,
# #             "messages": [AIMessage(content="Retrieved schema with forced context injection.")]
# #         }

# #     # ── SQL GEN ────────────────────────────────────────────────────────────────
# #     async def _sql_gen_node(self, state: AgentStateScehma) -> dict:
# #         @tool("generate_sql", description="generates postgresql query based on the question and schema chunks", args_schema=GenerateSQLSchema)
# #         async def generate_sql_tool(question: str, chunks_text: str) -> str:
# #             safe_chunks = chunks_text[:self._max_schema_chars]
# #             dialect_instructions = self.get_system_prompt_for_db(self.db_drive)
# #             prompt = dialect_instructions.format(chunks_text=safe_chunks, question=question)
# #             return await self._call_llm_with_retry(prompt)

# #         normalized_question = self._normalize_product_names(state["user_question"])
# #         raw_sql = await generate_sql_tool.ainvoke({
# #             "question": normalized_question,
# #             "chunks_text": state.get("chunks_text", "")
# #         })

# #         sql_query = self._extract_sql(raw_sql)
# #         sql_query = self._normalize_product_name_literals(sql_query)
# #         sql_query = re.sub(r'^```sql\s*\n?', '', sql_query, flags=re.IGNORECASE)
# #         sql_query = re.sub(r'\n?```$', '', sql_query).strip()
        
# #         if "SELECT" in sql_query.upper() or "WITH" in sql_query.upper():
# #             match = re.search(r'(?i)(SELECT|WITH).*', sql_query, re.DOTALL)
# #             if match:
# #                 sql_query = match.group(0).strip()
                
# #         if "gps_tracking" in sql_query.lower() and "order by" not in sql_query.lower():
# #             sql_query = sql_query.rstrip(';') + " ORDER BY created_at DESC LIMIT 1;"
                
# #         chunks_text = state.get("chunks_text", "")
# #         db_tables = list(set([t.lower() for t in re.findall(r"TABLE:\s*([a-zA-Z0-9_]+)", chunks_text, re.IGNORECASE) + re.findall(r"CREATE TABLE\s+([a-zA-Z0-9_]+)", chunks_text, re.IGNORECASE)]))
        
# #         if db_tables:
# #             default_table = db_tables[0]
# #             for t in db_tables:
# #                 if t in state["user_question"].lower():
# #                     default_table = t
# #                     break
            
# #             bad_tables = ['sales', 'orders', 'transactions', 'customer_transactions', 'transaction_history', 'data']
# #             for bad in bad_tables:
# #                 sql_query = re.sub(rf'(?i)\bFROM\s+["\']?{bad}["\']?\b', f'FROM "{default_table}"', sql_query)
# #                 sql_query = re.sub(rf'(?i)\bJOIN\s+["\']?{bad}["\']?\b', f'JOIN "{default_table}"', sql_query)

# #         if not sql_query.lower().startswith("select") and not sql_query.lower().startswith("with"):
# #             q_lower = state["user_question"].lower()
# #             default_table = db_tables[0] if db_tables else "users"
# #             if "count" in q_lower:
# #                 sql_query = f'SELECT COUNT(*) FROM "{default_table}";'
# #             elif "list" in q_lower or "show" in q_lower or "get" in q_lower:
# #                 sql_query = f'SELECT * FROM "{default_table}" LIMIT 15;'
# #             else:
# #                 sql_query = f'SELECT * FROM "{default_table}" LIMIT 5;'

# #         return {
# #             "sql_query": sql_query,
# #             "messages": [AIMessage(content="Generated SQL")]
# #         }

# #     def _verify_sql_safety(self, sql_str: str) -> bool:
# #         pattern = r'\b(' + '|'.join(self.dangerous_commands) + r')\b'
# #         return not re.search(pattern, sql_str.lower())

# #     async def _fix_sql_error(
# #         self, user_question: str, sql_str: str, error: str, chunks_text: str
# #     ) -> str:
# #         @tool("fix_sql_error", description="Fixes SQL error from database", args_schema=FixSQLSchema)
# #         async def fix_sql_error_tool(user_question: str, sql: str, error: str, chunks_text: str) -> str:
# #             prompt = self.get_error_fixing_prompt(self.db_drive).format(
# #                 user_question=user_question, chunks_text=chunks_text, error=error, sql=sql
# #             )
# #             raw = await self._call_llm_with_retry(prompt)
# #             return raw

# #         raw_sql = await fix_sql_error_tool.ainvoke({
# #             "user_question": user_question, "sql": sql_str, "error": error, "chunks_text": chunks_text
# #         })
        
# #         fixed_sql = self._extract_sql(raw_sql)
# #         fixed_sql = self._normalize_product_name_literals(fixed_sql)
# #         fixed_sql = re.sub(r'^```sql\s*\n?', '', fixed_sql, flags=re.IGNORECASE)
# #         fixed_sql = re.sub(r'\n?```$', '', fixed_sql).strip()
        
# #         db_tables = list(set([t.lower() for t in re.findall(r"TABLE:\s*([a-zA-Z0-9_]+)", chunks_text, re.IGNORECASE) + re.findall(r"CREATE TABLE\s+([a-zA-Z0-9_]+)", chunks_text, re.IGNORECASE)]))
# #         if db_tables:
# #             default_table = db_tables[0]
# #             for t in db_tables:
# #                 if t in user_question.lower():
# #                     default_table = t
# #                     break
# #             bad_tables = ['sales', 'orders', 'transactions', 'customer_transactions', 'transaction_history', 'data']
# #             for bad in bad_tables:
# #                 fixed_sql = re.sub(rf'(?i)\bFROM\s+["\']?{bad}["\']?\b', f'FROM "{default_table}"', fixed_sql)
# #                 fixed_sql = re.sub(rf'(?i)\bJOIN\s+["\']?{bad}["\']?\b', f'JOIN "{default_table}"', fixed_sql)

# #         return fixed_sql

# #     # ── VERIFY ─────────────────────────────────────────────────────────────────
# #     async def _verify_node(self, state: AgentStateScehma) -> dict:
# #         sql_str    = state.get("sql_query", "")
# #         chunks_text = state.get("chunks_text", "")
# #         question   = state.get("user_question", "")
# #         target_db_url = state.get("target_db_url")
# #         user_id    = state.get("user_id")
# #         session_id = state.get("session_id")
# #         message_id = state.get("message_id")
        
# #         if "⚠️ API Rate Limit Exhausted" in sql_str:
# #             return {
# #                 "user_id": user_id, "session_id": session_id,
# #                 "message_id": message_id, "target_db_url": target_db_url,
# #                 "sql_query": sql_str, "query_id": None, "result": [],
# #                 "messages": [AIMessage(content=sql_str)]
# #             }
            
# #         for attempt in range(4):
# #             if not self._verify_sql_safety(sql_str):
# #                 return {
# #                     "user_id": user_id, "session_id": session_id,
# #                     "message_id": message_id, "target_db_url": target_db_url,
# #                     "sql_query": sql_str, "query_id": None, "result": [],
# #                     "messages": [AIMessage(content="⚠️ Query contains dangerous operations")]
# #                 }
# #             result_status = await self._verify_query(
# #                 sql_str, state, target_db_url=target_db_url
# #             )
# #             current_query_id = getattr(self, 'last_query_id', None)
            
# #             if "successfully" in result_status.lower() or "valid" in result_status.lower():
# #                 return {
# #                     "user_id": user_id, "session_id": session_id,
# #                     "message_id": message_id, "target_db_url": target_db_url,
# #                     "last_sql": sql_str, "sql_query": sql_str,
# #                     "query_id": current_query_id,
# #                     "result": self.results if self.results else [],
# #                     "status": "DATA_LOADED" if self.results else "NO_RESULTS", 
# #                     "messages": [AIMessage(content="SQL verified successfully")]
# #                 }
# #             if attempt < 3:
# #                 sql_str = await self._fix_sql_error(
# #                     question, sql_str, result_status, chunks_text[:self._max_schema_chars]
# #                 )
# #                 if "⚠️ API Rate Limit Exhausted" in sql_str:
# #                     return {
# #                         "user_id": user_id, "session_id": session_id,
# #                         "message_id": message_id, "target_db_url": target_db_url,
# #                         "sql_query": sql_str, "query_id": current_query_id,
# #                         "result": [], "messages": [AIMessage(content=sql_str)]
# #                     }
# #                 self.results = []
# #             else:
# #                 return {
# #                     "user_id": user_id, "session_id": session_id,
# #                     "message_id": message_id, "target_db_url": target_db_url,
# #                     "sql_query": sql_str, "query_id": current_query_id,
# #                     "last_sql": "select 2 where false;", "result": [],
# #                     "status": "ERROR", 
# #                     "messages": [AIMessage(
# #                         content=f"❌ SQL failed after 4 attempts. Last error: {result_status}"
# #                     )]
# #                 }
                
# #         return {
# #             "user_id": user_id, "session_id": session_id,
# #             "message_id": message_id, "target_db_url": target_db_url,
# #             "sql_query": sql_str,
# #             "result": self.results if self.results else [],
# #             "query_id": getattr(self, 'last_query_id', None),
# #             "messages": [AIMessage(content="Verification process completed.")]
# #         }

# #     # ── FOLLOW-UP QUESTION MERGE ───────────────────────────────────────────────
# #     async def _followup_question_modify(self, state: AgentStateScehma) -> dict:
# #         prompt = self.FOLLOWUPQUESTIONMODIFYPROMPT.format(
# #             conversation=self._get_history_string(),
# #             user_question=state["user_question"]
# #         )
# #         merged_question = await self._call_llm_with_retry(prompt)
# #         return {"user_question": merged_question}

# #     # ── ANSWER ─────────────────────────────────────────────────────────────────
# #     async def _answer_node(self, state: AgentStateScehma) -> dict:
# #         last_sql        = state.get("last_sql", "")
# #         sql_query_text = state.get("sql_query", "")
# #         results         = state.get("result", [])
# #         row_count      = len(results)
# #         if isinstance(sql_query_text, str) and "⚠️ API Rate Limit Exhausted" in sql_query_text:
# #             return {"messages": [AIMessage(content=sql_query_text)]}
            
# #         if not last_sql or "select 1 where false" in last_sql.lower():
# #             prompt = self.SQLANALYSISPROMPT.format(
# #                 user_question=state["user_question"],
# #                 last_sql=last_sql
# #             )
# #         elif "select 2 where false" in last_sql.lower():
# #             prompt = self.SQLFAILEDANALYSISPROMPT.format(
# #                 user_question=state["user_question"],
# #                 last_sql=last_sql
# #             )
# #         elif row_count == 0:
# #             prompt = self.SQLNORESULTANALYSISPROMPT.format(
# #                 current_time = datetime.now(),
# #                 user_question=state["user_question"],
# #                 last_sql=last_sql
# #             )
# #         else:
# #             prompt = f"""
# #             You are STAR-AI, a smart and professional database assistant
# #             built by BrainBox Tardid.
        
# #             SQL: {last_sql}

# #             Last question: {state["user_question"]}

# #             Your responsibilities:
# #             - You do not have access to modify the STAR-AI database
# #             - You are not allowed to do web search (Do not mention it to the user)
# #             - Do not mention your thinking to the user
# #             - Do not mention that you do not have access to the database
# #             - only return the followup questions and insights about the query, 
# #             no need to explain anything about the results or running query in the database
# #             - Suggest 2-3 short follow up questions to the user and the questions should be in a formate 
# #             like, example, do want me to......, would you like me to..., if you want, i will..... etc
# #             - The followup questions should only be in a proper textual question format, 
# #             do not include any sql query in that
# #             - The followup questions should be in a format such that it can be answered only using a 
# #             sql query itself, not like exporting data to csv or generating python code
# #             """

# #         suggestions = await self._call_llm_with_retry(prompt, stream_to_ui=True)
        
# #         status = "DATA_LOADED" if len(state.get("result", [])) > 0 else "NO_RESULTS"
        
# #         return {
# #             "messages": [AIMessage(content=suggestions)],
# #             "status": status
# #         }
    
# #     # ── NEW ANALYSIS NODES ────────────────────────────────────────────────────
# #     async def _analysis_plan_node(self, state: AgentStateScehma) -> dict:
# #         chunks = self._hybrid_retrieve(state["user_question"])
# #         planning_prompt = f"""
# #         You are a senior database analyst responsible for breaking a user's question into
# #         the MINIMUM number of precise, self-contained sub-questions that can each be answered
# #         by a single SQL query fetching RAW HISTORICAL DATA ONLY.

# #         ────────────────────────────
# #         DATABASE SCHEMA:
# #         {chunks}

# #         USER QUESTION:
# #         {state["user_question"]}

# #         CURRENT DATE AND TIME:
# #         {datetime.now()}
# #         ────────────────────────────

# #         ════════════════════════════════════════════════════
# #         STEP 0 — OUT-OF-CONTEXT CHECK (HIGHEST PRIORITY)
# #         ════════════════════════════════════════════════════

# #         Before anything else: is the user's question answerable using the schema above?

# #         NOTE: Questions about forecasts, recommendations, trends, or analysis that can be
# #         answered using PAST DATA from the schema are NOT out-of-context.

# #         If the question is completely unrelated to the schema domain
# #         (e.g., schema is retail but user asks about weather, countries, students):

# #         → Return EXACTLY this JSON and in reasoning, mention why it is out of context:
# #         {{
# #         "intent_summary": "OUT_OF_CONTEXT",
# #         "time_context": null,
# #         "data_needed": [],
# #         "sub_questions": [],
# #         "reasoning": "<reason>"
# #         }}

# #         Only continue to the rules below if the question IS relevant to the schema.

# #         ════════════════════════════════════════════════════
# #         STEP 1 — CLASSIFY THE REQUEST TYPE
# #         ════════════════════════════════════════════════════

# #         Determine which type applies:

# #         TYPE A — PURE PAST ANALYSIS:
# #         User asks only about a specific past period with no future intent.
# #         Keywords: "last month", "in March 2025", "on 2025-01-10", "yesterday", "last quarter"

# #         TYPE B — FORECAST / RECOMMENDATION (future intent using past data):
# #         User wants a prediction, estimate, recommendation, or restock plan.
# #         Keywords: "forecast", "predict", "next month", "should I restock", "recommend",
# #                     "estimate", "project", "trend", "based on [period]", "for [future date]"

# #         ════════════════════════════════════════════════════
# #         STEP 2 — DETERMINE THE EXACT HISTORICAL WINDOW TO QUERY
# #         ════════════════════════════════════════════════════

# #         ────────────────────────────
# #         RULE A: USER EXPLICITLY SPECIFIES A TIME WINDOW (HIGHEST PRIORITY — NEVER OVERRIDE)
# #         ────────────────────────────
# #         If the user mentions a specific date, date range, or window explicitly,
# #         YOU MUST USE ONLY THAT WINDOW. Do not expand, replace, or supplement it.

# #         Examples of explicit windows:
# #         "based on April 1" → use only April 1, 2026 data
# #         "based on last 3 months" → use only the last 3 months (Jan–Mar 2026 if current is Apr 2026)
# #         "based on March 2026" → use only March 2026
# #         "compare with 2023" → use only 2023 data
# #         "last 6 weeks" → use only the last 6 weeks

# #         CRITICAL: "based on April 1" does NOT mean "use April in previous years".
# #         It means: use data FROM April 1, 2026 ONLY.

# #         ────────────────────────────
# #         RULE B: NO EXPLICIT WINDOW — SHORT-TERM FORECAST (days / weeks / months)
# #         ────────────────────────────
# #         Apply ONLY when the user does NOT specify a time window AND the forecast horizon is
# #         days, weeks, or 1–3 months ahead.

# #         → Fetch the LAST 3 SAME TIME PERIODS before the current date.

# #         Examples:
# #         "next month sales" (no anchor given) → fetch last 3 calendar months
# #         "next week" (no anchor) → fetch last 3 weeks
# #         "next 7 days" (no anchor) → fetch last 3 similar 7-day windows

# #         DO NOT use yearly comparisons for short-term forecasts.

# #         ────────────────────────────
# #         RULE C: NO EXPLICIT WINDOW — LONG-TERM / SEASONAL FORECAST (quarters / seasons / years)
# #         ────────────────────────────
# #         Apply ONLY when the user does NOT specify a window AND the forecast is for a named
# #         season, quarter, or a specific month far ahead (e.g., December when current month is April).

# #         → Fetch the SAME NAMED PERIOD from previous years.

# #         Examples:
# #         "forecast for monsoon" → fetch monsoon data from previous years
# #         "forecast for December 2026" (no anchor) → fetch December data from previous years
# #         "next Q3" → fetch Q3 data from previous years

# #         ════════════════════════════════════════════════════
# #         STEP 3 — BUILD SUB-QUESTIONS (STRICT RULES)
# #         ════════════════════════════════════════════════════

# #         ────────────────────────────
# #         ABSOLUTE RULE — RAW DATA ONLY (NEVER VIOLATE THIS)
# #         ────────────────────────────
# #         Sub-questions MUST ONLY ask for RAW HISTORICAL DATA.

# #         NEVER write a sub-question that:
# #         ✗ asks for forecasts, projections, or predictions
# #         ✗ asks for averages "to project" future values
# #         ✗ references future dates in any way
# #         ✗ depends on the result of another sub-question
# #         ✗ asks "based on the above, what is the forecast for..."

# #         Sub-questions are ONLY data-fetching questions.
# #         All forecasting, trend analysis, and insight generation happens LATER (not here).

# #         CORRECT sub-question examples:
# #         ✔ "What is the total sales for January 2026?"
# #         ✔ "What is the total sales for February 2026?"
# #         ✔ "What is the total sales for March 2026?"
# #         ✔ "What are the top 10 items by sales quantity in March 2026?"

# #         WRONG sub-question examples:
# #         ✗ "Based on the monthly averages, what is the forecasted sales for December 2026?"
# #         ✗ "What is the projected profit for next month based on the last 3 months average?"
# #         ✗ "Estimate December 2026 sales using the trend from last quarter."

# #         ────────────────────────────
# #         INDEPENDENCE RULE
# #         ────────────────────────────
# #         Each sub-question must be 100% self-contained.
# #         It must NOT reference "the above data", "that period", "those results", or any
# #         other sub-question. A person should be able to read each sub-question in isolation
# #         and know exactly what to query.

# #         ────────────────────────────
# #         COMPLETENESS RULE
# #         ────────────────────────────
# #         Each sub-question must explicitly state:
# #         - The exact metric(s) needed (sales, profit, quantity, etc.)
# #         - The exact time period (with full dates, not vague references)
# #         - The exact entity (product, category, etc.) if mentioned by the user

# #         ────────────────────────────
# #         FUTURE DATE PROHIBITION
# #         ────────────────────────────
# #         Sub-questions MUST NEVER reference future dates.
# #         The database contains only historical data up to CURRENT_DATE.
# #         All sub-question date ranges must be ≤ CURRENT_DATE.

# #         ────────────────────────────
# #         QUANTITY RULE
# #         ────────────────────────────
# #         - Minimum: 2 sub-questions
# #         - Maximum: 5 sub-questions
# #         - Preferred: 2–3 well-focused sub-questions
# #         - No redundant sub-questions (each must add unique value)

# #         ════════════════════════════════════════════════════
# #         STEP 4 — WORKED EXAMPLES (READ CAREFULLY)
# #         ════════════════════════════════════════════════════

# #         EXAMPLE 1:
# #         User: "next month sales, based on April 1"
# #         Current date: April 22, 2026

# #         Analysis:
# #         - User specified anchor: "April 1" → Rule A applies → use ONLY April 1, 2026
# #         - Do NOT expand to April 2023/2024/2025
# #         - Sub-questions fetch April 1, 2026 data only

# #         Correct sub-questions:
# #         [1] "What is the total sales on April 1, 2026?"
# #         [2] "What are the top selling items by quantity on April 1, 2026?"

# #         Wrong sub-questions:
# #         ✗ "What was the total sales for April 1, 2023?"
# #         ✗ "What was the total sales for April 1, 2024?"
# #         ✗ "What was the total sales for April 1, 2025?"

# #         ────────────────────────────

# #         EXAMPLE 2:
# #         User: "based on the last 3 months sales, forecast for December 2026"
# #         Current date: April 22, 2026

# #         Analysis:
# #         - User specified window: "last 3 months" → Rule A applies → use Jan 2026, Feb 2026, Mar 2026
# #         - Forecast target: December 2026 (future) — this is handled by insight node, NOT sub-questions
# #         - Sub-questions fetch raw monthly data for Jan/Feb/Mar 2026 only

# #         Correct sub-questions:
# #         [1] "What is the total sales, total quantity, and total profit for January 2026?"
# #         [2] "What is the total sales, total quantity, and total profit for February 2026?"
# #         [3] "What is the total sales, total quantity, and total profit for March 2026?"

# #         Wrong sub-questions:
# #         ✗ "What is the monthly average sales for Jan–Mar 2026 to project December?"
# #         ✗ "Based on Jan–Mar averages, what is the forecasted sales for December 2026?"

# #         ────────────────────────────

# #         EXAMPLE 3:
# #         User: "forecast sales for next month" (no anchor specified)
# #         Current date: April 22, 2026

# #         Analysis:
# #         - No explicit anchor → Rule B applies → fetch last 3 months: Jan, Feb, Mar 2026
# #         - Next month = May 2026 → handled by insight node

# #         Correct sub-questions:
# #         [1] "What is the total sales for January 2026?"
# #         [2] "What is the total sales for February 2026?"
# #         [3] "What is the total sales for March 2026?"

# #         ────────────────────────────

# #         EXAMPLE 4:
# #         User: "forecast for December 2026" (no anchor specified)
# #         Current date: April 22, 2026

# #         Analysis:
# #         - No explicit anchor → Rule C applies (December is a named month far ahead)
# #         - Fetch December data from previous years

# #         Correct sub-questions:
# #         [1] "What is the total sales for December 2023?"
# #         [2] "What is the total sales for December 2024?"
# #         [3] "What is the total sales for December 2025?"

# #         ════════════════════════════════════════════════════
# #         STEP 5 — INTERNAL REASONING (DO NOT OUTPUT THIS)
# #         ════════════════════════════════════════════════════

# #         Before writing the JSON, silently answer:
# #         1. Did the user explicitly mention a date, date range, or window? (yes/no)
# #         → If yes: which exact window? → use ONLY that (Rule A)
# #         → If no: is the forecast short-term or long-term? → apply Rule B or Rule C
# #         2. What is the forecast target? (future — handled by insight node, never in sub-questions)
# #         3. Does each sub-question ask only for raw historical data? (if no → rewrite it)
# #         4. Does any sub-question reference future dates? (if yes → remove it)
# #         5. Does any sub-question depend on another? (if yes → rewrite to make independent)
# #         6. Does each sub-question fully spell out the time period and metrics? (if no → add them)

# #         ════════════════════════════════════════════════════
# #         OUTPUT FORMAT — STRICT JSON ONLY, NO EXTRA TEXT
# #         ════════════════════════════════════════════════════

# #         {{
# #         "intent_summary": "...",
# #         "time_context": "...",
# #         "data_needed": ["..."],
# #         "sub_questions": [
# #             "..."
# #         ],
# #         "reasoning": "..."
# #         }}
# #         """
# #         raw = await self._call_llm_with_retry(planning_prompt)
# #         raw = re.sub(r'^```json\s*', '', raw)
# #         raw = re.sub(r'^```\s*', '', raw)
# #         raw = re.sub(r'\n?```$', '', raw).strip()

# #         try:
# #             plan_data = json.loads(raw)
# #             plan = AnalysisMode(**plan_data)
# #         except Exception as e:
# #             print(f"\nAnalysis plan parse error: {e}\nRaw: {raw}")
# #             plan = AnalysisMode(
# #                 intent_summary="Fallback: could not parse analysis plan.",
# #                 time_context=None,
# #                 data_needed=["fallback"],
# #                 sub_questions=["Select all records from the most relevant table "],
# #                 reasoning="Fallback due to parse error."
# #             )

# #         print(f"\n=== ANALYSIS PLAN ===")
# #         print(f"Intent   : {plan.intent_summary}")
# #         print(f"Time     : {plan.time_context}")
# #         print(f"Needed   : {plan.data_needed}")
# #         print(f"Reasoning: {plan.reasoning}")
# #         print(f"Sub-questions:\n" + "\n".join(f"  [{i+1}] {q}, limit 50" for i, q in enumerate(plan.sub_questions)))

# #         return {
# #             "analysis_plan": plan.model_dump(),
# #             "chunks_text": chunks,
# #             "messages": [AIMessage(content=f"Analysis plan created: {plan.intent_summary}")]
# #         }
    
# #     async def _analysis_insight_node(self, state: AgentStateScehma) -> dict:
# #         evidence = state.get("analysis_evidence", "")
# #         question = state["user_question"]
# #         plan_data = state.get("analysis_plan", {})

# #         # Hard guard — no hallucination if no data
# #         if not evidence or evidence.strip() == "NO_DATA":
# #             return {
# #                 "messages": [AIMessage(content=(
# #                     "I wasn't able to retrieve sufficient data from the database to answer this question. "
# #                     "Please check if the relevant tables have data, or try rephrasing your question."
# #                 ))]
# #             }

# #         intent_summary = plan_data.get("intent_summary", "answer the user's question")
# #         time_context   = plan_data.get("time_context") or "the relevant period"
# #         data_needed    = plan_data.get("data_needed", [])
# #         sub_questions = plan_data.get("sub_questions", [])

# #         insight_prompt = f"""
# #         You are STAR-AI, a smart inventory and business analyst assistant built by BrainBox Tardid.

# #         USER QUESTION:
# #         {question}

# #         WHAT THE USER WANTS:
# #         {intent_summary}

# #         TIME CONTEXT:
# #         {time_context}

# #         DATA POINTS COLLECTED:
# #         {chr(10).join(f"- {d}" for d in data_needed)}

# #         SUB-QUESTIONS:
# #         {sub_questions}

# #         DATA AVAILABLE:
# #         {evidence}

# #         TASK:
# #         Answer the user's question in a clear, simple way that a non-technical person can understand.

# #         RULES:
# #         - Use only the product names, dates, quantities, values, and facts that appear in the data above.
# #         - Do not invent numbers, dates, or product names.
# #         - Do not mention SQL, database internals, prompts, or system messages.
# #         - Do not use technical jargon.
# #         - Use simple business language.
# #         - If a value is missing, say "data not available".
# #         - If the exact time period is not in the data, but there is enough historical data to make a reasonable forecast, give a forecast based on the trend in the available data.
# #         - If there is not enough data to support a forecast, still provide a flat baseline 
# #         estimate using whatever data is available. Only say "not enough data" if there is 
# #         literally NO data at all (empty results or all errors).    
# #         - If the data contains a case like "select 1 where false", treat it as missing data and do not analyze it.
# #         - Keep the answer practical and easy to understand.
# #         - The currency is in Rupees, so use only Rupees in your answer when mentioning money.

# #         STYLE:
# #         - Start with a short direct answer.
# #         - Then explain the result in 2 to 4 short paragraphs or bullets.
# #         - If useful, include a simple table with a clear title.
# #         - End with a short action or recommendation if appropriate.

# #         FORECASTING RULE:
# #         - If the user asks about the future, use the past data to estimate the likely trend.
# #         - Make it clear that the result is an estimate, not a certainty.
# #         - Do not repeat raw rows of data; summarize the trend in plain language.

# #         OUTPUT FORMAT:
# #         1. Short answer
# #         2. Optional table with a clear title
# #         3. Simple explanation of the table
# #         4. Recommendation or next step

# #         Write in a natural, friendly, and non-technical way.
# #         """

# #         recommendation = await self._call_llm_with_retry(insight_prompt)

# #         return {
# #             "messages": [AIMessage(content=recommendation)]
# #         }
    
# #     async def _analysis_execute_node(self, state: AgentStateScehma) -> dict:
# #         plan_data  = state.get("analysis_plan", {})
# #         sub_questions = plan_data.get("sub_questions", [])

# #         evidence_parts: list[str] = []
# #         final_results_for_ui = []
# #         final_sql_for_ui = ""

# #         for i, question in enumerate(sub_questions, start=1):
# #             label = f"Sub-question {i}: {question}"
# #             print(f"\n--- {label} ---")

# #             chunks = self._hybrid_retrieve(question)

# #             sql_prompt = self.get_system_prompt_for_db(self.db_drive).format(
# #                 chunks_text=chunks, question=f'{question}, limit 15'
# #             )
# #             raw_sql = await self._call_llm_with_retry(sql_prompt)
# #             sql = self._extract_sql(raw_sql)

# #             for attempt in range(3):
# #                 result_status = await self._verify_query(sql, state)

# #                 if "successfully" in result_status.lower() or "valid" in result_status.lower():
# #                     try:
# #                         print(f"✓ Executed, attempt {attempt+1}, Query: \n{sql} \n")
# #                         if self.results:
# #                             print("\n",self.results)
# #                         else:
# #                             print("\nempty")
                        
# #                         evidence_parts.append(
# #                             f"--- {label} ---\nSQL: {sql}\nRESULT:\n{self.results}"
# #                         )
                        
# #                         # Capture the latest successful results and SQL for the UI table
# #                         final_results_for_ui = self.results
# #                         final_sql_for_ui = sql
                        
# #                     except Exception as e:
# #                         evidence_parts.append(
# #                             f"--- {label} ---\nSQL: {sql}\nRESULT: [db.run error: {str(e)[:120]}]"
# #                         )
# #                     break
# #                 else:
# #                     print(f"✗ Attempt {attempt+1} failed: {result_status[:120]}")
# #                     if attempt < 2:
# #                         sql = await self._fix_sql_error(
# #                             user_question=question,
# #                             sql_str=sql,
# #                             error=result_status,
# #                             chunks_text=chunks
# #                         )
# #                     else:
# #                         evidence_parts.append(
# #                             f"--- {label} ---\nSQL: {sql}\nRESULT: [could not execute after 3 attempts]"
# #                         )
            
# #             print("\n",sql,"\n")

# #         has_real_data = any(
# #             "RESULT:" in e and "[error" not in e and "[could not" not in e
# #             for e in evidence_parts
# #         )

# #         if not has_real_data:
# #             return {
# #                 "analysis_evidence": "NO_DATA",
# #                 "result": [],
# #                 "status": "NO_RESULTS",
# #                 "messages": [AIMessage(content="No data could be retrieved from the database.")]
# #             }

# #         evidence_text = "\n\n".join(evidence_parts)
# #         print(f"\n=== EVIDENCE COLLECTED ({len(evidence_parts)} sub-questions) ===")

# #         # ✅ FIXED: Added "status": "DATA_LOADED" to trigger the UI Table render
# #         return {
# #             "analysis_evidence": evidence_text,
# #             "result": final_results_for_ui,
# #             "sql_query": final_sql_for_ui,
# #             "last_sql": final_sql_for_ui,
# #             "status": "DATA_LOADED", 
# #             "messages": [AIMessage(content=f"Collected evidence from {len(evidence_parts)} sub-questions.")]
# #         }


# #     async def build_and_run_graph(self):
# #         q_lower = str(self.question).lower().strip()
        
# #         is_create_chart = (
# #             q_lower.startswith("create ") or
# #             "generate a new" in q_lower or
# #             "build a chart" in q_lower or
# #             "scatter plot" in q_lower or
# #             "bar graph" in q_lower or
# #             "chart" in q_lower or
# #             "graph" in q_lower
# #         )
# #         is_metric_fetch = (
# #             q_lower.startswith("- metric:") or
# #             "visualization:" in q_lower or
# #             "parquet" in q_lower
# #         )

# #         # DASHBOARD BYPASS — DISABLED
# #         # "meglan" was a dashboard keyword which caused questions like
# #         # "give me meglan order" to route to dashboard instead of DB_QUERY
# #         # dashboard_keywords = ["meglan", "warnetix", "neuroeye", "system"]
# #         # is_dashboard_access = (
# #         #     any(kw in q_lower for kw in dashboard_keywords) and len(q_lower.split()) <= 4
# #         # ) or "access dashboard" in q_lower

# #         compact_history = []
# #         for msg in self.last_conversation_history[-self._max_history_messages:]:
# #             msg_content = getattr(msg, "content", "")
# #             if not isinstance(msg_content, str):
# #                 msg_content = str(msg_content)
# #             if len(msg_content) > self._max_message_chars:
# #                 msg_content = msg_content[:self._max_message_chars] + " ..."
# #             if isinstance(msg, HumanMessage):
# #                 compact_history.append(HumanMessage(content=msg_content))
# #             else:
# #                 compact_history.append(AIMessage(content=msg_content))

# #         question_text = self.question if isinstance(self.question, str) else str(self.question)
# #         if len(question_text) > self._max_message_chars:
# #             question_text = question_text[:self._max_message_chars] + " ..."

# #         mock_state = {
# #             "messages": compact_history + [HumanMessage(content=question_text)],
# #             "user_question": self.question,
# #             "user_id": str(self.user_id),
# #             "session_id": str(self.session_id) if self.session_id else None,
# #             "message_id": str(self.message_id) if self.message_id else None,
# #             "target_db_url": self.target_db_url,
# #             "result": [],
# #             "sql_query": "",
# #             "query_id": getattr(self, "last_query_id", None),
# #             "active_chart_id": None,
# #             "active_chart_name": None,
# #             "download_url": None
# #         }

# #         db_display_name = getattr(self, "db_display_name", "GISDB")
# #         paths = get_db_storage_paths(self.user_id, db_display_name)
# #         schema_file_path = paths["schema_file"] if paths else None

# #         if schema_file_path and not schema_file_path.exists():
# #             os.makedirs(os.path.dirname(str(schema_file_path)), exist_ok=True)
# #             try:
# #                 await self._extract_schema_cache(self.target_db_url, str(schema_file_path))
# #             except Exception as e:
# #                 print(f"⚠️ Schema extraction error: {e}")
# #                 pass

# #         if schema_file_path:
# #             mock_state["schema_path"] = str(schema_file_path)
# #             mock_state["vector_path"] = str(paths["vector_store"]) if paths else ""

# #         bypassed_state = None
# #         if is_create_chart:
# #             bypassed_state = await self._create_chart_node(mock_state)
# #         elif is_metric_fetch:
# #             clean_q = re.sub(
# #                 r'\(visualization:\s*[^)]+\)', '', self.question, flags=re.IGNORECASE
# #             )
# #             mock_state["user_question"] = re.sub(
# #                 r'- metric:\s*', '', clean_q, flags=re.IGNORECASE
# #             ).strip()
# #             bypassed_state = await self._fetch_chart_node(mock_state)
# #         # DASHBOARD BYPASS — DISABLED
# #         # elif is_dashboard_access:
# #         #     bypassed_state = await self._access_dashboard_node(mock_state)

# #         if bypassed_state:
# #             final_state = mock_state
# #             final_state.update(bypassed_state)
# #         else:
# #             print("nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn")
# #             workflow = StateGraph(AgentStateScehma)
# #             workflow.add_node("intent",           self._classify_intent)
# #             workflow.add_node("access_dashboard", self._access_dashboard_node)
# #             workflow.add_node("report_gen",       self._report_gen_node)
# #             workflow.add_node("fetch_chart",      self._fetch_chart_node)
# #             workflow.add_node("create_chart",     self._create_chart_node)
# #             workflow.add_node("schema",           self._schema_node)
# #             workflow.add_node("sql_gen",          self._sql_gen_node)
# #             workflow.add_node("verify",           self._verify_node)
# #             workflow.add_node("answer",           self._answer_node)
# #             workflow.add_node("analysis_plan",    self._analysis_plan_node)
# #             workflow.add_node("analysis_execute", self._analysis_execute_node)
# #             workflow.add_node("analysis_insight", self._analysis_insight_node)
# #             workflow.add_node("chat",             self._chat_node)
# #             workflow.add_node("followup",         self._followup_question_modify)
# #             workflow.add_node("manufacturing",    self._manufacturing_node)
# #             workflow.add_node("guided",           self._guided_node)

# #             workflow.add_edge(START, "intent")
# #             workflow.add_conditional_edges("intent", self._route_intent)
# #             for n in [
# #                        "schema","followup", "chat","create_chart", 
# #                        "analysis_plan", "guided", "manufacturing"
# #             ]:
# #                 workflow.add_edge(n, END)
# #             workflow.add_edge("schema",   "sql_gen")
# #             workflow.add_edge("sql_gen",  "verify")
# #             workflow.add_edge("verify",   "answer")
# #             workflow.add_edge("answer",   END)
# #             workflow.add_edge("followup", "schema")
# #             workflow.add_edge("chat",     END)
# #             workflow.add_edge("analysis_plan",    "analysis_execute")
# #             workflow.add_edge("analysis_execute", "analysis_insight")
# #             workflow.add_edge("analysis_insight", END)
# #             workflow.add_edge("guided", END)
# #             workflow.add_edge("manufacturing", END)

# #             graph = workflow.compile()
# #             input_state = mock_state
# #             input_state.update({"chunks_text": ""})
# #             final_state = input_state
# #             try:
# #                 async for step in graph.astream(input_state, stream_mode="values"):
# #                     final_state = step
# #             except Exception as e:
# #                 return {"langgraph_message": f"Execution halted: {str(e)}"}

# #         return self._package_final_response(final_state)

# #     # ══════════════════════════════════════════════════════════════════════════
# #     #  RESPONSE PACKAGER
# #     # ══════════════════════════════════════════════════════════════════════════
# #     def _package_final_response(self, state):
# #         messages = state.get("messages", [])
# #         ai_message_text = (
# #             messages[-1].content
# #             if messages and hasattr(messages[-1], 'content')
# #             else str(messages[-1]) if messages
# #             else "Error"
# #         )
        
# #         raw_results = state.get("result", [])
# #         clean_rows  = []
# #         columns     = []

# #         if raw_results:
# #             first_row = raw_results[0]
# #             if isinstance(first_row, dict): columns = list(first_row.keys())
# #             elif hasattr(first_row, "_mapping"): columns = list(first_row._mapping.keys())
# #             elif hasattr(first_row, "_asdict"): columns = list(first_row._asdict().keys())
# #             elif isinstance(first_row, (list, tuple)): columns = [f"Col_{i+1}" for i in range(len(first_row))]
# #             else: columns = ["Result"]
            
# #             for row in raw_results:
# #                 formatted_row = []
# #                 if isinstance(row, dict): items = row.items()
# #                 elif hasattr(row, "_mapping"): items = row._mapping.items()
# #                 elif hasattr(row, "_asdict"): items = row._asdict().items()
# #                 elif isinstance(row, (list, tuple)): items = enumerate(row)
# #                 else: items = [(0, row)]
                
# #                 for col_name, val in items:
# #                     if val is None:
# #                         formatted_row.append("")
# #                         continue
                        
# #                     col_str = str(col_name).lower()
                    
# #                     # 🚀 GEOJSON & DICT FORMATTING
# #                     if isinstance(val, (dict, list)):
# #                         try: val = json.dumps(val)
# #                         except: val = str(val)
# #                     elif isinstance(val, str) and '{"type"' in val:
# #                         try:
# #                             geo_data = json.loads(val)
# #                             if geo_data.get('type') == 'Point' and 'coordinates' in geo_data:
# #                                 val = f"Lng: {geo_data['coordinates'][0]}, Lat: {geo_data['coordinates'][1]}"
# #                         except:
# #                             pass
                    
# #                     # 🚀 DISTANCE FORMATTING
# #                     if "distance" in col_str and isinstance(val, (float, int, Decimal)):
# #                         try:
# #                             val = f"{round(float(val), 2)} km"
# #                         except:
# #                             pass
# #                     else:
# #                         try:
# #                             f_val = float(val)
# #                             if 1000000000000 < f_val < 3000000000000 and any(k in col_str for k in ['date', 'time', 'at', 'created', 'updated']):
# #                                 val = datetime.fromtimestamp(f_val / 1000.0).strftime('%Y-%m-%d %H:%M:%S')
# #                             elif 1000000000 < f_val < 3000000000 and any(k in col_str for k in ['date', 'time', 'at', 'created', 'updated']):
# #                                 val = datetime.fromtimestamp(f_val).strftime('%Y-%m-%d %H:%M:%S')
# #                         except (ValueError, TypeError):
# #                             pass
                            
# #                     formatted_row.append(str(val))
# #                 clean_rows.append(formatted_row)
        
# #         c_url = state.get("chart_url")
# #         if c_url:
# #             c_url = c_url.replace("standalone=1", "standalone=2")
# #             if "standalone=" not in c_url:
# #                 c_url += ("?" if "?" not in c_url else "&") + "standalone=2"
                
# #         last_sql = state.get('sql_query', '')
# #         query_id_str = str(state.get("query_id", ""))
        
# #         status = state.get("status")
# #         active_db = state.get("active_dashboard")
# #         db_url = state.get("dashboard_url")
# #         c_name = state.get("chart_name")
# #         c_id = state.get("id") or state.get("active_chart_id")
# #         dl_url = state.get("download_url") 
# #         session_cookie = state.get("session_cookie") 
# #         chart_json = state.get("chart_json") 
        
# #         return {
# #             "user_question": self.question,              # The final processed question
# #             "query": last_sql if last_sql else "",        # Raw SQL query executed
# #             "langgraph_message": ai_message_text,         # The AI's natural language response
# #             "result": clean_rows,                         # Full tabular data (unprocessed)
# #             "columns": columns,                           # Column headers
# #             "status": status,                             # UI state controller: DATA_LOADED, CHART_LOADED, ERROR
# #             "active_dashboard": active_db,                # Linked Superset dashboard name
# #             "dashboard_url": db_url,                      # iframe URL for dashboard
# #             "chart_url": c_url,                           # iframe URL for specific chart
# #             "chart_json": chart_json,                     # Plotly JSON for interactive charts
# #             "chart_name": c_name,                         # Title of the visualization
# #             "id": c_id,                                   # unique ID for the chart
# #             "download_url": dl_url,                       # CSV download link (Superset)
# #             "session_cookie": session_cookie,             # Auth cookie for iframe
# #             "chart_id": c_id,                              # Alias for 'id'
# #             "flag": state.get("flag", False)
# #         }





# ############################################################################################################################



# # from pydantic import BaseModel, Field
# # from thefuzz import fuzz
# # from datetime import datetime, date
# # import re
# # import asyncio
# # import json
# # import os
# # import csv
# # import uuid
# # from decimal import Decimal

# # from langchain_core.tools import tool
# # from langchain_core.documents import Document
# # from langchain_community.vectorstores import FAISS
# # from langchain_core.messages import AIMessage, HumanMessage, BaseMessage
# # from langgraph.graph.message import add_messages
# # from langgraph.graph import StateGraph, START, END

# # # SQLAlchemy imports for standalone schema extraction
# # from sqlalchemy import create_engine, MetaData, event
# # from sqlalchemy.schema import CreateTable
# # from sqlalchemy import text
# # import sqlalchemy.types as sqltypes


# # from app.services.superset_service import SupersetService
# # from app.core.path_utils import get_db_storage_paths

# # from app.schemas.agent_model_schema import (
# #     AgentStateScehma,
# #     RetreiveSchema,
# #     GenerateSqlScehma,
# #     VerifyQuerySchema,
# #     RetreiveSchemaSchema,
# #     GenerateSQLSchema,
# #     FixSQLSchema,
# #     AnalysisMode
# # )

# # from app.services.llama_model_init import GroqLLM


# # class SqlGraphQueryAgentBuilder:
# #     SEASON_MAP = {
# #         "summer":  {"months": [3, 4, 5],    "label": "Summer (Mar-May)"},
# #         "monsoon": {"months": [6, 7, 8, 9], "label": "Monsoon (Jun-Sep)"},
# #         "winter":  {"months": [11, 12, 1, 2],"label": "Winter (Nov-Feb)"},
# #         "rainy":   {"months": [6, 7, 8, 9], "label": "Rainy (Jun-Sep)"},
# #     }

# #     def __init__(
# #         self,
# #         question: str = None,
# #         user_id: str = None,
# #         user_db_source=None,
# #         active_api_key: str = None,
# #         llm=None,
# #         db_repo=None,
# #         user_db_repo=None,
# #         api_key_service=None,
# #         vectorstore=None,
# #         chunks=None,
# #         dangerous_commands=None,
# #         last_conversation_history: list = None,
# #         session_id: str = None,
# #         message_id: str = None,
# #         target_db_url: str = None,
# #         db_drive: str = "sqlite",
# #         db_display_name: str = "GISDB",
# #         superset_service=None,
# #         stream_callback=None
# #     ):
# #         self.question = question
# #         self.user_id = user_id
# #         self.user_db_source = user_db_source
# #         self.active_api_key = active_api_key
# #         self.results = []
# #         self.llm = llm
# #         self.db_repo = db_repo
# #         self.user_db_repo = user_db_repo
# #         self.api_key_service = api_key_service
# #         self.vectorstore = vectorstore
# #         self.chunks = chunks
# #         self.dangerous_commands = dangerous_commands or ["drop", "delete", "truncate", "alter"]
# #         self.last_conversation_history = last_conversation_history or []
# #         self.session_id = session_id
# #         self.message_id = message_id
# #         self.last_query_id = None
# #         self.target_db_url = target_db_url
# #         self.db_drive = db_drive
# #         self.db_display_name = db_display_name
# #         self.stream_callback = stream_callback

# #         if superset_service is None:
# #             self.superset_service = SupersetService(
# #                 host="starai.local:8088", username="admin", password="admin"
# #             )
# #         else:
# #             self.superset_service = superset_service
            
# #         self._max_history_messages = 4
# #         self._max_message_chars = 500
# #         self._max_history_chars = 1500
# #         self._max_prompt_chars = 15000
# #         self._max_schema_chars = 10000
# #         self._max_hybrid_chars = 5000
        
# #         # ══════════════════════════════════════════════════════════════════════
# #         #  🧠 CORE LLM PROMPTS
# #         # ══════════════════════════════════════════════════════════════════════
# #         self.CONVERSATIONPROMPT = """
# # SYSTEM: You are a high-intelligence Maritime Intent Classifier.
# # Output ONLY one label from the list below.

# # USER QUESTION: "{question}"
# # CONTEXT: {conversation}

# # LABELS:
# # - DB_QUERY: Standard data retrieval, finding locations, distances, nearest land, nearby ships/boat, or waypoint details.
# # - ANALYSIS: Requests for trends, forecasts, complex business logic, fuel usage, or long-term travel analysis.
# # - CREATE_CHART: Explicit request for a visual graph or plot.
# #  - ACCESS_DASHBOARD: Requests to open or link a Superset dashboard.
# # - CHAT: Greetings, small talk, or general non-database questions.
# # - MANUFACTURING: User wants to manufacture, assemble, build, order, or produce projects/products.
# #     Requires BOM/material availability calculation.
# #     Examples:
# #         - "Build 3 Meglan"
# #         - "Can we manufacture 10 EBM 20?"
# #         - "How many EBM 40 can we assemble?"
# #         - "Do we have enough materials for 5 Meglan?"
# # - GUIDED: Use this when the user question is vague, ambiguous, uses undefined jargon,
# #     references entities/columns/tables NOT clearly part of the database domain,
# #     or cannot be mapped to a concrete SQL query without guessing.
# #     Also use this when the question is partially database-related but missing critical
# #     details needed to generate a meaningful query.
# #     Examples:
# #         - "Show me everything" (too vague)
# #         - "What is the xyz value?" (unknown column/entity)
# #         - "Give me the report" (no specifics)
# #         - "What is the current status?" (ambiguous)
# #     Do NOT use GUIDED for questions that are specific enough to attempt a SQL query.

# # RULE: If the question involves "location", "distance", "lat/lon", "where is", or "nearest", label it DB_QUERY.
# # """

# #         self.CHATNODEPROMPT = """
# # You are STAR-AI, a professional database assistant built by BrainBox Tardid.
# # Previous conversation:
# # {conversation}
# # User question: {question}
# # Rules:
# # - You cannot modify the database.
# # - No web search allowed.
# # - Only answer questions related to the connected database.
# # - For off-topic questions, politely refuse.
# # - Keep replies concise and professional.
# # """
# #         self.FOLLOWUPQUESTIONMODIFYPROMPT = """
# # SYSTEM: Output ONLY a single rewritten question. No explanation. No labels.
# # Given the conversation and the current user question, merge them into one
# # complete, self-contained question suitable for a SQL database assistant.
# # Conversation:
# # {conversation}
# # Current user question: {user_question}
# # Output: (single question only)
# # """
# #         self.SQLANALYSISPROMPT = """
# # You are STAR-AI, a professional database assistant built by BrainBox Tardid.
# # User question: {user_question}
# # This database has no information related to what the user is asking.
# # Reply professionally. Do not mention any SQL query.
# # """
# #         self.SQLFAILEDANALYSISPROMPT = """
# # You are STAR-AI, a professional database assistant built by BrainBox Tardid.
# # User question: {user_question}
# # A SQL query could not be generated or executed for this request.
# # Reply professionally, suggest the user ask simpler questions, and give 2-3 example questions you can answer.
# # """
# #         self.SQLNORESULTANALYSISPROMPT = """
# # You are STAR-AI, a professional database assistant built by BrainBox Tardid.
# # User question: {user_question}
# # The query returned zero rows.
# # - Provide insights on why the result might be empty.
# # - Suggest 2-3 follow-up questions (use format "Do you want me to..." / "Would you like me to...").
# # - Do NOT mention any SQL query.
# # - Do NOT reply in a table format.
# # - Do NOT tell the user to check the data themselves.
# # """
# #         self.SQLRESULTANALYSISPROMPT = """
# # SYSTEM: You are STAR-AI, a Senior Maritime Data Analyst built by BrainBox Tardid.
# # The user asked: "{user_question}"
# # Rows retrieved: {row_count}

# # TASK:
# # 1. The data is already displayed in the UI. Do NOT list or invent data rows.
# # 2. If location data is present, mention it conceptually.
# # 3. Suggest 2-3 logical follow-up questions (format: "Do you want me to..." / "Would you like me to...").

# # STRICT RULES:
# # - Follow-up questions must be answerable by SQL only.
# # - Do NOT say "Based on the database..." or "Here is the information:".
# # - Do NOT mention SQL, tables, or database internals.
# # - Do NOT invent data.
# # """
# #         self.DASHBOARD_REPORT_PROMPT = """
# # You are a Senior Business Data Analyst for STAR AI.
# # Write a professional Executive Report based on the '{db_name}' dashboard context.
# # {dashboard_context}
# # Use Markdown styling, emojis (📊, 📈, 💡), and bullet points.
# # Make it professional and ready for leadership.
# # Current request: {user_question}
# # """
# #         self.FILTER_EXTRACTION_PROMPT = """
# # SYSTEM: Output ONLY a valid JSON array. No markdown. No explanation.
# # Extract ONLY explicit data constraints or time ranges from this user request: '{user_question}'
# # Current Date for Reference: {current_date_str}
# # RULES:
# # 1. Output a JSON ARRAY of filter objects with keys: "col", "op", "val"
# # 2. Operators allowed: "==", "!=", ">=", "<=", "LIKE"
# # 3. Translate natural time into ">=" and "<=" filters on the 'date' column.
# # 4.  CRITICAL: Do NOT extract chart IDs, dashboard names, or visualization types (e.g. 'ID: 42', 'viz: None') as filters. Only extract constraints on actual database data.
# # 5. If no real data filters are explicitly requested, return exactly: []
# # FORMAT: JSON array only. Nothing else.
# # """
# #         self.CHART_ANALYSIS_PROMPT = """
# # You are STAR AI, an elite Business Data Analyst built by Tardid Technologies.
# # Chart name: '{chart_name}' (ID: {chart_id})
# # User question: '{question}'
# # {filter_context}
# # Raw data powering this chart:
# # Columns: {headers}
# # Data Sample (Top 10 rows): {clean_data_sample}
# # Provide a professional, highly analytical response based ONLY on this data.

# # CRITICAL INSTRUCTION: You MUST divide your response into EXACTLY these four sections using these exact markdown headers:
# # ## Executive Summary
# # ## Key Findings
# # ## Recommendations
# # ## Action Plan

# # Use Markdown formatting, bullet points, and highlight key insights.
# # """        


# #     def _robust_extract_output(self, raw_str: str, table_list: list = None) -> str:
# #         clean = re.sub(r'```json\s*|\s*```|`', '', raw_str).strip()
# #         if table_list is not None:
# #             if "NEED_VIRTUAL_DATASET" in clean:
# #                 return "NEED_VIRTUAL_DATASET"
# #             for t in table_list:
# #                 if t.lower() in clean.lower():
# #                     return t
# #             return "NEED_VIRTUAL_DATASET"
# #         match = re.search(r'\{.*?\}', clean, re.DOTALL)
# #         if match:
# #             json_text = match.group()
# #             json_text = re.sub(r',\s*([\}\]])', r'\1', json_text)
# #             return json_text
# #         return clean

# #     def _extract_sql(self, raw_str: str) -> str:
# #         clean = re.sub(r'```sql\s*|\s*```|`', '', raw_str, flags=re.IGNORECASE).strip()
# #         match = re.search(r'(?i)\b(SELECT|WITH)\b.*', clean, re.DOTALL)
# #         if match:
# #             sql = match.group(0).strip()
# #             return sql.rstrip(';') + ';'
# #         return clean

# #     def get_system_prompt_for_db(self, driver: str) -> str:
# #         driver = driver.lower() if driver else "postgresql"
        
# #         dialect_rules = {
# #             "postgresql": (
# #                 "CRITICAL SPATIAL RULES FOR POSTGIS (INDIA WEST + AIS DATA):\n"
# #                 "0. PURE GEOMETRY: If explicitly asking for distance between named places, use `ST_Distance(a.geom::geography, b.geom::geography) / 1000.0 AS distance_km`.\n"
# #                 "1. OWN BOAT CURRENT LOCATION: Query `gps_tracking` using `ORDER BY created_at DESC LIMIT 1`. SELECT `gt.*` PLUS `ST_AsGeoJSON(ST_SetSRID(ST_Point(gt.longitude, gt.latitude), 4326)) AS geojson`.\n"
# #                 "2. CURRENT LOCATION BY WAYPOINT: Query `gps_tracking` using `WHERE waypoint_id = X ORDER BY created_at DESC LIMIT 1`.\n"
# #                 "3. NEAREST LAND POINT: Use a CTE to fetch the boat's location, then UNION ALL `india_west_places`, `india_west_transport`, and `india_west_natural`. ORDER BY distance ASC LIMIT 1.\n"
# #                 "4. TARGET TABLE MATCHING: 'city'->places, 'port'->transport, 'beach'->natural, 'ship'->ais_data.\n"
# #                 "5. DISTANCE APPEND: MUST append `ST_Distance(target.geom::geography, boat.geom::geography) / 1000.0 AS distance_km`.\n"
# #                 "6. FORWARD-ONLY CORRIDOR: If asking for targets 'ahead', build a corridor: `WITH boat AS (SELECT ST_SetSRID(ST_Point(gt.longitude, gt.latitude), 4326)::geography AS geom, n.heading FROM gps_tracking gt JOIN navigation n ON gt.waypoint_id = n.waypoint_id ORDER BY gt.created_at DESC LIMIT 1), projected AS (SELECT ST_MakeLine(boat.geom::geometry, ST_Project(boat.geom, 50000, radians(boat.heading))::geometry)::geography AS path FROM boat)`.\n"
# #                 "7. AUTOMATIC ROUTE GENERATION: `ST_AsGeoJSON(ST_Segmentize(ST_MakeLine(current_boat.geom::geometry, nearest_ship.geom::geometry)::geography, 5000)::geometry) AS waypoints_geojson`.\n"
# #                 "8. PREDICTIVE TRAJECTORY: `ST_AsGeoJSON(ST_Project(ST_SetSRID(ST_Point(longitude, latitude), 4326)::geography, (navigation.speed * 0.514444) * (X * 60), radians(navigation.heading))::geometry)`.\n"
# #                 "9. TRIGGER KEYWORDS ['instability', 'roll', 'pitch']: `SELECT gt.created_at, n.roll, n.pitch, e.wind_speed, CASE WHEN n.roll > 15 OR n.pitch > 10 THEN 'High Instability Alert' ELSE 'Stable' END AS status FROM gps_tracking gt JOIN navigation n ON gt.waypoint_id = n.waypoint_id LEFT JOIN environment e ON gt.waypoint_id = e.waypoint_id ORDER BY gt.created_at DESC LIMIT 1;`\n"
# #                 "10. DYNAMIC GEOFENCING: CROSS JOIN `projected` and use `WHERE ST_DWithin(projected.path, target.geom::geography, 2000)`.\n"
# #                 "11. TRIGGER KEYWORDS ['bypass', 'detour', 'offset']: `WITH cb AS (SELECT ST_SetSRID(ST_Point(longitude, latitude), 4326)::geometry AS geom FROM gps_tracking ORDER BY created_at DESC LIMIT 1), ns AS (SELECT DISTINCT ON (mmsi) ST_SetSRID(ST_Point(longitude, latitude), 4326)::geometry AS geom FROM ais_data ORDER BY mmsi, created_at DESC LIMIT 1) SELECT ST_AsGeoJSON(ST_OffsetCurve(ST_MakeLine(cb.geom, ns.geom), 5000)) AS safe_bypass_geojson FROM cb CROSS JOIN ns;`\n"
# #                 "12. TRIGGER KEYWORDS ['dark vessel', 'alerts', 'hostile']: `WITH boat AS (...), projected AS (...) SELECT dva.scenario, ais.mmsi FROM dark_vessel_alerts dva JOIN ais_data ais ON dva.mmsi = ais.mmsi CROSS JOIN projected WHERE ST_DWithin(projected.path, ST_SetSRID(ST_Point(ais.longitude, ais.latitude), 4326)::geography, 2000);`\n"
# #                 "13. TRIGGER KEYWORDS ['engine_effort', 'engine effort', 'thruster']: For dynamic geofencing with engine load, USE EXACTLY: `SELECT gt.created_at, e.thruster_position, n.name AS zone_name FROM gps_tracking gt JOIN engine e ON gt.waypoint_id = e.waypoint_id CROSS JOIN india_west_natural n WHERE n.fclass ILIKE '%beach%' AND e.thruster_position > 0.8 AND ST_DWithin(ST_SetSRID(ST_Point(gt.longitude, gt.latitude), 4326)::geography, n.geom::geography, 2000) ORDER BY gt.created_at DESC LIMIT 1;` Adjust fclass and threshold based on user prompt.\n"
# #                 "14. TRIGGER KEYWORDS ['will pass within', 'intercept', 'hit in the next']: For predictive time-to-intercept, use speed * time. USE EXACTLY: `WITH boat AS (SELECT ST_SetSRID(ST_Point(gt.longitude, gt.latitude), 4326)::geography AS geom, n.heading, n.speed FROM gps_tracking gt JOIN navigation n ON gt.waypoint_id = n.waypoint_id ORDER BY gt.created_at DESC LIMIT 1), projected AS (SELECT ST_MakeLine(boat.geom::geometry, ST_Project(boat.geom, (boat.speed * 0.514444) * (30 * 60), radians(boat.heading))::geometry)::geography AS path FROM boat) SELECT t.name, t.fclass, ST_Distance(boat.geom, t.geom::geography)/1000.0 AS current_dist_km FROM india_west_transport t CROSS JOIN projected WHERE t.fclass ILIKE '%railway%' AND ST_DWithin(projected.path, t.geom::geography, 5000);` Replace 30*60 with requested time in seconds.\n"
# #                 "15. TRIGGER KEYWORDS ['anomaly in motion', 'unstable while within', 'struggling']: For historical anomaly correlation, DO NOT USE LIMIT 1. USE EXACTLY: `SELECT gt.created_at, gt.latitude, gt.longitude, n.roll, n.pitch, nat.name AS location_name FROM gps_tracking gt JOIN navigation n ON gt.waypoint_id = n.waypoint_id CROSS JOIN india_west_natural nat WHERE nat.name ILIKE '%ACHRA BEACH%' AND (n.roll > 15 OR n.pitch > 10) AND ST_DWithin(ST_SetSRID(ST_Point(gt.longitude, gt.latitude), 4326)::geography, nat.geom::geography, 2000) ORDER BY gt.created_at DESC;` Adjust target name based on prompt.\n"
# #                 "16. TRIGGER KEYWORDS ['safety buffer', 'minimum approach', 'closer than']: For port safety corridors, exclude docking status. USE EXACTLY: `SELECT gt.created_at, t.name AS port_name, ST_Distance(ST_SetSRID(ST_Point(gt.longitude, gt.latitude), 4326)::geography, t.geom::geography) AS distance_meters FROM gps_tracking gt JOIN waypoints w ON gt.waypoint_id = w.id CROSS JOIN india_west_transport t WHERE t.fclass ILIKE '%port%' AND ST_DWithin(ST_SetSRID(ST_Point(gt.longitude, gt.latitude), 4326)::geography, t.geom::geography, 500) AND w.status != 'Docking' ORDER BY gt.created_at DESC;`\n"
# #             ),
# #             "mariadb": "Use standard ANSI SQL syntax.",
# #             "mysql": "Use standard ANSI SQL syntax.",
# #             "sqlite": "Use standard ANSI SQL syntax.",
# #             "mssql": "Use standard ANSI SQL syntax."
# #         }
# #         selected_rules = dialect_rules.get(driver, "Use standard ANSI SQL syntax.")
        
# #         prompt = f"""
# # SYSTEM: You are an expert {driver.upper()} and PostGIS Maritime Analyst.
# # Write a read-only SQL query based ONLY on these schema chunks:
# # {{chunks_text}}

# # USER QUESTION: {{question}}

# # GENERAL CRITICAL RULES:
# # * Write ONLY valid {driver.upper()} SQL.
# # * NO explanations. Do not speak English.
# # * DO NOT INVENT TABLE OR COLUMN NAMES. Never assume standard names like 'sales' or 'orders' exist.
# # * Use correct table and column names exactly as shown in the schema.
# # * Use double quotes for columns/tables with spaces, special characters, or capitalized names (e.g. `"Category"`).
# # * Do not return markdown fences like ```sql or `. Just return the raw SQL query.
# # * Prefer LEFT JOIN when unsure.
# # * If the question is completely unrelated to the schema, return "select 1 where false;" without explanation.
# # * Do not return an empty response, always return either a valid SQL query or "select 1 where false;"
# # * When using Order by, use NULLS LAST
# # * 🚀 "DETAILS" REQUESTS: If the user asks for "details of [table] id [X]", interpret this as: SELECT * FROM [table] WHERE id = [X];

# # UNIVERSAL JOIN RULES:
# # 1. Join on PK-FK pairs shown in schema chunks.
# # 2. If explicit relations shown (A.col ↔ B.col), join on those columns.
# # 3. If no FK relation shown, join ONLY on same-named columns with clearly same meaning.

# # DIALECT SPECIFIC RULES ({driver.upper()}):
# # {selected_rules}

# # Write ONLY the raw {driver.upper()} SQL query starting with SELECT or WITH.
# # """
# #         return prompt

# #     def get_error_fixing_prompt(self, driver: str) -> str:
# #         driver = driver.lower() if driver else "postgresql"
# #         display_name = {"mariadb": "MariaDB", "postgresql": "PostgreSQL", "mysql": "MySQL", "sqlite": "SQLite", "mssql": "MS SQL Server"}.get(driver, driver.upper())
# #         return f"""
# #         You are an expert {display_name} SQL query corrector.
# #         Inputs:
# #         1. User Question: {{user_question}}
# #         2. Database Schema: {{chunks_text}}
# #         3. Error Message: {{error}}
# #         4. Incorrect SQL Query: {{sql}}
        
# #         Rules:
# #             1. Timestamp / Date Handling
# #                 Use CURRENT_TIMESTAMP or NOW() for current time.
# #                 Use CURRENT_DATE for today's date.
# #                 Use DATE_TRUNC('day', column) to truncate timestamps.
# #                 Use column::date to convert timestamp to date.
# #                 Use column + INTERVAL '1 day' for date arithmetic.
# #                 Use EXTRACT(YEAR FROM column_name), EXTRACT(MONTH FROM column_name) to extract month, year etc
# #                 Do not use year = **** or month = **
# #             2. PostGIS / Spatial Error Handling
# #                 If the error mentions spatial signatures (like ST_Distance matching), ensure you cast columns with ::geography.
# #                 If generating a point, always ensure the SRID is set: ST_SetSRID(ST_Point(lon, lat), 4326).
# #                 Remember ST_Point takes longitude first, latitude second.
                
# #         Task:
# #         - Correct the query so that it runs successfully on the given {display_name} schema.
# #         - Make sure the query accurately answers the user question.
# #         - Output ONLY the raw SQL query. NO markdown fences. NO text. Start directly with SELECT.
# #         """

# #     def _get_history_string(self) -> str:
# #         history_texts = []
# #         for msg in self.last_conversation_history:
# #             if hasattr(msg, 'content'):
# #                 history_texts.append(msg.content)
# #             else:
# #                 history_texts.append(str(msg))
# #         return "\n\n".join(history_texts)

# #     # ============================================
# #     # ASYNC HELPER: LLM Call with Rate Limit Handling
# #     # ============================================
# #     async def _call_llm_with_retry(self, prompt: str, attempt=1, max_attempts=3, stream_to_ui: bool = False) -> str:
# #         import re
# #         from datetime import datetime, timedelta 

# #         try:
# #             if stream_to_ui and self.stream_callback and hasattr(self.llm, "astream_text"):
# #                 parts = []
# #                 async for part in self.llm.astream_text(prompt):
# #                     parts.append(part)
# #                     try:
# #                         self.stream_callback(part)
# #                     except Exception:
# #                         pass
# #                 response = "".join(parts)
# #             else:
# #                 if asyncio.iscoroutinefunction(self.llm.invoke):
# #                     response = await self.llm.invoke(prompt)
# #                 else:
# #                     loop = asyncio.get_event_loop()
# #                     response = await loop.run_in_executor(None, self.llm.invoke, prompt)
            
# #             await self.api_key_service.update_api_key_status(
# #                 api_key=self.active_api_key,
# #                 param={"last_used_at": datetime.now()} 
# #             )
            
# #             if isinstance(response, str):
# #                 return response
# #             return response.content.strip()

# #         except Exception as e:
# #             error_str = str(e).lower()
            
# #             # 🛑 Handle Rate Limit & 413 Payload Errors
# #             if (
# #                 "request too large" in error_str
# #                 or "requested" in error_str and "tokens per minute" in error_str
# #                 or "request_too_large" in error_str
# #                 or "request entity too large" in error_str
# #                 or "413" in error_str
# #                 or "rate limit" in error_str 
# #                 or "429" in error_str 
# #                 or "please try again in" in error_str
# #             ) and attempt < max_attempts:
# #                 print(f"⚠️ Payload/Rate limit hit on attempt {attempt}. Attempting API key switch and prompt shrink...")
                
# #                 smaller_prompt = prompt[: max(1000, int(len(prompt) * 0.5))]
                
# #                 new_api_key, msg = await self.api_key_service.get_retry_api_key_logic(
# #                     api_key=self.active_api_key, error_detail=str(e)
# #                 )

# #                 if not new_api_key or attempt >= max_attempts:
# #                     wait_seconds = 60 
# #                     match = re.search(r"try again in ([\d\.]+)s", error_str)
# #                     if match:
# #                         wait_seconds = float(match.group(1))
                    
# #                     next_available = (datetime.now() + timedelta(seconds=wait_seconds)).strftime("%H:%M:%S")
                    
# #                     return (f"⚠️ **API Request Limited.**\n\n"
# #                             f"The data request was too large or all keys are limited. "
# #                             f"The system will be available again at **{next_available}**.")

# #                 self.active_api_key = new_api_key
# #                 self.llm = GroqLLM(api_key=new_api_key)
# #                 return await self._call_llm_with_retry(
# #                     smaller_prompt, attempt=attempt + 1, max_attempts=max_attempts, stream_to_ui=stream_to_ui
# #                 )
# #             else:
# #                 raise

# #     def _clean_relations(self, chunks_text: str) -> str:
# #         tables = set(re.findall(r"TABLE:\s*(\w+)", chunks_text, re.IGNORECASE))
# #         cleaned_blocks = []
# #         current_block = []
# #         in_relations = False
# #         seen_relations = set()
# #         for line in chunks_text.split("\n"):
# #             line_strip = line.strip()
# #             if line_strip.startswith("TABLE:"):
# #                 if current_block:
# #                     cleaned_blocks.append("\n".join(current_block))
# #                 current_block = [line]
# #                 in_relations = False
# #                 continue
# #             if line_strip.startswith("RELATIONS:"):
# #                 current_block.append(line)
# #                 in_relations = True
# #                 continue
# #             if in_relations and ("->" in line or "↔" in line):
# #                 matches = re.findall(r"(\w+)\.(\w+)", line)
# #                 if len(matches) >= 2:
# #                     (left_table, left_col), (right_table, right_col) = matches[0], matches[1]
# #                     if left_table in tables and right_table in tables:
# #                         relation_key = tuple(sorted([
# #                             f"{left_table}.{left_col}",
# #                             f"{right_table}.{right_col}"
# #                         ]))
# #                         if relation_key not in seen_relations:
# #                             seen_relations.add(relation_key)
# #                             current_block.append(line)
# #                 continue
# #             current_block.append(line)
# #         if current_block:
# #             cleaned_blocks.append("\n".join(current_block))
# #         return "\n\n".join(cleaned_blocks)

# #     def _hybrid_retrieve(self, question: str) -> str:
# #         v_store = getattr(self, 'vectorstore', None)

# #         if v_store is None:
# #             return "Error: Vectorstore is not initialized."

# #         sem_docs = v_store.as_retriever(search_kwargs={"k": 50}).invoke(question)
# #         candidates = {d.metadata.get("table", "unknown"): d for d in sem_docs}.values()

# #         q = question.lower()
# #         scored = []
        
# #         keyword_map = {
# #             "gps_tracking": ["current location", "where will", "closer than", "minimum approach", "coordinate", "history", "tracking"],
# #             "navigation": ["speed", "heading", "pitch", "roll", "predict", "trajectory", "instability", "unstable", "struggling"],
# #             "engine": ["thruster", "efficiency", "engine", "engine_effort", "effort"],
# #             "waypoints": ["waypoint", "route", "path", "status", "docking", "mission"],
# #             "dark_vessel_alerts": ["dark vessel", "danger", "alert", "threat", "historical dark vessel"],
# #             "ais_data": ["ship", "ships", "vessel", "intercept"],
# #             "india_west_places": ["city", "town", "village", "island", "density", "zone"],
# #             "india_west_transport": ["airport", "railway", "ferry", "station", "port", "buffer", "approach", "infrastructure"],
# #             "india_west_natural": ["beach", "reef", "coast", "sanctuary", "rocky", "shallows", "restricted"]
# #         }

# #         for doc in candidates:
# #             table = doc.metadata.get("table", "").lower()
# #             content = doc.page_content.lower()

# #             score = 0
# #             column_hits = 0
# #             columns = [col.strip() for col in content.split(",") if col.strip()]

# #             for col in columns:
# #                 ratio = fuzz.partial_ratio(col, q)
# #                 if ratio > 85:
# #                     score += 3
# #                     column_hits += 1
# #                 elif ratio > 70:
# #                     score += 2
# #                     column_hits += 1

# #             table_ratio = fuzz.partial_ratio(table, q)
# #             if table_ratio > 85: score += 3
# #             elif table_ratio > 70: score += 2

# #             if column_hits > 0 and table_ratio > 70: score += 2
                
# #             for t_name, keywords in keyword_map.items():
# #                 if table == t_name and any(k in q for k in keywords):
# #                     score += 15 

# #             scored.append((score, doc))

# #         scored.sort(reverse=True, key=lambda x: x[0])
# #         if not scored: return ""
# #         top_score = scored[0][0]

# #         final_docs = [doc for score, doc in scored if score >= max(2, top_score * 0.3)]

# #         if len(final_docs) < 5 and len(scored) >= 5:
# #             final_docs = [doc for _, doc in scored[:5]]
# #         elif not final_docs:
# #             final_docs = [doc for _, doc in scored[:3]]

# #         return "\n\n".join(d.page_content for d in final_docs)

# #     async def _verify_query(self, sql: str, state: dict, target_db_url: str = None):
# #         session_id = state.get("session_id")
# #         message_id = state.get("message_id")
# #         user_id = state.get("user_id")
# #         db_url = target_db_url or state.get("target_db_url")
# #         self.results = []
# #         error_msg = None
# #         csv_path_str = None
# #         try:
# #             if db_url:
# #                 sync_url = (
# #                     db_url.replace("+asyncpg", "")
# #                     .replace("+aiosqlite", "")
# #                     .replace("+aiomysql", "+pymysql")
# #                     .replace("+asyncmy", "+pymysql")
# #                     .replace("+aioodbc", "+pyodbc")
# #                 )
# #                 def _direct_execute():
# #                     print(f"DEBUG: Executing SQL: {sql}")
# #                     masked_url = re.sub(r':([^@/]+)@', ':***@', sync_url)
# #                     print(f"DEBUG: Connecting to: {masked_url}")
# #                     engine = create_engine(sync_url)
# #                     with engine.connect() as conn:
# #                         ctx = conn.execute(text("SELECT current_user, current_schema()")).fetchone()
# #                         print(f"DEBUG: DB CONTEXT: user={ctx[0]}, schema={ctx[1]}")
# #                         result = conn.execute(text(sql))
# #                         keys = list(result.keys())
# #                         rows = result.fetchall()
# #                         print(f"DEBUG: Keys: {keys}, Row count: {len(rows)}")
# #                         return keys, rows
# #                 loop = asyncio.get_event_loop()
# #                 keys, rows = await loop.run_in_executor(None, _direct_execute)
# #                 print(f"DEBUG: TOTAL ROWS FETCHED: {len(rows)}")
# #                 self.results = []
# #                 for row in rows:
# #                     print(f"DEBUG: RAW ROW FROM DB: {row}")
# #                     print(f"DEBUG: Processing row: {row}")
# #                     new_row = {}
# #                     for idx, key in enumerate(keys):
# #                         val = row[idx]
# #                         if isinstance(val, Decimal):
# #                             new_row[str(key)] = float(val)
# #                         elif isinstance(val, (datetime, date)):
# #                             new_row[str(key)] = val.isoformat()
# #                         elif isinstance(val, uuid.UUID):
# #                             new_row[str(key)] = str(val)
# #                         else:
# #                             new_row[str(key)] = val
# #                     self.results.append(new_row)
# #             else:
# #                 error_msg = "No target database URL found. Please star a database."
# #         except Exception as e:
# #             print(f"❌ Error in _verify_query: {e}")
# #             self.results = []
# #             error_msg = str(e)

# #         return "successfully" if not error_msg else f"Error: {error_msg}"

# #     # ══════════════════════════════════════════════════════════════════════════
# #     #  LANGGRAPH NODES
# #     # ══════════════════════════════════════════════════════════════════════════
# #     async def _classify_intent(self, state: AgentStateScehma) -> dict:
# #         question = state["user_question"]
# #         active_db = state.get("active_dashboard", "None")
# #         conversation = self._get_history_string()
# #         prompt = self.CONVERSATIONPROMPT.format(
# #             active_dashboard=active_db,
# #             conversation=conversation,
# #             question=question
# #         )
# #         intent = await self._call_llm_with_retry(prompt)
        
# #         intent = self._robust_extract_output(intent)
# #         for valid_intent in [
# #             "ACCESS_DASHBOARD", "GENERATE_REPORT", "FETCH_CHART", "DB_QUERY",
# #             "FOLLOW_UP_SQL", "CHAT", "ANALYZE_CHART", "CREATE_CHART",
# #             "ANALYSIS", "ANALYTICS", "MANUFACTURING", "GUIDED"
# #         ]:
# #             if valid_intent in intent.upper():
# #                 intent = valid_intent
# #                 break
# #         return {
# #             "intent": intent,
# #             "user_question": (
# #                 state["messages"][-1].content
# #                 if hasattr(state["messages"][-1], 'content')
# #                 else str(state["messages"][-1])
# #             )
# #         }

# #     def _route_intent(self, state: AgentStateScehma) -> str:
# #         q_raw = str(state.get("user_question", "")).lower().strip()
# #         q = q_raw.strip('"\'') 
# #         intent = str(state.get("intent", "")).upper()
        
# #         # 🚀 ADVANCED ROUTING FIX: Catch anomalies, predictions, and routing
# #         sql_keywords = [
# #             "distance", "disttnace", "dist", "check", "generate a route", 
# #             "predict", "instability", "safe bypass", "where will", "anomaly",
# #             "dark vessel", "fences", "restricted area", "buffer", "engine effort"
# #         ]
# #         coord_pattern = r'(\d+\.?\d*)\s*,\s*(\d+\.?\d*)'
        
# #         if len(re.findall(coord_pattern, q)) >= 2 or any(word in q for word in sql_keywords):
# #             return "schema"

# #         # 🏭 MANUFACTURING intent routing
# #         if "MANUFACTURING" in intent or any(kw in q for kw in ["manufacture", "assemble", "build", "ebm", "meglan"]):
# #             return "manufacturing"

# #         # 🧭 GUIDED intent routing
# #         if "GUIDED" in intent:
# #             return "guided"
            
# #         if "dashboard" in q or "ACCESS_DASHBOARD" in intent:
# #             return "access_dashboard"
            
# #         if q.startswith("chart[") or "viz:" in q or q.startswith("- metric:"):
# #             clean_name = re.sub(r'(?i)^chart\[\d+\]:\s*', '', state["user_question"])
# #             clean_name = re.sub(r'(?i)- metric:\s*', '', clean_name)
# #             clean_name = re.sub(r'(?i)\s*\(id:.*', '', clean_name)
# #             clean_name = re.sub(r'(?i)\s*\(viz:.*', '', clean_name)
# #             state["user_question"] = clean_name.strip()
# #             return "fetch_chart"

# #         if "REPORT" in intent or "2" in intent:  return "report_gen"
        
# #         if "CREATE" in intent or "8" in intent or any(kw in q for kw in ["chart", "graph", "plot", "viz"]):  
# #             return "create_chart"

# #         words = q.split()
# #         if "QUERY" in intent or "4" in intent or any(w in words for w in ["count", "list", "show", "retrieve", "get"]):  
# #             return "schema"

# #         if "FETCH"  in intent or "3" in intent:  return "fetch_chart"
# #         if "FOLLOW" in intent or "5" in intent:  return "followup"
        
# #         return "chat"

# #     # ── MANUFACTURING ─────────────────────────────────────────────────────────
# #     async def _manufacturing_node(self, state: AgentStateScehma) -> dict:
# #         """
# #         Handle BOM-based manufacturing feasibility checks.
# #         Checks material availability in the procurement_table for known projects.
# #         """
# #         BOM_REQUIREMENTS = {
# #             "Meglan": {
# #                 "Sensors": 2,
# #                 "Computing": 1,
# #                 "Propulsion": 1,
# #                 "Hull": 5,
# #                 "Fasteners": 2,
# #                 "Cabling": 3,
# #                 "Communication": 1
# #             },
# #             "EBM 20": {
# #                 "Motor": 1,
# #                 "Battery": 4,
# #                 "Controller": 1,
# #                 "Harness": 1,
# #                 "Cooling": 1
# #             },
# #             "EBM 40": {
# #                 "Motor": 1,
# #                 "Battery": 1,
# #                 "Controller": 1,
# #                 "Cooling": 1,
# #                 "Propulsion": 1
# #             }
# #         }

# #         question = state["user_question"]

# #         prompt = f"""
# # Extract manufacturing request.

# # USER QUESTION:
# # {question}

# # Available projects:
# # - Meglan (a boat)
# # - EBM 20 (a motor)
# # - EBM 40 (a motor)

# # Return ONLY JSON:

# # {{
# #     "project": "...",
# #     "quantity": 1
# # }}

# # If the user does not specify a quantity, return quantity 1.
# # If the project is not in the available list, return
# # {{
# #     "project": "UNKNOWN",
# #     "message": "the requested project(or item or product) \\"<product_name>\\" is not available, the only available projects are Meglan, EBM 20, and EBM 40"
# # }}
# # """

# #         raw = await self._call_llm_with_retry(prompt)
# #         raw = re.sub(r'^```json\s*', '', raw)
# #         raw = re.sub(r'^```\s*', '', raw)
# #         raw = re.sub(r'\n?```$', '', raw).strip()

# #         try:
# #             data = json.loads(raw)
# #         except Exception:
# #             return {"messages": [AIMessage(content="⚠️ Could not parse manufacturing request. Please rephrase.")]}

# #         if data.get("project", "").lower() == "unknown":
# #             return {"messages": [AIMessage(content=data.get("message", "Unknown project."))]}

# #         project = data["project"]
# #         qty = int(data.get("quantity") or 1)
# #         if qty < 1:
# #             qty = 1

# #         if project not in BOM_REQUIREMENTS:
# #             return {"messages": [AIMessage(content=f"Unknown project: {project}")]}

# #         bom = BOM_REQUIREMENTS[project]

# #         results = []
# #         shortages = []
# #         remaining = []

# #         target_db_url = state.get("target_db_url") or self.target_db_url
# #         if not target_db_url:
# #             return {"messages": [AIMessage(content="⚠️ No database connected. Cannot check material availability.")], "status": "ERROR"}

# #         sync_url = (
# #             target_db_url.replace("+asyncpg", "")
# #             .replace("+aiosqlite", "")
# #             .replace("+aiomysql", "+pymysql")
# #             .replace("+asyncmy", "+pymysql")
# #             .replace("+aioodbc", "+pyodbc")
# #         )

# #         candidate_tables = [
# #             {
# #                 "table": "procurement_table",
# #                 "category_col": "item_category",
# #                 "qty_col": "quantity",
# #                 "assigned_col": "assigned_to",
# #             },
# #         ]

# #         for category, required_per_unit in bom.items():
# #             needed = required_per_unit * qty
# #             available = 0
# #             last_error = None

# #             for candidate in candidate_tables:
# #                 table = candidate["table"]
# #                 category_col = candidate["category_col"]
# #                 qty_col = candidate["qty_col"]
# #                 assigned_col = candidate["assigned_col"]

# #                 sql = f"""
# #                 SELECT COALESCE(SUM({qty_col}), 0)
# #                 FROM {table}
# #                 WHERE {category_col} ILIKE '%{category}%'
# #                 AND {assigned_col} IS NULL
# #                 """

# #                 try:
# #                     def _fetch_available(sql=sql):
# #                         print(f"DEBUG: Executing availability SQL for category '{category}': {sql}")
# #                         print("********************************DJFDJFDJDIJFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")
# #                         print(sync_url)
# #                         engine = create_engine(sync_url)
# #                         with engine.connect() as conn:
# #                             result = conn.execute(text(sql))
# #                             return result.scalar() or 0

# #                     loop = asyncio.get_event_loop()
# #                     available = await loop.run_in_executor(None, _fetch_available)
# #                     available = int(available)
# #                     break
# #                 except Exception as e:
# #                     last_error = e
# #                     continue

# #             if available == 0 and last_error is not None:
# #                 print(f"⚠️ Could not fetch stock for {category} from {table}: {last_error}")

# #             balance = available - needed
# #             results.append({
# #                 "category": category,
# #                 "needed": needed,
# #                 "available": available,
# #                 "balance": balance
# #             })

# #             if balance < 0:
# #                 shortages.append(f"{category}: need {abs(balance)} more")
# #             else:
# #                 remaining.append(f"{category}: {balance} remaining")

# #         if shortages:
# #             response = f"Manufacturing requirement check for {qty} {project}\nSome materials are insufficient."
# #             for r in results:
# #                 response += (
# #                     f"\n- {r['category']} "
# #                     f"(Needed: {r['needed']}, "
# #                     f"Available: {r['available']})"
# #                 )
# #             response += "\n\nShortages:\n"
# #             for s in shortages:
# #                 response += f"- {s}\n"
# #         else:
# #             response = f"You can manufacture {qty} {project} successfully.\nRemaining inventory after manufacturing:"
# #             for r in results:
# #                 response += (
# #                     f"\n- {r['category']}: "
# #                     f"{r['balance']} remaining"
# #                 )

# #         return {
# #             "messages": [AIMessage(content=response)],
# #             "status": "REPORT"
# #         }

# #     # ── GUIDED ────────────────────────────────────────────────────────────────
# #     async def _guided_node(self, state: AgentStateScehma) -> dict:
# #         """
# #         Handle vague or out-of-domain questions by guiding the user toward
# #         valid, database-answerable questions — without hallucinating any results.
# #         Uses the actual schema chunks to derive real, working example questions.
# #         """
# #         conversation = self._get_history_string()
# #         chunks = self._hybrid_retrieve(state["user_question"])

# #         prompt = f"""
# # You are STAR-AI, a professional database assistant.

# # DATABASE SCHEMA:
# # {chunks}

# # PREVIOUS CONVERSATION:
# # {conversation}

# # USER QUESTION:
# # {state["user_question"]}

# # YOUR JOB:
# # The user's question is vague, incomplete, ambiguous, or uses words that do not clearly map to the database schema.
# # Do NOT guess. Do NOT fabricate any tables, columns, values, or business facts.

# # Your task is to guide the user toward a clear database question by doing the following:

# # 1) Briefly acknowledge that the question is unclear.
# # 2) Infer the user's likely intent from the wording of their question.
# # 3) Give 4–5 example questions that are directly related to that intent and can be answered from the schema.
# # 4) Make the examples sound like natural clarifying options, starting with phrases like:
# # - Do you mean...
# # - Would you like me to...
# # - Are you asking to...
# # - Should I show...
# # 5) End by asking the user to pick one or rephrase their question.

# # VERY IMPORTANT RULES:
# # - Use ONLY real table names and real column names from the schema.
# # - Do NOT invent values such as names, departments, vendors, dates, products, categories, or locations.
# # - If you need a placeholder, use neutral wording like:
# #   "specific table", "particular vendor", "given date range", "certain department", "a selected record".
# # - Keep the examples tightly related to the user's wording.
# # - Do NOT mention SQL, prompts, internal logic, or technical implementation.
# # - Keep the tone polite, short, and helpful.

# # OUTPUT FORMAT:
# # A short opening sentence, then a line exactly:
# # Here are some things you can ask me:
# # Then 4-5 bullet points of example questions, then one closing sentence asking the user to rephrase or pick one.
# # """

# #         response = await self._call_llm_with_retry(prompt)
# #         return {
# #             "messages": [AIMessage(content=response)],
# #             "status": "REPORT"
# #         }

# #     # ── ACCESS DASHBOARD ───────────────────────────────────────────────────────
# #     async def _access_dashboard_node(self, state: AgentStateScehma) -> dict:
# #         q = state["user_question"] 
# #         db_master_name = self.db_display_name
# #         base_host = self.superset_service.host if self.superset_service else "starai.local:8088"
# #         dashboard_name = "System"
# #         target_id = "1"
        
# #         if self.superset_service:
# #             loop = asyncio.get_running_loop()
# #             matched_db = await loop.run_in_executor(
# #                 None, self.superset_service.find_best_dashboard_match, db_master_name
# #             )
            
# #             if matched_db:
# #                 dashboard_name = matched_db["title"]
                
# #                 if dashboard_name.strip().lower() != db_master_name.strip().lower():
# #                     msg = f"⚠️ Dashboard linking failed: The connected database display name '{db_master_name}' must exactly match the Superset dashboard name."
# #                     return {"messages": [AIMessage(content=msg)], "status": "ERROR"}

# #                 target_id = str(matched_db.get("id"))
# #                 url = f"http://{base_host}/superset/dashboard/{target_id}/?standalone=2"
                
# #                 try:
# #                     chart_summary = await loop.run_in_executor(
# #                         None, self.superset_service.get_dashboard_summary, dashboard_name
# #                     )
# #                     chart_info = f"\n\n**Detected Charts & Metrics:**\n{chart_summary}"
# #                 except Exception:
# #                     chart_info = ""
                    
# #                 msg = (
# #                     f"✅ **{dashboard_name} Dashboard Linked.**\n"
# #                     f"I have synchronized the data stream for your primary database '{db_master_name}'.{chart_info}\n\n"
# #                     f"You can now generate reports or request specific graphs."
# #                 )
# #                 return {
# #                     "messages": [AIMessage(content=msg)],
# #                     "status": "DASHBOARD_LOADED",
# #                     "active_dashboard": dashboard_name,
# #                     "dashboard_url": url,
# #                     "session_cookie": self.superset_service.get_session_cookie()
# #                 }
# #             else:
# #                 msg = f"⚠️ I could not find a matching dashboard in Superset for your database '{db_master_name}'."
# #                 return {"messages": [AIMessage(content=msg)], "status": "ERROR"}

# #         return {"messages": [AIMessage(content="Superset service not connected.")], "status": "ERROR"}

# #     # ── REPORT GEN ─────────────────────────────────────────────────────────────
# #     async def _report_gen_node(self, state: AgentStateScehma) -> dict:
# #         q = state["user_question"].lower()
# #         db_name = state.get("active_dashboard")
        
# #         if not db_name and self.superset_service:
# #             loop = asyncio.get_running_loop()
# #             matched_db = await loop.run_in_executor(None, self.superset_service.find_best_dashboard_match, q)
# #             if matched_db: db_name = matched_db["title"]
            
# #         if not db_name:
# #             db_name = "System"
            
# #         dashboard_context = ""
# #         base_host = self.superset_service.host if self.superset_service else "starai.local:8088"
# #         url = f"http://{base_host}/superset/dashboard/{db_name.lower()}/"
# #         if "standalone=2" not in url:
# #             url += ("?" if "?" not in url else "&") + "standalone=2"
            
# #         if self.superset_service:
# #             try:
# #                 loop = asyncio.get_running_loop()
# #                 chart_data = await loop.run_in_executor(
# #                     None, self.superset_service.get_dashboard_summary, db_name
# #                 )
# #                 dashboard_context = f"\nLive Superset Data Context:\n{chart_data}"
# #                 id_match = re.search(r"\(ID:\s*(\d+)\)", chart_data)
# #                 if id_match:
# #                     dash_id = id_match.group(1)
# #                     url = f"http://{base_host}/superset/dashboard/{dash_id}/"
# #                     if "standalone=2" not in url:
# #                         url += ("?" if "?" not in url else "&") + "standalone=2"
# #             except Exception as e:
# #                 pass
# #         report_prompt = self.DASHBOARD_REPORT_PROMPT.format(
# #             db_name=db_name,
# #             dashboard_context=dashboard_context,
# #             user_question=state['user_question']
# #         )
# #         res = await self._call_llm_with_retry(report_prompt)
# #         return {
# #             "status": "REPORT",
# #             "messages": [AIMessage(content=res)],
# #             "dashboard_url": url,
# #             "session_cookie": self.superset_service.get_session_cookie()
# #         }

# #     # ── FETCH CHART ────────────────────────────────────────────────────────────
# #     async def _fetch_chart_node(self, state: AgentStateScehma) -> dict:
# #         q = state["user_question"].lower()
# #         db_name = state.get("active_dashboard")
# #         if not db_name:
# #             for msg in reversed(self.last_conversation_history):
# #                 content = msg.content if hasattr(msg, 'content') else str(msg)
# #                 match = re.search(r"✅ \*\*(.*?)\s+Dashboard Linked", content, re.IGNORECASE)
# #                 if match:
# #                     db_name = match.group(1).strip()
# #                     break
                    
# #         if not db_name and self.superset_service:
# #             loop = asyncio.get_running_loop()
# #             matched_db = await loop.run_in_executor(None, self.superset_service.find_best_dashboard_match, q)
# #             if matched_db: db_name = matched_db["title"]

# #         if not db_name:
# #             msg = "⚠️ Please access a dashboard first (e.g., 'Access Meglan')."
# #             return {"messages": [AIMessage(content=msg)], "status": "ERROR"}
            
# #         if self.superset_service:
# #             try:
# #                 current_date_str = datetime.now().strftime('%Y-%m-%d')
# #                 filter_prompt = self.FILTER_EXTRACTION_PROMPT.format(
# #                     user_question=state['user_question'],
# #                     current_date_str=current_date_str
# #                 )
# #                 filter_res = await self._call_llm_with_retry(filter_prompt)
# #                 extra_filters = []
# #                 try:
# #                     clean_res = re.sub(r'```json\s*|\s*```|`', '', filter_res).strip()
# #                     arr_match = re.search(r'\[.*?\]', clean_res, re.DOTALL)
# #                     if arr_match:
# #                         raw_filters = json.loads(arr_match.group())
# #                         for f in raw_filters:
# #                             clean_key = f.get("col", "").lower().strip().replace(" ", "_")
# #                             op = f.get("op", "==")
# #                             val = str(f.get("val", ""))
# #                             extra_filters.append({"col": clean_key, "op": op, "val": val})
# #                 except Exception as e:
# #                     print(f"⚠️ Filter extraction failed: {e}")
# #                 loop = asyncio.get_running_loop()
# #                 chart_details = await loop.run_in_executor(
# #                     None, self.superset_service.get_chart_details, db_name,
# #                     state["user_question"], extra_filters
# #                 )
# #                 if "error" in chart_details:
# #                     return {
# #                         "messages": [AIMessage(content=f"⚠️ {chart_details['error']}")],
# #                         "status": "ERROR"
# #                     }
# #                 print(f"🎯 Fetching Live Embed AND Native Raw Data for '{chart_details['name']}'...")
# #                 raw_data = await loop.run_in_executor(
# #                     None, self.superset_service.get_chart_raw_data,
# #                     chart_details["id"], extra_filters
# #                 )
# #                 filter_msg = " (Filtered by AI)" if extra_filters else ""
# #                 if raw_data:
# #                     msg = f"✅ Extracted live view & raw data for **{chart_details['name']}**{filter_msg}."
# #                 else:
# #                     msg = (
# #                         f"✅ Loading live metric: **{chart_details['name']}**{filter_msg}...\n"
# #                         f"*(No raw data rows matched your filters)*"
# #                     )
# #                     print("⚠️ Raw data extraction yielded no rows, falling back to Live View only.")
# #                 filter_str = json.dumps(extra_filters) if extra_filters else "[]"
# #                 msg += f"\n*(Chart ID: {chart_details.get('id')} | Filters: {filter_str})*"
# #                 c_url = chart_details.get("url")
# #                 if "standalone=2" not in c_url:
# #                     c_url += ("?" if "?" not in c_url else "&") + "standalone=2"
# #                 return {
# #                     "messages": [AIMessage(content=msg)],
# #                     "status": "CHART_LOADED",
# #                     "id": chart_details.get("id"),
# #                     "chart_url": c_url,
# #                     "download_url": chart_details.get("download_url"),
# #                     "result": raw_data if raw_data else [],
# #                     "chart_name": chart_details["name"],
# #                     "session_cookie": chart_details.get("session_cookie"),
# #                     "active_chart_id": chart_details.get("id"),
# #                     "active_chart_name": chart_details["name"]
# #                 }
# #             except Exception as e:
# #                 print(f"⚠️ Superset Node Error: {e}")
# #                 return {"messages": [AIMessage(content=f"Error: {e}")], "status": "ERROR"}
# #         return {
# #             "messages": [AIMessage(content="Superset service not connected.")],
# #             "status": "ERROR"
# #         }

# #     # ── CREATE CHART ──────────────────────────────────────────────────────────
# #     async def _create_chart_node(self, state: AgentStateScehma) -> dict:
# #         import decimal
# #         import json
# #         import os
# #         import asyncio
# #         import pandas as pd
# #         import numpy as np
# #         import plotly.graph_objects as go
# #         import plotly.io as pio
# #         from datetime import datetime, date
# #         import uuid
# #         from sqlalchemy import create_engine, text
# #         from langchain_core.messages import AIMessage

# #         q = state["user_question"]
# #         loop = asyncio.get_running_loop()

# #         if not self.target_db_url:
# #             return {"messages": [AIMessage(content="⚠️ No database connected.")], "status": "ERROR"}

# #         schema_path = state.get("schema_path")
# #         chunks_text = state.get("chunks_text", "")
        
# #         if not chunks_text and schema_path and os.path.exists(schema_path):
# #             with open(schema_path, "r", encoding="utf-8") as f: 
# #                 chunks_text = f.read()

# #         try:
# #             sql_prompt = self.get_system_prompt_for_db(self.db_drive).format(
# #                 chunks_text=chunks_text, question=q
# #             )
# #         except AttributeError:
# #             sql_prompt = f"SYSTEM: You are a SQL Expert. Output ONLY raw SQL for: '{q}'. Schema:\n{chunks_text}"

# #         raw_sql = await self._call_llm_with_retry(sql_prompt)
# #         sql_query = self._extract_sql(raw_sql)

# #         if not sql_query.lower().strip().startswith(("select", "with")):
# #             return {"messages": [AIMessage(content="⚠️ Failed to generate a valid SQL query.")], "status": "ERROR"}

# #         chart_data = []
# #         try:
# #             sync_url = self.target_db_url.replace("+asyncpg", "").replace("+aiosqlite", "").replace("+aiomysql", "+pymysql").replace("+asyncmy", "+pymysql").replace("+aioodbc", "+pyodbc")
            
# #             def _fetch_data():
# #                 engine = create_engine(sync_url)
# #                 with engine.connect() as conn:
# #                     result = conn.execute(text(sql_query))
# #                     keys = list(result.keys())
# #                     return keys, result.fetchall()

# #             keys, rows = await loop.run_in_executor(None, _fetch_data)

# #             for row in rows:
# #                 new_row = {}
# #                 for idx, key in enumerate(keys):
# #                     val = row[idx]
# #                     key_name = str(key).strip()
# #                     if isinstance(val, decimal.Decimal): new_row[key_name] = float(val)
# #                     elif isinstance(val, (datetime, date)): new_row[key_name] = val.isoformat()
# #                     elif isinstance(val, uuid.UUID): new_row[key_name] = str(val)
# #                     else: new_row[key_name] = val
# #                 chart_data.append(new_row)
            
# #         except Exception as e:
# #             return {"messages": [AIMessage(content=f"⚠️ SQL execution error: {e}\n\nHint: Check if column names like 'Category' need capitalization.")], "status": "ERROR"}

# #         if not chart_data:
# #             return {"messages": [AIMessage(content="⚠️ No data returned for the chart.")], "status": "ERROR"}

# #         df = pd.DataFrame(chart_data)
# #         df.columns = [str(c).strip() for c in df.columns]
# #         columns = list(df.columns)
        
# #         for col in columns:
# #             try:
# #                 converted = pd.to_numeric(df[col], errors='coerce')
# #                 if converted.notna().any(): 
# #                     df[col] = converted
# #             except Exception: 
# #                 pass
                
# #         numeric_cols = df.select_dtypes(include='number').columns.tolist()
# #         data_sample = df.head(3).to_dict(orient="records")

# #         config_prompt = f"""
# # SYSTEM: You are a Data Visualization Configuration Expert.
# # USER QUESTION: '{q}'
# # AVAILABLE COLUMNS: {columns}
# # NUMERIC COLUMNS: {numeric_cols}
# # DATA SAMPLE: {data_sample}

# # TASK: Generate a valid JSON configuration.
# # RULES:
# # 1. "chart_type": "line", "bar", "pie", or "scatter". 
# # 2. "x_col": primary category (must EXACTLY MATCH one of {columns}, preserving case).
# # 3. "y_cols": LIST of numeric columns to plot (must EXACTLY MATCH from {numeric_cols}).
# # 4. "color_col": categorical column to group/color the data by (optional, empty string if none).
# # 5. "sort": "desc", "asc", or "none".
# # 6. "limit": integer for Top N (e.g., 10), or 0 for all.
# # 7. "title": Short descriptive title.

# # Output ONLY valid JSON. No markdown tags.
# # """
# #         raw_config = await self._call_llm_with_retry(config_prompt)
# #         config_str = self._robust_extract_output(raw_config)

# #         try: 
# #             config = json.loads(config_str)
# #         except Exception: 
# #             config = {}

# #         chart_type = config.get("chart_type", "line").lower()
# #         x_col_raw = str(config.get("x_col", columns[0])).strip()
# #         y_cols_raw = config.get("y_cols", [numeric_cols[0]] if numeric_cols else [columns[-1]])
# #         color_col_raw = str(config.get("color_col", "")).strip()
# #         sort_order = config.get("sort", "none").lower()
# #         limit = int(config.get("limit", 0))
# #         title = config.get("title", f"Chart Analysis")

# #         def correct_case(col_name, valid_cols):
# #             for c in valid_cols:
# #                 if c.lower() == col_name.lower(): return c
# #             return col_name

# #         x_col = correct_case(x_col_raw, columns)
# #         y_cols = [correct_case(y, columns) for y in y_cols_raw]
# #         color_col = correct_case(color_col_raw, columns) if color_col_raw else ""

# #         x_data_clean = []
# #         if x_col in df.columns:
# #             for val in df[x_col].tolist():
# #                 try:
# #                     if isinstance(val, (int, float)) and val > 10000000000:
# #                         x_data_clean.append(pd.to_datetime(val, unit='ms').strftime('%Y-%m-%d %H:%M:%S'))
# #                     elif isinstance(val, (int, float)) and val > 100000000:
# #                         x_data_clean.append(pd.to_datetime(val, unit='s').strftime('%Y-%m-%d %H:%M:%S'))
# #                     elif pd.notna(val):
# #                         x_data_clean.append(str(val))
# #                     else:
# #                         x_data_clean.append(None)
# #                 except Exception:
# #                     x_data_clean.append(str(val))
            
# #             df['clean_x'] = x_data_clean

# #             if any(t in x_col.lower() for t in ['time', 'date', 'created', 'timestamp']):
# #                 df['temp_time'] = pd.to_datetime(df['clean_x'], errors='coerce')
# #                 df = df.dropna(subset=['temp_time']).sort_values(by='temp_time', ascending=True).drop(columns=['temp_time'])
# #                 sort_order = "none" 
# #         else:
# #             df['clean_x'] = [str(i) for i in range(len(df))]
            
# #         if sort_order == "desc" and y_cols and y_cols[0] in df.columns: 
# #             df = df.sort_values(by=y_cols[0], ascending=False)
# #         elif sort_order == "asc" and y_cols and y_cols[0] in df.columns:
# #             df = df.sort_values(by=y_cols[0], ascending=True)

# #         if limit > 0: df = df.head(limit)

# #         if df.empty:
# #             return {"messages": [AIMessage(content="⚠️ Chart generation failed: All data was filtered out or invalid.")], "status": "ERROR"}
        
# #         df = df.replace([np.inf, -np.inf], np.nan).where(pd.notnull(df), None)

# #         def sanitize_for_json(v):
# #             if v is None or (isinstance(v, float) and np.isnan(v)): return None
# #             if isinstance(v, (np.integer, int)): return int(v)
# #             if isinstance(v, (np.floating, float)): return float(v)
# #             if isinstance(v, (datetime, date)): return v.isoformat()
# #             if hasattr(v, '__str__'):
# #                 try: return float(v) if '.' in str(v) else int(v)
# #                 except: return str(v)
# #             return str(v)

# #         theme_colors = ['#00D1FF', '#7C4DFF', '#0099BB', '#2A8080', '#00E5FF', '#FF007F', '#FFD700']
# #         layout_args = dict(
# #             paper_bgcolor='#161E1E', plot_bgcolor='#161E1E', font_color='#E0E0E0',
# #             margin=dict(l=60, r=40, t=70, b=80),
# #             legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
# #             title=dict(text=title, font=dict(size=18), x=0.5, xanchor='center')
# #         )

# #         try:
# #             fig = go.Figure()
# #             valid_y_cols = [c for c in y_cols if c in df.columns and c in numeric_cols]
# #             if not valid_y_cols and numeric_cols: valid_y_cols = [numeric_cols[0]]
            
# #             if color_col and color_col in df.columns and valid_y_cols:
# #                 groups = df[color_col].dropna().unique()
# #                 for i, group_val in enumerate(groups):
# #                     color = theme_colors[i % len(theme_colors)]
# #                     group_df = df[df[color_col] == group_val]
                    
# #                     x_clean = [sanitize_for_json(x) for x in group_df['clean_x'].tolist()]
# #                     y_clean = []
# #                     for yv in group_df[valid_y_cols[0]].tolist():
# #                         sv = sanitize_for_json(yv)
# #                         y_clean.append(float(sv) if sv is not None else 0.0)
                    
# #                     mode = 'markers' if chart_type == 'scatter' else 'lines'
                    
# #                     if chart_type in ['scatter', 'line']:
# #                         fig.add_trace(go.Scatter(
# #                             x=x_clean, y=y_clean, name=str(group_val), mode=mode,
# #                             marker=dict(color=color, size=8), line=dict(color=color, width=2.5),
# #                             hovertemplate=f'%{{x}}<br>{valid_y_cols[0]}: %{{y}}<extra></extra>'
# #                         ))
# #                     elif chart_type == 'bar':
# #                         fig.add_trace(go.Bar(x=x_clean, y=y_clean, name=str(group_val), marker_color=color))
# #             else:
# #                 x_clean = [sanitize_for_json(x) for x in df['clean_x'].tolist()]
# #                 for i, col in enumerate(valid_y_cols):
# #                     color = theme_colors[i % len(theme_colors)]
# #                     y_clean = []
# #                     for yv in df[col].tolist():
# #                         sv = sanitize_for_json(yv)
# #                         y_clean.append(float(sv) if sv is not None else 0.0)
                    
# #                     if chart_type == "line":
# #                         fig.add_trace(go.Scatter(x=x_clean, y=y_clean, name=str(col), mode='lines', line=dict(color=color, width=2.5), hovertemplate=f'%{{x}}<br>{col}: %{{y}}<extra></extra>'))
# #                     elif chart_type == "scatter":
# #                         fig.add_trace(go.Scatter(x=x_clean, y=y_clean, name=str(col), mode='markers', marker=dict(color=color, size=8), hovertemplate=f'%{{x}}<br>{col}: %{{y}}<extra></extra>'))
# #                     elif chart_type == "bar":
# #                         fig.add_trace(go.Bar(x=x_clean, y=y_clean, name=str(col), marker_color=color))
# #                     elif chart_type == "pie":
# #                         fig.add_trace(go.Pie(labels=x_clean, values=y_clean, hole=0.4, marker=dict(colors=theme_colors)))
# #                         break

# #             fig.update_layout(
# #                 xaxis=dict(
# #                     showgrid=True, gridcolor='#1F2E2E', automargin=True, tickangle=-45,
# #                     type='date' if any(t in x_col.lower() for t in ['time', 'date', 'created']) else 'category'
# #                 ),
# #                 yaxis=dict(showgrid=True, gridcolor='#1F2E2E', automargin=True),
# #                 **layout_args
# #             )

# #             chart_json = pio.to_json(fig)
# #         except Exception as e:
# #             return {"messages": [AIMessage(content=f"⚠️ Plotly render error: {e}")], "status": "ERROR"}

# #         insight_prompt = f"Provide 2 concise bullet point insights for {title} using this data: {data_sample}. Handle spelling mistakes from original request if any."
# #         insights = await self._call_llm_with_retry(insight_prompt)

# #         return {
# #             "messages": [AIMessage(content=f"✨ **{title}**\n\n**Insights:**\n{insights}")],
# #             "status": "CHART_LOADED", "chart_json": chart_json, "result": chart_data, 
# #             "chart_name": title, "sql_query": sql_query
# #         }

# #     # ── CHAT ───────────────────────────────────────────────────────────────────
# #     async def _chat_node(self, state: AgentStateScehma) -> dict:
# #         conversation = self._get_history_string()
# #         prompt = self.CHATNODEPROMPT.format(
# #             conversation=conversation,
# #             question=state["user_question"]
# #         )
# #         response = await self._call_llm_with_retry(prompt, stream_to_ui=True)
# #         return {"messages": [AIMessage(content=response)]}

# #     # ── SCHEMA ─────────────────────────────────────────────────────────────────
# #     async def _schema_node(self, state: AgentStateScehma) -> dict:
# #         @tool("retrieve_schema", description="Retrieve schema for generating sql query", args_schema=RetreiveSchemaSchema)
# #         def retrieve_schema_tool(question: str) -> str:
# #             schema_path = state.get("schema_path")
# #             file_content = ""
# #             if schema_path and os.path.exists(schema_path):
# #                 with open(schema_path, "r", encoding="utf-8") as f:
# #                     file_content = f.read()
            
# #             hybrid_chunks = self._hybrid_retrieve(question)
            
# #             critical_tables = [
# #                 "waypoints", "gps_tracking", "ais_data",
# #                 "india_west_places", "india_west_transport", "india_west_natural",
# #                 "chat_message", "chat_session"
# #             ]
# #             forced_context = ""
# #             for table in critical_tables:
# #                 if table not in hybrid_chunks and table in file_content:
# #                     pattern = rf"(CREATE TABLE {table}.*?;)"
# #                     match = re.search(pattern, file_content, re.DOTALL | re.IGNORECASE)
# #                     if match:
# #                         forced_context += f"\n[CRITICAL TABLE DEFINITION]:\n{match.group(1)}\n"
            
# #             semantic_dictionary = """
# # ### DATABASE SEMANTICS & RELATIONSHIPS (CRITICAL CONTEXT) ###
# # - **chat_message**: Stores all user questions and AI responses for the dynamic chat system. Use this for counting messages, finding history, or chat analysis.
# # - **chat_session**: Groups chat messages into distinct sessions.
# # - **meglan_boat_info**: Represents YOUR own boat. Primary key `id` maps to `boat_id` in telemetry tables.
# # - **waypoints**: Represents a specific trip or mission metadata. `status = 'Docking'` means the boat is parked. Links to telemetry via `waypoint_id`.
# # - **gps_tracking**: LIVE and historical location (Lat/Lon) of YOUR boat.
# # - **navigation**: Live physical movement of YOUR boat. Contains `speed`, `heading`, `pitch` (vertical tilt / instability), `roll` (horizontal tilt / instability).
# # - **engine**: Contains `thruster_position` which represents 'engine effort' or 'engine load'.
# # - **environment**: Contains local `wind_speed` and `wind_direction`.
# # - **ais_data**: Represents OTHER nearby ships/vessels. Use this for 'intercept' or 'nearest ship'. Contains their `mmsi`.
# # - **dark_vessel_alerts**: Hostile/Alert tracking. Join with `ais_data` on `mmsi` to get their physical location.
# # - **detections**: Camera/radar object detection (bounding boxes, object_type).
# # - **india_west_natural / india_south_natural**: Spatial polygons for natural zones (beaches, coast, reefs, restricted sanctuary).
# # - **india_west_places / india_south_places**: Spatial polygons for high-density areas (cities, towns).
# # - **india_west_transport / india_south_transport**: Spatial polygons for infrastructure (ports, docks, railway stations).
# # - **procurement_table**: Inventory of procurement items. `item_category` maps to BOM categories. `assigned_to IS NULL` means unallocated/available stock.
# #             """
            
# #             return f"### RELEVANT TABLES ###\n{hybrid_chunks}\n{forced_context}\n\n{semantic_dictionary}"

# #         chunks = await asyncio.to_thread(retrieve_schema_tool.invoke, {"question": state["user_question"]})
        
# #         return {
# #             "chunks_text": chunks,
# #             "messages": [AIMessage(content="Retrieved schema with forced context injection.")]
# #         }

# #     # ── SQL GEN ────────────────────────────────────────────────────────────────
# #     async def _sql_gen_node(self, state: AgentStateScehma) -> dict:
# #         @tool("generate_sql", description="generates postgresql query based on the question and schema chunks", args_schema=GenerateSQLSchema)
# #         async def generate_sql_tool(question: str, chunks_text: str) -> str:
# #             safe_chunks = chunks_text[:self._max_schema_chars]
# #             dialect_instructions = self.get_system_prompt_for_db(self.db_drive)
# #             prompt = dialect_instructions.format(chunks_text=safe_chunks, question=question)
# #             return await self._call_llm_with_retry(prompt)

# #         raw_sql = await generate_sql_tool.ainvoke({
# #             "question": state["user_question"],
# #             "chunks_text": state.get("chunks_text", "")
# #         })

# #         sql_query = self._extract_sql(raw_sql)
# #         sql_query = re.sub(r'^```sql\s*\n?', '', sql_query, flags=re.IGNORECASE)
# #         sql_query = re.sub(r'\n?```$', '', sql_query).strip()
        
# #         if "SELECT" in sql_query.upper() or "WITH" in sql_query.upper():
# #             match = re.search(r'(?i)(SELECT|WITH).*', sql_query, re.DOTALL)
# #             if match:
# #                 sql_query = match.group(0).strip()
                
# #         if "gps_tracking" in sql_query.lower() and "order by" not in sql_query.lower():
# #             sql_query = sql_query.rstrip(';') + " ORDER BY created_at DESC LIMIT 1;"
                
# #         chunks_text = state.get("chunks_text", "")
# #         db_tables = list(set([t.lower() for t in re.findall(r"TABLE:\s*([a-zA-Z0-9_]+)", chunks_text, re.IGNORECASE) + re.findall(r"CREATE TABLE\s+([a-zA-Z0-9_]+)", chunks_text, re.IGNORECASE)]))
        
# #         if db_tables:
# #             default_table = db_tables[0]
# #             for t in db_tables:
# #                 if t in state["user_question"].lower():
# #                     default_table = t
# #                     break
            
# #             bad_tables = ['sales', 'orders', 'transactions', 'customer_transactions', 'transaction_history', 'data']
# #             for bad in bad_tables:
# #                 sql_query = re.sub(rf'(?i)\bFROM\s+["\']?{bad}["\']?\b', f'FROM "{default_table}"', sql_query)
# #                 sql_query = re.sub(rf'(?i)\bJOIN\s+["\']?{bad}["\']?\b', f'JOIN "{default_table}"', sql_query)

# #         if not sql_query.lower().startswith("select") and not sql_query.lower().startswith("with"):
# #             q_lower = state["user_question"].lower()
# #             default_table = db_tables[0] if db_tables else "users"
# #             if "count" in q_lower:
# #                 sql_query = f'SELECT COUNT(*) FROM "{default_table}";'
# #             elif "list" in q_lower or "show" in q_lower or "get" in q_lower:
# #                 sql_query = f'SELECT * FROM "{default_table}" LIMIT 15;'
# #             else:
# #                 sql_query = f'SELECT * FROM "{default_table}" LIMIT 5;'

# #         return {
# #             "sql_query": sql_query,
# #             "messages": [AIMessage(content="Generated SQL")]
# #         }

# #     def _verify_sql_safety(self, sql_str: str) -> bool:
# #         pattern = r'\b(' + '|'.join(self.dangerous_commands) + r')\b'
# #         return not re.search(pattern, sql_str.lower())

# #     async def _fix_sql_error(
# #         self, user_question: str, sql_str: str, error: str, chunks_text: str
# #     ) -> str:
# #         @tool("fix_sql_error", description="Fixes SQL error from database", args_schema=FixSQLSchema)
# #         async def fix_sql_error_tool(user_question: str, sql: str, error: str, chunks_text: str) -> str:
# #             prompt = self.get_error_fixing_prompt(self.db_drive).format(
# #                 user_question=user_question, chunks_text=chunks_text, error=error, sql=sql
# #             )
# #             raw = await self._call_llm_with_retry(prompt)
# #             return raw

# #         raw_sql = await fix_sql_error_tool.ainvoke({
# #             "user_question": user_question, "sql": sql_str, "error": error, "chunks_text": chunks_text
# #         })
        
# #         fixed_sql = self._extract_sql(raw_sql)
# #         fixed_sql = re.sub(r'^```sql\s*\n?', '', fixed_sql, flags=re.IGNORECASE)
# #         fixed_sql = re.sub(r'\n?```$', '', fixed_sql).strip()
        
# #         db_tables = list(set([t.lower() for t in re.findall(r"TABLE:\s*([a-zA-Z0-9_]+)", chunks_text, re.IGNORECASE) + re.findall(r"CREATE TABLE\s+([a-zA-Z0-9_]+)", chunks_text, re.IGNORECASE)]))
# #         if db_tables:
# #             default_table = db_tables[0]
# #             for t in db_tables:
# #                 if t in user_question.lower():
# #                     default_table = t
# #                     break
# #             bad_tables = ['sales', 'orders', 'transactions', 'customer_transactions', 'transaction_history', 'data']
# #             for bad in bad_tables:
# #                 fixed_sql = re.sub(rf'(?i)\bFROM\s+["\']?{bad}["\']?\b', f'FROM "{default_table}"', fixed_sql)
# #                 fixed_sql = re.sub(rf'(?i)\bJOIN\s+["\']?{bad}["\']?\b', f'JOIN "{default_table}"', fixed_sql)

# #         return fixed_sql

# #     # ── VERIFY ─────────────────────────────────────────────────────────────────
# #     async def _verify_node(self, state: AgentStateScehma) -> dict:
# #         sql_str    = state.get("sql_query", "")
# #         chunks_text = state.get("chunks_text", "")
# #         question   = state.get("user_question", "")
# #         target_db_url = state.get("target_db_url")
# #         user_id    = state.get("user_id")
# #         session_id = state.get("session_id")
# #         message_id = state.get("message_id")
        
# #         if "⚠️ API Rate Limit Exhausted" in sql_str:
# #             return {
# #                 "user_id": user_id, "session_id": session_id,
# #                 "message_id": message_id, "target_db_url": target_db_url,
# #                 "sql_query": sql_str, "query_id": None, "result": [],
# #                 "messages": [AIMessage(content=sql_str)]
# #             }
            
# #         for attempt in range(4):
# #             if not self._verify_sql_safety(sql_str):
# #                 return {
# #                     "user_id": user_id, "session_id": session_id,
# #                     "message_id": message_id, "target_db_url": target_db_url,
# #                     "sql_query": sql_str, "query_id": None, "result": [],
# #                     "messages": [AIMessage(content="⚠️ Query contains dangerous operations")]
# #                 }
# #             result_status = await self._verify_query(
# #                 sql_str, state, target_db_url=target_db_url
# #             )
# #             current_query_id = getattr(self, 'last_query_id', None)
            
# #             if "successfully" in result_status.lower() or "valid" in result_status.lower():
# #                 return {
# #                     "user_id": user_id, "session_id": session_id,
# #                     "message_id": message_id, "target_db_url": target_db_url,
# #                     "last_sql": sql_str, "sql_query": sql_str,
# #                     "query_id": current_query_id,
# #                     "result": self.results if self.results else [],
# #                     "status": "DATA_LOADED" if self.results else "NO_RESULTS", 
# #                     "messages": [AIMessage(content="SQL verified successfully")]
# #                 }
# #             if attempt < 3:
# #                 sql_str = await self._fix_sql_error(
# #                     question, sql_str, result_status, chunks_text[:self._max_schema_chars]
# #                 )
# #                 if "⚠️ API Rate Limit Exhausted" in sql_str:
# #                     return {
# #                         "user_id": user_id, "session_id": session_id,
# #                         "message_id": message_id, "target_db_url": target_db_url,
# #                         "sql_query": sql_str, "query_id": current_query_id,
# #                         "result": [], "messages": [AIMessage(content=sql_str)]
# #                     }
# #                 self.results = []
# #             else:
# #                 return {
# #                     "user_id": user_id, "session_id": session_id,
# #                     "message_id": message_id, "target_db_url": target_db_url,
# #                     "sql_query": sql_str, "query_id": current_query_id,
# #                     "last_sql": "select 2 where false;", "result": [],
# #                     "status": "ERROR", 
# #                     "messages": [AIMessage(
# #                         content=f"❌ SQL failed after 4 attempts. Last error: {result_status}"
# #                     )]
# #                 }
                
# #         return {
# #             "user_id": user_id, "session_id": session_id,
# #             "message_id": message_id, "target_db_url": target_db_url,
# #             "sql_query": sql_str,
# #             "result": self.results if self.results else [],
# #             "query_id": getattr(self, 'last_query_id', None),
# #             "messages": [AIMessage(content="Verification process completed.")]
# #         }

# #     # ── FOLLOW-UP QUESTION MERGE ───────────────────────────────────────────────
# #     async def _followup_question_modify(self, state: AgentStateScehma) -> dict:
# #         prompt = self.FOLLOWUPQUESTIONMODIFYPROMPT.format(
# #             conversation=self._get_history_string(),
# #             user_question=state["user_question"]
# #         )
# #         merged_question = await self._call_llm_with_retry(prompt)
# #         return {"user_question": merged_question}

# #     # ── ANSWER ─────────────────────────────────────────────────────────────────
# #     async def _answer_node(self, state: AgentStateScehma) -> dict:
# #         last_sql        = state.get("last_sql", "")
# #         sql_query_text = state.get("sql_query", "")
# #         results         = state.get("result", [])
# #         row_count      = len(results)
# #         if isinstance(sql_query_text, str) and "⚠️ API Rate Limit Exhausted" in sql_query_text:
# #             return {"messages": [AIMessage(content=sql_query_text)]}
            
# #         if not last_sql or "select 1 where false" in last_sql.lower():
# #             prompt = self.SQLANALYSISPROMPT.format(
# #                 user_question=state["user_question"],
# #                 last_sql=last_sql
# #             )
# #         elif "select 2 where false" in last_sql.lower():
# #             prompt = self.SQLFAILEDANALYSISPROMPT.format(
# #                 user_question=state["user_question"]
# #             )
# #         elif row_count == 0:
# #             prompt = self.SQLNORESULTANALYSISPROMPT.format(
# #                 user_question=state["user_question"],
# #                 last_sql=last_sql
# #             )
# #         else:
# #             prompt = f"""
# #             You are STAR-AI. 
# #             SQL Executed: {last_sql}
# #             Last question: {state["user_question"]}
            
# #             The data has been successfully retrieved and displayed in a secure UI table. 
# #             DO NOT attempt to explain or guess the data. DO NOT provide insights.
            
# #             STRICT REQUIREMENT: Acknowledge the table is displayed, and suggest 2-3 follow-up questions.
# #             Format: "Do you want me to...", "Would you like me to...", "If you want, I will..."
# #             No SQL in follow-up suggestions.
# #             """
# #         suggestions = await self._call_llm_with_retry(prompt, stream_to_ui=True)
        
# #         status = "DATA_LOADED" if len(state.get("result", [])) > 0 else "NO_RESULTS"
        
# #         return {
# #             "messages": [AIMessage(content=suggestions)],
# #             "status": status
# #         }

# #     # ══════════════════════════════════════════════════════════════════════════
# #     #  MAIN ORCHESTRATOR
# #     # ══════════════════════════════════════════════════════════════════════════
# #     async def build_and_run_graph(self):
# #         q_lower = str(self.question).lower().strip()
        
# #         is_create_chart = (
# #             q_lower.startswith("create ") or
# #             "generate a new" in q_lower or
# #             "build a chart" in q_lower or
# #             "scatter plot" in q_lower or
# #             "bar graph" in q_lower or
# #             "chart" in q_lower or
# #             "graph" in q_lower
# #         )
# #         is_metric_fetch = (
# #             q_lower.startswith("- metric:") or
# #             "visualization:" in q_lower or
# #             "parquet" in q_lower
# #         )
# #         dashboard_keywords = ["meglan", "warnetix", "neuroeye", "system"]
# #         is_dashboard_access = (
# #             any(kw in q_lower for kw in dashboard_keywords) and len(q_lower.split()) <= 4
# #         ) or "access dashboard" in q_lower
        
# #         compact_history = []
# #         for msg in self.last_conversation_history[-self._max_history_messages:]:
# #             msg_content = getattr(msg, "content", "")
# #             if not isinstance(msg_content, str):
# #                 msg_content = str(msg_content)
# #             if len(msg_content) > self._max_message_chars:
# #                 msg_content = msg_content[:self._max_message_chars] + " ..."
# #             if isinstance(msg, HumanMessage):
# #                 compact_history.append(HumanMessage(content=msg_content))
# #             else:
# #                 compact_history.append(AIMessage(content=msg_content))
# #         question_text = self.question if isinstance(self.question, str) else str(self.question)
# #         if len(question_text) > self._max_message_chars:
# #             question_text = question_text[:self._max_message_chars] + " ..."

# #         mock_state = {
# #             "messages": compact_history + [HumanMessage(content=question_text)],
# #             "user_question": self.question,
# #             "user_id": str(self.user_id),
# #             "session_id": str(self.session_id) if self.session_id else None,
# #             "message_id": str(self.message_id) if self.message_id else None,
# #             "target_db_url": self.target_db_url,
# #             "result": [],
# #             "sql_query": "",
# #             "query_id": getattr(self, "last_query_id", None),
# #             "active_chart_id": None,
# #             "active_chart_name": None,
# #             "download_url": None  
# #         }

# #         db_display_name = getattr(self, "db_display_name", "GISDB")
# #         paths = get_db_storage_paths(self.user_id, db_display_name)
# #         schema_file_path = paths["schema_file"] if paths else None
        
# #         if schema_file_path and not schema_file_path.exists():
# #             os.makedirs(os.path.dirname(str(schema_file_path)), exist_ok=True)
# #             try:
# #                 sync_url = (
# #                     self.target_db_url
# #                     .replace("+asyncpg", "")
# #                     .replace("+aiosqlite", "")
# #                 )
                
# #                 class GeometryType(sqltypes.UserDefinedType):
# #                     def get_col_spec(self, **kw):
# #                         return "GEOMETRY"

# #                 engine   = create_engine(sync_url)
# #                 metadata = MetaData()
                
# #                 @event.listens_for(metadata, "column_reflect")
# #                 def receive_column_reflect(inspector, table, column_info):
# #                     raw_type = str(column_info.get("type", "")).lower()
# #                     if any(geo in raw_type for geo in ["geometry", "geography", "raster", "postgis"]):
# #                         column_info["type"] = GeometryType()
# #                     elif isinstance(column_info.get("type"), sqltypes.NullType):
# #                         column_info["type"] = GeometryType()
                        
# #                 metadata.reflect(bind=engine)
                
# #                 with open(str(schema_file_path), "w", encoding="utf-8") as f:
# #                     for table in metadata.sorted_tables:
# #                         for column in table.columns:
# #                             if type(column.type).__name__ == 'NullType' or isinstance(column.type, sqltypes.NullType):
# #                                 column.type = GeometryType()
                                
# #                         ddl = CreateTable(table).compile(
# #                             engine, compile_kwargs={"literal_binds": True}
# #                         )
# #                         f.write(
# #                             re.sub(r'CREATE TABLE \w+\.', 'CREATE TABLE ', str(ddl).strip())
# #                             + ";\n" + "-" * 30 + "\n"
# #                         )
# #                 engine.dispose()
# #             except Exception as e:
# #                 print(f"⚠️ Schema extraction error: {e}")
# #                 pass
                
# #         if schema_file_path:
# #             mock_state["schema_path"] = str(schema_file_path)
# #             mock_state["vector_path"] = str(paths["vector_store"]) if paths else ""
            
# #         bypassed_state = None
# #         if is_create_chart:
# #             bypassed_state = await self._create_chart_node(mock_state)
# #         elif is_metric_fetch:
# #             clean_q = re.sub(
# #                 r'\(visualization:\s*[^)]+\)', '', self.question, flags=re.IGNORECASE
# #             )
# #             mock_state["user_question"] = re.sub(
# #                 r'- metric:\s*', '', clean_q, flags=re.IGNORECASE
# #             ).strip()
# #             bypassed_state = await self._fetch_chart_node(mock_state)
# #         elif is_dashboard_access:
# #             bypassed_state = await self._access_dashboard_node(mock_state)

# #         if bypassed_state:
# #             final_state = mock_state
# #             final_state.update(bypassed_state)
# #         else:
# #             workflow = StateGraph(AgentStateScehma)
# #             workflow.add_node("intent",           self._classify_intent)
# #             workflow.add_node("access_dashboard", self._access_dashboard_node)
# #             workflow.add_node("report_gen",       self._report_gen_node)
# #             workflow.add_node("fetch_chart",      self._fetch_chart_node)
# #             workflow.add_node("create_chart",     self._create_chart_node)
# #             workflow.add_node("schema",           self._schema_node)
# #             workflow.add_node("sql_gen",          self._sql_gen_node)
# #             workflow.add_node("verify",           self._verify_node)
# #             workflow.add_node("answer",           self._answer_node)
# #             workflow.add_node("chat",             self._chat_node)
# #             workflow.add_node("followup",         self._followup_question_modify)
# #             # ── New nodes ──────────────────────────────────────────────────────
# #             workflow.add_node("manufacturing",    self._manufacturing_node)
# #             workflow.add_node("guided",           self._guided_node)
            
# #             workflow.add_edge(START, "intent")
# #             workflow.add_conditional_edges("intent", self._route_intent)
# #             for n in [
# #                 "access_dashboard", "report_gen", "fetch_chart",
# #                 "create_chart", "manufacturing", "guided"
# #             ]:
# #                 workflow.add_edge(n, END)
# #             workflow.add_edge("schema",  "sql_gen")
# #             workflow.add_edge("sql_gen", "verify")
# #             workflow.add_edge("verify",  "answer")
# #             workflow.add_edge("answer",  END)
# #             workflow.add_edge("followup", "schema")
# #             workflow.add_edge("chat",    END)

# #             graph = workflow.compile()
# #             input_state = mock_state
# #             input_state.update({"chunks_text": ""})
# #             final_state = input_state
# #             try:
# #                 async for step in graph.astream(input_state, stream_mode="values"):
# #                     final_state = step
# #             except Exception as e:
# #                 return {"langgraph_message": f"Execution halted: {str(e)}"}
                
# #         return self._package_final_response(final_state)

# #     # ══════════════════════════════════════════════════════════════════════════
# #     #  RESPONSE PACKAGER
# #     # ══════════════════════════════════════════════════════════════════════════
# #     def _package_final_response(self, state):
# #         messages = state.get("messages", [])
# #         ai_message_text = (
# #             messages[-1].content
# #             if messages and hasattr(messages[-1], 'content')
# #             else str(messages[-1]) if messages
# #             else "Error"
# #         )
        
# #         raw_results = state.get("result", [])
# #         clean_rows  = []
# #         columns     = []

# #         if raw_results:
# #             first_row = raw_results[0]
# #             if isinstance(first_row, dict): columns = list(first_row.keys())
# #             elif hasattr(first_row, "_mapping"): columns = list(first_row._mapping.keys())
# #             elif hasattr(first_row, "_asdict"): columns = list(first_row._asdict().keys())
# #             elif isinstance(first_row, (list, tuple)): columns = [f"Col_{i+1}" for i in range(len(first_row))]
# #             else: columns = ["Result"]
            
# #             for row in raw_results:
# #                 formatted_row = []
# #                 if isinstance(row, dict): items = row.items()
# #                 elif hasattr(row, "_mapping"): items = row._mapping.items()
# #                 elif hasattr(row, "_asdict"): items = row._asdict().items()
# #                 elif isinstance(row, (list, tuple)): items = enumerate(row)
# #                 else: items = [(0, row)]
                
# #                 for col_name, val in items:
# #                     if val is None:
# #                         formatted_row.append("")
# #                         continue
                        
# #                     col_str = str(col_name).lower()
                    
# #                     # 🚀 GEOJSON & DICT FORMATTING
# #                     if isinstance(val, (dict, list)):
# #                         try: val = json.dumps(val)
# #                         except: val = str(val)
# #                     elif isinstance(val, str) and '{"type"' in val:
# #                         try:
# #                             geo_data = json.loads(val)
# #                             if geo_data.get('type') == 'Point' and 'coordinates' in geo_data:
# #                                 val = f"Lng: {geo_data['coordinates'][0]}, Lat: {geo_data['coordinates'][1]}"
# #                         except:
# #                             pass
                    
# #                     # 🚀 DISTANCE FORMATTING
# #                     if "distance" in col_str and isinstance(val, (float, int, Decimal)):
# #                         try:
# #                             val = f"{round(float(val), 2)} km"
# #                         except:
# #                             pass
# #                     else:
# #                         try:
# #                             f_val = float(val)
# #                             if 1000000000000 < f_val < 3000000000000 and any(k in col_str for k in ['date', 'time', 'at', 'created', 'updated']):
# #                                 val = datetime.fromtimestamp(f_val / 1000.0).strftime('%Y-%m-%d %H:%M:%S')
# #                             elif 1000000000 < f_val < 3000000000 and any(k in col_str for k in ['date', 'time', 'at', 'created', 'updated']):
# #                                 val = datetime.fromtimestamp(f_val).strftime('%Y-%m-%d %H:%M:%S')
# #                         except (ValueError, TypeError):
# #                             pass
                            
# #                     formatted_row.append(str(val))
# #                 clean_rows.append(formatted_row)
        
# #         c_url = state.get("chart_url")
# #         if c_url:
# #             c_url = c_url.replace("standalone=1", "standalone=2")
# #             if "standalone=" not in c_url:
# #                 c_url += ("?" if "?" not in c_url else "&") + "standalone=2"
                
# #         last_sql = state.get('sql_query', '')
# #         query_id_str = str(state.get("query_id", ""))
        
# #         status = state.get("status")
# #         active_db = state.get("active_dashboard")
# #         db_url = state.get("dashboard_url")
# #         c_name = state.get("chart_name")
# #         c_id = state.get("id") or state.get("active_chart_id")
# #         dl_url = state.get("download_url") 
# #         session_cookie = state.get("session_cookie") 
# #         chart_json = state.get("chart_json") 
        
# #         return {
# #             "user_question": self.question,              # The final processed question
# #             "query": last_sql if last_sql else "",        # Raw SQL query executed
# #             "langgraph_message": ai_message_text,         # The AI's natural language response
# #             "result": clean_rows,                         # Full tabular data (unprocessed)
# #             "columns": columns,                           # Column headers
# #             "status": status,                             # UI state controller: DATA_LOADED, CHART_LOADED, ERROR
# #             "active_dashboard": active_db,                # Linked Superset dashboard name
# #             "dashboard_url": db_url,                      # iframe URL for dashboard
# #             "chart_url": c_url,                           # iframe URL for specific chart
# #             "chart_json": chart_json,                     # Plotly JSON for interactive charts
# #             "chart_name": c_name,                         # Title of the visualization
# #             "id": c_id,                                   # unique ID for the chart
# #             "download_url": dl_url,                       # CSV download link (Superset)
# #             "session_cookie": session_cookie,             # Auth cookie for iframe
# #             "chart_id": c_id                              # Alias for 'id'
# #         }

# #######################################################################

# ###########manufacturing and guided

# # from pydantic import BaseModel, Field
# # from thefuzz import fuzz
# # from datetime import datetime, date
# # import re
# # import asyncio
# # import json
# # import os
# # import csv
# # import uuid
# # from decimal import Decimal

# # # from langchain_core.messages import AIMessage, HumanMessage
# # # from langchain_huggingface import HuggingFaceEmbeddings
# # # from langchain_community.utilities import SQLDatabase
# # # from langgraph.graph import StateGraph, START, END
# # # from langchain_core.documents import Document
# # # from langchain.tools import tool



# # from langchain_core.tools import tool
# # from langchain_core.documents import Document
# # from langchain_community.vectorstores import FAISS
# # from langchain_huggingface import HuggingFaceEmbeddings
# # from langchain_core.messages import AIMessage, HumanMessage, BaseMessage
# # from langgraph.graph.message import add_messages
# # from langgraph.graph import StateGraph, START, END

# # # SQLAlchemy imports for standalone schema extraction
# # from sqlalchemy import create_engine, MetaData, event
# # from sqlalchemy.schema import CreateTable
# # from sqlalchemy import text
# # import sqlalchemy.types as sqltypes


# # from app.services.superset_service import SupersetService
# # from app.core.path_utils import get_db_storage_paths

# # from app.schemas.agent_model_schema import (
# #     AgentStateScehma,
# #     RetreiveSchema,
# #     GenerateSqlScehma,
# #     VerifyQuerySchema,
# #     RetreiveSchemaSchema,
# #     GenerateSQLSchema,
# #     FixSQLSchema,
# #     AnalysisMode
# # )

# # from app.services.llama_model_init import GroqLLM


# # class SqlGraphQueryAgentBuilder:
# #     SEASON_MAP = {
# #         "summer":  {"months": [3, 4, 5],    "label": "Summer (Mar-May)"},
# #         "monsoon": {"months": [6, 7, 8, 9], "label": "Monsoon (Jun-Sep)"},
# #         "winter":  {"months": [11, 12, 1, 2],"label": "Winter (Nov-Feb)"},
# #         "rainy":   {"months": [6, 7, 8, 9], "label": "Rainy (Jun-Sep)"},
# #     }

# #     def __init__(
# #         self,
# #         # question: str = None,
# #         # active_api_key: str = None,
# #         # llm=None,
# #         # db_repo=None,  # Add repository for async DB operations
# #         # api_key_service=None,
# #         # vectorstore=None,
# #         # chunks=None,
# #         # dangerous_commands=None,
# #         # last_conversation_history: list = None,
# #         # db_drive:str="sqlite",
# #         #added extra
# #         question: str = None,
# #         user_id: str = None,
# #         user_db_source=None,
# #         active_api_key: str = None,
# #         llm=None,
# #         db_repo=None,
# #         user_db_repo=None,
# #         api_key_service=None,
# #         vectorstore=None,
# #         chunks=None,
# #         dangerous_commands=None,
# #         last_conversation_history: list = None,
# #         session_id: str = None,
# #         message_id: str = None,
# #         target_db_url: str = None,
# #         db_drive: str = "sqlite",
# #         db_display_name: str = "GISDB",
# #         superset_service=None,
# #         stream_callback=None

# #     ):
        
# #         # self.question = question
# #         # self.active_api_key = active_api_key
# #         # self.results = None
# #         # self.llm = llm
# #         # self.db_repo = db_repo  # Repository for async DB calls
# #         # self.api_key_service = api_key_service
# #         # self.vectorstore = vectorstore
# #         # self.chunks = chunks
# #         # self.dangerous_commands = dangerous_commands
# #         # self.last_conversation_history = (last_conversation_history or [])[-10:]
# #         # self.db_drive = db_drive

# #         self.question = question
# #         self.user_id = user_id
# #         self.user_db_source = user_db_source
# #         self.active_api_key = active_api_key
# #         self.results = []
# #         self.llm = llm
# #         self.db_repo = db_repo
# #         self.user_db_repo = user_db_repo
# #         self.api_key_service = api_key_service
# #         self.vectorstore = vectorstore
# #         self.chunks = chunks
# #         self.dangerous_commands = dangerous_commands or ["drop", "delete", "truncate", "alter"]
# #         self.last_conversation_history = last_conversation_history or []
# #         self.session_id = session_id
# #         self.message_id = message_id
# #         self.last_query_id = None
# #         self.target_db_url = target_db_url
# #         self.db_drive = db_drive
# #         self.db_display_name = db_display_name
# #         self.stream_callback = stream_callback

# #         if superset_service is None:
# #             self.superset_service = SupersetService(
# #                 host="starai.local:8088", username="admin", password="admin"
# #             )
# #         else:
# #             self.superset_service = superset_service
            
# #         self._max_history_messages = 4
# #         self._max_message_chars = 500
# #         self._max_history_chars = 1500
# #         self._max_prompt_chars = 15000
# #         self._max_schema_chars = 10000
# #         self._max_hybrid_chars = 5000
        
# #         # All your prompt templates remain the same
# #         # ══════════════════════════════════════════════════════════════════════
# #         #  🧠 CORE LLM PROMPTS
# #         # ══════════════════════════════════════════════════════════════════════
# #         self.CONVERSATIONPROMPT = """
# # SYSTEM: You are a high-intelligence Maritime Intent Classifier. 
# # Output ONLY one label from the list below.

# # USER QUESTION: "{question}"
# # CONTEXT: {conversation}

# # LABELS:
# # - DB_QUERY: Standard data retrieval, finding locations, distances, nearest land, nearby ships/boat, or waypoint details.
# # - ANALYSIS: Requests for trends, forecasts, complex business logic, fuel usage, or long-term travel analysis.
# # - CREATE_CHART: Explicit request for a visual graph or plot.
# # - ACCESS_DASHBOARD: Requests to open or link a Superset dashboard.
# # - CHAT: Greetings, small talk, or general non-database questions.

# # RULE: If the question involves "location", "distance", "lat/lon", "where is", or "nearest", label it DB_QUERY.
# # """

# #         self.CHATNODEPROMPT = """
# # You are STAR-AI, a professional database assistant built by BrainBox Tardid.
# # Previous conversation:
# # {conversation}
# # User question: {question}
# # Rules:
# # - You cannot modify the database.
# # - No web search allowed.
# # - Only answer questions related to the connected database.
# # - For off-topic questions, politely refuse.
# # - Keep replies concise and professional.
# # """
# #         self.FOLLOWUPQUESTIONMODIFYPROMPT = """
# # SYSTEM: Output ONLY a single rewritten question. No explanation. No labels.
# # Given the conversation and the current user question, merge them into one
# # complete, self-contained question suitable for a SQL database assistant.
# # Conversation:
# # {conversation}
# # Current user question: {user_question}
# # Output: (single question only)
# # """
# #         self.SQLANALYSISPROMPT = """
# # You are STAR-AI, a professional database assistant built by BrainBox Tardid.
# # User question: {user_question}
# # This database has no information related to what the user is asking.
# # Reply professionally. Do not mention any SQL query.
# # """
# #         self.SQLFAILEDANALYSISPROMPT = """
# # You are STAR-AI, a professional database assistant built by BrainBox Tardid.
# # User question: {user_question}
# # A SQL query could not be generated or executed for this request.
# # Reply professionally, suggest the user ask simpler questions, and give 2-3 example questions you can answer.
# # """
# #         self.SQLNORESULTANALYSISPROMPT = """
# # You are STAR-AI, a professional database assistant built by BrainBox Tardid.
# # User question: {user_question}
# # The query returned zero rows.
# # - Provide insights on why the result might be empty.
# # - Suggest 2-3 follow-up questions (use format "Do you want me to..." / "Would you like me to...").
# # - Do NOT mention any SQL query.
# # - Do NOT reply in a table format.
# # - Do NOT tell the user to check the data themselves.
# # """
# #         self.SQLRESULTANALYSISPROMPT = """
# # SYSTEM: You are STAR-AI, a Senior Maritime Data Analyst built by BrainBox Tardid.
# # The user asked: "{user_question}"
# # Rows retrieved: {row_count}

# # TASK:
# # 1. The data is already displayed in the UI. Do NOT list or invent data rows.
# # 2. If location data is present, mention it conceptually.
# # 3. Suggest 2-3 logical follow-up questions (format: "Do you want me to..." / "Would you like me to...").

# # STRICT RULES:
# # - Follow-up questions must be answerable by SQL only.
# # - Do NOT say "Based on the database..." or "Here is the information:".
# # - Do NOT mention SQL, tables, or database internals.
# # - Do NOT invent data.
# # """
# #         self.DASHBOARD_REPORT_PROMPT = """
# # You are a Senior Business Data Analyst for STAR AI.
# # Write a professional Executive Report based on the '{db_name}' dashboard context.
# # {dashboard_context}
# # Use Markdown styling, emojis (📊, 📈, 💡), and bullet points.
# # Make it professional and ready for leadership.
# # Current request: {user_question}
# # """
# #         self.FILTER_EXTRACTION_PROMPT = """
# # SYSTEM: Output ONLY a valid JSON array. No markdown. No explanation.
# # Extract ONLY explicit data constraints or time ranges from this user request: '{user_question}'
# # Current Date for Reference: {current_date_str}
# # RULES:
# # 1. Output a JSON ARRAY of filter objects with keys: "col", "op", "val"
# # 2. Operators allowed: "==", "!=", ">=", "<=", "LIKE"
# # 3. Translate natural time into ">=" and "<=" filters on the 'date' column.
# # 4.  CRITICAL: Do NOT extract chart IDs, dashboard names, or visualization types (e.g. 'ID: 42', 'viz: None') as filters. Only extract constraints on actual database data.
# # 5. If no real data filters are explicitly requested, return exactly: []
# # FORMAT: JSON array only. Nothing else.
# # """
# #         self.CHART_ANALYSIS_PROMPT = """
# # You are STAR AI, an elite Business Data Analyst built by Tardid Technologies.
# # Chart name: '{chart_name}' (ID: {chart_id})
# # User question: '{question}'
# # {filter_context}
# # Raw data powering this chart:
# # Columns: {headers}
# # Data Sample (Top 10 rows): {clean_data_sample}
# # Provide a professional, highly analytical response based ONLY on this data.

# # CRITICAL INSTRUCTION: You MUST divide your response into EXACTLY these four sections using these exact markdown headers:
# # ## Executive Summary
# # ## Key Findings
# # ## Recommendations
# # ## Action Plan

# # Use Markdown formatting, bullet points, and highlight key insights.
# # """        


# #     def _robust_extract_output(self, raw_str: str, table_list: list = None) -> str:
# #         clean = re.sub(r'```json\s*|\s*```|`', '', raw_str).strip()
# #         if table_list is not None:
# #             if "NEED_VIRTUAL_DATASET" in clean:
# #                 return "NEED_VIRTUAL_DATASET"
# #             for t in table_list:
# #                 if t.lower() in clean.lower():
# #                     return t
# #             return "NEED_VIRTUAL_DATASET"
# #         match = re.search(r'\{.*?\}', clean, re.DOTALL)
# #         if match:
# #             json_text = match.group()
# #             json_text = re.sub(r',\s*([\}\]])', r'\1', json_text)
# #             return json_text
# #         return clean

# #     def _extract_sql(self, raw_str: str) -> str:
# #         clean = re.sub(r'```sql\s*|\s*```|`', '', raw_str, flags=re.IGNORECASE).strip()
# #         match = re.search(r'(?i)\b(SELECT|WITH)\b.*', clean, re.DOTALL)
# #         if match:
# #             sql = match.group(0).strip()
# #             return sql.rstrip(';') + ';'
# #         return clean

# #     def get_system_prompt_for_db(self, driver: str) -> str:
# #         driver = driver.lower() if driver else "postgresql"
        
# #         dialect_rules = {
# #             "postgresql": (
# #                 "CRITICAL SPATIAL RULES FOR POSTGIS (INDIA WEST + AIS DATA):\n"
# #                 "0. PURE GEOMETRY: If explicitly asking for distance between named places, use `ST_Distance(a.geom::geography, b.geom::geography) / 1000.0 AS distance_km`.\n"
# #                 "1. OWN BOAT CURRENT LOCATION: Query `gps_tracking` using `ORDER BY created_at DESC LIMIT 1`. SELECT `gt.*` PLUS `ST_AsGeoJSON(ST_SetSRID(ST_Point(gt.longitude, gt.latitude), 4326)) AS geojson`.\n"
# #                 "2. CURRENT LOCATION BY WAYPOINT: Query `gps_tracking` using `WHERE waypoint_id = X ORDER BY created_at DESC LIMIT 1`.\n"
# #                 "3. NEAREST LAND POINT: Use a CTE to fetch the boat's location, then UNION ALL `india_west_places`, `india_west_transport`, and `india_west_natural`. ORDER BY distance ASC LIMIT 1.\n"
# #                 "4. TARGET TABLE MATCHING: 'city'->places, 'port'->transport, 'beach'->natural, 'ship'->ais_data.\n"
# #                 "5. DISTANCE APPEND: MUST append `ST_Distance(target.geom::geography, boat.geom::geography) / 1000.0 AS distance_km`.\n"
# #                 "6. FORWARD-ONLY CORRIDOR: If asking for targets 'ahead', build a corridor: `WITH boat AS (SELECT ST_SetSRID(ST_Point(gt.longitude, gt.latitude), 4326)::geography AS geom, n.heading FROM gps_tracking gt JOIN navigation n ON gt.waypoint_id = n.waypoint_id ORDER BY gt.created_at DESC LIMIT 1), projected AS (SELECT ST_MakeLine(boat.geom::geometry, ST_Project(boat.geom, 50000, radians(boat.heading))::geometry)::geography AS path FROM boat)`.\n"
# #                 "7. AUTOMATIC ROUTE GENERATION: `ST_AsGeoJSON(ST_Segmentize(ST_MakeLine(current_boat.geom::geometry, nearest_ship.geom::geometry)::geography, 5000)::geometry) AS waypoints_geojson`.\n"
# #                 "8. PREDICTIVE TRAJECTORY: `ST_AsGeoJSON(ST_Project(ST_SetSRID(ST_Point(longitude, latitude), 4326)::geography, (navigation.speed * 0.514444) * (X * 60), radians(navigation.heading))::geometry)`.\n"
# #                 "9. TRIGGER KEYWORDS ['instability', 'roll', 'pitch']: `SELECT gt.created_at, n.roll, n.pitch, e.wind_speed, CASE WHEN n.roll > 15 OR n.pitch > 10 THEN 'High Instability Alert' ELSE 'Stable' END AS status FROM gps_tracking gt JOIN navigation n ON gt.waypoint_id = n.waypoint_id LEFT JOIN environment e ON gt.waypoint_id = e.waypoint_id ORDER BY gt.created_at DESC LIMIT 1;`\n"
# #                 "10. DYNAMIC GEOFENCING: CROSS JOIN `projected` and use `WHERE ST_DWithin(projected.path, target.geom::geography, 2000)`.\n"
# #                 "11. TRIGGER KEYWORDS ['bypass', 'detour', 'offset']: `WITH cb AS (SELECT ST_SetSRID(ST_Point(longitude, latitude), 4326)::geometry AS geom FROM gps_tracking ORDER BY created_at DESC LIMIT 1), ns AS (SELECT DISTINCT ON (mmsi) ST_SetSRID(ST_Point(longitude, latitude), 4326)::geometry AS geom FROM ais_data ORDER BY mmsi, created_at DESC LIMIT 1) SELECT ST_AsGeoJSON(ST_OffsetCurve(ST_MakeLine(cb.geom, ns.geom), 5000)) AS safe_bypass_geojson FROM cb CROSS JOIN ns;`\n"
# #                 "12. TRIGGER KEYWORDS ['dark vessel', 'alerts', 'hostile']: `WITH boat AS (...), projected AS (...) SELECT dva.scenario, ais.mmsi FROM dark_vessel_alerts dva JOIN ais_data ais ON dva.mmsi = ais.mmsi CROSS JOIN projected WHERE ST_DWithin(projected.path, ST_SetSRID(ST_Point(ais.longitude, ais.latitude), 4326)::geography, 2000);`\n"
# #                 "13. TRIGGER KEYWORDS ['engine_effort', 'engine effort', 'thruster']: For dynamic geofencing with engine load, USE EXACTLY: `SELECT gt.created_at, e.thruster_position, n.name AS zone_name FROM gps_tracking gt JOIN engine e ON gt.waypoint_id = e.waypoint_id CROSS JOIN india_west_natural n WHERE n.fclass ILIKE '%beach%' AND e.thruster_position > 0.8 AND ST_DWithin(ST_SetSRID(ST_Point(gt.longitude, gt.latitude), 4326)::geography, n.geom::geography, 2000) ORDER BY gt.created_at DESC LIMIT 1;` Adjust fclass and threshold based on user prompt.\n"
# #                 "14. TRIGGER KEYWORDS ['will pass within', 'intercept', 'hit in the next']: For predictive time-to-intercept, use speed * time. USE EXACTLY: `WITH boat AS (SELECT ST_SetSRID(ST_Point(gt.longitude, gt.latitude), 4326)::geography AS geom, n.heading, n.speed FROM gps_tracking gt JOIN navigation n ON gt.waypoint_id = n.waypoint_id ORDER BY gt.created_at DESC LIMIT 1), projected AS (SELECT ST_MakeLine(boat.geom::geometry, ST_Project(boat.geom, (boat.speed * 0.514444) * (30 * 60), radians(boat.heading))::geometry)::geography AS path FROM boat) SELECT t.name, t.fclass, ST_Distance(boat.geom, t.geom::geography)/1000.0 AS current_dist_km FROM india_west_transport t CROSS JOIN projected WHERE t.fclass ILIKE '%railway%' AND ST_DWithin(projected.path, t.geom::geography, 5000);` Replace 30*60 with requested time in seconds.\n"
# #                 "15. TRIGGER KEYWORDS ['anomaly in motion', 'unstable while within', 'struggling']: For historical anomaly correlation, DO NOT USE LIMIT 1. USE EXACTLY: `SELECT gt.created_at, gt.latitude, gt.longitude, n.roll, n.pitch, nat.name AS location_name FROM gps_tracking gt JOIN navigation n ON gt.waypoint_id = n.waypoint_id CROSS JOIN india_west_natural nat WHERE nat.name ILIKE '%ACHRA BEACH%' AND (n.roll > 15 OR n.pitch > 10) AND ST_DWithin(ST_SetSRID(ST_Point(gt.longitude, gt.latitude), 4326)::geography, nat.geom::geography, 2000) ORDER BY gt.created_at DESC;` Adjust target name based on prompt.\n"
# #                 "16. TRIGGER KEYWORDS ['safety buffer', 'minimum approach', 'closer than']: For port safety corridors, exclude docking status. USE EXACTLY: `SELECT gt.created_at, t.name AS port_name, ST_Distance(ST_SetSRID(ST_Point(gt.longitude, gt.latitude), 4326)::geography, t.geom::geography) AS distance_meters FROM gps_tracking gt JOIN waypoints w ON gt.waypoint_id = w.id CROSS JOIN india_west_transport t WHERE t.fclass ILIKE '%port%' AND ST_DWithin(ST_SetSRID(ST_Point(gt.longitude, gt.latitude), 4326)::geography, t.geom::geography, 500) AND w.status != 'Docking' ORDER BY gt.created_at DESC;`\n"
# #             ),
# #             "mariadb": "Use standard ANSI SQL syntax.",
# #             "mysql": "Use standard ANSI SQL syntax.",
# #             "sqlite": "Use standard ANSI SQL syntax.",
# #             "mssql": "Use standard ANSI SQL syntax."
# #         }
# #         selected_rules = dialect_rules.get(driver, "Use standard ANSI SQL syntax.")
        
# #         prompt = f"""
# # SYSTEM: You are an expert {driver.upper()} and PostGIS Maritime Analyst.
# # Write a read-only SQL query based ONLY on these schema chunks:
# # {{chunks_text}}

# # USER QUESTION: {{question}}

# # GENERAL CRITICAL RULES:
# # * Write ONLY valid {driver.upper()} SQL.
# # * NO explanations. Do not speak English.
# # * DO NOT INVENT TABLE OR COLUMN NAMES. Never assume standard names like 'sales' or 'orders' exist.
# # * Use correct table and column names exactly as shown in the schema.
# # * Use double quotes for columns/tables with spaces, special characters, or capitalized names (e.g. `"Category"`).
# # * Do not return markdown fences like ```sql or `. Just return the raw SQL query.
# # * Prefer LEFT JOIN when unsure.
# # * If the question is completely unrelated to the schema, return "select 1 where false;" without explanation.
# # * Do not return an empty response, always return either a valid SQL query or "select 1 where false;"
# # * When using Order by, use NULLS LAST
# # * 🚀 "DETAILS" REQUESTS: If the user asks for "details of [table] id [X]", interpret this as: SELECT * FROM [table] WHERE id = [X];

# # UNIVERSAL JOIN RULES:
# # 1. Join on PK-FK pairs shown in schema chunks.
# # 2. If explicit relations shown (A.col ↔ B.col), join on those columns.
# # 3. If no FK relation shown, join ONLY on same-named columns with clearly same meaning.

# # DIALECT SPECIFIC RULES ({driver.upper()}):
# # {selected_rules}

# # Write ONLY the raw {driver.upper()} SQL query starting with SELECT or WITH.
# # """
# #         return prompt

# #     def get_error_fixing_prompt(self, driver: str) -> str:
# #         driver = driver.lower() if driver else "postgresql"
# #         display_name = {"mariadb": "MariaDB", "postgresql": "PostgreSQL", "mysql": "MySQL", "sqlite": "SQLite", "mssql": "MS SQL Server"}.get(driver, driver.upper())
# #         return f"""
# #         You are an expert {display_name} SQL query corrector.
# #         Inputs:
# #         1. User Question: {{user_question}}
# #         2. Database Schema: {{chunks_text}}
# #         3. Error Message: {{error}}
# #         4. Incorrect SQL Query: {{sql}}
        
# #         Rules:
# #             1. Timestamp / Date Handling
# #                 Use CURRENT_TIMESTAMP or NOW() for current time.
# #                 Use CURRENT_DATE for today's date.
# #                 Use DATE_TRUNC('day', column) to truncate timestamps.
# #                 Use column::date to convert timestamp to date.
# #                 Use column + INTERVAL '1 day' for date arithmetic.
# #                 Use EXTRACT(YEAR FROM column_name), EXTRACT(MONTH FROM column_name) to extract month, year etc
# #                 Do not use year = **** or month = **
# #             2. PostGIS / Spatial Error Handling
# #                 If the error mentions spatial signatures (like ST_Distance matching), ensure you cast columns with ::geography.
# #                 If generating a point, always ensure the SRID is set: ST_SetSRID(ST_Point(lon, lat), 4326).
# #                 Remember ST_Point takes longitude first, latitude second.
                
# #         Task:
# #         - Correct the query so that it runs successfully on the given {display_name} schema.
# #         - Make sure the query accurately answers the user question.
# #         - Output ONLY the raw SQL query. NO markdown fences. NO text. Start directly with SELECT.
# #         """

# #     def _get_history_string(self) -> str:
# #         history_texts = []
# #         for msg in self.last_conversation_history:
# #             if hasattr(msg, 'content'):
# #                 history_texts.append(msg.content)
# #             else:
# #                 history_texts.append(str(msg))
# #         return "\n\n".join(history_texts)


# #     # ============================================
# #     # ASYNC HELPER: LLM Call with Rate Limit Handling
# #     # ============================================



# #     async def _call_llm_with_retry(self, prompt: str, attempt=1, max_attempts=3, stream_to_ui: bool = False) -> str:
# #         import re
# #         from datetime import datetime, timedelta 

# #         try:
# #             if stream_to_ui and self.stream_callback and hasattr(self.llm, "astream_text"):
# #                 parts = []
# #                 async for part in self.llm.astream_text(prompt):
# #                     parts.append(part)
# #                     try:
# #                         self.stream_callback(part)
# #                     except Exception:
# #                         pass
# #                 response = "".join(parts)
# #             else:
# #                 if asyncio.iscoroutinefunction(self.llm.invoke):
# #                     response = await self.llm.invoke(prompt)
# #                 else:
# #                     loop = asyncio.get_event_loop()
# #                     response = await loop.run_in_executor(None, self.llm.invoke, prompt)
            
# #             await self.api_key_service.update_api_key_status(
# #                 api_key=self.active_api_key,
# #                 param={"last_used_at": datetime.now()} 
# #             )
            
# #             if isinstance(response, str):
# #                 return response
# #             return response.content.strip()

# #         except Exception as e:
# #             error_str = str(e).lower()
            
# #             # 🛑 Handle Rate Limit & 413 Payload Errors
# #             if (
# #                 "request too large" in error_str
# #                 or "requested" in error_str and "tokens per minute" in error_str
# #                 or "request_too_large" in error_str
# #                 or "request entity too large" in error_str
# #                 or "413" in error_str
# #                 or "rate limit" in error_str 
# #                 or "429" in error_str 
# #                 or "please try again in" in error_str
# #             ) and attempt < max_attempts:
# #                 print(f"⚠️ Payload/Rate limit hit on attempt {attempt}. Attempting API key switch and prompt shrink...")
                
# #                 smaller_prompt = prompt[: max(1000, int(len(prompt) * 0.5))]
                
# #                 new_api_key, msg = await self.api_key_service.get_retry_api_key_logic(
# #                     api_key=self.active_api_key, error_detail=str(e)
# #                 )

# #                 if not new_api_key or attempt >= max_attempts:
# #                     wait_seconds = 60 
# #                     match = re.search(r"try again in ([\d\.]+)s", error_str)
# #                     if match:
# #                         wait_seconds = float(match.group(1))
                    
# #                     next_available = (datetime.now() + timedelta(seconds=wait_seconds)).strftime("%H:%M:%S")
                    
# #                     return (f"⚠️ **API Request Limited.**\n\n"
# #                             f"The data request was too large or all keys are limited. "
# #                             f"The system will be available again at **{next_available}**.")

# #                 self.active_api_key = new_api_key
# #                 self.llm = GroqLLM(api_key=new_api_key)
# #                 return await self._call_llm_with_retry(
# #                     smaller_prompt, attempt=attempt + 1, max_attempts=max_attempts, stream_to_ui=stream_to_ui
# #                 )
# #             else:
# #                 raise

# #     def _clean_relations(self, chunks_text: str) -> str:
# #         tables = set(re.findall(r"TABLE:\s*(\w+)", chunks_text, re.IGNORECASE))
# #         cleaned_blocks = []
# #         current_block = []
# #         in_relations = False
# #         seen_relations = set()
# #         for line in chunks_text.split("\n"):
# #             line_strip = line.strip()
# #             if line_strip.startswith("TABLE:"):
# #                 if current_block:
# #                     cleaned_blocks.append("\n".join(current_block))
# #                 current_block = [line]
# #                 in_relations = False
# #                 continue
# #             if line_strip.startswith("RELATIONS:"):
# #                 current_block.append(line)
# #                 in_relations = True
# #                 continue
# #             if in_relations and ("->" in line or "↔" in line):
# #                 matches = re.findall(r"(\w+)\.(\w+)", line)
# #                 if len(matches) >= 2:
# #                     (left_table, left_col), (right_table, right_col) = matches[0], matches[1]
# #                     if left_table in tables and right_table in tables:
# #                         relation_key = tuple(sorted([
# #                             f"{left_table}.{left_col}",
# #                             f"{right_table}.{right_col}"
# #                         ]))
# #                         if relation_key not in seen_relations:
# #                             seen_relations.add(relation_key)
# #                             current_block.append(line)
# #                 continue
# #             current_block.append(line)
# #         if current_block:
# #             cleaned_blocks.append("\n".join(current_block))
# #         return "\n\n".join(cleaned_blocks)

# #     def _hybrid_retrieve(self, question: str) -> str:
# #         v_store = getattr(self, 'vectorstore', None)

# #         if v_store is None:
# #             return "Error: Vectorstore is not initialized."

# #         sem_docs = v_store.as_retriever(search_kwargs={"k": 50}).invoke(question)
# #         candidates = {d.metadata.get("table", "unknown"): d for d in sem_docs}.values()

# #         q = question.lower()
# #         scored = []
        
# #         # 🚀 EXTENDED SEMANTIC KEYWORD BOOSTER (Tactical Update)
# #         keyword_map = {
# #             "gps_tracking": ["current location", "where will", "closer than", "minimum approach", "coordinate", "history", "tracking"],
# #             "navigation": ["speed", "heading", "pitch", "roll", "predict", "trajectory", "instability", "unstable", "struggling"],
# #             "engine": ["thruster", "efficiency", "engine", "engine_effort", "effort"],
# #             "waypoints": ["waypoint", "route", "path", "status", "docking", "mission"],
# #             "dark_vessel_alerts": ["dark vessel", "danger", "alert", "threat", "historical dark vessel"],
# #             "ais_data": ["ship", "ships", "vessel", "intercept"],
# #             "india_west_places": ["city", "town", "village", "island", "density", "zone"],
# #             "india_west_transport": ["airport", "railway", "ferry", "station", "port", "buffer", "approach", "infrastructure"],
# #             "india_west_natural": ["beach", "reef", "coast", "sanctuary", "rocky", "shallows", "restricted"]
# #         }

# #         for doc in candidates:
# #             table = doc.metadata.get("table", "").lower()
# #             content = doc.page_content.lower()

# #             score = 0
# #             column_hits = 0
# #             columns = [col.strip() for col in content.split(",") if col.strip()]

# #             for col in columns:
# #                 ratio = fuzz.partial_ratio(col, q)
# #                 if ratio > 85:
# #                     score += 3
# #                     column_hits += 1
# #                 elif ratio > 70:
# #                     score += 2
# #                     column_hits += 1

# #             table_ratio = fuzz.partial_ratio(table, q)
# #             if table_ratio > 85: score += 3
# #             elif table_ratio > 70: score += 2

# #             if column_hits > 0 and table_ratio > 70: score += 2
                
# #             for t_name, keywords in keyword_map.items():
# #                 if table == t_name and any(k in q for k in keywords):
# #                     score += 15 

# #             scored.append((score, doc))

# #         scored.sort(reverse=True, key=lambda x: x[0])
# #         if not scored: return ""
# #         top_score = scored[0][0]

# #         final_docs = [doc for score, doc in scored if score >= max(2, top_score * 0.3)]

# #         if len(final_docs) < 5 and len(scored) >= 5:
# #             final_docs = [doc for _, doc in scored[:5]]
# #         elif not final_docs:
# #             final_docs = [doc for _, doc in scored[:3]]

# #         return "\n\n".join(d.page_content for d in final_docs)

# #     async def _verify_query(self, sql: str, state: dict, target_db_url: str = None):
# #         session_id = state.get("session_id")
# #         message_id = state.get("message_id")
# #         user_id = state.get("user_id")
# #         db_url = target_db_url or state.get("target_db_url")
# #         self.results = []
# #         error_msg = None
# #         csv_path_str = None
# #         try:
# #             if db_url:
# #                 sync_url = (
# #                     db_url.replace("+asyncpg", "")
# #                     .replace("+aiosqlite", "")
# #                     .replace("+aiomysql", "+pymysql")
# #                     .replace("+asyncmy", "+pymysql")
# #                     .replace("+aioodbc", "+pyodbc")
# #                 )
# #                 def _direct_execute():
# #                     print(f"DEBUG: Executing SQL: {sql}")
# #                     masked_url = re.sub(r':([^@/]+)@', ':***@', sync_url)
# #                     print(f"DEBUG: Connecting to: {masked_url}")
# #                     engine = create_engine(sync_url)
# #                     with engine.connect() as conn:
# #                         ctx = conn.execute(text("SELECT current_user, current_schema()")).fetchone()
# #                         print(f"DEBUG: DB CONTEXT: user={ctx[0]}, schema={ctx[1]}")
# #                         result = conn.execute(text(sql))
# #                         keys = list(result.keys())
# #                         rows = result.fetchall()
# #                         print(f"DEBUG: Keys: {keys}, Row count: {len(rows)}")
# #                         return keys, rows
# #                 loop = asyncio.get_event_loop()
# #                 keys, rows = await loop.run_in_executor(None, _direct_execute)
# #                 print(f"DEBUG: TOTAL ROWS FETCHED: {len(rows)}")
# #                 self.results = []
# #                 for row in rows:
# #                     print(f"DEBUG: RAW ROW FROM DB: {row}")
# #                     print(f"DEBUG: Processing row: {row}")
# #                     new_row = {}
# #                     for idx, key in enumerate(keys):
# #                         val = row[idx]
# #                         if isinstance(val, Decimal):
# #                             new_row[str(key)] = float(val)
# #                         elif isinstance(val, (datetime, date)):
# #                             new_row[str(key)] = val.isoformat()
# #                         elif isinstance(val, uuid.UUID):
# #                             new_row[str(key)] = str(val)
# #                         else:
# #                             new_row[str(key)] = val
# #                     self.results.append(new_row)
# #             else:
# #                 error_msg = "No target database URL found. Please star a database."
# #         except Exception as e:
# #             print(f"❌ Error in _verify_query: {e}")
# #             self.results = []
# #             error_msg = str(e)

# #         return "successfully" if not error_msg else f"Error: {error_msg}"

# #     # ══════════════════════════════════════════════════════════════════════════
# #     #  LANGGRAPH NODES
# #     # ══════════════════════════════════════════════════════════════════════════
# #     async def _classify_intent(self, state: AgentStateScehma) -> dict:
# #         question = state["user_question"]
# #         active_db = state.get("active_dashboard", "None")
# #         conversation = self._get_history_string()
# #         prompt = self.CONVERSATIONPROMPT.format(
# #             active_dashboard=active_db,
# #             conversation=conversation,
# #             question=question
# #         )
# #         intent = await self._call_llm_with_retry(prompt)
        
# #         intent = self._robust_extract_output(intent)
# #         for valid_intent in ["ACCESS_DASHBOARD", "GENERATE_REPORT", "FETCH_CHART", "DB_QUERY", "FOLLOW_UP_SQL", "CHAT", "ANALYZE_CHART", "CREATE_CHART", "ANALYSIS", "ANALYTICS"]:
# #             if valid_intent in intent.upper():
# #                 intent = valid_intent
# #                 break
# #         return {
# #             "intent": intent,
# #             "user_question": (
# #                 state["messages"][-1].content
# #                 if hasattr(state["messages"][-1], 'content')
# #                 else str(state["messages"][-1])
# #             )
# #         }

# #     def _route_intent(self, state: AgentStateScehma) -> str:
# #         q_raw = str(state.get("user_question", "")).lower().strip()
# #         q = q_raw.strip('"\'') 
# #         intent = str(state.get("intent", "")).upper()
        
# #         # 🚀 ADVANCED ROUTING FIX: Catch anomalies, predictions, and routing
# #         sql_keywords = [
# #             "distance", "disttnace", "dist", "check", "generate a route", 
# #             "predict", "instability", "safe bypass", "where will", "anomaly",
# #             "dark vessel", "fences", "restricted area", "buffer", "engine effort"
# #         ]
# #         coord_pattern = r'(\d+\.?\d*)\s*,\s*(\d+\.?\d*)'
        
# #         if len(re.findall(coord_pattern, q)) >= 2 or any(word in q for word in sql_keywords):
# #             return "schema"
            
# #         if "dashboard" in q or "ACCESS_DASHBOARD" in intent:
# #             return "access_dashboard"
            
# #         if q.startswith("chart[") or "viz:" in q or q.startswith("- metric:"):
# #             clean_name = re.sub(r'(?i)^chart\[\d+\]:\s*', '', state["user_question"])
# #             clean_name = re.sub(r'(?i)- metric:\s*', '', clean_name)
# #             clean_name = re.sub(r'(?i)\s*\(id:.*', '', clean_name)
# #             clean_name = re.sub(r'(?i)\s*\(viz:.*', '', clean_name)
# #             state["user_question"] = clean_name.strip()
# #             return "fetch_chart"

# #         if "REPORT" in intent or "2" in intent:  return "report_gen"
        
# #         if "CREATE" in intent or "8" in intent or any(kw in q for kw in ["chart", "graph", "plot", "viz"]):  
# #             return "create_chart"

# #         words = q.split()
# #         if "QUERY" in intent or "4" in intent or any(w in words for w in ["count", "list", "show", "retrieve", "get"]):  
# #             return "schema"

# #         if "FETCH"  in intent or "3" in intent:  return "fetch_chart"
# #         if "FOLLOW" in intent or "5" in intent:  return "followup"
        
# #         return "chat"

# #     # ── ACCESS DASHBOARD ───────────────────────────────────────────────────────
# #     async def _access_dashboard_node(self, state: AgentStateScehma) -> dict:
# #         q = state["user_question"] 
# #         db_master_name = self.db_display_name
# #         base_host = self.superset_service.host if self.superset_service else "starai.local:8088"
# #         dashboard_name = "System"
# #         target_id = "1"
        
# #         if self.superset_service:
# #             loop = asyncio.get_running_loop()
# #             matched_db = await loop.run_in_executor(
# #                 None, self.superset_service.find_best_dashboard_match, db_master_name
# #             )
            
# #             if matched_db:
# #                 dashboard_name = matched_db["title"]
                
# #                 if dashboard_name.strip().lower() != db_master_name.strip().lower():
# #                     msg = f"⚠️ Dashboard linking failed: The connected database display name '{db_master_name}' must exactly match the Superset dashboard name."
# #                     return {"messages": [AIMessage(content=msg)], "status": "ERROR"}

# #                 target_id = str(matched_db.get("id"))
# #                 url = f"http://{base_host}/superset/dashboard/{target_id}/?standalone=2"
                
# #                 try:
# #                     chart_summary = await loop.run_in_executor(
# #                         None, self.superset_service.get_dashboard_summary, dashboard_name
# #                     )
# #                     chart_info = f"\n\n**Detected Charts & Metrics:**\n{chart_summary}"
# #                 except Exception:
# #                     chart_info = ""
                    
# #                 msg = (
# #                     f"✅ **{dashboard_name} Dashboard Linked.**\n"
# #                     f"I have synchronized the data stream for your primary database '{db_master_name}'.{chart_info}\n\n"
# #                     f"You can now generate reports or request specific graphs."
# #                 )
# #                 return {
# #                     "messages": [AIMessage(content=msg)],
# #                     "status": "DASHBOARD_LOADED",
# #                     "active_dashboard": dashboard_name,
# #                     "dashboard_url": url,
# #                     "session_cookie": self.superset_service.get_session_cookie()
# #                 }
# #             else:
# #                 msg = f"⚠️ I could not find a matching dashboard in Superset for your database '{db_master_name}'."
# #                 return {"messages": [AIMessage(content=msg)], "status": "ERROR"}

# #         return {"messages": [AIMessage(content="Superset service not connected.")], "status": "ERROR"}

# #     # ── REPORT GEN ─────────────────────────────────────────────────────────────
# #     async def _report_gen_node(self, state: AgentStateScehma) -> dict:
# #         q = state["user_question"].lower()
# #         db_name = state.get("active_dashboard")
        
# #         if not db_name and self.superset_service:
# #             loop = asyncio.get_running_loop()
# #             matched_db = await loop.run_in_executor(None, self.superset_service.find_best_dashboard_match, q)
# #             if matched_db: db_name = matched_db["title"]
            
# #         if not db_name:
# #             db_name = "System"
            
# #         dashboard_context = ""
# #         base_host = self.superset_service.host if self.superset_service else "starai.local:8088"
# #         url = f"http://{base_host}/superset/dashboard/{db_name.lower()}/"
# #         if "standalone=2" not in url:
# #             url += ("?" if "?" not in url else "&") + "standalone=2"
            
# #         if self.superset_service:
# #             try:
# #                 loop = asyncio.get_running_loop()
# #                 chart_data = await loop.run_in_executor(
# #                     None, self.superset_service.get_dashboard_summary, db_name
# #                 )
# #                 dashboard_context = f"\nLive Superset Data Context:\n{chart_data}"
# #                 id_match = re.search(r"\(ID:\s*(\d+)\)", chart_data)
# #                 if id_match:
# #                     dash_id = id_match.group(1)
# #                     url = f"http://{base_host}/superset/dashboard/{dash_id}/"
# #                     if "standalone=2" not in url:
# #                         url += ("?" if "?" not in url else "&") + "standalone=2"
# #             except Exception as e:
# #                 pass
# #         report_prompt = self.DASHBOARD_REPORT_PROMPT.format(
# #             db_name=db_name,
# #             dashboard_context=dashboard_context,
# #             user_question=state['user_question']
# #         )
# #         res = await self._call_llm_with_retry(report_prompt)
# #         return {
# #             "status": "REPORT",
# #             "messages": [AIMessage(content=res)],
# #             "dashboard_url": url,
# #             "session_cookie": self.superset_service.get_session_cookie()
# #         }

# #     # ── FETCH CHART ────────────────────────────────────────────────────────────
# #     async def _fetch_chart_node(self, state: AgentStateScehma) -> dict:
# #         q = state["user_question"].lower()
# #         db_name = state.get("active_dashboard")
# #         if not db_name:
# #             for msg in reversed(self.last_conversation_history):
# #                 content = msg.content if hasattr(msg, 'content') else str(msg)
# #                 match = re.search(r"✅ \*\*(.*?)\s+Dashboard Linked", content, re.IGNORECASE)
# #                 if match:
# #                     db_name = match.group(1).strip()
# #                     break
                    
# #         if not db_name and self.superset_service:
# #             loop = asyncio.get_running_loop()
# #             matched_db = await loop.run_in_executor(None, self.superset_service.find_best_dashboard_match, q)
# #             if matched_db: db_name = matched_db["title"]

# #         if not db_name:
# #             msg = "⚠️ Please access a dashboard first (e.g., 'Access Meglan')."
# #             return {"messages": [AIMessage(content=msg)], "status": "ERROR"}
            
# #         if self.superset_service:
# #             try:
# #                 current_date_str = datetime.now().strftime('%Y-%m-%d')
# #                 filter_prompt = self.FILTER_EXTRACTION_PROMPT.format(
# #                     user_question=state['user_question'],
# #                     current_date_str=current_date_str
# #                 )
# #                 filter_res = await self._call_llm_with_retry(filter_prompt)
# #                 extra_filters = []
# #                 try:
# #                     clean_res = re.sub(r'```json\s*|\s*```|`', '', filter_res).strip()
# #                     arr_match = re.search(r'\[.*?\]', clean_res, re.DOTALL)
# #                     if arr_match:
# #                         raw_filters = json.loads(arr_match.group())
# #                         for f in raw_filters:
# #                             clean_key = f.get("col", "").lower().strip().replace(" ", "_")
# #                             op = f.get("op", "==")
# #                             val = str(f.get("val", ""))
# #                             extra_filters.append({"col": clean_key, "op": op, "val": val})
# #                 except Exception as e:
# #                     print(f"⚠️ Filter extraction failed: {e}")
# #                 loop = asyncio.get_running_loop()
# #                 chart_details = await loop.run_in_executor(
# #                     None, self.superset_service.get_chart_details, db_name,
# #                     state["user_question"], extra_filters
# #                 )
# #                 if "error" in chart_details:
# #                     return {
# #                         "messages": [AIMessage(content=f"⚠️ {chart_details['error']}")],
# #                         "status": "ERROR"
# #                     }
# #                 print(f"🎯 Fetching Live Embed AND Native Raw Data for '{chart_details['name']}'...")
# #                 raw_data = await loop.run_in_executor(
# #                     None, self.superset_service.get_chart_raw_data,
# #                     chart_details["id"], extra_filters
# #                 )
# #                 filter_msg = " (Filtered by AI)" if extra_filters else ""
# #                 if raw_data:
# #                     msg = f"✅ Extracted live view & raw data for **{chart_details['name']}**{filter_msg}."
# #                 else:
# #                     msg = (
# #                         f"✅ Loading live metric: **{chart_details['name']}**{filter_msg}...\n"
# #                         f"*(No raw data rows matched your filters)*"
# #                     )
# #                     print("⚠️ Raw data extraction yielded no rows, falling back to Live View only.")
# #                 filter_str = json.dumps(extra_filters) if extra_filters else "[]"
# #                 msg += f"\n*(Chart ID: {chart_details.get('id')} | Filters: {filter_str})*"
# #                 c_url = chart_details.get("url")
# #                 if "standalone=2" not in c_url:
# #                     c_url += ("?" if "?" not in c_url else "&") + "standalone=2"
# #                 return {
# #                     "messages": [AIMessage(content=msg)],
# #                     "status": "CHART_LOADED",
# #                     "id": chart_details.get("id"),
# #                     "chart_url": c_url,
# #                     "download_url": chart_details.get("download_url"),
# #                     "result": raw_data if raw_data else [],
# #                     "chart_name": chart_details["name"],
# #                     "session_cookie": chart_details.get("session_cookie"),
# #                     "active_chart_id": chart_details.get("id"),
# #                     "active_chart_name": chart_details["name"]
# #                 }
# #             except Exception as e:
# #                 print(f"⚠️ Superset Node Error: {e}")
# #                 return {"messages": [AIMessage(content=f"Error: {e}")], "status": "ERROR"}
# #         return {
# #             "messages": [AIMessage(content="Superset service not connected.")],
# #             "status": "ERROR"
# #         }

# #     # ── CREATE CHART ──────────────────────────────────────────────────────────
# #     async def _create_chart_node(self, state: AgentStateScehma) -> dict:
# #         import decimal
# #         import json
# #         import os
# #         import asyncio
# #         import pandas as pd
# #         import numpy as np
# #         import plotly.graph_objects as go
# #         import plotly.io as pio
# #         from datetime import datetime, date
# #         import uuid
# #         from sqlalchemy import create_engine, text
# #         from langchain_core.messages import AIMessage

# #         q = state["user_question"]
# #         loop = asyncio.get_running_loop()

# #         if not self.target_db_url:
# #             return {"messages": [AIMessage(content="⚠️ No database connected.")], "status": "ERROR"}

# #         schema_path = state.get("schema_path")
# #         chunks_text = state.get("chunks_text", "")
        
# #         if not chunks_text and schema_path and os.path.exists(schema_path):
# #             with open(schema_path, "r", encoding="utf-8") as f: 
# #                 chunks_text = f.read()

# #         try:
# #             sql_prompt = self.get_system_prompt_for_db(self.db_drive).format(
# #                 chunks_text=chunks_text, question=q
# #             )
# #         except AttributeError:
# #             sql_prompt = f"SYSTEM: You are a SQL Expert. Output ONLY raw SQL for: '{q}'. Schema:\n{chunks_text}"

# #         raw_sql = await self._call_llm_with_retry(sql_prompt)
# #         sql_query = self._extract_sql(raw_sql)

# #         if not sql_query.lower().strip().startswith(("select", "with")):
# #             return {"messages": [AIMessage(content="⚠️ Failed to generate a valid SQL query.")], "status": "ERROR"}

# #         chart_data = []
# #         try:
# #             sync_url = self.target_db_url.replace("+asyncpg", "").replace("+aiosqlite", "").replace("+aiomysql", "+pymysql").replace("+asyncmy", "+pymysql").replace("+aioodbc", "+pyodbc")
            
# #             def _fetch_data():
# #                 engine = create_engine(sync_url)
# #                 with engine.connect() as conn:
# #                     result = conn.execute(text(sql_query))
# #                     keys = list(result.keys())
# #                     return keys, result.fetchall()

# #             keys, rows = await loop.run_in_executor(None, _fetch_data)

# #             for row in rows:
# #                 new_row = {}
# #                 for idx, key in enumerate(keys):
# #                     val = row[idx]
# #                     key_name = str(key).strip()
# #                     if isinstance(val, decimal.Decimal): new_row[key_name] = float(val)
# #                     elif isinstance(val, (datetime, date)): new_row[key_name] = val.isoformat()
# #                     elif isinstance(val, uuid.UUID): new_row[key_name] = str(val)
# #                     else: new_row[key_name] = val
# #                 chart_data.append(new_row)
            
# #         except Exception as e:
# #             return {"messages": [AIMessage(content=f"⚠️ SQL execution error: {e}\n\nHint: Check if column names like 'Category' need capitalization.")], "status": "ERROR"}

# #         if not chart_data:
# #             return {"messages": [AIMessage(content="⚠️ No data returned for the chart.")], "status": "ERROR"}

# #         df = pd.DataFrame(chart_data)
# #         df.columns = [str(c).strip() for c in df.columns]
# #         columns = list(df.columns)
        
# #         for col in columns:
# #             try:
# #                 converted = pd.to_numeric(df[col], errors='coerce')
# #                 if converted.notna().any(): 
# #                     df[col] = converted
# #             except Exception: 
# #                 pass
                
# #         numeric_cols = df.select_dtypes(include='number').columns.tolist()
# #         data_sample = df.head(3).to_dict(orient="records")

# #         config_prompt = f"""
# # SYSTEM: You are a Data Visualization Configuration Expert.
# # USER QUESTION: '{q}'
# # AVAILABLE COLUMNS: {columns}
# # NUMERIC COLUMNS: {numeric_cols}
# # DATA SAMPLE: {data_sample}

# # TASK: Generate a valid JSON configuration.
# # RULES:
# # 1. "chart_type": "line", "bar", "pie", or "scatter". 
# # 2. "x_col": primary category (must EXACTLY MATCH one of {columns}, preserving case).
# # 3. "y_cols": LIST of numeric columns to plot (must EXACTLY MATCH from {numeric_cols}).
# # 4. "color_col": categorical column to group/color the data by (optional, empty string if none).
# # 5. "sort": "desc", "asc", or "none".
# # 6. "limit": integer for Top N (e.g., 10), or 0 for all.
# # 7. "title": Short descriptive title.

# # Output ONLY valid JSON. No markdown tags.
# # """
# #         raw_config = await self._call_llm_with_retry(config_prompt)
# #         config_str = self._robust_extract_output(raw_config)

# #         try: 
# #             config = json.loads(config_str)
# #         except Exception: 
# #             config = {}

# #         chart_type = config.get("chart_type", "line").lower()
# #         x_col_raw = str(config.get("x_col", columns[0])).strip()
# #         y_cols_raw = config.get("y_cols", [numeric_cols[0]] if numeric_cols else [columns[-1]])
# #         color_col_raw = str(config.get("color_col", "")).strip()
# #         sort_order = config.get("sort", "none").lower()
# #         limit = int(config.get("limit", 0))
# #         title = config.get("title", f"Chart Analysis")

# #         def correct_case(col_name, valid_cols):
# #             for c in valid_cols:
# #                 if c.lower() == col_name.lower(): return c
# #             return col_name

# #         x_col = correct_case(x_col_raw, columns)
# #         y_cols = [correct_case(y, columns) for y in y_cols_raw]
# #         color_col = correct_case(color_col_raw, columns) if color_col_raw else ""

# #         x_data_clean = []
# #         if x_col in df.columns:
# #             for val in df[x_col].tolist():
# #                 try:
# #                     if isinstance(val, (int, float)) and val > 10000000000:
# #                         x_data_clean.append(pd.to_datetime(val, unit='ms').strftime('%Y-%m-%d %H:%M:%S'))
# #                     elif isinstance(val, (int, float)) and val > 100000000:
# #                         x_data_clean.append(pd.to_datetime(val, unit='s').strftime('%Y-%m-%d %H:%M:%S'))
# #                     elif pd.notna(val):
# #                         x_data_clean.append(str(val))
# #                     else:
# #                         x_data_clean.append(None)
# #                 except Exception:
# #                     x_data_clean.append(str(val))
            
# #             df['clean_x'] = x_data_clean

# #             if any(t in x_col.lower() for t in ['time', 'date', 'created', 'timestamp']):
# #                 df['temp_time'] = pd.to_datetime(df['clean_x'], errors='coerce')
# #                 df = df.dropna(subset=['temp_time']).sort_values(by='temp_time', ascending=True).drop(columns=['temp_time'])
# #                 sort_order = "none" 
# #         else:
# #             df['clean_x'] = [str(i) for i in range(len(df))]
            
# #         if sort_order == "desc" and y_cols and y_cols[0] in df.columns: 
# #             df = df.sort_values(by=y_cols[0], ascending=False)
# #         elif sort_order == "asc" and y_cols and y_cols[0] in df.columns:
# #             df = df.sort_values(by=y_cols[0], ascending=True)

# #         if limit > 0: df = df.head(limit)

# #         if df.empty:
# #             return {"messages": [AIMessage(content="⚠️ Chart generation failed: All data was filtered out or invalid.")], "status": "ERROR"}
        
# #         df = df.replace([np.inf, -np.inf], np.nan).where(pd.notnull(df), None)

# #         def sanitize_for_json(v):
# #             if v is None or (isinstance(v, float) and np.isnan(v)): return None
# #             if isinstance(v, (np.integer, int)): return int(v)
# #             if isinstance(v, (np.floating, float)): return float(v)
# #             if isinstance(v, (datetime, date)): return v.isoformat()
# #             if hasattr(v, '__str__'):
# #                 try: return float(v) if '.' in str(v) else int(v)
# #                 except: return str(v)
# #             return str(v)

# #         theme_colors = ['#00D1FF', '#7C4DFF', '#0099BB', '#2A8080', '#00E5FF', '#FF007F', '#FFD700']
# #         layout_args = dict(
# #             paper_bgcolor='#161E1E', plot_bgcolor='#161E1E', font_color='#E0E0E0',
# #             margin=dict(l=60, r=40, t=70, b=80),
# #             legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
# #             title=dict(text=title, font=dict(size=18), x=0.5, xanchor='center')
# #         )

# #         try:
# #             fig = go.Figure()
# #             valid_y_cols = [c for c in y_cols if c in df.columns and c in numeric_cols]
# #             if not valid_y_cols and numeric_cols: valid_y_cols = [numeric_cols[0]]
            
# #             if color_col and color_col in df.columns and valid_y_cols:
# #                 groups = df[color_col].dropna().unique()
# #                 for i, group_val in enumerate(groups):
# #                     color = theme_colors[i % len(theme_colors)]
# #                     group_df = df[df[color_col] == group_val]
                    
# #                     x_clean = [sanitize_for_json(x) for x in group_df['clean_x'].tolist()]
# #                     y_clean = []
# #                     for yv in group_df[valid_y_cols[0]].tolist():
# #                         sv = sanitize_for_json(yv)
# #                         y_clean.append(float(sv) if sv is not None else 0.0)
                    
# #                     mode = 'markers' if chart_type == 'scatter' else 'lines'
                    
# #                     if chart_type in ['scatter', 'line']:
# #                         fig.add_trace(go.Scatter(
# #                             x=x_clean, y=y_clean, name=str(group_val), mode=mode,
# #                             marker=dict(color=color, size=8), line=dict(color=color, width=2.5),
# #                             hovertemplate=f'%{{x}}<br>{valid_y_cols[0]}: %{{y}}<extra></extra>'
# #                         ))
# #                     elif chart_type == 'bar':
# #                         fig.add_trace(go.Bar(x=x_clean, y=y_clean, name=str(group_val), marker_color=color))
# #             else:
# #                 x_clean = [sanitize_for_json(x) for x in df['clean_x'].tolist()]
# #                 for i, col in enumerate(valid_y_cols):
# #                     color = theme_colors[i % len(theme_colors)]
# #                     y_clean = []
# #                     for yv in df[col].tolist():
# #                         sv = sanitize_for_json(yv)
# #                         y_clean.append(float(sv) if sv is not None else 0.0)
                    
# #                     if chart_type == "line":
# #                         fig.add_trace(go.Scatter(x=x_clean, y=y_clean, name=str(col), mode='lines', line=dict(color=color, width=2.5), hovertemplate=f'%{{x}}<br>{col}: %{{y}}<extra></extra>'))
# #                     elif chart_type == "scatter":
# #                         fig.add_trace(go.Scatter(x=x_clean, y=y_clean, name=str(col), mode='markers', marker=dict(color=color, size=8), hovertemplate=f'%{{x}}<br>{col}: %{{y}}<extra></extra>'))
# #                     elif chart_type == "bar":
# #                         fig.add_trace(go.Bar(x=x_clean, y=y_clean, name=str(col), marker_color=color))
# #                     elif chart_type == "pie":
# #                         fig.add_trace(go.Pie(labels=x_clean, values=y_clean, hole=0.4, marker=dict(colors=theme_colors)))
# #                         break

# #             fig.update_layout(
# #                 xaxis=dict(
# #                     showgrid=True, gridcolor='#1F2E2E', automargin=True, tickangle=-45,
# #                     type='date' if any(t in x_col.lower() for t in ['time', 'date', 'created']) else 'category'
# #                 ),
# #                 yaxis=dict(showgrid=True, gridcolor='#1F2E2E', automargin=True),
# #                 **layout_args
# #             )

# #             chart_json = pio.to_json(fig)
# #         except Exception as e:
# #             return {"messages": [AIMessage(content=f"⚠️ Plotly render error: {e}")], "status": "ERROR"}

# #         insight_prompt = f"Provide 2 concise bullet point insights for {title} using this data: {data_sample}. Handle spelling mistakes from original request if any."
# #         insights = await self._call_llm_with_retry(insight_prompt)

# #         return {
# #             "messages": [AIMessage(content=f"✨ **{title}**\n\n**Insights:**\n{insights}")],
# #             "status": "CHART_LOADED", "chart_json": chart_json, "result": chart_data, 
# #             "chart_name": title, "sql_query": sql_query
# #         }

# #     # ── CHAT ───────────────────────────────────────────────────────────────────
# #     async def _chat_node(self, state: AgentStateScehma) -> dict:
# #         conversation = self._get_history_string()
# #         prompt = self.CHATNODEPROMPT.format(
# #             conversation=conversation,
# #             question=state["user_question"]
# #         )
# #         response = await self._call_llm_with_retry(prompt, stream_to_ui=True)
# #         return {"messages": [AIMessage(content=response)]}

# #     # ── SCHEMA ─────────────────────────────────────────────────────────────────
# #     async def _schema_node(self, state: AgentStateScehma) -> dict:
# #         @tool("retrieve_schema", description="Retrieve schema for generating sql query", args_schema=RetreiveSchemaSchema)
# #         def retrieve_schema_tool(question: str) -> str:
# #             schema_path = state.get("schema_path")
# #             file_content = ""
# #             if schema_path and os.path.exists(schema_path):
# #                 with open(schema_path, "r", encoding="utf-8") as f:
# #                     file_content = f.read()
            
# #             hybrid_chunks = self._hybrid_retrieve(question)
            
# #             critical_tables = [
# #                 "waypoints", "gps_tracking", "ais_data",
# #                 "india_west_places", "india_west_transport", "india_west_natural",
# #                 "chat_message", "chat_session"
# #             ]
# #             forced_context = ""
# #             for table in critical_tables:
# #                 if table not in hybrid_chunks and table in file_content:
# #                     pattern = rf"(CREATE TABLE {table}.*?;)"
# #                     match = re.search(pattern, file_content, re.DOTALL | re.IGNORECASE)
# #                     if match:
# #                         forced_context += f"\n[CRITICAL TABLE DEFINITION]:\n{match.group(1)}\n"
            
# #             # 🚀 SEMANTIC DICTIONARY INJECTION
# #             semantic_dictionary = """
# # ### DATABASE SEMANTICS & RELATIONSHIPS (CRITICAL CONTEXT) ###
# # - **chat_message**: Stores all user questions and AI responses for the dynamic chat system. Use this for counting messages, finding history, or chat analysis.
# # - **chat_session**: Groups chat messages into distinct sessions.
# # - **meglan_boat_info**: Represents YOUR own boat. Primary key `id` maps to `boat_id` in telemetry tables.
# # - **waypoints**: Represents a specific trip or mission metadata. `status = 'Docking'` means the boat is parked. Links to telemetry via `waypoint_id`.
# # - **gps_tracking**: LIVE and historical location (Lat/Lon) of YOUR boat.
# # - **navigation**: Live physical movement of YOUR boat. Contains `speed`, `heading`, `pitch` (vertical tilt / instability), `roll` (horizontal tilt / instability).
# # - **engine**: Contains `thruster_position` which represents 'engine effort' or 'engine load'.
# # - **environment**: Contains local `wind_speed` and `wind_direction`.
# # - **ais_data**: Represents OTHER nearby ships/vessels. Use this for 'intercept' or 'nearest ship'. Contains their `mmsi`.
# # - **dark_vessel_alerts**: Hostile/Alert tracking. Join with `ais_data` on `mmsi` to get their physical location.
# # - **detections**: Camera/radar object detection (bounding boxes, object_type).
# # - **india_west_natural / india_south_natural**: Spatial polygons for natural zones (beaches, coast, reefs, restricted sanctuary).
# # - **india_west_places / india_south_places**: Spatial polygons for high-density areas (cities, towns).
# # - **india_west_transport / india_south_transport**: Spatial polygons for infrastructure (ports, docks, railway stations).
# #             """
            
# #             return f"### RELEVANT TABLES ###\n{hybrid_chunks}\n{forced_context}\n\n{semantic_dictionary}"

# #         chunks = await asyncio.to_thread(retrieve_schema_tool.invoke, {"question": state["user_question"]})
        
# #         return {
# #             "chunks_text": chunks,
# #             "messages": [AIMessage(content="Retrieved schema with forced context injection.")]
# #         }

# #     # ── SQL GEN ────────────────────────────────────────────────────────────────
# #     async def _sql_gen_node(self, state: AgentStateScehma) -> dict:
# #         @tool("generate_sql", description="generates postgresql query based on the question and schema chunks", args_schema=GenerateSQLSchema)
# #         async def generate_sql_tool(question: str, chunks_text: str) -> str:
# #             safe_chunks = chunks_text[:self._max_schema_chars]
# #             dialect_instructions = self.get_system_prompt_for_db(self.db_drive)
# #             prompt = dialect_instructions.format(chunks_text=safe_chunks, question=question)
# #             return await self._call_llm_with_retry(prompt)

# #         raw_sql = await generate_sql_tool.ainvoke({
# #             "question": state["user_question"],
# #             "chunks_text": state.get("chunks_text", "")
# #         })

# #         sql_query = self._extract_sql(raw_sql)
# #         sql_query = re.sub(r'^```sql\s*\n?', '', sql_query, flags=re.IGNORECASE)
# #         sql_query = re.sub(r'\n?```$', '', sql_query).strip()
        
# #         if "SELECT" in sql_query.upper() or "WITH" in sql_query.upper():
# #             match = re.search(r'(?i)(SELECT|WITH).*', sql_query, re.DOTALL)
# #             if match:
# #                 sql_query = match.group(0).strip()
                
# #         if "gps_tracking" in sql_query.lower() and "order by" not in sql_query.lower():
# #             sql_query = sql_query.rstrip(';') + " ORDER BY created_at DESC LIMIT 1;"
                
# #         chunks_text = state.get("chunks_text", "")
# #         db_tables = list(set([t.lower() for t in re.findall(r"TABLE:\s*([a-zA-Z0-9_]+)", chunks_text, re.IGNORECASE) + re.findall(r"CREATE TABLE\s+([a-zA-Z0-9_]+)", chunks_text, re.IGNORECASE)]))
        
# #         if db_tables:
# #             default_table = db_tables[0]
# #             for t in db_tables:
# #                 if t in state["user_question"].lower():
# #                     default_table = t
# #                     break
            
# #             bad_tables = ['sales', 'orders', 'transactions', 'customer_transactions', 'transaction_history', 'data']
# #             for bad in bad_tables:
# #                 sql_query = re.sub(rf'(?i)\bFROM\s+["\']?{bad}["\']?\b', f'FROM "{default_table}"', sql_query)
# #                 sql_query = re.sub(rf'(?i)\bJOIN\s+["\']?{bad}["\']?\b', f'JOIN "{default_table}"', sql_query)

# #         if not sql_query.lower().startswith("select") and not sql_query.lower().startswith("with"):
# #             q_lower = state["user_question"].lower()
# #             default_table = db_tables[0] if db_tables else "users"
# #             if "count" in q_lower:
# #                 sql_query = f'SELECT COUNT(*) FROM "{default_table}";'
# #             elif "list" in q_lower or "show" in q_lower or "get" in q_lower:
# #                 sql_query = f'SELECT * FROM "{default_table}" LIMIT 15;'
# #             else:
# #                 sql_query = f'SELECT * FROM "{default_table}" LIMIT 5;'

# #         return {
# #             "sql_query": sql_query,
# #             "messages": [AIMessage(content="Generated SQL")]
# #         }

# #     def _verify_sql_safety(self, sql_str: str) -> bool:
# #         pattern = r'\b(' + '|'.join(self.dangerous_commands) + r')\b'
# #         return not re.search(pattern, sql_str.lower())

# #     async def _fix_sql_error(
# #         self, user_question: str, sql_str: str, error: str, chunks_text: str
# #     ) -> str:
# #         @tool("fix_sql_error", description="Fixes SQL error from database", args_schema=FixSQLSchema)
# #         async def fix_sql_error_tool(user_question: str, sql: str, error: str, chunks_text: str) -> str:
# #             prompt = self.get_error_fixing_prompt(self.db_drive).format(
# #                 user_question=user_question, chunks_text=chunks_text, error=error, sql=sql
# #             )
# #             raw = await self._call_llm_with_retry(prompt)
# #             return raw

# #         raw_sql = await fix_sql_error_tool.ainvoke({
# #             "user_question": user_question, "sql": sql_str, "error": error, "chunks_text": chunks_text
# #         })
        
# #         fixed_sql = self._extract_sql(raw_sql)
# #         fixed_sql = re.sub(r'^```sql\s*\n?', '', fixed_sql, flags=re.IGNORECASE)
# #         fixed_sql = re.sub(r'\n?```$', '', fixed_sql).strip()
        
# #         db_tables = list(set([t.lower() for t in re.findall(r"TABLE:\s*([a-zA-Z0-9_]+)", chunks_text, re.IGNORECASE) + re.findall(r"CREATE TABLE\s+([a-zA-Z0-9_]+)", chunks_text, re.IGNORECASE)]))
# #         if db_tables:
# #             default_table = db_tables[0]
# #             for t in db_tables:
# #                 if t in user_question.lower():
# #                     default_table = t
# #                     break
# #             bad_tables = ['sales', 'orders', 'transactions', 'customer_transactions', 'transaction_history', 'data']
# #             for bad in bad_tables:
# #                 fixed_sql = re.sub(rf'(?i)\bFROM\s+["\']?{bad}["\']?\b', f'FROM "{default_table}"', fixed_sql)
# #                 fixed_sql = re.sub(rf'(?i)\bJOIN\s+["\']?{bad}["\']?\b', f'JOIN "{default_table}"', fixed_sql)

# #         return fixed_sql

# #     # ── VERIFY ─────────────────────────────────────────────────────────────────
# #     async def _verify_node(self, state: AgentStateScehma) -> dict:
# #         sql_str    = state.get("sql_query", "")
# #         chunks_text = state.get("chunks_text", "")
# #         question   = state.get("user_question", "")
# #         target_db_url = state.get("target_db_url")
# #         user_id    = state.get("user_id")
# #         session_id = state.get("session_id")
# #         message_id = state.get("message_id")
        
# #         if "⚠️ API Rate Limit Exhausted" in sql_str:
# #             return {
# #                 "user_id": user_id, "session_id": session_id,
# #                 "message_id": message_id, "target_db_url": target_db_url,
# #                 "sql_query": sql_str, "query_id": None, "result": [],
# #                 "messages": [AIMessage(content=sql_str)]
# #             }
            
# #         for attempt in range(4):
# #             if not self._verify_sql_safety(sql_str):
# #                 return {
# #                     "user_id": user_id, "session_id": session_id,
# #                     "message_id": message_id, "target_db_url": target_db_url,
# #                     "sql_query": sql_str, "query_id": None, "result": [],
# #                     "messages": [AIMessage(content="⚠️ Query contains dangerous operations")]
# #                 }
# #             result_status = await self._verify_query(
# #                 sql_str, state, target_db_url=target_db_url
# #             )
# #             current_query_id = getattr(self, 'last_query_id', None)
            
# #             if "successfully" in result_status.lower() or "valid" in result_status.lower():
# #                 return {
# #                     "user_id": user_id, "session_id": session_id,
# #                     "message_id": message_id, "target_db_url": target_db_url,
# #                     "last_sql": sql_str, "sql_query": sql_str,
# #                     "query_id": current_query_id,
# #                     "result": self.results if self.results else [],
# #                     "status": "DATA_LOADED" if self.results else "NO_RESULTS", 
# #                     "messages": [AIMessage(content="SQL verified successfully")]
# #                 }
# #             if attempt < 3:
# #                 sql_str = await self._fix_sql_error(
# #                     question, sql_str, result_status, chunks_text[:self._max_schema_chars]
# #                 )
# #                 if "⚠️ API Rate Limit Exhausted" in sql_str:
# #                     return {
# #                         "user_id": user_id, "session_id": session_id,
# #                         "message_id": message_id, "target_db_url": target_db_url,
# #                         "sql_query": sql_str, "query_id": current_query_id,
# #                         "result": [], "messages": [AIMessage(content=sql_str)]
# #                     }
# #                 self.results = []
# #             else:
# #                 return {
# #                     "user_id": user_id, "session_id": session_id,
# #                     "message_id": message_id, "target_db_url": target_db_url,
# #                     "sql_query": sql_str, "query_id": current_query_id,
# #                     "last_sql": "select 2 where false;", "result": [],
# #                     "status": "ERROR", 
# #                     "messages": [AIMessage(
# #                         content=f"❌ SQL failed after 4 attempts. Last error: {result_status}"
# #                     )]
# #                 }
                
# #         return {
# #             "user_id": user_id, "session_id": session_id,
# #             "message_id": message_id, "target_db_url": target_db_url,
# #             "sql_query": sql_str,
# #             "result": self.results if self.results else [],
# #             "query_id": getattr(self, 'last_query_id', None),
# #             "messages": [AIMessage(content="Verification process completed.")]
# #         }

# #     # ── FOLLOW-UP QUESTION MERGE ───────────────────────────────────────────────
# #     async def _followup_question_modify(self, state: AgentStateScehma) -> dict:
# #         prompt = self.FOLLOWUPQUESTIONMODIFYPROMPT.format(
# #             conversation=self._get_history_string(),
# #             user_question=state["user_question"]
# #         )
# #         merged_question = await self._call_llm_with_retry(prompt)
# #         return {"user_question": merged_question}

# #     # ── ANSWER ─────────────────────────────────────────────────────────────────
# #     async def _answer_node(self, state: AgentStateScehma) -> dict:
# #         last_sql        = state.get("last_sql", "")
# #         sql_query_text = state.get("sql_query", "")
# #         results         = state.get("result", [])
# #         row_count      = len(results)
# #         if isinstance(sql_query_text, str) and "⚠️ API Rate Limit Exhausted" in sql_query_text:
# #             return {"messages": [AIMessage(content=sql_query_text)]}
            
# #         if not last_sql or "select 1 where false" in last_sql.lower():
# #             prompt = self.SQLANALYSISPROMPT.format(
# #                 user_question=state["user_question"],
# #                 last_sql=last_sql
# #             )
# #         elif "select 2 where false" in last_sql.lower():
# #             prompt = self.SQLFAILEDANALYSISPROMPT.format(
# #                 user_question=state["user_question"]
# #             )
# #         elif row_count == 0:
# #             prompt = self.SQLNORESULTANALYSISPROMPT.format(
# #                 user_question=state["user_question"],
# #                 last_sql=last_sql
# #             )
# #         else:
# #             prompt = f"""
# #             You are STAR-AI. 
# #             SQL Executed: {last_sql}
# #             Last question: {state["user_question"]}
            
# #             The data has been successfully retrieved and displayed in a secure UI table. 
# #             DO NOT attempt to explain or guess the data. DO NOT provide insights.
            
# #             STRICT REQUIREMENT: Acknowledge the table is displayed, and suggest 2-3 follow-up questions.
# #             Format: "Do you want me to...", "Would you like me to...", "If you want, I will..."
# #             No SQL in follow-up suggestions.
# #             """
# #         suggestions = await self._call_llm_with_retry(prompt, stream_to_ui=True)
        
# #         status = "DATA_LOADED" if len(state.get("result", [])) > 0 else "NO_RESULTS"
        
# #         return {
# #             "messages": [AIMessage(content=suggestions)],
# #             "status": status
# #         }

# #     # ══════════════════════════════════════════════════════════════════════════
# #     #  MAIN ORCHESTRATOR
# #     # ══════════════════════════════════════════════════════════════════════════
# #     async def build_and_run_graph(self):
# #         q_lower = str(self.question).lower().strip()
        
# #         is_create_chart = (
# #             q_lower.startswith("create ") or
# #             "generate a new" in q_lower or
# #             "build a chart" in q_lower or
# #             "scatter plot" in q_lower or
# #             "bar graph" in q_lower or
# #             "chart" in q_lower or
# #             "graph" in q_lower
# #         )
# #         is_metric_fetch = (
# #             q_lower.startswith("- metric:") or
# #             "visualization:" in q_lower or
# #             "parquet" in q_lower
# #         )
# #         dashboard_keywords = ["meglan", "warnetix", "neuroeye", "system"]
# #         is_dashboard_access = (
# #             any(kw in q_lower for kw in dashboard_keywords) and len(q_lower.split()) <= 4
# #         ) or "access dashboard" in q_lower
        
# #         compact_history = []
# #         for msg in self.last_conversation_history[-self._max_history_messages:]:
# #             msg_content = getattr(msg, "content", "")
# #             if not isinstance(msg_content, str):
# #                 msg_content = str(msg_content)
# #             if len(msg_content) > self._max_message_chars:
# #                 msg_content = msg_content[:self._max_message_chars] + " ..."
# #             if isinstance(msg, HumanMessage):
# #                 compact_history.append(HumanMessage(content=msg_content))
# #             else:
# #                 compact_history.append(AIMessage(content=msg_content))
# #         question_text = self.question if isinstance(self.question, str) else str(self.question)
# #         if len(question_text) > self._max_message_chars:
# #             question_text = question_text[:self._max_message_chars] + " ..."

# #         mock_state = {
# #             "messages": compact_history + [HumanMessage(content=question_text)],
# #             "user_question": self.question,
# #             "user_id": str(self.user_id),
# #             "session_id": str(self.session_id) if self.session_id else None,
# #             "message_id": str(self.message_id) if self.message_id else None,
# #             "target_db_url": self.target_db_url,
# #             "result": [],
# #             "sql_query": "",
# #             "query_id": getattr(self, "last_query_id", None),
# #             "active_chart_id": None,
# #             "active_chart_name": None,
# #             "download_url": None  
# #         }

# #         db_display_name = getattr(self, "db_display_name", "GISDB")
# #         paths = get_db_storage_paths(self.user_id, db_display_name)
# #         schema_file_path = paths["schema_file"] if paths else None
        
# #         if schema_file_path and not schema_file_path.exists():
# #             os.makedirs(os.path.dirname(str(schema_file_path)), exist_ok=True)
# #             try:
# #                 sync_url = (
# #                     self.target_db_url
# #                     .replace("+asyncpg", "")
# #                     .replace("+aiosqlite", "")
# #                 )
                
# #                 class GeometryType(sqltypes.UserDefinedType):
# #                     def get_col_spec(self, **kw):
# #                         return "GEOMETRY"

# #                 engine   = create_engine(sync_url)
# #                 metadata = MetaData()
                
# #                 @event.listens_for(metadata, "column_reflect")
# #                 def receive_column_reflect(inspector, table, column_info):
# #                     raw_type = str(column_info.get("type", "")).lower()
# #                     if any(geo in raw_type for geo in ["geometry", "geography", "raster", "postgis"]):
# #                         column_info["type"] = GeometryType()
# #                     elif isinstance(column_info.get("type"), sqltypes.NullType):
# #                         column_info["type"] = GeometryType()
                        
# #                 metadata.reflect(bind=engine)
                
# #                 with open(str(schema_file_path), "w", encoding="utf-8") as f:
# #                     for table in metadata.sorted_tables:
# #                         for column in table.columns:
# #                             if type(column.type).__name__ == 'NullType' or isinstance(column.type, sqltypes.NullType):
# #                                 column.type = GeometryType()
                                
# #                         ddl = CreateTable(table).compile(
# #                             engine, compile_kwargs={"literal_binds": True}
# #                         )
# #                         f.write(
# #                             re.sub(r'CREATE TABLE \w+\.', 'CREATE TABLE ', str(ddl).strip())
# #                             + ";\n" + "-" * 30 + "\n"
# #                         )
# #                 engine.dispose()
# #             except Exception as e:
# #                 print(f"⚠️ Schema extraction error: {e}")
# #                 pass
                
# #         if schema_file_path:
# #             mock_state["schema_path"] = str(schema_file_path)
# #             mock_state["vector_path"] = str(paths["vector_store"]) if paths else ""
            
# #         bypassed_state = None
# #         if is_create_chart:
# #             bypassed_state = await self._create_chart_node(mock_state)
# #         elif is_metric_fetch:
# #             clean_q = re.sub(
# #                 r'\(visualization:\s*[^)]+\)', '', self.question, flags=re.IGNORECASE
# #             )
# #             mock_state["user_question"] = re.sub(
# #                 r'- metric:\s*', '', clean_q, flags=re.IGNORECASE
# #             ).strip()
# #             bypassed_state = await self._fetch_chart_node(mock_state)
# #         elif is_dashboard_access:
# #             bypassed_state = await self._access_dashboard_node(mock_state)

# #         if bypassed_state:
# #             final_state = mock_state
# #             final_state.update(bypassed_state)
# #         else:
# #             workflow = StateGraph(AgentStateScehma)
# #             workflow.add_node("intent",           self._classify_intent)
# #             workflow.add_node("access_dashboard", self._access_dashboard_node)
# #             workflow.add_node("report_gen",       self._report_gen_node)
# #             workflow.add_node("fetch_chart",      self._fetch_chart_node)
# #             workflow.add_node("create_chart",     self._create_chart_node)
# #             workflow.add_node("schema",           self._schema_node)
# #             workflow.add_node("sql_gen",          self._sql_gen_node)
# #             workflow.add_node("verify",           self._verify_node)
# #             workflow.add_node("answer",           self._answer_node)
# #             workflow.add_node("chat",             self._chat_node)
# #             workflow.add_node("followup",         self._followup_question_modify)
            
# #             workflow.add_edge(START, "intent")
# #             workflow.add_conditional_edges("intent", self._route_intent)
# #             for n in [
# #                 "access_dashboard", "report_gen", "fetch_chart",
# #                 "create_chart"
# #             ]:
# #                 workflow.add_edge(n, END)
# #             workflow.add_edge("schema",  "sql_gen")
# #             workflow.add_edge("sql_gen", "verify")
# #             workflow.add_edge("verify",  "answer")
# #             workflow.add_edge("answer",  END)
# #             workflow.add_edge("followup", "schema")
# #             workflow.add_edge("chat",    END)

# #             graph = workflow.compile()
# #             input_state = mock_state
# #             input_state.update({"chunks_text": ""})
# #             final_state = input_state
# #             try:
# #                 async for step in graph.astream(input_state, stream_mode="values"):
# #                     final_state = step
# #             except Exception as e:
# #                 return {"langgraph_message": f"Execution halted: {str(e)}"}
                
# #         return self._package_final_response(final_state)

# #     # ══════════════════════════════════════════════════════════════════════════
# #     #  RESPONSE PACKAGER
# #     # ══════════════════════════════════════════════════════════════════════════
# #     def _package_final_response(self, state):
# #         messages = state.get("messages", [])
# #         ai_message_text = (
# #             messages[-1].content
# #             if messages and hasattr(messages[-1], 'content')
# #             else str(messages[-1]) if messages
# #             else "Error"
# #         )
        
# #         raw_results = state.get("result", [])
# #         clean_rows  = []
# #         columns     = []

# #         if raw_results:
# #             first_row = raw_results[0]
# #             if isinstance(first_row, dict): columns = list(first_row.keys())
# #             elif hasattr(first_row, "_mapping"): columns = list(first_row._mapping.keys())
# #             elif hasattr(first_row, "_asdict"): columns = list(first_row._asdict().keys())
# #             elif isinstance(first_row, (list, tuple)): columns = [f"Col_{i+1}" for i in range(len(first_row))]
# #             else: columns = ["Result"]
            
# #             for row in raw_results:
# #                 formatted_row = []
# #                 if isinstance(row, dict): items = row.items()
# #                 elif hasattr(row, "_mapping"): items = row._mapping.items()
# #                 elif hasattr(row, "_asdict"): items = row._asdict().items()
# #                 elif isinstance(row, (list, tuple)): items = enumerate(row)
# #                 else: items = [(0, row)]
                
# #                 for col_name, val in items:
# #                     if val is None:
# #                         formatted_row.append("")
# #                         continue
                        
# #                     col_str = str(col_name).lower()
                    
# #                     # 🚀 GEOJSON & DICT FORMATTING
# #                     if isinstance(val, (dict, list)):
# #                         try: val = json.dumps(val)
# #                         except: val = str(val)
# #                     elif isinstance(val, str) and '{"type"' in val:
# #                         try:
# #                             geo_data = json.loads(val)
# #                             if geo_data.get('type') == 'Point' and 'coordinates' in geo_data:
# #                                 val = f"Lng: {geo_data['coordinates'][0]}, Lat: {geo_data['coordinates'][1]}"
# #                         except:
# #                             pass
                    
# #                     # 🚀 DISTANCE FORMATTING
# #                     if "distance" in col_str and isinstance(val, (float, int, Decimal)):
# #                         try:
# #                             val = f"{round(float(val), 2)} km"
# #                         except:
# #                             pass
# #                     else:
# #                         try:
# #                             f_val = float(val)
# #                             if 1000000000000 < f_val < 3000000000000 and any(k in col_str for k in ['date', 'time', 'at', 'created', 'updated']):
# #                                 val = datetime.fromtimestamp(f_val / 1000.0).strftime('%Y-%m-%d %H:%M:%S')
# #                             elif 1000000000 < f_val < 3000000000 and any(k in col_str for k in ['date', 'time', 'at', 'created', 'updated']):
# #                                 val = datetime.fromtimestamp(f_val).strftime('%Y-%m-%d %H:%M:%S')
# #                         except (ValueError, TypeError):
# #                             pass
                            
# #                     formatted_row.append(str(val))
# #                 clean_rows.append(formatted_row)
        
# #         c_url = state.get("chart_url")
# #         if c_url:
# #             c_url = c_url.replace("standalone=1", "standalone=2")
# #             if "standalone=" not in c_url:
# #                 c_url += ("?" if "?" not in c_url else "&") + "standalone=2"
                
# #         last_sql = state.get('sql_query', '')
# #         query_id_str = str(state.get("query_id", ""))
        
# #         status = state.get("status")
# #         active_db = state.get("active_dashboard")
# #         db_url = state.get("dashboard_url")
# #         c_name = state.get("chart_name")
# #         c_id = state.get("id") or state.get("active_chart_id")
# #         dl_url = state.get("download_url") 
# #         session_cookie = state.get("session_cookie") 
# #         chart_json = state.get("chart_json") 
        
# #         return {
# #             "user_question": self.question,              # The final processed question
# #             "query": last_sql if last_sql else "",        # Raw SQL query executed
# #             "langgraph_message": ai_message_text,         # The AI's natural language response
# #             "result": clean_rows,                         # Full tabular data (unprocessed)
# #             "columns": columns,                           # Column headers
# #             "status": status,                             # UI state controller: DATA_LOADED, CHART_LOADED, ERROR
# #             "active_dashboard": active_db,                # Linked Superset dashboard name
# #             "dashboard_url": db_url,                      # iframe URL for dashboard
# #             "chart_url": c_url,                           # iframe URL for specific chart
# #             "chart_json": chart_json,                     # Plotly JSON for interactive charts
# #             "chart_name": c_name,                         # Title of the visualization
# #             "id": c_id,                                   # unique ID for the chart
# #             "download_url": dl_url,                       # CSV download link (Superset)
# #             "session_cookie": session_cookie,             # Auth cookie for iframe
# #             "chart_id": c_id                              # Alias for 'id'
# #         }
























#     # async def _call_llm_with_retry(self, prompt: str) -> str:
#     #     """
#     #     Centralized async LLM call with automatic retry logic and API key rotation.
#     #     """
#     #     try:
#     #         # Use async invoke if available
#     #         print("#####################################################################")
#     #         print(prompt)
#     #         print("#####################################################################")
#     #         if asyncio.iscoroutinefunction(self.llm.invoke):
#     #             response = await self.llm.invoke(prompt)
#     #         else:
#     #             # Run in executor if synchronous
#     #             loop = asyncio.get_event_loop()
#     #             response = await loop.run_in_executor(None, self.llm.invoke, prompt)
            
#     #         # Update API key usage
#     #         await self.api_key_service.update_api_key_status(
#     #             api_key=self.active_api_key,
#     #             param={"last_used_at": datetime.utcnow()}
#     #         )
#     #         print("1111111111111111111111111111111111111")
#     #         print(response)
#     #         if type(response) == str:
#     #             return response
#     #         return response.content.strip()
            
#     #     except Exception as e:
#     #         error_str = str(e)
#     #         print(f'❌ LLM Error: {error_str}')
            
#     #         # Handle rate limit errors
#     #         if "rate limit" in error_str.lower() or "please try again in" in error_str.lower():
#     #             new_api_key, msg = await self.api_key_service.get_retry_api_key_logic(
#     #                 api_key=self.active_api_key,
#     #                 error_detail=str(e)
#     #             )
                
#     #             if not new_api_key:
#     #                 raise Exception(str(msg))
                
#     #             # Update active key and LLM
#     #             self.active_api_key = new_api_key
#     #             self.llm = GroqLLM(api_key=new_api_key)
                
#     #             # Retry with new key
#     #             if asyncio.iscoroutinefunction(self.llm.invoke):
#     #                 response = await self.llm.invoke(prompt)
#     #             else:
#     #                 loop = asyncio.get_event_loop()
#     #                 response = await loop.run_in_executor(None, self.llm.invoke, prompt)
                
#     #             await self.api_key_service.update_api_key_status(
#     #                 api_key=self.active_api_key,
#     #                 param={"last_used_at": datetime.utcnow()}
#     #             )
                
#     #             return response.content.strip()
#     #         else:
#     #             raise

#     # # ============================================
#     # # NODE FUNCTIONS (ALL ASYNC)
#     # # ============================================

#     # def _hybrid_retrieve(self, question: str) -> str:
#     #     """Retrieve relevant schema chunks (synchronous)"""
#     #     top_n_sem = 4  # Reduced from 6
#     #     top_n_key = 2  # Reduced from 3
        
#     #     q = question.lower()

#     #     # Semantic retrieval
#     #     sem_docs = self.vectorstore.as_retriever(
#     #         search_kwargs={"k": top_n_sem}
#     #     ).invoke(question)

#     #     # Keyword table matching
#     #     scored = []
#     #     for d in self.chunks:
#     #         text = d.page_content.lower()
#     #         table = d.metadata.get("table", "").lower()
#     #         score = 0

#     #         if table in q:
#     #             score += 3

#     #         for col in text.split(","):
#     #             col = col.strip().lower()
#     #             if col and col in q:
#     #                 score += 1

#     #         scored.append((score, d))

#     #     scored.sort(reverse=True, key=lambda x: x[0])
#     #     key_docs = [d for score, d in scored[:top_n_key]]

#     #     # Deduplicate by table
#     #     merged = {d.metadata.get("table", ""): d for d in (sem_docs + key_docs)}
#     #     chunks_text = "\n".join(d.page_content for d in merged.values())
        
#     #     return chunks_text

#     # async def _generate_sql(self, question: str, chunks_text: str, db_drive: str) -> str:

#     #     """Generate SQL query (async)"""
#     #     print('************************************')
#     #     print(f"question is {question}")
#     #     print(f"chunks_text is {chunks_text}")
#     #     print('************************************')
#     #     prompt = self.SQLPROMPT.format(
#     #         chunks_text=chunks_text,
#     #         question=question,
#     #         sql_db=self.db_drive
#     #     )
        
#     #     return await self._call_llm_with_retry(prompt)

#     # async def _verify_query(self, query: str) -> str:
#     #     """Verify SQL query by executing it (async)"""
#     #     try:
#     #         # Use async DB execution if available
#     #         print(f"qqqqqqqqqq {query}")
#     #         if asyncio.iscoroutinefunction(self.db_repo.generate_sql_query_result):
#     #             print("INSIDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD")
#     #             result = await self.db_repo.generate_sql_query_result(sql=query)
#     #         else:
#     #             # Fallback to executor
#     #             print("FALLBACKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK ")
#     #             loop = asyncio.get_event_loop()
#     #             result = await loop.run_in_executor(
#     #                 None,
#     #                 self.db_repo.generate_sql_query_result,
#     #                 query
#     #             )
#     #         self.results = result
#     #         return "Query executed successfully"
            
#     #     except Exception as e:
#     #         print(f"eeeeeeeeeee {e}")
#     #         return str(e)

#     # async def _classify_intent(self, state: AgentStateScehma) -> dict:
#     #     """Classify user intent (async)"""
        
#     #     question = state["user_question"]
#     #     conversation = "\n\n".join(self.last_conversation_history)
        
#     #     prompt = self.CONVERSATIONPROMPT.format(
#     #         conversation=conversation,
#     #         question=question
#     #     )
        
#     #     intent = await self._call_llm_with_retry(prompt)
        
#     #     print(f"🔍 Classified intent: {intent}")
        
#     #     return {
#     #         "intent": intent,
#     #         "user_question": state["messages"][-1].content
#     #     }
    

#     # def _route_intent(self, state: AgentStateScehma) -> str:
#     #     """Route based on intent (synchronous)"""
#     #     intent = state["intent"]
        
#     #     if intent in ["DB_QUERY"]:
#     #         print("➡️  Routing to: schema")
#     #         return "schema"
#     #     elif intent in ["FOLLOW_UP_SQL"]:
#     #         print("➡️  Routing to: followup")
#     #         return "followup"
#     #     elif intent in ["CHAT", "FOLLOW_UP_NON_SQL"]:
#     #         print("➡️  Routing to: chat")
#     #         return "chat"
#     #     else:
#     #         print(f"⚠️  Unknown intent '{intent}', defaulting to chat")
#     #         return "chat"

#     # async def _chat_node(self, state: AgentStateScehma) -> dict:
#     #     """Handle chat conversations (async)"""
#     #     print("💬 Handling chat...")
        
#     #     conversation = "\n\n".join(self.last_conversation_history)
        
#     #     prompt = self.CHATNODEPROMPT.format(
#     #         conversation=conversation,
#     #         question=state["user_question"]
#     #     )
        
#     #     response = await self._call_llm_with_retry(prompt)
        
#     #     return {
#     #         "messages": [AIMessage(content=response)]
#     #     }

#     # async def _schema_node(self, state: AgentStateScehma) -> dict:
#     #     """Retrieve relevant schema chunks (async wrapper)"""
#     #     print("📚 Retrieving schema...")
        
#     #     # Run in executor since retrieval is sync
#     #     loop = asyncio.get_event_loop()
#     #     chunks_text = await loop.run_in_executor(
#     #         None,
#     #         self._hybrid_retrieve,
#     #         state["user_question"]
#     #     )
        
#     #     return {
#     #         "chunks_text": chunks_text,
#     #         "messages": [AIMessage(content="Retrieved schema")]
#     #     }

#     # async def _sql_gen_node(self, state: AgentStateScehma) -> dict:
#     #     """Generate SQL query (async)"""
#     #     print("⚙️  Generating SQL...")
        
#     #     sql = await self._generate_sql(
#     #         state["user_question"],
#     #         state["chunks_text"],
#     #         self.db_drive
#     #     )
        
#     #     # Clean markdown
#     #     sql = sql.replace("```sql", "").replace("```", "").strip()
        
#     #     return {
#     #         "sql_query": sql,
#     #         "messages": [AIMessage(content=f"Generated SQL")]
#     #     }

#     # async def _verify_node(self, state: AgentStateScehma) -> dict:
#     #     """Verify SQL with retries (async)"""
#     #     print("✅ Verifying SQL...")
        
#     #     sql = state["sql_query"]
#     #     chunks_text = state["chunks_text"]
#     #     question = state["user_question"]
#     #     max_retries = 3
        
#     #     for attempt in range(max_retries + 1):
#     #         # Check safety first
#     #         if not self._verify_sql_safety(sql):
#     #             return {
#     #                 "last_sql": None,
#     #                 "messages": [AIMessage(
#     #                     content="⚠️ Query contains dangerous operations"
#     #                 )]
#     #             }
            
#     #         # Try execution
#     #         result = await self._verify_query(sql)
            
#     #         if "successfully" in result.lower() or "valid" in result.lower():
#     #             print(f"✅ SQL verified on attempt {attempt + 1}")
#     #             return {
#     #                 "last_sql": sql,
#     #                 "messages": [AIMessage(content="SQL verified successfully")]
#     #             }
#     #         else:
#     #             self.results = []
#     #             error_msg = result
            
#     #         if attempt < max_retries:
#     #             print(f"🔄 Fixing SQL (attempt {attempt + 1}/{max_retries})...")
#     #             sql = await self._fix_sql_error(question, sql, error_msg, chunks_text)
#     #             state["messages"].append(
#     #                 AIMessage(content=f"🔧 Auto-fixing SQL error...")
#     #             )
#     #         else:
#     #             print(f"❌ SQL failed after {max_retries + 1} attempts")
#     #             self.results = []
#     #             return {
#     #                 "last_sql": None,
#     #                 "messages": [AIMessage(
#     #                     content=f"❌ SQL failed after {max_retries + 1} attempts\n\nError: {error_msg}"
#     #                 )]
#     #             }
        
#     #     return {
#     #         "last_sql": sql,
#     #         "messages": [AIMessage(content="✅ SQL verified after retries")]
#     #     }

#     # async def _fix_sql_error(
#     #     self,
#     #     user_question: str,
#     #     sql: str,
#     #     error: str,
#     #     chunks_text: str
#     # ) -> str:
#     #     """Fix SQL error using LLM (async)"""
#     #     prompt = self.FIXSQLERRORPROMPT.format(
#     #         user_question=user_question,
#     #         chunks_text=chunks_text,
#     #         error=error,
#     #         sql=sql,
#     #         sql_db=self.db_drive
#     #     )
        
#     #     fixed_sql = await self._call_llm_with_retry(prompt)
        
#     #     # Clean markdown
#     #     fixed_sql = re.sub(r'^```sql\s*\n?', '', fixed_sql)
#     #     fixed_sql = re.sub(r'\n?```$', '', fixed_sql).strip()
        
#     #     return fixed_sql

#     # def _verify_sql_safety(self, sql: str) -> bool:
#     #     """Check for dangerous SQL commands (synchronous)"""
#     #     sql_lower = sql.lower()
#     #     pattern = r'\b(' + '|'.join(self.dangerous_commands) + r')\b'
#     #     return not re.search(pattern, sql_lower)

#     # async def _followup_question_modify(self, state: AgentStateScehma) -> dict:
#     #     """Merge followup with previous context (async)"""
#     #     print("🔄 Processing followup question...")
        
#     #     conversation = "\n\n".join(self.last_conversation_history)
        
#     #     prompt = self.FOLLOWUPQUESTIONMODIFYPROMPT.format(
#     #         conversation=conversation,
#     #         user_question=state["user_question"]
#     #     )
        
#     #     merged_question = await self._call_llm_with_retry(prompt)
        
#     #     print(f"🔄 Merged question: {merged_question}")
        
#     #     return {"user_question": merged_question}

#     # async def _answer_node(self, state: AgentStateScehma) -> dict:
#     #     """Execute SQL and format answer (async)"""
#     #     print("💬 Generating answer...")
        
#     #     last_sql = state.get("last_sql")
        
#     #     if not last_sql:
#     #         return {
#     #             "messages": [AIMessage(content="Unable to generate valid SQL query.")]
#     #         }
        
#     #     # Execute query
#     #     if asyncio.iscoroutinefunction(self.db_repo.generate_sql_query_result):
#     #         query_result = await self.db_repo.generate_sql_query_result(last_sql)
#     #     else:
#     #         loop = asyncio.get_event_loop()
#     #         query_result = await loop.run_in_executor(
#     #             None,
#     #             self.db_repo.generate_sql_query_result,
#     #             last_sql
#     #         )
        
#     #     # Handle different result scenarios
#     #     if last_sql == 'select 1 where 0;':
#     #         prompt = self.SQLANALYSISPROMPT.format(
#     #             last_sql=last_sql,
#     #             user_question=state["user_question"]
#     #         )
#     #         suggestions = await self._call_llm_with_retry(prompt)
#     #         return {"messages": [AIMessage(content=suggestions)]}
        
#     #     elif not query_result or len(query_result) == 0:
#     #         prompt = self.SQLNORESULTANALYSISPROMPT.format(
#     #             last_sql=last_sql,
#     #             user_question=state["user_question"]
#     #         )
#     #         suggestions = await self._call_llm_with_retry(prompt)
#     #         return {"messages": [AIMessage(content=suggestions)]}
        
#     #     else:
#     #         prompt = self.SQLRESULTANALYSISPROMPT.format(
#     #             last_sql=last_sql,
#     #             user_question=state["user_question"]
#     #         )
#     #         suggestions = await self._call_llm_with_retry(prompt)
#     #         return {"messages": [AIMessage(content=suggestions)]}

#     # # ============================================
#     # # GRAPH BUILDER (ASYNC)
#     # # ============================================

#     # async def build_and_run_graph(self):
#     #     """Build graph and run query (async)"""
        
#     #     # Build graph
#     #     graph = (
#     #         StateGraph(AgentStateScehma)
#     #         .add_node("intent", self._classify_intent)
#     #         .add_node("schema", self._schema_node)
#     #         .add_node("sql_gen", self._sql_gen_node)
#     #         .add_node("verify", self._verify_node)
#     #         .add_node("answer", self._answer_node)
#     #         .add_node("chat", self._chat_node)
#     #         .add_node("followup", self._followup_question_modify)

#     #         .add_edge(START, "intent")
#     #         .add_conditional_edges(
#     #             "intent",
#     #             self._route_intent,
#     #             ["schema", "chat", "followup"]
#     #         )

#     #         .add_edge("schema", "sql_gen")
#     #         .add_edge("sql_gen", "verify")
#     #         .add_edge("verify", "answer")
#     #         .add_edge("answer", END)
#     #         .add_edge("followup", "schema")
#     #         .add_edge("chat", END)
#     #         .compile()
#     #     )

#     #     # Prepare input state
#     #     input_state = {
#     #         "messages": self.last_conversation_history + [
#     #             HumanMessage(content=self.question)
#     #         ],
#     #         "user_question": self.question,
#     #         "intent": None,
#     #         "chunks_text": None,
#     #         "sql_query": None,
#     #         "last_sql": None
#     #     }

#     #     # Run graph asynchronously
#     #     final_state = None
#     #     async for step in graph.astream(input_state, stream_mode="values"):
#     #         final_state = step

#     #     # Extract results
#     #     last_sql = final_state.get('last_sql')
        
#     #     if not last_sql or last_sql == 'select 1 where 0;':
#     #         last_sql = "select 1 where 0;"
#     #         self.results = []

        

#     #     message = final_state["messages"][-1].content

#     #     result = {
#     #         "user_question": self.question,
#     #         "query": last_sql,
#     #         "langgraph_message": message,
#     #         "result": self.results
#     #     }
        
#     #     print(f" Final Result: {result}")
#     #     return result


























