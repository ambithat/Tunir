

# ### ASYNC 

# import json
# import os
# import re
# # import aiosqlite
# import asyncio
# from datetime  import datetime,timedelta,timezone
# from functools import lru_cache
# from typing import List, Dict, Any, Optional
# from pathlib import Path
# import uuid
# from fastapi import HTTPException, status
# from openai import RateLimitError, APIError, APIConnectionError, AuthenticationError
# from pydantic import PrivateAttr, Field
# from langchain.docstore.document import Document
# from langchain_community.vectorstores import FAISS
# from langchain_community.embeddings import HuggingFaceEmbeddings
# from langchain.llms.base import LLM
# from langchain_groq import ChatGroq
# from app.repositories.query_agent_repository import SqlQueryAgentRepository
# from app.services.llama_api_key_service import ApiKeyService
# from app.config import settings as global_setting
# from app.core.path_utils import get_db_storage_paths


# class GroqLLM(LLM):
#     temperature: float = 0.0
    

#     def __init__(self,api_key:str):
#         super().__init__()
#         print("GroqLLM is created ..")
#         self._client = ChatGroq(
#             model_name=global_setting.LLAMA_MODEL_NAME,
#             temperature=self.temperature,
#             groq_api_key=api_key
#         )
  

#     def _call(self, prompt: str, stop=None):
#         resp = self._client.invoke(prompt)
#         return resp.content if hasattr(resp, "content") else str(resp)
    
#     async def _acall(self, prompt: str, stop=None):
#         """Async version of _call"""
#         resp = await self._client.ainvoke(prompt)
#         return resp.content if hasattr(resp, "content") else str(resp)
        
#     @property
#     def _llm_type(self):
#         return "groq"

#     def invoke(self, prompt: str):
#         return self._call(prompt)
    
#     async def ainvoke(self, prompt: str):
#         """Async invoke method"""
#         return await self._acall(prompt)
    
#     @classmethod
#     @lru_cache
#     def get_instance(cls):
        
#         return GroqLLM() 


# class SQLQueryAgent:
#     def __init__(self,
#                 repo: SqlQueryAgentRepository,
#                 api_key_service:ApiKeyService
#                 ):
#         # List of dangerous SQL commands
#         self.dangerous_commands = [
#             "delete",
#             "drop",
#             "update",
#             "insert",
#             "alter",
#             "truncate",
#             "create",
#             "grant",
#             "revoke",
#             "exec",
#             "execute",
#             "merge"
#         ]
#         self.sql_agent_repo = repo
#         self.api_key_service=api_key_service
#         self.SQL_PROMPT_TEMPLATE = """
# You are an expert SQL generator.

# Use ONLY the following schema chunks:

# {chunks}

# USER QUESTION:
# {question}

# RULES:
# - Write ONLY valid {sql} SQL.
# - NO explanations.
# - Use correct table and column names exactly as shown.
# - Never invent columns.
# - Prefer LEFT JOIN when unsure to avoid losing rows.
# - If multiple join paths exist, choose the MOST SPECIFIC one (document numbers > line numbers > ItemCode > others).

# UNIVERSAL JOIN RULES (MOST IMPORTANT):

# 1. If two tables share a PRIMARY KEY–FOREIGN KEY pair as shown in the schema chunks,
#       always join on that.

# 2. If schema chunks show explicit relations (A.col ↔ B.col),
#       join on exactly those columns.

# 3. If no FK relation is shown, join ONLY on columns with the SAME NAME **AND clearly the same meaning**.

# 4. When multiple columns match, prioritize columns indicating the SAME ENTITY:
#       - Document numbers (DemandNo, IndentNo, OrderNo, GatePassKey, IssueKey)
#       - Line numbers (IndentLine, OrderLine, etc.)
#       - Transaction keys (AuthorityRef, GatePassKey, IssueKey)

# 5. Join on ItemCode **only if both tables are part of the same item movement flow**  
#       (e.g., Forecast → Indent → Order → Issue → StockRelease → StockDelivery).

# 6. NEVER join only on:
#       - StationCode
#       - Date fields
#       - User fields  
#    These do NOT uniquely identify the same record.

# 7. If no safe join exists:
#       - DO NOT FORCE a join
#       - Use EXISTS(), IN(), or subqueries instead of unsafe joins.

# DATE RULE:
# - Datetimes may be stored in many formats.  
#   NEVER use `strftime` or date() functions.
# - For filtering by year YYYY, always use:
#       column LIKE '%YYYY%'

# DATE COMPARISON RULE (IMPORTANT):
# - When comparing two datetime columns, compare them DIRECTLY:
#       column1 > column2
# - Do NOT parse or convert dates.
# - If one column may be null, include IS NOT NULL conditions.

# FALLBACK RULE (VERY IMPORTANT):
# - If the question involves sequences of events (e.g., "later released", "later delivered"):
#       join on the strongest key available (document number or item+station)
#       AND compare the event timestamps directly.
# - If unsure, use EXISTS() to avoid eliminating rows incorrectly.

# Write ONLY the SQL query:
# """
#         self.SQL_ERROR_CORRECTION_TEMPLATE = """
# You are an expert SQL debugging assistant.
 
# You will be given:
# - The original user question
# - Schema chunks
# - The SQL query you generated earlier
# - The exact SQLite error message produced when running it
 
# Your task:
# - FIX the SQL query.
# - Preserve the user's intent.
# - Keep the structure as close as possible to the original query.
# - Only change what is necessary to resolve the error.
# - Do NOT invent columns or tables.
# - Only output the corrected SQL query.
 
# INPUTS:
# USER QUESTION:
# {question}
 
# SCHEMA:
# {chunks}
 
# PREVIOUS SQL:
# {sql}
 
# {db} ERROR:
# {error}


 
# Now output ONLY the corrected SQL:
# """
    
#     # async def execute_sql_query(self, sql: str):
#     #     """Async version of execute_sql_query"""
#     #     async with aiosqlite.connect(global_setting.SQL_DB_PATH) as conn:
#     #         try:
#     #             async with conn.execute(sql) as cur:
#     #                 rows = await cur.fetchall()
#     #                 columns = [d[0] for d in cur.description] if cur.description else []
#     #             return columns, rows
#     #         except Exception as e:
#     #             return f"SQL Error: {str(e)}", []

#     def parse_schema(self, schema: str):
#         blocks = schema.split("CREATE TABLE")
#         table_columns = {}
#         for block in blocks:
#             block = block.strip()
#             if not block or "(" not in block:
#                 continue

#             header, body = block.split("(", 1)
#             table = header.strip().split()[0].strip()

#             body = body.rsplit(")", 1)[0]
#             cols = []
#             for col in body.split(","):
#                 col = col.strip()
#                 if not col:
#                     continue
#                 name = col.split()[0]
#                 if (name.startswith("`") and name.endswith("`")) or (name.startswith('"') and name.endswith('"')):
#                     name = name[1:-1]
#                 cols.append(name)

#             table_columns[table] = cols
#         return table_columns

#     def detect_keys_if_present(self, schema_sql: str):
#         primary_keys = {}
#         foreign_keys = {}

#         blocks = schema_sql.split("CREATE TABLE")
#         for block in blocks:
#             block = block.strip()
#             if not block or "(" not in block:
#                 continue

#             header, body = block.split("(", 1)
#             table = header.strip().split()[0].strip()
#             body = body.rsplit(")", 1)[0]

#             foreign_keys[table] = {}

#             for line in body.split(","):
#                 line = line.strip()

#                 # Detect PRIMARY KEY
#                 if "PRIMARY KEY" in line.upper():
#                     parts = line.replace("(", "").replace(")", "").split()
#                     col = parts[0].replace("`", "").replace('"', '')
#                     primary_keys[table] = col

#                 # Detect inline REFERENCES: column REFERENCES parent(col)
#                 if "REFERENCES" in line.upper():
#                     parts = line.split()
#                     col = parts[0].replace("`", "").replace('"', '')
#                     ref_tbl = parts[parts.index("REFERENCES") + 1]
#                     ref_tbl = ref_tbl.replace("`", "").replace('"', '')

#                     foreign_keys[table][col] = ref_tbl

#         return primary_keys, foreign_keys

#     def infer_relations_fast(self, table_columns: Dict[str, List[str]], primary_keys: Dict[str, str], foreign_keys: Dict[str, Dict[str, str]]):
#         relations = []
#         seen = set() 
#         for t1, c1 in table_columns.items():
#             for t2, c2 in table_columns.items():
#                 if t1 == t2:
#                     continue
#                 common = set(c1) & set(c2)
#                 for col in common:
#                     # Normalize order to avoid reversed duplicates
#                     key = tuple(sorted([f"{t1}.{col}", f"{t2}.{col}"]))

#                     if key not in seen:
#                         seen.add(key)
#                         relations.append({
#                             "table1": t1,
#                             "column1": col,
#                             "table2": t2,
#                             "column2": col,
#                             "type": "same_column_name"
#                         })

#         # Primary key → foreign key logic
#         for table, fks in foreign_keys.items():
#             for fk_col, ref_table in fks.items():
#                 pk_col = primary_keys.get(ref_table)
#                 if pk_col:
#                     key = tuple(sorted([f"{table}.{fk_col}", f"{ref_table}.{pk_col}"]))

#                     if key not in seen:
#                         seen.add(key)
#                         relations.append({
#                             "table1": table,
#                             "column1": fk_col,
#                             "table2": ref_table,
#                             "column2": pk_col,
#                             "type": "primary_foreign_key"
#                         })

#         return relations
    
#     # @lru_cache(maxsize=10)
#     def build_table_chunks_minimal(self, schema_file: str, chunk_dri:str):
#         with open(schema_file, "r", encoding="utf-8") as f:
#             schema_sql = f.read()

#         table_columns = self.parse_schema(schema_sql)
#         primary_keys, foreign_keys = self.detect_keys_if_present(schema_sql)
#         relations = self.infer_relations_fast(table_columns, primary_keys, foreign_keys)
#         docs = []
#         for table, cols in table_columns.items():
#             header = f"TABLE: {table}\nCOLUMNS: {', '.join(cols)}\n"

#             rels = [r for r in relations if r["table1"] == table or r["table2"] == table]
#             if rels:
#                 rel_text = "RELATIONS:\n" + "\n".join(
#                     f"{r['table1']}.{r['column1']} ↔ {r['table2']}.{r['column2']}"
#                     for r in rels
#                 )
#             else:
#                 rel_text = ""

#             content = header + rel_text

#             out_file = Path(chunk_dri) / f"{table}_chunk.txt"
#             out_file.write_text(content, encoding="utf-8")

#             docs.append(Document(page_content=content, metadata={"table": table}))

#         return docs
    
#     async def build_vector_index(self, docs: List[Document],vector_path:str):
#         """Async version - runs embedding in executor"""
#         loop = asyncio.get_event_loop()
        
#         def _build_index():
#             embeddings = HuggingFaceEmbeddings(model_name=global_setting.EMBED_MODEL)
#             index = FAISS.from_documents(docs, embedding=embeddings)
#             try:
#                 index.save_local(vector_path)
#             except:
#                 pass
#             return index
        
#         return await loop.run_in_executor(None, _build_index)

#     def keyword_table_match(self, question, chunks, top_n=3):
#         matches = []
#         q = question.lower()

#         for d in chunks:
#             text = d.page_content.lower()
#             table = d.metadata.get("table", "").lower()
#             score = 0

#             if table in q:
#                 score += 3

#             for col in text.split(","):
#                 col = col.strip().lower()
#                 if col and col in q:
#                     score += 1

#             matches.append((score, d))

#         matches.sort(reverse=True, key=lambda x: x[0])
#         return [m[1] for m in matches[:top_n]]

#     async def hybrid_retrieve(self, question, vectorstore, chunks):
#         """Async version of hybrid_retrieve"""
#         loop = asyncio.get_event_loop()
        
#         # Run semantic search in executor since FAISS is synchronous
#         def _semantic_search():
#             return vectorstore.as_retriever(search_kwargs={"k": 6}).invoke(question)
        
#         sem = await loop.run_in_executor(None, _semantic_search)
#         key = self.keyword_table_match(question, chunks, top_n=3)

#         # dedupe by table
#         all_docs = {d.metadata["table"]: d for d in (sem + key)}
#         return list(all_docs.values())
    

#     def verify_sql_query(self,sql:str):
#         sql_lower = sql.lower()
#         dangerous_pattern = r'\b(' + '|'.join(self.dangerous_commands) + r')\b'
#         if re.search(dangerous_pattern, sql_lower):
#             matched = re.search(dangerous_pattern, sql_lower).group(0)
#             print(f"⚠️ Dangerous command detected: {matched.upper()}")
#             return False
#         return True

#     async def run_sql_rag(self, 
#                         question:str = None, 
#                         vectorstore= None, 
#                         llm= None, 
#                         chunks= None,
#                         active_api_key= None,
#                         db_drvie="sqlite"
#                     ):
#         try:
#             print(1)
#             docs = await self.hybrid_retrieve(question, vectorstore, chunks)
#             print(2)
#             chunks_text = "\n".join(d.page_content for d in docs)
            
                
#             prompt = self.SQL_PROMPT_TEMPLATE.format(chunks=chunks_text, question=question,sql=db_drvie)
        
#             # LLM → SQL
#             try:
#                 sql = await llm.ainvoke(prompt)
#                 print(f"SQL PROMPT IS GENEREATE HERE   {sql}")
#                 result = await self.api_key_service.update_api_key_status(api_key= active_api_key,
#                                                             param={"last_used_at":datetime.utcnow()})
#                 if result:
#                     print(f"Last used updated for the api key {active_api_key} and time stamp is {datetime.utcnow()}")

        
#             except Exception as e:
#                 error_str = str(e)
#                 print(f'EEEEEEEEEEEEEEEEEEEE ccccccccccccc  {error_str}')
               
#                 if "rate limit" in error_str.lower() or "please try again in" in error_str.low():
#                     new_api_key,msg = await self.api_key_service.get_retry_api_key_logic(api_key=active_api_key,
#                                                                     error_detail = str(e))
#                     if not new_api_key:
#                         raise Exception(str(msg))
          
#                     llm = GroqLLM(api_key=new_api_key)
#                     sql = await llm.ainvoke(prompt)
#                     result = await self.api_key_service.update_api_key_status(api_key= active_api_key,
#                                                                 param={"last_used_at":datetime.utcnow()})
#                     if result:
#                         print(f"Last used updated for the api key {active_api_key} and time stamp is {datetime.utcnow()}")

                    

#             sql = sql.replace("```sql", "").replace("```", "").strip()
        
#             # Execute SQL
#             try:
#                 sql_lower = sql.lower()
#                 print(sql)
               
                
#                 # ✅ BEST: Use regex to match whole words (prevents false positives)
#                 sql_result = self.verify_sql_query(sql)
#                 if not sql_result:
#                     return [], {"error":f"This action is not allowed for security reasons.Please try a different request."}
                
#                 if asyncio.iscoroutinefunction(self.sql_agent_repo.generate_sql_query_result):
#                     result = await self.sql_agent_repo.generate_sql_query_result(sql=sql)
#                 else:
#                     loop = asyncio.get_event_loop()
#                     result = await loop.run_in_executor(
#                         None, 
#                         self.sql_agent_repo.generate_sql_query_result, 
#                         sql
#                     )

#             except Exception as e:
#                 print(f"IIIIIIIIIIIIIIIIII {e}")
#                 result = str(e)
        
#             if isinstance(result, str) and result.startswith("Database error occured"):
#                 error_msg = result
        
#                 print("\n SQL ERROR DETECTED. Trying auto-correction.\n")
#                 count = 0

#                 for i in range(count, global_setting.MAX_RETRY):
#                     correction_prompt = self.SQL_ERROR_CORRECTION_TEMPLATE.format(
#                         question=question,
#                         chunks=chunks_text,
#                         sql=sql,
#                         error=error_msg,
#                         db=db_drvie
#                     )
            
#                     corrected_sql = await llm.ainvoke(correction_prompt)
#                     corrected_sql = corrected_sql.replace("```sql", "").replace("```", "").strip()
#                     if not sql_result:
#                         return [], {"error":f"This action is not allowed for security reasons.Please try a different request."}
            
#                     # Try the corrected SQL
#                     try:
#                         if asyncio.iscoroutinefunction(self.sql_agent_repo.generate_sql_query_result):
#                             result = await self.sql_agent_repo.generate_sql_query_result(sql=corrected_sql)
#                         else:
#                             loop = asyncio.get_event_loop()
#                             result = await loop.run_in_executor(
#                                 None, 
#                                 self.sql_agent_repo.generate_sql_query_result, 
#                                 corrected_sql
#                             )
#                     except Exception as e:
#                         print(f"Exception raised while retrying the sql prompt for the {i} time")
#                         continue
                    
#                     if isinstance(result, list) and result is not None:
#                         return result, corrected_sql
                    
#                 return [], None
#             return result, sql
                
#         except Exception as e:
#             raise Exception(str(e))

#     async def run_sql_query_agent(self, 
#                                   question: str,
#                                   user_id:uuid.UUID,
#                                   user_db_source
#                                   ):
#         """Main async entry point"""
#         try:
#             print(" Building FAISS index...")
#             result = await self.check_db_active(user_id = user_id,
#                                                 user_db_source=user_db_source)
#             print(result,"result here ")
#             if not result:
#                 schema_file = global_setting.SCHEMA_FILE
#                 chunk_dir = global_setting.CHUNK_SAVE_DIR
#                 vector_dir = global_setting.VECTORSTORE_PATH
#                 db_drive = "sqlite"
#             else:
#                 schema_file = result["schema_file"]
#                 chunk_dir = result["chunks_store"]
#                 vector_dir = result["vector_store"]
#                 db_drive = result["drive"]
            
#             # chunks = self.build_table_chunks_minimal(global_setting.SCHEMA_FILE, global_setting.CHUNK_SAVE_DIR)
#             # vectorstore = await self.build_vector_index(chunks,global_setting.VECTORSTORE_PATH)

#             chunks = self.build_table_chunks_minimal(schema_file, chunk_dir)
#             vectorstore = await self.build_vector_index(chunks,vector_dir)

#             # llm = GroqLLM.get_instance()
#             active_api_key = await self.api_key_service.get_active_api_key()
            
#             llm = GroqLLM(api_key=active_api_key)
#             try:
#                 await llm.ainvoke(global_setting.WARMUP_PAYLOAD)
#             except HTTPException as e:
#                 if e.status_code == 429:
#                     print("Inside the ping rate limit ")
#                     active_api_key,msg = await self.api_key_service.get_retry_api_key_logic(api_key=active_api_key,
#                                                                  error_detail = str(e.detail))
#                     if not active_api_key:
#                         raise Exception(str(msg))
#                     llm = GroqLLM(active_api_key)
            
          
#             result, sql_query = await self.run_sql_rag(question=question, 
#                                                        vectorstore=vectorstore, 
#                                                        llm=llm, 
#                                                        chunks=chunks,
#                                                        active_api_key=active_api_key,
#                                                        db_drvie=db_drive
#                                                     )
#             # print(f"Result here is {result} and ******************************************* \n sql_query::::::::::::::::::::::::::  \n {sql_query}")
#             return result, sql_query 
#         except Exception as e:
#             raise Exception(str(e))

#     async def check_db_active(self,
#                               user_id,
#                               user_db_source):
#         try:
#             print(f"USER IDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD {user_id}")
#             db_display_name,drive = await user_db_source.get_active_user_db_source_by_id(user_id=user_id)
#             if not db_display_name:
#                 return None
#             paths = get_db_storage_paths(user_id, db_display_name)

#             # 3. (Optional but Recommended) Verify the Vector Store actually exists
#             # Even if DB says "Active", maybe the files were deleted?
#             if not paths["vector_store"].exists() or not paths["schema_file"].exists():
#                 print(f" Active DB found ({db_display_name}), but files are missing on disk.")
#                 return None # Fallback to default



#             return {
#                 "display_name": db_display_name,
#                 "drive": drive,
#                 "vector_store": str(paths["vector_store"]),
#                 "schema_file": str(paths["schema_file"]),
#                 "chunks_store": str(paths["chunks_dir"])
#             }
            
#         except Exception as e:
#             print(e)
#             return None
        

