from __future__ import annotations

import json
from math import sqrt
from pathlib import Path

import duckdb


def moving_average(values: list[float], window: int = 28) -> float:
    history = values[-window:]
    return sum(history) / len(history)


def linear_trend(values: list[float], window: int = 28) -> float:
    history = values[-window:]
    if len(history) < 2:
        return history[-1]
    x_mean = (len(history) - 1) / 2
    y_mean = sum(history) / len(history)
    denominator = sum((index - x_mean) ** 2 for index in range(len(history)))
    slope = sum((index - x_mean) * (value - y_mean) for index, value in enumerate(history)) / denominator
    return max(y_mean + slope * (len(history) - x_mean), 0)


def rolling_backtest(values: list[float], minimum_history: int = 56) -> dict[str, object]:
    if len(values) <= minimum_history:
        raise ValueError('At least 57 daily observations are required for temporal validation.')
    actual: list[float] = []
    baseline: list[float] = []
    candidate: list[float] = []
    for cutoff in range(minimum_history, len(values)):
        history = values[:cutoff]
        actual.append(values[cutoff])
        baseline.append(moving_average(history))
        candidate.append(linear_trend(history))

    def rmse(predictions: list[float]) -> float:
        return sqrt(sum((observed - predicted) ** 2 for observed, predicted in zip(actual, predictions, strict=True)) / len(actual))

    baseline_rmse = rmse(baseline)
    candidate_rmse = rmse(candidate)
    improvement = (baseline_rmse - candidate_rmse) / baseline_rmse if baseline_rmse else 0
    winner = 'linear_trend' if improvement >= 0.05 else 'moving_average_28d'
    return {
        'split': 'rolling_origin',
        'minimum_history_days': minimum_history,
        'holdout_observations': len(actual),
        'baseline': {'name': 'moving_average_28d', 'rmse': baseline_rmse},
        'candidate': {'name': 'linear_trend_28d', 'rmse': candidate_rmse},
        'candidate_improvement': improvement,
        'selected_model': winner,
    }


def evaluate(database: Path, output: Path) -> dict[str, object]:
    connection = duckdb.connect(str(database), read_only=True)
    values = [float(row[0]) for row in connection.execute(
        'select sum(units) from sales group by sale_date order by sale_date'
    ).fetchall()]
    result = rolling_backtest(values)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2), encoding='utf-8')
    return result
