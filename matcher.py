
"""
Matcher module: recommends 양도자-양수자 pairs from CSV/XLSX data.

Usage (CLI):
    python matcher.py \
        --yangdo /mnt/data/yangdoja.csv \
        --yangsu /mnt/data/yangsuja.csv \
        --meta /mnt/data/list.xlsx \
        --topk 5 \
        --weights '{"product":0.40,"price":0.25,"region":0.20,"grade":0.15}' \
        --out_seller /mnt/data/match_recommendations_per_seller.csv \
        --out_buyer  /mnt/data/match_recommendations_per_buyer.csv
"""
import argparse, json, re, math
from typing import Dict, Tuple, List
import pandas as pd

GRADE_ORDER = {"프리미엄": 3, "스탠다드": 2, "베이직": 1, "일반": 2}

def extract_region_parts(address: str) -> Tuple[str,str]:
    if pd.isna(address):
        return "",""
    s = str(address).strip()
    tokens = s.split()
    city = ""
    district = ""
    for t in tokens:
        if t.endswith(("특별시","광역시","도","시")) and not city:
            city = t
        elif t.endswith(("구","군")) and not district:
            district = t
        if city and district:
            break
    if not city:
        m = re.search(r"([가-힣A-Za-z]+(?:특별시|광역시|도|시))", s)
        if m: city = m.group(1)
    if not district:
        m = re.search(r"([가-힣A-Za-z]+(?:구|군))", s)
        if m: district = m.group(1)
    return city or "", district or ""

def grade_score(g1: str, g2: str) -> float:
    a = GRADE_ORDER.get(str(g1).strip(), 0)
    b = GRADE_ORDER.get(str(g2).strip(), 0)
    if a == 0 or b == 0:
        return 0.5 if (g1 and g2) else 0.0
    diff = abs(a-b)
    if diff == 0: return 1.0
    if diff == 1: return 0.7
    return 0.4

def price_fit_score(seller: float, buyer: float) -> float:
    if pd.isna(seller) or pd.isna(buyer): 
        return 0.0
    if buyer < seller:
        return 0.0
    ratio = seller / buyer  # (0,1]
    return max(0.0, min(1.0, ratio ** 0.5))

def cat_score(row) -> float:
    score = 0.0
    if row.get("s_브랜드")==row.get("b_브랜드") and pd.notna(row.get("s_브랜드")):
        score += 0.25
    if row.get("s_소카테고리")==row.get("b_소카테고리") and pd.notna(row.get("s_소카테고리")):
        score += 0.4
    elif row.get("s_중카테고리")==row.get("b_중카테고리") and pd.notna(row.get("s_중카테고리")):
        score += 0.25
    elif row.get("s_대카테고리")==row.get("b_대카테고리") and pd.notna(row.get("s_대카테고리")):
        score += 0.15
    return min(1.0, score)

def region_score(a_addr: str, b_addr: str) -> float:
    a_city, a_dist = extract_region_parts(a_addr)
    b_city, b_dist = extract_region_parts(b_addr)
    if a_city and b_city and a_city==b_city:
        if a_dist and b_dist and a_dist==b_dist:
            return 1.0
        return 0.6
    if a_city and b_city and (a_city in b_city or b_city in a_city):
        return 0.5
    return 0.0

def build_explanation(row, weights: Dict[str,float]) -> str:
    reasons = []
    if row.get("product_code_exact")==1.0:
        reasons.append("동일 상품코드")
    if row.get("cat_sim",0)>0.3:
        reasons.append("카테고리/브랜드 유사")
    if row.get("price_fit",0)>0:
        reasons.append(f"예산 충족(양도 {int(row.get('s_price')):,}원 ≤ 양수 {int(row.get('b_budget')):,}원)")
    if row.get("region_sim",0)>=0.6:
        lvl = "시/구 동일" if row.get("region_sim")==1.0 else "같은 시"
        reasons.append(f"지역 근접({lvl})")
    if row.get("grade_sim",0)>=0.7:
        reasons.append("등급 적합")
    if not reasons:
        reasons.append("기본 조건 일치")
    return " · ".join(reasons)

def compute_matches(sellers: pd.DataFrame, buyers: pd.DataFrame, products: pd.DataFrame, topk=5,
                    weights: Dict[str,float]=None):
    if weights is None:
        weights = {"product":0.40,"price":0.25,"region":0.20,"grade":0.15}
    s = sellers.rename(columns={
        "양도자ID":"seller_id",
        "양도제품코드":"s_code",
        "양도자 등급":"s_grade",
        "양도 금액":"s_price",
        "주소":"s_addr",
        "이름":"s_name"
    }).copy()
    buyers = buyers.copy()
    if "양수 관심제품코드" in buyers.columns:
        buyers = buyers.rename(columns={"양수 관심제품코드":"양수제품코드"})
    b = buyers.rename(columns={
        "양수자ID":"buyer_id",
        "양수제품코드":"b_code",
        "양수자 등급":"b_grade",
        "양수 금액":"b_budget",
        "주소":"b_addr",
        "이름":"b_name"
    }).copy()
    meta = products.rename(columns={"상품코드":"code"})
    meta = meta[["code","브랜드","대카테고리","중카테고리","소카테고리"]].drop_duplicates()
    s = s.merge(meta.add_prefix("s_"), left_on="s_code", right_on="s_code", how="left")
    b = b.merge(meta.add_prefix("b_"), left_on="b_code", right_on="b_code", how="left")
    s_small = s[["seller_id","s_name","s_addr","s_code","s_grade","s_price","s_브랜드","s_대카테고리","s_중카테고리","s_소카테고리"]].copy()
    b_small = b[["buyer_id","b_name","b_addr","b_code","b_grade","b_budget","b_브랜드","b_대카테고리","b_중카테고리","b_소카테고리"]].copy()
    s_small["key"]=1; b_small["key"]=1
    pairs = s_small.merge(b_small, on="key").drop(columns=["key"])
    pairs["product_code_exact"] = (pairs["s_code"]==pairs["b_code"]).astype(float)
    pairs["cat_sim"] = pairs.apply(cat_score, axis=1)
    pairs["price_fit"] = pairs.apply(lambda r: price_fit_score(r["s_price"], r["b_budget"]), axis=1)
    pairs["region_sim"] = pairs.apply(lambda r: region_score(r["s_addr"], r["b_addr"]), axis=1)
    pairs["grade_sim"] = pairs.apply(lambda r: grade_score(r["s_grade"], r["b_grade"]), axis=1)
    pairs["score"] = (
        weights["product"] * pairs["product_code_exact"].fillna(0) * 1.0 +
        weights["product"] * (1 - pairs["product_code_exact"].fillna(0)) * pairs["cat_sim"].fillna(0) +
        weights["price"]   * pairs["price_fit"].fillna(0) +
        weights["region"]  * pairs["region_sim"].fillna(0) +
        weights["grade"]   * pairs["grade_sim"].fillna(0)
    )
    pairs["explanation"] = pairs.apply(lambda r: build_explanation({
        "product_code_exact": r["product_code_exact"],
        "cat_sim": r["cat_sim"],
        "price_fit": r["price_fit"],
        "region_sim": r["region_sim"],
        "grade_sim": r["grade_sim"],
        "s_price": r["s_price"],
        "b_budget": r["b_budget"]
    }, weights), axis=1)
    pairs = pairs.sort_values(["seller_id","score"], ascending=[True,False])
    pairs["rank_for_seller"] = pairs.groupby("seller_id")["score"].rank(method="first", ascending=False)
    pairs = pairs.sort_values(["buyer_id","score"], ascending=[True,False])
    pairs["rank_for_buyer"] = pairs.groupby("buyer_id")["score"].rank(method="first", ascending=False)
    top_per_seller = pairs[pairs["rank_for_seller"] <= topk].copy()
    top_per_buyer  = pairs[pairs["rank_for_buyer"]  <= topk].copy()
    out_cols = [
        "seller_id","s_name","s_addr","s_code","s_grade","s_price",
        "buyer_id","b_name","b_addr","b_code","b_grade","b_budget",
        "product_code_exact","cat_sim","price_fit","region_sim","grade_sim","score","explanation",
        "rank_for_seller","rank_for_buyer"
    ]
    return top_per_seller[out_cols].reset_index(drop=True), top_per_buyer[out_cols].reset_index(drop=True)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--yangdo", required=True)
    ap.add_argument("--yangsu", required=True)
    ap.add_argument("--meta", required=True, help="XLSX with product metadata (상품코드/브랜드/카테고리)")
    ap.add_argument("--topk", type=int, default=5)
    ap.add_argument("--weights", type=str, default='{"product":0.40,"price":0.25,"region":0.20,"grade":0.15}')
    ap.add_argument("--out_seller", required=True)
    ap.add_argument("--out_buyer", required=True)
    args = ap.parse_args()

    sellers = pd.read_csv(args.yangdo)
    buyers  = pd.read_csv(args.yangsu)
    meta_df = pd.read_excel(args.meta, sheet_name=0)

    weights = json.loads(args.weights)
    top_for_seller, top_for_buyer = compute_matches(sellers, buyers, meta_df, topk=args.topk, weights=weights)

    top_for_seller.to_csv(args.out_seller, index=False, encoding="utf-8-sig")
    top_for_buyer.to_csv(args.out_buyer, index=False, encoding="utf-8-sig")
    print(f"Saved: {args.out_seller} and {args.out_buyer}")

if __name__ == "__main__":
    main()
