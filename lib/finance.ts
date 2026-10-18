export function amortize(
  principal: number,
  annualRate: number,
  months: number,
  prepayment = 0,
) {
  if (
    !Number.isFinite(principal) ||
    principal <= 0 ||
    principal > 1e10 ||
    !Number.isFinite(annualRate) ||
    annualRate < 0 ||
    annualRate > 100 ||
    !Number.isInteger(months) ||
    months < 1 ||
    months > 600 ||
    !Number.isFinite(prepayment) ||
    prepayment < 0
  )
    throw new Error(
      "Enter a valid principal, rate (0–100%), tenure (1–600 months), and nonnegative prepayment.",
    );
  const rate = annualRate / 1200;
  const emi =
    rate === 0
      ? principal / months
      : (principal * rate) / (1 - Math.pow(1 + rate, -months));
  let balance = principal,
    totalInterest = 0;
  const schedule = [];
  for (let month = 1; month <= months && balance > 0.005; month++) {
    const interest = balance * rate;
    const payment = Math.min(balance + interest, emi + prepayment);
    const capital = payment - interest;
    balance = Math.max(0, balance - capital);
    totalInterest += interest;
    schedule.push({
      month,
      payment: Math.round(payment * 100) / 100,
      principal: Math.round(capital * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    });
  }
  return {
    emi: Math.round(emi * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalRepayment: Math.round((principal + totalInterest) * 100) / 100,
    months: schedule.length,
    schedule,
    assumption:
      "Fixed annual rate, monthly reducing balance; extra amount applied with each EMI, reducing tenure. Excludes bank fees and rate changes. Display rounded to paise; internal calculations retain precision.",
  };
}
