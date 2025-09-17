import pandas as pd
import random
import matplotlib.pyplot as plt

# 샘플 회원 데이터 (10명)
member_ids = [f"M{i:03d}" for i in range(1, 11)]
initial_scores = {mid: 0.7 for mid in member_ids}  # 초기 매칭 점수 0.7

# 5회 매칭 시뮬레이션 (승패 기반 점수 변동)
rating_changes = {mid: [initial_scores[mid]] for mid in member_ids}
for _ in range(4):  # 4회 추가 매칭
    for mid in member_ids:
        win = random.choice([True, False])
        change = random.uniform(0.05, 0.1) if win else -random.uniform(0.05, 0.1)
        new_score = max(0.5, min(1.0, rating_changes[mid][-1] + change))
        rating_changes[mid].append(new_score)

# 결과값 테이블 생성
results = []
for mid in member_ids:
    for i, score in enumerate(rating_changes[mid], 1):
        results.append({"회원ID": mid, "매칭 횟수": i, "매칭 점수": score})

results_df = pd.DataFrame(results)

# 그래프 생성
plt.figure(figsize=(10, 6))
for mid, scores in rating_changes.items():
    plt.plot(range(1, 6), scores, marker='o', label=mid)
plt.title("회원별 매칭 점수 변화 (5회 시뮬레이션)")
plt.xlabel("매칭 횟수")
plt.ylabel("매칭 점수")
plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
plt.grid(True)
plt.savefig("rating_changes_simulated.png")
plt.close()

# 결과 출력 (샘플 10건)
print("샘플 결과값 (전체 50건, 상위 10건 표시):")
print(results_df.head(10).to_string(index=False))
print(f"전체 결과는 rating_changes_simulated.png와 results_df에 저장되었습니다.")

# CSV로 결과 저장
results_df.to_csv("rating_simulation_results.csv", index=False, encoding="utf-8-sig")