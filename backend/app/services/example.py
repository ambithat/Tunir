d = {
    
  "Could you provide a list of all the items requested by the customer that have been purchased?":"SELECT d.ItemCode, d.CustomerCode, d.DemandNo, il.IndentNo, il.IndentLineNo, o.OrderDate, o.ValueRs FROM Demand d JOIN IndentLine il ON d.ItemCode = il.ItemCode LEFT JOIN Orders o ON il.IndentNo = o.IndentNo;",
    
  "what are all the unique items that has been demanded by the customer 1001 those are issued and stock released by the  station K":"SELECT DISTINCT d.ItemCode FROM Demand d  JOIN Issue i ON d.DemandNo = i.DemandNo  JOIN StockRelease sr ON i.DemandNo = sr.DemandNo AND i.ItemCode = sr.ItemCode WHERE d.CustomerCode = 1001 AND sr.StationCode = 'K';",
  
  "Get all ItemCodes from the Demand table that are also found in the IndentLine table and provide the related Demand and Customer data": "SELECT d.ItemCode, d.CustomerCode, d.DemandNo, d.DateRaised, d.DateTimeRegistered FROM Demand d JOIN IndentLine il ON d.ItemCode = il.ItemCode;",
  
  "Get all the ItemCodes from the Demand table that are also found in the IndentLine table. Provide the Demand, Customer, and Indent data for each ItemCode.": "SELECT d.ItemCode, d.CustomerCode, d.DemandNo, d.DateRaised, d.DateTimeRegistered FROM Demand d JOIN IndentLine il ON d.ItemCode = il.ItemCode;",
  
  "Give me the distinct total count of stock": "SELECT COUNT(DISTINCT StockSerial) as Total_Stock_Count  FROM Stock;",
  
  "Count of pending deliveries": "SELECT COUNT(*) as Total_Pending_Deliveries FROM StockDelivery WHERE DateTimeDelivered IS NULL;",
  
  "Count of deliveries which got completed": "SELECT COUNT(*) as Completed_Deliveries FROM StockDelivery WHERE DateTimeDelivered IS NOT NULL;",
  
  "Total indent that has been approved": "SELECT COUNT(*) as Indent_Approved FROM Indent WHERE DateTimeApproved IS NOT NULL;",
  
  "Get all the count demands where the ClosingCode is categorized as 'F'": "SELECT COUNT(*) as Demand_Count FROM Demand WHERE ClosingCode = 'F';",
  
  "Get all the count unapproved orders": "SELECT COUNT(*) as Unapproved_Orders FROM Orders WHERE DateTimeApproved IS NULL OR ApprovedBy IS NULL;",
  
  "Total demand partial closed (P)": "SELECT COUNT(*) as Demand_Count FROM Demand WHERE ClosingCode = 'P';",
  
  "Give me the total count of the new demands based on the vetting in null": "SELECT COUNT(*) as Demand_Count FROM Demand WHERE DateVetted IS NULL;",
  
  "Get all the count for Pending stock location marking": "SELECT COUNT(*) Pending_Count FROM Stock WHERE LocationMarking = 'Pending';",
  
  "Get all count for the Unapproved date time gateout (gate pass)": "SELECT COUNT(*) as GatePass_Count FROM GatePass WHERE DateTimeGateOut IS NULL OR DateTimeGateOut = '';",
  
  "Get the demands where the ClosingCode is categorized as 'P'": "SELECT * FROM Demand WHERE ClosingCode = 'P';",
  
  "Get all the ItemCodes from the Demand table that are also found in the IndentLine table. Retrieve the corresponding Demand and Customer data, along with the indent values and order details for each matching ItemCode": "SELECT d.ItemCode, d.CustomerCode, d.DemandNo, il.IndentNo, il.IndentLineNo, o.OrderDate, o.ValueRs FROM Demand d JOIN IndentLine il ON d.ItemCode = il.ItemCode LEFT JOIN Orders o ON il.IndentNo = o.IndentNo;",
  
  "Show me the details of items that have been released from stock and then issued, including their ItemCodes, Demand details, Customer information, and related issuance data.": "SELECT s.ItemCode, d.DemandNo, d.CustomerCode, i.IssueDateTime, i.Qty, i.PriceRs, i.IssuedBy FROM StockRelease s JOIN Demand d ON s.DemandNo = d.DemandNo JOIN Issue i ON s.DemandNo = i.DemandNo AND s.ItemCode = i.ItemCode;",
  
  "Find the highest price issued for any item, and provide the corresponding item number along with the demand details.": "SELECT i.ItemCode, d.DemandNo, i.PriceRs FROM Issue i JOIN Demand d ON i.DemandNo = d.DemandNo ORDER BY i.PriceRs DESC LIMIT 1;",
  
  "What are all the items in the Issue table, and if they exist, have they been released in the StockRelease table?": "SELECT i.*, sr.StockReleaseSerial FROM Issue i LEFT JOIN StockRelease sr ON i.DemandNo = sr.DemandNo AND i.ItemCode = sr.ItemCode;",
  
  "Give me the total count of the unapproved indent": "SELECT COUNT(*) as Unapproved_Indent FROM Indent WHERE DateTimeApproved IS NULL OR ApprovedBy IS NULL;",
  
  "Which item has the most orders": "SELECT ItemCode, COUNT(*) as Number_Of_Orders FROM OrderLine GROUP BY ItemCode ORDER BY num_orders DESC;",
  
  "List the count of stock items located in the following stations: K, B, V, P, and W.": "SELECT StationCode, COUNT(*) as Stock_Count FROM Stock WHERE StationCode IN ('K', 'B', 'V', 'P', 'W') GROUP BY StationCode;",
  
  "Give me the data of the latest issued item details.": "SELECT * FROM Issue ORDER BY IssueDateTime DESC LIMIT 1;",
  
  "Give me the data from demand where itemcode = N0443-9422210.": "SELECT * FROM Demand WHERE ItemCode = 'N0443-9422210';",
  
  "Give me the data from demand where itemcode = N0443-R100008.": "SELECT * FROM Demand WHERE ItemCode = 'N0443-R100008';",
  
  "Give me the data from issue where issuedby = c139660.": "SELECT * FROM Issue WHERE IssuedBy = 'c139660';",
  
  "Give me the data from stockrelease where HandedOverBy = c442177.": "SELECT * FROM StockRelease WHERE HandedOverBy = 'c442177';",
  
  "Give me the data from stockdelivery where stationcode = v.": "SELECT * FROM StockDelivery WHERE StationCode = 'v';",
  
  "Give me the data from gatepass where InitiatedBy = c677014.": "SELECT * FROM GatePass WHERE InitiatedBy = 'c677014';",
  
  "Give me the data from indent where IndentChoice = R.": "SELECT * FROM Indent WHERE IndentChoice = 'R';",
  
  "Give me the data from orders where ApprovedBy = n01942.": "SELECT * FROM Orders WHERE ApprovedBy = 'n01942';",
  
  "Give me the data from storereceipt where VendorCode = L9010B.": "SELECT * FROM StoreReceipt WHERE VendorCode = 'L9010B';",
  
  "Give me the data from refit where RefitType = NR.": "SELECT * FROM Refit WHERE RefitType = 'NR';",
  
  "Give me the data from stock where batch = LF34-1.": "SELECT * FROM Stock WHERE BatchNo = 'LF34-1';",
  
  "Give me the data from forecast where forecastno = 99S0002.": "SELECT * FROM Forecast WHERE ForecastNo = '99S0002';",
  
  "give me the total count of the indent issued":"SELECT COUNT(*) as Indent_Issued FROM Indent WHERE DateTimeApproved IS NOT NULL;"
}





