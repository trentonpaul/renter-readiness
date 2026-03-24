/* ── SCORING LOGIC ── */

function scoreEmergency(months) {
  if (months <= 0) return 0;
  if (months <= 0.5) return 20;
  if (months <= 1) return 35;
  if (months <= 2) return 60;
  if (months <= 3) return 80;
  if (months <= 4) return 90;
  return 100;
}

function scoreRentToIncome(pct) {
  if (pct <= 0.25) return 100;
  if (pct <= 0.30) return 90;
  if (pct <= 0.33) return 75;
  if (pct <= 0.35) return 60;
  if (pct <= 0.38) return 40;
  if (pct <= 0.40) return 20;
  return 0;
}

function scoreMovingFund(pct) {
  if (pct <= 0.20) return 0;
  if (pct <= 0.40) return 25;
  if (pct <= 0.60) return 50;
  if (pct <= 0.80) return 70;
  if (pct < 1.00) return 85;
  return 100;
}

function scoreDTI(pct) {
  if (pct <= 0) return 100;
  if (pct <= 0.10) return 100;
  if (pct <= 0.15) return 75;
  if (pct <= 0.20) return 50;
  if (pct <= 0.30) return 25;
  return 0;
}

function scoreStability(val) {
  const map = {
    very_stable: 100, mostly_stable: 85, somewhat_stable: 60,
    variable: 30, no_income: 0
  };
  return map[val] ?? 0;
}

function tier(score) {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 50) return 'medium';
  return 'low';
}

function tierLabel(t) {
  return { excellent: 'Excellent', good: 'Good', medium: 'Getting there', low: 'Needs work' }[t];
}

function qualMessage(score) {
  if (score >= 90) return ["You're in an excellent position.", "Your finances are well-prepared for this move — sign with confidence."];
  if (score >= 80) return ["You're in a strong position.", "The numbers say you can probably make this work."];
  if (score >= 60) return ["You're getting close.", "A few more moves on savings, debt, or rent would really solidify things."];
  if (score >= 40) return ["You're in the gray zone.", "Some pieces are there, but a few are still fragile — worth shoring up before signing."];
  return ["The numbers are pretty tight right now.", "Treat this as a roadmap, not a shutdown — small changes to each factor add up fast."];
}

const MOVING_COSTS = {
  local: { movers: 700, diy: 150 },
  medium: { movers: 1100, diy: 400 },
  long: { movers: 2500, diy: 1000 },
};

function movingCost(distance, usesMovers) {
  return MOVING_COSTS[distance][usesMovers ? 'movers' : 'diy'];
}

// Upfront cash multiplier: local/medium = 2x rent, long distance = 3x rent
function upfrontEstimate(rent, distance) {
  return Math.round(rent * (distance === 'long' ? 3 : 2));
}

function calculate(inputs) {
  const { income, rent, debt, emergency, movingFund, distance, stability, upfrontCash, upfrontKnown, usesMovers } = inputs;

  const monthlyExpenses = rent * 1.5;
  const rtiRatio = income > 0 ? rent / income : 999;
  const dtiRatio = income > 0 ? debt / income : 999;
  const efMonths = monthlyExpenses > 0 ? emergency / monthlyExpenses : 0;

  const upfrontCosts = upfrontKnown ? upfrontCash : upfrontEstimate(rent, distance);
  const movCost = upfrontKnown ? 0 : movingCost(distance, usesMovers);
  const movTarget = upfrontCosts + movCost;
  const movPct = movTarget > 0 ? movingFund / movTarget : 0;

  const efScore = scoreEmergency(efMonths);
  const rtiScore = scoreRentToIncome(rtiRatio);
  const movScore = scoreMovingFund(movPct);
  const dtiScore = scoreDTI(dtiRatio);
  const stabScore = scoreStability(stability);

  const total = Math.round(
    efScore * 0.20 + rtiScore * 0.35 + movScore * 0.20 +
    dtiScore * 0.15 + stabScore * 0.10
  );

  const movMetaSuffix = upfrontKnown ? '' : ' (est.)';

  return {
    total,
    factors: [
      {
        name: 'Rent-to-Income', weight: '35%', score: rtiScore,
        meta: `${(rtiRatio * 100).toFixed(1)}% of take-home`,
        detail: {
          yours: `$${rent.toLocaleString()} rent = ${(rtiRatio * 100).toFixed(1)}% of your $${income.toLocaleString()} take-home`,
          ideal: 'Under 30% is the widely-cited healthy range',
          note: rtiRatio <= 0.30 ? 'You\'re under the 30% threshold — solid.' : rtiRatio <= 0.35 ? 'Slightly above 30% but still manageable for most budgets.' : 'Above 35% leaves little room for unexpected expenses — consider if rent can come down.'
        }
      },
      {
        name: 'Emergency Fund', weight: '20%', score: efScore,
        meta: `${efMonths.toFixed(1)} months of expenses`,
        detail: {
          yours: `${efMonths.toFixed(1)} months of expenses covered`,
          ideal: '3–6 months is the target range',
          note: efMonths >= 3 ? 'You\'re in good shape here.' : efMonths >= 1 ? 'Building toward 3 months would meaningfully improve your cushion.' : 'Even one month of coverage makes a real difference — prioritize this.'
        }
      },
      {
        name: 'Move Savings', weight: '20%', score: movScore,
        meta: `${Math.min(100, (movPct * 100)).toFixed(0)}% of $${movTarget.toLocaleString()}${movMetaSuffix} target`,
        detail: {
          yours: `$${Number(movingFund).toLocaleString()} saved toward a $${movTarget.toLocaleString()} total target`,
          ideal: '100% of the target covered before signing',
          note: movPct >= 1 ? 'You\'ve fully covered your move costs — great position.' : movPct >= 0.6 ? `You're about $${Math.round((movTarget - movingFund)).toLocaleString()} short of the full target.` : `You're about $${Math.round((movTarget - movingFund)).toLocaleString()} short — worth building this up before committing.`
        }
      },
      {
        name: 'Debt-to-Income', weight: '15%', score: dtiScore,
        meta: `${(dtiRatio * 100).toFixed(1)}% of take-home`,
        detail: {
          yours: `$${debt.toLocaleString()}/mo in debt payments = ${(dtiRatio * 100).toFixed(1)}% of income`,
          ideal: 'Under 20% leaves healthy room for rent and living costs',
          note: dtiRatio <= 0.10 ? 'Very low debt load — this won\'t stress your budget.' : dtiRatio <= 0.15 ? 'Manageable, but keep an eye on it alongside rent.' : dtiRatio <= 0.20 ? 'At this level, debt is starting to compete with rent for your income — worth paying down.' : 'High debt-to-income can make landlords hesitant and budgets very tight.'
        }
      },
      {
        name: 'Income Stability', weight: '10%', score: stabScore,
        meta: stability.replace(/_/g, ' '),
        detail: {
          yours: `Reported as: ${stability.replace(/_/g, ' ')}`,
          ideal: 'Very predictable income scores highest',
          note: stabScore >= 85 ? 'Predictable income is a strong signal for landlords and your own planning.' : stabScore >= 60 ? 'Some variability is fine — just keep a larger buffer in your emergency fund.' : 'Unpredictable income means landlords may ask for extra months upfront, so budget accordingly.'
        }
      }
    ]
  };
}

/* ── RENDER ── */

const TIER_COLORS = { excellent: '#4a90e2', good: '#3ecfb2', medium: '#f5c842', low: '#ff5f4b' };

function renderResults(res) {
  const { total, factors } = res;
  const t = tier(total);
  const [msg, sub] = qualMessage(total);
  const color = TIER_COLORS[t];

  document.getElementById('scoreBig').textContent = total;
  document.getElementById('scoreBig').style.color = color;
  document.getElementById('scoreTierLabel').textContent = tierLabel(t);

  const ring = document.getElementById('ringFg');
  const circumference = 2 * Math.PI * 60; // ≈ 376.99
  ring.style.stroke = color;
  ring.style.strokeDasharray = circumference;
  ring.style.strokeDashoffset = circumference;
  setTimeout(() => {
    ring.style.strokeDashoffset = circumference * (1 - total / 100);
  }, 80);

  const badge = document.getElementById('tierBadge');
  badge.textContent = tierLabel(t).toUpperCase();
  badge.className = `result-tier-badge badge-${t}`;

  document.getElementById('resultMessage').textContent = msg;
  document.getElementById('resultSub').textContent = sub;

  const barsEl = document.getElementById('factorBars');
  barsEl.innerHTML = '';
  factors.forEach((f, i) => {
    const ft = tier(f.score);
    const fc = TIER_COLORS[ft];
    const row = document.createElement('div');
    row.className = 'factor-row';
    row.innerHTML = `
        <div class="factor-header">
          <div>
            <span class="factor-name">${f.name}</span>
            <span class="factor-meta"> · ${f.meta}</span>
            <span class="factor-chevron">▾</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="factor-meta">${f.weight}</span>
            <span class="factor-score-num" style="color:${fc}">${f.score}</span>
          </div>
        </div>
        <div class="bar-track">
          <div class="bar-fill" id="bar${i}" style="background:${fc}"></div>
        </div>
        <div class="factor-detail">
          <div class="factor-detail-inner">
            <div class="detail-item">
              <span class="detail-label">Your number</span>
              <span class="detail-value">${f.detail.yours}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Ideal range</span>
              <span class="detail-value">${f.detail.ideal}</span>
            </div>
            <div class="detail-note">${f.detail.note}</div>
          </div>
        </div>`;
    barsEl.appendChild(row);

    // accordion toggle
    row.querySelector('.factor-header').addEventListener('click', () => {
      const isOpen = row.classList.contains('open');
      barsEl.querySelectorAll('.factor-row').forEach(r => r.classList.remove('open'));
      if (!isOpen) row.classList.add('open');
    });

    setTimeout(() => {
      document.getElementById(`bar${i}`).style.width = f.score + '%';
    }, 120 + i * 80);
  });
}

/* ── INPUT CAPS ── */

const FIELD_CAPS = {
  income:      { max: 50000,   label: 'Monthly take-home'         },
  rent:        { max: 10000,   label: 'Expected rent'             },
  debt:        { max: 10000,   label: 'Monthly debt payments'     },
  emergency:   { max: 500000,  label: 'Emergency fund'            },
  movingFund:  { max: 100000,  label: 'Moving savings'            },
  upfrontCash: { max: 100000,  label: 'Upfront move-in cash'      },
};

// Inject an inline error element beneath each capped input
function getOrCreateError(id) {
  const existing = document.getElementById(`err-${id}`);
  if (existing) return existing;
  const el = document.getElementById(id);
  const err = document.createElement('p');
  err.id = `err-${id}`;
  err.className = 'field-error';
  err.setAttribute('aria-live', 'polite');
  // Insert right after the input-wrap div
  el.closest('.input-wrap').insertAdjacentElement('afterend', err);
  // Associate the error with the input
  el.setAttribute('aria-describedby', `err-${id}`);
  return err;
}

function clearError(id) {
  const err = document.getElementById(`err-${id}`);
  if (err) {
    err.remove();
    // Remove the aria-describedby association
    const el = document.getElementById(id);
    if (el) {
      const describedBy = el.getAttribute('aria-describedby');
      if (describedBy === `err-${id}`) {
        el.removeAttribute('aria-describedby');
      } else if (describedBy) {
        // If there are multiple, remove this one
        const ids = describedBy.split(' ').filter(d => d !== `err-${id}`);
        if (ids.length) {
          el.setAttribute('aria-describedby', ids.join(' '));
        } else {
          el.removeAttribute('aria-describedby');
        }
      }
    }
  }
}

function setError(id, msg) {
  getOrCreateError(id).textContent = msg;
}

// Attach clamping listeners to every capped field
Object.entries(FIELD_CAPS).forEach(([id, { max, label }]) => {
  const el = document.getElementById(id);
  if (!el) return;

  el.addEventListener('input', () => {
    const raw = parseFloat(el.value);
    if (!isNaN(raw) && raw > max) {
      el.value = max;
      setError(id, `${label} can't exceed $${max.toLocaleString()}/mo — capped.`);
    } else {
      clearError(id);
    }

    // Re-run cross-field check whenever income or rent changes
    if (id === 'income' || id === 'rent') validateRentVsIncome();
  });

  // Preserve existing blur-rounding behaviour
  el.addEventListener('blur', () => {
    if (el.value !== '') el.value = Math.round(parseFloat(el.value));
  });
});

/* ── CROSS-FIELD: rent must not exceed income ── */

function validateRentVsIncome() {
  const income = parseFloat(document.getElementById('income').value) || 0;
  const rent   = parseFloat(document.getElementById('rent').value)   || 0;
  if (income > 0 && rent >= income) {
    setError('rent', 'Rent can\'t equal or exceed your take-home pay.');
    return false;
  }
  clearError('rent');
  return true;
}

/* ── UPFRONT CASH REQUIRED WHEN TOGGLE IS ON ── */

function validateUpfrontCash() {
  if (!upfrontToggle.checked) {
    clearError('upfrontCash');
    return true;
  }
  const upfrontCash = parseFloat(document.getElementById('upfrontCash').value);
  if (!upfrontCash || isNaN(upfrontCash) || upfrontCash <= 0) {
    setError('upfrontCash', 'Please enter your upfront move-in costs.');
    return false;
  }
  clearError('upfrontCash');
  return true;
}

/* ── UPFRONT TOGGLE ── */
const upfrontToggle = document.getElementById('upfrontToggle');
const upfrontField  = document.getElementById('upfrontField');
const upfrontEstEl  = document.getElementById('upfrontEstimate');
const moversToggle  = document.getElementById('moversToggle');

function updateUpfrontEstimate() {
  const rent      = parseFloat(document.getElementById('rent').value) || 0;
  const distance  = document.getElementById('distance').value;
  const usesMovers = moversToggle.checked;
  if (!upfrontToggle.checked && rent > 0) {
    const upfront    = upfrontEstimate(rent, distance);
    const movCost    = movingCost(distance, usesMovers);
    const total      = upfront + movCost;
    const multiplier = distance === 'long' ? '3×' : '2×';
    const depositNote = distance === 'long' ? 'first + last month + security deposit' : 'first month + security deposit';
    const moversNote  = usesMovers ? 'professional movers' : 'DIY move';
    upfrontEstEl.textContent = `We'll estimate $${upfront.toLocaleString()} for move-in costs (${multiplier} rent — ${depositNote}) + $${movCost.toLocaleString()} for ${moversNote} = $${total.toLocaleString()} total target.`;
  } else {
    upfrontEstEl.textContent = '';
  }
}

upfrontToggle.addEventListener('change', () => {
  upfrontField.classList.toggle('open', upfrontToggle.checked);
  updateUpfrontEstimate();
  validateUpfrontCash();
});
document.getElementById('upfrontCash').addEventListener('blur', validateUpfrontCash);
moversToggle.addEventListener('change', updateUpfrontEstimate);
document.getElementById('rent').addEventListener('input', updateUpfrontEstimate);
document.getElementById('distance').addEventListener('change', updateUpfrontEstimate);

/* ── FORM SUBMIT ── */

document.getElementById('calc-form').addEventListener('submit', (e) => {
  e.preventDefault();

  // Cross-field checks block submission
  if (!validateRentVsIncome()) {
    document.getElementById('rent').scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('rent').focus();
    return;
  }

  if (!validateUpfrontCash()) {
    document.getElementById('upfrontCash').scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('upfrontCash').focus();
    return;
  }

  const v = (id) => {
    const val = parseFloat(document.getElementById(id).value);
    return (isNaN(val) || val < 0) ? 0 : val;
  };
  const upfrontKnown = upfrontToggle.checked;
  const inputs = {
    income:      v('income'),
    rent:        v('rent'),
    debt:        v('debt'),
    emergency:   v('emergency'),
    movingFund:  v('movingFund'),
    distance:    document.getElementById('distance').value,
    stability:   document.getElementById('stability').value,
    usesMovers:  moversToggle.checked,
    upfrontKnown,
    upfrontCash: upfrontKnown ? v('upfrontCash') : 0,
  };

  // Validate that income and rent are non-zero
  if (!inputs.income) {
    setError('income', 'Please enter a monthly take-home pay greater than $0.');
    document.getElementById('income').scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('income').focus();
    return;
  }
  clearError('income');

  if (!inputs.rent) {
    setError('rent', 'Please enter an expected rent greater than $0.');
    document.getElementById('rent').scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('rent').focus();
    return;
  }
  clearError('rent');

  if (!inputs.emergency) {
    setError('emergency', 'Please enter an emergency fund balance greater than $0.');
    document.getElementById('emergency').scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('emergency').focus();
    return;
  }
  clearError('emergency');

  const res = calculate(inputs);
  gtag('event', 'calculator_submitted', { score: res.total });
  renderResults(res);

  const resultsEl = document.getElementById('results');
  resultsEl.classList.add('visible');
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.getElementById('resetBtn').addEventListener('click', () => {
  document.getElementById('results').classList.remove('visible');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
