
import streamlit as st
import pandas as pd
import json
from matcher import compute_matches

st.set_page_config(page_title="양도자–양수자 매칭", layout="wide")

st.title("양도자–양수자 추천 매칭 데모")

yangdo_path = st.text_input("양도자 CSV 경로", "/mnt/data/yangdoja.csv")
yangsu_path = st.text_input("양수자 CSV 경로", "/mnt/data/yangsuja.csv")
meta_path   = st.text_input("상품 메타 XLSX 경로", "/mnt/data/list.xlsx")

topk = st.slider("Top-K", 1, 20, 5)
col1, col2, col3, col4 = st.columns(4)
with col1:
    w_product = st.number_input("가중치-상품/카테고리", 0.0, 1.0, 0.40, 0.05)
with col2:
    w_price   = st.number_input("가중치-예산적합", 0.0, 1.0, 0.25, 0.05)
with col3:
    w_region  = st.number_input("가중치-지역근접", 0.0, 1.0, 0.20, 0.05)
with col4:
    w_grade   = st.number_input("가중치-등급", 0.0, 1.0, 0.15, 0.05)

if st.button("매칭 실행"):
    sellers = pd.read_csv(yangdo_path)
    buyers  = pd.read_csv(yangsu_path)
    meta    = pd.read_excel(meta_path, sheet_name=0)
    weights = {"product":w_product, "price":w_price, "region":w_region, "grade":w_grade}
    top_for_seller, top_for_buyer = compute_matches(sellers, buyers, meta, topk=topk, weights=weights)

    st.subheader("양도자 기준 Top-K 추천")
    st.dataframe(top_for_seller)

    st.subheader("양수자 기준 Top-K 추천")
    st.dataframe(top_for_buyer)
