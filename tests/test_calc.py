import pytest
from tools import calc


def test_compute_sle():
    assert calc.compute_sle(100000, 100) == 100000
    assert calc.compute_sle(100000, 50) == 50000


def test_compute_ale():
    sle = calc.compute_sle(200000, 50)
    ale = calc.compute_ale(sle, 0.2)
    assert ale == 200000 * 0.5 * 0.2


def test_expected_breach_cost():
    val = calc.compute_expected_annual_breach_cost(2500000, 0.14)
    assert val == pytest.approx(2500000 * 0.14)


def test_hot_site_roi():
    r = calc.hot_site_roi(100000, 14, 50000, 4)
    # cold loss = 1.4M
    assert r['cold_loss'] == 100000 * 14
    assert r['hot_total'] == pytest.approx(50000 + (100000 * (4/24)))


def test_ale_pre_post_and_rosi():
    sector = 'Retail'
    loss = 100000
    ef = 100
    ale_pre = calc.compute_ale_pre(sector, loss, ef)
    # Retail ARO is 0.14 -> ALE_pre = 100000 * 1 * 0.14 = 14000
    assert ale_pre == pytest.approx(100000 * 1 * 0.14)

    ale_post = calc.compute_ale_post(sector, loss, ef, mfa=True, phish=False)
    # With MFA only, ARO reduced by 50% -> ale_post = 7000
    assert ale_post == pytest.approx(7000)

    downtime_cold = calc.compute_downtime_loss(sector, 'Cold Site', succession=False)
    downtime_hot = calc.compute_downtime_loss(sector, 'Hot Site', succession=False)
    assert downtime_cold > downtime_hot

    # simple ROSI example
    rosi = calc.compute_rosi(ale_pre, ale_post, (downtime_cold - downtime_hot), 50000)
    assert isinstance(rosi, float)
