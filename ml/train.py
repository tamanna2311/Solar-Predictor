from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
import pvlib
from sklearn.metrics import mean_absolute_error, mean_squared_error


@dataclass(frozen=True)
class Inputs:
    inverter: Path
    weather: Path
    plant: Path
    config: Path
    output: Path


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def source_series(payload: dict[str, Any], parameter: str, device: str | None = None) -> pd.Series:
    matches = [
        report for report in payload["other_reports"]
        if report.get("parameter") == parameter
        and (device is None or report.get("device") == device)
    ]
    if len(matches) != 1:
        raise ValueError(f"Expected one series for {parameter}/{device}; found {len(matches)}")
    records = [item for item in matches[0].get("reports", []) if item.get("time")]
    frame = pd.DataFrame.from_records(records)
    frame["time"] = pd.to_datetime(frame["time"], errors="coerce")
    frame["value"] = pd.to_numeric(frame["value"], errors="coerce")
    frame = frame.dropna(subset=["time"]).drop_duplicates("time", keep="last")
    return frame.set_index("time")["value"].sort_index()


def build_aligned_frame(inputs: Inputs, config: dict[str, Any]) -> tuple[pd.DataFrame, dict[str, int]]:
    inverter = read_json(inputs.inverter)
    weather = read_json(inputs.weather)
    plant = read_json(inputs.plant)
    inverter_ids = [f"INV-{number}" for number in range(1, config["inverter_count"] + 1)]
    start = pd.Timestamp(inverter["start"])
    end = pd.Timestamp(inverter["end"]) + pd.Timedelta(days=1)
    index = pd.date_range(start=start, end=end, freq="15min", inclusive="left")
    data = pd.DataFrame(index=index)
    ac_columns: list[str] = []

    for inverter_id in inverter_ids:
        suffix = inverter_id.lower().replace("-", "_")
        ac_column = f"{suffix}_ac_kw"
        data[ac_column] = source_series(inverter, "TOTAL_ACTIVE_POWER", inverter_id).reindex(index)
        data[f"{suffix}_dc_kw"] = source_series(inverter, "TOTA_DC_POWER", inverter_id).reindex(index) / 1000
        data[f"{suffix}_status"] = source_series(inverter, "INV_STATUS", inverter_id).reindex(index)
        ac_columns.append(ac_column)

    data["reported_inverter_count"] = data[ac_columns].notna().sum(axis=1)
    data["active_inverter_count"] = (data[ac_columns].fillna(0) > 0).sum(axis=1)
    data["plant_ac_power_kw"] = data[ac_columns].sum(axis=1, min_count=config["inverter_count"])
    data["available_ac_capacity_kw"] = (
        config["ac_capacity_kw"] * data["reported_inverter_count"] / config["inverter_count"]
    )

    weather_fields = {
        "temperature_2m": "ambient_temperature_c",
        "shortwave_radiation_instant": "ghi_wm2",
        "relative_humidity_2m": "relative_humidity_pct",
        "rain": "rain_mm",
        "weather_code": "weather_code",
        "wind_speed_10m": "wind_speed_kmh",
    }
    for source, destination in weather_fields.items():
        data[destination] = source_series(weather, source).reindex(index)
    data["plant_status"] = source_series(plant, "PLANT_STATUS").reindex(index)
    data["data_quality_flag"] = np.select(
        [
            data["reported_inverter_count"] < config["inverter_count"],
            data["ambient_temperature_c"].isna() | data["ghi_wm2"].isna(),
            data["plant_ac_power_kw"] > config["ac_capacity_kw"] * 1.05,
        ],
        ["missing_inverter", "missing_weather", "above_capacity"],
        default="ok",
    )
    quality = {
        "expected_intervals": len(data),
        "complete_power_intervals": int(data["plant_ac_power_kw"].notna().sum()),
        "complete_weather_intervals": int(data[["ambient_temperature_c", "ghi_wm2"]].notna().all(axis=1).sum()),
        "above_capacity_intervals": int((data["plant_ac_power_kw"] > config["ac_capacity_kw"] * 1.05).sum()),
        "missing_inverter_intervals": int((data["reported_inverter_count"] < config["inverter_count"]).sum()),
    }
    return data, quality


def add_physics_baseline(data: pd.DataFrame, config: dict[str, Any]) -> pd.DataFrame:
    frame = data.copy()
    localized = frame.index.tz_localize(config["timezone"])
    location = pvlib.location.Location(config["latitude"], config["longitude"], tz=config["timezone"])
    solar_position = location.get_solarposition(localized)
    ghi = frame["ghi_wm2"].fillna(0).clip(lower=0)
    decomposition = pvlib.irradiance.erbs(
        ghi.to_numpy(), solar_position["zenith"].to_numpy(), localized.dayofyear.to_numpy()
    )
    poa = pvlib.irradiance.get_total_irradiance(
        surface_tilt=config["surface_tilt_degrees"],
        surface_azimuth=config["surface_azimuth_degrees"],
        solar_zenith=solar_position["apparent_zenith"].to_numpy(),
        solar_azimuth=solar_position["azimuth"].to_numpy(),
        dni=np.asarray(decomposition["dni"]),
        ghi=ghi.to_numpy(),
        dhi=np.asarray(decomposition["dhi"]),
    )["poa_global"]
    temperature_parameters = pvlib.temperature.TEMPERATURE_MODEL_PARAMETERS["sapm"]["open_rack_glass_glass"]
    cell_temperature = pvlib.temperature.sapm_cell(
        np.nan_to_num(poa, nan=0),
        frame["ambient_temperature_c"].fillna(25).to_numpy(),
        frame["wind_speed_kmh"].fillna(0).to_numpy() / 3.6,
        **temperature_parameters,
    )
    dc_w = pvlib.pvsystem.pvwatts_dc(
        np.nan_to_num(poa, nan=0), cell_temperature,
        pdc0=config["dc_capacity_kwp"] * 1000, gamma_pdc=-0.0038,
    ) * (1 - config["system_loss_fraction"])
    ac_w = pvlib.inverter.pvwatts(dc_w, pdc0=config["ac_capacity_kw"] * 1000, eta_inv_nom=0.96)
    frame["solar_zenith_degrees"] = solar_position["apparent_zenith"].to_numpy()
    frame["poa_irradiance_wm2"] = np.nan_to_num(poa, nan=0)
    frame["cell_temperature_c"] = cell_temperature
    frame["pvlib_ac_power_kw"] = np.clip(np.nan_to_num(ac_w, nan=0) / 1000, 0, config["ac_capacity_kw"])
    return frame


def add_features(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    hour = result.index.hour + result.index.minute / 60
    result["hour_sin"] = np.sin(2 * np.pi * hour / 24)
    result["hour_cos"] = np.cos(2 * np.pi * hour / 24)
    result["day_of_year_sin"] = np.sin(2 * np.pi * result.index.dayofyear / 365.25)
    result["day_of_year_cos"] = np.cos(2 * np.pi * result.index.dayofyear / 365.25)
    for lag in (1, 2, 4, 96):
        result[f"power_lag_{lag}"] = result["plant_ac_power_kw"].shift(lag)
    return result


def score(actual: pd.Series, predicted: np.ndarray, capacity_kw: float) -> dict[str, float]:
    mae = mean_absolute_error(actual, predicted)
    return {
        "mae_kw": round(float(mae), 3),
        "rmse_kw": round(float(mean_squared_error(actual, predicted) ** 0.5), 3),
        "nmae_percent": round(float(mae / capacity_kw * 100), 3),
        "bias_kw": round(float(np.mean(predicted - actual.to_numpy())), 3),
    }


def train_models(frame: pd.DataFrame, config: dict[str, Any], output: Path) -> dict[str, Any]:
    features = [
        "ambient_temperature_c", "ghi_wm2", "relative_humidity_pct", "rain_mm",
        "weather_code", "wind_speed_kmh", "available_ac_capacity_kw", "pvlib_ac_power_kw",
        "solar_zenith_degrees", "hour_sin", "hour_cos", "day_of_year_sin", "day_of_year_cos",
        "power_lag_1", "power_lag_2", "power_lag_4", "power_lag_96",
    ]
    usable = frame.dropna(subset=["plant_ac_power_kw", *features])
    usable = usable[usable["data_quality_flag"] == "ok"]
    if len(usable) < 500:
        raise ValueError(f"Only {len(usable)} clean intervals remain; at least 500 are required")
    split = int(len(usable) * 0.8)
    train, test = usable.iloc[:split], usable.iloc[split:]
    parameters = dict(
        n_estimators=350, learning_rate=0.035, num_leaves=24, min_child_samples=30,
        subsample=0.85, colsample_bytree=0.85, random_state=42, n_jobs=1, verbosity=-1,
    )
    nowcast = lgb.LGBMRegressor(**parameters).fit(train[features], train["plant_ac_power_kw"])
    nowcast_prediction = np.clip(nowcast.predict(test[features]), 0, config["ac_capacity_kw"])
    residual_features = [column for column in features if not column.startswith("power_lag_")]
    residual_target = train["plant_ac_power_kw"] - train["pvlib_ac_power_kw"]
    residual = lgb.LGBMRegressor(**parameters).fit(train[residual_features], residual_target)
    residual_prediction = np.clip(
        test["pvlib_ac_power_kw"].to_numpy() + residual.predict(test[residual_features]),
        0, config["ac_capacity_kw"],
    )
    results = {
        "train_intervals": len(train), "test_intervals": len(test),
        "train_start": train.index.min().isoformat(), "train_end": train.index.max().isoformat(),
        "test_start": test.index.min().isoformat(), "test_end": test.index.max().isoformat(),
        "metrics": {
            "persistence": score(test["plant_ac_power_kw"], test["power_lag_1"].to_numpy(), config["ac_capacity_kw"]),
            "pvlib": score(test["plant_ac_power_kw"], test["pvlib_ac_power_kw"].to_numpy(), config["ac_capacity_kw"]),
            "lightgbm_15min": score(test["plant_ac_power_kw"], nowcast_prediction, config["ac_capacity_kw"]),
            "pvlib_residual_lightgbm": score(test["plant_ac_power_kw"], residual_prediction, config["ac_capacity_kw"]),
        },
        "estimated_test_energy_mwh": round(float(residual_prediction.sum() * 0.25 / 1000), 3),
        "actual_test_energy_mwh": round(float(test["plant_ac_power_kw"].sum() * 0.25 / 1000), 3),
        "warning": "July-only proof of concept using observed satellite weather, not archived issue-time forecasts.",
    }
    output.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": nowcast, "features": features}, output / "lightgbm_15min.joblib")
    joblib.dump({"model": residual, "features": residual_features}, output / "pvlib_residual_lightgbm.joblib")
    predictions = test[["plant_ac_power_kw", "pvlib_ac_power_kw"]].copy()
    predictions["lightgbm_15min_kw"] = nowcast_prediction
    predictions["residual_lightgbm_kw"] = residual_prediction
    predictions.to_csv(output / "backtest_predictions.csv", index_label="timestamp")
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the Kiran Solar hybrid forecasting proof of concept")
    parser.add_argument("--inverter", type=Path, required=True)
    parser.add_argument("--weather", type=Path, required=True)
    parser.add_argument("--plant", type=Path, required=True)
    parser.add_argument("--config", type=Path, default=Path("ml/config/kiran-solar.json"))
    parser.add_argument("--output", type=Path, default=Path("ml/artifacts/kiran-solar"))
    args = parser.parse_args()
    inputs = Inputs(args.inverter, args.weather, args.plant, args.config, args.output)
    config = read_json(inputs.config)
    aligned, quality = build_aligned_frame(inputs, config)
    modeled = add_features(add_physics_baseline(aligned, config))
    inputs.output.mkdir(parents=True, exist_ok=True)
    modeled.to_csv(inputs.output / "aligned_15min.csv", index_label="timestamp")
    training = train_models(modeled, config, inputs.output)
    manifest = {"site": config, "data_quality": quality, "training": training}
    with (inputs.output / "manifest.json").open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
