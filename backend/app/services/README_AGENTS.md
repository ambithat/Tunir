# Star AI — AI Agents & LLM Services

This directory contains the core intelligence components of Star AI, responsible for natural language processing, SQL generation, and autonomous agentic workflows.

---

## 🏗 Components

### 1. 🛠 `SqlGraphQueryAgentBuilder` (`sql_graph_agent_builder.py`)
The primary agentic engine powered by **LangGraph**. It manages a stateful workflow to transform user questions into verified SQL queries.

**Key Features:**
- **Stateful Execution**: Uses a directed graph to manage transitions between intent classification, schema retrieval, and SQL generation.
- **Auto-Correction**: If a generated SQL query fails execution, the agent automatically triggers a "fix" node to correct the SQL based on the database error message.
- **Dialect Awareness**: Dynamically switches between **PostgreSQL, MySQL, and SQLite** based on the connected database driver.
- **Hybrid Retrieval**: Combines semantic search (vector store) with keyword-based matching to find the most relevant schema chunks for a given question.

**Graph Nodes:**
- `intent`: Classifies user input (DB_QUERY, FOLLOW_UP_SQL, or CHAT).
- `schema`: Retrieves relevant table structures.
- `sql_gen`: Generates the initial SQL query.
- `verify`: Executes the query and handles retries/fixes on failure.
- `answer`: Formats the final insights and follow-up suggestions.

### 2. 🧠 `GroqLLM` (`llama_model_init.py`)
A wrapper around the **LangChain ChatGroq** client, providing a consistent interface for LLM interactions.

**Key Features:**
- **Centralized Initialization**: Configured via global settings (`LLAMA_MODEL_NAME`).
- **Sync/Async Support**: Implements both `invoke` and `ainvoke` methods for flexible integration.
- **Rate Limit Handling**: Integrated with the `api_key_service` to rotate API keys and retry requests upon hitting rate limits.

### 3. 📝 `LlamaModel` (`llama_model.py`)
A specialized service for SQL generation using a template-based approach.

**Key Features:**
- **Domain-Specific Prompts**: Contains an extensive prompt engineering layer with table relations, sample data, and domain keywords.
- **SQL Chain**: Utilizes LangChain's Expression Language (LCEL) to pipe schema retrieval and prompt formatting into the LLM.
- **Direct DB Integration**: Connects to the primary database to fetch schema descriptions and sample data for improved context.

---

## 🚀 Usage Example

```python
from app.services.sql_graph_agent_builder import SqlGraphQueryAgentBuilder
from app.services.llama_model_init import GroqLLM

# 1. Initialize LLM
llm = GroqLLM(api_key="your_api_key")

# 2. Build and run the agent
builder = SqlGraphQueryAgentBuilder(
    question="Show me all approved indents from last month",
    llm=llm,
    db_drive="postgresql",
    # ... other dependencies (repo, api_key_service, etc.)
)

result = await builder.build_and_run_graph()
print(result["query"])  # The generated SQL
print(result["result"]) # The query results from the DB
```

---

## 🛠 Maintenance
- **Prompts**: Prompts are defined as class attributes in `SqlGraphQueryAgentBuilder`. Update these to refine the agent's behavior or personality.
- **Dialects**: Ensure that new database drivers are added to the prompt templates to maintain cross-dialect compatibility.
