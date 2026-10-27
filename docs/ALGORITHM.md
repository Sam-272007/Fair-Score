# FairScore Mathematical & Algorithmic Foundations

This document provides a rigorous mathematical explanation of the three scoring methodologies implemented in **FairScore**, complete with a step-by-step worked numerical example and graph diagnostic theory.

---

## 1. The Core Problem: Evaluation Bias in Subsampled Competitions

In hackathons, college fests, academic project reviews, and pitch contests, it is rarely feasible for every judge to evaluate every single team. Instead, teams are partitioned among judges.

When scoring subsets overlap incompletely:
1. **Judge Strictness (Harshness):** Some judges calibrate their top score at $7/10$, while lenient judges freely award $9.5/10$.
2. **Conflation of Merit and Luck:** If Team A (an outstanding project) is assigned to two strict judges, their raw average might be $7.2/10$. If Team B (a mediocre project) is assigned to two lenient judges, their raw average might be $8.6/10$.
3. **Flawed Winner:** Under simple raw averaging, Team B wins the competition purely because Team A had the misfortune of drawing strict evaluators.

FairScore provides three methods side by side, explains their adjustments, and diagnoses when the underlying evaluation network cannot mathematically support a fair ranking.

---

## 2. The Three Scoring Methodologies

### Method 1: Raw Arithmetic Average

$$\bar{S}_t = \frac{1}{|J_t|} \sum_{j \in J_t} S_{j, t}$$

Where:
- $S_{j,t}$ is the score awarded by judge $j$ to team $t$.
- $J_t$ is the set of judges who scored team $t$.

**Properties:**
- Simplest to compute and universally understood.
- **Critical Flaw:** Completely ignores judge severity. Only unbiased if every judge evaluates all teams ($k = J$) or if all judges share identical scoring distributions.

---

### Method 2: Standardized Z-Score Normalization

Z-score standardization normalizes scores within each judge's personal distribution before averaging across teams.

1. **Judge Statistics:** For each judge $j$, compute their sample mean ($\mu_j$) and population standard deviation ($\sigma_j$) across all teams $T_j$ they evaluated:

   $$\mu_j = \frac{1}{|T_j|} \sum_{t \in T_j} S_{j, t}$$

   $$\sigma_j = \sqrt{ \frac{1}{|T_j|} \sum_{t \in T_j} (S_{j, t} - \mu_j)^2 }$$

2. **Standardized Score ($Z_{j,t}$):**
   - If $\sigma_j \ge 10^{-12}$:
     $$Z_{j,t} = \frac{S_{j,t} - \mu_j}{\sigma_j}$$
   - If $\sigma_j < 10^{-12}$ (the judge gave every team the exact same score):
     $$Z_{j,t} = 0$$
     *(FairScore flags this judge with a `ZERO_VARIANCE_JUDGE` warning to prevent division by zero or NaN propagation).*

3. **Team Z-Score ($\bar{Z}_t$):**

   $$\bar{Z}_t = \frac{1}{|J_t|} \sum_{j \in J_t} Z_{j,t}$$

**Properties:**
- Puts all judges on a common scale where $\text{Mean} = 0$ and $\text{Variance} = 1$.
- **Limitation:** Can be computed even when judge pods are disconnected, but implicitly assumes that each judge evaluated a random sample of equal average ability.

---

### Method 3: Iterative Judge-Effect Additive Model (Recommended)

The judge-effect model represents scoring as a system of linear equations with latent parameters:

$$S_{j,t} = Q_t + B_j + \epsilon_{j,t}$$

Where:
- $Q_t$ is the true intrinsic quality of team $t$.
- $B_j$ is the persistent bias (strictness or leniency) of judge $j$.
- $\epsilon_{j,t}$ is zero-mean random noise.

#### Alternating Least-Squares Algorithm:

1. **Initialization:**
   - Set all judge biases $B_j^{(0)} = 0$ for all $j \in J$.
   - Set initial team qualities $Q_t^{(0)}$ to their raw arithmetic means.

2. **Iterative Update Loop (for iteration $k = 0, 1, 2, \dots$ up to 500):**
   - **Update Team Qualities:** Given current judge biases $B_j^{(k)}$, each team's quality is the average bias-adjusted score:
     $$Q_t^{(k+1)} = \frac{1}{|J_t|} \sum_{j \in J_t} \left( S_{j,t} - B_j^{(k)} \right)$$

   - **Update Judge Biases:** Given updated team qualities $Q_t^{(k+1)}$, each judge's raw bias is the average residual:
     $$\tilde{B}_j^{(k+1)} = \frac{1}{|T_j|} \sum_{t \in T_j} \left( S_{j,t} - Q_t^{(k+1)} \right)$$

   - **Identifiability Constraint (Re-centering):** To guarantee a unique solution, judge biases are constrained to sum (and average) to zero:
     $$\mu_B = \frac{1}{|J|} \sum_{j \in J} \tilde{B}_j^{(k+1)}$$
     $$B_j^{(k+1)} = \tilde{B}_j^{(k+1)} - \mu_B$$

   - **Preserve Natural Scale:** To maintain human readability on the original $[min, max]$ score scale:
     $$Q_t^{(k+1)} \leftarrow Q_t^{(k+1)} + \mu_B$$

3. **Convergence Check:**
   $$\Delta_{max} = \max \left( \max_t |Q_t^{(k+1)} - Q_t^{(k)}|, \max_j |B_j^{(k+1)} - B_j^{(k)}| \right)$$
   Stop when $\Delta_{max} < 10^{-9}$ (or after 500 iterations).

---

## 3. Step-by-Step Worked Numerical Example

Consider a competition with 3 teams ($T_1, T_2, T_3$) and 2 judges ($J_1, J_2$):
- $J_1$ is a strict judge (true bias $-1.5$).
- $J_2$ is a lenient judge (true bias $+1.5$).
- True team quality: $Q(T_1) = 8.0$, $Q(T_2) = 6.0$, $Q(T_3) = 4.0$.

### Observed Score Matrix

| Team | Scored by $J_1$ (Strict) | Scored by $J_2$ (Lenient) | Raw Mean | Raw Rank |
| :--- | :---: | :---: | :---: | :---: |
| **Team 1** | $6.5$ | *(not seen)* | **6.50** | **#2 (Penalized!)** |
| **Team 2** | *(not seen)* | $7.5$ | **7.50** | **#1 (Inflated!)** |
| **Team 3 (Overlap)** | $2.5$ | $5.5$ | **4.00** | **#3** |

Notice that Team 3 overlaps across both judges, providing the bridge that connects the network!

### Step 1: Raw Average Flaw
- Raw Average puts Team 2 in 1st place ($7.50$) ahead of Team 1 ($6.50$), simply because Team 2 drew the lenient judge.

### Step 2: Running FairScore Iterative Model
- **Iteration 0:**
  - $B_1 = 0, B_2 = 0$.
  - $Q(T_1) = 6.5, Q(T_2) = 7.5, Q(T_3) = 4.0$.
- **Iteration 1:**
  - Compute Judge residuals:
    - $J_1$ scores: for $T_1$, residual $= 6.5 - 6.5 = 0$; for $T_3$, residual $= 2.5 - 4.0 = -1.5$. Mean residual for $J_1 = -0.75$.
    - $J_2$ scores: for $T_2$, residual $= 7.5 - 7.5 = 0$; for $T_3$, residual $= 5.5 - 4.0 = +1.5$. Mean residual for $J_2 = +0.75$.
  - Biases updated: $B_1 = -0.75, B_2 = +0.75$.
  - Team qualities updated:
    - $Q(T_1) = 6.5 - (-0.75) = 7.25$
    - $Q(T_2) = 7.5 - (+0.75) = 6.75$
    - $Q(T_3) = \frac{(2.5 - (-0.75)) + (5.5 - 0.75)}{2} = \frac{3.25 + 4.75}{2} = 4.00$
- **Convergence:**
  Within a few iterations, the model converges to:
  - $B_1 = -1.50$ (Strict)
  - $B_2 = +1.50$ (Lenient)
  - $Q(T_1) = 8.00 \rightarrow$ **Rank #1 (Correct Winner!)**
  - $Q(T_2) = 6.00 \rightarrow$ **Rank #2**
  - $Q(T_3) = 4.00 \rightarrow$ **Rank #3**

FairScore completely restores the rightful winner despite missing judge overlap.

---

## 4. Diagnostics & Reliability Analysis

### 1. Bipartite Graph Connectivity (BFS)

Judges and teams form nodes in a bipartite graph $G = (V_J \cup V_T, E)$, where an edge $(j, t) \in E$ exists if judge $j$ scored team $t$.

- A Breadth-First Search (BFS) is executed over all nodes.
- If the number of connected components $C > 1$:
  - Scores between disjoint components have **zero cross-calibration**.
  - FairScore generates the prominent `DISCONNECTED` warning.
  - The system automatically changes its recommendation to **Z-Score Normalization** because the additive model cannot calibrate across disjoint graphs.

### 2. Leave-One-Out Sensitivity Analysis

Even when a graph is connected, the ranking may depend excessively on a single judge. FairScore runs an automated leave-one-out sensitivity test:
1. For each judge $j \in J$:
   - Temporarily remove all scores submitted by judge $j$.
   - Verify whether removing judge $j$ disconnects the graph or leaves any team with 0 scores. If so, skip that removal with an explicit reason.
   - Re-run the judge-effect model on the remaining data and compute the new ranking.
   - Record the rank change for every team: $\delta_{t, j} = |Rank_{baseline}(t) - Rank_{-j}(t)|$.
2. **Team Stability Metric:** A team is classified as **Stable** if $\max_j \delta_{t, j} \le 1$.
3. **Podium Stability:** If any removal alters the set of teams occupying the top-3 podium positions, FairScore issues a `TOP_UNSTABLE` warning.

---

## 5. Fair Overlap Assignment Planning

To prevent disconnected graphs before an event even starts, FairScore includes a deterministic assignment planner:
- For $T$ teams, $J$ judges, and $k$ judges per team ($2 \le k \le J$):
  1. Teams are permuted with a seeded pseudo-random number generator (`Mulberry32`).
  2. Team $i$ is assigned judges:
     $$\text{Judges}(i) = \{ (i + j) \pmod J \mid j \in [0, k-1] \}$$
  3. The planner automatically verifies that:
     - The bipartite graph is strictly connected ($C = 1$).
     - The maximum judge workload difference is at most $2$:
       $$\max_j |T_j| - \min_j |T_j| \le 2$$
     - If any constraint is violated, the planner fails loudly before any scores are collected.
