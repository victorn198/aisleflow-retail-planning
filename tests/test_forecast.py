from pipeline.forecast import rolling_backtest


def test_temporal_candidate_beats_baseline_on_clear_trend() -> None:
    series = [100 + day * 3 for day in range(120)]
    result = rolling_backtest(series)
    assert result['split'] == 'rolling_origin'
    assert result['selected_model'] == 'linear_trend'
    assert result['candidate_improvement'] > 0.05


def test_short_series_is_rejected() -> None:
    try:
        rolling_backtest([1.0] * 20)
    except ValueError as error:
        assert '57 daily observations' in str(error)
    else:
        raise AssertionError('Short temporal series must not be evaluated.')
