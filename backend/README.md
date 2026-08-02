# Bluestock Mutual Fund Analytics Capstone Project

## Overview

The Bluestock Mutual Fund Analytics Capstone Project is an end-to-end data analytics solution designed to analyze the Indian mutual fund industry. The project integrates data engineering, exploratory data analysis, performance analytics, risk analysis, investor behavior analysis, and interactive dashboarding.

The objective is to transform raw mutual fund datasets into actionable insights that help understand fund performance, investor trends, SIP growth, portfolio concentration, and market dynamics.

---

## Project Objectives

* Build a complete ETL pipeline for mutual fund datasets.
* Clean, validate, and standardize raw data.
* Store processed data in a SQLite database.
* Perform exploratory data analysis (EDA).
* Analyze fund performance using financial metrics.
* Conduct advanced risk analytics using VaR, CVaR, and Sharpe Ratio.
* Study investor behavior and SIP continuity patterns.
* Develop an interactive Power BI dashboard.
* Generate professional reports and presentations.

---

## Datasets Used

| Dataset               | Description                          |
| --------------------- | ------------------------------------ |
| Fund Master           | Scheme metadata and fund information |
| NAV History           | Historical Net Asset Values          |
| AUM by Fund House     | Assets Under Management data         |
| Monthly SIP Inflows   | SIP contribution trends              |
| Category Inflows      | Fund category investment flows       |
| Industry Folio Count  | Investor folio statistics            |
| Scheme Performance    | Fund return and performance metrics  |
| Investor Transactions | Investor-level transaction records   |
| Portfolio Holdings    | Fund holdings and sector allocation  |
| Benchmark Indices     | Benchmark market performance         |

---

## Project Structure

```text
Bluestock_Mutual_Fund_Analytics/

│
├── data/
│   ├── raw/
│   └── processed/
│
├── sql/
│
├── dashboard/
│
├── notebooks/
│   ├── EDA_Analysis.ipynb
│   ├── Performance_Analytics.ipynb
│   └── Advanced_Analytics.ipynb
│
├── reports/
│
├── data_ingestion.py
├── clean_data.py
├── load_database.py
├── live_nav_fetch.py
├── fund_master_exploration.py
├── run_pipeline.py
│
├── bluestock_mf.db
├── bluestock_mf_dashboard.pbix
│
├── requirements.txt
└── README.md
```

---

## Technologies Used

* Python
* Pandas
* NumPy
* SQLite
* Matplotlib
* Plotly
* Jupyter Notebook
* Power BI
* Git & GitHub

---

## ETL Pipeline

### Step 1: Data Ingestion

Loads raw CSV datasets from the data/raw folder.

### Step 2: Data Cleaning

* Missing value handling
* Data type corrections
* Duplicate removal
* Validation checks

### Step 3: Database Loading

Stores processed datasets into SQLite database tables.

---

## How to Run the Project

### Clone Repository

```bash
git clone <repository-url>
cd Bluestock_Mutual_Fund_Analytics
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Run Complete Pipeline

```bash
python run_pipeline.py
```

---

## Analytics Performed

### Exploratory Data Analysis

* Fund category distribution
* Expense ratio analysis
* SIP growth trends
* AUM analysis
* Investor demographic analysis

### Performance Analytics

* CAGR Analysis
* Volatility Analysis
* Sharpe Ratio
* Alpha/Beta Comparison
* Benchmark Performance

### Advanced Analytics

* Historical VaR (95%)
* Conditional VaR (CVaR)
* Rolling 90-Day Sharpe Ratio
* Investor Cohort Analysis
* SIP Continuity Analysis
* Fund Recommendation Engine
* HHI Concentration Analysis

---

## Dashboard Features

The Power BI dashboard contains:

### Page 1: Industry Overview

* Total AUM
* Fund Houses
* Category Trends
* Market Overview

### Page 2: Fund Performance

* Top Performing Funds
* Risk Metrics
* Return Analysis

### Page 3: Investor Analytics

* Investor Demographics
* Geographic Distribution
* Income Analysis

### Page 4: SIP Market Trends

* SIP Growth
* Monthly Inflows
* Active SIP Accounts

---

## Key Findings

* SIP inflows continue to grow steadily across categories.
* Equity funds dominate overall investor participation.
* Higher Sharpe ratio funds deliver superior risk-adjusted returns.
* Some funds exhibit high downside risk based on VaR and CVaR analysis.
* Investor retention can be improved by monitoring SIP continuity patterns.
* Concentrated portfolios show elevated HHI scores and higher sector risk exposure.

---

## Deliverables

* EDA_Analysis.ipynb
* Performance_Analytics.ipynb
* Advanced_Analytics.ipynb
* bluestock_mf_dashboard.pbix
* Final_Report.pdf
* Bluestock_MF_Presentation.pptx
* var_cvar_report.csv
* rolling_sharpe_chart.png
* recommender.py

---

## Future Enhancements

* Real-time NAV integration using APIs
* Predictive fund performance modeling
* Portfolio optimization engine
* Automated dashboard refresh
* Cloud deployment and reporting

---

## Author

Nagaraju

Bluestock Mutual Fund Analytics Capstone Project

Version 1.0
