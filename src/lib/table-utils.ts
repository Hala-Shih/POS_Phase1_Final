import ordersData from "@/data/orders.json";

type OrderRecord = {
  tableId: string;
  total: number;
  createdAt: string;
};

const orders = ordersData as OrderRecord[];

export function getLatestCheckoutTotal(tableId: string): number | null {
  const matchingOrders = orders.filter((order) => order.tableId === tableId);
  if (matchingOrders.length === 0) return null;

  const latestOrder = matchingOrders.reduce((latest, order) => {
    return new Date(order.createdAt).getTime() > new Date(latest.createdAt).getTime() ? order : latest;
  });

  return latestOrder.total;
}