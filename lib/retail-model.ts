export const retailDefaults = {
  families: 130,
  familySpend: 500000,
  target: 30000000,
  activeFamilies: 75,
  basket: 50000,
  days: 30,
  margin: 18,
  driverSalary: 1800000,
  drivers: 2,
  rent: 800000,
  utilities: 200000,
  packingPerOrder: 500,
  wastage: 1.5,
};
export function retailScenario(x = retailDefaults) {
  if (
    Object.values(x).some((v) => !Number.isFinite(v) || v < 0) ||
    ![
      x.families,
      x.familySpend,
      x.target,
      x.activeFamilies,
      x.basket,
      x.days,
      x.drivers,
    ].every((v) => v > 0) ||
    x.margin > 100 ||
    x.wastage > 100
  )
    throw new Error(
      "Use positive planning inputs and percentages between 0 and 100.",
    );
  const market = x.families * x.familySpend,
    orders = x.target / x.basket,
    gross = (x.target * x.margin) / 100;
  const costs =
    x.driverSalary * x.drivers +
    x.rent +
    x.utilities +
    orders * x.packingPerOrder +
    (x.target * x.wastage) / 100;
  const variableRate = x.packingPerOrder / x.basket + x.wastage / 100,
    contributionRate = x.margin / 100 - variableRate;
  const fixed = x.driverSalary * x.drivers + x.rent + x.utilities;
  return {
    market,
    capture: market ? (x.target / market) * 100 : 0,
    perFamily: x.families ? x.target / x.families : 0,
    perActive: x.activeFamilies ? x.target / x.activeFamilies : 0,
    orders,
    ordersPerDay: orders / x.days,
    ordersPerDriver: orders / x.days / x.drivers,
    gross,
    costs,
    operatingRemainder: gross - costs,
    breakEven: contributionRate > 0 ? fixed / contributionRate : null,
  };
}
