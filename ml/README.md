# Kiran Solar training pipeline

This pipeline converts the SolarLive JSON exports into one validated 15-minute
table and trains a 15-minute LightGBM model plus a pvlib residual LightGBM model.

Raw company exports and generated artifacts are intentionally ignored by Git.

## Run

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r ml\requirements.txt
.\.venv\Scripts\python ml\train.py `
  --inverter D:\Downloads\inverterdata.txt `
  --weather D:\Downloads\weatherData.txt `
  --plant D:\Downloads\PlantData.txt
```

Outputs in `ml/artifacts/kiran-solar/` include the aligned CSV, both model
artifacts, chronological backtest predictions, and a JSON metrics manifest.

The July data uses observed satellite weather, so residual backtesting is an
optimistic pipeline validation—not a valid operational day-ahead score. Replace
those fields with archived issue-time forecasts before production evaluation.
