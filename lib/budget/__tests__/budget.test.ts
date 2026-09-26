import { describe, expect, it } from "vitest";
import { formatMoney, parseMoney, sumMoney } from "../money";
import {
  donutSlices,
  summarizeBudget,
  upcomingPayments,
  type BudgetExpense,
  type BudgetPayment,
} from "../stats";
import { SUGGESTED_CATEGORIES, suggestedAllocations } from "../suggested";

const exp = (
  id: string,
  categoryId: string,
  estimated: number,
  actual: number | null = null,
): BudgetExpense => ({
  id,
  categoryId,
  vendorId: null,
  name: id,
  estimated,
  actual,
  notes: null,
  receiptPath: null,
  receiptName: null,
});
const pay = (
  id: string,
  expenseId: string,
  amount: number,
  paid: boolean,
  dueDate: string | null = null,
): BudgetPayment => ({
  id,
  expenseId,
  amount,
  paid,
  dueDate,
  paidOn: null,
  note: null,
});

describe("money", () => {
  it("adds exactly to the cent", () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney(["1000.10", 99.95, null])).toBe(1100.05);
  });

  it("reads amounts the way people type them", () => {
    expect(parseMoney("1.234,50")).toBe(1234.5);
    expect(parseMoney("1,234.50")).toBe(1234.5);
    expect(parseMoney("€ 800")).toBe(800);
    expect(parseMoney("12,5")).toBe(12.5);
    expect(parseMoney("1.000")).toBe(1000);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });

  it("formats money in the wedding's currency", () => {
    expect(formatMoney(1234, "EUR")).toMatch(/1.234/);
    expect(formatMoney(12.5, "USD")).toMatch(/12.50/);
  });
});

describe("budget summary", () => {
  const categories = [
    { id: "venue", name: "Venue", allocated: 5000, sortOrder: 0 },
    { id: "flowers", name: "Flowers", allocated: 1000, sortOrder: 1 },
  ];
  const expenses = [
    exp("hire", "venue", 4500, 4800),
    exp("bouquets", "flowers", 700),
    exp("arch", "flowers", 400),
  ];
  const payments = [
    pay("p1", "hire", 1000, true),
    pay("p2", "hire", 3800, false, "2027-05-01"),
    pay("p3", "arch", 100, true),
  ];

  it("uses actual prices when known, estimates otherwise, and flags overspending", () => {
    const s = summarizeBudget(10000, categories, expenses, payments);
    const [venue, flowers] = s.categories;
    expect(venue.totals).toMatchObject({ committed: 4800, paid: 1000, outstanding: 3800 });
    expect(venue.over).toBe(-200);
    expect(flowers.totals.committed).toBe(1100);
    expect(flowers.over).toBe(100); // over budget
    expect(s.totals).toMatchObject({ allocated: 6000, committed: 5900, paid: 1100 });
    expect(s.unallocated).toBe(4000);
    expect(s.remaining).toBe(4100);
  });

  it("works without a total budget", () => {
    const s = summarizeBudget(null, categories, [], []);
    expect(s.remaining).toBeNull();
    expect(s.totals.committed).toBe(0);
  });

  it("lists unpaid payments by due date and marks overdue ones", () => {
    const list = upcomingPayments(
      [...payments, pay("p4", "bouquets", 200, false, "2027-01-01"), pay("p5", "arch", 50, false)],
      expenses,
      categories,
      "2027-02-01",
    );
    expect(list.map((p) => p.id)).toEqual(["p4", "p2"]);
    expect(list[0]).toMatchObject({ overdue: true, days: -31, categoryName: "Flowers" });
    expect(list[1].overdue).toBe(false);
  });

  it("groups small categories into Other for the donut", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`,
      name: `C${i}`,
      allocated: 0,
      sortOrder: i,
    }));
    const ex = many.map((c, i) => exp(`e${i}`, c.id, (i + 1) * 100));
    const slices = donutSlices(summarizeBudget(null, many, ex, []), 7);
    expect(slices).toHaveLength(8);
    expect(slices[0]).toMatchObject({ name: "C9", value: 1000 });
    expect(slices[7]).toMatchObject({ id: "other", name: "Other (3)", value: 600 });
  });
});

describe("suggested categories", () => {
  it("add up to 100% and split a total exactly", () => {
    expect(SUGGESTED_CATEGORIES.reduce((n, c) => n + c.percent, 0)).toBe(100);
    const parts = suggestedAllocations(23457);
    expect(parts.reduce((n, p) => n + p.allocated, 0)).toBe(23457);
    expect(parts.find((p) => p.name === "Catering")?.allocated).toBeGreaterThan(5800);
  });
});
