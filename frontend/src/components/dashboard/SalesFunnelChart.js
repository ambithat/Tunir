// // src/components/dashboard/SalesFunnelChart.js
// import React, { useState, useMemo, useRef, useEffect } from "react";
// import { FiFilter, FiChevronDown } from "react-icons/fi";

// const PIPELINE_STAGES = ["Low", "Medium", "High", "Negotiation"];
// const OUTCOME_STAGES = ["Won", "Lost"];

// const STAGE_COLORS = {
//   Low: "#38BDF8",
//   Medium: "#B45309",
//   High: "#818CF8",
//   Negotiation: "#E69819",
// };

// const STAGE_PROBABILITIES = {
//   Low: "25%",
//   Medium: "50%",
//   High: "75%",
//   Negotiation: "90%",
//   Won: "100%",
//   Lost: "0%",
// };

// const PRODUCT_PALETTE = ["#10B981", "#3B82F6", "#F59E0B", "#818CF8", "#06B6D4", "#EF4444", "#14B8A6"];

// function useProductColors(data) {
//   return useMemo(() => {
//     const products = new Set();
//     Object.values(data || {}).forEach((stageMap) => {
//       if (stageMap && typeof stageMap === "object") {
//         Object.keys(stageMap).forEach((p) => products.add(p));
//       }
//     });
//     const list = Array.from(products).sort();
//     const map = {};
//     list.forEach((p, i) => (map[p] = PRODUCT_PALETTE[i % PRODUCT_PALETTE.length]));
//     return { productList: list, productColors: map };
//   }, [data]);
// }

// function stageTotal(stageMap, selected) {
//   if (!stageMap || typeof stageMap !== "object") return 0;
//   return Object.entries(stageMap).reduce(
//     (sum, [product, count]) => (selected.length === 0 || selected.includes(product) ? sum + (Number(count) || 0) : sum),
//     0
//   );
// }

// export default function SalesFunnelChart({ sseData, leads, onMouseMove, onMouseLeave }) {
//   const [selectedProducts, setSelectedProducts] = useState([]);
//   const [localHover, setLocalHover] = useState(null);
//   const [filterOpen, setFilterOpen] = useState(false);
//   const filterRef = useRef(null);

//   // Close filter dropdown on click outside
//   useEffect(() => {
//     function handleClickOutside(event) {
//       if (filterRef.current && !filterRef.current.contains(event.target)) {
//         setFilterOpen(false);
//       }
//     }
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   // Dynamically compute stage -> product mapping with live updates from both sseData and leads
//   const rawData = useMemo(() => {
//     const map = {
//       Low: {},
//       Medium: {},
//       High: {},
//       Negotiation: {},
//       Won: {},
//       Lost: {},
//     };

//     const STAGES = ["Low", "Medium", "High", "Negotiation", "Won", "Lost"];

//     // 1. Process live leads array
//     if (Array.isArray(leads) && leads.length > 0) {
//       leads.forEach((l) => {
//         const stName = (
//           l.stage_name ||
//           l.confidence ||
//           l.confidence_tier ||
//           l.confidence_score ||
//           l.stage ||
//           l.stageKey ||
//           l.status_name ||
//           l.status ||
//           ""
//         )
//           .toString()
//           .toLowerCase();

//         let key = null;
//         if (stName.includes("won")) key = "Won";
//         else if (stName.includes("lost")) key = "Lost";
//         else if (stName.includes("negot")) key = "Negotiation";
//         else if (stName.includes("high") || stName.includes("contract") || stName.includes("closing")) key = "High";
//         else if (stName.includes("med") || stName.includes("proposal") || stName.includes("demo")) key = "Medium";
//         else if (stName.includes("low") || stName.includes("qualif") || stName.includes("new") || stName.includes("contact")) key = "Low";
//         else key = "Low"; // Fallback to Low stage so no active lead is missed

//         if (key) {
//           let pNames = [];
//           if (l.product_name) pNames.push(l.product_name);
//           if (Array.isArray(l.products)) {
//             l.products.forEach((p) => {
//               const name = p.product_name || p.product || p.name;
//               if (name) pNames.push(name);
//             });
//           }
//           if (pNames.length === 0) pNames = ["Unassigned Product"];

//           pNames.forEach((pName) => {
//             map[key][pName] = (map[key][pName] || 0) + 1;
//           });
//         }
//       });
//     }

//     // 2. Merge/supplement with live sseData payloads
//     if (sseData) {
//       const byStage = sseData.by_stage || {};
//       const byStageByProd = sseData.by_stage_by_product || {};

//       STAGES.forEach((st) => {
//         let countFromSse = 0;
//         if (st === "Won" && sseData.total_won_count !== undefined) {
//           countFromSse = Number(sseData.total_won_count);
//         } else if (st === "Lost" && sseData.total_lost_count !== undefined) {
//           countFromSse = Number(sseData.total_lost_count);
//         } else if (byStage[st] !== undefined) {
//           countFromSse = Number(byStage[st]);
//         } else if (byStage[st.toLowerCase()] !== undefined) {
//           countFromSse = Number(byStage[st.toLowerCase()]);
//         }

//         const prodMap = byStageByProd[st] || byStageByProd[st.toLowerCase()];
//         if (prodMap && typeof prodMap === "object" && Object.keys(prodMap).length > 0) {
//           Object.entries(prodMap).forEach(([pName, count]) => {
//             if (pName && Number(count) > 0) {
//               map[st][pName] = Math.max(map[st][pName] || 0, Number(count));
//             }
//           });
//         }

//         const currentTotal = Object.values(map[st]).reduce((sum, c) => sum + c, 0);
//         const targetTotal = Math.max(countFromSse, currentTotal);
//         if (targetTotal > currentTotal) {
//           const diff = targetTotal - currentTotal;
//           map[st]["Other / Unassigned"] = (map[st]["Other / Unassigned"] || 0) + diff;
//         }
//       });
//     }

//     return map;
//   }, [sseData, leads]);

//   const { productList, productColors } = useProductColors(rawData);

//   const width = 640;
//   const funnelHeight = 310;
//   const maxTop = width * 0.92;
//   const minBottom = width * 0.32;
//   const n = PIPELINE_STAGES.length;
//   const segH = funnelHeight / n;

//   const toggleProduct = (p) => {
//     setSelectedProducts((prev) =>
//       prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
//     );
//   };

//   const outcomeMax = Math.max(
//     1,
//     ...OUTCOME_STAGES.map((s) => stageTotal(rawData[s] || {}, selectedProducts))
//   );

//   const allStages = [...PIPELINE_STAGES, ...OUTCOME_STAGES];
//   const grandTotal = allStages.reduce(
//     (sum, s) => sum + stageTotal(rawData[s] || {}, selectedProducts),
//     0
//   );
//   const showEmptyBanner = selectedProducts.length > 0 && grandTotal === 0;

//   // Hover handlers for both external Dashboard Tooltip & internal fallback
//   const handleStageMouseEnter = (e, stage, type) => {
//     const total = stageTotal(rawData[stage] || {}, selectedProducts);
//     const prob = STAGE_PROBABILITIES[stage] || "N/A";
//     const funnelPct = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0;
//     const entries = Object.entries(rawData[stage] || {}).filter(
//       ([p]) => selectedProducts.length === 0 || selectedProducts.includes(p)
//     );

//     let title = "";
//     let subtitle = "";
//     let items = [];

//     if (type === "pipeline") {
//       title = `Funnel Stage: ${stage}`;
//       subtitle = "Confidence Tier Distribution";
//       items = [
//         { label: "Lead Count", value: `${total} ${total === 1 ? "Lead" : "Leads"}`, color: total === 0 ? "#94A3B8" : (STAGE_COLORS[stage] || "#38BDF8") },
//         { label: "Probability", value: prob, color: "#00D4AA" },
//         { label: "% of Funnel", value: `${funnelPct}%`, color: "#F59E0B" },
//       ];
//       entries.forEach(([pName, count]) => {
//         items.push({
//           label: pName,
//           value: `${count} ${count === 1 ? "Lead" : "Leads"}`,
//           color: productColors[pName] || STAGE_COLORS[stage],
//         });
//       });
//     } else {
//       title = `Outcome: ${stage}`;
//       subtitle = "Terminal Closed Deals";
//       items = [
//         { label: `Total ${stage}`, value: `${total} ${total === 1 ? "Lead" : "Leads"}`, color: stage === "Won" ? "#10B981" : "#F87171" },
//         { label: "Outcome Share", value: `${funnelPct}%`, color: "#818CF8" },
//       ];
//       entries.forEach(([pName, count]) => {
//         items.push({
//           label: pName,
//           value: `${count} ${count === 1 ? "Lead" : "Leads"}`,
//           color: productColors[pName] || (stage === "Won" ? "#10B981" : "#F87171"),
//         });
//       });
//     }

//     if (typeof onMouseMove === "function") {
//       onMouseMove(e, title, subtitle, items);
//     } else {
//       setLocalHover({
//         x: e.clientX,
//         y: e.clientY,
//         title,
//         subtitle,
//         items,
//       });
//     }
//   };

//   const handleStageMouseMove = (e, stage, type) => {
//     if (typeof onMouseMove === "function") {
//       handleStageMouseEnter(e, stage, type);
//     } else if (localHover) {
//       setLocalHover((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
//     }
//   };

//   const handleStageMouseLeave = () => {
//     if (typeof onMouseLeave === "function") {
//       onMouseLeave();
//     }
//     setLocalHover(null);
//   };

//   return (
//     <div
//       style={{
//         background: "var(--t-surface-alt, #0B1120)",
//         border: "1px solid var(--t-border, #1E293B)",
//         borderRadius: 8,
//         padding: "20px 22px",
//         width: "100%",
//         height: "100%",
//         display: "flex",
//         flexDirection: "column",
//         justifyContent: "space-between",
//         boxSizing: "border-box",
//         fontFamily: "Inter, system-ui, sans-serif",
//         color: "#E2E8F0",
//         position: "relative",
//       }}
//     >
//       {/* Header */}
//       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: "10px" }}>
//         <div>
//           <h2 style={{ margin: 0, fontSize: 'clamp(18px, 1.35vw, 22px)', fontWeight: 600, color: "#F8FAFC",fontFamily:"Helvetica" }}>Sales Funnel Conversion</h2>
//           <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94A3B8" }}>
//             Stage-by-stage progression &amp; win probability
//           </p>
//         </div>

//         {/* Filter control matching requested design */}
//         <div style={{ position: "relative", marginTop: -4, marginRight: -4, flexShrink: 0 }} ref={filterRef}>
//           <button
//             type="button"
//             onClick={() => setFilterOpen((o) => !o)}
//             style={{
//               background: selectedProducts.length > 0 ? "rgba(0, 212, 170, 0.16)" : "rgba(0, 212, 170, 0.06)",
//               border: "1.5px solid #00D4AA",
//               borderRadius: "999px",
//               padding: "6px 14px",
//               color: "#00D4AA",
//               fontSize: "12px",
//               fontWeight: 700,
//               cursor: "pointer",
//               display: "flex",
//               alignItems: "center",
//               gap: 6,
//               fontFamily: "'Inter', sans-serif",
//               transition: "all 160ms ease",
//               boxShadow: "0 0 10px rgba(0, 212, 170, 0.15)",
//               whiteSpace: "nowrap",
//               flexShrink: 0,
//             }}
//           >
//             <FiFilter style={{ fontSize: "11.5px" }} />
//             <span>
//               {selectedProducts.length === 0
//                 ? "By Product"
//                 : selectedProducts.length === 1
//                 ? selectedProducts[0]
//                 : `By Product (${selectedProducts.length})`}
//             </span>
//             <FiChevronDown
//               style={{
//                 fontSize: "11.5px",
//                 transform: filterOpen ? "rotate(180deg)" : "none",
//                 transition: "transform 0.15s ease",
//               }}
//             />
//           </button>

//           {filterOpen && (
//             <div
//               style={{
//                 position: "absolute",
//                 right: 0,
//                 top: "calc(100% + 6px)",
//                 background: "#0B131F",
//                 border: "1px solid rgba(0, 212, 170, 0.3)",
//                 borderRadius: "10px",
//                 padding: "6px",
//                 zIndex: 60,
//                 minWidth: 170,
//                 boxShadow: "0 10px 25px rgba(0,0,0,0.7), 0 0 15px rgba(0, 212, 170, 0.15)",
//                 display: "flex",
//                 flexDirection: "column",
//                 gap: "2px",
//               }}
//             >
//               <div
//                 onClick={() => setSelectedProducts([])}
//                 style={{
//                   padding: "6px 10px",
//                   fontSize: 12,
//                   cursor: "pointer",
//                   borderRadius: 6,
//                   color: selectedProducts.length === 0 ? "#00D4AA" : "#E2E8F0",
//                   fontWeight: selectedProducts.length === 0 ? 700 : 500,
//                   background: selectedProducts.length === 0 ? "rgba(0, 212, 170, 0.12)" : "transparent",
//                   display: "flex",
//                   alignItems: "center",
//                   justify: "space-between",
//                 }}
//               >
//                 <span>All Products</span>
//                 {selectedProducts.length === 0 && <span style={{ marginLeft: "auto", color: "#00D4AA" }}>✓</span>}
//               </div>
//               <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", margin: "4px 0" }} />
//               {productList.length === 0 ? (
//                 <div style={{ padding: "6px 10px", fontSize: 12, color: "#64748B" }}>No products available</div>
//               ) : (
//                 productList.map((p) => (
//                   <div
//                     key={p}
//                     onClick={() => toggleProduct(p)}
//                     style={{
//                       padding: "6px 10px",
//                       fontSize: 12,
//                       cursor: "pointer",
//                       borderRadius: 6,
//                       display: "flex",
//                       alignItems: "center",
//                       gap: 8,
//                       color: selectedProducts.includes(p) ? "#00D4AA" : "#E2E8F0",
//                       background: selectedProducts.includes(p) ? "rgba(0, 212, 170, 0.1)" : "transparent",
//                     }}
//                   >
//                     <span
//                       style={{
//                         width: 8,
//                         height: 8,
//                         borderRadius: "50%",
//                         background: productColors[p],
//                         display: "inline-block",
//                         boxShadow: `0 0 6px ${productColors[p]}`,
//                       }}
//                     />
//                     <span style={{ flex: 1 }}>{p}</span>
//                     {selectedProducts.includes(p) && <span style={{ color: "#00D4AA", fontWeight: 700 }}>✓</span>}
//                   </div>
//                 ))
//               )}
//             </div>
//           )}
//         </div>
//       </div>

//       {showEmptyBanner && (
//         <div
//           style={{
//             background: "#1E1B2E",
//             border: "1px solid #3730A3",
//             borderRadius: 10,
//             padding: "10px 14px",
//             fontSize: 13,
//             color: "#A5B4FC",
//             marginBottom: 16,
//           }}
//         >
//           No leads found for the selected product(s) across any stage.
//         </div>
//       )}

//       {/* Funnel SVG Container */}
//       <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", margin: "10px 0 16px", minHeight: 0 }}>
//         <svg width="100%" viewBox={`0 0 ${width} ${funnelHeight}`} style={{ display: "block", overflow: "visible", maxHeight: "310px" }}>
//           {PIPELINE_STAGES.map((stage, i) => {
//             const topW = maxTop - ((maxTop - minBottom) * i) / n;
//             const botW = maxTop - ((maxTop - minBottom) * (i + 1)) / n;
//             const y = i * segH;
//             const topLeft = (width - topW) / 2;
//             const topRight = topLeft + topW;
//             const botLeft = (width - botW) / 2;
//             const botRight = botLeft + botW;
//             const total = stageTotal(rawData[stage] || {}, selectedProducts);
//             const isEmpty = total === 0;
//             const key = `pipeline-${stage}`;

//             return (
//               <g
//                 key={key}
//                 onMouseEnter={(e) => handleStageMouseEnter(e, stage, "pipeline")}
//                 onMouseMove={(e) => handleStageMouseMove(e, stage, "pipeline")}
//                 onMouseLeave={handleStageMouseLeave}
//                 style={{ cursor: "pointer" }}
//               >
//                 <polygon
//                   points={`${topLeft},${y} ${topRight},${y} ${botRight},${y + segH} ${botLeft},${y + segH}`}
//                   fill={isEmpty ? "#1E293B" : STAGE_COLORS[stage]}
//                   opacity={isEmpty ? 0.75 : 0.9}
//                   stroke="#0B1120"
//                   strokeWidth={2}
//                   style={{ transition: "opacity 0.15s ease, fill 0.15s ease" }}
//                 />
//                 <text
//                   x={width / 2}
//                   y={y + segH / 2 + 5}
//                   textAnchor="middle"
//                   fontSize="16"
//                   fontWeight="600"
//                   fill={isEmpty ? "#94A3B8" : (stage === "Medium" ? "#FFFFFF" : "#0B1120")}
//                   style={{ pointerEvents: "none" }}
//                 >
//                   {stage} — {total} {total === 1 ? "Lead" : "Leads"}
//                 </text>
//               </g>
//             );
//           })}
//         </svg>
//       </div>

//       {/* Terminal outcomes (Won / Lost) matching Deal Status & Value Split design */}
//       {(() => {
//         const wonCount = stageTotal(rawData["Won"] || {}, selectedProducts);
//         const lostCount = stageTotal(rawData["Lost"] || {}, selectedProducts);

//         return (
//           <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '20px', paddingTop: '12px', borderTop: '1px solid var(--t-border)', fontSize: '13px', fontFamily: "'Inter', sans-serif", marginTop: 'auto' }}>
//             <span
//               style={{ color: '#00D4AA', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, cursor: 'default' }}
//             >
//               <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#00D4AA' }}></span> Won: {wonCount} {wonCount === 1 ? 'Lead' : 'Leads'}
//             </span>
//             <span
//               style={{ color: 'var(--t-fg-muted)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, cursor: 'default' }}
//             >
//               <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#64748B' }}></span> Lost: {lostCount} {lostCount === 1 ? 'Lead' : 'Leads'}
//             </span>
//           </div>
//         );
//       })()}

//       {/* Standalone Fallback Tooltip Box */}
//       {localHover && (
//         <div
//           style={{
//             position: "fixed",
//             top: (localHover.y + (localHover.items ? localHover.items.length * 26 + 90 : 220)) > window.innerHeight
//               ? Math.max(10, localHover.y - (localHover.items ? localHover.items.length * 26 + 90 : 220))
//               : localHover.y + 14,
//             left: Math.min(localHover.x + 14, window.innerWidth - 300),
//             maxHeight: 'calc(100vh - 40px)',
//             overflowY: 'auto',
//             zIndex: 1000,
//             background: "rgba(8, 14, 22, 0.95)",
//             backdropFilter: "blur(16px)",
//             WebkitBackdropFilter: "blur(16px)",
//             border: "1px solid rgba(49, 151, 149, 0.4)",
//             borderRadius: "10px",
//             padding: "12px 16px",
//             boxShadow: "0 10px 30px rgba(0,0,0,0.7), 0 0 15px rgba(0, 212, 170, 0.25)",
//             pointerEvents: "none",
//             minWidth: "220px",
//           }}
//         >
//           <div style={{ fontFamily: "'Helvetica'", fontSize: "14.5px", fontWeight: 800, color: "#FFFFFF" }}>
//             {localHover.title}
//           </div>
//           {localHover.subtitle && (
//             <div style={{ fontSize: "11px", fontFamily: "'Inter', sans-serif", color: "#8CA0B8", marginBottom: "8px" }}>
//               {localHover.subtitle}
//             </div>
//           )}
//           <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
//             {localHover.items.map((item, idx) => (
//               <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", fontSize: "12.5px", fontFamily: "'Inter', sans-serif" }}>
//                 <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#CBD5E1" }}>
//                   <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: item.color || "#00D4AA", boxShadow: `0 0 6px ${item.color || "#00D4AA"}` }} />
//                   {item.label}
//                 </span>
//                 <span style={{ fontWeight: 800, color: "#FFFFFF", fontFamily: "'Inter', sans-serif" }}>
//                   {item.value}
//                 </span>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }



// src/components/dashboard/SalesFunnelChart.js
// src/components/dashboard/SalesFunnelChart.js
// src/components/dashboard/SalesFunnelChart.js
import React, { useState, useMemo, useRef, useEffect } from "react";
import { FiFilter, FiChevronDown } from "react-icons/fi";

// Order reversed: Negotiation (top, narrow) -> Low (bottom, wide)
const PIPELINE_STAGES = ["Negotiation", "High", "Medium", "Low"];
const OUTCOME_STAGES = ["Won", "Lost"];

const STAGE_COLORS = {
  Negotiation: "#E69819", // reverted to previous amber/orange
  High: "#818CF8",
  Medium: "#B45309", // dark amber
  Low: "#38BDF8",
};

const PRODUCT_PALETTE = ["#10B981", "#3B82F6", "#F59E0B", "#818CF8", "#06B6D4", "#EF4444", "#14B8A6"];

function useProductColors(data) {
  return useMemo(() => {
    const products = new Set();
    Object.values(data || {}).forEach((stageMap) => {
      if (stageMap && typeof stageMap === "object") {
        Object.keys(stageMap).forEach((p) => products.add(p));
      }
    });
    const list = Array.from(products).sort();
    const map = {};
    list.forEach((p, i) => (map[p] = PRODUCT_PALETTE[i % PRODUCT_PALETTE.length]));
    return { productList: list, productColors: map };
  }, [data]);
}

function stageTotal(stageMap, selected) {
  if (!stageMap || typeof stageMap !== "object") return 0;
  return Object.entries(stageMap).reduce(
    (sum, [product, count]) =>
      selected.length === 0 || selected.includes(product) ? sum + (Number(count) || 0) : sum,
    0
  );
}

export default function SalesFunnelChart({ sseData, leads, onMouseMove, onMouseLeave }) {
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [localHover, setLocalHover] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const rawData = useMemo(() => {
    const map = {
      Low: {},
      Medium: {},
      High: {},
      Negotiation: {},
      Won: {},
      Lost: {},
      Uncategorized: {}, // visible bucket instead of silently folding into Low
    };

    const STAGES = ["Low", "Medium", "High", "Negotiation", "Won", "Lost"];

    if (Array.isArray(leads) && leads.length > 0) {
      leads.forEach((l) => {
        const stName = (
          l.stage_name ||
          l.confidence ||
          l.confidence_tier ||
          l.confidence_score ||
          l.stage ||
          l.stageKey ||
          l.status_name ||
          l.status ||
          ""
        )
          .toString()
          .toLowerCase();

        let key = null;
        if (stName.includes("won")) key = "Won";
        else if (stName.includes("lost")) key = "Lost";
        else if (stName.includes("negot")) key = "Negotiation";
        else if (stName.includes("high") || stName.includes("contract") || stName.includes("closing")) key = "High";
        else if (stName.includes("med") || stName.includes("proposal") || stName.includes("demo")) key = "Medium";
        else if (stName.includes("low") || stName.includes("qualif") || stName.includes("new") || stName.includes("contact")) key = "Low";
        else key = "Uncategorized"; // no longer silently defaults into Low

        let pNames = [];
        if (l.product_name) pNames.push(l.product_name);
        if (Array.isArray(l.products)) {
          l.products.forEach((p) => {
            const name = p.product_name || p.product || p.name;
            if (name) pNames.push(name);
          });
        }
        if (pNames.length === 0) pNames = ["Unassigned Product"];

        pNames.forEach((pName) => {
          map[key][pName] = (map[key][pName] || 0) + 1;
        });
      });
    }

    if (sseData) {
      const byStage = sseData.by_stage || {};
      const byStageByProd = sseData.by_stage_by_product || {};

      STAGES.forEach((st) => {
        let countFromSse = 0;
        if (st === "Won" && sseData.total_won_count !== undefined) {
          countFromSse = Number(sseData.total_won_count);
        } else if (st === "Lost" && sseData.total_lost_count !== undefined) {
          countFromSse = Number(sseData.total_lost_count);
        } else if (byStage[st] !== undefined) {
          countFromSse = Number(byStage[st]);
        } else if (byStage[st.toLowerCase()] !== undefined) {
          countFromSse = Number(byStage[st.toLowerCase()]);
        }

        const prodMap = byStageByProd[st] || byStageByProd[st.toLowerCase()];
        if (prodMap && typeof prodMap === "object" && Object.keys(prodMap).length > 0) {
          Object.entries(prodMap).forEach(([pName, count]) => {
            if (pName && Number(count) > 0) {
              map[st][pName] = Math.max(map[st][pName] || 0, Number(count));
            }
          });
        }

        const currentTotal = Object.values(map[st]).reduce((sum, c) => sum + c, 0);
        const targetTotal = Math.max(countFromSse, currentTotal);
        if (targetTotal > currentTotal) {
          const diff = targetTotal - currentTotal;
          map[st]["Other / Unassigned"] = (map[st]["Other / Unassigned"] || 0) + diff;
        }
      });
    }

    return map;
  }, [sseData, leads]);

  const { productList, productColors } = useProductColors(rawData);

  const width = 640;
  const funnelHeight = 310;
  // Reversed: narrow at top (minTop), wide at bottom (maxBottom)
  const minTop = width * 0.32;
  const maxBottom = width * 0.92;
  const n = PIPELINE_STAGES.length;
  const segH = funnelHeight / n;

  const toggleProduct = (p) => {
    setSelectedProducts((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const outcomeMax = Math.max(
    1,
    ...OUTCOME_STAGES.map((s) => stageTotal(rawData[s] || {}, selectedProducts))
  );

  const allStages = [...PIPELINE_STAGES, ...OUTCOME_STAGES];
  const grandTotal = allStages.reduce(
    (sum, s) => sum + stageTotal(rawData[s] || {}, selectedProducts),
    0
  );
  const showEmptyBanner = selectedProducts.length > 0 && grandTotal === 0;

  const handleStageMouseEnter = (e, stage, type) => {
    const total = stageTotal(rawData[stage] || {}, selectedProducts);
    const entries = Object.entries(rawData[stage] || {}).filter(
      ([p]) => selectedProducts.length === 0 || selectedProducts.includes(p)
    );

    let title = "";
    let subtitle = "";
    let items = [];

    if (type === "pipeline") {
      title = `Funnel Stage: ${stage}`;
      subtitle = "Lead Distribution";
      items = [
        {
          label: "Lead Count",
          value: `${total} ${total === 1 ? "Lead" : "Leads"}`,
          color: total === 0 ? "#94A3B8" : STAGE_COLORS[stage] || "#38BDF8",
        },
      ];
      entries.forEach(([pName, count]) => {
        items.push({
          label: pName,
          value: `${count} ${count === 1 ? "Lead" : "Leads"}`,
          color: productColors[pName] || STAGE_COLORS[stage],
        });
      });
    } else {
      title = `Outcome: ${stage}`;
      subtitle = "Terminal Closed Deals";
      items = [
        {
          label: `Total ${stage}`,
          value: `${total} ${total === 1 ? "Lead" : "Leads"}`,
          color: stage === "Won" ? "#10B981" : "#F87171",
        },
      ];
      entries.forEach(([pName, count]) => {
        items.push({
          label: pName,
          value: `${count} ${count === 1 ? "Lead" : "Leads"}`,
          color: productColors[pName] || (stage === "Won" ? "#10B981" : "#F87171"),
        });
      });
    }

    if (typeof onMouseMove === "function") {
      onMouseMove(e, title, subtitle, items);
    } else {
      setLocalHover({ x: e.clientX, y: e.clientY, title, subtitle, items });
    }
  };

  const handleStageMouseMove = (e, stage, type) => {
    if (typeof onMouseMove === "function") {
      handleStageMouseEnter(e, stage, type);
    } else if (localHover) {
      setLocalHover((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
    }
  };

  const handleStageMouseLeave = () => {
    if (typeof onMouseLeave === "function") {
      onMouseLeave();
    }
    setLocalHover(null);
  };

  const wonCount = stageTotal(rawData["Won"] || {}, selectedProducts);
  const lostCount = stageTotal(rawData["Lost"] || {}, selectedProducts);

  return (
    <div
      style={{
        background: "var(--t-surface-alt, #0B1120)",
        border: "1px solid var(--t-border, #1E293B)",
        borderRadius: 8,
        padding: "20px 22px",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxSizing: "border-box",
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#E2E8F0",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "clamp(18px, 1.35vw, 22px)",
              fontWeight: 600,
              color: "#F8FAFC",
              fontFamily: "Helvetica",
            }}
          >
            Sales Funnel Conversion
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94A3B8" }}>
            Stage-by-stage lead distribution
          </p>
        </div>

        <div style={{ position: "relative", marginTop: -4, marginRight: -4, flexShrink: 0 }} ref={filterRef}>
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            style={{
              background: selectedProducts.length > 0 ? "rgba(0, 212, 170, 0.16)" : "rgba(0, 212, 170, 0.06)",
              border: "1.5px solid #00D4AA",
              borderRadius: "999px",
              padding: "6px 14px",
              color: "#00D4AA",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "'Inter', sans-serif",
              transition: "all 160ms ease",
              boxShadow: "0 0 10px rgba(0, 212, 170, 0.15)",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            <FiFilter style={{ fontSize: "11.5px" }} />
            <span>
              {selectedProducts.length === 0
                ? "By Product"
                : selectedProducts.length === 1
                  ? selectedProducts[0]
                  : `By Product (${selectedProducts.length})`}
            </span>
            <FiChevronDown
              style={{
                fontSize: "11.5px",
                transform: filterOpen ? "rotate(180deg)" : "none",
                transition: "transform 0.15s ease",
              }}
            />
          </button>

          {filterOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 6px)",
                background: "#0B131F",
                border: "1px solid rgba(0, 212, 170, 0.3)",
                borderRadius: "10px",
                padding: "6px",
                zIndex: 60,
                minWidth: 170,
                boxShadow: "0 10px 25px rgba(0,0,0,0.7), 0 0 15px rgba(0, 212, 170, 0.15)",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <div
                onClick={() => setSelectedProducts([])}
                style={{
                  padding: "6px 10px",
                  fontSize: 12,
                  cursor: "pointer",
                  borderRadius: 6,
                  color: selectedProducts.length === 0 ? "#00D4AA" : "#E2E8F0",
                  fontWeight: selectedProducts.length === 0 ? 700 : 500,
                  background: selectedProducts.length === 0 ? "rgba(0, 212, 170, 0.12)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <span>All Products</span>
                {selectedProducts.length === 0 && <span style={{ marginLeft: "auto", color: "#00D4AA" }}>✓</span>}
              </div>
              <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", margin: "4px 0" }} />
              {productList.length === 0 ? (
                <div style={{ padding: "6px 10px", fontSize: 12, color: "#64748B" }}>No products available</div>
              ) : (
                productList.map((p) => (
                  <div
                    key={p}
                    onClick={() => toggleProduct(p)}
                    style={{
                      padding: "6px 10px",
                      fontSize: 12,
                      cursor: "pointer",
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: selectedProducts.includes(p) ? "#00D4AA" : "#E2E8F0",
                      background: selectedProducts.includes(p) ? "rgba(0, 212, 170, 0.1)" : "transparent",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: productColors[p],
                        display: "inline-block",
                        boxShadow: `0 0 6px ${productColors[p]}`,
                      }}
                    />
                    <span style={{ flex: 1 }}>{p}</span>
                    {selectedProducts.includes(p) && <span style={{ color: "#00D4AA", fontWeight: 700 }}>✓</span>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {showEmptyBanner && (
        <div
          style={{
            background: "#1E1B2E",
            border: "1px solid #3730A3",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            color: "#A5B4FC",
            marginBottom: 16,
          }}
        >
          No leads found for the selected product(s) across any stage.
        </div>
      )}

      {/* Won — kept above the funnel, separate terminal-outcome block */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: "20px",
          paddingBottom: "14px",
          borderBottom: "1px solid var(--t-border, #1E293B)",
          fontSize: "13px",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <span
          onMouseEnter={(e) => handleStageMouseEnter(e, "Won", "outcome")}
          onMouseMove={(e) => handleStageMouseMove(e, "Won", "outcome")}
          onMouseLeave={handleStageMouseLeave}
          style={{ color: "#00D4AA", display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, cursor: "pointer" }}
        >
          <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#00D4AA" }} />
          Won: {wonCount} {wonCount === 1 ? "Lead" : "Leads"}
        </span>
      </div>

      {/* Funnel SVG — reversed: narrow top (Negotiation) -> wide bottom (Low) */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", margin: "16px 0", minHeight: 0 }}>
        <svg width="100%" viewBox={`0 0 ${width} ${funnelHeight}`} style={{ display: "block", overflow: "visible", maxHeight: "310px" }}>
          {PIPELINE_STAGES.map((stage, i) => {
            // i=0 is top (narrowest), i=n-1 is bottom (widest)
            const topW = minTop + ((maxBottom - minTop) * i) / n;
            const botW = minTop + ((maxBottom - minTop) * (i + 1)) / n;
            const y = i * segH;
            const topLeft = (width - topW) / 2;
            const topRight = topLeft + topW;
            const botLeft = (width - botW) / 2;
            const botRight = botLeft + botW;
            const total = stageTotal(rawData[stage] || {}, selectedProducts);
            const isEmpty = total === 0;
            const key = `pipeline-${stage}`;

            return (
              <g
                key={key}
                onMouseEnter={(e) => handleStageMouseEnter(e, stage, "pipeline")}
                onMouseMove={(e) => handleStageMouseMove(e, stage, "pipeline")}
                onMouseLeave={handleStageMouseLeave}
                style={{ cursor: "pointer" }}
              >
                <polygon
                  points={`${topLeft},${y} ${topRight},${y} ${botRight},${y + segH} ${botLeft},${y + segH}`}
                  fill={isEmpty ? "#1E293B" : STAGE_COLORS[stage]}
                  opacity={isEmpty ? 0.75 : 0.9}
                  stroke="#0B1120"
                  strokeWidth={2}
                  style={{ transition: "opacity 0.15s ease, fill 0.15s ease" }}
                />
                <text
                  x={width / 2}
                  y={y + segH / 2 + 5}
                  textAnchor="middle"
                  fontSize="16"
                  fontWeight="600"
                  fill={isEmpty ? "#94A3B8" : stage === "Medium" ? "#FFFFFF" : "#0B1120"}
                  style={{ pointerEvents: "none" }}
                >
                  {stage} — {total} {total === 1 ? "Lead" : "Leads"}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Lost — kept below the funnel, separate terminal-outcome block */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: "20px",
          paddingTop: "14px",
          borderTop: "1px solid var(--t-border, #1E293B)",
          fontSize: "13px",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <span
          onMouseEnter={(e) => handleStageMouseEnter(e, "Lost", "outcome")}
          onMouseMove={(e) => handleStageMouseMove(e, "Lost", "outcome")}
          onMouseLeave={handleStageMouseLeave}
          style={{ color: "var(--t-fg-muted, #94A3B8)", display: "flex", alignItems: "center", gap: "6px", fontWeight: 600, cursor: "pointer" }}
        >
          <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: "#64748B" }} />
          Lost: {lostCount} {lostCount === 1 ? "Lead" : "Leads"}
        </span>
      </div>

      {/* Standalone fallback tooltip */}
      {localHover && (
        <div
          style={{
            position: "fixed",
            top:
              localHover.y + (localHover.items ? localHover.items.length * 26 + 90 : 220) > window.innerHeight
                ? Math.max(10, localHover.y - (localHover.items ? localHover.items.length * 26 + 90 : 220))
                : localHover.y + 14,
            left: Math.min(localHover.x + 14, window.innerWidth - 300),
            maxHeight: "calc(100vh - 40px)",
            overflowY: "auto",
            zIndex: 1000,
            background: "rgba(8, 14, 22, 0.95)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(49, 151, 149, 0.4)",
            borderRadius: "10px",
            padding: "12px 16px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.7), 0 0 15px rgba(0, 212, 170, 0.25)",
            pointerEvents: "none",
            minWidth: "220px",
          }}
        >
          <div style={{ fontFamily: "'Helvetica'", fontSize: "14.5px", fontWeight: 800, color: "#FFFFFF" }}>
            {localHover.title}
          </div>
          {localHover.subtitle && (
            <div style={{ fontSize: "11px", fontFamily: "'Inter', sans-serif", color: "#8CA0B8", marginBottom: "8px" }}>
              {localHover.subtitle}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {localHover.items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  fontSize: "12.5px",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#CBD5E1" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: item.color || "#00D4AA",
                      boxShadow: `0 0 6px ${item.color || "#00D4AA"}`,
                    }}
                  />
                  {item.label}
                </span>
                <span style={{ fontWeight: 800, color: "#FFFFFF", fontFamily: "'Inter', sans-serif" }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}