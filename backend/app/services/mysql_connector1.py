import mysql.connector
def get_db_connection():
    try:
        conn = mysql.connector.connect(
            host="localhost",        # Change to your MySQL host
            user="root",        # Replace with your MySQL username
            password="Tardid@2016", # Replace with your MySQL password
            database="karwar" # Replace with your MySQL database
        )
        return conn
    except Exception as e:
        print(f"An exception occured at get_db_connection method at mysql_connector1 module and error is {e}")
        return "conn"
    
# conn = get_db_connection()
# cursor = conn.cursor()

# # # Execute SQL command to get tables
# # cursor.execute("SHOW TABLES")
# cursor.execute('''
               
# SELECT 
#     T1.ItemCode,
#     COUNT(DISTINCT T1.DemandNo) AS DemandCount,
#     SUM(T1.Qty) AS TotalDemanded,
#     COUNT(DISTINCT T2.DemandNo) AS IssueCount,
#     SUM(T2.Qty) AS TotalIssued
# FROM Demand T1
# LEFT JOIN Issue T2 
#     ON T1.CustomerCode = T2.CustomerCode 
#     AND T1.ItemCode = T2.ItemCode
# WHERE T1.CustomerCode = 1001
# GROUP BY T1.ItemCode
# ORDER BY TotalDemanded DESC;

#  ''')
# # # Fetch all table names
# tables = cursor.fetchall()

# # # Print tables
# print("Tables in the database:")
# print(tables)
# # for table in tables:
# #     print(table[0])

# # # Close the connection
# cursor.close()
# conn.close()


# import mysql.connector
# from tabulate import tabulate

# def get_db_connection():
#     try:
#         conn = mysql.connector.connect(
#             host="localhost",
#             user="root",
#             password="Tardid@2016",
#             database="karwar"
#         )
#         return conn
#     except Exception as e:
#         print(f"An exception occurred at get_db_connection method: {e}")
#         return None

# def get_all_tables(cursor):
#     """Get all table names in the database"""
#     cursor.execute("SHOW TABLES")
#     tables = [table[0] for table in cursor.fetchall()]
#     return tables

# def get_table_schema(cursor, table_name):
#     """Get the schema of a specific table"""
#     cursor.execute(f"DESCRIBE {table_name}")
#     schema = cursor.fetchall()
#     return schema

# def get_table_data(cursor, table_name, limit=20):
#     """Get sample data from a table"""
#     cursor.execute(f"SELECT * FROM {table_name} LIMIT {limit}")
#     data = cursor.fetchall()
#     columns = [desc[0] for desc in cursor.description]
#     return columns, data

# def main():
#     conn = get_db_connection()
#     if conn is None:
#         print("Failed to connect to database")
#         return
    
#     cursor = conn.cursor()
#     output_file = "database_schema_and_data.txt"
    
#     try:
#         with open(output_file, 'w', encoding='utf-8') as f:
#             # Get all tables
#             tables = get_all_tables(cursor)
#             header = f"Found {len(tables)} tables in the database: {', '.join(tables)}\n"
#             print(header)
#             f.write(header)
#             f.write("=" * 100 + "\n")
            
#             # Process each table
#             for table in tables:
#                 table_header = f"\n\nTABLE: {table}\n"
#                 print(table_header)
#                 f.write(table_header)
#                 f.write("=" * 100 + "\n")
                
#                 # Get and display schema
#                 schema_header = f"\nSCHEMA for {table}:\n"
#                 print(schema_header)
#                 f.write(schema_header)
#                 f.write("-" * 100 + "\n")
                
#                 schema = get_table_schema(cursor, table)
#                 schema_headers = ["Field", "Type", "Null", "Key", "Default", "Extra"]
#                 schema_table = tabulate(schema, headers=schema_headers, tablefmt="grid")
#                 print(schema_table)
#                 f.write(schema_table + "\n")
                
#                 # Get and display data
#                 data_header = f"\n\nDATA (First 20 rows) for {table}:\n"
#                 print(data_header)
#                 f.write(data_header)
#                 f.write("-" * 100 + "\n")
                
#                 columns, data = get_table_data(cursor, table, 20)
                
#                 if data:
#                     data_table = tabulate(data, headers=columns, tablefmt="grid")
#                     print(data_table)
#                     f.write(data_table + "\n")
                    
#                     row_count = f"\nTotal rows displayed: {len(data)}\n"
#                     print(row_count)
#                     f.write(row_count)
#                 else:
#                     no_data_msg = "No data found in this table\n"
#                     print(no_data_msg)
#                     f.write(no_data_msg)
                
#                 separator = "\n" + "=" * 100 + "\n"
#                 print(separator)
#                 f.write(separator)
        
#         success_msg = f"\n\nResults successfully saved to '{output_file}'"
#         print(success_msg)
    
#     except Exception as e:
#         print(f"An error occurred: {e}")
    
#     finally:
#         cursor.close()
#         conn.close()
#         print("Database connection closed.")

# if __name__ == "__main__":
#     main()